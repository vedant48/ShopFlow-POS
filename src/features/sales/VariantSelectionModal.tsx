import React from 'react';
import { Modal } from '../../components/Modal';
import { formatCurrency, getProductVariants } from '../../lib/utils';
import type { Product, PriceVariant } from '../../types';
import { Plus } from 'lucide-react';

interface VariantSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSelectVariant: (product: Product, variant: PriceVariant) => void;
}

export const VariantSelectionModal: React.FC<VariantSelectionModalProps> = ({
  isOpen,
  onClose,
  product,
  onSelectVariant,
}) => {
  if (!product) return null;

  const variants = getProductVariants(product);

  const handleSelect = (variant: PriceVariant) => {
    onSelectVariant(product, variant);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product.name}
      subtitle="Select price option (Selling Price, MRP, or Custom Variant)"
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
          <span>Available Price Options ({variants.length})</span>
          <span>Stock: {product.stock}</span>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto overscroll-contain">
          {variants.map((variant) => {
            const isMrp = variant.type === 'mrp';
            const isSellingPrice = variant.type === 'selling_price';
            const price = variant.price ?? variant.sellingPrice ?? product.sellingPrice;

            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => handleSelect(variant)}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition-all flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.98] group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm group-hover:text-blue-700">
                      {variant.name}
                    </span>
                    {variant.isDefault && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                        Default
                      </span>
                    )}
                    {isMrp && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">
                        Printed MRP
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base font-black text-blue-600">
                      {formatCurrency(price)}
                    </span>
                    {isSellingPrice && product.mrp && product.mrp > price && (
                      <span className="text-xs font-semibold text-slate-400 line-through">
                        MRP {formatCurrency(product.mrp)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-9 h-9 rounded-xl bg-white group-hover:bg-blue-600 group-hover:text-white border border-slate-200 group-hover:border-blue-600 flex items-center justify-center text-slate-700 transition-colors shadow-2xs shrink-0">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
