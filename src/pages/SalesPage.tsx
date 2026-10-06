import React, { useState } from 'react';
import { useRecentSales, useCustomers } from '../hooks/useShopData';
import { SaleDetailModal } from '../features/sales/SaleDetailModal';
import { Badge } from '../components/Badge';
import { formatCurrency, formatDateTime } from '../lib/utils';
import type { Sale } from '../types';
import { Search, Receipt, ArrowUpRight, CheckCircle2, BookOpen } from 'lucide-react';

export const SalesPage: React.FC = () => {
  const { sales, isLoading } = useRecentSales(100);
  const { customers } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UDHAAR'>('ALL');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Map of customer ID to customer name
  const customerMap = new Map<string, string>();
  customers.forEach((c) => customerMap.set(c.id, c.name));

  const filteredSales = sales.filter((sale) => {
    const custName = sale.customerName || (sale.customerId ? customerMap.get(sale.customerId) : '');
    const matchesSearch =
      sale.saleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (custName && custName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus =
      statusFilter === 'ALL' || sale.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSalesCount = sales.length;
  const totalPaidRevenue = sales
    .filter((s) => s.paymentStatus === 'PAID')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <div className="space-y-4">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Sales History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Recent counter transactions, customer bills, and receipts
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 font-semibold block">Total Revenue Recorded</span>
          <span className="text-lg sm:text-xl font-black text-slate-900">
            {formatCurrency(totalPaidRevenue)}
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by bill number or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 h-11 rounded-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All ({totalSalesCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PAID')}
            className={`px-3.5 h-11 rounded-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
              statusFilter === 'PAID'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            Paid
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('UDHAAR')}
            className={`px-3.5 h-11 rounded-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
              statusFilter === 'UDHAAR'
                ? 'bg-violet-600 text-white'
                : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-50'
            }`}
          >
            Udhaar
          </button>
        </div>
      </div>

      {/* Sales List */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400 text-sm font-medium">Loading sales...</div>
      ) : filteredSales.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
          <p className="text-3xl mb-2">🧾</p>
          <p className="text-sm font-extrabold text-slate-800">No sales recorded yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Complete a Quick Sale on the Home tab to see it here!
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSales.map((sale) => {
            const isPaid = sale.paymentStatus === 'PAID';
            const customerName =
              sale.customerName ||
              (sale.customerId ? customerMap.get(sale.customerId) : null) ||
              (isPaid ? 'Walk-in' : 'Customer');

            return (
              <div
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex items-center justify-between gap-3 cursor-pointer group"
              >
                {/* Left: Bill icon & Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isPaid
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-violet-50 text-violet-700'
                    }`}
                  >
                    <Receipt className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {sale.saleNumber}
                      </span>
                      <span className="text-slate-300 font-bold">&bull;</span>
                      <span
                        className={`text-xs sm:text-sm font-extrabold truncate ${
                          isPaid ? 'text-slate-700' : 'text-violet-700'
                        }`}
                      >
                        {customerName}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-medium">
                      <span>{formatDateTime(sale.createdAt)}</span>
                      <span>&bull;</span>
                      <span>{sale.itemCount} {sale.itemCount === 1 ? 'item' : 'items'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Total Amount and Status Badge */}
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <div className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {formatCurrency(sale.totalAmount)}
                    </div>
                    <div className="mt-0.5">
                      <Badge variant={isPaid ? 'paid' : 'udhaar'} size="sm">
                        {isPaid ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            PAID
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3 h-3" />
                            UDHAAR
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>

                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sale Detail Receipt Modal */}
      <SaleDetailModal
        sale={selectedSale}
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
      />
    </div>
  );
};
