import React, { useState, useRef } from 'react';
import { useProducts, useCustomers, useDashboardStats, useOpenOrders } from '../hooks/useShopData';
import { useCart } from '../hooks/useCart';
import { QuickSaleGrid } from '../features/sales/QuickSaleGrid';
import { CurrentSaleTray } from '../features/sales/CurrentSaleTray';
import { UdhaarCustomerPickerModal } from '../features/sales/UdhaarCustomerPickerModal';
import { PaymentMethodModal } from '../features/sales/PaymentMethodModal';
import { AddExpenseModal } from '../features/expenses/AddExpenseModal';
import { AddStockModal } from '../features/inventory/AddStockModal';
import { SaleToast } from '../features/sales/SaleToast';
import { MobileCartBottomBar } from '../features/sales/MobileCartBottomBar';
import { HoldOrderModal } from '../features/sales/HoldOrderModal';
import { OpenOrdersModal } from '../features/sales/OpenOrdersModal';
import { OpenOrderDetailModal } from '../features/sales/OpenOrderDetailModal';
import { OpenOrderCheckoutModal } from '../features/sales/OpenOrderCheckoutModal';
import { saleService } from '../services/saleService';
import { openOrderService } from '../services/openOrderService';
import { formatCurrency } from '../lib/utils';
import type { Sale, Customer, Product, OpenOrder, CartItem, PriceVariant } from '../types';
import {
  Banknote,
  QrCode,
  BookOpen,
  ArrowUpRight,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Plus,
  Receipt,
  Cloud,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface HomePageProps {
  onNavigateToTab?: (tab: 'home' | 'inventory' | 'customers' | 'sales' | 'reports' | 'settings') => void;
  onSelectCustomerDetail?: (customer: Customer) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigateToTab }) => {
  const { products, isLoading: productsLoading } = useProducts();
  const { customers } = useCustomers();
  const { stats } = useDashboardStats();
  const { openOrdersCount } = useOpenOrders();

  // Unified Cart Hook with stock limits & integer calculations
  const {
    cart,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    restoreCart,
    subtotal,
    totalItems,
    stockNotice,
    dismissStockNotice,
  } = useCart();

  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [isUdhaarModalOpen, setIsUdhaarModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [activeSaleToast, setActiveSaleToast] = useState<Sale | null>(null);
  const [heldOrderToast, setHeldOrderToast] = useState<{ name: string; total: number; order: OpenOrder } | null>(null);
  const [greeting] = useState<string>(getGreeting);

  // Open Orders State
  const [isOpenOrdersModalOpen, setIsOpenOrdersModalOpen] = useState(false);
  const [isHoldOrderModalOpen, setIsHoldOrderModalOpen] = useState(false);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<OpenOrder | null>(null);
  const [checkoutOrder, setCheckoutOrder] = useState<OpenOrder | null>(null);
  const [activeEditingOrder, setActiveEditingOrder] = useState<OpenOrder | null>(null);
  const stashedNormalCartRef = useRef<CartItem[]>([]);

  // When PAID is tapped in cart tray, open the lightweight payment method selector
  const handleOpenPaidModal = () => {
    if (cart.length === 0 || isProcessingSale) return;
    setIsPaymentMethodModalOpen(true);
  };

  // Complete PAID sale with chosen method (CASH or UPI)
  const handleConfirmPaidSale = async (method: 'CASH' | 'UPI') => {
    if (cart.length === 0 || isProcessingSale) return;

    try {
      setIsProcessingSale(true);
      const sale = await saleService.createSale({
        items: cart,
        paymentStatus: 'PAID',
        paymentMethod: method,
      });

      setIsPaymentMethodModalOpen(false);
      clearCart();
      setActiveSaleToast(sale);
    } catch (err) {
      console.error('Failed to complete paid sale', err);
      alert('Could not complete sale: ' + (err as Error).message);
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Open Udhaar modal
  const handleOpenUdhaarModal = () => {
    if (cart.length === 0 || isProcessingSale) return;
    setIsUdhaarModalOpen(true);
  };

  // Fast UDHAAR sale
  const handleConfirmUdhaarSale = async (customerId: string, customerName: string) => {
    try {
      setIsProcessingSale(true);
      const sale = await saleService.createSale({
        items: cart,
        paymentStatus: 'UDHAAR',
        paymentMethod: 'NONE',
        customerId,
        customerName,
      });

      setIsUdhaarModalOpen(false);
      clearCart();
      setActiveSaleToast(sale);
    } catch (err) {
      console.error('Failed to complete udhaar sale', err);
      alert('Could not complete udhaar sale: ' + (err as Error).message);
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Fast UNDO reversal within 5 seconds
  const handleUndoSale = async (saleId: string) => {
    try {
      const restoredItems = await saleService.undoSale(saleId);
      setActiveSaleToast(null);
      restoreCart(restoredItems);
    } catch (err) {
      console.error('Failed to undo sale', err);
      alert('Could not undo sale.');
    }
  };

  // Collapsible stats on mobile to preserve vertical screen space for counter
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

  // Open Hold Order Modal
  const handleOpenHoldModal = () => {
    if (cart.length === 0 || isProcessingSale) return;
    setIsHoldOrderModalOpen(true);
  };

  // Successfully put order on hold
  const handleHoldOrderSuccess = (order: OpenOrder) => {
    clearCart();
    setIsHoldOrderModalOpen(false);
    setHeldOrderToast({
      name: order.temporaryCustomerName || 'Customer',
      total: order.totalAmount,
      order,
    });
  };

  React.useEffect(() => {
    if (heldOrderToast) {
      const timer = setTimeout(() => setHeldOrderToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [heldOrderToast]);

  // Add more items to an existing Open Order
  const handleAddMoreItems = async (order: OpenOrder) => {
    // 1. Stash current normal cart if not already editing
    if (!activeEditingOrder) {
      stashedNormalCartRef.current = [...cart];
    }

    // 2. Fetch order items and restore into cart
    const orderData = await openOrderService.getOpenOrderWithItems(order.id);
    if (!orderData) return;

    const orderCartItems: CartItem[] = orderData.items.map((oi) => {
      const prod: Product = products.find((p) => p.id === oi.productId) || {
        id: oi.productId,
        shopId: oi.shopId,
        name: oi.productName,
        emoji: oi.productEmoji,
        sellingPrice: oi.unitPrice,
        costPrice: 0,
        stock: 999,
        minStock: 0,
        active: true,
        category: 'General',
        createdAt: oi.createdAt,
        updatedAt: oi.updatedAt,
      };

      const variant: PriceVariant | undefined = oi.variantId
        ? {
            id: oi.variantId,
            name: oi.variantName || 'Variant',
            price: oi.unitPrice,
            sellingPrice: oi.unitPrice,
            isDefault: false,
          }
        : undefined;

      return {
        product: prod,
        quantity: oi.quantity,
        selectedVariant: variant,
      };
    });

    restoreCart(orderCartItems);
    setActiveEditingOrder(orderData.order);
  };

  // Save and return to timeline view
  const handleSaveAndReturnToOrder = async () => {
    if (!activeEditingOrder) return;
    const currentOrderId = activeEditingOrder.id;
    setActiveEditingOrder(null);

    // Restore stashed normal cart
    restoreCart(stashedNormalCartRef.current);
    stashedNormalCartRef.current = [];

    // Reopen detail modal for the updated order
    const updated = await openOrderService.getOpenOrderWithItems(currentOrderId);
    if (updated) {
      setSelectedDetailOrder(updated.order);
    }
  };

  // Wrapped cart handlers for auto-save in Open Order mode
  const handleAddToCart = async (product: Product, variant?: PriceVariant) => {
    addToCart(product, variant);
    if (activeEditingOrder) {
      try {
        await openOrderService.addItemToOrder(activeEditingOrder.id, product, 1, variant);
      } catch (err) {
        console.error('Failed to auto-save item to open order', err);
      }
    }
  };

  const handleUpdateQuantity = async (productId: string, delta: number, variantId?: string) => {
    if (activeEditingOrder) {
      const currentItem = cart.find(
        (i) => i.product.id === productId && (variantId ? i.selectedVariant?.id === variantId : !i.selectedVariant?.id)
      );
      if (currentItem) {
        const newQty = currentItem.quantity + delta;
        try {
          const orderData = await openOrderService.getOpenOrderWithItems(activeEditingOrder.id);
          const orderItem = orderData?.items.find(
            (oi) => oi.productId === productId && (variantId ? oi.variantId === variantId : !oi.variantId)
          );
          if (orderItem) {
            if (newQty <= 0) {
              await openOrderService.removeItemFromOrder(activeEditingOrder.id, orderItem.id);
            } else {
              await openOrderService.updateItemQuantity(activeEditingOrder.id, orderItem.id, newQty);
            }
          }
        } catch (err) {
          console.error('Failed to update open order item quantity', err);
        }
      }
    }
    updateQuantity(productId, delta, variantId);
  };

  const handleRemoveItem = async (productId: string, variantId?: string) => {
    if (activeEditingOrder) {
      try {
        const orderData = await openOrderService.getOpenOrderWithItems(activeEditingOrder.id);
        const orderItem = orderData?.items.find(
          (oi) => oi.productId === productId && (variantId ? oi.variantId === variantId : !oi.variantId)
        );
        if (orderItem) {
          await openOrderService.removeItemFromOrder(activeEditingOrder.id, orderItem.id);
        }
      } catch (err) {
        console.error('Failed to remove open order item', err);
      }
    }
    removeItem(productId, variantId);
  };

  // Handle successful checkout of Open Order
  const handleOpenOrderCheckoutSuccess = (sale: Sale) => {
    if (activeEditingOrder) {
      setActiveEditingOrder(null);
      clearCart();
      restoreCart(stashedNormalCartRef.current);
      stashedNormalCartRef.current = [];
    }
    setSelectedDetailOrder(null);
    setCheckoutOrder(null);
    setActiveSaleToast(sale);
  };

  // Section 13: Enter keyboard shortcut opens payment method when cart has items
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        cart.length > 0 &&
        !isPaymentMethodModalOpen &&
        !isUdhaarModalOpen &&
        !isExpenseModalOpen &&
        !isHoldOrderModalOpen &&
        !isOpenOrdersModalOpen &&
        !selectedDetailOrder &&
        !checkoutOrder &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        if (activeEditingOrder) {
          handleSaveAndReturnToOrder();
        } else {
          handleOpenPaidModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart.length,
    isPaymentMethodModalOpen,
    isUdhaarModalOpen,
    isExpenseModalOpen,
    isHoldOrderModalOpen,
    isOpenOrdersModalOpen,
    selectedDetailOrder,
    checkoutOrder,
    activeEditingOrder,
  ]);

  return (
    <div className="space-y-4 pb-20 lg:pb-12">
      {/* Non-blocking stock protection & UNDO toast */}
      <SaleToast
        sale={activeSaleToast}
        onUndo={handleUndoSale}
        onDismiss={() => setActiveSaleToast(null)}
        stockNotice={stockNotice}
        onDismissStockNotice={dismissStockNotice}
      />

      {/* 1. Header Greeting & Brand */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            {greeting}
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            ShopFlow
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setIsExpenseModalOpen(true)}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Expense</span>
        </button>
      </div>

      {/* 1 & 2. Today's Summary & Money Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
        {/* Primary Metric: Today's Sales */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Today's Sales
            </span>
            <div className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mt-0.5">
              {formatCurrency(stats.todayRevenue)}
            </div>
            <div className="text-xs text-slate-500 font-semibold mt-0.5">
              {stats.todayItemsSold} items sold · {stats.transactionCount} sales
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Est. Profit
            </span>
            <span className="text-base sm:text-xl font-black text-emerald-600 block">
              {formatCurrency(stats.todayEstimatedProfit)}
            </span>

            {/* Mobile Expand / Collapse Details Toggle */}
            <button
              type="button"
              onClick={() => setIsStatsExpanded(!isStatsExpanded)}
              className="sm:hidden text-[11px] font-bold text-blue-600 flex items-center gap-0.5 mt-1 cursor-pointer"
            >
              <span>{isStatsExpanded ? 'Less' : 'Details'}</span>
              {isStatsExpanded ? (
                <ChevronUp className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <ChevronDown className="w-3 h-3 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>

        {/* Money Received Split & Expenses: Always visible on >= sm, toggleable on mobile */}
        <div className={`${isStatsExpanded ? 'block' : 'hidden sm:block'} space-y-3 pt-1 animate-in fade-in duration-150`}>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 sm:p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-700 mb-0.5">
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash</span>
              </div>
              <div className="text-xs sm:text-base font-black text-slate-900">
                {formatCurrency(stats.todayCash)}
              </div>
            </div>

            <div className="p-2 sm:p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-blue-700 mb-0.5">
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI</span>
              </div>
              <div className="text-xs sm:text-base font-black text-slate-900">
                {formatCurrency(stats.todayUPI)}
              </div>
            </div>

            <div className="p-2 sm:p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-violet-700 mb-0.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Udhaar</span>
              </div>
              <div className="text-xs sm:text-base font-black text-slate-900">
                {formatCurrency(stats.todayUdhaar)}
              </div>
            </div>
          </div>

          {/* Expenses & Estimated Net Bar */}
          {stats.todayExpenses > 0 && (
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Receipt className="w-3.5 h-3.5 text-rose-500" />
                <span>Expenses: <strong className="text-slate-900">{formatCurrency(stats.todayExpenses)}</strong></span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 mr-1.5">Estimated Net:</span>
                <strong className="text-emerald-700 font-black">
                  {formatCurrency(stats.todayNetAfterExpenses)}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 9. Out of Stock Alert Banner (Requirement 9) */}
      {stats.outOfStockProducts.length > 0 && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black text-rose-950 uppercase tracking-tight">
                Out of Stock ({stats.outOfStockProducts.length})
              </h3>
            </div>
            <span className="text-[11px] font-bold text-rose-700">Restock needed</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full">
            {stats.outOfStockProducts.map((p) => (
              <div
                key={p.id}
                className="px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2 shadow-2xs"
              >
                <span>{p.emoji || '📦'}</span>
                <span>{p.name}</span>
                <button
                  type="button"
                  onClick={() => setRestockingProduct(p)}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black cursor-pointer ml-1"
                >
                  RESTOCK
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Quick Sale Remains Primary (Desktop 2-column layout, Mobile stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Quick Sale Catalog (Immediate access) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Section 12: Recovery flow for new device with no local data */}
          {products.length === 0 && !productsLoading && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/90 rounded-2xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      No data found on this device.
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Logged in on a new device? Restore your shop records from cloud backup in seconds.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('settings')}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5 tap-press"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>RESTORE FROM CLOUD</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Visual Banner when Editing Open Order */}
            {activeEditingOrder && (
              <div className="p-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl shadow-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-100 block">
                      Active Timeline Mode
                    </span>
                    <span className="text-sm font-black truncate block">
                      Adding to: {activeEditingOrder.temporaryCustomerName || 'Customer'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveAndReturnToOrder}
                  className="px-3.5 py-1.5 bg-white hover:bg-amber-50 text-amber-950 font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  Save & Return
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Quick Sale
                </h2>

                {/* Open Orders prominent counter badge */}
                <button
                  type="button"
                  onClick={() => setIsOpenOrdersModalOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>OPEN ORDERS</span>
                  {openOrdersCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center justify-center">
                      {openOrdersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {productsLoading ? (
              <div className="p-8 text-center text-slate-400 font-medium">
                Loading products...
              </div>
            ) : (
              <QuickSaleGrid
                products={products}
                cart={cart}
                onAddToCart={handleAddToCart}
              />
            )}
          </div>


          {/* 8. Low Stock Section (Requirement 8) */}
          {stats.lowStockProducts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Low Stock
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('inventory')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>MANAGE STOCK</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stats.lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 bg-amber-50/50 border border-amber-200/80 rounded-xl text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      <span>{p.emoji || '📦'}</span>
                      <span className="font-bold text-slate-800 truncate">{p.name}</span>
                    </div>
                    <span className="font-black text-amber-800 shrink-0">
                      {p.stock} left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Persistent Current Sale Tray (Desktop sticky) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-16 space-y-3">
          <CurrentSaleTray
            cart={cart}
            subtotal={subtotal}
            totalItems={totalItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={clearCart}
            onPaidSale={handleOpenPaidModal}
            onUdhaarSale={handleOpenUdhaarModal}
            onHoldOrder={handleOpenHoldModal}
            activeEditingOrderName={activeEditingOrder ? (activeEditingOrder.temporaryCustomerName || 'Customer') : null}
            onSaveAndReturnOrder={handleSaveAndReturnToOrder}
            isProcessing={isProcessingSale}
          />
        </div>
      </div>

      {/* Section 7: Mobile Floating Cart Bottom Bar with View Drawer & Quick Actions */}
      <MobileCartBottomBar
        cart={cart}
        subtotal={subtotal}
        totalItems={totalItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={clearCart}
        onPaidSale={handleOpenPaidModal}
        onUdhaarSale={handleOpenUdhaarModal}
        onHoldOrder={handleOpenHoldModal}
        activeEditingOrderName={activeEditingOrder ? (activeEditingOrder.temporaryCustomerName || 'Customer') : null}
        onSaveAndReturnOrder={handleSaveAndReturnToOrder}
        isProcessing={isProcessingSale}
      />

      {/* Modals */}
      <PaymentMethodModal
        isOpen={isPaymentMethodModalOpen}
        totalAmount={subtotal}
        onClose={() => setIsPaymentMethodModalOpen(false)}
        onSelectMethod={handleConfirmPaidSale}
        isProcessing={isProcessingSale}
      />

      <UdhaarCustomerPickerModal
        isOpen={isUdhaarModalOpen}
        onClose={() => setIsUdhaarModalOpen(false)}
        customers={customers}
        totalAmount={subtotal}
        onConfirmUdhaar={handleConfirmUdhaarSale}
      />

      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
      />


      <AddStockModal
        product={restockingProduct}
        isOpen={!!restockingProduct}
        onClose={() => setRestockingProduct(null)}
      />

      {/* Open Orders Modals */}
      <HoldOrderModal
        isOpen={isHoldOrderModalOpen}
        onClose={() => setIsHoldOrderModalOpen(false)}
        cart={cart}
        subtotal={subtotal}
        totalItems={totalItems}
        onSuccess={handleHoldOrderSuccess}
      />

      <OpenOrdersModal
        isOpen={isOpenOrdersModalOpen}
        onClose={() => setIsOpenOrdersModalOpen(false)}
        onSelectOrder={(order) => setSelectedDetailOrder(order)}
        onStartNewOrder={() => {
          if (activeEditingOrder) {
            handleSaveAndReturnToOrder();
          }
          if (cart.length > 0) {
            setIsHoldOrderModalOpen(true);
          }
        }}
      />

      <OpenOrderDetailModal
        order={selectedDetailOrder}
        isOpen={!!selectedDetailOrder}
        onClose={() => setSelectedDetailOrder(null)}
        onAddMoreItems={handleAddMoreItems}
        onCheckout={(order) => setCheckoutOrder(order)}
      />

      <OpenOrderCheckoutModal
        order={checkoutOrder}
        isOpen={!!checkoutOrder}
        onClose={() => setCheckoutOrder(null)}
        onSuccess={handleOpenOrderCheckoutSuccess}
      />

      {/* Held Order Floating Notification */}
      {heldOrderToast && (
        <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 bg-amber-500 text-white rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-100 block">
                Order Put On Hold
              </span>
              <span className="text-sm font-black truncate block">
                {heldOrderToast.name} · {formatCurrency(heldOrderToast.total)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedDetailOrder(heldOrderToast.order);
                setHeldOrderToast(null);
              }}
              className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-950 font-black text-xs rounded-xl transition-colors cursor-pointer"
            >
              VIEW
            </button>
            <button
              type="button"
              onClick={() => setHeldOrderToast(null)}
              className="text-amber-100 hover:text-white font-black text-sm p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
