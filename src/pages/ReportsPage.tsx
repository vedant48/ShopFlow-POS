import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  dashboardService,
  type DayStatsSummary,
  type TopProductSummary,
} from '../services/dashboardService';
import { EndOfDayModal } from '../features/reports/EndOfDayModal';
import { formatCurrency } from '../lib/utils';
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

export const ReportsPage: React.FC = () => {
  const [filterOption, setFilterOption] = useState<DateFilterOption>('today');
  const [customDate, setCustomDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);

  // Compute date range ISO strings based on filterOption
  const { startDateIso, endDateIso, label } = getFilterDateRange(
    filterOption,
    customDate
  );

  // Reactive live query for selected date range stats
  const stats = useLiveQuery(async () => {
    return await dashboardService.getDateRangeStats(startDateIso, endDateIso, label);
  }, [startDateIso, endDateIso, label]);

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
  const isLoading = stats === undefined;

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
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Daily Report & Analytics
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {formattedDateTitle} · Profit, cash flow, and product performance
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsEndOfDayModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs shadow-blue-600/30 cursor-pointer shrink-0"
        >
          <FileText className="w-4 h-4" />
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
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterOption === tab.id
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {filterOption === 'custom' && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 py-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-400 text-xs">Loading report...</div>
      ) : (
        <>
          {/* Key Metrics Grid (Requirement 11 & 13) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Total Revenue */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {formatCurrency(currentStats.totalRevenue)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Avg sale: {formatCurrency(currentStats.averageSale)}
              </span>
            </div>

            {/* Estimated Profit */}
            <div className="p-4 bg-gradient-to-br from-emerald-50/70 to-white rounded-2xl border border-emerald-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-800 mb-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  Estimated Profit
                </span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 leading-tight">
                {formatCurrency(currentStats.estimatedProfit)}
              </div>
              <span className="text-[11px] text-emerald-800/80 mt-1 block font-semibold">
                Selling price − Item cost price
              </span>
            </div>

            {/* Transactions */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Transactions
                </span>
                <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {currentStats.transactionCount}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Bills completed</span>
            </div>

            {/* Items Sold */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Items Sold
                </span>
                <Layers className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {currentStats.itemsSold}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Units handed to customers</span>
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
        </>
      )}

      {/* End of Day Summary Modal (Requirement 14) */}
      <EndOfDayModal
        isOpen={isEndOfDayModalOpen}
        onClose={() => setIsEndOfDayModalOpen(false)}
        stats={currentStats}
      />
    </div>
  );
};
