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
        <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-2xs">
              <Clock className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-xs font-semibold text-amber-900 block leading-tight apple-tight">
                {totalItems} items in cart
              </span>
              <span className="text-[11px] font-normal text-amber-700">
                Customer order will be saved to timeline
              </span>
            </div>
          </div>
          <span className="text-base font-bold text-amber-900 apple-tight">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {/* 1-Tap Walk-In Button */}
        <div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleHoldWalkIn}
            className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-between px-4 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-semibold leading-tight apple-tight">
                  Hold as {walkInName}
                </span>
                <span className="block text-[10px] text-amber-100 font-normal">
                  Walk-in / temporary customer (1 tap)
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold uppercase bg-white/20 px-3 py-1 rounded-full">
              Hold Now →
            </span>
          </button>
        </div>

        {/* Optional Note */}
        <div>
          <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1">
            Order Note / Table (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Table 2, Outside counter, Green shirt..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-10 px-3.5 bg-white border border-[#e5e5ea] rounded-xl text-xs font-normal text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-[#86868b]"
          />
        </div>

        {/* Customer Selection */}
        <div className="space-y-2 pt-2 border-t border-[#e5e5ea]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#86868b]" />
              Or hold for a registered customer
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b] pointer-events-none" />
            <input
              type="text"
              placeholder="Search customer name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-3.5 bg-white border border-[#e5e5ea] rounded-full text-xs font-normal text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-[#86868b]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto overscroll-contain space-y-1 pr-0.5 divide-y divide-[#f5f5f7]">
            {filteredCustomers.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#86868b] font-normal">
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
                    className="w-full p-2.5 rounded-xl hover:bg-[#f5f5f7] active:bg-[#e5e5ea] flex items-center justify-between transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#5856d6]/10 text-[#5856d6] font-semibold text-xs flex items-center justify-center shrink-0">
                        {cust.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-[#1d1d1f] group-hover:text-amber-700 text-xs block truncate apple-tight">
                          {cust.name}
                        </span>
                        {cust.phone && (
                          <span className="text-[10px] text-[#86868b] font-normal">
                            {cust.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-semibold text-[#86868b] block">
                        {due > 0 ? (
                          <span className="text-[#5856d6] font-semibold apple-tight">
                            Due {formatCurrency(due)}
                          </span>
                        ) : (
                          <span className="text-[#86868b]">Due ₹0</span>
                        )}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-600 uppercase group-hover:underline">
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
            className="w-full h-11 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] font-semibold text-xs rounded-full transition-colors cursor-pointer active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
