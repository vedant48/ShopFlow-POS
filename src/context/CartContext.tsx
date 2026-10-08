import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Product, CartItem, PriceVariant } from '../types';
import { CartContext } from './cartTypes';
import { getProductVariants } from '../lib/utils';

const CART_SESSION_KEY = 'shopflow_active_cart_v1';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = sessionStorage.getItem(CART_SESSION_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [stockNotice, setStockNotice] = useState<string | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      if (cart.length > 0) {
        sessionStorage.setItem(CART_SESSION_KEY, JSON.stringify(cart));
      } else {
        sessionStorage.removeItem(CART_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }, [cart]);

  const showStockNotice = useCallback((message: string) => {
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    setStockNotice(message);
    noticeTimeoutRef.current = window.setTimeout(() => {
      setStockNotice(null);
      noticeTimeoutRef.current = null;
    }, 2500);
  }, []);

  const addToCart = useCallback((product: Product, variant?: PriceVariant) => {
    // Subtle tactile haptic feedback on Android if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(30);
      } catch {
        // ignore
      }
    }

    // If no variant passed, use primary variant (Selling Price)
    const effectiveVariant = variant || getProductVariants(product)[0];

    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          (effectiveVariant ? item.selectedVariant?.id === effectiveVariant.id : !item.selectedVariant)
      );

      // Check stock limit
      if (product.stock <= 0) {
        showStockNotice(`Only 0 available`);
        return prev;
      }

      // Check total quantity of this product across all variants in cart
      const totalProductInCart = prev
        .filter((item) => item.product.id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (totalProductInCart >= product.stock) {
        showStockNotice(`Only ${product.stock} available`);
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item === existing
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      // First addition
      return [...prev, { product, quantity: 1, selectedVariant: effectiveVariant }];
    });
  }, [showStockNotice]);

  const updateQuantity = useCallback((productId: string, delta: number, variantId?: string) => {
    setCart((prev) => {
      const target = prev.find(
        (item) =>
          item.product.id === productId &&
          (variantId ? item.selectedVariant?.id === variantId : true)
      );
      if (!target) return prev;

      if (delta > 0) {
        const totalProductInCart = prev
          .filter((item) => item.product.id === productId)
          .reduce((sum, item) => sum + item.quantity, 0);

        if (totalProductInCart >= target.product.stock) {
          showStockNotice(`Only ${target.product.stock} available`);
          return prev;
        }
        return prev.map((item) =>
          item === target
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      if (delta < 0) {
        if (target.quantity <= 1) {
          // Remove if reduced below 1
          return prev.filter((item) => item !== target);
        }
        return prev.map((item) =>
          item === target
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }

      return prev;
    });
  }, [showStockNotice]);

  const removeItem = useCallback((productId: string, variantId?: string) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          !(item.product.id === productId && (variantId ? item.selectedVariant?.id === variantId : true))
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const restoreCart = useCallback((items: CartItem[]) => {
    setCart(items);
  }, []);

  // Single source of truth calculation: quantity * (variant price or product sellingPrice)
  const subtotal = cart.reduce(
    (sum, item) => {
      const price = item.selectedVariant?.price ?? item.selectedVariant?.sellingPrice ?? item.product.sellingPrice;
      return sum + Math.round(price * item.quantity);
    },
    0
  );

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        restoreCart,
        subtotal,
        totalItems,
        stockNotice,
        dismissStockNotice: () => setStockNotice(null),
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
