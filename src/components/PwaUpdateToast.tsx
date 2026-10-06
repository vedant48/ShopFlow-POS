import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

export const PwaUpdateToast: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('ShopFlow Service Worker registered', r);
    },
    onRegisterError(error) {
      console.warn('ShopFlow Service Worker registration error', error);
    },
  });

  if (!needRefresh) {
    return null;
  }

  const handleUpdate = async () => {
    try {
      await updateServiceWorker(true);
    } catch (err) {
      console.error('Failed to update service worker:', err);
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl p-3 border border-slate-700/80 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
          <RefreshCw className="w-4 h-4 text-white animate-spin" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white leading-tight">New version available</h4>
          <p className="text-xs text-slate-300 mt-0.5">Tap to get the latest improvements</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Later
        </button>
        <button
          type="button"
          onClick={handleUpdate}
          className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer tap-press"
        >
          UPDATE
        </button>
      </div>
    </div>
  );
};
