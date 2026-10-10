module.exports = (err, req, res, next) => {
  // Log full details only on the server, never expose them to API clients.
  console.error(err);

  if (res.headersSent) return next(err);

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "A record with that unique value already exists" });
  }

  if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
    return res.status(409).json({ error: "This record is referenced by existing records and cannot be deleted" });
  }

  res.status(500).json({ error: "Internal server error" });
};
