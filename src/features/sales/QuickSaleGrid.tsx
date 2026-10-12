import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, CartItem, PriceVariant } from '../../types';
import { formatCurrency, getProductVariants } from '../../lib/utils';
import { Search, X, Star, Zap, Clock } from 'lucide-react';
import { useQuickItems } from '../../hooks/useQuickItems';
import { useCategories } from '../../hooks/useCategories';
import { useBrands } from '../../hooks/useBrands';
import { getCategoryEmoji } from '../../constants/categoryIcons';
import { VariantSelectionModal } from './VariantSelectionModal';

/**
 * Hook to provide smooth horizontal scrolling with:
 * 1. Mobile touch swipe (enabled via CSS quick-horizontal-scroll with touch-action: pan-x pan-y)
 * 2. Desktop mouse wheel: translates vertical wheel deltaY to horizontal scroll
 * 3. Desktop mouse drag: allows click-and-drag panning without accidentally triggering item clicks
 */
function useHorizontalScrollRow(dependencyKey?: string | number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const hasDragged = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = 0;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;

      const canScrollInDir =
        (e.deltaY > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 2) ||
        (e.deltaY < 0 && el.scrollLeft > 2);

      if (canScrollInDir) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dependencyKey]);

  useEffect(() => {
    const onGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !ref.current) return;
      const diff = e.pageX - startX.current;
      if (Math.abs(diff) > 4) {
        hasDragged.current = true;
        e.preventDefault();
      }
      ref.current.scrollLeft = scrollStart.current - diff;
    };

    const onGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setTimeout(() => {
          hasDragged.current = false;
        }, 50);
      }
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !ref.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX;
    scrollStart.current = ref.current.scrollLeft;
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    ref,
    containerProps: {
      ref,
      onMouseDown,
      onClickCapture,
    },
  };
}

interface QuickSaleGridProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product, variant?: PriceVariant) => void;
  openOrdersCount?: number;
  onOpenOrders?: () => void;
}

