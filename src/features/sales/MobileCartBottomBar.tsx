import React, { useState } from 'react';
import type { CartItem } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ShoppingBag, ChevronUp, Check, BookOpen, X, Plus, Minus, Trash2, Clock } from 'lucide-react';

interface MobileCartBottomBarProps {
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

export const MobileCartBottomBar: React.FC<MobileCartBottomBarProps> = ({
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
        <div
          className={`max-w-lg mx-auto pointer-events-auto rounded-full p-2 shadow-lg border flex items-center justify-between gap-2 transition-all ${
            activeEditingOrderName
              ? 'bg-amber-500/95 backdrop-blur-xl border-amber-400 text-white shadow-amber-900/20'
              : 'bg-white/95 backdrop-blur-xl border-[#e5e5ea] text-[#1d1d1f] shadow-black/8'
          }`}
        >
          {/* Left: Cart items count & subtotal - Tap opens full itemized cart drawer */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2.5 px-2 py-0.5 hover:bg-black/5 rounded-full transition-colors cursor-pointer text-left min-w-0 flex-1 active:scale-95"
            aria-label="View current cart items"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-2xs ${
                activeEditingOrderName
                  ? 'bg-white/20 text-white'
                  : 'bg-[#0066cc]/10 text-[#0066cc]'
              }`}
            >
              {activeEditingOrderName ? (
                <Clock className="w-4 h-4" />
              ) : (
                <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
              )}
            </div>
            <div className="min-w-0">
              <div
                className={`text-sm font-semibold tracking-tight leading-none truncate apple-tight ${
                  activeEditingOrderName ? 'text-white' : 'text-[#1d1d1f]'
                }`}
              >
                {activeEditingOrderName ? `${activeEditingOrderName}: ` : ''}
                {totalItems} {totalItems === 1 ? 'item' : 'items'} · {formatCurrency(subtotal)}
              </div>
              <span
                className={`text-[10px] font-semibold flex items-center gap-0.5 mt-0.5 ${
                  activeEditingOrderName ? 'text-amber-100' : 'text-[#0066cc]'
                }`}
              >
                <span>VIEW {activeEditingOrderName ? 'TIMELINE' : 'CART'}</span>
                <ChevronUp className="w-3 h-3 stroke-[2.5]" />
              </span>
            </div>
          </button>

          {/* Right: Instant action */}
          {activeEditingOrderName ? (
            <button
              type="button"
              onClick={onSaveAndReturnOrder}
              className="h-9 px-4 rounded-full bg-amber-800 hover:bg-amber-900 active:scale-95 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>DONE</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* PAID CTA */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handlePaid}
                className="h-9 px-4 rounded-full bg-[#0066cc] hover:bg-[#0055b3] active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center gap-1 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>PAID</span>
              </button>

              {/* UDHAAR CTA */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleUdhaar}
                className="h-9 px-3.5 rounded-full bg-[#5856d6] hover:bg-[#4745b8] active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center gap-1 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <BookOpen className="w-3 h-3 stroke-[2]" />
                <span>UDHAAR</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Slide-up Full Cart Drawer (Mobile) */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative bg-white rounded-t-[28px] border-t border-[#e5e5ea] shadow-2xl p-4 max-h-[85vh] flex flex-col z-10 animate-in slide-in-from-bottom duration-200 pb-safe">
            {/* Drag Handle & Header */}
            <div className="w-10 h-1 bg-[#d2d2d7] rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-[#e5e5ea]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
                <h3 className="text-sm font-semibold text-[#1d1d1f] uppercase tracking-wider apple-tight">
                  Current Sale ({totalItems})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearCart}
                  disabled={isProcessing}
                  className="text-xs text-[#86868b] hover:text-rose-600 font-medium px-2 py-1 rounded-full transition-colors cursor-pointer"
                >
                  Clear Cart
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-7 h-7 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#e5e5ea] rounded-full cursor-pointer transition-colors"
                  aria-label="Close cart drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cart Items List with Steppers */}
            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-[#f5f5f7] py-2 space-y-2 max-h-64 sm:max-h-80">
              {cart.map((item) => {
                const itemKey = `${item.product.id}_${item.selectedVariant?.id || 'base'}`;
                const effectivePrice = item.selectedVariant?.price ?? item.selectedVariant?.sellingPrice ?? item.product.sellingPrice;
                const isCustomVariant = item.selectedVariant && !item.selectedVariant.isDefault;

                return (
                  <div
                    key={itemKey}
                    className="pt-2 first:pt-0 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-lg select-none">{item.product.emoji}</span>
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

                    {/* Quantity Stepper (large touch targets) */}
                    <div className="flex items-center gap-1 bg-[#f5f5f7] rounded-full p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.product.id, -1, item.selectedVariant?.id)}
                        disabled={isProcessing}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-[#e5e5ea] active:scale-95 text-[#1d1d1f] font-bold shadow-2xs transition-all cursor-pointer border border-[#e5e5ea]"
                        aria-label={`Decrease ${item.product.name}`}
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <span className="w-7 text-center text-sm font-semibold text-[#1d1d1f] select-none apple-tight">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.product.id, 1, item.selectedVariant?.id)}
                        disabled={isProcessing || item.quantity >= item.product.stock}
                        className={`w-9 h-9 flex items-center justify-center rounded-full font-bold shadow-2xs transition-all cursor-pointer ${
                          item.quantity >= item.product.stock
                            ? 'bg-[#e5e5ea] text-[#86868b] cursor-not-allowed'
                            : 'bg-[#0066cc] hover:bg-[#0055b3] active:scale-95 text-white'
                        }`}
                        aria-label={`Increase ${item.product.name}`}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Item Total & Remove */}
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
            <div className="py-3 px-1 border-t border-[#e5e5ea] flex items-baseline justify-between">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">Total Amount</span>
              <span className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] apple-tight tracking-tight">
                {formatCurrency(subtotal)}
              </span>
            </div>

            {/* Action Buttons: PAID & UDHAAR / HOLD */}
            {activeEditingOrderName ? (
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onSaveAndReturnOrder?.();
                }}
                className="w-full h-12 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>SAVE & RETURN TO TIMELINE</span>
              </button>
            ) : (
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handlePaid}
                    className="h-12 rounded-full bg-[#0066cc] hover:bg-[#0055b3] active:scale-[0.98] text-white font-semibold text-base flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Check className="w-5 h-5 stroke-[2.5]" />
                    <span>PAID</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleUdhaar}
                    className="h-12 rounded-full bg-[#5856d6] hover:bg-[#4745b8] active:scale-[0.98] text-white font-semibold text-base flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 stroke-[2]" />
                    <span>UDHAAR</span>
                  </button>
                </div>

                {onHoldOrder && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onHoldOrder();
                    }}
                    className="w-full h-10 rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] border border-[#e5e5ea] font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#86868b]" />
                    <span>HOLD ORDER (TIMELINE)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
