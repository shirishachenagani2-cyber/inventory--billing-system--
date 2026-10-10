const express = require("express");
const pool = require("../config/db");
const { isPositiveId } = require("../utils/validation");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, phone, email, created_at FROM customers ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  const { name, phone = null, email = null } = req.body || {};
  if (typeof name !== "string" || !name.trim() ||
      (phone !== null && typeof phone !== "string") ||
      (email !== null && typeof email !== "string") ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: "Provide a valid customer name, phone, and email" });
  }

  try {
    const [result] = await pool.execute(
      "INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)",
      [name.trim(), phone ? phone.trim() : null, email ? email.trim() : null]
    );
    res.status(201).json({ message: "Customer created", id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  if (!isPositiveId(req.params.id)) return res.status(400).json({ error: "Invalid customer ID" });
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, phone, email, created_at FROM customers WHERE id = ?",
      [Number(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ error: "Customer not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  if (!isPositiveId(req.params.id)) return res.status(400).json({ error: "Invalid customer ID" });
  const { name, phone = null, email = null } = req.body || {};
  if (typeof name !== "string" || !name.trim() ||
      (phone !== null && typeof phone !== "string") ||
      (email !== null && typeof email !== "string") ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: "Invalid customer data" });
  }

  try {
    const [result] = await pool.execute(
      "UPDATE customers SET name = ?, phone = ?, email = ? WHERE id = ?",
      [name.trim(), phone ? phone.trim() : null, email ? email.trim() : null, Number(req.params.id)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Customer not found" });
    res.json({ message: "Customer updated" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
