-- ==============================================================================
-- ShopFlow D1 Migration 0004: Open Orders / Held Sales / Customer Timeline
-- ==============================================================================

CREATE TABLE IF NOT EXISTS open_orders (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  customer_id TEXT,
  temporary_customer_name TEXT,
  status TEXT NOT NULL, -- 'OPEN' | 'CHECKED_OUT' | 'CANCELLED'
  total_amount REAL NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  sale_id TEXT,
  last_activity_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_open_orders_shop_status ON open_orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_open_orders_last_activity ON open_orders(shop_id, last_activity_at);

CREATE TABLE IF NOT EXISTS open_order_items (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  open_order_id TEXT NOT NULL REFERENCES open_orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_emoji TEXT,
  variant_id TEXT,
  variant_name TEXT,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_open_order_items_order_id ON open_order_items(shop_id, open_order_id);
