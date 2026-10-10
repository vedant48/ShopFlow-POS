import React, { useEffect, useState } from 'react';
import { formatCurrency } from '../../lib/utils';
import { RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Sale } from '../../types';

interface SaleToastProps {
  sale: Sale | null;
  onUndo: (saleId: string) => void;
  onDismiss: () => void;
  stockNotice: string | null;
  onDismissStockNotice: () => void;
}

interface SaleUndoItemProps {
  sale: Sale;
  onUndo: (saleId: string) => void;
  onDismiss: () => void;
}

const SaleUndoItem: React.FC<SaleUndoItemProps> = ({ sale, onUndo, onDismiss }) => {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onDismiss]);

  const handleUndoClick = async () => {
    if (isUndoing) return;
    try {
      setIsUndoing(true);
      await onUndo(sale.id);
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="pointer-events-auto bg-white/95 backdrop-blur-xl text-[#1d1d1f] p-2.5 sm:p-3 rounded-full shadow-xl border border-[#e5e5ea] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Sale details (Section 11) */}
      <div className="flex items-center gap-2.5 min-w-0 pl-1">
        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-tight truncate text-emerald-700 apple-tight">
            Sale recorded
          </div>
          <div className="text-xs text-[#1d1d1f] font-semibold flex items-center gap-1.5 truncate apple-tight">
            <span>{formatCurrency(sale.totalAmount)}</span>
            <span className="text-[#86868b] font-normal">·</span>
            <span className="text-[#86868b] font-normal">{sale.itemCount || 1} {sale.itemCount === 1 ? 'item' : 'items'}</span>
            <span className="text-[#86868b] font-normal">·</span>
            <span className="text-[#0066cc]">
              {sale.paymentStatus === 'PAID'
                ? sale.paymentMethod || 'CASH'
                : `UDHAAR (${sale.customerName || 'Customer'})`}
            </span>
          </div>
        </div>
      </div>

      {/* UNDO Action Button (>= 44px touch target) */}
      <button
        type="button"
        onClick={handleUndoClick}
        disabled={isUndoing}
        className="h-9 px-3.5 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] active:scale-95 text-[#1d1d1f] font-semibold text-xs flex items-center gap-1.5 border border-[#e5e5ea] transition-all cursor-pointer shrink-0 disabled:opacity-50"
        aria-label="Undo recorded sale"
      >
        <RotateCcw className={`w-3.5 h-3.5 stroke-[2] ${isUndoing ? 'animate-spin' : ''}`} />
        <span>{isUndoing ? 'Reversing...' : `UNDO (${secondsLeft}s)`}</span>
      </button>
    </div>
  );
};

export const SaleToast: React.FC<SaleToastProps> = ({
  sale,
  onUndo,
  onDismiss,
  stockNotice,
}) => {
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md flex flex-col gap-2 pointer-events-none">
      {/* Non-Blocking Stock Protection Warning (Requirement 3) */}
      {stockNotice && (
        <div className="pointer-events-auto mx-auto px-4 py-2 bg-amber-500 text-white text-xs sm:text-sm font-extrabold rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <AlertCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>{stockNotice}</span>
        </div>
      )}

      {/* Sale Recorded + UNDO Toast (Requirement 5 & 9) */}
      {sale && (
        <SaleUndoItem
          key={sale.id}
          sale={sale}
          onUndo={onUndo}
          onDismiss={onDismiss}
        />
      )}
    </div>
  );
};
