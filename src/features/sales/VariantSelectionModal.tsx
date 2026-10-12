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
      <div className="space-y-3 pb-safe">
        <div className="flex items-center justify-between text-xs text-[#86868b] font-semibold px-1">
          <span>Available Options ({variants.length})</span>
          <span>Stock: {product.stock}</span>
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto overscroll-contain -mx-1 px-1">
          {variants.map((variant) => {
            const isMrp = variant.type === 'mrp';
            const isSellingPrice = variant.type === 'selling_price';
            const price = variant.price ?? variant.sellingPrice ?? product.sellingPrice;

            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => handleSelect(variant)}
                className="w-full min-h-[52px] p-3.5 rounded-2xl bg-white hover:bg-[#f0f7ff] border border-[#e5e5ea] hover:border-[#0066cc] transition-all flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.98] group shadow-2xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[#1d1d1f] text-sm group-hover:text-[#0066cc] transition-colors apple-tight">
                      {variant.name}
                    </span>
                    {variant.isDefault && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/20">
                        Default
                      </span>
                    )}
                    {isMrp && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#5856d6]/10 text-[#5856d6] border border-[#5856d6]/20">
                        Printed MRP
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-base font-bold text-[#0066cc] apple-tight">
                      {formatCurrency(price)}
                    </span>
                    {isSellingPrice && product.mrp && product.mrp > price && (
                      <span className="text-xs font-normal text-[#86868b] line-through">
                        MRP {formatCurrency(product.mrp)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-[#f5f5f7] group-hover:bg-[#0066cc] group-hover:text-white border border-[#e5e5ea] group-hover:border-[#0066cc] flex items-center justify-center text-[#1d1d1f] transition-all shadow-2xs shrink-0">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
