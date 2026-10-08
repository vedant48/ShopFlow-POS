import React, { useState, useMemo } from 'react';
import { Modal } from '../../components/Modal';
import { useCustomers } from '../../hooks/useShopData';
import { openOrderService } from '../../services/openOrderService';
import { formatCurrency } from '../../lib/utils';
import type { CartItem, Customer, OpenOrder } from '../../types';
import { Clock, User, Users, Search } from 'lucide-react';

interface HoldOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotal: number;
  totalItems: number;
  onSuccess: (order: OpenOrder) => void;
}

export const HoldOrderModal: React.FC<HoldOrderModalProps> = ({
  isOpen,
  onClose,
  cart,
  subtotal,
  totalItems,
  onSuccess,
}) => {
  const { customers } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walkInName, setWalkInName] = useState<string>('Walk-in #1');

  // Load next walk-in name when modal opens
  React.useEffect(() => {
    if (isOpen) {
      openOrderService.getNextWalkInName().then(setWalkInName).catch(() => setWalkInName('Walk-in #1'));
      setNote('');
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers.slice(0, 8);
    const term = searchTerm.toLowerCase();
    return customers
      .filter((c) => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)))
      .slice(0, 10);
  }, [customers, searchTerm]);

  // Handle fast 1-tap Walk-in Hold
  const handleHoldWalkIn = async () => {
    if (isSubmitting || cart.length === 0) return;

    try {
      setIsSubmitting(true);
      const { order } = await openOrderService.createOpenOrder({
        items: cart,
        temporaryCustomerName: walkInName,
        note: note.trim() || undefined,
      });

      onSuccess(order);
      onClose();
    } catch (err: any) {
      console.error('Failed to hold order', err);
      alert('Could not hold order: ' + err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Customer Hold
  const handleHoldWithCustomer = async (cust: Customer) => {
    if (isSubmitting || cart.length === 0) return;

    try {
      setIsSubmitting(true);
      const { order } = await openOrderService.createOpenOrder({
        items: cart,
        customerId: cust.id,
        customerName: cust.name,
        note: note.trim() || undefined,
      });

      onSuccess(order);
      onClose();
    } catch (err: any) {
      console.error('Failed to hold order', err);
      alert('Could not hold order: ' + err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hold Order"
      subtitle="Save order to Open Orders timeline and serve other customers"
    >
      <div className="space-y-4">
        {/* Order Summary Pill */}
        <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs font-black text-amber-900 block leading-tight">
                {totalItems} items in cart
              </span>
              <span className="text-[11px] font-semibold text-amber-700">
                Customer ka order open rahega
              </span>
            </div>
          </div>
          <span className="text-base font-black text-amber-900">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {/* 1-Tap Walk-In Button */}
        <div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleHoldWalkIn}
            className="w-full h-13 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-extrabold text-sm flex items-center justify-between px-4 shadow-sm shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-black leading-tight">
                  Hold as {walkInName}
                </span>
                <span className="block text-[10px] text-amber-100 font-medium">
                  Walk-in / temporary customer (1 tap)
                </span>
              </div>
            </div>
            <span className="text-xs font-black uppercase bg-white/20 px-2.5 py-1 rounded-xl">
              Hold Now →
            </span>
          </button>
        </div>

        {/* Optional Note */}
        <div>
          <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
            Order Note / Table (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Table 2, Outside counter, Green shirt..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Customer Selection */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Or hold for a registered customer
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search customer name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="max-h-48 overflow-y-auto overscroll-contain space-y-1 pr-0.5 divide-y divide-slate-100">
            {filteredCustomers.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 font-medium">
                No customer found matching "{searchTerm}"
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const due = cust.balance ?? 0;
                return (
                  <button
                    key={cust.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleHoldWithCustomer(cust)}
                    className="w-full p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 flex items-center justify-between transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 font-black text-xs flex items-center justify-center shrink-0">
                        {cust.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-slate-900 group-hover:text-amber-700 text-xs block truncate">
                          {cust.name}
                        </span>
                        {cust.phone && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {cust.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 block">
                        {due > 0 ? (
                          <span className="text-violet-700 font-black">
                            Due {formatCurrency(due)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Due ₹0</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 uppercase group-hover:underline">
                        Select →
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Cancel */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
