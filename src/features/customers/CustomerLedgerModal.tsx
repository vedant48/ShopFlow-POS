import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { db } from '../../db';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import type { Customer } from '../../types';
import { customerService } from '../../services/customerService';
import { Phone, ArrowDownLeft, ArrowUpRight, IndianRupee, Pencil, User, FileText } from 'lucide-react';

interface CustomerLedgerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onCollectPayment: (customer: Customer) => void;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  customer,
  isOpen,
  onClose,
  onCollectPayment,
}) => {
  // Live query for customer data to reflect real-time local edits
  const liveCustomer = useLiveQuery(async () => {
    if (!customer?.id || !isOpen) return null;
    return await db.customers.get(customer.id);
  }, [customer?.id, isOpen]);

  const activeCustomer = liveCustomer || customer;

  // Real-time live query for unified customer transaction ledger
  const ledgerEntries = useLiveQuery(async () => {
    if (!customer?.id || !isOpen) return [];
    return await customerService.getCustomerHistory(customer.id);
  }, [customer?.id, activeCustomer?.balance, isOpen]);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync edit form with active customer
  useEffect(() => {
    if (activeCustomer) {
      setEditName(activeCustomer.name || '');
      setEditPhone(activeCustomer.phone || '');
      setEditNotes(activeCustomer.notes || '');
    }
  }, [activeCustomer?.id, activeCustomer?.name, activeCustomer?.phone, activeCustomer?.notes, isEditing]);

  // Reset edit mode when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
    }
  }, [isOpen]);

  if (!activeCustomer) return null;

  const currentDue = activeCustomer.balance ?? 0;
  const history = ledgerEntries || [];
  const loading = ledgerEntries === undefined;

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await customerService.updateCustomer(activeCustomer.id, {
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update customer details', err);
      alert('Error updating customer details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Customer Details' : activeCustomer.name}
      subtitle={
        isEditing
          ? 'Update name, mobile number, and notes'
          : activeCustomer.phone
          ? `Customer Mobile: ${activeCustomer.phone}`
          : 'Customer Account'
      }
    >
      <div className="space-y-4">
        {isEditing ? (
          /* Inline Edit Customer Form */
          <form onSubmit={handleSaveCustomer} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-violet-600" />
                Customer Information
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Back to Ledger
              </button>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Raj"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Mobile Number (Optional)
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Notes / Address (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add customer address, landmark, or specific notes..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !editName.trim()}
                className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          /* Normal View: Balance, Actions & Ledger */
          <>
            {/* Outstanding Balance Card */}
            <div className="p-4 bg-gradient-to-br from-violet-50 via-white to-violet-50/30 rounded-2xl border border-violet-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                    Outstanding Balance
                  </span>
                  <div
                    className={`text-2xl sm:text-3xl font-black tracking-tight ${
                      currentDue > 0 ? 'text-violet-700' : 'text-emerald-600'
                    }`}
                  >
                    {formatCurrency(currentDue)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {activeCustomer.phone && (
                    <a
                      href={`tel:${activeCustomer.phone}`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Call</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-violet-300 rounded-xl text-xs font-bold text-violet-700 hover:bg-violet-50 shadow-2xs transition-all cursor-pointer"
                    title="Edit customer details"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              {/* Large COLLECT PAYMENT button */}
              {currentDue > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCollectPayment(activeCustomer);
                  }}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <IndianRupee className="w-4 h-4 stroke-[3]" />
                  <span>COLLECT PAYMENT</span>
                </button>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-extrabold text-emerald-700">
                  ✓ All dues cleared · ₹0 outstanding
                </div>
              )}
            </div>

            {/* Notes if present */}
            {activeCustomer.notes && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-extrabold text-slate-800">Note: </span>
                    {activeCustomer.notes}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] font-bold text-violet-600 hover:text-violet-800 shrink-0 cursor-pointer"
                >
                  Edit
                </button>
              </div>
            )}

            {/* Transaction History */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Transaction History
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">
                  {history.length} transactions
                </span>
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  Loading ledger history...
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  No transactions recorded for this customer yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto overscroll-contain pr-1">
                  {history.map((entry) => {
                    const isSale = entry.type === 'UDHAAR_SALE';

                    return (
                      <div
                        key={entry.id}
                        className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between gap-3 text-xs"
                      >
                        {/* Left Icon and Title */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isSale
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isSale ? (
                              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                            ) : (
                              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold text-slate-900 text-sm leading-tight truncate">
                              {entry.title}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                              {formatDateTime(entry.date)}
                            </div>
                          </div>
                        </div>

                        {/* Right: +₹X (sale) or -₹X (payment) */}
                        <div className="text-right shrink-0">
                          <span
                            className={`text-sm font-black ${
                              isSale ? 'text-violet-700' : 'text-emerald-600'
                            }`}
                          >
                            {isSale
                              ? `+${formatCurrency(entry.amount)}`
                              : `-${formatCurrency(entry.amount)}`}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                            {isSale ? 'Udhaar' : 'Paid'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
