import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Product } from '../types';
import { quickItemsService } from '../services/quickItemsService';
import { inventoryService } from '../services/inventoryService';
import { authService } from '../auth/authService';

export function useQuickItems(products: Product[]) {
  const currentShopId = authService.getCurrentShopId();

  // Watch sales count to detect new sales or undo without scanning the full table
  const salesCount = useLiveQuery(async () => {
    return await db.sales
      .where('shopId')
      .equals(currentShopId)
      .count();
  }, [currentShopId]);

  const [quickIds, setQuickIds] = useState<{
    frequentlySoldIds: string[];
    recentIds: string[];
  }>({
    frequentlySoldIds: [],
    recentIds: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Recalculate IDs whenever salesCount changes or on initial mount
  useEffect(() => {
    let isCancelled = false;

    async function loadQuickIds() {
      try {
        const ids = await quickItemsService.getQuickItemIds(currentShopId);
        if (!isCancelled) {
          setQuickIds(ids);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load quick item IDs', err);
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadQuickIds();

    return () => {
      isCancelled = true;
    };
  }, [salesCount, currentShopId]);

  // Frequently sold products (with intelligent fallback when history is insufficient)
  const frequentlySold = useMemo(() => {
    return quickItemsService.resolveFrequentlySold(
      quickIds.frequentlySoldIds,
      products,
      8
    );
  }, [quickIds.frequentlySoldIds, products]);

  // Recently sold products (unique items)
  const recentlySold = useMemo(() => {
    return quickItemsService.resolveRecentlySold(
      quickIds.recentIds,
      products,
      6
    );
  }, [quickIds.recentIds, products]);

  // Configured favorite products
  const favorites = useMemo(() => {
    return products.filter((p) => p.active !== false && p.isFavorite === true);
  }, [products]);

  // Toggle favorite status on a product
  const toggleFavorite = useCallback(
    async (productId: string) => {
      try {
        const newFav = await inventoryService.toggleFavorite(productId);
        quickItemsService.invalidateCache();
        return newFav;
      } catch (err) {
        console.error('Failed to toggle favorite', err);
        return false;
      }
    },
    []
  );

  return {
    frequentlySold,
    recentlySold,
    favorites,
    toggleFavorite,
    isLoading,
  };
}
