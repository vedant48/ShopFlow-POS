import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PriceVariant } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount || 0);
  return `₹${formatted}`;
}

export function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${timeStr}`;
    }

    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${timeStr}`;
  } catch {
    return dateStr;
  }
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function generateSaleNumber(sequence: number): string {
  return `#${1000 + sequence}`;
}

/**
 * Resolves the effective price variants for a product:
 * - If sellingPrice !== mrp:
 *   1. Selling Price variant
 *   2. MRP variant
 *   followed by any customizable variants.
 * - If sellingPrice === mrp:
 *   Selling price and MRP are counted as one variant, followed by customizable variants.
 */
export function getProductVariants(product: {
  id: string;
  sellingPrice: number;
  mrp?: number;
  priceVariants?: PriceVariant[];
}): PriceVariant[] {
  const sellPrice = product.sellingPrice;
  const mrpPrice = product.mrp !== undefined && product.mrp !== null ? product.mrp : product.sellingPrice;
  const variants: PriceVariant[] = [];

  if (sellPrice !== mrpPrice) {
    // 1. Selling price
    variants.push({
      id: `${product.id}_sp`,
      name: 'Selling Price',
      price: sellPrice,
      sellingPrice: sellPrice,
      isDefault: true,
      type: 'selling_price',
    });
    // 2. MRP
    variants.push({
      id: `${product.id}_mrp`,
      name: 'MRP',
      price: mrpPrice,
      sellingPrice: mrpPrice,
      isDefault: false,
      type: 'mrp',
    });
  } else {
    // Both counted as one variant
    variants.push({
      id: `${product.id}_sp`,
      name: 'Selling Price (MRP)',
      price: sellPrice,
      sellingPrice: sellPrice,
      isDefault: true,
      type: 'selling_price',
    });
  }

  // Followed by customizable variants
  if (product.priceVariants && product.priceVariants.length > 0) {
    for (const v of product.priceVariants) {
      if (
        v.type === 'selling_price' ||
        v.type === 'mrp' ||
        v.id === `${product.id}_sp` ||
        v.id === `${product.id}_mrp` ||
        v.id === `pv_${product.id}_def` ||
        v.isDefault ||
        (v.name.trim().toLowerCase() === 'standard' && (v.price === undefined || v.price === sellPrice || v.sellingPrice === sellPrice))
      ) {
        continue;
      }
      const p = v.price !== undefined ? v.price : (v.sellingPrice ?? sellPrice);
      variants.push({
        id: v.id || generateId('pv'),
        name: v.name,
        price: p,
        sellingPrice: p,
        isDefault: false,
        type: 'custom',
      });
    }
  }

  return variants;
}
