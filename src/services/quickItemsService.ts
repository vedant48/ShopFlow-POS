import { db } from '../db';
import type { Product } from '../types';
import { authService } from '../auth/authService';

interface QuickCache {
  shopId: string;
  salesCount: number;
  timestamp: number;
  frequentlySoldIds: string[];
  recentIds: string[];
}

let memoryCache: QuickCache | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL unless sales count changes

const PRIORITY_KEYWORDS = ['coke', 'cigarette', 'lays', 'water', 'pepsi', 'choc'];

export const quickItemsService = {
  /**
   * Invalidates the in-memory cache so next call recomputes
   */
  invalidateCache() {
    memoryCache = null;
  },

  /**
   * Fetches top frequently sold and recently sold product IDs with high performance caching.
   * Scans at most 100 recent sales to remain blazing fast even with 5,000+ total sales.
   */
  async getQuickItemIds(shopId?: string): Promise<{
    frequentlySoldIds: string[];
    recentIds: string[];
  }> {
    const currentShopId = shopId || authService.getCurrentShopId();

    try {
      // 1. Check quick sales count to know if anything changed
      const currentSalesCount = await db.sales
        .where('shopId')
        .equals(currentShopId)
        .count();

      const now = Date.now();
      if (
        memoryCache &&
        memoryCache.shopId === currentShopId &&
        memoryCache.salesCount === currentSalesCount &&
        now - memoryCache.timestamp < CACHE_TTL_MS
      ) {
        return {
          frequentlySoldIds: memoryCache.frequentlySoldIds,
          recentIds: memoryCache.recentIds,
        };
      }

      // 2. Query at most the latest 100 sales (indexed reverse lookup)
      const recentSales = await db.sales
        .where('shopId')
        .equals(currentShopId)
        .reverse()
        .limit(100)
        .toArray();

      if (recentSales.length === 0) {
        const emptyResult = { frequentlySoldIds: [], recentIds: [] };
        memoryCache = {
          shopId: currentShopId,
          salesCount: 0,
          timestamp: now,
          frequentlySoldIds: [],
          recentIds: [],
        };
        return emptyResult;
      }

      const saleIds = recentSales.map((s) => s.id);

      // 3. Batch query sale items for these recent sales
      const saleItems = await db.saleItems
        .where('saleId')
        .anyOf(saleIds)
        .toArray();

      // 4. Compute Frequently Sold (aggregate quantity count per productId)
      const productFreqMap = new Map<string, number>();
      for (const item of saleItems) {
        const current = productFreqMap.get(item.productId) || 0;
        productFreqMap.set(item.productId, current + item.quantity);
      }

      const frequentlySoldIds = Array.from(productFreqMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id);

      // 5. Compute Recently Sold (unique products in order of latest sale)
      // Map saleId to sale's createdAt for recency sorting
      const saleOrderMap = new Map<string, number>();
      recentSales.slice(0, 15).forEach((s, idx) => {
        saleOrderMap.set(s.id, idx);
      });

      // Filter items belonging to the last 15 sales
      const latestItems = saleItems
        .filter((item) => saleOrderMap.has(item.saleId))
        .sort((a, b) => (saleOrderMap.get(a.saleId) ?? 999) - (saleOrderMap.get(b.saleId) ?? 999));

      const seenRecent = new Set<string>();
      const recentIds: string[] = [];
      for (const item of latestItems) {
        if (!seenRecent.has(item.productId)) {
          seenRecent.add(item.productId);
          recentIds.push(item.productId);
          if (recentIds.length >= 6) break;
        }
      }

      memoryCache = {
        shopId: currentShopId,
        salesCount: currentSalesCount,
        timestamp: now,
        frequentlySoldIds,
        recentIds,
      };

      return { frequentlySoldIds, recentIds };
    } catch (err) {
      console.warn('Failed to compute quick item IDs from sales history', err);
      return { frequentlySoldIds: [], recentIds: [] };
    }
  },

  /**
   * Resolves Frequently Sold products list from active products.
   * If sales history has insufficient products (< 3), falls back to:
   * 1. Favorite products (isFavorite === true)
   * 2. Priority default products (Coke, Cigarette, Lays, Water, Pepsi)
   * 3. Available active products
   */
  resolveFrequentlySold(
    frequentlySoldIds: string[],
    products: Product[],
    limit: number = 6
  ): Product[] {
    const activeProducts = products.filter((p) => p.active !== false);
    const prodMap = new Map<string, Product>();
    for (const p of activeProducts) {
      prodMap.set(p.id, p);
    }

    const resolved: Product[] = [];
    const addedIds = new Set<string>();

    // Add products matched from sales history
    for (const id of frequentlySoldIds) {
      const prod = prodMap.get(id);
      if (prod && !addedIds.has(id)) {
        resolved.push(prod);
        addedIds.add(id);
        if (resolved.length >= limit) return resolved;
      }
    }

    // Fallback 1: Add favorite products
    for (const prod of activeProducts) {
      if (prod.isFavorite && !addedIds.has(prod.id)) {
        resolved.push(prod);
        addedIds.add(prod.id);
        if (resolved.length >= limit) return resolved;
      }
    }

    // Fallback 2: Priority keywords (Coke, Cigarette, Lays, Water, Pepsi)
    for (const kw of PRIORITY_KEYWORDS) {
      const match = activeProducts.find(
        (p) => !addedIds.has(p.id) && p.name.toLowerCase().includes(kw)
      );
      if (match) {
        resolved.push(match);
        addedIds.add(match.id);
        if (resolved.length >= limit) return resolved;
      }
    }

    // Fallback 3: Remaining active products
    for (const prod of activeProducts) {
      if (!addedIds.has(prod.id)) {
        resolved.push(prod);
        addedIds.add(prod.id);
        if (resolved.length >= limit) return resolved;
      }
    }

    return resolved;
  },

  /**
   * Resolves unique recently sold products from active catalog
   */
  resolveRecentlySold(recentIds: string[], products: Product[], limit: number = 6): Product[] {
    const activeProducts = products.filter((p) => p.active !== false);
    const prodMap = new Map<string, Product>();
    for (const p of activeProducts) {
      prodMap.set(p.id, p);
    }

    const resolved: Product[] = [];
    for (const id of recentIds) {
      const prod = prodMap.get(id);
      if (prod) {
        resolved.push(prod);
        if (resolved.length >= limit) break;
      }
    }

    return resolved;
  },
};
