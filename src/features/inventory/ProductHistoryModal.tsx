import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { db } from '../../db';
import { inventoryService } from '../../services/inventoryService';
import type { Product, InventoryMovement } from '../../types';
import { formatDateTime } from '../../lib/utils';
import {
  History,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ProductHistoryModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const [showFormula, setShowFormula] = useState(false);
  const [auditData, setAuditData] = useState<{
    openingStock: number;
    purchases: number;
    returns: number;
    positiveAdjustments: number;
    sales: number;
    negativeAdjustments: number;
    calculatedStock: number;
    storedStock: number;
  } | null>(null);

  // Live movements query for this product
  const movements = useLiveQuery(async () => {
    if (!product || !isOpen) return [];
    return await db.inventoryMovements
      .where('productId')
      .equals(product.id)
      .reverse()
      .sortBy('createdAt');
  }, [product?.id, isOpen]);

  useEffect(() => {
    if (product && isOpen) {
      inventoryService.getExpectedStock(product.id).then((res) => {
        setAuditData(res);
      });
    }
  }, [product, isOpen, movements]);

  if (!product) return null;

  const movementList = movements || [];
  const inSync = auditData && auditData.calculatedStock === auditData.storedStock;

  const getMovementMeta = (m: InventoryMovement) => {
    const qty = m.quantity !== undefined ? m.quantity : m.quantityChange ?? 0;
    switch (m.type) {
      case 'SALE':
        return {
          label: 'SALE',
          color: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <TrendingDown className="w-3.5 h-3.5 text-rose-600" />,
          sign: '',
          qtyDisplay: `${qty}`,
        };
      case 'PURCHASE':
        return {
          label: 'PURCHASE',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />,
          sign: qty > 0 ? '+' : '',
          qtyDisplay: `${qty > 0 ? '+' : ''}${qty}`,
        };
      case 'RETURN':
        return {
          label: 'RETURN',
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <RotateCcw className="w-3.5 h-3.5 text-blue-600" />,
          sign: '+',
          qtyDisplay: `+${Math.abs(qty)}`,
        };
      case 'ADJUSTMENT':
      default:
        return {
          label: 'ADJUSTMENT',
          color: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: <Sliders className="w-3.5 h-3.5 text-amber-600" />,
          sign: qty > 0 ? '+' : '',
          qtyDisplay: `${qty > 0 ? '+' : ''}${qty}`,
        };
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Stock History & Audit"
      subtitle={`Complete audit ledger for ${product.name}`}
    >
      <div className="space-y-4">
        {/* Product Stock Summary */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl select-none">{product.emoji || '📦'}</span>
            <div>
              <div className="font-extrabold text-slate-900 text-sm leading-tight">
                {product.name}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Current Stock:{' '}
                <span className="font-extrabold text-slate-800">{product.stock} units</span>
              </div>
            </div>
          </div>

          {inSync ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>In Sync</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
              Review Needed
            </div>
          )}
        </div>

        {/* Auditable Stock Breakdown Accordion */}
        {auditData && (
          <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowFormula(!showFormula)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50/60 hover:bg-slate-100/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Auditable Stock Formula</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span>{showFormula ? 'Hide' : 'Explain math'}</span>
                {showFormula ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {showFormula && (
              <div className="p-3.5 text-xs border-t border-slate-100 space-y-2 bg-white">
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div className="flex justify-between p-2 bg-slate-50 rounded-lg">
                    <span>Opening Stock:</span>
                    <strong className="text-slate-800">{auditData.openingStock}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-emerald-50/60 rounded-lg">
                    <span className="text-emerald-900">+ Purchases:</span>
                    <strong className="text-emerald-700">+{auditData.purchases}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-blue-50/60 rounded-lg">
                    <span className="text-blue-900">+ Returns:</span>
                    <strong className="text-blue-700">+{auditData.returns}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-amber-50/60 rounded-lg">
                    <span className="text-amber-900">+ Positive Adj:</span>
                    <strong className="text-amber-700">+{auditData.positiveAdjustments}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-rose-50/60 rounded-lg">
                    <span className="text-rose-900">- Sales:</span>
                    <strong className="text-rose-700">-{auditData.sales}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-rose-50/60 rounded-lg">
                    <span className="text-rose-900">- Negative Adj:</span>
                    <strong className="text-rose-700">-{auditData.negativeAdjustments}</strong>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-100/80 rounded-xl flex items-center justify-between font-bold text-slate-800 pt-2">
                  <span>Calculated Expected Stock:</span>
                  <span className="text-sm font-black text-blue-700">
                    {auditData.calculatedStock} units
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Movement History List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Movement History ({movementList.length})
            </h4>
          </div>

          {movementList.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-500">No stock movements recorded yet.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sales, restocks, and adjustments will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[380px] overflow-y-auto">
              {movementList.map((m) => {
                const meta = getMovementMeta(m);
                return (
                  <div key={m.id} className="p-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-black ${meta.color}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(m.createdAt)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 block">
                          {meta.qtyDisplay}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                      <span className="truncate pr-2">
                        {m.note || m.notes || m.referenceId || 'Stock update'}
                      </span>
                      <span className="font-semibold text-slate-600 shrink-0">
                        Stock: {m.previousStock} →{' '}
                        <span className="font-bold text-slate-900">{m.newStock}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
        >
          Close History
        </button>
      </div>
    </Modal>
  );
};
