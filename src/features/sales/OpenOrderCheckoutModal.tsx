import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { useCustomers } from '../../hooks/useShopData';
import { openOrderService } from '../../services/openOrderService';
import { formatCurrency } from '../../lib/utils';
import type { OpenOrder, Customer, Sale } from '../../types';
import { Banknote, QrCode, BookOpen, AlertTriangle, Search, Check, Plus } from 'lucide-react';
import { customerService } from '../../services/customerService';

interface OpenOrderCheckoutModalProps {
  order: OpenOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sale: Sale) => void;
}

export const OpenOrderCheckoutModal: React.FC<OpenOrderCheckoutModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { customers } = useCustomers();
  const [selectedMethod, setSelectedMethod] = useState<'PAID' | 'UDHAAR'>('PAID');
  const [paidType, setPaidType] = useState<'CASH' | 'UPI'>('CASH');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  React.useEffect(() => {
    if (order && isOpen) {
      if (order.customerId) {
        const existing = customers.find((c) => c.id === order.customerId);
        setSelectedCustomer(existing || null);
      } else {
        setSelectedCustomer(null);
      }
      setSelectedMethod('PAID');
      setPaidType('CASH');
      setIsCreatingNewCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
    }
  }, [order, isOpen, customers]);

  if (!order) return null;

  const currentDue = selectedCustomer?.balance ?? 0;
  const newDue = currentDue + order.totalAmount;

  const handleCheckoutPaid = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      const { sale } = await openOrderService.checkoutOpenOrder(order.id, {
        paymentStatus: 'PAID',
        paymentMethod: paidType,
        customerId: selectedCustomer?.id || order.customerId || undefined,
        customerName: selectedCustomer?.name || order.temporaryCustomerName || 'Walk-in Customer',
      });
      onSuccess(sale);
      onClose();
    } catch (err: any) {
      console.error('Failed to checkout paid order', err);
      alert('Checkout failed: ' + err?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutUdhaar = async () => {
    if (isProcessing) return;
    if (!selectedCustomer) {
      alert('Please select or create a customer to record Udhaar.');
      return;
    }

    try {
      setIsProcessing(true);
      const { sale } = await openOrderService.checkoutOpenOrder(order.id, {
        paymentStatus: 'UDHAAR',
        paymentMethod: 'NONE',
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
      });
      onSuccess(sale);
      onClose();
    } catch (err: any) {
      console.error('Failed to checkout udhaar order', err);
      alert('Udhaar checkout failed: ' + err?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    try {
      const created = await customerService.addCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
      });
      setSelectedCustomer(created);
      setIsCreatingNewCustomer(false);
    } catch (err) {
      alert('Could not create customer');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Checkout Order"
      subtitle={`Complete sale for ${selectedCustomer?.name || order.temporaryCustomerName || 'Customer'}`}
    >
      <div className="space-y-4">
        {/* Total Bill Pill */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">
              Total Amount
            </span>
            <span className="text-2xl font-black text-white">
              {formatCurrency(order.totalAmount)}
            </span>
            <span className="text-xs text-slate-300 mt-0.5 block">
              {order.itemCount} items in this order
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Customer</span>
            <span className="text-sm font-black text-white">
              {selectedCustomer?.name || order.temporaryCustomerName || 'Walk-in'}
            </span>
          </div>
        </div>

        {/* Method Toggle: PAID vs UDHAAR */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setSelectedMethod('PAID')}
            className={`h-11 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedMethod === 'PAID'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>PAID SALE</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMethod('UDHAAR')}
            className={`h-11 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedMethod === 'UDHAAR'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>UDHAAR (CREDIT)</span>
          </button>
        </div>

        {/* PAID Mode: Cash vs UPI */}
        {selectedMethod === 'PAID' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaidType('CASH')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  paidType === 'CASH'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1.5">
                  <Banknote className="w-4 h-4" />
                </div>
                <span className="font-black text-slate-900 text-sm block">Cash</span>
                <span className="text-[10px] text-slate-500 font-medium">Cash in drawer</span>
              </button>

              <button
                type="button"
                onClick={() => setPaidType('UPI')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  paidType === 'UPI'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-1.5">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="font-black text-slate-900 text-sm block">UPI</span>
                <span className="text-[10px] text-slate-500 font-medium">QR / Online payment</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleCheckoutPaid}
              className="w-full h-13 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-sm shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <Check className="w-5 h-5 stroke-[3]" />
              <span>CONFIRM {paidType} SALE ({formatCurrency(order.totalAmount)})</span>
            </button>
          </div>
        )}

        {/* UDHAAR Mode */}
        {selectedMethod === 'UDHAAR' && (
          <div className="space-y-3 pt-1">
            {selectedCustomer ? (
              /* Known customer breakdown */
              <div className="space-y-3">
                <div className="p-3.5 bg-violet-50/80 border border-violet-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Customer:</span>
                    <span className="font-black text-slate-900">{selectedCustomer.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Current Outstanding:</span>
                    <span className="font-black text-violet-700">{formatCurrency(currentDue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">This Order:</span>
                    <span className="font-black text-slate-900">+{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="pt-2 border-t border-violet-200 flex items-center justify-between">
                    <span className="text-xs font-black text-violet-900 uppercase">New Balance:</span>
                    <span className="text-base font-black text-violet-900">{formatCurrency(newDue)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="h-10 px-3 bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Change Customer
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleCheckoutUdhaar}
                    className="flex-1 h-13 bg-violet-600 hover:bg-violet-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-sm shadow-violet-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>CONFIRM UDHAAR</span>
                  </button>
                </div>
              </div>
            ) : isCreatingNewCustomer ? (
              /* Create customer form for Udhaar */
              <form onSubmit={handleCreateCustomer} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">Add Customer for Udhaar</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewCustomer(false)}
                    className="text-xs font-bold text-slate-400"
                  >
                    Back to Select
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Customer Name *"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  autoFocus
                />
                <input
                  type="tel"
                  placeholder="Phone Number (Optional)"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                />
                <button
                  type="submit"
                  disabled={!newCustName.trim()}
                  className="w-full h-10 bg-violet-600 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Save & Continue Udhaar
                </button>
              </form>
            ) : (
              /* Require selecting customer */
              <div className="space-y-2">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Anonymous Udhaar is not allowed. Select or create a customer to record credit against their khata.
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search existing customer..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-slate-100">
                  {customers
                    .filter((c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
                    .slice(0, 6)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className="w-full p-2 hover:bg-violet-50 text-left flex items-center justify-between text-xs cursor-pointer"
                      >
                        <span className="font-extrabold text-slate-800">{c.name}</span>
                        <span className="text-[11px] font-bold text-violet-700">
                          Due {formatCurrency(c.balance || 0)} →
                        </span>
                      </button>
                    ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreatingNewCustomer(true)}
                  className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Customer</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
