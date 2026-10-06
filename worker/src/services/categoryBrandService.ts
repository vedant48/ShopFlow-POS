import type { CategoryRow, BrandRow } from '../types';

export const DEFAULT_CATEGORIES = [
  { name: 'Cigarettes', icon: 'cigarette', sort_order: 1 },
  { name: 'Cold Drinks', icon: 'drink', sort_order: 2 },
  { name: 'Gutka', icon: 'gutka', sort_order: 3 },
  { name: 'Chocolate', icon: 'chocolate', sort_order: 4 },
  { name: 'Snacks', icon: 'snacks', sort_order: 5 },
  { name: 'Others', icon: 'package', sort_order: 6 },
];

export async function getCategories(
  db: D1Database,
  shopId: string,
  includeInactive = false
): Promise<CategoryRow[]> {
  const query = includeInactive
    ? 'SELECT * FROM categories WHERE shop_id = ? ORDER BY sort_order ASC, name ASC'
    : 'SELECT * FROM categories WHERE shop_id = ? AND is_active = 1 ORDER BY sort_order ASC, name ASC';

  const res = await db.prepare(query).bind(shopId).all<CategoryRow>();
  return res.results || [];
}

export async function createCategory(
  db: D1Database,
  shopId: string,
  data: {
    id?: string;
    name: string;
    icon?: string;
    sortOrder?: number;
  }
): Promise<CategoryRow> {
  const now = new Date().toISOString();
  const id = data.id || `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const icon = data.icon || 'package';
  const sortOrder = data.sortOrder ?? 0;

  await db
    .prepare(
      `INSERT INTO categories (id, shop_id, name, icon, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .bind(id, shopId, data.name.trim(), icon, sortOrder, now, now)
    .run();

  const created = await db
    .prepare('SELECT * FROM categories WHERE id = ? AND shop_id = ?')
    .bind(id, shopId)
    .first<CategoryRow>();

  if (!created) throw new Error('Failed to retrieve created category');
  return created;
}

export async function updateCategory(
  db: D1Database,
  shopId: string,
  id: string,
  updates: {
    name?: string;
    icon?: string;
    sortOrder?: number;
    isActive?: boolean | number;
  }
): Promise<CategoryRow | null> {
  const now = new Date().toISOString();
  const activeVal =
    updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : null;

  await db
    .prepare(
      `UPDATE categories
       SET name = COALESCE(?, name),
           icon = COALESCE(?, icon),
           sort_order = COALESCE(?, sort_order),
           is_active = COALESCE(?, is_active),
           updated_at = ?
       WHERE id = ? AND shop_id = ?`
    )
    .bind(
      updates.name !== undefined ? updates.name.trim() : null,
      updates.icon !== undefined ? updates.icon : null,
      updates.sortOrder !== undefined ? updates.sortOrder : null,
      activeVal,
      now,
      id,
      shopId
    )
    .run();

  return await db
    .prepare('SELECT * FROM categories WHERE id = ? AND shop_id = ?')
    .bind(id, shopId)
    .first<CategoryRow>();
}

export async function getBrands(
  db: D1Database,
  shopId: string,
  categoryId?: string,
  includeInactive = false
): Promise<BrandRow[]> {
  let query = 'SELECT * FROM brands WHERE shop_id = ?';
  const binds: any[] = [shopId];

  if (categoryId) {
    query += ' AND category_id = ?';
    binds.push(categoryId);
  }

  if (!includeInactive) {
    query += ' AND is_active = 1';
  }

  query += ' ORDER BY sort_order ASC, name ASC';

  const res = await db.prepare(query).bind(...binds).all<BrandRow>();
  return res.results || [];
}

export async function createBrand(
  db: D1Database,
  shopId: string,
  data: {
    id?: string;
    categoryId: string;
    name: string;
    sortOrder?: number;
  }
): Promise<BrandRow> {
  // Validate that category belongs to this shop
  const category = await db
    .prepare('SELECT id FROM categories WHERE id = ? AND shop_id = ?')
    .bind(data.categoryId, shopId)
    .first();

  if (!category) {
    throw new Error('Category not found or does not belong to this shop');
  }

  const now = new Date().toISOString();
  const id = data.id || `br_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sortOrder = data.sortOrder ?? 0;

  await db
    .prepare(
      `INSERT INTO brands (id, shop_id, category_id, name, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .bind(id, shopId, data.categoryId, data.name.trim(), sortOrder, now, now)
    .run();

  const created = await db
    .prepare('SELECT * FROM brands WHERE id = ? AND shop_id = ?')
    .bind(id, shopId)
    .first<BrandRow>();

  if (!created) throw new Error('Failed to retrieve created brand');
  return created;
}

export async function updateBrand(
  db: D1Database,
  shopId: string,
  id: string,
  updates: {
    name?: string;
    sortOrder?: number;
    isActive?: boolean | number;
  }
): Promise<BrandRow | null> {
  const now = new Date().toISOString();
  const activeVal =
    updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : null;

  await db
    .prepare(
      `UPDATE brands
       SET name = COALESCE(?, name),
           sort_order = COALESCE(?, sort_order),
           is_active = COALESCE(?, is_active),
           updated_at = ?
       WHERE id = ? AND shop_id = ?`
    )
    .bind(
      updates.name !== undefined ? updates.name.trim() : null,
      updates.sortOrder !== undefined ? updates.sortOrder : null,
      activeVal,
      now,
      id,
      shopId
    )
    .run();

  return await db
    .prepare('SELECT * FROM brands WHERE id = ? AND shop_id = ?')
    .bind(id, shopId)
    .first<BrandRow>();
}

export async function seedDefaultCategoriesIfEmpty(
  db: D1Database,
  shopId: string
): Promise<void> {
  const existing = await db
    .prepare('SELECT count(*) as count FROM categories WHERE shop_id = ?')
    .bind(shopId)
    .first<{ count: number }>();

  if (existing && existing.count > 0) {
    return;
  }

  const now = new Date().toISOString();
  for (const cat of DEFAULT_CATEGORIES) {
    const id = `cat_${cat.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${shopId}`;
    await db
      .prepare(
        `INSERT OR IGNORE INTO categories (id, shop_id, name, icon, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(id, shopId, cat.name, cat.icon, cat.sort_order, now, now)
      .run();
  }
}
