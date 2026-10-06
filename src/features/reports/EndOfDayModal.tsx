import React from 'react';
import { Modal } from '../../components/Modal';
import { formatCurrency } from '../../lib/utils';
import type { DayStatsSummary } from '../../services/dashboardService';
import { CheckCircle2, Banknote, QrCode, BookOpen, TrendingUp, Receipt } from 'lucide-react';

interface EndOfDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: DayStatsSummary;
}

export const EndOfDayModal: React.FC<EndOfDayModalProps> = ({
  isOpen,
  onClose,
  stats,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="End of Day Summary"
      subtitle={`Daily review for ${stats.dateLabel}`}
    >
      <div className="space-y-4">
        {/* Primary Banner */}
        <div className="p-4 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
              Total Today's Sales
            </span>
            <div className="text-3xl font-black text-blue-950 mt-0.5">
              {formatCurrency(stats.totalRevenue)}
            </div>
            <div className="text-xs text-blue-700 font-semibold mt-1">
              {stats.transactionCount} transactions · {stats.itemsSold} items sold
            </div>
          </div>
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
          </div>
        </div>

        {/* Money Received Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Payment Breakdown
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-xl">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800">Cash Received</span>
              </div>
              <span className="text-sm font-black text-emerald-700">
                {formatCurrency(stats.cashRevenue)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-blue-50/60 rounded-xl">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-800">UPI Received</span>
              </div>
              <span className="text-sm font-black text-blue-700">
                {formatCurrency(stats.upiRevenue)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-violet-50/60 rounded-xl">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-600" />
                <span className="font-bold text-slate-800">Udhaar Given</span>
              </div>
              <span className="text-sm font-black text-violet-700">
                {formatCurrency(stats.udhaarRevenue)}
              </span>
            </div>
          </div>
        </div>

        {/* Profit & Expenses Summary */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Estimated Profit</span>
            </div>
            <div className="text-lg font-black text-slate-900">
              {formatCurrency(stats.estimatedProfit)}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-rose-700 font-bold mb-1">
              <Receipt className="w-3.5 h-3.5" />
              <span>Expenses</span>
            </div>
            <div className="text-lg font-black text-slate-900">
              {formatCurrency(stats.totalExpenses)}
            </div>
          </div>
        </div>

        {/* Estimated Net After Recorded Expenses */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-emerald-950 block">
              Estimated Net After Recorded Expenses
            </span>
            <span className="text-[11px] text-emerald-700">
              Estimated Profit − Expenses
            </span>
          </div>
          <span className="text-lg font-black text-emerald-800">
            {formatCurrency(stats.estimatedNetAfterExpenses)}
          </span>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl cursor-pointer shadow-xs"
        >
          Close Summary
        </button>
      </div>
    </Modal>
  );
};
