import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { formatCurrency } from '../../lib/utils';
import { Banknote, QrCode } from 'lucide-react';

interface PaymentMethodModalProps {
  isOpen: boolean;
  totalAmount: number;
  onClose: () => void;
  onSelectMethod: (method: 'CASH' | 'UPI') => void;
  isProcessing?: boolean;
}

const STORAGE_KEY = 'shopflow_last_payment_method';

function getInitialMethod(): 'CASH' | 'UPI' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'UPI') return 'UPI';
  } catch {
    // ignore
  }
  return 'CASH';
}

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  totalAmount,
  onClose,
  onSelectMethod,
  isProcessing = false,
}) => {
  const [lastMethod] = useState<'CASH' | 'UPI'>(getInitialMethod);

  const handleSelect = (method: 'CASH' | 'UPI') => {
    try {
      localStorage.setItem(STORAGE_KEY, method);
    } catch {
      // ignore localStorage errors in private mode
    }
    onSelectMethod(method);
  };

  // Keyboard accessibility: 1 or Enter triggers primary, 2 triggers UPI, Esc closes
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1' || (e.key === 'Enter' && lastMethod === 'CASH')) {
        e.preventDefault();
        handleSelect('CASH');
      } else if (e.key === '2' || (e.key === 'Enter' && lastMethod === 'UPI')) {
        e.preventDefault();
        handleSelect('UPI');
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleSelect('CASH');
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleSelect('UPI');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, lastMethod]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Method"
      subtitle="How was payment received?"
    >
      <div className="space-y-4">
        {/* Total Amount Pill */}
        <div className="p-4 bg-[#f5f5f7]/60 rounded-2xl border border-[#e5e5ea] text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] block">
            Total Amount Due
          </span>
          <div className="text-3xl font-bold text-[#1d1d1f] mt-0.5 apple-tight">
            {formatCurrency(totalAmount)}
          </div>
        </div>

        {/* Payment Buttons (Requirement 3 & 4) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* CASH Button */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSelect('CASH')}
            className={`relative p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
              lastMethod === 'CASH'
                ? 'bg-[#0066cc]/5 border-[#0066cc] shadow-2xs'
                : 'bg-white border-[#e5e5ea] hover:border-[#d2d2d7]'
            }`}
          >
            {lastMethod === 'CASH' && (
              <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold uppercase tracking-wider bg-[#0066cc] text-white px-2 py-0.5 rounded-full">
                Last used
              </span>
            )}
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Banknote className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-base font-bold text-[#1d1d1f] apple-tight">CASH</span>
            <span className="text-[11px] font-normal text-[#86868b] -mt-1">Physical notes</span>
          </button>

          {/* UPI Button */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSelect('UPI')}
            className={`relative p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
              lastMethod === 'UPI'
                ? 'bg-[#0066cc]/5 border-[#0066cc] shadow-2xs'
                : 'bg-white border-[#e5e5ea] hover:border-[#d2d2d7]'
            }`}
          >
            {lastMethod === 'UPI' && (
              <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold uppercase tracking-wider bg-[#0066cc] text-white px-2 py-0.5 rounded-full">
                Last used
              </span>
            )}
            <div className="w-12 h-12 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
              <QrCode className="w-6 h-6 stroke-[2.2]" />
            </div>
            <span className="text-base font-bold text-[#1d1d1f] apple-tight">UPI</span>
            <span className="text-[11px] font-normal text-[#86868b] -mt-1">GPay / PhonePe / Paytm</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="w-full h-11 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] font-semibold text-xs rounded-full cursor-pointer transition-colors active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};
