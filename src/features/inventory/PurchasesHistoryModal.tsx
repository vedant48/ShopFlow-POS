import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { db } from '../../db';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { ShoppingBag, Search, Building2 } from 'lucide-react';

interface PurchasesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PurchasesHistoryModal: React.FC<PurchasesHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const purchases = useLiveQuery(async () => {
    if (!isOpen) return [];
    return await db.purchases.reverse().sortBy('createdAt');
  }, [isOpen]) || [];

  if (!isOpen) return null;

  const filteredPurchases = purchases.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.productName.toLowerCase().includes(term) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(term))
    );
  });

  const totalSpent = filteredPurchases.reduce((acc, curr) => acc + curr.totalCost, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Purchases & Restock History"
      subtitle="Track wholesale stock purchases and supplier invoices"
    >
      <div className="space-y-4">
        {/* Summary Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Restock Spend
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {formatCurrency(totalSpent)}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Purchase Orders
            </span>
            <span className="text-base font-extrabold text-slate-800">
              {filteredPurchases.length} restocks
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Purchases List */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {filteredPurchases.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-500">No purchases found.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Restock products using the [+ Stock] button to see orders here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {filteredPurchases.map((p) => (
                <div key={p.id} className="p-3 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{p.productName}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{formatDateTime(p.createdAt)}</span>
                        {p.supplierName && (
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                            <Building2 className="w-3 h-3" />
                            {p.supplierName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        {formatCurrency(p.totalCost)}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5">
                        {p.quantity} × {formatCurrency(p.unitCost)}
                      </div>
                    </div>
                  </div>

                  {p.note && (
                    <div className="text-[11px] text-slate-400 mt-1 italic">{p.note}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};
