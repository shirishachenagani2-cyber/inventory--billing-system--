javascript
require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.send("Inventory and Billing System is running!");
});

// Health check route
app.get("/api/health", async (req, res) => {
  try {
    const pool = require("./config/db");
    await pool.query("SELECT 1");

    res.json({
      status: "OK",
      message: "Server and MySQL connected successfully"
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(500).json({
      status: "ERROR",
      message: "MySQL connection failed. Check your .env settings."
    });
  }
});

// API routes
app.use("/api/products", require("./routes/products"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/reports", require("./routes/reports"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Internal server error"
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
