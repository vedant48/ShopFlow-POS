import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  dashboardService,
  type DayStatsSummary,
  type TopProductSummary,
} from '../services/dashboardService';
import { useDashboardStats } from '../hooks/useShopData';
import { EndOfDayModal } from '../features/reports/EndOfDayModal';
import { SaleDetailModal } from '../features/sales/SaleDetailModal';
import { formatCurrency } from '../lib/utils';
import type { Sale } from '../types';
import {
  TrendingUp,
  Banknote,
  QrCode,
  BookOpen,
  ShoppingBag,
  Award,
  Layers,
  Receipt,
  Calendar,
  FileText,
  Clock,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';

type DateFilterOption = 'today' | 'yesterday' | '7days' | 'month' | 'custom';

function getFilterDateRange(
  filterOption: DateFilterOption,
  customDate: string
): { startDateIso: string; endDateIso: string; label: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (filterOption === 'yesterday') {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(now.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return {
      startDateIso: start.toISOString(),
      endDateIso: end.toISOString(),
      label: 'Yesterday',
    };
  }

  if (filterOption === '7days') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return {
      startDateIso: start.toISOString(),
      endDateIso: end.toISOString(),
      label: 'Last 7 Days',
    };
  }

  if (filterOption === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return {
      startDateIso: start.toISOString(),
      endDateIso: end.toISOString(),
      label: 'This Month',
    };
  }

  if (filterOption === 'custom') {
    const parts = customDate.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const customStart = new Date(y, m, d, 0, 0, 0, 0);
    const customEnd = new Date(y, m, d, 23, 59, 59, 999);
    return {
      startDateIso: customStart.toISOString(),
      endDateIso: customEnd.toISOString(),
      label: customDate,
    };
  }

  // Default: Today
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return {
    startDateIso: start.toISOString(),
    endDateIso: end.toISOString(),
    label: 'Today',
  };
}

interface ReportsPageProps {
  onNavigateToTab?: (tab: 'home' | 'inventory' | 'customers' | 'sales' | 'reports' | 'settings') => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateToTab }) => {
  const [filterOption, setFilterOption] = useState<DateFilterOption>('today');
  const [customDate, setCustomDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);
  const [selectedActivitySale, setSelectedActivitySale] = useState<Sale | null>(null);

  const { stats: dashboardStatsData } = useDashboardStats();
  const dashboardStats = dashboardStatsData || {
    totalPendingUdhaar: 0,
    topDebtors: [],
    recentActivity: [],
  };

  // Compute date range ISO strings based on filterOption
  const { startDateIso, endDateIso, label } = getFilterDateRange(
    filterOption,
    customDate
  );

  const [queryError, setQueryError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Reactive live query for selected date range stats with error handling
  const stats = useLiveQuery(async () => {
    try {
      const res = await dashboardService.getDateRangeStats(startDateIso, endDateIso, label);
      setQueryError(null);
      return res;
    } catch (err: any) {
      console.error('Failed to load date range stats:', err);
      setQueryError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    }
  }, [startDateIso, endDateIso, label, retryKey]);

  const defaultStats: DayStatsSummary = {
    dateLabel: label,
    totalRevenue: 0,
    cashRevenue: 0,
    upiRevenue: 0,
    udhaarRevenue: 0,
    transactionCount: 0,
    itemsSold: 0,
    estimatedProfit: 0,
    totalExpenses: 0,
    estimatedNetAfterExpenses: 0,
    averageSale: 0,
    topSellingProducts: [],
    sales: [],
    expenses: [],
  };

  const currentStats = stats || defaultStats;
  const isLoading = stats === undefined && !queryError;

  const maxProductCount =
    currentStats.topSellingProducts.length > 0
      ? Math.max(...currentStats.topSellingProducts.map((p: TopProductSummary) => p.count), 1)
      : 1;

  // Pretty formatted date display (Requirement 13)
  const formattedDateTitle = new Date(startDateIso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header & End-Of-Day Summary Button (Requirement 14) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight apple-tight">
            Daily Report & Analytics
          </h1>
          <p className="text-xs text-[#86868b] font-normal mt-0.5">
            {formattedDateTitle} · Profit, cash flow, and product performance
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsEndOfDayModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0066cc] hover:bg-[#0055b3] text-white font-semibold text-xs rounded-full shadow-2xs cursor-pointer shrink-0 active:scale-95 transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>END OF DAY SUMMARY</span>
        </button>
      </div>

      {/* Date Filter Tabs Bar - Cleanly wrapped, no horizontal scroll */}
      <div className="flex flex-wrap items-center gap-1.5 w-full">
        {(
          [
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'Custom Date' },
          ] as { id: DateFilterOption; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterOption(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
              filterOption === tab.id
                ? 'bg-[#1d1d1f] text-white shadow-2xs'
                : 'bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:bg-[#f5f5f7]'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {filterOption === 'custom' && (
          <div className="flex items-center gap-1.5 bg-white border border-[#e5e5ea] rounded-full px-3 py-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#86868b]" />
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="text-xs font-semibold text-[#1d1d1f] bg-transparent focus:outline-none"
            />
          </div>
        )}
      </div>

      {queryError ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-red-200 space-y-3 shadow-2xs">
          <p className="text-sm font-semibold text-red-600 apple-tight">Failed to load analytics from database</p>
          <p className="text-xs text-[#86868b]">{queryError.message}</p>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 bg-[#0066cc] text-white text-xs font-semibold rounded-full cursor-pointer hover:bg-[#0055b3] transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : isLoading ? (
        <div className="p-8 text-center text-[#86868b] text-xs font-normal">Loading report...</div>
      ) : (
        <>
          {/* Key Metrics Grid (Requirement 11 & 13) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Total Revenue */}
            <div className="p-4 bg-white rounded-2xl border border-[#e5e5ea] shadow-2xs">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#86868b] block mb-1">
                Total Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] leading-tight apple-tight">
                {formatCurrency(currentStats.totalRevenue)}
              </div>
              <span className="text-[11px] text-[#86868b] mt-1 block font-normal">
                Avg sale: {formatCurrency(currentStats.averageSale)}
              </span>
            </div>

            {/* Estimated Profit */}
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-800 mb-1">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                  Estimated Profit
                </span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-700 leading-tight apple-tight">
                {formatCurrency(currentStats.estimatedProfit)}
              </div>
              <span className="text-[11px] text-emerald-800/80 mt-1 block font-normal">
                Selling price − Item cost price
              </span>
            </div>

            {/* Transactions */}
            <div className="p-4 bg-white rounded-2xl border border-[#e5e5ea] shadow-2xs">
              <div className="flex items-center justify-between text-[#86868b] mb-1">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                  Transactions
                </span>
                <ShoppingBag className="w-3.5 h-3.5 text-[#0066cc]" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] leading-tight apple-tight">
                {currentStats.transactionCount}
              </div>
              <span className="text-[11px] text-[#86868b] mt-1 block font-normal">Bills completed</span>
            </div>

            {/* Items Sold */}
            <div className="p-4 bg-white rounded-2xl border border-[#e5e5ea] shadow-2xs">
              <div className="flex items-center justify-between text-[#86868b] mb-1">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                  Items Sold
                </span>
                <Layers className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] leading-tight apple-tight">
                {currentStats.itemsSold}
              </div>
              <span className="text-[11px] text-[#86868b] mt-1 block font-normal">Units handed to customers</span>
            </div>
          </div>

          {/* Money Breakdown Cards: Cash vs UPI vs Udhaar (Requirement 2 & 13) */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Payment Collection Breakdown
              </h3>
              <span className="text-xs font-bold text-slate-900">
                Total: {formatCurrency(currentStats.totalRevenue)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-800 mb-0.5">
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </div>
                <div className="text-base font-black text-emerald-900">
                  {formatCurrency(currentStats.cashRevenue)}
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-blue-800 mb-0.5">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>UPI</span>
                </div>
                <div className="text-base font-black text-blue-900">
                  {formatCurrency(currentStats.upiRevenue)}
                </div>
              </div>

              <div className="p-3 bg-violet-50/60 rounded-xl border border-violet-100 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-violet-800 mb-0.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Udhaar</span>
                </div>
                <div className="text-base font-black text-violet-900">
                  {formatCurrency(currentStats.udhaarRevenue)}
                </div>
              </div>
            </div>
          </div>

          {/* Expenses & Estimated Net Summary (Requirement 16) */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recorded Expenses & Net
                </h3>
              </div>
              <span className="text-xs font-bold text-rose-700">
                {currentStats.expenses.length} record{currentStats.expenses.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                <span className="text-[10px] font-bold uppercase text-rose-800 block">
                  Total Expenses
                </span>
                <span className="text-lg font-black text-rose-700 mt-0.5 block">
                  {formatCurrency(currentStats.totalExpenses)}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                  Estimated Net
                </span>
                <span className="text-lg font-black text-emerald-700 mt-0.5 block">
                  {formatCurrency(currentStats.estimatedNetAfterExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* Top-Selling Products (Requirement 13) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Top Products ({currentStats.topSellingProducts.length})
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">By units sold</span>
            </div>

            {currentStats.topSellingProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No items sold during this period.
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {currentStats.topSellingProducts.map((prod: TopProductSummary, index: number) => {
                  const percent = Math.round((prod.count / maxProductCount) * 100);

                  return (
                    <div key={prod.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <span className="w-5 text-slate-400 font-mono text-xs">
                            #{index + 1}
                          </span>
                          <span className="text-xl select-none">{prod.emoji}</span>
                          <span>{prod.name}</span>
                        </div>

                        <div className="text-right">
                          <span className="font-extrabold text-slate-900">
                            {prod.count} sold
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({formatCurrency(prod.revenue)})
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Real-time Status: Pending Udhaar & Today's Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pending Udhaar Section */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Pending Udhaar
                  </span>
                  <div className="text-lg font-black text-violet-900">
                    {formatCurrency(dashboardStats.totalPendingUdhaar)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('customers')}
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>VIEW ALL</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {dashboardStats.topDebtors.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {dashboardStats.topDebtors.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => onNavigateToTab?.('customers')}
                      className="py-2 flex items-center justify-between text-xs sm:text-sm cursor-pointer hover:bg-slate-50 -mx-1 px-1 rounded-lg transition-colors"
                    >
                      <span className="font-extrabold text-slate-800 truncate pr-2">
                        {cust.name}
                      </span>
                      <span className="font-black text-violet-700 shrink-0">
                        {formatCurrency(cust.balance || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-2.5 px-3 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All payments collected ✓</span>
                </div>
              )}
            </div>

            {/* Today's Activity */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Today's Activity
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('sales')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {dashboardStats.recentActivity.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No activity recorded today yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {dashboardStats.recentActivity.map((sale) => {
                    const timeStr = new Date(sale.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const isUdhaar = sale.paymentStatus === 'UDHAAR';

                    return (
                      <div
                        key={sale.id}
                        onClick={() => setSelectedActivitySale(sale)}
                        className="py-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 -mx-1 px-1 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-slate-400 font-mono text-[11px] shrink-0">
                            {timeStr}
                          </span>

                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">
                              {sale.customerName || (isUdhaar ? 'Udhaar Customer' : 'Counter Sale')}
                            </span>
                            <span
                              className={`inline-block text-[10px] font-black uppercase px-1.5 py-0.2 rounded ${
                                isUdhaar
                                  ? 'bg-violet-100 text-violet-800'
                                  : sale.paymentMethod === 'UPI'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isUdhaar ? 'Udhaar' : sale.paymentMethod || 'Cash'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-slate-900 text-sm">
                            {formatCurrency(sale.totalAmount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* End of Day Summary Modal (Requirement 14) */}
      <EndOfDayModal
        isOpen={isEndOfDayModalOpen}
        onClose={() => setIsEndOfDayModalOpen(false)}
        stats={currentStats}
      />

      {/* Sale Detail Modal for viewing sale items from Today's Activity */}
      <SaleDetailModal
        sale={selectedActivitySale}
        isOpen={!!selectedActivitySale}
        onClose={() => setSelectedActivitySale(null)}
      />
    </div>
  );
};
