import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { customerService } from '../../services/customerService';
import type { Customer } from '../../types';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  customer?: Customer | null;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customer,
}) => {
  const isEditing = !!customer;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer && isOpen) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setNotes(customer.notes || '');
      setInitialBalance('');
    } else if (!customer && isOpen) {
      setName('');
      setPhone('');
      setNotes('');
      setInitialBalance('');
    }
  }, [customer, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      if (isEditing && customer) {
        await customerService.updateCustomer(customer.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await customerService.addCustomer({
          name: name.trim(),
          phone: phone.trim() || undefined,
          balance: parseFloat(initialBalance) || 0,
          notes: notes.trim() || undefined,
        });
      }

      setName('');
      setPhone('');
      setNotes('');
      setInitialBalance('');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(isEditing ? 'Failed to update customer' : 'Failed to add customer', err);
      alert(isEditing ? 'Error updating customer details' : 'Error creating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Customer Details' : 'Add New Customer'}
      subtitle={
        isEditing
          ? 'Update customer name, contact number, and notes'
          : 'Enter customer name to start tracking udhaar'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-extrabold text-slate-700 mb-1">
            Customer Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Raj"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-extrabold text-slate-700 mb-1">
            Mobile Number (Optional)
          </label>
          <input
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {!isEditing && (
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Existing Due Amount (₹) (Optional)
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-extrabold text-slate-700 mb-1">
            Notes / Address (Optional)
          </label>
          <textarea
            rows={3}
            placeholder="Add landmark, address, or customer notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition-all"
          >
            {isSubmitting
              ? 'Saving...'
              : isEditing
              ? 'Save Changes'
              : 'Save Customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
