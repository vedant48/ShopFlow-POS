import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, CartItem, PriceVariant } from '../../types';
import { formatCurrency, getProductVariants } from '../../lib/utils';
import { Search, X, Star, Zap, Clock, ArrowLeft, ChevronRight } from 'lucide-react';
import { useQuickItems } from '../../hooks/useQuickItems';
import { useCategories } from '../../hooks/useCategories';
import { useBrands } from '../../hooks/useBrands';
import { getCategoryEmoji } from '../../constants/categoryIcons';
import { VariantSelectionModal } from './VariantSelectionModal';

/**
 * Hook to provide smooth, multi-input horizontal scrolling:
 * 1. Mobile / Touch swipe (enabled via CSS touch-action: pan-x pan-y)
 * 2. Desktop mouse wheel: translates vertical wheel deltaY to horizontal scroll
 * 3. Desktop mouse drag: allows click-and-drag panning without accidentally triggering item clicks
 */
function useHorizontalScrollRow(dependencyKey?: string | number) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Wheel event to translate vertical wheel into horizontal scroll on desktop
    const onWheel = (e: WheelEvent) => {
      // If user is already scrolling horizontally (e.g. trackpad swipe deltaX), let native take over
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

    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [dependencyKey]);

  // Mouse drag-to-scroll support
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const hasDragged = useRef(false);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX;
    scrollStart.current = ref.current.scrollLeft;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !ref.current) return;
    const diff = e.pageX - startX.current;
    if (Math.abs(diff) > 5) {
      hasDragged.current = true;
      e.preventDefault();
    }
    ref.current.scrollLeft = scrollStart.current - diff;
  };

  const onMouseUp = () => {
    isDragging.current = false;
    setTimeout(() => {
      hasDragged.current = false;
    }, 50);
  };

  const onMouseLeave = () => {
    isDragging.current = false;
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.stopPropagation();
      e.preventDefault();
      hasDragged.current = false;
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setTimeout(() => {
          hasDragged.current = false;
        }, 50);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return {
    ref,
    containerProps: {
      ref,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onClickCapture,
    },
  };
}

interface QuickSaleGridProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product, variant?: PriceVariant) => void;
}

