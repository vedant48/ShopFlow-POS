import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { inventoryService } from '../../services/inventoryService';
import { formatCurrency } from '../../lib/utils';
import type { Product } from '../../types';
import { ArrowUp, ArrowDown, Package, Check } from 'lucide-react';

interface ProductReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  title?: string;
  subtitle?: string;
  onOrderChanged?: () => void;
}

export const ProductReorderModal: React.FC<ProductReorderModalProps> = ({
  isOpen,
  onClose,
  products,
  title = 'Reorder Products',
  subtitle = 'Arrange items in the exact order you want them displayed',
  onOrderChanged,
}) => {
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Sort initially by sortOrder then name
      const sorted = [...products].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
      );
      setOrderedProducts(sorted);
    }
  }, [isOpen, products]);

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedProducts.length) return;

    const updated = [...orderedProducts];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setOrderedProducts(updated);

    try {
      setIsSaving(true);
      await inventoryService.reorderProducts(updated.map((p) => p.id));
      onOrderChanged?.();
    } catch (err) {
      console.error('Failed to reorder products:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
          <span>{orderedProducts.length} Products</span>
          {isSaving && <span className="text-blue-600 animate-pulse">Saving order...</span>}
        </div>

        {orderedProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold">No products to sort</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto overscroll-contain pr-1">
            {orderedProducts.map((product, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === orderedProducts.length - 1;

              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all gap-2"
                >
                  {/* Position Badge & Product Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      <span className="text-sm font-bold text-slate-900 block truncate">
                        {product.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-extrabold text-blue-600">
                          {formatCurrency(product.sellingPrice)}
                        </span>
                        {product.mrp && product.mrp > product.sellingPrice && (
                          <span className="line-through text-slate-400 text-[11px]">
                            MRP {formatCurrency(product.mrp)}
                          </span>
                        )}
                        <span>• Stock: {product.stock}</span>
                      </div>
                    </div>
                  </div>

                  {/* Move Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isFirst || isSaving}
                      onClick={() => handleMove(idx, 'up')}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                      aria-label="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast || isSaving}
                      onClick={() => handleMove(idx, 'down')}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                      aria-label="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
