import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { dashboardService } from '../services/dashboardService';
import { authService } from '../auth/authService';

export function useProducts() {
  const [queryError, setQueryError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const products = useLiveQuery(async () => {
    try {
      const currentShopId = authService.getCurrentShopId();
      const res = await db.products
        .filter((p) => (p.shopId || 'shop_demo_001') === currentShopId)
        .toArray();
      setQueryError(null);
      return res;
    } catch (err: any) {
      console.error('Failed to query products from database:', err);
      setQueryError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    }
  }, [retryKey]);

  const retry = useCallback(() => {
    setQueryError(null);
    setRetryKey((k) => k + 1);
  }, []);

  return {
    products: queryError ? [] : (products || []),
    isLoading: products === undefined && !queryError,
    error: queryError,
    retry,
  };
}

export function useCustomers() {
  const [queryError, setQueryError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const customers = useLiveQuery(async () => {
    try {
      const currentShopId = authService.getCurrentShopId();
      const all = await db.customers
        .filter((c) => (c.shopId || 'shop_demo_001') === currentShopId)
        .toArray();
      const sorted = all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQueryError(null);
      return sorted;
    } catch (err: any) {
      console.error('Failed to query customers from database:', err);
      setQueryError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    }
  }, [retryKey]);

  const retry = useCallback(() => {
    setQueryError(null);
    setRetryKey((k) => k + 1);
  }, []);

  return {
    customers: queryError ? [] : (customers || []),
    isLoading: customers === undefined && !queryError,
    error: queryError,
    retry,
  };
}

export function useRecentSales(limit: number = 50) {
  const [queryError, setQueryError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const sales = useLiveQuery(async () => {
    try {
      const currentShopId = authService.getCurrentShopId();
      const all = await db.sales
        .filter((s) => (s.shopId || 'shop_demo_001') === currentShopId)
        .toArray();
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQueryError(null);
      return all.slice(0, limit);
    } catch (err: any) {
      console.error('Failed to query recent sales from database:', err);
      setQueryError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    }
  }, [limit, retryKey]);

  const retry = useCallback(() => {
    setQueryError(null);
    setRetryKey((k) => k + 1);
  }, []);

  return {
    sales: queryError ? [] : (sales || []),
    isLoading: sales === undefined && !queryError,
    error: queryError,
    retry,
  };
}

export function useSyncQueueStatus() {
  const pendingCount = useLiveQuery(async () => {
    try {
      const currentShopId = authService.getCurrentShopId();
      return await db.syncQueue
        .filter((q) => (q.shopId || 'shop_demo_001') === currentShopId && (q.status === 'PENDING' || q.status === 'FAILED'))
        .count();
    } catch {
      return 0;
    }
  }, []);

  return {
    pendingCount: pendingCount ?? 0,
  };
}

export function useDashboardStats() {
  const [queryError, setQueryError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const stats = useLiveQuery(async () => {
    try {
      const currentShopId = authService.getCurrentShopId();
      const res = await dashboardService.getDashboardSnapshot(undefined, currentShopId);
      setQueryError(null);
      return res;
    } catch (err: any) {
      console.error('Failed to query dashboard stats from database:', err);
      setQueryError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    }
  }, [retryKey]);

  const retry = useCallback(() => {
    setQueryError(null);
    setRetryKey((k) => k + 1);
  }, []);

  return {
    stats: stats || {
      todayRevenue: 0,
      todayCash: 0,
      todayUPI: 0,
      todayUdhaar: 0,
      transactionCount: 0,
      todayItemsSold: 0,
      todayEstimatedProfit: 0,
      todayExpenses: 0,
      todayNetAfterExpenses: 0,
      averageSale: 0,
      totalPendingUdhaar: 0,
      topDebtors: [],
      lowStockProducts: [],
      outOfStockProducts: [],
      recentActivity: [],
      topSellingProducts: [],
    },
    isLoading: stats === undefined && !queryError,
    error: queryError,
    retry,
  };
}

export function useOpenOrders() {
  const [queryError, setQueryError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const openOrders = useLiveQuery(async () => {
    try {
      const currentShopId = authService.getCurrentShopId();
      const orders = await db.openOrders
        .filter((o) => (o.shopId || 'shop_demo_001') === currentShopId && o.status === 'OPEN')
        .toArray();
      const sorted = orders.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
      setQueryError(null);
      return sorted;
    } catch (err: any) {
      console.error('Failed to query open orders from database:', err);
      setQueryError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    }
  }, [retryKey]);

  const retry = useCallback(() => {
    setQueryError(null);
    setRetryKey((k) => k + 1);
  }, []);

  return {
    openOrders: queryError ? [] : (openOrders || []),
    openOrdersCount: openOrders?.length ?? 0,
    isLoading: openOrders === undefined && !queryError,
    error: queryError,
    retry,
  };
}
