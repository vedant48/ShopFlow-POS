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
        <div className="p-4 bg-[#f5f5f7]/60 rounded-2xl border border-[#e5e5ea] flex items-center justify-between">
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
            <div className="text-2xl font-bold text-[#1d1d1f] mt-1 apple-tight">
              {formatCurrency(sale.totalAmount)}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-[#86868b] block font-medium">Customer</span>
            <span className="text-sm font-semibold text-[#1d1d1f] apple-tight">
              {sale.customerName || 'Walk-in Customer'}
            </span>
          </div>
        </div>

        {/* Return Success Alert */}
        {returnSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{returnSuccessMsg}</span>
          </div>
        )}

        {/* Itemized List with Return Option */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#86868b]">
              Items ({sale.itemCount})
            </h4>
            <span className="text-[11px] text-[#86868b] font-normal">
              Tap return to restock returned items
            </span>
          </div>

          {loading ? (
            <div className="py-4 text-center text-xs text-[#86868b]">Loading items...</div>
          ) : (
            <div className="divide-y divide-[#f5f5f7] border border-[#e5e5ea] rounded-2xl overflow-hidden bg-white">
              {itemList.map((it) => {
                const isReturning = returningItemId === it.id;

                return (
                  <div key={it.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl select-none">{it.productEmoji}</span>
                        <div>
                          <span className="font-semibold text-[#1d1d1f] block text-sm apple-tight">
                            {it.productName}
                          </span>
                          <span className="text-[#86868b]">
                            {it.quantity} × {formatCurrency(it.sellingPrice || it.unitPrice || (it.quantity > 0 ? Math.round(it.totalPrice / it.quantity) : 0))}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#1d1d1f] text-sm apple-tight">
                          {formatCurrency(it.totalPrice)}
                        </span>

                        <button
                          type="button"
                          onClick={() => (isReturning ? setReturningItemId(null) : handleStartReturn(it))}
                          className="px-2.5 py-1 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] hover:text-[#0066cc] rounded-full text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{isReturning ? 'Cancel' : 'Return'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Return Form */}
                    {isReturning && (
                      <div className="mt-2.5 pt-2.5 border-t border-[#e5e5ea] bg-[#f5f5f7]/60 -mx-3 -mb-3 p-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-[#1d1d1f]">Qty to return:</span>
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
                            className="w-14 px-2 py-1 text-center font-bold text-xs bg-white border border-[#e5e5ea] rounded-full"
                          />
                          <span className="text-[11px] text-[#86868b]">/ max {it.quantity}</span>
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleConfirmReturn(it)}
                          className="px-3.5 py-1.5 bg-[#0066cc] hover:bg-[#0055b3] disabled:opacity-50 text-white font-semibold text-xs rounded-full shadow-2xs cursor-pointer flex items-center gap-1 active:scale-95"
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
        <div className="p-3.5 bg-[#f5f5f7]/60 rounded-2xl border border-[#e5e5ea] space-y-1.5 text-xs text-[#86868b]">
          <div className="flex justify-between">
            <span>Bill Reference</span>
            <span className="font-mono font-medium text-[#1d1d1f]">{sale.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Transaction Time</span>
            <span className="font-medium text-[#1d1d1f]">{formatDateTime(sale.createdAt)}</span>
          </div>
          {sale.notes && (
            <div className="flex justify-between">
              <span>Notes</span>
              <span className="font-medium text-[#1d1d1f]">{sale.notes}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
