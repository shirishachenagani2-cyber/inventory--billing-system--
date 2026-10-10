CREATE DATABASE IF NOT EXISTS inventory_billing
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventory_billing;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  sku VARCHAR(50) NOT NULL UNIQUE,
  category VARCHAR(80),
  price DECIMAL(12,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 5,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_products_price CHECK (price >= 0),
  CONSTRAINT chk_products_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_products_reorder CHECK (reorder_level >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(25),
  email VARCHAR(150),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NULL,
  total DECIMAL(12,2) NOT NULL,
  status ENUM('COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL,
  CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT chk_invoice_total CHECK (total >= 0),
  INDEX idx_invoice_date (created_at),
  INDEX idx_invoice_customer (customer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_item_invoice FOREIGN KEY (invoice_id)
    REFERENCES invoices(id) ON DELETE RESTRICT,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT chk_item_quantity CHECK (quantity > 0),
  CONSTRAINT chk_item_price CHECK (unit_price >= 0),
  CONSTRAINT chk_item_subtotal CHECK (subtotal >= 0),
  INDEX idx_item_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  movement_type ENUM('OPENING', 'SALE', 'RESTOCK', 'ADJUSTMENT', 'SALE_CANCELLED') NOT NULL,
  quantity_change INT NOT NULL,
  reference_type VARCHAR(30),
  reference_id INT NULL,
  note VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movement_product FOREIGN KEY (product_id)
    REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_movement_product_date (product_id, created_at)
) ENGINE=InnoDB;
