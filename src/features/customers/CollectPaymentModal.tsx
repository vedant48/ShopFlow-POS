import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { customerService } from '../../services/customerService';
import { formatCurrency } from '../../lib/utils';
import type { Customer, PaymentMethod } from '../../types';
import { Check, IndianRupee } from 'lucide-react';

interface CollectPaymentModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({
  customer,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const currentBalance = customer?.balance ?? 0;
  const [amount, setAmount] = useState<string>(currentBalance > 0 ? currentBalance.toString() : '');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!customer) return null;

  const payAmount = parseFloat(amount) || 0;
  const remainingBalance = Math.max(0, currentBalance - payAmount);

  // Quick select pill values
  const quickPills = [
    50,
    100,
    currentBalance,
  ].filter((v, i, a) => v > 0 && a.indexOf(v) === i && v <= currentBalance);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0 || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await customerService.recordPayment(
        customer.id,
        payAmount,
        note.trim() || undefined,
        paymentMode
      );
      setNote('');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to collect payment', err);
      alert('Error recording payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Collect Payment"
      subtitle={`Receive money from ${customer.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Outstanding & New Balance Summary */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
              Outstanding
            </span>
            <span className="text-2xl font-black text-violet-700">
              {formatCurrency(currentBalance)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
              Remaining Due
            </span>
            <span
              className={`text-2xl font-black ${
                remainingBalance === 0 ? 'text-emerald-600' : 'text-slate-800'
              }`}
            >
              {formatCurrency(remainingBalance)}
            </span>
          </div>
        </div>

        {/* Quick Amount Pills: [ ₹50 ], [ ₹100 ], [ ₹195 ] */}
        {quickPills.length > 0 && (
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
              Quick Select Amount
            </label>
            <div className="flex flex-wrap gap-2">
              {quickPills.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toString())}
                  className={`h-11 px-4 rounded-xl text-xs sm:text-sm font-black border transition-all cursor-pointer ${
                    payAmount === amt
                      ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount Received Input */}
        <div>
          <label className="block text-xs font-extrabold text-slate-700 mb-1">
            Amount Received (₹) *
          </label>
          <div className="relative">
            <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              required
              min="1"
              max={currentBalance}
              step="1"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-12 pl-10 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>
        </div>

        {/* Payment Mode Selector */}
        <div>
          <label className="block text-xs font-extrabold text-slate-700 mb-1">
            Payment Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMode('CASH')}
              className={`h-11 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                paymentMode === 'CASH'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              💵 Cash Received
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('UPI')}
              className={`h-11 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                paymentMode === 'UPI'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              📱 UPI / QR Scan
            </button>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-extrabold text-slate-700 mb-1">
            Note (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Settle partial balance"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || payAmount <= 0}
            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? 'Saving...' : `Collect ${formatCurrency(payAmount)}`}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
