import { createContext } from 'react';
import type { Product, CartItem, PriceVariant } from '../types';

export interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, variant?: PriceVariant) => void;
  updateQuantity: (productId: string, delta: number, variantId?: string) => void;
  removeItem: (productId: string, variantId?: string) => void;
  clearCart: () => void;
  restoreCart: (items: CartItem[]) => void;
  subtotal: number;
  totalItems: number;
  stockNotice: string | null;
  dismissStockNotice: () => void;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);