export const QuickSaleGrid: React.FC<QuickSaleGridProps> = ({
  products,
  cart,
  onAddToCart,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Hierarchy Navigation State: null = root categories view; categoryId = category view; brandId = brand view
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  // Variant selection modal state
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);

  // Categories & Brands live from Dexie (Section 16-19)
  const { categories } = useCategories({ activeOnly: true });
  const { brands } = useBrands(undefined, { activeOnly: true });

  // Hook for cached Most Selling (frequentlySold), Recently Sold, and Favorites
  const { frequentlySold, recentlySold, favorites, toggleFavorite } = useQuickItems(products);

  // Quick section view toggle between Most Selling & Recently Sold
  const [quickSectionTab, setQuickSectionTab] = useState<'frequent' | 'recent'>('frequent');

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

  // Section 13: Keyboard shortcuts (/ to focus search, Esc to clear search / go back)
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

  // Section 23: Fast product search across product name, brand name, and category name
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

  // Brands belonging to the currently selected category
  const categoryBrands = useMemo(() => {
    if (!selectedCategoryId) return [];
    return brands.filter((b) => b.categoryId === selectedCategoryId && b.isActive !== false);
  }, [brands, selectedCategoryId]);

  // Products belonging to the currently selected category
  const categoryProducts = useMemo(() => {
    if (!selectedCategoryId) return [];
    const list = products.filter((p) => {
      if (p.active === false) return false;
      if (p.categoryId === selectedCategoryId) return true;
      // Fallback for older products matching by string category name
      if (!p.categoryId && selectedCategory && p.category?.toLowerCase() === selectedCategory.name.toLowerCase()) {
        return true;
      }
      return false;
    });
    return list.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
  }, [products, selectedCategoryId, selectedCategory]);

  // In Category view: split products into brand products vs direct products (without brand)
  const directCategoryProducts = useMemo(() => {
    return categoryProducts.filter((p) => !p.brandId);
  }, [categoryProducts]);

  // In Brand view: products matching the brand
  const brandProducts = useMemo(() => {
    if (!selectedBrandId) return [];
    return categoryProducts.filter((p) => p.brandId === selectedBrandId);
  }, [categoryProducts, selectedBrandId]);

  // Navigation Handlers
  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setSelectedBrandId(null);
  };

  const handleSelectBrand = (brandId: string) => {
    setSelectedBrandId(brandId);
  };

  const handleBack = () => {
    if (selectedBrandId) {
      setSelectedBrandId(null);
    } else if (selectedCategoryId) {
      setSelectedCategoryId(null);
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.stock <= 0) return;
    const variants = getProductVariants(product);
    if (variants.length > 1) {
      setVariantModalProduct(product);
    } else {
      onAddToCart(product, variants[0]);
    }
  };

  // Helper component to render a product card (NO product icons as per spec!)
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
        className={`relative flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all duration-150 min-h-[110px] select-none shadow-2xs group ${
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

        {/* Top Row: Favorite Star & In-cart badge / +1 */}
        <div className="relative z-10 flex items-start justify-between pointer-events-none mb-1">
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
            <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>

          {/* In-cart counter badge */}
          {inCartCount > 0 && !isOutOfStock ? (
            <div className="bg-[#0066cc] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-2xs animate-in zoom-in-75 duration-150">
              × {inCartCount}
            </div>
          ) : !isOutOfStock ? (
            <div className="w-5 h-5 rounded-full bg-[#f5f5f7] text-[#86868b] group-hover:bg-[#0066cc]/10 group-hover:text-[#0066cc] text-xs font-semibold flex items-center justify-center transition-colors">
              +1
            </div>
          ) : null}
        </div>

        {/* Product Information (No product icon!) */}
        <div className="relative z-10 pointer-events-none pr-1">
          {productBrand && (
            <span className="text-[11px] font-medium text-[#86868b] block leading-tight truncate">
              {productBrand.name}
            </span>
          )}
          <h3 className="font-semibold text-[#1d1d1f] text-sm sm:text-base leading-snug line-clamp-2 apple-tight">
            {product.name}
          </h3>
        </div>

        {/* Price & Stock Indicator */}
        <div className="relative z-10 pointer-events-none mt-2 pt-2 border-t border-[#f0f0f2] flex items-baseline justify-between w-full">
          <div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-[#0066cc] apple-tight">
                {formatCurrency(product.sellingPrice)}
              </span>
              {product.mrp && product.mrp > product.sellingPrice && (
                <span className="text-xs font-normal text-[#86868b] line-through">
                  {formatCurrency(product.mrp)}
                </span>
              )}
            </div>
            {hasMultipleVariants && (
              <span className="text-[10px] font-semibold text-[#0066cc] block mt-0.5">
                {variants.length} price options
              </span>
            )}
          </div>

          <div className="text-right">
            {isOutOfStock ? (
              <span className="text-[10px] font-semibold text-[#cf1322] bg-[#fff1f0] border border-[#ffa39e] px-2 py-0.5 rounded-full inline-block">
                Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="text-[10px] font-semibold text-[#b45309] bg-[#fffbeb] border border-[#fef3c7] px-2 py-0.5 rounded-full inline-block">
                Low: {product.stock}
              </span>
            ) : (
              <span className="text-[11px] font-normal text-[#86868b]">
                Stock {product.stock}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Quick horizontal items list (for Most Selling, Recent, Favorites)
  const currentQuickItems = quickSectionTab === 'frequent' ? frequentlySold : recentlySold;

  // Horizontal scroll controllers for the quick option rows
  const quickScroll = useHorizontalScrollRow(`${quickSectionTab}-${currentQuickItems.length}`);
  const favScroll = useHorizontalScrollRow(`${favorites.length}`);

  return (
    <div className="space-y-3.5">
      {/* 1. Fast Search Field with Offline Immediate Filtering */}
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

      {/* 2. SEARCH MODE: Direct Product Results */}
      {searchTerm ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
              Search Results ({searchResults.length})
            </span>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs font-semibold text-[#0066cc] hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {searchResults.map((product) => renderProductCard(product))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-[#e5e5ea] p-6 space-y-2">
              <p className="text-3xl">🔍</p>
              <h4 className="text-sm font-semibold text-[#1d1d1f] apple-tight">No products matching "{searchTerm}"</h4>
              <p className="text-xs text-[#86868b]">Try searching by category or another keyword.</p>
            </div>
          )}
        </div>
      ) : (
        /* BROWSE MODE: Categories -> Brands -> Products Hierarchy */
        <div className="space-y-4">
          {/* A. If at Root View: Show Most Selling, Favorites, and Categories Grid */}
          {!selectedCategoryId && (
            <>
              {/* ⭐ MOST SELLING / RECENT Horizontal Quick Bar (Section 20 & 22) */}
              {currentQuickItems.length > 0 && (
                <div className="space-y-2 bg-white p-2.5 rounded-2xl border border-[#e5e5ea] shadow-2xs">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1 p-0.5 bg-[#f5f5f7] rounded-full border border-[#e5e5ea]">
                      <button
                        type="button"
                        onClick={() => setQuickSectionTab('frequent')}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
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
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                          quickSectionTab === 'recent'
                            ? 'bg-white text-[#0066cc] shadow-2xs'
                            : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                        }`}
                      >
                        <Clock className="w-3 h-3 stroke-[2.2]" />
                        <span>Recently Sold</span>
                      </button>
                    </div>
                  </div>

                  {/* Horizontal chips */}
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
                            <span className="w-4 h-4 rounded-full bg-[#f5f5f7] text-[#86868b] font-semibold text-xs flex items-center justify-center shrink-0">
                              +
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ❤️ FAVORITES Quick Bar (Section 21) */}
              {favorites.length > 0 && (
                <div className="space-y-1.5 bg-[#fffbeb]/70 p-2.5 rounded-2xl border border-[#fef3c7] shadow-2xs">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#92400e]">
                      <span>❤️</span>
                      <span>Favorites</span>
                    </div>
                  </div>

                  <div
                    {...favScroll.containerProps}
                    className="quick-horizontal-scroll flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 cursor-grab active:cursor-grabbing select-none"
                  >
                    {favorites.map((prod) => {
                      const inCart = cartQuantityMap.get(prod.id) || 0;
                      const isOut = prod.stock <= 0;

                      return (
                        <button
                          key={`fav-${prod.id}`}
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
                              : 'bg-white border-[#e5e5ea] hover:border-amber-300'
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
                            <span className="w-4 h-4 rounded-full bg-amber-100/70 text-amber-800 font-semibold text-xs flex items-center justify-center shrink-0">
                              +
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CATEGORIES GRID (Apple Utility Cards with Prominent Icon) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                    Categories
                  </span>
                  <span className="text-xs font-normal text-[#86868b]">
                    {categories.length} categories
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {categories.map((cat) => {
                    const iconEmoji = getCategoryEmoji(cat.icon);
                    // Count active products in this category
                    const prodCount = products.filter(
                      (p) =>
                        p.active !== false &&
                        (p.categoryId === cat.id ||
                          (!p.categoryId && p.category?.toLowerCase() === cat.name.toLowerCase()))
                    ).length;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.id)}
                        className="flex flex-col items-center justify-center p-4 bg-white border border-[#e5e5ea] hover:border-[#b6d7ff] hover:shadow-xs active:scale-[0.98] rounded-2xl transition-all cursor-pointer text-center group apple-focus shadow-2xs"
                      >
                        <span className="text-3xl sm:text-4xl mb-1.5 select-none transition-transform group-hover:scale-105">
                          {iconEmoji}
                        </span>
                        <h4 className="font-semibold text-[#1d1d1f] text-sm sm:text-base leading-tight truncate max-w-full apple-tight">
                          {cat.name}
                        </h4>
                        <span className="text-[11px] font-normal text-[#86868b] mt-1">
                          {prodCount} items
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* B. CATEGORY VIEW: Shows Brands & Direct Products, or Directly Products if no brands exist (Section 17-19) */}
          {selectedCategoryId && !selectedBrandId && selectedCategory && (
            <div className="space-y-4">
              {/* Category Breadcrumb & Back Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-[#e5e5ea]">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e5e5ea]/70 hover:bg-[#d2d2d7]/60 text-[#1d1d1f] text-xs font-semibold transition-colors cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Categories</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-[#86868b]" />

                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{getCategoryEmoji(selectedCategory.icon)}</span>
                  <h3 className="font-semibold text-[#1d1d1f] text-base leading-none apple-tight">
                    {selectedCategory.name}
                  </h3>
                </div>
              </div>

              {/* Case 1: Category HAS brands (e.g. Cigarettes -> Classic, Gold Flake) */}
              {categoryBrands.length > 0 ? (
                <div className="space-y-4">
                  {/* BRANDS SECTION */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block px-1">
                      Brands
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {categoryBrands.map((brand) => {
                        const brandProdCount = categoryProducts.filter((p) => p.brandId === brand.id).length;

                        return (
                          <button
                            key={brand.id}
                            type="button"
                            onClick={() => handleSelectBrand(brand.id)}
                            className="flex flex-col items-start justify-between p-3.5 bg-white border border-[#e5e5ea] hover:border-[#0066cc] rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98] group shadow-2xs"
                          >
                            <span className="font-semibold text-[#1d1d1f] text-sm sm:text-base leading-tight group-hover:text-[#0066cc] transition-colors apple-tight">
                              {brand.name}
                            </span>
                            <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-[#f5f5f7]">
                              <span className="text-[11px] font-normal text-[#86868b]">
                                {brandProdCount} products
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-[#86868b] group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* DIRECT PRODUCTS (Products in this category without a brand) */}
                  {directCategoryProducts.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block px-1">
                        Direct Products ({directCategoryProducts.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                        {directCategoryProducts.map((product) => renderProductCard(product))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Case 2: Category WITHOUT brands (e.g. Gutka -> Vimal, Rajshree directly) (Section 19) */
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                      Products ({categoryProducts.length})
                    </span>
                  </div>

                  {categoryProducts.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      {categoryProducts.map((product) => renderProductCard(product))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-[#d2d2d7] p-6 space-y-2">
                      <p className="text-3xl">📦</p>
                      <h4 className="text-sm font-semibold text-[#1d1d1f] apple-tight">No products in this category yet</h4>
                      <p className="text-xs text-[#86868b]">Add products to this category in Inventory.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* C. BRAND VIEW: Shows Products Belonging to Selected Brand (Section 18) */}
          {selectedCategoryId && selectedBrandId && selectedCategory && selectedBrand && (
            <div className="space-y-4">
              {/* Brand Breadcrumb & Back Header */}
              <div className="flex items-center gap-1.5 pb-2 border-b border-[#e5e5ea] flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedBrandId(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e5e5ea]/70 hover:bg-[#d2d2d7]/60 text-[#1d1d1f] text-xs font-semibold transition-colors cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[2]" />
                  <span>{selectedCategory.name}</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-[#86868b]" />

                <h3 className="font-semibold text-[#1d1d1f] text-base leading-none apple-tight">
                  {selectedBrand.name}
                </h3>

                <span className="text-xs font-normal text-[#86868b] ml-auto">
                  {brandProducts.length} items
                </span>
              </div>

              {/* Brand Products Grid */}
              {brandProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {brandProducts.map((product) => renderProductCard(product))}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-[#d2d2d7] p-6 space-y-2">
                  <p className="text-3xl">🏷️</p>
                  <h4 className="text-sm font-semibold text-[#1d1d1f] apple-tight">No products under {selectedBrand.name}</h4>
                  <p className="text-xs text-[#86868b]">Assign products to this brand in Inventory.</p>
                </div>
              )}
            </div>
          )}
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
