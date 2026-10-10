import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Category } from '../types';
import { authService } from '../auth/authService';

export function useCategories(options?: { activeOnly?: boolean; shopId?: string }) {
  const currentShopId = authService.getCurrentShopId();
  const targetShopId = options?.shopId || currentShopId || 'shop_demo_001';
  const activeOnly = options?.activeOnly !== false;
  const [queryError, setQueryError] = useState<Error | null>(null);

  const categories = useLiveQuery(
    async () => {
      try {
        const all = await db.categories
          .filter((c) => {
            const matchesShop = (c.shopId || 'shop_demo_001') === targetShopId;
            if (!matchesShop) return false;
            if (activeOnly) return c.isActive !== false;
            return true;
          })
          .toArray();
        setQueryError(null);
        return all.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
      } catch (err: any) {
        console.error('Failed to query categories from database:', err);
        setQueryError(err instanceof Error ? err : new Error(String(err)));
        return undefined;
      }
    },
    [targetShopId, activeOnly]
  );

  return {
    categories: (categories || []) as Category[],
    isLoading: categories === undefined && !queryError,
    error: queryError,
  };
}
