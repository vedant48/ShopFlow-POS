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
          <div className="p-4 bg-[#f5f5f7]/60 rounded-2xl border border-[#e5e5ea] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#e5e5ea]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#5856d6] text-white font-bold text-base flex items-center justify-center">
                  {selectedCustomer.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f] leading-tight apple-tight">
                    {selectedCustomer.name}
                  </h3>
                  {selectedCustomer.phone && (
                    <span className="text-xs text-[#86868b] font-normal">
                      {selectedCustomer.phone}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-xs font-semibold text-[#5856d6] hover:text-[#4745b8] cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-[#86868b]">
                <span>Current due:</span>
                <span className="font-semibold text-[#1d1d1f]">
                  {formatCurrency(currentDue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#86868b]">
                <span>This sale:</span>
                <span className="font-semibold text-[#5856d6]">
                  +{formatCurrency(thisSale)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#e5e5ea] flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[#1d1d1f] apple-tight">
                  New balance:
                </span>
                <span className="text-2xl font-bold text-[#5856d6] apple-tight">
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
              className="w-full h-12 rounded-full bg-[#5856d6] hover:bg-[#4745b8] active:scale-[0.98] text-white font-semibold text-base flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>CONFIRM UDHAAR</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="w-full h-10 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-xs font-medium text-[#1d1d1f] flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-[0.98]"
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
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
                <input
                  type="text"
                  placeholder="Search customer name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-3.5 bg-white border border-[#e5e5ea] rounded-full text-sm font-normal text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#5856d6] placeholder:text-[#86868b]"
                  autoFocus
                />
              </div>

              {/* + Add Customer CTA (Section 10) */}
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="h-10 px-3.5 bg-white hover:bg-[#f5f5f7] text-[#5856d6] font-semibold text-xs rounded-full border border-[#5856d6]/30 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
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
                    className="w-full min-h-[52px] p-3 rounded-2xl bg-white border border-[#e5e5ea] hover:border-[#5856d6]/40 hover:bg-[#5856d6]/5 active:scale-[0.99] flex items-center justify-between text-left transition-all cursor-pointer shadow-2xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#5856d6]/10 text-[#5856d6] font-semibold text-sm flex items-center justify-center shrink-0">
                        {cust.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#1d1d1f] group-hover:text-[#5856d6] text-sm sm:text-base leading-tight truncate apple-tight">
                            {cust.name}
                          </span>
                          {isRecent && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-[#5856d6]/10 text-[#5856d6] text-[10px] font-medium rounded-full">
                              <Sparkles className="w-2.5 h-2.5" />
                              Recent
                            </span>
                          )}
                        </div>
                        {cust.phone && (
                          <span className="text-[11px] text-[#86868b] font-normal">
                            {cust.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span
                        className={`text-xs sm:text-sm font-semibold apple-tight ${
                          due > 0 ? 'text-[#5856d6]' : 'text-[#86868b]'
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
                <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-[#d2d2d7] p-4 space-y-1">
                  <p className="text-2xl">👥</p>
                  <h4 className="text-sm font-semibold text-[#1d1d1f] apple-tight">No customers yet</h4>
                  <p className="text-xs text-[#86868b]">
                    Add a customer when someone buys on Udhaar.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(true)}
                    className="mt-2 px-3.5 py-1.5 bg-[#5856d6] text-white font-semibold text-xs rounded-full cursor-pointer active:scale-95 transition-all"
                  >
                    + Add First Customer
                  </button>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-6 text-[#86868b] text-xs">
                  No matching customers found. Click{' '}
                  <strong className="text-[#5856d6] font-semibold">+ Add Customer</strong> above.
                </div>
              ) : null}
            </div>
          </>
        ) : (
          /* Minimal New Customer Form (Section 10: Name * required, Phone optional) */
          <form onSubmit={handleCreateCustomer} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-[#e5e5ea] rounded-xl text-sm font-normal text-[#1d1d1f] focus:ring-2 focus:ring-[#5856d6] focus:outline-none placeholder:text-[#86868b]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-[#e5e5ea] rounded-xl text-sm font-normal text-[#1d1d1f] focus:ring-2 focus:ring-[#5856d6] focus:outline-none placeholder:text-[#86868b]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="flex-1 h-11 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] font-semibold text-xs sm:text-sm rounded-full cursor-pointer transition-colors active:scale-95"
              >
                Back to List
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className="flex-1 h-11 bg-[#5856d6] hover:bg-[#4745b8] text-white font-semibold text-xs sm:text-sm rounded-full shadow-2xs cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
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
