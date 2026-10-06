import { useState, useEffect, useCallback } from 'react';
import { syncService, type SyncStats } from '../services/syncService';

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [stats, setStats] = useState<SyncStats>({
    pendingCount: 0,
    failedCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    isSyncing: false,
    lastSyncedAt:
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('shopflow_last_successful_sync_at')
        : null,
    lastError: null,
  });

  useEffect(() => {
    // 1. Online/Offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Subscribe to sync service state changes
    const unsubscribe = syncService.subscribe((updatedStats) => {
      setStats(updatedStats);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const manualSync = useCallback(async () => {
    return await syncService.manualSync();
  }, []);

  const clearSynced = useCallback(async () => {
    return await syncService.clearSynced();
  }, []);

  const formatLastSyncTime = useCallback((isoStr?: string | null) => {
    return syncService.formatLastSyncTime(isoStr);
  }, []);

  return {
    isOnline,
    isSyncing: stats.isSyncing,
    pendingCount: stats.pendingCount,
    failedCount: stats.failedCount,
    syncingCount: stats.syncingCount,
    syncedCount: stats.syncedCount,
    lastSyncedAt: stats.lastSyncedAt,
    lastError: stats.lastError,
    manualSync,
    clearSynced,
    formatLastSyncTime,
  };
}
