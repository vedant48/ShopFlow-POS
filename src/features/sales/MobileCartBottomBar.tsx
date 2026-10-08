import React, { useState } from 'react';
import type { CartItem } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ShoppingBag, ChevronUp, Check, BookOpen, X, Plus, Minus, Trash2 } from 'lucide-react';

interface MobileCartBottomBarProps {
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

export const MobileCartBottomBar: React.FC<MobileCartBottomBarProps> = ({
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // If cart is empty, completely hide the bottom bar
  if (totalItems === 0 || cart.length === 0) {
    return null;
  }

  const handlePaid = () => {
    setIsDrawerOpen(false);
    onPaidSale();
  };

  const handleUdhaar = () => {
    setIsDrawerOpen(false);
    onUdhaarSale();
  };

  return (
    <>
      {/* 1. Persistent Compact Floating Bottom Bar (Mobile only, above BottomNav) */}
      <div className="lg:hidden fixed bottom-[4.25rem] left-0 right-0 z-40 px-3 pointer-events-none pb-safe animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="max-w-lg mx-auto pointer-events-auto bg-slate-900 text-white rounded-2xl p-2.5 shadow-2xl border border-slate-700/80 flex items-center justify-between gap-2">
          {/* Left: Cart items count & subtotal - Tap opens full itemized cart drawer */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2.5 px-2 py-1 hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer text-left min-w-0 flex-1 active:scale-95"
            aria-label="View current cart items"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight leading-none text-white truncate">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} · {formatCurrency(subtotal)}
              </div>
              <span className="text-[10px] font-bold text-blue-400 flex items-center gap-0.5 mt-0.5">
                <span>VIEW CART</span>
                <ChevronUp className="w-3 h-3 stroke-[2.5]" />
              </span>
            </div>
          </button>

          {/* Right: Instant 1-tap checkout actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* PAID CTA */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handlePaid}
              className="h-10 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center gap-1 shadow-sm shadow-blue-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>PAID</span>
            </button>

            {/* UDHAAR CTA */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleUdhaar}
              className="h-10 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center gap-1 shadow-sm shadow-violet-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>UDHAAR</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Slide-up Full Cart Drawer (Mobile) */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-4 max-h-[85vh] flex flex-col z-10 animate-in slide-in-from-bottom duration-200 pb-safe">
            {/* Drag Handle & Header */}
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Current Sale ({totalItems})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearCart}
                  disabled={isProcessing}
                  className="text-xs text-slate-500 hover:text-rose-600 font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Clear Cart
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                  aria-label="Close cart drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cart Items List with Steppers */}
            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 py-2 space-y-2 max-h-64 sm:max-h-80">
              {cart.map((item) => {
                const itemKey = `${item.product.id}_${item.selectedVariant?.id || 'base'}`;
                const effectivePrice = item.selectedVariant?.sellingPrice ?? item.product.sellingPrice;
                const isCustomVariant = item.selectedVariant && !item.selectedVariant.isDefault;

                return (
                  <div
                    key={itemKey}
                    className="pt-2 first:pt-0 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-lg select-none">{item.product.emoji}</span>
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

                    {/* Quantity Stepper (large touch targets) */}
                    <div className="flex items-center gap-1 bg-slate-100/90 rounded-2xl p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.product.id, -1, item.selectedVariant?.id)}
                        disabled={isProcessing}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white hover:bg-slate-200 active:scale-95 text-slate-700 font-black shadow-2xs transition-all cursor-pointer"
                        aria-label={`Decrease ${item.product.name}`}
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
                        className={`w-10 h-10 flex items-center justify-center rounded-xl font-black shadow-2xs transition-all cursor-pointer ${
                          item.quantity >= item.product.stock
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white'
                        }`}
                        aria-label={`Increase ${item.product.name}`}
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {/* Item Total & Remove */}
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
            <div className="py-3 px-1 border-t border-slate-100 flex items-baseline justify-between">
              <span className="text-sm font-extrabold text-slate-600">Total Amount</span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {formatCurrency(subtotal)}
              </span>
            </div>

            {/* Action Buttons: PAID & UDHAAR */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handlePaid}
                className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-lg flex items-center justify-center gap-2 shadow-sm shadow-blue-600/30 cursor-pointer"
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>PAID</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleUdhaar}
                className="h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 active:scale-98 text-white font-black text-lg flex items-center justify-center gap-2 shadow-sm shadow-violet-600/30 cursor-pointer"
              >
                <BookOpen className="w-5 h-5 stroke-[2.5]" />
                <span>UDHAAR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