export const QuickSaleGrid: React.FC<QuickSaleGridProps> = ({
  products,
  cart,
  onAddToCart,
  openOrdersCount = 0,
  onOpenOrders,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Hierarchy Navigation State: null = all categories; categoryId = selected category
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  // Variant selection modal state
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);

  // Categories & Brands live from Dexie
  const { categories } = useCategories({ activeOnly: true });
  const { brands } = useBrands(undefined, { activeOnly: true });

  // Hook for cached Most Selling (frequentlySold), Recently Sold, and Favorites
  const { frequentlySold, recentlySold, favorites, toggleFavorite } = useQuickItems(products);

  // Quick section view toggle between Most Selling, Recently Sold & Favorites
  const [quickSectionTab, setQuickSectionTab] = useState<'frequent' | 'recent' | 'favorites'>('frequent');

  // Lookups for fast category and brand matching
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const brandMap = useMemo(() => {
    const map = new Map<string, (typeof brands)[0]>();
    brands.forEach((b) => map.set(b.id, b));
    return map;
  }, [brands]);

  // Map product ID to current quantity in cart for instant visual badge feedback
  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      const current = map.get(item.product.id) || 0;
      map.set(item.product.id, current + item.quantity);
    });
    return map;
  }, [cart]);

  // Keyboard shortcuts (/ to focus search, Esc to clear search or clear brand/category filter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (searchTerm) {
          e.preventDefault();
          setSearchTerm('');
          searchInputRef.current?.blur();
        } else if (selectedBrandId) {
          e.preventDefault();
          setSelectedBrandId(null);
        } else if (selectedCategoryId) {
          e.preventDefault();
          setSelectedCategoryId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchTerm, selectedCategoryId, selectedBrandId]);

  // Fast product search across product name, brand name, category name, barcode, and SKU
  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];

    const activeProducts = products.filter((p) => p.active !== false);

    return activeProducts.filter((p) => {
      // 1. Search in product name
      if (p.name.toLowerCase().includes(term)) return true;

      // 2. Search in category name
      const cat = p.categoryId ? categoryMap.get(p.categoryId) : undefined;
      const catName = cat ? cat.name.toLowerCase() : (p.category || '').toLowerCase();
      if (catName.includes(term)) return true;

      // 3. Search in brand name
      const br = p.brandId ? brandMap.get(p.brandId) : undefined;
      if (br && br.name.toLowerCase().includes(term)) return true;

      // 4. Barcode or SKU
      if (p.barcode && p.barcode.toLowerCase().includes(term)) return true;
      if (p.sku && p.sku.toLowerCase().includes(term)) return true;

      return false;
    });
  }, [searchTerm, products, categoryMap, brandMap]);

  // Selected Category and Brand objects
  const selectedCategory = selectedCategoryId ? categoryMap.get(selectedCategoryId) : null;
  const selectedBrand = selectedBrandId ? brandMap.get(selectedBrandId) : null;

  // Total active products count
  const totalActiveProductsCount = useMemo(() => {
    return products.filter((p) => p.active !== false).length;
  }, [products]);

  // Category item counts
  const categoryProductCounts = useMemo(() => {
    const map = new Map<string, number>();
    const active = products.filter((p) => p.active !== false);
    for (const cat of categories) {
      const count = active.filter(
        (p) =>
          p.categoryId === cat.id ||
          (!p.categoryId && p.category?.toLowerCase() === cat.name.toLowerCase())
      ).length;
      map.set(cat.id, count);
    }
    return map;
  }, [products, categories]);

  // Brands belonging to the currently selected category
  const categoryBrands = useMemo(() => {
    if (!selectedCategoryId) return [];
    return brands.filter((b) => b.categoryId === selectedCategoryId && b.isActive !== false);
  }, [brands, selectedCategoryId]);

  // Brand item counts in the selected category
  const brandProductCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedCategoryId) return map;
    const inCat = products.filter(
      (p) =>
        p.active !== false &&
        (p.categoryId === selectedCategoryId ||
          (!p.categoryId && selectedCategory && p.category?.toLowerCase() === selectedCategory.name.toLowerCase()))
    );
    for (const b of categoryBrands) {
      const count = inCat.filter((p) => p.brandId === b.id).length;
      map.set(b.id, count);
    }
    return map;
  }, [products, selectedCategoryId, selectedCategory, categoryBrands]);

  // Products displayed in the main grid based on selected category and brand filter
  const displayedProducts = useMemo(() => {
    const activeProducts = products.filter((p) => p.active !== false);

    if (!selectedCategoryId) {
      // All categories
      return [...activeProducts].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
      );
    }

    // Filter by selected category
    let list = activeProducts.filter((p) => {
      if (p.categoryId === selectedCategoryId) return true;
      if (!p.categoryId && selectedCategory && p.category?.toLowerCase() === selectedCategory.name.toLowerCase()) {
        return true;
      }
      return false;
    });

    // Filter by brand if selected
    if (selectedBrandId) {
      list = list.filter((p) => p.brandId === selectedBrandId);
    }

    return list.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
  }, [products, selectedCategoryId, selectedCategory, selectedBrandId]);

  const handleProductClick = (product: Product) => {
    if (product.stock <= 0) return;
    const variants = getProductVariants(product);
    if (variants.length > 1) {
      setVariantModalProduct(product);
    } else {
      onAddToCart(product, variants[0]);
    }
  };

  // Helper component to render a product card (Compact, touch-friendly, information-dense)
  const renderProductCard = (product: Product) => {
    const inCartCount = cartQuantityMap.get(product.id) || 0;
    const isLowStock = product.stock <= product.minStock && product.stock > 0;
    const isOutOfStock = product.stock <= 0;
    const isFav = product.isFavorite === true;
    const variants = getProductVariants(product);
    const hasMultipleVariants = variants.length > 1;

    // Resolve brand label for context if available
    const productBrand = product.brandId ? brandMap.get(product.brandId) : null;

    return (
      <div
        key={product.id}
        className={`relative flex flex-col justify-between p-3 sm:p-3.5 rounded-2xl border text-left transition-all duration-150 select-none shadow-2xs group min-h-[125px] ${
          isOutOfStock
            ? 'bg-[#f5f5f7] border-dashed border-[#d2d2d7] opacity-60'
            : inCartCount > 0
            ? 'bg-[#f0f7ff] border-[#0066cc] ring-2 ring-[#0066cc]/20'
            : 'bg-white border-[#e5e5ea] hover:border-[#b6d7ff] hover:shadow-xs'
        }`}
      >
        {/* Main Touch Target: Clicking immediately adds +1 to cart or opens variant selector if multi-variant */}
        <button
          type="button"
          disabled={isOutOfStock}
          onClick={() => {
            if (!isOutOfStock) handleProductClick(product);
          }}
          className={`absolute inset-0 w-full h-full rounded-2xl z-0 text-left cursor-pointer active:scale-[0.98] apple-focus ${
            isOutOfStock ? 'cursor-not-allowed' : ''
          }`}
          aria-label={`Add ${product.name} to cart`}
        />

        {/* Top Row: Brand pill / Options tag & Favorite Star */}
        <div className="relative z-10 flex items-start justify-between gap-1 pointer-events-none mb-1">
          <div className="flex items-center gap-1 min-w-0 pr-1 flex-wrap">
            {productBrand ? (
              <span className="text-[10px] font-semibold text-[#0066cc] bg-[#0066cc]/10 px-1.5 py-0.5 rounded-full truncate max-w-[90px]">
                {productBrand.name}
              </span>
            ) : hasMultipleVariants ? (
              <span className="text-[10px] font-semibold text-[#0066cc] bg-[#0066cc]/10 px-1.5 py-0.5 rounded-full">
                {variants.length} options
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Favorite Star Button (clickable independently) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(product.id);
              }}
              className={`pointer-events-auto p-1 -m-1 rounded-lg text-[#d2d2d7] hover:text-amber-500 transition-colors cursor-pointer active:scale-90 ${
                isFav ? 'text-amber-500 fill-amber-500' : ''
              }`}
              aria-label={isFav ? `Remove ${product.name} from favorites` : `Mark ${product.name} as favorite`}
            >
              <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Middle: Product Name */}
        <div className="relative z-10 pointer-events-none my-1 flex-1 flex items-center">
          <h3 className="font-semibold text-[#1d1d1f] text-xs sm:text-sm leading-snug line-clamp-2 apple-tight">
            {product.name}
          </h3>
        </div>

        {/* Bottom Row: Price, Stock & Add / In-cart badge */}
        <div className="relative z-10 pointer-events-none mt-2 pt-2 border-t border-[#f0f0f2] flex items-end justify-between w-full gap-1.5">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-bold text-[#0066cc] apple-tight leading-none">
                {formatCurrency(product.sellingPrice)}
              </span>
              {product.mrp && product.mrp > product.sellingPrice && (
                <span className="text-[10px] font-normal text-[#86868b] line-through leading-none">
                  {formatCurrency(product.mrp)}
                </span>
              )}
            </div>

            <div className="mt-1">
              {isOutOfStock ? (
                <span className="text-[9px] sm:text-[10px] font-semibold text-[#cf1322] bg-[#fff1f0] border border-[#ffa39e] px-1.5 py-0.2 rounded-full inline-block leading-tight">
                  Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="text-[9px] sm:text-[10px] font-semibold text-[#b45309] bg-[#fffbeb] border border-[#fef3c7] px-1.5 py-0.2 rounded-full inline-block leading-tight">
                  Low: {product.stock}
                </span>
              ) : (
                <span className="text-[10px] font-normal text-[#86868b] block leading-tight">
                  {product.stock} in stock
                </span>
              )}
            </div>
          </div>

          {/* Action pill / +1 badge */}
          <div className="shrink-0 pointer-events-none">
            {inCartCount > 0 && !isOutOfStock ? (
              <span className="bg-[#0066cc] text-white text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-full shadow-2xs flex items-center gap-0.5 leading-none">
                ×{inCartCount}
              </span>
            ) : !isOutOfStock ? (
              <span className="w-6 h-6 rounded-full bg-[#f5f5f7] group-hover:bg-[#0066cc] group-hover:text-white text-[#1d1d1f] text-xs font-bold flex items-center justify-center transition-colors shadow-2xs">
                +
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // Quick horizontal items list (for Most Selling, Recent, Favorites)
  const currentQuickItems =
    quickSectionTab === 'frequent'
      ? frequentlySold
      : quickSectionTab === 'recent'
      ? recentlySold
      : favorites;

  const hasAnyQuickItems =
    frequentlySold.length > 0 || recentlySold.length > 0 || favorites.length > 0;

  // Horizontal scroll controllers for the quick option rows, category chips, and brand chips
  const quickScroll = useHorizontalScrollRow(`${quickSectionTab}-${currentQuickItems.length}`);
  const categoryScroll = useHorizontalScrollRow(`categories-${categories.length}`);
  const brandScroll = useHorizontalScrollRow(`brands-${selectedCategoryId}-${categoryBrands.length}`);

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {/* 1. Header with Title & Open Orders Badge */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-[#1d1d1f] tracking-tight apple-tight">
            Quick Sale POS
          </h2>
          <span className="text-[11px] font-medium text-[#86868b] hidden xs:inline">
            ({totalActiveProductsCount} products)
          </span>
        </div>

        {onOpenOrders && (
          <button
            type="button"
            onClick={onOpenOrders}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 text-amber-900 font-semibold text-xs rounded-full flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>OPEN ORDERS</span>
            {openOrdersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
                {openOrdersCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* 2. Fast Search Field with Offline Immediate Filtering */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b] pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search products, brands, or categories (press '/' to focus)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 pl-10 pr-9 bg-white border border-[#e5e5ea] rounded-full text-sm font-medium text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3] transition-all shadow-2xs apple-focus"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              searchInputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] rounded-full cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. SEARCH MODE OR BROWSING MODE */}
      {searchTerm.trim() ? (
        /* SEARCH RESULTS MODE: Direct Products List */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
              Search Results ({searchResults.length})
            </span>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs font-semibold text-[#0066cc] hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
              {searchResults.map((product) => renderProductCard(product))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[#e5e5ea] p-6 space-y-2">
              <p className="text-3xl">🔍</p>
              <h4 className="text-sm font-semibold text-[#1d1d1f] apple-tight">
                No products matching "{searchTerm}"
              </h4>
              <p className="text-xs text-[#86868b]">
                Try searching by a different name, category, or brand.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* REGULAR BROWSING MODE */
        <div className="space-y-3.5">
          {/* A. MOST SELLING / RECENT / FAVORITES Horizontal Quick Bar */}
          {hasAnyQuickItems && (
            <div className="space-y-2 bg-white p-2.5 rounded-2xl border border-[#e5e5ea] shadow-2xs">
              <div className="flex items-center justify-between px-1">
                <div className="quick-horizontal-scroll flex items-center gap-1 p-0.5 bg-[#f5f5f7] rounded-full border border-[#e5e5ea] overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setQuickSectionTab('frequent')}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer shrink-0 ${
                      quickSectionTab === 'frequent'
                        ? 'bg-white text-[#0066cc] shadow-2xs'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Zap className="w-3 h-3 stroke-[2.2]" />
                    <span>Most Selling</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickSectionTab('recent')}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer shrink-0 ${
                      quickSectionTab === 'recent'
                        ? 'bg-white text-[#0066cc] shadow-2xs'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Clock className="w-3 h-3 stroke-[2.2]" />
                    <span>Recently Sold</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickSectionTab('favorites')}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer shrink-0 ${
                      quickSectionTab === 'favorites'
                        ? 'bg-white text-amber-600 shadow-2xs'
                        : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${quickSectionTab === 'favorites' ? 'fill-amber-500 text-amber-500' : 'stroke-[2.2]'}`} />
                    <span>Favorites</span>
                    {favorites.length > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none ${
                          quickSectionTab === 'favorites' ? 'bg-amber-100 text-amber-800' : 'bg-[#e5e5ea] text-[#6e6e73]'
                        }`}
                      >
                        {favorites.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Horizontal chips or friendly notice */}
              {currentQuickItems.length > 0 ? (
                <div
                  {...quickScroll.containerProps}
                  className="quick-horizontal-scroll flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 cursor-grab active:cursor-grabbing select-none"
                >
                  {currentQuickItems.map((prod) => {
                    const inCart = cartQuantityMap.get(prod.id) || 0;
                    const isOut = prod.stock <= 0;

                    return (
                      <button
                        key={`quick-${prod.id}`}
                        type="button"
                        disabled={isOut}
                        onClick={() => {
                          if (!isOut) handleProductClick(prod);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-left shrink-0 transition-all select-none shadow-2xs active:scale-95 cursor-pointer ${
                          isOut
                            ? 'bg-[#f5f5f7] border-dashed border-[#d2d2d7] opacity-60 cursor-not-allowed'
                            : inCart > 0
                            ? 'bg-[#f0f7ff] border-[#0066cc] ring-1 ring-[#0066cc]/30'
                            : quickSectionTab === 'favorites'
                            ? 'bg-white border-[#e5e5ea] hover:border-amber-300'
                            : 'bg-white border-[#e5e5ea] hover:border-[#b6d7ff]'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <span className="text-xs font-semibold text-[#1d1d1f] block leading-tight truncate max-w-[110px] apple-tight">
                            {prod.name}
                          </span>
                          <span className="text-[11px] font-bold text-[#0066cc] block leading-none mt-0.5">
                            {formatCurrency(prod.sellingPrice)}
                          </span>
                        </div>

                        {inCart > 0 && !isOut ? (
                          <span className="bg-[#0066cc] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full shadow-2xs shrink-0">
                            ×{inCart}
                          </span>
                        ) : (
                          <span
                            className={`w-4 h-4 rounded-full font-semibold text-xs flex items-center justify-center shrink-0 ${
                              quickSectionTab === 'favorites'
                                ? 'bg-amber-100/70 text-amber-800'
                                : 'bg-[#f5f5f7] text-[#86868b]'
                            }`}
                          >
                            +
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-2.5 px-3 text-center text-xs text-[#86868b] flex items-center justify-center gap-1.5 bg-[#f5f5f7]/60 rounded-xl">
                  {quickSectionTab === 'favorites' ? (
                    <>
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      <span>No favorite products yet. Tap the star icon on any product to add it here.</span>
                    </>
                  ) : (
                    <span>No items found in this section yet.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* B. CATEGORY SWITCHER (Horizontal scrollable chips - Reference visual design) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                Categories
              </span>
              <span className="text-xs font-normal text-[#86868b]">
                {categories.length} categories
              </span>
            </div>

            <div
              {...categoryScroll.containerProps}
              className="quick-horizontal-scroll flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 cursor-grab active:cursor-grabbing select-none -mx-1 px-1"
            >
              {/* "All" Category Chip */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId(null);
                  setSelectedBrandId(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-95 ${
                  selectedCategoryId === null
                    ? 'bg-[#0066cc] text-white shadow-xs'
                    : 'bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:bg-[#f5f5f7]'
                }`}
              >
                <span>All</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none ${
                    selectedCategoryId === null
                      ? 'bg-white/20 text-white'
                      : 'bg-[#f5f5f7] text-[#86868b]'
                  }`}
                >
                  {totalActiveProductsCount}
                </span>
              </button>

              {/* Category Chips */}
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const iconEmoji = getCategoryEmoji(cat.icon);
                const count = categoryProductCounts.get(cat.id) || 0;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(isSelected ? null : cat.id);
                      setSelectedBrandId(null);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-95 ${
                      isSelected
                        ? 'bg-[#0066cc] text-white shadow-xs'
                        : 'bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    <span className="text-sm leading-none">{iconEmoji}</span>
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[#f5f5f7] text-[#86868b]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* C. BRAND FILTER STRIP (Rendered when active category has brands) */}
          {selectedCategoryId && categoryBrands.length > 0 && (
            <div
              {...brandScroll.containerProps}
              className="quick-horizontal-scroll flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 cursor-grab active:cursor-grabbing select-none text-xs -mx-1 px-1 animate-in fade-in duration-150"
            >
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider shrink-0 mr-0.5">
                Brands:
              </span>

              <button
                type="button"
                onClick={() => setSelectedBrandId(null)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
                  selectedBrandId === null
                    ? 'bg-[#1d1d1f] text-white shadow-2xs'
                    : 'bg-white text-[#6e6e73] border border-[#e5e5ea] hover:text-[#1d1d1f]'
                }`}
              >
                All Brands
              </button>

              {categoryBrands.map((b) => {
                const isBrandSelected = selectedBrandId === b.id;
                const bCount = brandProductCounts.get(b.id) || 0;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBrandId(isBrandSelected ? null : b.id)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
                      isBrandSelected
                        ? 'bg-[#0066cc] text-white shadow-2xs'
                        : 'bg-white text-[#1d1d1f] border border-[#e5e5ea] hover:border-[#0066cc]'
                    }`}
                  >
                    <span>{b.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none ${
                        isBrandSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[#f5f5f7] text-[#86868b]'
                      }`}
                    >
                      {bCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* D. PRODUCT GRID */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-[#1d1d1f] uppercase tracking-wider">
                  {selectedCategory ? selectedCategory.name : 'All Products'}
                </span>
                {selectedBrand && (
                  <span className="text-xs font-semibold text-[#0066cc] bg-[#0066cc]/10 px-2 py-0.5 rounded-full">
                    {selectedBrand.name}
                  </span>
                )}
                <span className="text-xs text-[#86868b]">
                  ({displayedProducts.length} items)
                </span>
              </div>

              {(selectedCategoryId || selectedBrandId) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setSelectedBrandId(null);
                  }}
                  className="text-xs font-semibold text-[#0066cc] hover:underline cursor-pointer"
                >
                  View All
                </button>
              )}
            </div>

            {displayedProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {displayedProducts.map((product) => renderProductCard(product))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[#d2d2d7] p-6 space-y-2">
                <p className="text-3xl">📦</p>
                <h4 className="text-sm font-semibold text-[#1d1d1f] apple-tight">
                  No products found
                </h4>
                <p className="text-xs text-[#86868b]">
                  {selectedBrand
                    ? `No products assigned to ${selectedBrand.name} yet.`
                    : selectedCategory
                    ? `No products in ${selectedCategory.name} yet.`
                    : 'No active products available.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variant Selection Modal */}
      <VariantSelectionModal
        isOpen={!!variantModalProduct}
        onClose={() => setVariantModalProduct(null)}
        product={variantModalProduct}
        onSelectVariant={(product, variant) => {
          onAddToCart(product, variant);
        }}
      />
    </div>
  );
};
