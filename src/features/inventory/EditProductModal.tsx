import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { inventoryService } from '../../services/inventoryService';
import { brandService } from '../../services/brandService';
import { useCategories } from '../../hooks/useCategories';
import { useBrands } from '../../hooks/useBrands';
import { getCategoryEmoji } from '../../constants/categoryIcons';
import type { Product, PriceVariant } from '../../types';
import { generateId } from '../../lib/utils';
import { Archive, ArchiveRestore, Star, Plus, X, Layers, Trash2 } from 'lucide-react';

interface EditProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface EditFormProps {
  product: Product;
  onClose: () => void;
  onSuccess?: () => void;
}

interface CustomVariantFormItem {
  id: string;
  name: string;
  sellingPrice: string;
  mrp: string;
}

const EditForm: React.FC<EditFormProps> = ({ product, onClose, onSuccess }) => {
  const { categories } = useCategories({ activeOnly: true });

  const defaultVariant = product.priceVariants?.find((v) => v.isDefault) || product.priceVariants?.[0];

  const [name, setName] = useState(product.name);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(product.categoryId || '');
  const [selectedBrandId, setSelectedBrandId] = useState<string>(product.brandId || '');
  const [sellingPrice, setSellingPrice] = useState<string>(product.sellingPrice.toString());
  const [mrp, setMrp] = useState<string>((product.mrp ?? defaultVariant?.mrp ?? product.sellingPrice).toString());
  const [costPrice, setCostPrice] = useState<string>((product.costPrice || 0).toString());
  const [stock, setStock] = useState<string>(product.stock.toString());
  const [minStock, setMinStock] = useState<string>(product.minStock.toString());
  const [isFavorite, setIsFavorite] = useState(product.isFavorite === true);
  const [sku, setSku] = useState<string>(product.sku || '');
  const [barcode, setBarcode] = useState<string>(product.barcode || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Price Variants State
  const [baseVariantName, setBaseVariantName] = useState(defaultVariant?.name || 'Standard');
  const [customVariants, setCustomVariants] = useState<CustomVariantFormItem[]>(() => {
    return (product.priceVariants || [])
      .filter((v) => v.id !== defaultVariant?.id)
      .map((v) => ({
        id: v.id,
        name: v.name,
        sellingPrice: v.sellingPrice.toString(),
        mrp: (v.mrp ?? v.sellingPrice).toString(),
      }));
  });

  // Inline brand creation
  const [isCreatingBrandInline, setIsCreatingBrandInline] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [isSubmittingBrand, setIsSubmittingBrand] = useState(false);

  // Brands for selected category
  const { brands: categoryBrands } = useBrands(selectedCategoryId || undefined, { activeOnly: true });

  // Initialize category if not set
  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      // Try to find matching category by name
      const matched = categories.find(
        (c) => c.name.toLowerCase() === (product.category || '').toLowerCase()
      );
      if (matched) {
        setSelectedCategoryId(matched.id);
      } else {
        setSelectedCategoryId(categories[0].id);
      }
    }
  }, [categories, product, selectedCategoryId]);

  const handleCreateBrandInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim() || !selectedCategoryId || isSubmittingBrand) return;

    try {
      setIsSubmittingBrand(true);
      const created = await brandService.createBrand({
        categoryId: selectedCategoryId,
        name: newBrandName.trim(),
      });
      setSelectedBrandId(created.id);
      setNewBrandName('');
      setIsCreatingBrandInline(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to create brand');
    } finally {
      setIsSubmittingBrand(false);
    }
  };

  const handleAddCustomVariant = () => {
    setCustomVariants((prev) => [
      ...prev,
      {
        id: generateId('pv'),
        name: '',
        sellingPrice: '',
        mrp: '',
      },
    ]);
  };

  const handleRemoveCustomVariant = (id: string) => {
    setCustomVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleUpdateCustomVariant = (id: string, field: 'name' | 'sellingPrice' | 'mrp', value: string) => {
    setCustomVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sellingPrice || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const selectedCat = categories.find((c) => c.id === selectedCategoryId);
      const sell = parseFloat(sellingPrice) || 0;
      const mrpVal = parseFloat(mrp) || sell;
      const cost = parseFloat(costPrice) || 0;

      // Construct all variants: Base (always present) + customized variants
      const allVariants: PriceVariant[] = [
        {
          id: defaultVariant?.id || generateId('pv'),
          name: baseVariantName.trim() || 'Standard',
          sellingPrice: sell,
          mrp: mrpVal,
          costPrice: cost,
          isDefault: true,
        },
        ...customVariants
          .filter((v) => v.name.trim() && v.sellingPrice)
          .map((v) => {
            const vSell = parseFloat(v.sellingPrice) || sell;
            return {
              id: v.id || generateId('pv'),
              name: v.name.trim(),
              sellingPrice: vSell,
              mrp: parseFloat(v.mrp) || vSell,
              costPrice: cost,
              isDefault: false,
            };
          }),
      ];

      await inventoryService.updateProduct(product.id, {
        name: name.trim(),
        categoryId: selectedCategoryId || null,
        brandId: selectedBrandId || null,
        category: selectedCat ? selectedCat.name : product.category,
        sellingPrice: sell,
        mrp: mrpVal,
        costPrice: cost,
        priceVariants: allVariants,
        stock: parseInt(stock, 10) || 0,
        minStock: parseInt(minStock, 10) || 5,
        isFavorite,
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to update product', err);
      alert('Error updating product: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchive = async () => {
    const isArchived = product.active === false;
    const msg = isArchived
      ? `Restore "${product.name}" back to active inventory?`
      : `Archive "${product.name}"? It will be hidden from Quick Sale but preserved in sales and inventory history.`;

    if (window.confirm(msg)) {
      try {
        if (isArchived) {
          await inventoryService.unarchiveProduct(product.id);
        } else {
          await inventoryService.archiveProduct(product.id);
        }
        onSuccess?.();
        onClose();
      } catch (err) {
        console.error('Failed to update archive status', err);
      }
    }
  };

  const isArchived = product.active === false;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Name */}
      <div>
        <label className="block text-xs font-black text-slate-700 mb-1">
          Product Name *
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category Selection */}
      <div>
        <label className="block text-xs font-black text-slate-700 mb-1">
          Category *
        </label>
        <select
          value={selectedCategoryId}
          onChange={(e) => {
            setSelectedCategoryId(e.target.value);
            setSelectedBrandId('');
          }}
          className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {getCategoryEmoji(cat.icon)} {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Brand Selection (Optional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-black text-slate-700">
            Brand / Subcategory <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          {!isCreatingBrandInline && (
            <button
              type="button"
              onClick={() => setIsCreatingBrandInline(true)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Brand</span>
            </button>
          )}
        </div>

        {isCreatingBrandInline ? (
          <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-blue-900">
                New Brand for Category
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingBrandInline(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Brand Name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={!newBrandName.trim() || isSubmittingBrand}
                onClick={handleCreateBrandInline}
                className="px-3 h-9 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingBrand ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        ) : (
          categoryBrands.length > 0 ? (
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- No Brand (Direct Product) --</option>
              {categoryBrands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
              No brands in this category. (Product belongs to Category directly)
            </div>
          )
        )}
      </div>

      {/* Pricing: Selling Price, MRP, and Cost Price */}
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            Selling (₹) *
          </label>
          <input
            type="number"
            required
            min="0"
            step="any"
            value={sellingPrice}
            onChange={(e) => {
              const val = e.target.value;
              if (!mrp || mrp === sellingPrice) setMrp(val);
              setSellingPrice(val);
            }}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            MRP (₹)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 20"
            value={mrp}
            onChange={(e) => setMrp(e.target.value)}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            Cost (₹) *
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Price Variants Section */}
      <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-black text-slate-800">
              Price Variants ({1 + customVariants.length})
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddCustomVariant}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer bg-white border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variant</span>
          </button>
        </div>

        {/* Base Variant (Always Present) */}
        <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
              Default
            </span>
            <input
              type="text"
              value={baseVariantName}
              onChange={(e) => setBaseVariantName(e.target.value)}
              placeholder="Standard / Regular"
              className="text-xs font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 flex-1 min-w-[70px]"
            />
          </div>
          <div className="flex items-center gap-3 text-xs shrink-0">
            <span className="font-extrabold text-blue-700">
              Selling: ₹{sellingPrice || 0}
            </span>
            <span className="text-slate-500 font-semibold">
              MRP: ₹{mrp || sellingPrice || 0}
            </span>
          </div>
        </div>

        {/* Custom Added Variants */}
        {customVariants.map((v, i) => (
          <div key={v.id} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500">
                Variant #{i + 2}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveCustomVariant(v.id)}
                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                title="Remove variant"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Half / Packet"
                  value={v.name}
                  onChange={(e) => handleUpdateCustomVariant(v.id, 'name', e.target.value)}
                  className="w-full h-8 px-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Selling (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Selling"
                  value={v.sellingPrice}
                  onChange={(e) => handleUpdateCustomVariant(v.id, 'sellingPrice', e.target.value)}
                  className="w-full h-8 px-2 text-xs font-black text-blue-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">MRP (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="MRP"
                  value={v.mrp}
                  onChange={(e) => handleUpdateCustomVariant(v.id, 'mrp', e.target.value)}
                  className="w-full h-8 px-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stock & Min Stock Alert */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            Current Stock
          </label>
          <input
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            Min Stock Alert
          </label>
          <input
            type="number"
            min="0"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Favorite Toggle */}
      <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center gap-2">
          <Star className={`w-4 h-4 ${isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
          <div>
            <span className="text-xs font-bold text-slate-800 block leading-tight">
              Quick Favorite
            </span>
            <span className="text-[10px] text-slate-400">
              Pin to Quick Sale favorites
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsFavorite(!isFavorite)}
          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
            isFavorite ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
        </button>
      </div>

      {/* SKU & Barcode (Optional) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            SKU (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. COKE-250"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            Barcode (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. 8901030383821"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2 gap-2">
        <button
          type="button"
          onClick={handleToggleArchive}
          className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
            isArchived
              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          {isArchived ? (
            <>
              <ArchiveRestore className="w-4 h-4" />
              <span>Restore</span>
            </>
          ) : (
            <>
              <Archive className="w-4 h-4" />
              <span>Archive</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !sellingPrice}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
};

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Product"
      subtitle={`Update details for ${product.name}`}
    >
      <EditForm
        key={product.id}
        product={product}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  );
};
