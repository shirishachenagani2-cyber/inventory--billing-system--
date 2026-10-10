const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// GET /api/reports/sales
router.get("/sales", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT COUNT(*) AS invoice_count,
             COALESCE(SUM(total), 0.00) AS total_sales
      FROM invoices
      WHERE status = 'COMPLETED'
        AND created_at >= CURRENT_DATE()
        AND created_at < CURRENT_DATE() + INTERVAL 1 DAY
    `);
    res.json({
      invoice_count: rows[0].invoice_count,
      total_sales: rows[0].total_sales
    });
  } catch (err) {
    next(err);
  }
});

router.get("/sales-summary", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) ||
        (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
      return res.status(400).json({ error: "Dates must use YYYY-MM-DD format" });
    }
    if (from && to && from > to) {
      return res.status(400).json({ error: "'from' must be on or before 'to'" });
    }

    let sql = `
      SELECT COUNT(*) AS invoice_count,
             COALESCE(SUM(total), 0.00) AS total_sales
      FROM invoices
      WHERE status = 'COMPLETED'`;
    const params = [];
    if (from) {
      sql += " AND created_at >= ?";
      params.push(`${from} 00:00:00`);
    }
    if (to) {
      sql += " AND created_at < DATE_ADD(?, INTERVAL 1 DAY)";
      params.push(`${to} 00:00:00`);
    }

    const [rows] = await pool.execute(sql, params);
    res.json({
      from: from || null,
      to: to || null,
      invoice_count: rows[0].invoice_count,
      total_sales: rows[0].total_sales
    });
  } catch (err) {
    next(err);
  }
});

router.get("/low-stock", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, sku, quantity, reorder_level
      FROM products
      WHERE quantity <= reorder_level
      ORDER BY quantity ASC, name ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/stock-movements", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT sm.id, sm.product_id, p.name AS product_name,
             sm.movement_type, sm.quantity_change,
             sm.reference_type, sm.reference_id, sm.note, sm.created_at
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      ORDER BY sm.id DESC
      LIMIT 500
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
