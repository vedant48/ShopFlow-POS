import type { Env } from '../types';

export function getShopId(request: Request, env: Env, explicitShopId?: string): string {
  if (explicitShopId && typeof explicitShopId === 'string' && explicitShopId.trim().length > 0) {
    return explicitShopId.trim();
  }

  const headerShopId = request.headers.get('x-shop-id') || request.headers.get('X-Shop-Id');
  if (headerShopId && headerShopId.trim().length > 0) {
    return headerShopId.trim();
  }

  const url = new URL(request.url);
  const queryShopId = url.searchParams.get('shopId');
  if (queryShopId && queryShopId.trim().length > 0) {
    return queryShopId.trim();
  }

  return env.DEMO_SHOP_ID || 'shop_demo_001';
}

export async function ensureShopExists(db: D1Database, shopId: string, shopName?: string): Promise<void> {
  const existing = await db
    .prepare('SELECT id FROM shops WHERE id = ?')
    .bind(shopId)
    .first();

  if (!existing) {
    const now = new Date().toISOString();
    await db
      .prepare(
        'INSERT INTO shops (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
      )
      .bind(shopId, shopName || 'ShopFlow Counter', now, now)
      .run();
  }
}
