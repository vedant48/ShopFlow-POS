import { db } from '../db';
import type { Sale, Customer, Product, Expense } from '../types';

export interface TopProductSummary {
  id: string;
  name: string;
  emoji: string;
  count: number;
  revenue: number;
}

export interface DayStatsSummary {
  dateLabel: string;
  totalRevenue: number;
  cashRevenue: number;
  upiRevenue: number;
  udhaarRevenue: number;
  transactionCount: number;
  itemsSold: number;
  estimatedProfit: number;
  totalExpenses: number;
  estimatedNetAfterExpenses: number;
  averageSale: number;
  topSellingProducts: TopProductSummary[];
  sales: Sale[];
  expenses: Expense[];
}

export interface OverallDashboardStats {
  todayRevenue: number;
  todayCash: number;
  todayUPI: number;
  todayUdhaar: number;
  transactionCount: number;
  todayItemsSold: number;
  todayEstimatedProfit: number;
  todayExpenses: number;
  todayNetAfterExpenses: number;
  averageSale: number;
  totalPendingUdhaar: number;
  topDebtors: Customer[];
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  recentActivity: Sale[];
  topSellingProducts: TopProductSummary[];
}

export const dashboardService = {
  /**
   * Helper to get start and end ISO strings for a given date or range
   */
  getDayRange(date: Date = new Date()): { startIso: string; endIso: string } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };
  },

  /**
   * Requirement 19: getTodaySales()
   */
  async getTodaySales(): Promise<Sale[]> {
    const { startIso, endIso } = this.getDayRange();
    return await db.sales
      .filter((s) => s.createdAt >= startIso && s.createdAt <= endIso)
      .reverse()
      .sortBy('createdAt');
  },

  /**
   * Core statistics calculation for any date range (Today, Yesterday, 7 Days, Month, Custom)
   */
  async getDateRangeStats(
    startDate: string,
    endDate: string,
    label: string = 'Today',
    shopId?: string
  ): Promise<DayStatsSummary> {
    const effectiveShopId =
      shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');

    const sales = await db.sales
      .filter(
        (s) =>
          s.createdAt >= startDate &&
          s.createdAt <= endDate &&
          (s.shopId || 'shop_demo_001') === effectiveShopId
      )
      .reverse()
      .sortBy('createdAt');

    const expenses = await db.expenses
      .filter(
        (e) =>
          e.createdAt >= startDate &&
          e.createdAt <= endDate &&
          (e.shopId || 'shop_demo_001') === effectiveShopId
      )
      .reverse()
      .sortBy('createdAt');

    let cashRevenue = 0;
    let upiRevenue = 0;
    let udhaarRevenue = 0;
    let itemsSold = 0;

    for (const s of sales) {
      if (s.paymentStatus === 'PAID') {
        if (s.paymentMethod === 'UPI') {
          upiRevenue += s.totalAmount;
        } else {
          // Default to CASH
          cashRevenue += s.totalAmount;
        }
      } else if (s.paymentStatus === 'UDHAAR') {
        udhaarRevenue += s.totalAmount;
      }
      itemsSold += s.itemCount || 0;
    }

    // Exact identity: Total Revenue = Cash + UPI + Udhaar
    const totalRevenue = cashRevenue + upiRevenue + udhaarRevenue;

    // Calculate profit using preserved costPrice at the time of sale
    const saleIds = sales.map((s) => s.id);
    let estimatedProfit = 0;
    const productSalesMap = new Map<string, TopProductSummary>();

    if (saleIds.length > 0) {
      const saleItems = await db.saleItems
        .filter((item) => saleIds.includes(item.saleId))
        .toArray();

      for (const item of saleItems) {
        const itemSellingPrice = item.sellingPrice || item.unitPrice || 0;
        const itemCostPrice = item.costPrice !== undefined ? item.costPrice : (item.unitCost || 0);
        const profitPerUnit = itemSellingPrice - itemCostPrice;
        estimatedProfit += profitPerUnit * item.quantity;

        const existing = productSalesMap.get(item.productId) || {
          id: item.productId,
          name: item.productName,
          emoji: item.productEmoji || '📦',
          count: 0,
          revenue: 0,
        };
        existing.count += item.quantity;
        existing.revenue += item.totalPrice;
        productSalesMap.set(item.productId, existing);
      }
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const estimatedNetAfterExpenses = estimatedProfit - totalExpenses;
    const averageSale = sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0;

    const topSellingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      dateLabel: label,
      totalRevenue,
      cashRevenue,
      upiRevenue,
      udhaarRevenue,
      transactionCount: sales.length,
      itemsSold,
      estimatedProfit,
      totalExpenses,
      estimatedNetAfterExpenses,
      averageSale,
      topSellingProducts,
      sales,
      expenses,
    };
  },

  /**
   * Complete high-performance dashboard snapshot for Home Page
   */
  async getDashboardSnapshot(date?: Date, shopId?: string): Promise<OverallDashboardStats> {
    const effectiveShopId =
      shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');

    const { startIso, endIso } = this.getDayRange(date);
    const todayStats = await this.getDateRangeStats(startIso, endIso, 'Today', effectiveShopId);

    // Customers with outstanding Udhaar (sorted highest balance first)
    const allCustomers = await db.customers
      .filter((c) => (c.shopId || 'shop_demo_001') === effectiveShopId)
      .toArray();

    const customersWithBalance = allCustomers
      .filter((c) => (c.balance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));

    const totalPendingUdhaar = customersWithBalance.reduce(
      (sum, c) => sum + (c.balance || 0),
      0
    );

    // Products: Low stock & Out of stock (active only)
    const activeProducts = await db.products
      .filter((p) => p.active !== false && (p.shopId || 'shop_demo_001') === effectiveShopId)
      .toArray();

    const lowStockProducts = activeProducts
      .filter((p) => p.stock > 0 && p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);

    const outOfStockProducts = activeProducts
      .filter((p) => p.stock <= 0)
      .slice(0, 5);

    // Recent activity: today's sales (newest first, limit 10)
    const recentActivity = todayStats.sales.slice(0, 10);

    return {
      todayRevenue: todayStats.totalRevenue,
      todayCash: todayStats.cashRevenue,
      todayUPI: todayStats.upiRevenue,
      todayUdhaar: todayStats.udhaarRevenue,
      transactionCount: todayStats.transactionCount,
      todayItemsSold: todayStats.itemsSold,
      todayEstimatedProfit: todayStats.estimatedProfit,
      todayExpenses: todayStats.totalExpenses,
      todayNetAfterExpenses: todayStats.estimatedNetAfterExpenses,
      averageSale: todayStats.averageSale,
      totalPendingUdhaar,
      topDebtors: customersWithBalance.slice(0, 4),
      lowStockProducts,
      outOfStockProducts,
      recentActivity,
      topSellingProducts: todayStats.topSellingProducts,
    };
  },

  // Individual helper methods required by Requirement 19
  async getTodayRevenue(): Promise<number> {
    const { startIso, endIso } = this.getDayRange();
    const stats = await this.getDateRangeStats(startIso, endIso);
    return stats.totalRevenue;
  },

  async getTodayCash(): Promise<number> {
    const { startIso, endIso } = this.getDayRange();
    const stats = await this.getDateRangeStats(startIso, endIso);
    return stats.cashRevenue;
  },

  async getTodayUPI(): Promise<number> {
    const { startIso, endIso } = this.getDayRange();
    const stats = await this.getDateRangeStats(startIso, endIso);
    return stats.upiRevenue;
  },

  async getTodayUdhaar(): Promise<number> {
    const { startIso, endIso } = this.getDayRange();
    const stats = await this.getDateRangeStats(startIso, endIso);
    return stats.udhaarRevenue;
  },

  async getTodayProfit(): Promise<number> {
    const { startIso, endIso } = this.getDayRange();
    const stats = await this.getDateRangeStats(startIso, endIso);
    return stats.estimatedProfit;
  },

  async getTodayExpenses(): Promise<number> {
    const { startIso, endIso } = this.getDayRange();
    const stats = await this.getDateRangeStats(startIso, endIso);
    return stats.totalExpenses;
  },

  async getTodayNetAfterExpenses(): Promise<number> {
    const { startIso, endIso } = this.getDayRange();
    const stats = await this.getDateRangeStats(startIso, endIso);
    return stats.estimatedNetAfterExpenses;
  },

  async getOutstandingUdhaar(): Promise<number> {
    const customers = await db.customers.toArray();
    return customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  },

  async getLowStockProducts(): Promise<Product[]> {
    return await db.products
      .filter((p) => p.active !== false && p.stock <= p.minStock)
      .toArray();
  },

  async getTopProducts(limit: number = 5): Promise<TopProductSummary[]> {
    const { startIso, endIso } = this.getDayRange();
    const stats = await this.getDateRangeStats(startIso, endIso);
    return stats.topSellingProducts.slice(0, limit);
  },
};
