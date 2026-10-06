import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Product, CartItem } from '../types';
import { CartContext } from './cartTypes';

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

  const addToCart = useCallback((product: Product) => {
    // Subtle tactile haptic feedback on Android if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(30);
      } catch {
        // ignore
      }
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);

      // Check stock limit
      if (product.stock <= 0) {
        showStockNotice(`Only 0 available`);
        return prev;
      }

      if (existing) {
        if (existing.quantity >= product.stock) {
          showStockNotice(`Only ${product.stock} available`);
          return prev;
        }

        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      // First addition
      return [...prev, { product, quantity: 1 }];
    });
  }, [showStockNotice]);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      const target = prev.find((item) => item.product.id === productId);
      if (!target) return prev;

      if (delta > 0) {
        if (target.quantity >= target.product.stock) {
          showStockNotice(`Only ${target.product.stock} available`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      if (delta < 0) {
        if (target.quantity <= 1) {
          // Remove if reduced below 1
          return prev.filter((item) => item.product.id !== productId);
        }
        return prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }

      return prev;
    });
  }, [showStockNotice]);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const restoreCart = useCallback((items: CartItem[]) => {
    setCart(items);
  }, []);

  // Single source of truth calculation: quantity * sellingPrice
  const subtotal = cart.reduce(
    (sum, item) => sum + Math.round(item.product.sellingPrice * item.quantity),
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
