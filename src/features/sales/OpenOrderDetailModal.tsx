import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { db } from '../../db';
import { openOrderService } from '../../services/openOrderService';
import { customerService } from '../../services/customerService';
import { useCustomers } from '../../hooks/useShopData';
import { formatCurrency } from '../../lib/utils';
import type { OpenOrder, Customer } from '../../types';
import {
  Plus,
  Minus,
  Trash2,
  Check,
  User,
  Edit2,
  XCircle,
  ShoppingBag,
  Search,
} from 'lucide-react';

interface OpenOrderDetailModalProps {
  order: OpenOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onAddMoreItems: (order: OpenOrder) => void;
  onCheckout: (order: OpenOrder) => void;
}

export const OpenOrderDetailModal: React.FC<OpenOrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onAddMoreItems,
  onCheckout,
}) => {
  const { customers } = useCustomers();

  // Real-time live query for order and its items
  const liveOrderData = useLiveQuery(async () => {
    if (!order?.id || !isOpen) return null;
    const currentOrder = await db.openOrders.get(order.id);
    if (!currentOrder) return null;
    const items = await db.openOrderItems
      .where('openOrderId')
      .equals(order.id)
      .toArray();
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { order: currentOrder, items };
  }, [order?.id, isOpen]);

  const activeOrder = liveOrderData?.order || order;
  const items = liveOrderData?.items || [];

  // Editing state
  const [isChangingCustomer, setIsChangingCustomer] = useState(false);
  const [isCreatingNewCust, setIsCreatingNewCust] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isActionProcessing, setIsActionProcessing] = useState(false);

  useEffect(() => {
    if (activeOrder) {
      setNoteText(activeOrder.note || '');
    }
  }, [activeOrder?.id, activeOrder?.note]);

  useEffect(() => {
    if (!isOpen) {
      setIsChangingCustomer(false);
      setIsCreatingNewCust(false);
      setNewCustName('');
      setNewCustPhone('');
      setIsEditingNote(false);
      setShowCancelConfirm(false);
    }
  }, [isOpen]);

  if (!activeOrder) return null;

  const customerMap = new Map<string, string>();
  for (const c of customers) customerMap.set(c.id, c.name);

  const customerDisplayName = activeOrder.customerId
    ? customerMap.get(activeOrder.customerId) || 'Customer'
    : activeOrder.temporaryCustomerName || 'Walk-in';

  const isWalkIn = !activeOrder.customerId;

  // Quantity changes
  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    if (isActionProcessing) return;
    try {
      setIsActionProcessing(true);
      await openOrderService.updateItemQuantity(activeOrder.id, itemId, newQty);
    } catch (err: any) {
      console.error('Failed to update quantity', err);
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (isActionProcessing) return;
    try {
      setIsActionProcessing(true);
      await openOrderService.removeItemFromOrder(activeOrder.id, itemId);
    } catch (err: any) {
      console.error('Failed to remove item', err);
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleSaveCustomer = async (cust: Customer) => {
    try {
      await openOrderService.updateOrderCustomer(activeOrder.id, cust.id, cust.name);
      setIsChangingCustomer(false);
      setIsCreatingNewCust(false);
    } catch (err: any) {
      console.error('Failed to update customer', err);
      alert('Could not update customer');
    }
  };

  const handleCreateAndAttachCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    try {
      setIsActionProcessing(true);
      const newCust = await customerService.addCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        shopId: activeOrder.shopId,
      });
      await openOrderService.updateOrderCustomer(activeOrder.id, newCust.id, newCust.name);
      setIsChangingCustomer(false);
      setIsCreatingNewCust(false);
      setNewCustName('');
      setNewCustPhone('');
    } catch (err: any) {
      console.error('Failed to create customer', err);
      alert('Could not create customer: ' + err?.message);
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleSaveNote = async () => {
    try {
      await openOrderService.updateOrderNote(activeOrder.id, noteText);
      setIsEditingNote(false);
    } catch (err: any) {
      console.error('Failed to update note', err);
    }
  };

  const handleCancelOrder = async () => {
    try {
      setIsActionProcessing(true);
      await openOrderService.cancelOpenOrder(activeOrder.id);
      setShowCancelConfirm(false);
      onClose();
    } catch (err: any) {
      console.error('Failed to cancel order', err);
      alert('Could not cancel order: ' + err?.message);
    } finally {
      setIsActionProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customerDisplayName}
      subtitle={`Timeline · Opened at ${new Date(activeOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
    >
      <div className="space-y-4">
        {/* Top Header Card */}
        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
              {customerDisplayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 text-sm">
                  {customerDisplayName}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 uppercase">
                  OPEN
                </span>
              </div>
              <span className="text-[11px] text-amber-800 font-semibold block">
                {items.length} {items.length === 1 ? 'item' : 'items'} in timeline
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-slate-900 block leading-tight">
              {formatCurrency(activeOrder.totalAmount)}
            </span>
            <span className="text-[10px] font-bold text-amber-700 uppercase">
              Current Total
            </span>
          </div>
        </div>

        {/* Change Customer view */}
        {isChangingCustomer && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">
                {isWalkIn ? 'Save as Customer' : 'Change Customer'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsChangingCustomer(false);
                  setIsCreatingNewCust(false);
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>

            {/* Toggle between Select vs Create */}
            <div className="flex gap-1.5 p-0.5 bg-slate-200/80 rounded-xl text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setIsCreatingNewCust(false)}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  !isCreatingNewCust
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Existing Customer
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingNewCust(true)}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  isCreatingNewCust
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + New Customer
              </button>
            </div>

            {isCreatingNewCust ? (
              <form onSubmit={handleCreateAndAttachCustomer} className="space-y-2 pt-1">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    required
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newCustName.trim() || isActionProcessing}
                  className="w-full h-9 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save Customer & Attach to Order
                </button>
              </form>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customer..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1">
                  {customers
                    .filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                    .slice(0, 5)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSaveCustomer(c)}
                        className="w-full p-2 bg-white hover:bg-amber-50 border border-slate-100 rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer"
                      >
                        <span>{c.name}</span>
                        <span className="text-[10px] text-amber-600 font-extrabold">Select →</span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Note view/edit */}
        {isEditingNote ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase">
              Order Note / Table
            </label>
            <input
              type="text"
              placeholder="e.g. Table 2, Outside counter..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingNote(false)}
                className="flex-1 h-8 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="flex-1 h-8 bg-amber-500 text-white text-xs font-black rounded-lg cursor-pointer"
              >
                Save Note
              </button>
            </div>
          </div>
        ) : (
          activeOrder.note && (
            <div className="p-2.5 bg-amber-50/60 border border-amber-200/70 rounded-xl flex items-center justify-between text-xs">
              <span className="text-amber-900 font-medium">
                <span className="font-extrabold">Note: </span>
                {activeOrder.note}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingNote(true)}
                className="text-[10px] font-extrabold text-amber-700 hover:underline shrink-0 ml-2"
              >
                Edit
              </button>
            </div>
          )
        )}

        {/* Cancel Confirmation View */}
        {showCancelConfirm && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 animate-in fade-in">
            <h4 className="text-xs font-black text-rose-900">
              Cancel this Open Order?
            </h4>
            <p className="text-[11px] text-rose-700">
              The order will be closed without creating any sale or deducting inventory.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 h-9 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isActionProcessing}
                className="flex-1 h-9 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        )}

        {/* Timeline of Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Items Timeline ({items.length})
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddMoreItems(activeOrder);
              }}
              className="text-xs font-black text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ADD ITEMS</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
              <p className="text-xs text-slate-500 font-semibold">
                No items in this order
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddMoreItems(activeOrder);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Items Now</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto overscroll-contain pr-1 divide-y divide-slate-100">
              {items.map((item) => {
                const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id}
                    className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs"
                  >
                    {/* Item Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm select-none">{item.productEmoji || '📦'}</span>
                        <span className="font-extrabold text-slate-900 truncate">
                          {item.productName}
                        </span>
                        {item.variantName && item.variantName !== 'Standard' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {item.variantName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium pl-5 flex items-center gap-2 mt-0.5">
                        <span>{formatCurrency(item.unitPrice)} each</span>
                        <span>•</span>
                        <span>Added {timeStr}</span>
                      </div>
                    </div>

                    {/* Stepper Controls */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={isActionProcessing}
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-black shadow-2xs transition-all cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="w-5 text-center font-black text-slate-900 text-xs">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        disabled={isActionProcessing}
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black shadow-2xs transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Item Total & Trash */}
                    <div className="text-right min-w-[50px] shrink-0">
                      <span className="font-black text-slate-900 text-xs block">
                        {formatCurrency(item.totalPrice)}
                      </span>
                      <button
                        type="button"
                        disabled={isActionProcessing}
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Secondary Options Strip */}
        <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsChangingCustomer(!isChangingCustomer)}
              className="text-slate-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>{isWalkIn ? 'Save as Customer' : 'Change Customer'}</span>
            </button>

            {!activeOrder.note && !isEditingNote && (
              <button
                type="button"
                onClick={() => setIsEditingNote(true)}
                className="text-slate-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer ml-2"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancel Order</span>
          </button>
        </div>

        {/* Primary Checkout CTA */}
        <div className="pt-2 flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddMoreItems(activeOrder);
            }}
            className="flex-1 h-13 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>+ ADD ITEMS</span>
          </button>

          <button
            type="button"
            disabled={items.length === 0 || isActionProcessing}
            onClick={() => {
              onClose();
              onCheckout(activeOrder);
            }}
            className="flex-1 h-13 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-sm shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>CHECKOUT ({formatCurrency(activeOrder.totalAmount)})</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
