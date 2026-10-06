import React, { useState, useMemo } from 'react';
import { Modal } from '../../components/Modal';
import type { Customer } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Search, Plus, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { customerService } from '../../services/customerService';

interface UdhaarCustomerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  totalAmount: number;
  onConfirmUdhaar: (customerId: string, customerName: string) => void;
}

const RECENT_CUSTOMERS_KEY = 'shopflow_recent_customers';

function getRecentCustomerIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CUSTOMERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function recordRecentCustomer(id: string) {
  try {
    const list = getRecentCustomerIds().filter((existing) => existing !== id);
    list.unshift(id);
    localStorage.setItem(RECENT_CUSTOMERS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    // ignore
  }
}

export const UdhaarCustomerPickerModal: React.FC<UdhaarCustomerPickerModalProps> = ({
  isOpen,
  onClose,
  customers,
  totalAmount,
  onConfirmUdhaar,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state on modal close/open
  const handleClose = () => {
    setSelectedCustomer(null);
    setIsAddingNew(false);
    setSearchTerm('');
    setNewName('');
    setNewPhone('');
    onClose();
  };

  const recentIds = useMemo(() => (isOpen ? getRecentCustomerIds() : []), [isOpen]);

  // Section 9: Prioritize recently used customers & sort by balance
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const matched = customers.filter(
      (c) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term))
    );

    return matched.sort((a, b) => {
      // Prioritize recently used customers
      const indexA = recentIds.indexOf(a.id);
      const indexB = recentIds.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      // Then customers with outstanding due
      const balA = a.balance ?? 0;
      const balB = b.balance ?? 0;
      if (balA > 0 && balB === 0) return -1;
      if (balB > 0 && balA === 0) return 1;

      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [customers, searchTerm, recentIds]);

  // Section 10: Handle creating new customer & automatically selecting them
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const created = await customerService.addCustomer({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        balance: 0,
      });

      // Automatically select the newly created customer for the sale
      recordRecentCustomer(created.id);
      setSelectedCustomer(created);
      setIsAddingNew(false);
      setNewName('');
      setNewPhone('');
    } catch (err) {
      console.error('Failed to create customer', err);
      alert('Could not create customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalConfirm = () => {
    if (!selectedCustomer) return;
    recordRecentCustomer(selectedCustomer.id);
    onConfirmUdhaar(selectedCustomer.id, selectedCustomer.name);
    handleClose();
  };

  // If a customer is selected: Show Confirmation Screen (Section 9)
  if (selectedCustomer) {
    const currentDue = selectedCustomer.balance ?? 0;
    const thisSale = totalAmount;
    const newBalance = currentDue + thisSale;

    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Confirm Udhaar"
        subtitle={`Adding sale to ${selectedCustomer.name}'s khata`}
      >
        <div className="space-y-4">
          {/* Customer Summary & Due Breakdown */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white font-black text-lg flex items-center justify-center">
                  {selectedCustomer.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {selectedCustomer.name}
                  </h3>
                  {selectedCustomer.phone && (
                    <span className="text-xs text-slate-500 font-medium">
                      {selectedCustomer.phone}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-xs font-bold text-violet-600 hover:text-violet-800 cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Current due:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(currentDue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>This sale:</span>
                <span className="font-bold text-violet-700">
                  +{formatCurrency(thisSale)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-sm font-extrabold text-slate-900">
                  New balance:
                </span>
                <span className="text-2xl font-black text-violet-700">
                  {formatCurrency(newBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Large Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleFinalConfirm}
              className="w-full h-14 sm:h-16 rounded-2xl bg-violet-600 hover:bg-violet-700 active:scale-98 text-white font-black text-lg sm:text-xl flex items-center justify-center gap-2 shadow-sm shadow-violet-600/30 transition-all cursor-pointer"
            >
              <Check className="w-6 h-6 stroke-[3]" />
              <span>CONFIRM UDHAAR</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to customer list</span>
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Step 1: Customer Selection or Small New Customer Form
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Select Customer"
      subtitle={`Adding ${formatCurrency(totalAmount)} to Udhaar`}
    >
      <div className="space-y-3.5">
        {!isAddingNew ? (
          <>
            {/* Search Customer Input & + Add Customer button */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
              </div>

              {/* + Add Customer CTA (Section 10) */}
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="h-11 px-3.5 bg-violet-50 hover:bg-violet-100 text-violet-700 font-extrabold text-xs sm:text-sm rounded-2xl border border-violet-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Customer</span>
              </button>
            </div>

            {/* Existing Customers List (Prioritizes Recent) */}
            <div className="space-y-2 max-h-72 overflow-y-auto overscroll-contain pr-0.5">
              {filteredCustomers.map((cust) => {
                const due = cust.balance ?? 0;
                const isRecent = recentIds.includes(cust.id);

                return (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => setSelectedCustomer(cust)}
                    className="w-full min-h-[52px] p-3 rounded-2xl bg-white border border-slate-200/90 hover:border-violet-500 hover:bg-violet-50/20 active:scale-[0.99] flex items-center justify-between text-left transition-all cursor-pointer shadow-2xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 font-black text-sm flex items-center justify-center shrink-0">
                        {cust.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-900 group-hover:text-violet-700 text-sm sm:text-base leading-tight truncate">
                            {cust.name}
                          </span>
                          {isRecent && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-violet-50 text-violet-700 text-[10px] font-black rounded-md">
                              <Sparkles className="w-2.5 h-2.5" />
                              Recent
                            </span>
                          )}
                        </div>
                        {cust.phone && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {cust.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span
                        className={`text-xs sm:text-sm font-black ${
                          due > 0 ? 'text-violet-700' : 'text-slate-500'
                        }`}
                      >
                        Due {formatCurrency(due)}
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Section 15: Empty States */}
              {customers.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4 space-y-1">
                  <p className="text-2xl">👥</p>
                  <h4 className="text-sm font-extrabold text-slate-800">No customers yet</h4>
                  <p className="text-xs text-slate-500">
                    Add a customer when someone buys on Udhaar.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(true)}
                    className="mt-2 px-3 py-1.5 bg-violet-600 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    + Add First Customer
                  </button>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No matching customers found. Click{' '}
                  <strong className="text-violet-700">+ Add Customer</strong> above.
                </div>
              ) : null}
            </div>
          </>
        ) : (
          /* Minimal New Customer Form (Section 10: Name * required, Phone optional) */
          <form onSubmit={handleCreateCustomer} className="space-y-3.5">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-violet-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl cursor-pointer"
              >
                Back to List
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Select & Continue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
