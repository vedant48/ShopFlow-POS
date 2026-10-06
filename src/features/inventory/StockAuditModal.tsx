import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { db } from '../../db';
import { inventoryService } from '../../services/inventoryService';
import { ClipboardCheck, CheckCircle2, Save } from 'lucide-react';

interface StockAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StockAuditModal: React.FC<StockAuditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const products = useLiveQuery(async () => {
    if (!isOpen) return [];
    return await db.products.filter((p) => p.active !== false).toArray();
  }, [isOpen]);

  // Sort: low-stock first, then high-value (stock * cost)
  const sortedProducts = useMemo(() => {
    if (!products) return [];
    return [...products].sort((a, b) => {
      const aLow = a.stock <= a.minStock ? 1 : 0;
      const bLow = b.stock <= b.minStock ? 1 : 0;
      if (aLow !== bLow) return bLow - aLow; // Low stock first

      const aValue = a.stock * (a.costPrice || a.sellingPrice);
      const bValue = b.stock * (b.costPrice || b.sellingPrice);
      return bValue - aValue; // High value first
    });
  }, [products]);

  // Overrides map for user-edited counts (key: productId -> user count)
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditSummary, setAuditSummary] = useState<{
    checkedCount: number;
    discrepancyCount: number;
  } | null>(null);

  if (!isOpen) return null;

  // Calculate discrepancies
  let discrepancyCount = 0;
  sortedProducts.forEach((p) => {
    const entered = counts[p.id] !== undefined ? counts[p.id] : p.stock;
    if (entered !== p.stock) {
      discrepancyCount++;
    }
  });

  const handleCountChange = (productId: string, valStr: string) => {
    const val = parseInt(valStr, 10);
    setCounts((prev) => ({
      ...prev,
      [productId]: isNaN(val) ? 0 : Math.max(0, val),
    }));
  };

  const handleSaveAudit = async () => {
    try {
      setIsSubmitting(true);
      const auditPayload = sortedProducts.map((p) => ({
        productId: p.id,
        physicalStock: counts[p.id] !== undefined ? counts[p.id] : p.stock,
        reason: reasons[p.id] || 'Stock Audit Adjustment',
      }));

      const result = await inventoryService.auditProducts(auditPayload);
      setAuditSummary(result);
      onSuccess?.();
    } catch (err) {
      console.error('Failed to save audit', err);
      alert('Error saving audit: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Physical Stock Audit"
      subtitle="Verify on-shelf items against system inventory"
    >
      {auditSummary ? (
        <div className="py-6 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
          </div>

          <div>
            <h3 className="text-xl font-black text-slate-900">Stock Audit Completed!</h3>
            <p className="text-sm text-slate-500 mt-1">
              Your inventory levels and audit ledger have been updated.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto grid grid-cols-2 gap-3 text-center">
            <div className="p-2 bg-white rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400 block font-semibold">Products Checked</span>
              <span className="text-xl font-black text-slate-900">
                {auditSummary.checkedCount}
              </span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100">
              <span className="text-xs text-slate-400 block font-semibold">Differences Fixed</span>
              <span
                className={`text-xl font-black ${
                  auditSummary.discrepancyCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {auditSummary.discrepancyCount}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setAuditSummary(null);
              onClose();
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl cursor-pointer"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200/80 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-bold text-blue-950">
                Prioritizing low-stock & high-value products
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full font-black text-[11px] ${
                discrepancyCount > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              {discrepancyCount} {discrepancyCount === 1 ? 'diff' : 'diffs'}
            </span>
          </div>

          {/* Audit Rows */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {sortedProducts.map((p) => {
              const currentStock = p.stock;
              const actual = counts[p.id] !== undefined ? counts[p.id] : currentStock;
              const diff = actual - currentStock;
              const isLow = currentStock <= p.minStock;

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    diff !== 0
                      ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-100'
                      : isLow
                      ? 'bg-slate-50 border-amber-200/80'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Product Name & Icon */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl select-none">{p.emoji || '📦'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-slate-900 text-sm truncate">
                            {p.name}
                          </h4>
                          {isLow && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold shrink-0">
                              Low
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          System Stock: <strong className="text-slate-700">{currentStock}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Actual Physical Count Input */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Actual
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={actual === 0 && currentStock !== 0 ? actual : actual || ''}
                          onChange={(e) => handleCountChange(p.id, e.target.value)}
                          className="w-16 px-2 py-1.5 text-center font-black text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                        />
                      </div>

                      {/* Diff Badge */}
                      <div className="w-12 text-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Diff
                        </span>
                        <span
                          className={`text-xs font-black px-1.5 py-0.5 rounded-lg inline-block ${
                            diff === 0
                              ? 'text-slate-400 bg-slate-100'
                              : diff < 0
                              ? 'text-rose-700 bg-rose-100'
                              : 'text-emerald-700 bg-emerald-100'
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* If difference, show reason dropdown */}
                  {diff !== 0 && (
                    <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-800 shrink-0">Reason:</span>
                      <select
                        value={reasons[p.id] || 'Stock Audit Count'}
                        onChange={(e) =>
                          setReasons((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="w-full text-xs py-1 px-2 bg-white border border-amber-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Stock Audit Count">Stock Audit Count</option>
                        <option value="Damaged / Broken">Damaged / Broken</option>
                        <option value="Theft / Missing">Theft / Missing</option>
                        <option value="Expired">Expired</option>
                        <option value="Counting error">Counting error</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Save Audit Bar */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              <span className="font-bold text-slate-900">{sortedProducts.length}</span> products
              checked
              {discrepancyCount > 0 && (
                <span className="text-amber-700 font-bold ml-1">
                  ({discrepancyCount} adjustment{discrepancyCount === 1 ? '' : 's'})
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAudit}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : 'Save Audit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
