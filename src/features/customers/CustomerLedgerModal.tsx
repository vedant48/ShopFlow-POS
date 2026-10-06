import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal } from '../../components/Modal';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import type { Customer } from '../../types';
import { customerService } from '../../services/customerService';
import { Phone, ArrowDownLeft, ArrowUpRight, IndianRupee } from 'lucide-react';

interface CustomerLedgerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onCollectPayment: (customer: Customer) => void;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  customer,
  isOpen,
  onClose,
  onCollectPayment,
}) => {
  // Real-time live query for unified customer transaction ledger
  const ledgerEntries = useLiveQuery(async () => {
    if (!customer || !isOpen) return [];
    return await customerService.getCustomerHistory(customer.id);
  }, [customer?.id, customer?.balance, isOpen]);

  if (!customer) return null;

  const currentDue = customer.balance ?? 0;
  const history = ledgerEntries || [];
  const loading = ledgerEntries === undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer.name}
      subtitle={customer.phone ? `Customer Mobile: ${customer.phone}` : 'Customer Account'}
    >
      <div className="space-y-4">
        {/* Outstanding Balance Card */}
        <div className="p-4 bg-gradient-to-br from-violet-50 via-white to-violet-50/30 rounded-2xl border border-violet-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Outstanding Balance
              </span>
              <div
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  currentDue > 0 ? 'text-violet-700' : 'text-emerald-600'
                }`}
              >
                {formatCurrency(currentDue)}
              </div>
            </div>

            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>Call</span>
              </a>
            )}
          </div>

          {/* Large COLLECT PAYMENT button (Requirement 11) */}
          {currentDue > 0 ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCollectPayment(customer);
              }}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <IndianRupee className="w-4 h-4 stroke-[3]" />
              <span>COLLECT PAYMENT</span>
            </button>
          ) : (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-extrabold text-emerald-700">
              ✓ All dues cleared · ₹0 outstanding
            </div>
          )}
        </div>

        {/* Notes if present */}
        {customer.notes && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            <span className="font-extrabold text-slate-800">Note: </span>
            {customer.notes}
          </div>
        )}

        {/* Transaction History (Requirement 10: "Raj ne kya liya tha?" & "Raj ka kitna udhaar hai?") */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Transaction History
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">
              {history.length} transactions
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs font-medium">
              Loading ledger history...
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
              No transactions recorded for this customer yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto overscroll-contain pr-1">
              {history.map((entry) => {
                const isSale = entry.type === 'UDHAAR_SALE';

                return (
                  <div
                    key={entry.id}
                    className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between gap-3 text-xs"
                  >
                    {/* Left Icon and Title */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSale
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isSale ? (
                          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 text-sm leading-tight truncate">
                          {entry.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                          {formatDateTime(entry.date)}
                        </div>
                      </div>
                    </div>

                    {/* Right: +₹X (sale) or -₹X (payment) */}
                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-black ${
                          isSale ? 'text-violet-700' : 'text-emerald-600'
                        }`}
                      >
                        {isSale ? `+${formatCurrency(entry.amount)}` : `-${formatCurrency(entry.amount)}`}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                        {isSale ? 'Udhaar' : 'Paid'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
