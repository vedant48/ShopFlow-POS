import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { expenseService } from '../../services/expenseService';
import type { ExpenseCategory } from '../../types';
import { Plus, Coffee, Truck, Zap, Home, MoreHorizontal } from 'lucide-react';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES: { id: ExpenseCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'Tea/Food', label: 'Tea / Food', icon: <Coffee className="w-4 h-4 text-amber-600" /> },
  { id: 'Transport', label: 'Transport', icon: <Truck className="w-4 h-4 text-blue-600" /> },
  { id: 'Electricity', label: 'Electricity', icon: <Zap className="w-4 h-4 text-yellow-600" /> },
  { id: 'Rent', label: 'Rent', icon: <Home className="w-4 h-4 text-emerald-600" /> },
  { id: 'Other', label: 'Other', icon: <MoreHorizontal className="w-4 h-4 text-slate-600" /> },
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('Tea/Food');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const quickPills = [20, 50, 100, 200, 500];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    try {
      setIsSubmitting(true);
      await expenseService.addExpense({
        amount: parsedAmount,
        category,
        note: note.trim() || undefined,
      });

      // Reset
      setAmount('');
      setCategory('Tea/Food');
      setNote('');

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to add expense', err);
      alert('Error recording expense: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Expense"
      subtitle="Track daily counter & shop expenses"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Amount Pills */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Quick Select Amount
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {quickPills.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val.toString())}
                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  amount === val.toString()
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ₹{val}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Expense Amount (₹) *
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min="1"
              required
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* Category Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Expense Category *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  category === cat.id
                    ? 'bg-rose-50 text-rose-800 border-rose-400 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.icon}
                <span className="truncate">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Note / Description */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Note (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Chai for counter, auto fare for stock, tea snack..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {/* Actions */}
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
            disabled={isSubmitting || !amount}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{isSubmitting ? 'Recording...' : 'Save Expense'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
