-- ==============================================================================
-- ShopFlow D1 Initial Schema Migration
-- Designed for Cloudflare D1 (SQLite) with strict shop isolation
-- ==============================================================================

-- 1. Shops Table
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  phone TEXT,
  pin_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id);

-- 3. Products Table (Mutable with last-write-wins)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  emoji TEXT,
  selling_price REAL NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,
  stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 5,
  opening_stock REAL NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  category TEXT,
  sku TEXT,
  barcode TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);

-- 4. Customers Table (Mutable with last-write-wins)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  phone TEXT,
  balance REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);

-- 5. Sales Table (Append-only financial records)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  sale_number TEXT,
  customer_id TEXT,
  customer_name TEXT,
  payment_status TEXT NOT NULL, -- 'PAID' | 'UDHAAR'
  payment_method TEXT,          -- 'CASH' | 'UPI' | 'NONE' | 'UDHAAR'
  total REAL NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- 6. Sale Items Table (Preserved snapshot prices)
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  sale_id TEXT NOT NULL REFERENCES sales(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_emoji TEXT,
  quantity REAL NOT NULL,
  selling_price REAL NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_shop_id ON sale_items(shop_id);

-- 7. Payments Table (Append-only customer debt payments)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  amount REAL NOT NULL,
  payment_method TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);

-- 8. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suppliers_shop_id ON suppliers(shop_id);

-- 9. Purchases Table (Append-only inventory restock records)
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  supplier_id TEXT,
  supplier_name TEXT,
  product_id TEXT,
  product_name TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_shop_id ON purchases(shop_id);

-- 10. Purchase Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  purchase_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  cost_price REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_shop_id ON purchase_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);

-- 11. Inventory Movements Table (Movement-based stock source of truth)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  product_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN'
  quantity REAL NOT NULL,
  previous_stock REAL NOT NULL DEFAULT 0,
  new_stock REAL NOT NULL DEFAULT 0,
  reason TEXT,
  reference_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_shop_id ON inventory_movements(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);

-- 12. Expenses Table (Append-only daily store expenses)
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_shop_id ON expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

-- 13. Sync Events Table (Audit log & idempotency tracking)
CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_events_shop_id ON sync_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(shop_id, entity_type, entity_id);

-- ------------------------------------------------------------------------------
-- Seed Default Demo Shop and User for local development
-- ------------------------------------------------------------------------------
INSERT OR IGNORE INTO shops (id, name, created_at, updated_at)
VALUES ('shop_demo_001', 'ShopFlow Demo Counter', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO users (id, shop_id, name, phone, pin_hash, created_at, updated_at)
VALUES ('user_demo_001', 'shop_demo_001', 'Ramesh Shopkeeper', '+91 98765 43210', 'pin_1234', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
