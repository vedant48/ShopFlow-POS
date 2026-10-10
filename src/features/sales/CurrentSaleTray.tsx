import React from 'react';
import type { CartItem } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Plus, Minus, Trash2, Check, BookOpen, ShoppingBag, Clock, ArrowLeft } from 'lucide-react';

interface CurrentSaleTrayProps {
  cart: CartItem[];
  subtotal: number;
  totalItems: number;
  onUpdateQuantity: (productId: string, delta: number, variantId?: string) => void;
  onRemoveItem: (productId: string, variantId?: string) => void;
  onClearCart: () => void;
  onPaidSale: () => void;
  onUdhaarSale: () => void;
  onHoldOrder?: () => void;
  activeEditingOrderName?: string | null;
  onSaveAndReturnOrder?: () => void;
  isProcessing?: boolean;
}

export const CurrentSaleTray: React.FC<CurrentSaleTrayProps> = ({
  cart,
  subtotal,
  totalItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onPaidSale,
  onUdhaarSale,
  onHoldOrder,
  activeEditingOrderName,
  onSaveAndReturnOrder,
  isProcessing = false,
}) => {
  // Empty Cart State
  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center mx-auto mb-2.5">
          <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-[#1d1d1f] leading-snug apple-tight">
          Current Sale Empty
        </h3>
        <p className="text-xs text-[#86868b] font-normal mt-0.5">
          Tap items above to add to cart
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-2xs flex flex-col overflow-hidden">
      {/* Header */}
      {activeEditingOrderName ? (
        <div className="px-4 py-2.5 bg-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <h2 className="text-xs font-semibold tracking-tight uppercase apple-tight">
              Adding to: {activeEditingOrderName}
            </h2>
          </div>
          {onSaveAndReturnOrder && (
            <button
              type="button"
              onClick={onSaveAndReturnOrder}
              className="text-xs font-semibold text-white bg-amber-700/60 hover:bg-amber-700 px-3 py-1 rounded-full transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Done</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 bg-[#f5f5f7]/60 border-b border-[#e5e5ea]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
            <h2 className="text-xs font-semibold text-[#1d1d1f] tracking-wider uppercase apple-tight">
              Current Sale
            </h2>
            <span className="text-xs font-medium text-[#1d1d1f] bg-[#e5e5ea] px-2 py-0.5 rounded-full">
              {totalItems}
            </span>
          </div>

          <button
            type="button"
            onClick={onClearCart}
            disabled={isProcessing}
            className="text-xs text-[#86868b] hover:text-rose-600 font-medium px-2 py-1 rounded-full transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Cart Items List */}
      <div className="p-3 space-y-2.5 max-h-60 sm:max-h-80 overflow-y-auto overscroll-contain divide-y divide-[#f5f5f7]">
        {cart.map((item) => {
          const itemKey = `${item.product.id}_${item.selectedVariant?.id || 'base'}`;
          const effectivePrice = item.selectedVariant?.price ?? item.selectedVariant?.sellingPrice ?? item.product.sellingPrice;
          const isCustomVariant = item.selectedVariant && !item.selectedVariant.isDefault;

          return (
            <div
              key={itemKey}
              className="pt-2 first:pt-0 flex items-center justify-between gap-2"
            >
              {/* Product Name and Rate */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base select-none">{item.product.emoji}</span>
                  <span className="text-sm font-semibold text-[#1d1d1f] truncate apple-tight">
                    {item.product.name}
                  </span>
                  {isCustomVariant && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                      {item.selectedVariant?.name}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-normal text-[#86868b] block pl-6">
                  {formatCurrency(effectivePrice)} each
                </span>
              </div>

              {/* Stepper with Large (>= 44px) Touch Targets */}
              <div className="flex items-center gap-1 bg-[#f5f5f7] rounded-full p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.product.id, -1, item.selectedVariant?.id)}
                  disabled={isProcessing}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-[#e5e5ea] active:scale-95 text-[#1d1d1f] font-bold shadow-2xs transition-all cursor-pointer border border-[#e5e5ea]"
                  aria-label={`Decrease ${item.product.name} quantity`}
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>

                <span className="w-7 text-center text-sm font-semibold text-[#1d1d1f] select-none apple-tight">
                  {item.quantity}
                </span>

                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.product.id, 1, item.selectedVariant?.id)}
                  disabled={isProcessing || item.quantity >= item.product.stock}
                  className={`w-10 h-10 flex items-center justify-center rounded-full font-bold shadow-2xs transition-all cursor-pointer ${
                    item.quantity >= item.product.stock
                      ? 'bg-[#e5e5ea] text-[#86868b] cursor-not-allowed'
                      : 'bg-[#0066cc] hover:bg-[#0055b3] active:scale-95 text-white'
                  }`}
                  aria-label={`Increase ${item.product.name} quantity`}
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Item Total Price */}
              <div className="text-right min-w-[55px] shrink-0">
                <span className="text-sm font-semibold text-[#1d1d1f] block apple-tight">
                  {formatCurrency(effectivePrice * item.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.product.id, item.selectedVariant?.id)}
                  className="text-[11px] text-[#86868b] hover:text-rose-500 font-normal inline-flex items-center gap-0.5 mt-0.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtotal */}
      <div className="px-4 py-3 bg-[#f5f5f7]/60 border-t border-[#e5e5ea] flex items-baseline justify-between">
        <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">Subtotal</span>
        <span className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] apple-tight tracking-tight">
          {formatCurrency(subtotal)}
        </span>
      </div>

      {/* Actions: Normal (PAID, UDHAAR, HOLD) vs Editing Order (SAVE & RETURN) */}
      {activeEditingOrderName ? (
        <div className="p-3 bg-white space-y-2 border-t border-[#e5e5ea]">
          <button
            type="button"
            onClick={onSaveAndReturnOrder}
            className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>SAVE & RETURN TO TIMELINE</span>
          </button>
        </div>
      ) : (
        <div className="p-3 bg-white space-y-2 border-t border-[#e5e5ea]">
          <div className="grid grid-cols-2 gap-2">
            {/* PAID (Primary Apple Blue CTA) */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={onPaidSale}
              className="h-12 rounded-full bg-[#0066cc] hover:bg-[#0055b3] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>PAID</span>
            </button>

            {/* UDHAAR (Secondary Contrasting Violet CTA) */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={onUdhaarSale}
              className="h-12 rounded-full bg-[#5856d6] hover:bg-[#4745b8] text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <BookOpen className="w-4 h-4 stroke-[2]" />
              <span>UDHAAR</span>
            </button>
          </div>

          {/* HOLD ORDER (Pill Action) */}
          {onHoldOrder && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={onHoldOrder}
              className="w-full h-10 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] border border-[#e5e5ea] font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
            >
              <Clock className="w-3.5 h-3.5 text-[#86868b]" />
              <span>HOLD ORDER (TIMELINE)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
