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
    <div className="pointer-events-auto bg-slate-900 text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Sale details (Section 11) */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black tracking-tight truncate text-emerald-400">
            ✓ Sale recorded
          </div>
          <div className="text-xs text-white font-extrabold flex items-center gap-1.5 truncate">
            <span>{formatCurrency(sale.totalAmount)}</span>
            <span className="text-slate-400 font-normal">·</span>
            <span>{sale.itemCount || 1} {sale.itemCount === 1 ? 'item' : 'items'}</span>
            <span className="text-slate-400 font-normal">·</span>
            <span className="text-blue-300">
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
        className="h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-400 hover:text-amber-300 font-black text-sm flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer shrink-0 disabled:opacity-50"
        aria-label="Undo recorded sale"
      >
        <RotateCcw className={`w-4 h-4 stroke-[2.5] ${isUndoing ? 'animate-spin' : ''}`} />
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
