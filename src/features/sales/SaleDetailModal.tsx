import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { db } from '../../db';
import { inventoryService } from '../../services/inventoryService';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Badge } from '../../components/Badge';
import type { Sale, SaleItem } from '../../types';
import { CheckCircle2, BookOpen, RotateCcw, Check } from 'lucide-react';

interface SaleDetailModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SaleDetailModal: React.FC<SaleDetailModalProps> = ({
  sale,
  isOpen,
  onClose,
}) => {
  const [returningItemId, setReturningItemId] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = useLiveQuery(async () => {
    if (!sale || !isOpen) return [];
    return await db.saleItems.where('saleId').equals(sale.id).toArray();
  }, [sale?.id, isOpen]);

  if (!sale) return null;

  const isPaid = sale.paymentStatus === 'PAID';
  const itemList = items || [];
  const loading = items === undefined;

  const handleStartReturn = (item: SaleItem) => {
    setReturningItemId(item.id);
    setReturnQty(1);
    setReturnSuccessMsg(null);
  };

  const handleConfirmReturn = async (item: SaleItem) => {
    if (returnQty <= 0 || returnQty > item.quantity) return;

    try {
      setIsSubmitting(true);
      await inventoryService.recordReturn({
        productId: item.productId,
        quantity: returnQty,
        saleId: sale.id,
        note: `Customer returned ${returnQty}x ${item.productName} (Receipt ${sale.saleNumber})`,
      });

      setReturnSuccessMsg(`Returned ${returnQty}× ${item.productName}. Stock restored!`);
      setReturningItemId(null);
    } catch (err) {
      console.error('Failed to process return', err);
      alert('Error processing return: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receipt ${sale.saleNumber}`}
      subtitle={formatDateTime(sale.createdAt)}
    >
      <div className="space-y-4">
        {/* Receipt Header Card */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={isPaid ? 'paid' : 'udhaar'} size="md">
                {isPaid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    PAID ({sale.paymentMethod || 'CASH'})
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3.5 h-3.5" />
                    UDHAAR CREDIT
                  </>
                )}
              </Badge>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {formatCurrency(sale.totalAmount)}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Customer</span>
            <span className="text-sm font-bold text-slate-800">
              {sale.customerName || 'Walk-in Customer'}
            </span>
          </div>
        </div>

        {/* Return Success Alert */}
        {returnSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{returnSuccessMsg}</span>
          </div>
        )}

        {/* Itemized List with Return Option */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Items ({sale.itemCount})
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">
              Tap return to restock returned items
            </span>
          </div>

          {loading ? (
            <div className="py-4 text-center text-xs text-slate-400">Loading items...</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {itemList.map((it) => {
                const isReturning = returningItemId === it.id;

                return (
                  <div key={it.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl select-none">{it.productEmoji}</span>
                        <div>
                          <span className="font-bold text-slate-900 block text-sm">
                            {it.productName}
                          </span>
                          <span className="text-slate-400">
                            {it.quantity} × {formatCurrency(it.sellingPrice || it.unitPrice || (it.quantity > 0 ? Math.round(it.totalPrice / it.quantity) : 0))}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-900 text-sm">
                          {formatCurrency(it.totalPrice)}
                        </span>

                        <button
                          type="button"
                          onClick={() => (isReturning ? setReturningItemId(null) : handleStartReturn(it))}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-blue-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{isReturning ? 'Cancel' : 'Return'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Return Form */}
                    {isReturning && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 bg-slate-50 -mx-3 -mb-3 p-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600">Qty to return:</span>
                          <input
                            type="number"
                            min="1"
                            max={it.quantity}
                            value={returnQty}
                            onChange={(e) =>
                              setReturnQty(
                                Math.min(
                                  it.quantity,
                                  Math.max(1, parseInt(e.target.value, 10) || 1)
                                )
                              )
                            }
                            className="w-14 px-2 py-1 text-center font-bold text-xs bg-white border border-slate-300 rounded-lg"
                          />
                          <span className="text-[11px] text-slate-400">/ max {it.quantity}</span>
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleConfirmReturn(it)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSubmitting ? 'Saving...' : 'Confirm Return'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sale Summary Footer */}
        <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Bill Reference</span>
            <span className="font-mono font-bold text-slate-800">{sale.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Transaction Time</span>
            <span className="font-medium text-slate-800">{formatDateTime(sale.createdAt)}</span>
          </div>
          {sale.notes && (
            <div className="flex justify-between">
              <span>Notes</span>
              <span className="font-medium text-slate-800">{sale.notes}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
