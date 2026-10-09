import React from 'react';
import { Modal } from '../../components/Modal';
import { useOpenOrders, useCustomers } from '../../hooks/useShopData';
import { formatCurrency } from '../../lib/utils';
import type { OpenOrder } from '../../types';
import { Clock, ArrowRight, Plus } from 'lucide-react';

interface OpenOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (order: OpenOrder) => void;
  onStartNewOrder?: () => void;
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hr ago';
  return `${hours} hrs ago`;
}

export const OpenOrdersModal: React.FC<OpenOrdersModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
  onStartNewOrder,
}) => {
  const { openOrders, isLoading } = useOpenOrders();
  const { customers } = useCustomers();

  const customerMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      map.set(c.id, c.name);
    }
    return map;
  }, [customers]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Open Orders"
      subtitle={`${openOrders.length} pending ${openOrders.length === 1 ? 'order' : 'orders'} currently on hold`}
    >
      <div className="space-y-4">
        {/* Header Action: Start New Order if desired */}
        {onStartNewOrder && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartNewOrder();
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NEW ORDER</span>
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-medium">
            Loading open orders...
          </div>
        ) : openOrders.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-xl">
              🕒
            </div>
            <h4 className="text-sm font-black text-slate-900">
              No open orders right now
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              When a customer wants to keep their bill open while browsing, tap{' '}
              <span className="font-extrabold text-amber-700">[ HOLD ORDER ]</span> in Quick Sale.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto overscroll-contain pr-0.5">
            {openOrders.map((order) => {
              const custName =
                order.customerId
                  ? customerMap.get(order.customerId) || 'Customer'
                  : order.temporaryCustomerName || 'Walk-in';
              const isWalkIn = !order.customerId;

              return (
                <div
                  key={order.id}
                  onClick={() => {
                    onClose();
                    onSelectOrder(order);
                  }}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 hover:border-amber-400 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  {/* Left: Avatar & Customer info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm ${
                        isWalkIn
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-violet-100 text-violet-800'
                      }`}
                    >
                      {custName.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 group-hover:text-amber-800 text-sm truncate">
                          {custName}
                        </span>
                        {isWalkIn && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            Walk-in
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                        <span>{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</span>
                        <span>•</span>
                        <span className="text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(order.lastActivityAt)}
                        </span>
                      </div>

                      {order.note && (
                        <span className="text-[11px] text-amber-800 font-semibold block mt-0.5 truncate">
                          Note: "{order.note}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount & OPEN button */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-base font-black text-slate-900 block">
                        {formatCurrency(order.totalAmount)}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                        Held
                      </span>
                    </div>

                    <button
                      type="button"
                      className="h-9 px-3 rounded-xl bg-amber-500 group-hover:bg-amber-600 text-white font-black text-xs flex items-center gap-1 shadow-2xs transition-colors pointer-events-none"
                    >
                      <span>OPEN</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
