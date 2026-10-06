import React, { useState } from 'react';
import { useCustomers } from '../hooks/useShopData';
import { AddCustomerModal } from '../features/customers/AddCustomerModal';
import { CollectPaymentModal } from '../features/customers/CollectPaymentModal';
import { CustomerLedgerModal } from '../features/customers/CustomerLedgerModal';
import { formatCurrency } from '../lib/utils';
import type { Customer } from '../types';
import { Plus, Search, Phone, ArrowUpRight, IndianRupee } from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { customers, isLoading } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'udhaarOnly'>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [collectingCustomer, setCollectingCustomer] = useState<Customer | null>(null);
  const [viewingLedgerCustomer, setViewingLedgerCustomer] = useState<Customer | null>(null);

  const totalOutstandingUdhaar = customers.reduce(
    (sum, c) => sum + (c.balance || 0),
    0
  );

  const udhaarCustomersCount = customers.filter(
    (c) => (c.balance || 0) > 0
  ).length;

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm));
    const matchesFilter =
      filterMode === 'all' || (filterMode === 'udhaarOnly' && (c.balance || 0) > 0);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Customers & Udhaar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Track customer balances, credit accounts, and collect payments
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="h-11 px-4 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-sm rounded-2xl shadow-xs shadow-violet-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Customer</span>
        </button>
      </div>

      {/* Top Udhaar Summary Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-violet-200 block">
            Total Outstanding Udhaar
          </span>
          <div className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
            {formatCurrency(totalOutstandingUdhaar)}
          </div>
          <span className="text-xs text-violet-200 mt-1 block font-medium">
            Across {udhaarCustomersCount} customers with active balance
          </span>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white text-2xl">
          📖
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search customer by name or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-2xs"
          />
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-4 h-11 rounded-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
              filterMode === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('udhaarOnly')}
            className={`px-4 h-11 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
              filterMode === 'udhaarOnly'
                ? 'bg-violet-600 text-white'
                : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-50'
            }`}
          >
            <span>Dues Only</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              filterMode === 'udhaarOnly' ? 'bg-violet-800 text-white' : 'bg-violet-100 text-violet-800'
            }`}>
              {udhaarCustomersCount}
            </span>
          </button>
        </div>
      </div>

      {/* Customers List (Requirement 9 & 10) */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400 text-sm font-medium">
          Loading customers...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-slate-200">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-sm font-extrabold text-slate-800">No customers found</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Click "+ New Customer" above to add an account
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCustomers.map((cust) => {
            const due = cust.balance ?? 0;
            const hasDue = due > 0;

            return (
              <div
                key={cust.id}
                onClick={() => setViewingLedgerCustomer(cust)}
                className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-violet-300 hover:shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer group"
              >
                {/* Left: Avatar & Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 font-black text-base flex items-center justify-center shrink-0">
                    {cust.name.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 group-hover:text-violet-700 text-base leading-tight truncate">
                      {cust.name}
                    </h3>
                    {cust.phone && (
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{cust.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Balance & Action Button */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span
                      className={`text-sm sm:text-base font-black ${
                        hasDue ? 'text-violet-700' : 'text-emerald-600'
                      }`}
                    >
                      {formatCurrency(due)} due
                    </span>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                      {hasDue ? 'Outstanding' : 'Cleared'}
                    </span>
                  </div>

                  {hasDue && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollectingCustomer(cust);
                      }}
                      className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <IndianRupee className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span className="hidden sm:inline">Collect</span>
                    </button>
                  )}

                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-violet-600 transition-colors hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <CollectPaymentModal
        customer={collectingCustomer}
        isOpen={!!collectingCustomer}
        onClose={() => setCollectingCustomer(null)}
      />

      <CustomerLedgerModal
        customer={viewingLedgerCustomer}
        isOpen={!!viewingLedgerCustomer}
        onClose={() => setViewingLedgerCustomer(null)}
        onCollectPayment={(cust) => setCollectingCustomer(cust)}
      />
    </div>
  );
};
