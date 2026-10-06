import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { AddProductModal } from '../features/inventory/AddProductModal';
import { EditProductModal } from '../features/inventory/EditProductModal';
import { AddStockModal } from '../features/inventory/AddStockModal';
import { StockAdjustmentModal } from '../features/inventory/StockAdjustmentModal';
import { ProductHistoryModal } from '../features/inventory/ProductHistoryModal';
import { StockAuditModal } from '../features/inventory/StockAuditModal';
import { PurchasesHistoryModal } from '../features/inventory/PurchasesHistoryModal';
import { CategoryManagementModal } from '../features/inventory/CategoryManagementModal';
import { BrandManagementModal } from '../features/inventory/BrandManagementModal';
import { useCategories } from '../hooks/useCategories';
import { useBrands } from '../hooks/useBrands';
import { getCategoryEmoji } from '../constants/categoryIcons';
import { Badge } from '../components/Badge';
import { formatCurrency } from '../lib/utils';
import type { Product, Category, Brand } from '../types';
import {
  Plus,
  Search,
  AlertTriangle,
  Edit3,
  History,
  Sliders,
  Package,
  Layers,
  ClipboardCheck,
  ShoppingBag,
  DollarSign,
  AlertOctagon,
  ArrowLeft,
  ChevronRight,
  FolderTree,
  Tag,
  Settings,
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  // Live query of all products from Dexie
  const rawProducts = useLiveQuery(() => db.products.toArray());
  const allProducts = rawProducts ?? [];

  // Live query of categories and brands
  const { categories } = useCategories({ activeOnly: true });
  const { brands } = useBrands(undefined, { activeOnly: true });

  // View state: 'hierarchy' (Categories -> Brands -> Products) or 'flat' (All Products search table)
  const [viewMode, setViewMode] = useState<'hierarchy' | 'flat'>('hierarchy');

  // Hierarchy drill-down state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'lowStock' | 'outOfStock' | 'archived'>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [managingBrandCategory, setManagingBrandCategory] = useState<Category | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isPurchasesModalOpen, setIsPurchasesModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  // Active vs Archived split
  const activeProducts = allProducts.filter((p) => p.active !== false);
  const archivedProducts = allProducts.filter((p) => p.active === false);

  // Lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const brandMap = useMemo(() => {
    const map = new Map<string, Brand>();
    brands.forEach((b) => map.set(b.id, b));
    return map;
  }, [brands]);

  // Metrics
  const totalProductsCount = activeProducts.length;
  const lowStockCount = activeProducts.filter(
    (p) => p.stock > 0 && p.stock <= p.minStock
  ).length;
  const outOfStockCount = activeProducts.filter((p) => p.stock <= 0).length;
  const totalStockValue = activeProducts.reduce(
    (sum, p) => sum + Math.max(0, p.stock) * (p.costPrice || 0),
    0
  );

  // Selected Category and Brand objects
  const selectedCategory = selectedCategoryId ? categoryMap.get(selectedCategoryId) : null;
  const selectedBrand = selectedBrandId ? brandMap.get(selectedBrandId) : null;

  // Category Brands
  const categoryBrands = useMemo(() => {
    if (!selectedCategoryId) return [];
    return brands.filter((b) => b.categoryId === selectedCategoryId && b.isActive !== false);
  }, [brands, selectedCategoryId]);

  // Category Products
  const currentCategoryProducts = useMemo(() => {
    if (!selectedCategoryId) return [];
    return activeProducts.filter((p) => {
      if (p.categoryId === selectedCategoryId) return true;
      if (!p.categoryId && selectedCategory && p.category?.toLowerCase() === selectedCategory.name.toLowerCase()) {
        return true;
      }
      return false;
    });
  }, [activeProducts, selectedCategoryId, selectedCategory]);

  // Flat Search filtered list
  const query = searchTerm.trim().toLowerCase();
  const flatList = filterMode === 'archived' ? archivedProducts : activeProducts;

  const filteredFlatProducts = flatList.filter((p) => {
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.barcode && p.barcode.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (filterMode === 'lowStock') {
      return p.stock > 0 && p.stock <= p.minStock;
    }
    if (filterMode === 'outOfStock') {
      return p.stock <= 0;
    }
    return true;
  });

  // Render Product Card (Section 25: Product name, selling price, current stock, low stock state. NO product icons)
  const renderProductCard = (product: Product) => {
    const isOutOfStock = product.stock <= 0;
    const isLowStock = !isOutOfStock && product.stock <= product.minStock;
    const isArchived = product.active === false;
    const productCost = product.costPrice || 0;
    const itemStockValue = Math.max(0, product.stock) * productCost;
    const productBrand = product.brandId ? brandMap.get(product.brandId) : null;

    return (
      <div
        key={product.id}
        className={`p-4 rounded-2xl bg-white border transition-all shadow-xs flex flex-col justify-between ${
          isOutOfStock
            ? 'border-rose-300 ring-1 ring-rose-100 bg-rose-50/20'
            : isLowStock
            ? 'border-amber-300 bg-amber-50/20'
            : 'border-slate-200/90 hover:border-slate-300'
        }`}
      >
        <div>
          {/* Top: Product Name, Brand Subtitle, Edit */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 pr-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-black text-slate-900 text-base leading-tight">
                  {product.name}
                </h2>
                {isArchived && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 font-bold rounded">
                    Archived
                  </span>
                )}
                {product.isFavorite && (
                  <span className="text-amber-500 text-xs" title="Favorite">
                    ★
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                {productBrand && (
                  <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                    {productBrand.name}
                  </span>
                )}
                <span>{product.category || 'Other'}</span>
                {product.sku && (
                  <span className="text-[11px] font-mono text-slate-400">
                    SKU: {product.sku}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditingProduct(product)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Edit Product"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* Middle Info Grid: Selling Price, Stock Left, Cost Price */}
          <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-slate-100 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Selling Price
              </span>
              <span className="text-base font-extrabold text-blue-600">
                {formatCurrency(product.sellingPrice)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Stock Remaining
              </span>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {isOutOfStock ? (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    <AlertOctagon className="w-3 h-3" />
                    OUT OF STOCK
                  </span>
                ) : isLowStock ? (
                  <Badge variant="low-stock" size="sm">
                    ⚠️ Low ({product.stock})
                  </Badge>
                ) : (
                  <span className="text-sm font-extrabold text-slate-800">
                    {product.stock} units
                  </span>
                )}
              </div>
            </div>

            <div className="mt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Cost Price
              </span>
              <span className="text-xs font-bold text-slate-700">
                {formatCurrency(productCost)}
              </span>
            </div>

            <div className="text-right mt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Stock Value
              </span>
              <span className="text-xs font-bold text-slate-700">
                {formatCurrency(itemStockValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons [ + STOCK ] [ HISTORY ] [ Adjust ] */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRestockingProduct(product)}
            className="flex-1 py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer tap-press"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryProduct(product)}
            className="flex-1 py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title="View movement history"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>History</span>
          </button>

          <button
            type="button"
            onClick={() => setAdjustingProduct(product)}
            className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center cursor-pointer"
            title="Adjust Physical Stock Count"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header & Fast Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Inventory
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Category → Optional Brand → Product organization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Categories</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4 text-blue-600" />
            <span>Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPurchasesModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span>Purchases</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs shadow-blue-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Summary Cards: Products, Low Stock, Stock Value */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Products
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
            {totalProductsCount}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Active items</span>
        </div>

        <div
          onClick={() => {
            setViewMode('flat');
            setFilterMode(lowStockCount > 0 ? 'lowStock' : 'outOfStock');
          }}
          className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs cursor-pointer hover:border-amber-300 transition-all"
        >
          <div className="flex items-center gap-1.5 text-amber-600 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Low Stock
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 leading-tight">
            {lowStockCount}
            {outOfStockCount > 0 && (
              <span className="text-xs sm:text-sm font-bold text-rose-600 ml-1">
                ({outOfStockCount} out)
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Need restock</span>
        </div>

        <div className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Stock Value
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-700 leading-tight truncate">
            {formatCurrency(totalStockValue)}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">At cost price</span>
        </div>
      </div>

      {/* View Switcher: Hierarchy (Category -> Brand -> Product) vs Flat List */}
      <div className="flex items-center justify-between gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setViewMode('hierarchy');
            setSearchTerm('');
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            viewMode === 'hierarchy'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderTree className="w-4 h-4 text-blue-600" />
          <span>Category Hierarchy</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('flat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            viewMode === 'flat'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-slate-500" />
          <span>All Products List</span>
        </button>
      </div>

      {/* A. HIERARCHY VIEW (Section 24) */}
      {viewMode === 'hierarchy' && (
        <div className="space-y-4">
          {/* Level 0: Categories Grid */}
          {!selectedCategoryId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Select Category to View Inventory
                </span>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categories.map((cat) => {
                  const catProdCount = activeProducts.filter(
                    (p) =>
                      p.categoryId === cat.id ||
                      (!p.categoryId && p.category?.toLowerCase() === cat.name.toLowerCase())
                  ).length;
                  const catBrandCount = brands.filter(
                    (b) => b.categoryId === cat.id && b.isActive !== false
                  ).length;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setSelectedBrandId(null);
                      }}
                      className="flex flex-col items-start justify-between p-4 bg-white border border-slate-200/90 hover:border-blue-500 hover:shadow-xs active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-left group shadow-2xs"
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="text-3xl select-none group-hover:scale-110 transition-transform">
                          {getCategoryEmoji(cat.icon)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                      </div>

                      <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate max-w-full">
                        {cat.name}
                      </h3>

                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mt-2">
                        <span>{catProdCount} items</span>
                        {catBrandCount > 0 && <span>• {catBrandCount} brands</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Level 1: Category View (Shows Brands and Direct Products, or Directly Products if no brands) */}
          {selectedCategoryId && !selectedBrandId && selectedCategory && (
            <div className="space-y-4">
              {/* Category Header & Breadcrumbs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Categories</span>
                  </button>

                  <ChevronRight className="w-4 h-4 text-slate-300" />

                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl leading-none">{getCategoryEmoji(selectedCategory.icon)}</span>
                    <h2 className="text-lg font-black text-slate-900 leading-none">
                      {selectedCategory.name}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManagingBrandCategory(selectedCategory)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    <span>Manage Brands</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product</span>
                  </button>
                </div>
              </div>

              {/* Case 1: Category HAS brands (e.g. Cigarettes -> Classic, Gold Flake) */}
              {categoryBrands.length > 0 ? (
                <div className="space-y-4">
                  {/* Brands List */}
                  <div className="space-y-2">
                    <span className="text-xs font-black text-slate-600 uppercase tracking-wider block px-1">
                      Brands in {selectedCategory.name}
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {categoryBrands.map((brand) => {
                        const brandProdCount = currentCategoryProducts.filter((p) => p.brandId === brand.id).length;

                        return (
                          <button
                            key={brand.id}
                            type="button"
                            onClick={() => setSelectedBrandId(brand.id)}
                            className="flex flex-col items-start justify-between p-3.5 bg-white border border-slate-200 hover:border-blue-500 rounded-2xl transition-all cursor-pointer text-left group shadow-2xs"
                          >
                            <span className="font-extrabold text-slate-900 text-base leading-tight group-hover:text-blue-600 transition-colors">
                              {brand.name}
                            </span>
                            <div className="flex items-center justify-between w-full mt-3 pt-2 border-t border-slate-100">
                              <span className="text-xs font-bold text-slate-400">
                                {brandProdCount} products
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Direct Products in this category (without brand) */}
                  {currentCategoryProducts.filter((p) => !p.brandId).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-black text-slate-600 uppercase tracking-wider block px-1">
                        Direct Products (Without Brand)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {currentCategoryProducts
                          .filter((p) => !p.brandId)
                          .map((product) => renderProductCard(product))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Case 2: Category WITHOUT brands (e.g. Gutka -> Vimal, Rajshree directly) */
                <div className="space-y-2">
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider block px-1">
                    Products ({currentCategoryProducts.length})
                  </span>

                  {currentCategoryProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentCategoryProducts.map((product) => renderProductCard(product))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                      <p className="text-3xl">📦</p>
                      <h4 className="text-sm font-extrabold text-slate-800">No products in {selectedCategory.name}</h4>
                      <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        + Add First Product
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Level 2: Brand View (Shows Products in Brand) */}
          {selectedCategoryId && selectedBrandId && selectedCategory && selectedBrand && (
            <div className="space-y-4">
              {/* Brand Header & Breadcrumbs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(null)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    <span>Categories</span>
                  </button>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

                  <button
                    type="button"
                    onClick={() => setSelectedBrandId(null)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    <span>{selectedCategory.name}</span>
                  </button>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

                  <h2 className="text-base font-black text-slate-900 leading-none">
                    {selectedBrand.name}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product in {selectedBrand.name}</span>
                </button>
              </div>

              {/* Products in Brand */}
              <div className="space-y-2">
                {currentCategoryProducts.filter((p) => p.brandId === selectedBrand.id).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentCategoryProducts
                      .filter((p) => p.brandId === selectedBrand.id)
                      .map((product) => renderProductCard(product))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                    <p className="text-3xl">🏷️</p>
                    <h4 className="text-sm font-extrabold text-slate-800">
                      No products under {selectedBrand.name} yet
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      + Add Product
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* B. FLAT ALL PRODUCTS LIST (Search & Filter Table/Cards) */}
      {viewMode === 'flat' && (
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs placeholder:text-slate-400"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All ({activeProducts.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('lowStock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                filterMode === 'lowStock'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              <span>Low Stock</span>
              {lowStockCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    filterMode === 'lowStock'
                      ? 'bg-amber-800 text-white'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('outOfStock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                filterMode === 'outOfStock'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <span>Out of Stock</span>
              {outOfStockCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    filterMode === 'outOfStock' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {outOfStockCount}
                </span>
              )}
            </button>

            {archivedProducts.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterMode('archived')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  filterMode === 'archived'
                    ? 'bg-slate-700 text-white'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Archived ({archivedProducts.length})
              </button>
            )}
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredFlatProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-6">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No matching products found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Try adjusting your search terms or filter selection.
                </p>
              </div>
            ) : (
              filteredFlatProducts.map((product) => renderProductCard(product))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        defaultCategoryId={selectedCategoryId || undefined}
        defaultBrandId={selectedBrandId || undefined}
      />

      <EditProductModal
        product={editingProduct}
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
      />

      <CategoryManagementModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      <BrandManagementModal
        category={managingBrandCategory}
        isOpen={!!managingBrandCategory}
        onClose={() => setManagingBrandCategory(null)}
      />

      <AddStockModal
        product={restockingProduct}
        isOpen={!!restockingProduct}
        onClose={() => setRestockingProduct(null)}
      />

      <StockAdjustmentModal
        product={adjustingProduct}
        isOpen={!!adjustingProduct}
        onClose={() => setAdjustingProduct(null)}
      />

      <ProductHistoryModal
        product={historyProduct}
        isOpen={!!historyProduct}
        onClose={() => setHistoryProduct(null)}
      />

      <StockAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      <PurchasesHistoryModal
        isOpen={isPurchasesModalOpen}
        onClose={() => setIsPurchasesModalOpen(false)}
      />
    </div>
  );
};
