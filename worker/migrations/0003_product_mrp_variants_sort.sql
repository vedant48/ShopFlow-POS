-- ==============================================================================
-- ShopFlow D1 Migration 0003: Product MRP, Price Variants, and Sort Order
-- ==============================================================================

ALTER TABLE products ADD COLUMN mrp REAL;
ALTER TABLE products ADD COLUMN price_variants TEXT;
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(shop_id, sort_order);
