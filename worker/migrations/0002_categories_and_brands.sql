-- ==============================================================================
-- ShopFlow D1 Migration 0002: Categories and Brands Hierarchy
-- Forward-only, non-destructive migration preserving all existing tables & data
-- ==============================================================================

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'package',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_shop_id ON categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(shop_id, sort_order);

-- 2. Brands Table (Scoped to a single Category)
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brands_shop_id ON brands(shop_id);
CREATE INDEX IF NOT EXISTS idx_brands_category_id ON brands(category_id);
CREATE INDEX IF NOT EXISTS idx_brands_sort ON brands(category_id, sort_order);

-- 3. Add category_id and brand_id columns to products table
ALTER TABLE products ADD COLUMN category_id TEXT;
ALTER TABLE products ADD COLUMN brand_id TEXT;

-- 4. Create indexes on products for category and brand lookups
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);

-- 5. Seed default categories for existing shops if none exist (idempotent)
INSERT OR IGNORE INTO categories (id, shop_id, name, icon, sort_order, is_active, created_at, updated_at)
SELECT 'cat_cig_' || id, id, 'Cigarettes', 'cigarette', 1, 1, datetime('now'), datetime('now')
FROM shops
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE categories.shop_id = shops.id AND categories.name = 'Cigarettes');

INSERT OR IGNORE INTO categories (id, shop_id, name, icon, sort_order, is_active, created_at, updated_at)
SELECT 'cat_drinks_' || id, id, 'Cold Drinks', 'drink', 2, 1, datetime('now'), datetime('now')
FROM shops
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE categories.shop_id = shops.id AND categories.name = 'Cold Drinks');

INSERT OR IGNORE INTO categories (id, shop_id, name, icon, sort_order, is_active, created_at, updated_at)
SELECT 'cat_gutka_' || id, id, 'Gutka', 'gutka', 3, 1, datetime('now'), datetime('now')
FROM shops
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE categories.shop_id = shops.id AND categories.name = 'Gutka');

INSERT OR IGNORE INTO categories (id, shop_id, name, icon, sort_order, is_active, created_at, updated_at)
SELECT 'cat_choc_' || id, id, 'Chocolate', 'chocolate', 4, 1, datetime('now'), datetime('now')
FROM shops
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE categories.shop_id = shops.id AND categories.name = 'Chocolate');

INSERT OR IGNORE INTO categories (id, shop_id, name, icon, sort_order, is_active, created_at, updated_at)
SELECT 'cat_snacks_' || id, id, 'Snacks', 'snacks', 5, 1, datetime('now'), datetime('now')
FROM shops
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE categories.shop_id = shops.id AND categories.name = 'Snacks');

INSERT OR IGNORE INTO categories (id, shop_id, name, icon, sort_order, is_active, created_at, updated_at)
SELECT 'cat_others_' || id, id, 'Others', 'package', 6, 1, datetime('now'), datetime('now')
FROM shops
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE categories.shop_id = shops.id AND categories.name = 'Others');

-- 6. Backfill category_id for existing products where category_id IS NULL
UPDATE products
SET category_id = (
  SELECT id FROM categories
  WHERE categories.shop_id = products.shop_id
    AND (
      LOWER(categories.name) = LOWER(products.category)
      OR (categories.name = 'Cold Drinks' AND (LOWER(products.category) LIKE '%drink%' OR LOWER(products.name) LIKE '%coke%' OR LOWER(products.name) LIKE '%pepsi%'))
      OR (categories.name = 'Cigarettes' AND (LOWER(products.category) LIKE '%cig%' OR LOWER(products.name) LIKE '%cig%'))
      OR (categories.name = 'Snacks' AND (LOWER(products.category) LIKE '%snack%' OR LOWER(products.name) LIKE '%lays%'))
      OR (categories.name = 'Chocolate' AND (LOWER(products.category) LIKE '%choc%' OR LOWER(products.name) LIKE '%choc%'))
      OR (categories.name = 'Others' AND (LOWER(products.category) IN ('other', 'water') OR LOWER(products.name) LIKE '%water%'))
    )
  LIMIT 1
)
WHERE category_id IS NULL;
