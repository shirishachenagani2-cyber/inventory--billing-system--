const express = require("express");
const pool = require("../config/db");
const { isPositiveId } = require("../utils/validation");
const { toPaise, fromPaise } = require("../utils/money");

const router = express.Router();

router.post("/", async (req, res, next) => {
  const { customer_id = null, items } = req.body || {};

  if (customer_id !== null && !isPositiveId(customer_id)) {
    return res.status(400).json({ error: "Invalid customer ID" });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return res.status(400).json({ error: "Provide between 1 and 100 invoice items" });
  }

  const quantities = new Map();
  for (const item of items) {
    if (!item || !isPositiveId(item.product_id) ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({
        error: "Each item requires a positive product_id and positive integer quantity"
      });
    }
    const id = Number(item.product_id);
    const sum = (quantities.get(id) || 0) + item.quantity;
    if (!Number.isSafeInteger(sum)) return res.status(400).json({ error: "Quantity is too large" });
    quantities.set(id, sum);
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    if (customer_id !== null) {
      const [customers] = await connection.execute(
        "SELECT id FROM customers WHERE id = ?",
        [Number(customer_id)]
      );
      if (!customers.length) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: "Customer not found" });
      }
    }

    // Sort IDs so concurrent sales lock product rows in a consistent order.
    const ids = [...quantities.keys()].sort((a, b) => a - b);
    const placeholders = ids.map(() => "?").join(",");
    const [products] = await connection.execute(
      `SELECT id, name, price, quantity FROM products
       WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      ids
    );

    if (products.length !== ids.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ error: "One or more products do not exist" });
    }

    const productMap = new Map(products.map(p => [p.id, p]));
    const billItems = [];
    let totalPaise = 0;

    for (const [productId, quantity] of quantities) {
      const product = productMap.get(productId);
      if (product.quantity < quantity) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          error: `Insufficient stock for ${product.name}`,
          available: product.quantity,
          requested: quantity
        });
      }

      const unitPaise = toPaise(product.price);
      const subtotalPaise = unitPaise * quantity;
      if (!Number.isSafeInteger(subtotalPaise) ||
          !Number.isSafeInteger(totalPaise + subtotalPaise)) {
        throw new Error("Invoice total exceeds supported calculation limit");
      }
      totalPaise += subtotalPaise;

      billItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: fromPaise(unitPaise),
        subtotal: fromPaise(subtotalPaise)
      });
    }

    const [invoiceResult] = await connection.execute(
      "INSERT INTO invoices (customer_id, total) VALUES (?, ?)",
      [customer_id === null ? null : Number(customer_id), fromPaise(totalPaise)]
    );
    const invoiceId = invoiceResult.insertId;

    for (const item of billItems) {
      await connection.execute(
        `INSERT INTO invoice_items
         (invoice_id, product_id, product_name, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoiceId, item.product_id, item.product_name, item.quantity,
         item.unit_price, item.subtotal]
      );

      const [update] = await connection.execute(
        "UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?",
        [item.quantity, item.product_id, item.quantity]
      );
      if (update.affectedRows !== 1) throw new Error("Stock update failed");

      await connection.execute(
        `INSERT INTO stock_movements
         (product_id, movement_type, quantity_change, reference_type, reference_id, note)
         VALUES (?, 'SALE', ?, 'INVOICE', ?, 'Stock deducted for sale')`,
        [item.product_id, -item.quantity, invoiceId]
      );
    }

    await connection.commit();
    transactionStarted = false;

    res.status(201).json({
      message: "Invoice created successfully",
      invoice_id: invoiceId,
      customer_id: customer_id === null ? null : Number(customer_id),
      items: billItems,
      total: fromPaise(totalPaise)
    });
  } catch (err) {
    if (transactionStarted) await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.customer_id, c.name AS customer_name,
              i.total, i.status, i.created_at
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       ORDER BY i.id DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  if (!isPositiveId(req.params.id)) return res.status(400).json({ error: "Invalid invoice ID" });
  try {
    const [invoices] = await pool.execute(
      `SELECT i.id, i.customer_id, c.name AS customer_name,
              i.total, i.status, i.created_at, i.cancelled_at
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.id = ?`,
      [Number(req.params.id)]
    );
    if (!invoices.length) return res.status(404).json({ error: "Invoice not found" });

    const [items] = await pool.execute(
      `SELECT product_id, product_name, quantity, unit_price, subtotal
       FROM invoice_items WHERE invoice_id = ? ORDER BY id`,
      [Number(req.params.id)]
    );
    res.json({ ...invoices[0], items });
  } catch (err) {
    next(err);
  }
});

// Cancellation restores stock once, keeps the invoice as an audit record,
// and is fully transactional.
router.post("/:id/cancel", async (req, res, next) => {
  if (!isPositiveId(req.params.id)) return res.status(400).json({ error: "Invalid invoice ID" });

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [invoices] = await connection.execute(
      "SELECT id, status FROM invoices WHERE id = ? FOR UPDATE",
      [Number(req.params.id)]
    );
    if (!invoices.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (invoices[0].status === "CANCELLED") {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: "Invoice is already cancelled" });
    }

    const [items] = await connection.execute(
      "SELECT product_id, quantity FROM invoice_items WHERE invoice_id = ? ORDER BY product_id",
      [Number(req.params.id)]
    );

    for (const item of items) {
      await connection.execute(
        "UPDATE products SET quantity = quantity + ? WHERE id = ?",
        [item.quantity, item.product_id]
      );
      await connection.execute(
        `INSERT INTO stock_movements
         (product_id, movement_type, quantity_change, reference_type, reference_id, note)
         VALUES (?, 'SALE_CANCELLED', ?, 'INVOICE', ?, 'Stock restored after invoice cancellation')`,
        [item.product_id, item.quantity, Number(req.params.id)]
      );
    }

    await connection.execute(
      "UPDATE invoices SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?",
      [Number(req.params.id)]
    );

    await connection.commit();
    transactionStarted = false;
    res.json({ message: "Invoice cancelled and stock restored" });
  } catch (err) {
    if (transactionStarted) await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

module.exports = router;
