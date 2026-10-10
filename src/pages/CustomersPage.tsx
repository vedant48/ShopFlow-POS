import React, { useState } from 'react';
import { useCustomers } from '../hooks/useShopData';
import { AddCustomerModal } from '../features/customers/AddCustomerModal';
import { CollectPaymentModal } from '../features/customers/CollectPaymentModal';
import { CustomerLedgerModal } from '../features/customers/CustomerLedgerModal';
import { formatCurrency } from '../lib/utils';
import type { Customer } from '../types';
import { Plus, Search, Phone, ArrowUpRight, IndianRupee, Pencil } from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { customers, isLoading, error, retry } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'udhaarOnly'>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
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
          <h1 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] tracking-tight apple-tight">
            Customers & Udhaar
          </h1>
          <p className="text-xs sm:text-sm text-[#86868b] font-normal">
            Track customer balances, credit accounts, and collect payments
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="h-10 px-4 bg-[#5856d6] hover:bg-[#4745b8] text-white font-semibold text-xs rounded-full shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Customer</span>
        </button>
      </div>

      {/* Top Udhaar Summary Banner (Apple Light Utility Card) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e5e5ea] text-[#1d1d1f] shadow-2xs flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#86868b] block">
            Total Outstanding Udhaar
          </span>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f] mt-0.5 apple-tight">
            {formatCurrency(totalOutstandingUdhaar)}
          </div>
          <span className="text-xs text-[#86868b] mt-0.5 block font-normal">
            Across {udhaarCustomersCount} customers with active balance
          </span>
        </div>

        <div className="w-12 h-12 rounded-full bg-[#5856d6]/10 text-[#5856d6] flex items-center justify-center text-xl shrink-0">
          📖
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b] pointer-events-none" />
          <input
            type="text"
            placeholder="Search customer by name or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-3.5 bg-white border border-[#e5e5ea] rounded-full text-sm font-normal text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#5856d6] shadow-2xs placeholder:text-[#86868b]"
          />
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-4 h-10 rounded-full text-xs font-semibold transition-colors cursor-pointer active:scale-95 ${
              filterMode === 'all'
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:bg-[#f5f5f7]'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('udhaarOnly')}
            className={`px-4 h-10 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 ${
              filterMode === 'udhaarOnly'
                ? 'bg-[#5856d6] text-white'
                : 'bg-white text-[#5856d6] border border-[#5856d6]/30 hover:bg-[#5856d6]/10'
            }`}
          >
            <span>Dues Only</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              filterMode === 'udhaarOnly' ? 'bg-[#4745b8] text-white' : 'bg-[#5856d6]/10 text-[#5856d6]'
            }`}>
              {udhaarCustomersCount}
            </span>
          </button>
        </div>
      </div>

      {/* Customers List (Requirement 9 & 10) */}
      {error ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-red-200 space-y-3 shadow-2xs">
          <p className="text-sm font-semibold text-red-600 apple-tight">Failed to load customers from database</p>
          <p className="text-xs text-[#86868b]">{error.message}</p>
          <button
            type="button"
            onClick={retry}
            className="px-4 py-2 bg-[#0066cc] text-white text-xs font-semibold rounded-full cursor-pointer hover:bg-[#0055b3] transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : isLoading ? (
        <div className="p-8 text-center text-[#86868b] text-sm font-normal">
          Loading customers...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-[#d2d2d7]">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-sm font-semibold text-[#1d1d1f] apple-tight">No customers found</p>
          <p className="text-xs text-[#86868b] mt-0.5">
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
                className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#e5e5ea] shadow-2xs hover:border-[#5856d6]/40 transition-all flex items-center justify-between gap-3 cursor-pointer group"
              >
                {/* Left: Avatar & Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#5856d6]/10 text-[#5856d6] font-semibold text-base flex items-center justify-center shrink-0">
                    {cust.name.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-semibold text-[#1d1d1f] group-hover:text-[#5856d6] text-base leading-tight truncate apple-tight">
                      {cust.name}
                    </h3>
                    {cust.phone && (
                      <div className="text-xs text-[#86868b] flex items-center gap-1 mt-0.5 font-normal">
                        <Phone className="w-3 h-3 text-[#86868b] shrink-0" />
                        <span>{cust.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Balance & Action Button */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span
                      className={`text-sm sm:text-base font-bold apple-tight ${
                        hasDue ? 'text-[#5856d6]' : 'text-emerald-600'
                      }`}
                    >
                      {formatCurrency(due)} due
                    </span>
                    <span className="block text-[10px] text-[#86868b] font-medium uppercase">
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
                      className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs rounded-full shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <IndianRupee className="w-3.5 h-3.5 stroke-[2]" />
                      <span className="hidden sm:inline">Collect</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCustomer(cust);
                    }}
                    className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] active:scale-95 text-[#86868b] hover:text-[#1d1d1f] flex items-center justify-center transition-all cursor-pointer"
                    title="Edit customer details"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <ArrowUpRight className="w-4 h-4 text-[#86868b] group-hover:text-[#5856d6] transition-colors hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddCustomerModal
        isOpen={isAddModalOpen || !!editingCustomer}
        customer={editingCustomer}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCustomer(null);
        }}
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
