# Inventory and Billing System

Backend college project built with Node.js, Express.js and MySQL.

## Requirements

- Node.js LTS
- MySQL Server
- MySQL Workbench (optional but helpful)
- Postman (for API testing)

## Setup

1. Open this folder in VS Code.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a MySQL user for the project and grant it access to `inventory_billing`. Example commands (run with an administrator account and choose your own password):

   ```sql
   CREATE USER 'inventory_user'@'localhost' IDENTIFIED BY 'replace_with_your_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_billing.* TO 'inventory_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

   If the database does not exist yet, execute `schema.sql` first as an administrator, then create/grant the user.

4. Copy `.env.example` to `.env` and enter your MySQL settings.
5. Run `schema.sql` in MySQL Workbench.
6. Start the server:

   ```bash
   npm run dev
   ```

7. Visit `http://localhost:3000/api/health`.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health and database connection |
| GET | `/api/products` | List products |
| GET | `/api/products?search=pen` | Search products |
| GET | `/api/products?lowStock=true` | List low-stock products |
| GET | `/api/products/:id` | Get one product |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product (not if referenced by sales) |
| GET | `/api/customers` | List customers |
| GET | `/api/customers/:id` | Get customer |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| POST | `/api/invoices` | Create invoice and deduct stock |
| GET | `/api/invoices` | List invoices |
| GET | `/api/invoices/:id` | Get invoice and items |
| POST | `/api/invoices/:id/cancel` | Cancel invoice and restore stock |
| GET | `/api/reports/sales` | Today's sales |
| GET | `/api/reports/sales-summary?from=2026-01-01&to=2026-01-31` | Sales date range |
| GET | `/api/reports/low-stock` | Low-stock list |
| GET | `/api/reports/stock-movements` | Recent stock history |

## Create a product

POST `http://localhost:3000/api/products`

Body -> raw -> JSON:

```json
{
  "name": "Notebook",
  "sku": "NB001",
  "category": "Stationery",
  "price": "50.00",
  "quantity": 100,
  "reorder_level": 10
}
```

## Create a customer

POST `http://localhost:3000/api/customers`

```json
{
  "name": "Rahul",
  "phone": "9876543210",
  "email": "rahul@example.com"
}
```

## Create an invoice

POST `http://localhost:3000/api/invoices`

Use actual IDs returned by the product and customer APIs:

```json
{
  "customer_id": 1,
  "items": [
    { "product_id": 1, "quantity": 2 }
  ]
}
```

The backend reads prices from MySQL, calculates the total, saves invoice items, updates stock, and records stock movements in one transaction.

## Important notes

- This is a learning project starter, not a production-ready commercial system.
- Add authentication and role-based authorization before exposing it beyond a local demo.
- Never commit `.env` or share database passwords.
- Use a supported MySQL version that enforces `CHECK` constraints.
- Test invoice creation and cancellation using Postman and verify quantities in MySQL.
