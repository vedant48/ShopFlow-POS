import type { BootstrapResponse, ShopRow } from '../types';

export async function getShop(db: D1Database, shopId: string): Promise<ShopRow | null> {
  return await db
    .prepare('SELECT id, name, created_at, updated_at FROM shops WHERE id = ?')
    .bind(shopId)
    .first<ShopRow>();
}

export async function getProducts(db: D1Database, shopId: string) {
  const result = await db
    .prepare(
      `SELECT id, shop_id, name, emoji, selling_price, cost_price, mrp, price_variants, sort_order, stock,
              min_stock, opening_stock, unit, category, category_id, brand_id, sku, barcode, active,
              created_at, updated_at
       FROM products
       WHERE shop_id = ?
       ORDER BY sort_order ASC, name ASC`
    )
    .bind(shopId)
    .all();
  return result.results || [];
}

export async function getCustomers(db: D1Database, shopId: string) {
  const result = await db
    .prepare(
      `SELECT id, shop_id, name, phone, balance, notes, created_at, updated_at
       FROM customers
       WHERE shop_id = ?
       ORDER BY name ASC`
    )
    .bind(shopId)
    .all();
  return result.results || [];
}

export async function getSales(db: D1Database, shopId: string, limit = 100) {
  const salesResult = await db
    .prepare(
      `SELECT id, shop_id, sale_number, customer_id, customer_name,
              payment_status, payment_method, total, item_count, notes,
              created_at, updated_at
       FROM sales
       WHERE shop_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(shopId, limit)
    .all();

  const sales = salesResult.results || [];
  return sales;
}

export async function getInventory(db: D1Database, shopId: string) {
  const [productsRes, movementsRes] = await Promise.all([
    db
      .prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY name ASC')
      .bind(shopId)
      .all(),
    db
      .prepare(
        'SELECT * FROM inventory_movements WHERE shop_id = ? ORDER BY created_at DESC LIMIT 100'
      )
      .bind(shopId)
      .all(),
  ]);

  return {
    products: productsRes.results || [],
    recentMovements: movementsRes.results || [],
  };
}

export async function getBootstrapData(db: D1Database, shopId: string): Promise<BootstrapResponse> {
  const shop = await getShop(db, shopId);
  const effectiveShop: ShopRow = shop || {
    id: shopId,
    name: 'ShopFlow Counter',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const [
    categories,
    brands,
    products,
    customers,
    sales,
    saleItems,
    payments,
    purchases,
    purchaseItems,
    inventoryMovements,
    expenses,
    suppliers,
    openOrders,
    openOrderItems,
  ] = await Promise.all([
    db.prepare('SELECT * FROM categories WHERE shop_id = ? ORDER BY sort_order ASC, name ASC').bind(shopId).all(),
    db.prepare('SELECT * FROM brands WHERE shop_id = ? ORDER BY sort_order ASC, name ASC').bind(shopId).all(),
    db.prepare('SELECT * FROM products WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM customers WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM sales WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM sale_items WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM payments WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM purchases WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM purchase_items WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM inventory_movements WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM expenses WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM suppliers WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM open_orders WHERE shop_id = ?').bind(shopId).all(),
    db.prepare('SELECT * FROM open_order_items WHERE shop_id = ?').bind(shopId).all(),
  ]);

  return {
    shop: effectiveShop,
    categories: (categories.results || []) as any[],
    brands: (brands.results || []) as any[],
    products: products.results || [],
    customers: customers.results || [],
    sales: sales.results || [],
    saleItems: saleItems.results || [],
    payments: payments.results || [],
    purchases: purchases.results || [],
    purchaseItems: purchaseItems.results || [],
    inventoryMovements: inventoryMovements.results || [],
    expenses: expenses.results || [],
    suppliers: suppliers.results || [],
    openOrders: (openOrders.results || []) as any[],
    openOrderItems: (openOrderItems.results || []) as any[],
  };
}
