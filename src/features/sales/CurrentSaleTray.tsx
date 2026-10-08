import React from 'react';
import type { CartItem } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Plus, Minus, Trash2, Check, BookOpen, ShoppingBag } from 'lucide-react';

interface CurrentSaleTrayProps {
  cart: CartItem[];
  subtotal: number;
  totalItems: number;
  onUpdateQuantity: (productId: string, delta: number, variantId?: string) => void;
  onRemoveItem: (productId: string, variantId?: string) => void;
  onClearCart: () => void;
  onPaidSale: () => void;
  onUdhaarSale: () => void;
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
  isProcessing = false,
}) => {
  // Empty Cart State
  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 text-center shadow-2xs">
        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
          <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
        </div>
        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
          Start a sale
        </h3>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Tap a product above to add it
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight uppercase">
            Current Sale
          </h2>
          <span className="text-xs font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
            {totalItems}
          </span>
        </div>

        <button
          type="button"
          onClick={onClearCart}
          disabled={isProcessing}
          className="text-xs text-slate-500 hover:text-rose-600 font-semibold px-2 py-1 rounded-lg transition-colors cursor-pointer"
        >
          Clear
        </button>
      </div>

      {/* Cart Items List */}
      <div className="p-3 space-y-2.5 max-h-60 sm:max-h-80 overflow-y-auto overscroll-contain divide-y divide-slate-100">
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
                  <span className="text-sm font-extrabold text-slate-900 truncate">
                    {item.product.name}
                  </span>
                  {isCustomVariant && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      {item.selectedVariant?.name}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block pl-6">
                  {formatCurrency(effectivePrice)} each
                </span>
              </div>

              {/* Stepper with Large (>= 44px) Touch Targets */}
              <div className="flex items-center gap-1 bg-slate-100/90 rounded-2xl p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.product.id, -1, item.selectedVariant?.id)}
                  disabled={isProcessing}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-white hover:bg-slate-200 active:scale-95 text-slate-700 font-black shadow-2xs transition-all cursor-pointer"
                  aria-label={`Decrease ${item.product.name} quantity`}
                >
                  <Minus className="w-4 h-4 stroke-[3]" />
                </button>

                <span className="w-7 text-center text-base font-black text-slate-900 select-none">
                  {item.quantity}
                </span>

                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.product.id, 1, item.selectedVariant?.id)}
                  disabled={isProcessing || item.quantity >= item.product.stock}
                  className={`w-11 h-11 flex items-center justify-center rounded-xl font-black shadow-2xs transition-all cursor-pointer ${
                    item.quantity >= item.product.stock
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white'
                  }`}
                  aria-label={`Increase ${item.product.name} quantity`}
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                </button>
              </div>

              {/* Item Total Price */}
              <div className="text-right min-w-[55px] shrink-0">
                <span className="text-sm font-black text-slate-900 block">
                  {formatCurrency(effectivePrice * item.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.product.id, item.selectedVariant?.id)}
                  className="text-[11px] text-slate-400 hover:text-rose-500 font-medium inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtotal */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-baseline justify-between">
        <span className="text-sm font-extrabold text-slate-600">Subtotal</span>
        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {formatCurrency(subtotal)}
        </span>
      </div>

      {/* Prominent Payment Actions: [ PAID ] and [ UDHAAR ] */}
      <div className="p-3 bg-white grid grid-cols-2 gap-2.5 border-t border-slate-100">
        {/* PAID (Primary Blue CTA) */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={onPaidSale}
          className="h-14 sm:h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg sm:text-xl flex items-center justify-center gap-2 shadow-sm shadow-blue-600/30 tap-press cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Check className="w-6 h-6 stroke-[3]" />
          <span>PAID</span>
        </button>

        {/* UDHAAR (Secondary Contrasting Violet CTA) */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={onUdhaarSale}
          className="h-14 sm:h-16 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-lg sm:text-xl flex items-center justify-center gap-2 shadow-sm shadow-violet-600/30 tap-press cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <BookOpen className="w-5 h-5 stroke-[2.5]" />
          <span>UDHAAR</span>
        </button>
      </div>
    </div>
  );
};
