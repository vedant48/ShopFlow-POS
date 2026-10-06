import React from 'react';
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';

export const NetworkStatusIndicator: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, failedCount } = useSyncStatus();

  const totalPending = pendingCount + failedCount;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 ${
        !isOnline
          ? 'bg-amber-50 text-amber-900 border-amber-300'
          : isSyncing
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : totalPending > 0
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
      }`}
      role="status"
      aria-live="polite"
      title={
        !isOnline
          ? `Offline · ${totalPending} changes waiting to sync`
          : isSyncing
          ? 'Syncing with cloud...'
          : totalPending > 0
          ? `${totalPending} items pending sync`
          : 'All changes synced to cloud'
      }
    >
      {/* Status Dot */}
      <span
        className={`w-2 h-2 rounded-full inline-block ${
          !isOnline
            ? 'bg-amber-500 animate-pulse'
            : isSyncing
            ? 'bg-blue-500 animate-spin'
            : totalPending > 0
            ? 'bg-amber-500'
            : 'bg-emerald-500'
        }`}
      />

      {/* Network label */}
      <span className="flex items-center gap-1">
        {isOnline ? (
          <Wifi className="w-3 h-3 text-slate-500 hidden sm:inline" />
        ) : (
          <WifiOff className="w-3 h-3 text-amber-600 hidden sm:inline" />
        )}
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </span>

      <span className="text-slate-400 text-[10px]">·</span>

      {/* Sync status label (Section 17 & 18) */}
      <span className="flex items-center gap-1">
        {isSyncing ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
            <span className="text-blue-700 font-bold">Syncing...</span>
          </>
        ) : totalPending > 0 ? (
          <>
            <AlertCircle className="w-3 h-3 text-amber-600" />
            <span className="font-bold text-amber-800">{totalPending} pending</span>
          </>
        ) : (
          <>
            <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
            <span className="text-emerald-700 font-bold">Synced</span>
          </>
        )}
      </span>
    </div>
  );
};

export const OfflineNoticeBar: React.FC = () => {
  const { isOnline, pendingCount } = useSyncStatus();

  if (isOnline) return null;

  return (
    <aside
      aria-label="Offline Mode Notification"
      className="bg-amber-500/10 border-b border-amber-200 text-amber-900 px-3 py-1 text-xs w-full max-w-full overflow-hidden"
    >
      <div className="flex items-center gap-1.5 max-w-7xl mx-auto w-full min-w-0">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <span className="font-bold shrink-0 text-[11px]">● Offline</span>
        <span className="text-amber-800 text-[11px] truncate">
          — All sales & stock save to this phone. {pendingCount > 0 ? `(${pendingCount} pending cloud sync)` : ''}
        </span>
      </div>
    </aside>
  );
};
