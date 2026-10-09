import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { db } from '../../db';
import { inventoryService } from '../../services/inventoryService';
import type { Product } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Plus, Building2, UserPlus, Check } from 'lucide-react';

interface AddStockModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface AddStockFormProps {
  product: Product;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddStockForm: React.FC<AddStockFormProps> = ({ product, onClose, onSuccess }) => {
  const [quantity, setQuantity] = useState<number>(12);
  const [unitCost, setUnitCost] = useState<number>(product.costPrice || 0);
  const [supplierId, setSupplierId] = useState<string>('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live suppliers query
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) || [];

  const quickPills = [6, 12, 24, 50, 100];
  const newStock = product.stock + (quantity || 0);
  const totalCost = (quantity || 0) * (unitCost || 0);

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      const created = await inventoryService.addSupplier({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim(),
      });
      setSupplierId(created.id);
      setShowAddSupplier(false);
      setNewSupplierName('');
      setNewSupplierPhone('');
    } catch (err) {
      console.error('Failed to create supplier', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) return;

    try {
      setIsSubmitting(true);
      const selectedSupplier = suppliers.find((s) => s.id === supplierId);

      await inventoryService.recordPurchase({
        productId: product.id,
        quantity,
        unitCost: unitCost >= 0 ? unitCost : 0,
        supplierId: selectedSupplier?.id,
        supplierName: selectedSupplier?.name,
        note: selectedSupplier ? `Restocked from ${selectedSupplier.name}` : 'Stock Purchase',
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to add stock', err);
      alert('Error updating stock: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Stock Preview Card */}
      <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none">{product.emoji || '📦'}</span>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">{product.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Current Stock:{' '}
              <span className="font-bold text-slate-800">{product.stock} units</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            After Restock
          </span>
          <span className="text-lg font-black text-emerald-600">
            {product.stock} → {newStock}
          </span>
        </div>
      </div>

      {/* Quick Add Pills */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          Quick Select Quantity
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {quickPills.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setQuantity(amt)}
              className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                quantity === amt
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              +{amt}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity and Unit Purchase Price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Quantity Purchased *
          </label>
          <input
            type="number"
            min="1"
            required
            value={quantity || ''}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Cost Per Unit (₹)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={unitCost || ''}
            onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Total Cost Banner */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50/70 border border-blue-100 rounded-xl text-xs">
        <span className="font-semibold text-blue-900">Total Purchase Cost:</span>
        <span className="font-extrabold text-blue-700 text-sm">
          {quantity} × {formatCurrency(unitCost)} = {formatCurrency(totalCost)}
        </span>
      </div>

      {/* Supplier Selection */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            Supplier (Optional)
          </label>
          <button
            type="button"
            onClick={() => setShowAddSupplier(!showAddSupplier)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {showAddSupplier ? 'Cancel' : 'New Supplier'}
          </button>
        </div>

        {showAddSupplier ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mb-2">
            <input
              type="text"
              placeholder="Supplier or Agency Name (e.g. City Beverage)"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="Phone number (optional)"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCreateSupplier}
                disabled={!newSupplierName.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>
        ) : (
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- No Supplier Specified --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.phone ? `(${s.phone})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || quantity <= 0}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{isSubmitting ? 'Adding...' : `Add +${quantity} Stock`}</span>
        </button>
      </div>
    </form>
  );
};

export const AddStockModal: React.FC<AddStockModalProps> = ({
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
      title="Add Stock (Purchase)"
      subtitle={`Restock ${product.name}`}
    >
      <AddStockForm
        key={product.id}
        product={product}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  );
};
