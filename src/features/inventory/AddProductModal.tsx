import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { inventoryService } from '../../services/inventoryService';
import { brandService } from '../../services/brandService';
import { useCategories } from '../../hooks/useCategories';
import { useBrands } from '../../hooks/useBrands';
import { getCategoryEmoji } from '../../constants/categoryIcons';
import { generateId } from '../../lib/utils';
import type { PriceVariant } from '../../types';
import { Plus, X, Star, Trash2, Layers } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultCategoryId?: string;
  defaultBrandId?: string;
}

interface CustomVariantFormItem {
  id: string;
  name: string;
  price: string;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCategoryId,
  defaultBrandId,
  }) => {
  const { categories } = useCategories({ activeOnly: true });

  const [name, setName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [mrp, setMrp] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [stock, setStock] = useState<string>('20');
  const [minStock, setMinStock] = useState<string>('5');
  const [isFavorite, setIsFavorite] = useState(false);
  const [sku, setSku] = useState<string>('');
  const [barcode, setBarcode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customizable Variants State
  const [customVariants, setCustomVariants] = useState<CustomVariantFormItem[]>([]);

  // Inline Add Brand state (Section 8: preserve entered product fields, create brand inline)
  const [isCreatingBrandInline, setIsCreatingBrandInline] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [isSubmittingBrand, setIsSubmittingBrand] = useState(false);

  // Brands for currently selected category
  const { brands: categoryBrands } = useBrands(selectedCategoryId || undefined, { activeOnly: true });

  // Initialize or reset category when modal opens
  useEffect(() => {
    if (isOpen) {
      if (defaultCategoryId) {
        setSelectedCategoryId(defaultCategoryId);
      } else if (categories.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(categories[0].id);
      }
      if (defaultBrandId) {
        setSelectedBrandId(defaultBrandId);
      }
    }
  }, [isOpen, defaultCategoryId, defaultBrandId, categories]);

  // When selectedCategoryId changes, clear selectedBrandId if it doesn't belong to new category
  useEffect(() => {
    if (selectedBrandId && categoryBrands.length > 0) {
      const exists = categoryBrands.some((b) => b.id === selectedBrandId);
      if (!exists) setSelectedBrandId('');
    } else if (categoryBrands.length === 0) {
      setSelectedBrandId('');
    }
  }, [selectedCategoryId, categoryBrands]);

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
        price: '',
      },
    ]);
  };

  const handleRemoveCustomVariant = (id: string) => {
    setCustomVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleUpdateCustomVariant = (id: string, field: 'name' | 'price', value: string) => {
    setCustomVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sellingPrice || isSubmitting) return;

    try {
      console.info('[diag][add-product] submit:start', {
        name: name.trim(),
        selectedCategoryId: selectedCategoryId || null,
        selectedBrandId: selectedBrandId || null,
      });
      setIsSubmitting(true);
      const sell = parseFloat(sellingPrice) || 0;
      const mrpVal = parseFloat(mrp) || sell;
      const cost = parseFloat(costPrice) || Math.round(sell * 0.8);
      const initialStock = parseInt(stock, 10) || 0;
      const minimumStock = parseInt(minStock, 10) || 5;
      console.info('[diag][add-product] validation:complete', {
        sell,
        mrpVal,
        cost,
        initialStock,
        minimumStock,
      });

      const selectedCat = categories.find((c) => c.id === selectedCategoryId);

      // Customizable price variants
      const customPriceVariants: PriceVariant[] = customVariants
        .filter((v) => v.name.trim() && v.price)
        .map((v) => {
          const vPrice = parseFloat(v.price) || sell;
          return {
            id: v.id || generateId('pv'),
            name: v.name.trim(),
            price: vPrice,
            sellingPrice: vPrice,
            costPrice: cost,
            isDefault: false,
            type: 'custom',
          };
        });

      await inventoryService.addProduct({
        name: name.trim(),
        categoryId: selectedCategoryId || null,
        brandId: selectedBrandId || null,
        category: selectedCat ? selectedCat.name : 'Others',
        sellingPrice: sell,
        mrp: mrpVal,
        costPrice: cost,
        priceVariants: customPriceVariants,
        stock: initialStock,
        minStock: minimumStock,
        isFavorite,
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        active: true,
      });

      // Reset
      setName('');
      setSellingPrice('');
      setMrp('');
      setCostPrice('');
      setCustomVariants([]);
      setStock('20');
      setMinStock('5');
      setIsFavorite(false);
      setSku('');
      setBarcode('');
      setIsCreatingBrandInline(false);
      onSuccess?.();
      onClose();
      console.info('[diag][add-product] submit:success');
    } catch (err) {
      console.error('Failed to add product', err);
      alert('Error creating product. Please try again.');
    } finally {
      setIsSubmitting(false);
      console.info('[diag][add-product] submit:finished');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Product"
      subtitle="Organize item by Category and Optional Brand"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Product Name (Required) */}
        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            Product Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Gold Flake Kings, Coke 250ml"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Category Selector (Section 8) */}
        <div>
          <label className="block text-xs font-black text-slate-700 mb-1">
            Category *
          </label>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {getCategoryEmoji(cat.icon)} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Optional Brand Section (Section 8: Brand is OPTIONAL. If category has brands, show Brand field. Allow inline add brand) */}
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

          {/* Inline Add Brand Box */}
          {isCreatingBrandInline ? (
            <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-blue-900">
                  New Brand for Selected Category
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
                  placeholder="e.g. Gold Flake, Classic"
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
              <div className="px-3 py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 flex items-center justify-between">
                <span>No brands defined in this category. (Product will belong to Category only)</span>
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
              step="1"
              placeholder="e.g. 18"
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
              step="1"
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
              required
              min="0"
              step="1"
              placeholder="e.g. 15"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Price Variants Section */}
        {(() => {
          const sellVal = parseFloat(sellingPrice) || 0;
          const mrpVal = parseFloat(mrp) || sellVal;
          const isDual = sellVal !== mrpVal;
          const totalVariantCount = (isDual ? 2 : 1) + customVariants.length;

          return (
            <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-slate-800">
                    Price Variants ({totalVariantCount})
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

              {/* Built-in Variants */}
              <div className="space-y-1.5">
                {isDual ? (
                  <>
                    <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          Option 1
                        </span>
                        <span className="text-xs font-bold text-slate-800">Selling Price</span>
                      </div>
                      <span className="text-xs font-extrabold text-blue-700">₹{sellVal}</span>
                    </div>

                    <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                          Option 2
                        </span>
                        <span className="text-xs font-bold text-slate-800">MRP</span>
                      </div>
                      <span className="text-xs font-extrabold text-purple-700">₹{mrpVal}</span>
                    </div>
                  </>
                ) : (
                  <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                        Base
                      </span>
                      <span className="text-xs font-bold text-slate-800">Selling Price & MRP (Equal)</span>
                    </div>
                    <span className="text-xs font-extrabold text-blue-700">₹{sellVal}</span>
                  </div>
                )}
              </div>

              {/* Custom Variants */}
              {customVariants.map((v, i) => (
                <div key={v.id} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500">
                      Custom Variant #{i + 1}
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

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        placeholder="e.g. Wholesale, Loose, Pack of 5"
                        value={v.name}
                        onChange={(e) => handleUpdateCustomVariant(v.id, 'name', e.target.value)}
                        className="w-full h-8 px-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Price (₹)"
                        value={v.price}
                        onChange={(e) => handleUpdateCustomVariant(v.id, 'price', e.target.value)}
                        className="w-full h-8 px-2 text-xs font-bold text-blue-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Stock & Minimum Stock */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">
              Opening Stock *
            </label>
            <input
              type="number"
              required
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">
              Minimum Stock Alert *
            </label>
            <input
              type="number"
              required
              min="0"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Favorite Switch (Section 21) */}
        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2">
            <Star className={`w-4 h-4 ${isFavorite ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
            <div>
              <span className="text-xs font-bold text-slate-800 block leading-tight">
                Quick Favorite
              </span>
              <span className="text-[10px] text-slate-400">
                Pin to the top of Quick Sale screen
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

        {/* Optional SKU & Barcode */}
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
              placeholder="e.g. 890123456"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !sellingPrice}
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
