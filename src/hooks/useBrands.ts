import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Brand } from '../types';
import { authService } from '../auth/authService';

export function useBrands(categoryId?: string, options?: { activeOnly?: boolean; shopId?: string }) {
  const currentShopId = authService.getCurrentShopId();
  const targetShopId = options?.shopId || currentShopId || 'shop_demo_001';
  const activeOnly = options?.activeOnly !== false;
  const [queryError, setQueryError] = useState<Error | null>(null);

  const brands = useLiveQuery(
    async () => {
      try {
        const all = await db.brands
          .filter((b) => {
            const matchesShop = (b.shopId || 'shop_demo_001') === targetShopId;
            if (!matchesShop) return false;
            if (categoryId && b.categoryId !== categoryId) return false;
            if (activeOnly) return b.isActive !== false;
            return true;
          })
          .toArray();
        setQueryError(null);
        return all.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
      } catch (err: any) {
        console.error('Failed to query brands from database:', err);
        setQueryError(err instanceof Error ? err : new Error(String(err)));
        return undefined;
      }
    },
    [categoryId, targetShopId, activeOnly]
  );

  return {
    brands: (brands || []) as Brand[],
    isLoading: brands === undefined && !queryError,
    error: queryError,
  };
}
