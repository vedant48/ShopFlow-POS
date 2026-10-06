import React, { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import type { Sale } from '../../types';

interface SaleSuccessBannerProps {
  sale: Sale | null;
  onDismiss: () => void;
}

export const SaleSuccessBanner: React.FC<SaleSuccessBannerProps> = ({
  sale,
  onDismiss,
}) => {
  useEffect(() => {
    if (sale) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [sale, onDismiss]);

  if (!sale) return null;

  const isPaid = sale.paymentStatus === 'PAID';

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-in slide-in-from-top-4 duration-200">
      <div
        className={`p-3.5 rounded-2xl shadow-xl border flex items-center justify-between gap-3 ${
          isPaid
            ? 'bg-emerald-600 text-white border-emerald-500'
            : 'bg-violet-700 text-white border-violet-600'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-extrabold text-white/80">
              {sale.saleNumber} &bull; {sale.paymentStatus}
            </div>
            <div className="text-base font-extrabold leading-tight">
              Sale Recorded: {formatCurrency(sale.totalAmount)}
            </div>
            {sale.customerName && sale.customerName !== 'Walk-in Customer' && (
              <div className="text-[11px] text-white/80 font-medium">
                Customer: {sale.customerName}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
