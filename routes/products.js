const express = require("express");
const pool = require("../config/db");
const { isPositiveId, isMoney, isNonNegativeInteger } = require("../utils/validation");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { search, lowStock } = req.query;
    let sql = "SELECT id, name, sku, category, price, quantity, reorder_level, created_at, updated_at FROM products";
    const params = [];
    const where = [];

    if (typeof search === "string" && search.trim()) {
      where.push("(name LIKE ? OR sku LIKE ? OR category LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    if (lowStock === "true") where.push("quantity <= reorder_level");
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY id DESC";

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  if (!isPositiveId(req.params.id)) return res.status(400).json({ error: "Invalid product ID" });
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, sku, category, price, quantity, reorder_level, created_at, updated_at FROM products WHERE id = ?",
      [Number(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const { name, sku, category = null, price, quantity, reorder_level = 5 } = req.body || {};

  if (typeof name !== "string" || !name.trim() ||
      typeof sku !== "string" || !sku.trim() ||
      !isMoney(price) ||
      !isNonNegativeInteger(quantity) ||
      !isNonNegativeInteger(reorder_level) ||
      (category !== null && typeof category !== "string")) {
    return res.status(400).json({
      error: "Provide a name, SKU, valid non-negative price, quantity, and reorder level"
    });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO products (name, sku, category, price, quantity, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), sku.trim(), category ? category.trim() : null, String(price), quantity, reorder_level]
    );

    if (quantity > 0) {
      await pool.execute(
        `INSERT INTO stock_movements
         (product_id, movement_type, quantity_change, reference_type, note)
         VALUES (?, 'OPENING', ?, 'PRODUCT', 'Initial stock')`,
        [result.insertId, quantity]
      );
    }

    res.status(201).json({ message: "Product created", id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  if (!isPositiveId(req.params.id)) return res.status(400).json({ error: "Invalid product ID" });
  const { name, sku, category = null, price, quantity, reorder_level = 5 } = req.body || {};

  if (typeof name !== "string" || !name.trim() ||
      typeof sku !== "string" || !sku.trim() ||
      !isMoney(price) ||
      !isNonNegativeInteger(quantity) ||
      !isNonNegativeInteger(reorder_level) ||
      (category !== null && typeof category !== "string")) {
    return res.status(400).json({ error: "Invalid product data" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [products] = await connection.execute(
      "SELECT id, quantity FROM products WHERE id = ? FOR UPDATE",
      [Number(req.params.id)]
    );
    if (!products.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found" });
    }

    const oldQuantity = products[0].quantity;
    const [result] = await connection.execute(
      `UPDATE products SET name = ?, sku = ?, category = ?, price = ?,
       quantity = ?, reorder_level = ? WHERE id = ?`,
      [name.trim(), sku.trim(), category ? category.trim() : null, String(price),
       quantity, reorder_level, Number(req.params.id)]
    );

    const difference = quantity - oldQuantity;
    if (difference !== 0) {
      await connection.execute(
        `INSERT INTO stock_movements
         (product_id, movement_type, quantity_change, reference_type, note)
         VALUES (?, 'ADJUSTMENT', ?, 'PRODUCT', 'Manual inventory adjustment')`,
        [Number(req.params.id), difference]
      );
    }

    await connection.commit();
    res.json({ message: "Product updated", id: result.insertId || Number(req.params.id) });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

router.delete("/:id", async (req, res, next) => {
  if (!isPositiveId(req.params.id)) return res.status(400).json({ error: "Invalid product ID" });
  try {
    const [result] = await pool.execute("DELETE FROM products WHERE id = ?", [Number(req.params.id)]);
    if (!result.affectedRows) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
