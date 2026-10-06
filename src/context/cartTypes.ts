import { createContext } from 'react';
import type { Product, CartItem } from '../types';

export interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  restoreCart: (items: CartItem[]) => void;
  subtotal: number;
  totalItems: number;
  stockNotice: string | null;
  dismissStockNotice: () => void;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);
