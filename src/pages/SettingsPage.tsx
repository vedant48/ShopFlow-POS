import React, { useState, useEffect, useRef } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { checkStoragePersistence, requestStoragePersistence, type StorageStatus } from '../lib/storagePersistence';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { syncService } from '../services/syncService';
import { backupService, type BackupValidationResult } from '../services/backupService';
import { db } from '../db';
import { useAuth } from '../auth/useAuth';
import { authService } from '../auth/authService';
import { DEFAULT_DEMO_SHOP_ID } from '../lib/api';
import {
  Smartphone,
  Laptop,
  CheckCircle2,
  Download,
  Upload,
  ShieldCheck,
  RefreshCw,
  Store,
  User,
  Phone,
  LogOut,
  Edit3,
  Save,
  AlertTriangle,
  FileJson,
  Cloud,
  CloudCheck,
  CloudOff,
  AlertCircle,
  X,
  FileDown,
} from 'lucide-react';
import { getDeviceLabel } from '../auth/authStore';

interface StorageCounts {
  products: number;
  sales: number;
  customers: number;
  payments: number;
  purchases: number;
  expenses: number;
  openOrders: number;
}

export const SettingsPage: React.FC = () => {
  const {
    user,
    shop,
    logout,
    updateProfile,
    getSessions,
    terminateSession,
    terminateAllOtherSessions,
  } = useAuth();
  const { isStandalone, hasPrompt, promptInstall } = useInstallPrompt();
  const {
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    syncedCount,
    lastSyncedAt,
    manualSync,
    clearSynced,
    formatLastSyncTime,
  } = useSyncStatus();

  // Shop Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editShopName, setEditShopName] = useState(shop?.name || '');
  const [editOwnerName, setEditOwnerName] = useState(user?.name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [, setProfileSuccess] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Logged-in Devices & Sessions States
  const [sessions, setSessions] = useState<Array<{
    id: string;
    deviceId: string;
    deviceName?: string | null;
    createdAt: string;
    expiresAt: string;
    isCurrent: boolean;
  }>>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sessionToTerminate, setSessionToTerminate] = useState<{
    id: string;
    deviceId: string;
    deviceName?: string | null;
    createdAt: string;
    expiresAt: string;
    isCurrent: boolean;
  } | null>(null);
  const [showTerminateAllConfirm, setShowTerminateAllConfirm] = useState(false);
  const [isTerminatingSession, setIsTerminatingSession] = useState(false);

  // Sync and Backup feedback
  const [syncFeedbackMessage, setSyncFeedbackMessage] = useState<string | null>(null);
  const [syncResultCounts, setSyncResultCounts] = useState<{
    synced: number;
    pending: number;
    failed: number;
  } | null>(null);

  // Storage counts & persistence
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    isSupported: false,
    isPersisted: false,
  });
  const [counts, setCounts] = useState<StorageCounts>({
    products: 0,
    sales: 0,
    customers: 0,
    payments: 0,
    purchases: 0,
    expenses: 0,
    openOrders: 0,
  });
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);
  const [installSuccessNotice, setInstallSuccessNotice] = useState<string | null>(null);

  // Export / Backup states
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Restore Modal states
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreTab, setRestoreTab] = useState<'cloud' | 'file'>('cloud');
  const [selectedFileValidation, setSelectedFileValidation] = useState<BackupValidationResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Fetch logged-in devices
  const fetchSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const list = await getSessions();
      setSessions(list);
    } catch (err: any) {
      console.error('Failed to load device sessions', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleConfirmTerminateSession = async () => {
    if (!sessionToTerminate) return;
    try {
      setIsTerminatingSession(true);
      const res = await terminateSession(sessionToTerminate.id);
      if (res.success) {
        setSessionFeedback({
          type: 'success',
          message: `Session terminated. That device has been logged out.`,
        });
        setSessionToTerminate(null);
        await fetchSessions();
      } else {
        setSessionFeedback({
          type: 'error',
          message: res.error || 'Failed to terminate session. Please try again.',
        });
      }
    } catch (err: any) {
      setSessionFeedback({
        type: 'error',
        message: err?.message || 'Error terminating session.',
      });
    } finally {
      setIsTerminatingSession(false);
    }
  };

  const handleConfirmTerminateAllOthers = async () => {
    try {
      setIsTerminatingSession(true);
      const res = await terminateAllOtherSessions();
      if (res.success) {
        setSessionFeedback({
          type: 'success',
          message: `Terminated all other active sessions. Only this device remains logged in.`,
        });
        setShowTerminateAllConfirm(false);
        await fetchSessions();
      } else {
        setSessionFeedback({
          type: 'error',
          message: res.error || 'Failed to terminate other sessions.',
        });
      }
    } catch (err: any) {
      setSessionFeedback({
        type: 'error',
        message: err?.message || 'Error terminating other sessions.',
      });
    } finally {
      setIsTerminatingSession(false);
    }
  };
  const [cloudPreview, setCloudPreview] = useState<{
    shopName?: string;
    counts?: Record<string, number>;
  } | null>(null);
  const [isLoadingCloudPreview, setIsLoadingCloudPreview] = useState(false);
  const [cloudPreviewError, setCloudPreviewError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shop?.name) setEditShopName(shop.name);
    if (user?.name) setEditOwnerName(user.name);
  }, [shop?.name, user?.name]);

  const loadCounts = async () => {
    try {
      const activeShopId = authService.getCurrentShopId();
      const [products, sales, customers, payments, purchases, expenses, openOrders] = await Promise.all([
        db.products.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === activeShopId).count(),
        db.sales.filter((s) => (s.shopId || DEFAULT_DEMO_SHOP_ID) === activeShopId).count(),
        db.customers.filter((c) => (c.shopId || DEFAULT_DEMO_SHOP_ID) === activeShopId).count(),
        db.payments.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === activeShopId).count(),
        db.purchases.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === activeShopId).count(),
        db.expenses.filter((e) => (e.shopId || DEFAULT_DEMO_SHOP_ID) === activeShopId).count(),
        db.openOrders.filter((o) => (o.shopId || DEFAULT_DEMO_SHOP_ID) === activeShopId && o.status === 'OPEN').count(),
      ]);
      setCounts({ products, sales, customers, payments, purchases, expenses, openOrders });
    } catch (err) {
      console.error('Failed to load storage counts', err);
    }
  };

  useEffect(() => {
    loadCounts();
    checkStoragePersistence().then(setStorageStatus);
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShopName.trim() || !editOwnerName.trim()) return;
    setIsSavingProfile(true);
    setProfileSuccess(null);
    try {
      const res = await updateProfile({
        shopName: editShopName.trim(),
        ownerName: editOwnerName.trim(),
      });
      if (res.success) {
        setIsEditingProfile(false);
        setProfileSuccess('Shop profile updated successfully');
        setTimeout(() => setProfileSuccess(null), 3000);
      } else {
        alert(res.error || 'Failed to update shop details');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Section 5: Manual Sync
  const handleManualSync = async () => {
    setSyncFeedbackMessage('Syncing...');
    setSyncResultCounts(null);
    const res = await manualSync();
    await loadCounts();

    if (res.success) {
      setSyncFeedbackMessage('✓ Backup complete');
    } else {
      setSyncFeedbackMessage(res.message || "⚠️ Some changes couldn't be backed up.");
    }

    setSyncResultCounts({
      synced: res.synced,
      pending: pendingCount,
      failed: res.failed,
    });
  };

  // Section 6: Export Backup (JSON)
  const handleExportBackup = async () => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      const activeShopId = authService.getCurrentShopId();
      const currentShopName = shop?.name || 'My Shop';
      const result = await backupService.exportBackup(activeShopId, currentShopName);
      if (result.success) {
        setExportNotice(`✓ Backup saved as ${result.filename}`);
        setTimeout(() => setExportNotice(null), 4000);
      }
    } catch {
      setExportNotice('⚠️ Failed to generate backup file.');
    } finally {
      setIsExporting(false);
    }
  };

  // Open Restore Modal & prepare preview
  const handleOpenRestoreModal = (tab: 'cloud' | 'file' = 'cloud') => {
    setRestoreTab(tab);
    setShowRestoreModal(true);
    setRestoreNotice(null);
    setSelectedFileValidation(null);
    setSelectedFileName(null);

    if (tab === 'cloud') {
      fetchCloudPreview();
    }
  };

  const fetchCloudPreview = async () => {
    setIsLoadingCloudPreview(true);
    setCloudPreviewError(null);
    try {
      const activeShopId = authService.getCurrentShopId();
      const preview = await syncService.getCloudPreview(activeShopId);
      if (preview.success) {
        setCloudPreview({
          shopName: preview.shopName,
          counts: preview.counts,
        });
      } else {
        setCloudPreviewError(preview.error || 'Could not fetch cloud backup info.');
      }
    } catch {
      setCloudPreviewError('Failed to connect to cloud backup server.');
    } finally {
      setIsLoadingCloudPreview(false);
    }
  };

  // File picker handler for JSON backup
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    setSelectedFileName(file.name);
    setSelectedFileValidation(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setIsReadingFile(false);
      const text = event.target?.result as string;
      const activeShopId = authService.getCurrentShopId();
      const validation = backupService.validateBackup(text, activeShopId);
      setSelectedFileValidation(validation);
    };
    reader.onerror = () => {
      setIsReadingFile(false);
      setSelectedFileValidation({
        valid: false,
        error: 'Failed to read selected file.',
      });
    };
    reader.readAsText(file);
  };

  // Execute Restore from File
  const handleExecuteFileRestore = async () => {
    if (!selectedFileValidation?.valid || !selectedFileValidation.backup) return;

    setIsRestoring(true);
    setRestoreNotice(null);
    try {
      const activeShopId = authService.getCurrentShopId();
      const res = await backupService.restoreBackup(selectedFileValidation.backup, activeShopId);
      if (res.success) {
        await loadCounts();
        setRestoreNotice({
          type: 'success',
          text: `✓ Successfully restored ${res.restoredCounts?.total || 0} shop records from file.`,
        });
        setTimeout(() => {
          setShowRestoreModal(false);
          setRestoreNotice(null);
        }, 1800);
      } else {
        setRestoreNotice({
          type: 'error',
          text: res.error || 'Restore failed. Previous data was kept intact.',
        });
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // Execute Restore from Cloud
  const handleExecuteCloudRestore = async () => {
    setIsRestoring(true);
    setRestoreNotice(null);
    try {
      const activeShopId = authService.getCurrentShopId();
      const res = await syncService.bootstrapFromCloud(activeShopId);
      if (res.success) {
        await loadCounts();
        setRestoreNotice({
          type: 'success',
          text: `✓ Successfully restored ${res.importedCount} shop records from cloud backup.`,
        });
        setTimeout(() => {
          setShowRestoreModal(false);
          setRestoreNotice(null);
        }, 1800);
      } else {
        setRestoreNotice({
          type: 'error',
          text: res.error || 'Cloud restore failed. Ensure your device is online.',
        });
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRequestPersist = async () => {
    setIsRequestingPersist(true);
    try {
      const granted = await requestStoragePersistence();
      setStorageStatus((prev) => ({ ...prev, isPersisted: granted }));
    } finally {
      setIsRequestingPersist(false);
    }
  };

  const handleInstallClick = async () => {
    const res = await promptInstall();
    if (res === 'accepted') {
      setInstallSuccessNotice('ShopFlow was installed to your home screen!');
    }
  };

  // Section 4: Determine if latest changes haven't been backed up
  const hasLocalRecords =
    counts.products > 0 ||
    counts.sales > 0 ||
    counts.customers > 0 ||
    counts.payments > 0 ||
    counts.purchases > 0 ||
    counts.expenses > 0 ||
    counts.openOrders > 0;

  const isBackupStale =
    isOnline &&
    (pendingCount > 0 ||
      failedCount > 0 ||
      (!lastSyncedAt && hasLocalRecords));

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-16">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-[#e5e5ea] p-5 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center text-xl shrink-0">
            ⚡
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1d1d1f] tracking-tight leading-none apple-tight">Settings</h2>
            <p className="text-xs text-[#86868b] mt-1 font-normal">ShopFlow &bull; Offline Android & Sync Configuration</p>
          </div>
        </div>
      </div>

      {installSuccessNotice && (
        <div className="bg-emerald-50/70 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{installSuccessNotice}</span>
        </div>
      )}

      {/* Profile & Shop Settings Section */}
      <section className="bg-white rounded-2xl border border-[#e5e5ea] p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#e5e5ea] pb-3">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-[#0066cc]" />
            <h3 className="font-bold text-[#1d1d1f] text-base apple-tight">Shop Profile</h3>
          </div>
          {!isEditingProfile ? (
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] text-xs font-semibold rounded-full transition-colors cursor-pointer active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Shop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingProfile(false)}
              className="text-xs text-[#86868b] hover:text-[#1d1d1f] cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

        {!isEditingProfile ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-[#1d1d1f] tracking-tight apple-tight">
                  {shop?.name || 'Sharma General Store'}
                </h4>
                <div className="flex items-center gap-2 text-xs text-[#86868b] mt-0.5">
                  <User className="w-3.5 h-3.5 text-[#86868b]" />
                  <span>
                    Owner: <strong className="text-[#1d1d1f] font-semibold">{user?.name || 'Raj Kumar'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#86868b] mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-[#86868b]" />
                  <span>
                    Phone: <strong className="text-[#1d1d1f] font-semibold">{user?.phone || '98XXXXXXXX'}</strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0066cc]/10 text-[#0066cc] text-[11px] font-semibold border border-[#0066cc]/20">
                  Active Shop
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#f5f5f7] flex items-center justify-between">
              <span className="text-xs text-[#86868b]">Shop ID: {shop?.id || 'demo'}</span>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-rose-600 text-xs font-semibold rounded-full transition-colors cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Name</label>
              <input
                type="text"
                value={editShopName}
                onChange={(e) => setEditShopName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Name</label>
              <input
                type="text"
                value={editOwnerName}
                onChange={(e) => setEditOwnerName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number (Read-only)</label>
              <input
                type="text"
                value={user?.phone || ''}
                disabled
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingProfile ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION: LOGGED IN DEVICES & SESSIONS */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Laptop className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-none">Logged in Devices</h3>
              <p className="text-xs text-slate-500 mt-1">Manage active sessions connected to your shop account</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoadingSessions}
            onClick={fetchSessions}
            title="Refresh devices"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingSessions ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {sessionFeedback && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
              sessionFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {sessionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{sessionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSessionFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {isLoadingSessions ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
            <span>Checking logged-in devices...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((sess) => {
              const isCurrent = sess.isCurrent;
              const formattedDate = new Date(sess.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              // Resolve friendly display name
              const displayName = sess.deviceName
                ? sess.deviceName
                : isCurrent
                ? `${getDeviceLabel()} (This Device)`
                : 'Connected Device';

              const isMobile =
                displayName.toLowerCase().includes('phone') ||
                displayName.toLowerCase().includes('android') ||
                displayName.toLowerCase().includes('iphone');

              return (
                <div
                  key={sess.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-blue-50/30 border-[#0066cc]/30 shadow-2xs'
                      : 'bg-[#f5f5f7]/60 border-[#e5e5ea] hover:bg-[#f5f5f7]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'bg-[#0066cc] text-white shadow-2xs'
                          : 'bg-white border border-[#e5e5ea] text-[#1d1d1f]'
                      }`}
                    >
                      {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-[#1d1d1f] truncate apple-tight">
                          {displayName}
                        </h4>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Current Device
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-[#e5e5ea] text-[#1d1d1f] text-[10px] font-medium">
                            Active Session
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#86868b] mt-1 flex-wrap">
                        <span>Signed in: {formattedDate}</span>
                        {sess.deviceId && (
                          <>
                            <span className="text-[#86868b]">•</span>
                            <span className="font-mono text-[10px] text-[#86868b] max-w-[150px]">
                              ID: {sess.deviceId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e5e5ea]">
                    {isCurrent ? (
                      <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-rose-600 text-xs font-semibold rounded-full transition-colors cursor-pointer active:scale-95"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Log Out</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSessionToTerminate(sess)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-rose-50 border border-[#e5e5ea] hover:border-rose-200 text-rose-600 text-xs font-semibold rounded-full transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Terminate Session</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Terminate All Other Sessions Button */}
            {sessions.filter((s) => !s.isCurrent).length > 0 && (
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowTerminateAllConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Terminate All Other Sessions ({sessions.filter((s) => !s.isCurrent).length})</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION 1: DATA & BACKUP (STEP 9 CORE REQUIREMENT) */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">Data & Backup</h3>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            Secure Recovery
          </span>
        </div>

        {/* Section 4: Subtle Warning Banner if latest changes haven't been backed up */}
        {isBackupStale && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-950">
                  ⚠️ Your latest changes haven't been backed up yet.
                </h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {pendingCount > 0
                    ? `${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting to sync.`
                    : `Last backup: ${formatLastSyncTime(lastSyncedAt)}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSync}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
            </button>
          </div>
        )}

        {/* Section 2: Cloud Backup Status Box */}
        <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Cloud Backup
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {/* Section 2: Clear States */}
                {!isOnline ? (
                  <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                    <CloudOff className="w-4 h-4 text-slate-500" />
                    <span>● Offline</span>
                  </span>
                ) : failedCount > 0 ? (
                  <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>⚠️ {failedCount} changes couldn't sync</span>
                  </span>
                ) : pendingCount > 0 ? (
                  <span className="text-sm font-bold text-blue-600 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                    <span>↻ {pendingCount} changes waiting to sync</span>
                  </span>
                ) : (
                  <span className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                    <CloudCheck className="w-4 h-4 text-emerald-600" />
                    <span>✓ Up to date</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {!isOnline
                  ? 'Changes will sync automatically when internet returns.'
                  : pendingCount === 0 && failedCount === 0
                  ? 'All data backed up'
                  : 'Automatic background backup enabled'}
              </p>
            </div>

            {/* Section 3: Last Backup Time & Pending */}
            <div className="sm:text-right text-xs text-slate-600 space-y-0.5">
              <div>
                <span className="text-slate-400 font-medium">Last backup: </span>
                <strong className="text-slate-800">{formatLastSyncTime(lastSyncedAt)}</strong>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Pending: </span>
                <strong className="text-slate-800">{pendingCount} changes</strong>
              </div>
              {failedCount > 0 && (
                <div>
                  <span className="text-amber-600 font-medium">Failed: </span>
                  <strong className="text-amber-700">{failedCount} changes</strong>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Sync Result Feedback Details */}
          {(syncFeedbackMessage || syncResultCounts) && (
            <div className="bg-white rounded-xl p-3 border border-slate-200/90 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-slate-800">{syncFeedbackMessage || 'Sync complete'}</span>
              {syncResultCounts && (
                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                  <span className="text-emerald-700 font-bold">Synced: {syncResultCounts.synced}</span>
                  <span className="text-blue-700">Pending: {syncResultCounts.pending}</span>
                  <span className={syncResultCounts.failed > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}>
                    Failed: {syncResultCounts.failed}
                  </span>
                </div>
              )}
            </div>
          )}

          {exportNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportNotice}</span>
            </div>
          )}

          {/* Section 1, 5, 6, 8: The Three Core Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* [ Sync Now ] */}
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSync}
              className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer tap-press"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            {/* [ Backup / Export ] */}
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportBackup}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer tap-press"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>{isExporting ? 'Exporting...' : 'Backup / Export'}</span>
            </button>

            {/* [ Restore ] */}
            <button
              type="button"
              onClick={() => handleOpenRestoreModal('cloud')}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer tap-press"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Restore</span>
            </button>
          </div>
        </div>

        {/* Section 16: Data Counts Display */}
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Records Summary
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-semibold block">Products</span>
              <strong className="text-base text-slate-900 mt-0.5 block">{counts.products}</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-semibold block">Customers</span>
              <strong className="text-base text-slate-900 mt-0.5 block">{counts.customers}</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-semibold block">Sales</span>
              <strong className="text-base text-blue-700 mt-0.5 block">{counts.sales}</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-semibold block">Payments</span>
              <strong className="text-base text-purple-700 mt-0.5 block">{counts.payments}</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-semibold block">Purchases</span>
              <strong className="text-base text-emerald-700 mt-0.5 block">{counts.purchases}</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
              <span className="text-[10px] text-slate-500 font-semibold block">Expenses</span>
              <strong className="text-base text-rose-700 mt-0.5 block">{counts.expenses}</strong>
            </div>
          </div>
        </div>

        {/* Section 17 & 18: Storage Health Reassurance */}
        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Device data</h4>
              <p className="text-[11px] text-slate-500">
                Your shop data is stored securely on this device.
              </p>
            </div>
          </div>

          {!storageStatus.isPersisted && storageStatus.isSupported && (
            <button
              type="button"
              disabled={isRequestingPersist}
              onClick={handleRequestPersist}
              className="text-xs bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              {isRequestingPersist ? 'Checking...' : 'Protect Storage'}
            </button>
          )}

          {syncedCount > 0 && (
            <button
              type="button"
              onClick={async () => {
                await clearSynced();
                setSyncFeedbackMessage('✓ Queue cleaned');
              }}
              title="Clear already-synced history from local queue to free space"
              className="text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Clear synced queue ({syncedCount})
            </button>
          )}
        </div>
      </section>

      {/* App & Install Section */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Smartphone className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-base">App Installation</h3>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Install ShopFlow</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Install as a standalone Android app for full screen one-handed counter usage.
              </p>
            </div>

            {isStandalone ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100/70 border border-emerald-300 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>ShopFlow is installed</span>
              </div>
            ) : hasPrompt ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer tap-press"
              >
                <Download className="w-4 h-4" />
                <span>Install ShopFlow</span>
              </button>
            ) : (
              <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
                Tap browser menu (⋮) → <strong className="text-slate-800">Install app</strong>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* App Version Info */}
      <div className="text-center py-2 text-xs text-slate-400">
        <p className="font-semibold text-slate-500">ShopFlow &bull; Offline First POS</p>
        <p className="mt-0.5">Cloudflare D1 Cloud Sync &bull; Secure Local Isolation</p>
      </div>

      {/* ========================================================================= */}
      {/* RESTORE MODAL (FILE BACKUP + CLOUD BACKUP) (SECTIONS 8, 9, 10, 11, 12, 14, 15) */}
      {/* ========================================================================= */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Restore Shop Data</h3>
                  <p className="text-xs text-slate-500">Recover your shop catalog and transactions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab switch: Cloud Restore vs File Restore */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setRestoreTab('cloud');
                  fetchCloudPreview();
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  restoreTab === 'cloud'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Cloud Backup</span>
              </button>
              <button
                type="button"
                onClick={() => setRestoreTab('file')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  restoreTab === 'file'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>JSON File</span>
              </button>
            </div>

            {/* Notice banner */}
            {restoreNotice && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  restoreNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {restoreNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{restoreNotice.text}</span>
              </div>
            )}

            {/* TAB 1: CLOUD RESTORE */}
            {restoreTab === 'cloud' && (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Cloud Backup Target
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {cloudPreview?.shopName || shop?.name || 'Your Shop'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Last cloud backup: {formatLastSyncTime(lastSyncedAt)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      Cloudflare D1
                    </span>
                  </div>

                  {isLoadingCloudPreview ? (
                    <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking cloud records...</span>
                    </div>
                  ) : cloudPreviewError ? (
                    <div className="bg-amber-50 text-amber-800 p-2.5 rounded-xl text-xs border border-amber-200">
                      {cloudPreviewError}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-200/60 text-center">
                      <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Products</span>
                        <strong className="text-xs text-slate-900">
                          {cloudPreview?.counts?.products ?? '—'}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Customers</span>
                        <strong className="text-xs text-slate-900">
                          {cloudPreview?.counts?.customers ?? '—'}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Sales</span>
                        <strong className="text-xs text-blue-700">
                          {cloudPreview?.counts?.sales ?? '—'}
                        </strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Open Orders</span>
                        <strong className="text-xs text-amber-700">
                          {cloudPreview?.counts?.openOrders ?? '—'}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 14 & 15: Warning & Safeguards */}
                <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200/90 text-xs text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-amber-950">Restore ShopFlow data?</h5>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        This will replace the current local shop data on this device with cloud backup.
                      </p>
                    </div>
                  </div>

                  {/* Section 15 & 27: Offer Export Local Data First if local data exists */}
                  {hasLocalRecords && (
                    <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between">
                      <span className="text-[11px] text-amber-900 font-semibold">Existing shop data found.</span>
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs"
                      >
                        <FileDown className="w-3 h-3" />
                        <span>Export Local Backup First</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(false)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    disabled={isRestoring || isLoadingCloudPreview || !isOnline}
                    onClick={handleExecuteCloudRestore}
                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isRestoring ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Restoring...</span>
                      </>
                    ) : (
                      <span>RESTORE</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: RESTORE FROM JSON FILE (SECTIONS 8, 9, 10, 11) */}
            {restoreTab === 'file' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!selectedFileValidation ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center space-y-2 cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/30"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
                      <FileJson className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {isReadingFile ? 'Reading file...' : 'Choose ShopFlow Backup File'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Select a .json file exported from ShopFlow
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs pointer-events-none"
                    >
                      Browse Files
                    </button>
                  </div>
                ) : !selectedFileValidation.valid ? (
                  /* Section 9 & 11: Validation error rejection */
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3 text-rose-900">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-rose-950">
                          {selectedFileValidation.error || 'Backup file is invalid or unsupported.'}
                        </h5>
                        <p className="text-[11px] text-rose-800 mt-1">
                          File: <strong>{selectedFileName}</strong>
                        </p>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          Corrupted or incompatible backups are safely rejected. Existing shop data has not
                          been altered.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 bg-white hover:bg-rose-100/50 border border-rose-300 text-rose-800 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Choose Different File
                    </button>
                  </div>
                ) : (
                  /* Valid backup file confirmed */
                  <div className="space-y-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Valid Backup File
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                            {selectedFileValidation.backup?.shopName || 'Shop'}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-blue-600 hover:underline font-semibold"
                        >
                          Change
                        </button>
                      </div>

                      <p className="text-xs text-slate-500">
                        Exported:{' '}
                        {selectedFileValidation.backup?.exportedAt
                          ? new Date(selectedFileValidation.backup.exportedAt).toLocaleDateString()
                          : 'Recently'}
                      </p>

                      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-200 text-center">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 font-semibold block">Products</span>
                          <strong className="text-xs text-slate-900">
                            {selectedFileValidation.counts?.products}
                          </strong>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 font-semibold block">Customers</span>
                          <strong className="text-xs text-slate-900">
                            {selectedFileValidation.counts?.customers}
                          </strong>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 font-semibold block">Sales</span>
                          <strong className="text-xs text-blue-700">
                            {selectedFileValidation.counts?.sales}
                          </strong>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="text-[10px] text-slate-400 font-semibold block">Open Orders</span>
                          <strong className="text-xs text-amber-700">
                            {selectedFileValidation.counts?.openOrders ?? 0}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Warning & Export option */}
                    <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200/90 text-xs text-amber-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="font-bold text-amber-950">Restore ShopFlow data?</h5>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            This will replace the current local shop data with records from this backup file.
                          </p>
                        </div>
                      </div>

                      {hasLocalRecords && (
                        <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between">
                          <span className="text-[11px] text-amber-900 font-semibold">Existing local data.</span>
                          <button
                            type="button"
                            onClick={handleExportBackup}
                            className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs"
                          >
                            <FileDown className="w-3 h-3" />
                            <span>Export Local First</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowRestoreModal(false)}
                        className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={handleExecuteFileRestore}
                        className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isRestoring ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Restoring...</span>
                          </>
                        ) : (
                          <span>RESTORE</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog (Section 23, 24) */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Log out of ShopFlow?</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                <strong>Your shop data is stored on this device.</strong> Logging out will not delete your sales,
                inventory, or customers.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-500">
              You can log back in with your mobile number and PIN to access this shop.
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutConfirm(false);
                  await logout();
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
              >
                Confirm Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Specific Device Session Confirmation Dialog */}
      {sessionToTerminate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold border border-rose-200">
              <LogOut className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Terminate Device Session?</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                This will immediately log out <strong>{sessionToTerminate.deviceName || 'that device'}</strong>.
                It will need to enter phone number and PIN to access this shop again.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSessionToTerminate(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTerminatingSession}
                onClick={handleConfirmTerminateSession}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                {isTerminatingSession ? 'Terminating...' : 'Terminate Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate All Other Sessions Confirmation Dialog */}
      {showTerminateAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl font-bold border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Terminate All Other Sessions?</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                All other devices currently logged into this shop will be logged out immediately. Only this current device will stay logged in.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTerminateAllConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTerminatingSession}
                onClick={handleConfirmTerminateAllOthers}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                {isTerminatingSession ? 'Terminating...' : 'Yes, Terminate All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
