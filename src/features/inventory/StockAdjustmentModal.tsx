import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { inventoryService } from '../../services/inventoryService';
import type { Product } from '../../types';
import { Scale, AlertCircle } from 'lucide-react';

interface StockAdjustmentModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface StockAdjustmentFormProps {
  product: Product;
  onClose: () => void;
  onSuccess?: () => void;
}

const COMMON_REASONS = [
  'Counting error',
  'Damaged / Broken',
  'Theft / Missing',
  'Expired product',
  'Spillage / Waste',
  'Other',
];

const StockAdjustmentForm: React.FC<StockAdjustmentFormProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const [actualStock, setActualStock] = useState<number>(product.stock);
  const [reason, setReason] = useState<string>('Counting error');
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStock = product.stock;
  const difference = actualStock - currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualStock < 0) return;
    if (difference === 0) {
      alert('Physical stock is identical to system stock. No adjustment needed.');
      return;
    }

    try {
      setIsSubmitting(true);
      const finalReason =
        reason === 'Other' && customNote.trim()
          ? `Other: ${customNote.trim()}`
          : customNote.trim()
          ? `${reason} (${customNote.trim()})`
          : reason;

      await inventoryService.recordAdjustment({
        productId: product.id,
        actualPhysicalStock: actualStock,
        reason: finalReason,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to adjust stock', err);
      alert('Error saving adjustment: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Info Bar */}
      <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none">{product.emoji || '📦'}</span>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">{product.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Current System Stock:{' '}
              <span className="font-extrabold text-slate-800">{currentStock}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Physical Stock Input */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Actual Physical Count *
        </label>
        <div className="relative">
          <input
            type="number"
            min="0"
            required
            value={actualStock === 0 && currentStock !== 0 ? actualStock : actualStock || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setActualStock(isNaN(val) ? 0 : Math.max(0, val));
            }}
            className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
            Units
          </span>
        </div>
      </div>

      {/* Difference Indicator */}
      <div
        className={`p-3.5 rounded-xl border flex items-center justify-between ${
          difference === 0
            ? 'bg-slate-50 border-slate-200 text-slate-600'
            : difference < 0
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold">Stock Difference:</span>
        </div>
        <div className="font-black text-sm">
          {difference > 0 ? (
            <span className="text-emerald-700">+{difference} (Stock gain)</span>
          ) : difference < 0 ? (
            <span className="text-rose-700">{difference} (Stock loss)</span>
          ) : (
            <span>0 (Count matches)</span>
          )}
        </div>
      </div>

      {/* Reason for adjustment */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          Reason for Adjustment *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COMMON_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer truncate ${
                reason === r
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Custom note */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Note / Explanation (Optional)
        </label>
        <input
          type="text"
          placeholder="e.g. Broken bottle during restocking, physical audit count..."
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-900 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
        <p className="leading-snug">
          This will record an <strong>ADJUSTMENT</strong> movement of {difference > 0 ? `+${difference}` : difference} units. It will NOT affect your sales revenue or fake a sale.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || difference === 0}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Adjustment'}
        </button>
      </div>
    </form>
  );
};

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Stock"
      subtitle={`Correct physical count for ${product.name}`}
    >
      <StockAdjustmentForm
        key={product.id}
        product={product}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  );
};
