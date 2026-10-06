import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { customerService } from '../../services/customerService';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await customerService.addCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
        balance: parseFloat(initialBalance) || 0,
      });

      setName('');
      setPhone('');
      setInitialBalance('');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to add customer', err);
      alert('Error creating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Customer"
      subtitle="Enter customer name to start tracking udhaar"
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
            disabled={isSubmitting || !name.trim()}
            className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-sm rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
