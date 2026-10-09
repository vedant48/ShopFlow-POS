import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { dashboardService } from '../services/dashboardService';
import { authService } from '../auth/authService';

export function useProducts() {
  const products = useLiveQuery(async () => {
    const currentShopId = authService.getCurrentShopId();
    console.info('[diag][products] query:start', { shopId: currentShopId });
    try {
      const result = await db.products
        .filter((p) => (p.shopId || 'shop_demo_001') === currentShopId)
        .toArray();
      console.info('[diag][products] query:resolve', {
        shopId: currentShopId,
        count: result.length,
      });
      return result;
    } catch (error) {
      console.error('[diag][products] query:error', error);
      return [];
    }
  }, []);

  return {
    products: products || [],
    isLoading: products === undefined,
  };
}

export function useCustomers() {
  const customers = useLiveQuery(async () => {
    const currentShopId = authService.getCurrentShopId();
    const all = await db.customers
      .filter((c) => (c.shopId || 'shop_demo_001') === currentShopId)
      .toArray();
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, []);

  return {
    customers: customers || [],
    isLoading: customers === undefined,
  };
}

export function useRecentSales(limit: number = 50) {
  const sales = useLiveQuery(async () => {
    const currentShopId = authService.getCurrentShopId();
    const all = await db.sales
      .filter((s) => (s.shopId || 'shop_demo_001') === currentShopId)
      .toArray();
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, limit);
  }, [limit]);

  return {
    sales: sales || [],
    isLoading: sales === undefined,
  };
}

export function useSyncQueueStatus() {
  const pendingCount = useLiveQuery(async () => {
    const currentShopId = authService.getCurrentShopId();
    return await db.syncQueue
      .filter((q) => (q.shopId || 'shop_demo_001') === currentShopId && (q.status === 'PENDING' || q.status === 'FAILED'))
      .count();
  }, []);

  return {
    pendingCount: pendingCount ?? 0,
  };
}

export function useDashboardStats() {
  const stats = useLiveQuery(async () => {
    const currentShopId = authService.getCurrentShopId();
    return await dashboardService.getDashboardSnapshot(undefined, currentShopId);
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
    isLoading: stats === undefined,
  };
}

export function useOpenOrders() {
  const openOrders = useLiveQuery(async () => {
    const currentShopId = authService.getCurrentShopId();
    const orders = await db.openOrders
      .filter((o) => (o.shopId || 'shop_demo_001') === currentShopId && o.status === 'OPEN')
      .toArray();
    return orders.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, []);

  return {
    openOrders: openOrders || [],
    openOrdersCount: openOrders?.length ?? 0,
    isLoading: openOrders === undefined,
  };
}
