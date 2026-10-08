import { db } from '../db';
import type { SyncQueueItem, SyncOperation, SyncStatus } from '../types';
import { generateId } from '../lib/utils';
import { api, DEFAULT_DEMO_SHOP_ID } from '../lib/api';

// Exponential backoff intervals in milliseconds: 5s, 15s, 30s, 1m, 5m (Section 35)
const BACKOFF_INTERVALS = [5000, 15000, 30000, 60000, 300000];

export interface SyncStats {
  pendingCount: number;
  failedCount: number;
  syncingCount: number;
  syncedCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

type SyncListener = (stats: SyncStats) => void;

class SyncService {
  private isSyncing = false;
  private hasPendingSyncRequest = false;
  private enqueueDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncedAt: string | null =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('shopflow_last_successful_sync_at')
      : null;
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private periodicInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  constructor() {
    this.setupListeners();
  }

  // Subscribe to live sync stats updates
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  // Teardown method for test cleanup or app unmount
  destroy() {
    if (this.enqueueDebounceTimer) {
      clearTimeout(this.enqueueDebounceTimer);
      this.enqueueDebounceTimer = null;
    }
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.listeners.clear();
  }

  private async notify() {
    const stats = await this.getStats();
    for (const listener of this.listeners) {
      try {
        listener(stats);
      } catch (err) {
        console.error('Sync listener error:', err);
      }
    }
  }

  // Setup automatic triggers (Section 15)
  private setupListeners() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // 1. Browser comes online
    window.addEventListener('online', () => {
      console.log('Network online detected. Triggering sync...');
      this.syncPendingEvents();
    });

    // 2. User returns to app (visibility change & focus)
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncPendingEvents();
      }
    });

    window.addEventListener('focus', () => {
      this.syncPendingEvents();
    });

    // 3. Periodic retry check (every 15 seconds for pending/failed items)
    this.periodicInterval = setInterval(async () => {
      const pending = await this.getPendingCount();
      if (pending > 0 && navigator.onLine && !this.isSyncing) {
        this.syncPendingEvents();
      }
    }, 15000);

    // Initial sync check on startup
    setTimeout(() => {
      this.syncPendingEvents();
    }, 1000);
  }

  // Enqueue a local business action for synchronization
  async enqueue(
    entity: SyncQueueItem['entity'],
    entityId: string,
    operation: SyncOperation,
    payload: Record<string, unknown>,
    shopId?: string
  ): Promise<string> {
    const now = new Date().toISOString();
    const item: SyncQueueItem = {
      id: generateId('sync'),
      shopId: shopId || api.getShopId() || DEFAULT_DEMO_SHOP_ID,
      entity,
      entityId,
      operation,
      payload,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.syncQueue.add(item);
    this.notify();

    // Trigger immediate async sync if online (debounced so multi-entity transactions batch together)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      if (this.enqueueDebounceTimer) {
        clearTimeout(this.enqueueDebounceTimer);
      }
      this.enqueueDebounceTimer = setTimeout(() => {
        this.enqueueDebounceTimer = null;
        this.syncPendingEvents();
      }, 50);
    }

    return item.id;
  }

  // Get total pending + failed events
  // Get total pending + failed events (Section 25)
  async getPendingCount(targetShopId?: string): Promise<number> {
    try {
      const currentShopId = targetShopId || api.getShopId();
      const items = await db.syncQueue
        .where('status')
        .anyOf('PENDING', 'FAILED')
        .filter((item) => (item.shopId || DEFAULT_DEMO_SHOP_ID) === currentShopId)
        .count();
      return items;
    } catch {
      return 0;
    }
  }

  // Get current detailed stats (Section 25)
  async getStats(targetShopId?: string): Promise<SyncStats> {
    try {
      const currentShopId = targetShopId || api.getShopId();
      const [pendingCount, failedCount, syncingCount, syncedCount] = await Promise.all([
        db.syncQueue.where('status').equals('PENDING').filter((i) => (i.shopId || DEFAULT_DEMO_SHOP_ID) === currentShopId).count(),
        db.syncQueue.where('status').equals('FAILED').filter((i) => (i.shopId || DEFAULT_DEMO_SHOP_ID) === currentShopId).count(),
        db.syncQueue.where('status').equals('SYNCING').filter((i) => (i.shopId || DEFAULT_DEMO_SHOP_ID) === currentShopId).count(),
        db.syncQueue.where('status').equals('SYNCED').filter((i) => (i.shopId || DEFAULT_DEMO_SHOP_ID) === currentShopId).count(),
      ]);

      return {
        pendingCount,
        failedCount,
        syncingCount,
        syncedCount,
        isSyncing: this.isSyncing,
        lastSyncedAt: this.lastSyncedAt,
        lastError: this.lastError,
      };
    } catch {
      return {
        pendingCount: 0,
        failedCount: 0,
        syncingCount: 0,
        syncedCount: 0,
        isSyncing: this.isSyncing,
        lastSyncedAt: this.lastSyncedAt,
        lastError: this.lastError,
      };
    }
  }

  // Main synchronization engine (Section 14, 21, 22, 25)
  async syncPendingEvents(force = false, targetShopId?: string): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    error?: string;
  }> {
    // If offline, do nothing
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, synced: 0, failed: 0, error: 'Offline' };
    }

    if (this.isSyncing && !force) {
      this.hasPendingSyncRequest = true;
      return { success: false, synced: 0, failed: 0, error: 'Already syncing' };
    }

    this.isSyncing = true;
    this.notify();

    try {
      const currentShopId = targetShopId || api.getShopId();

      // 1. Load pending and failed events strictly for active shop (Section 22, 25)
      let itemsToSync: SyncQueueItem[] = [];
      if (force) {
        itemsToSync = await db.syncQueue
          .where('status')
          .anyOf('PENDING', 'FAILED', 'SYNCING')
          .filter((item) => (item.shopId || DEFAULT_DEMO_SHOP_ID) === currentShopId)
          .toArray();
      } else {
        itemsToSync = await db.syncQueue
          .where('status')
          .anyOf('PENDING', 'FAILED')
          .filter((item) => (item.shopId || DEFAULT_DEMO_SHOP_ID) === currentShopId)
          .toArray();
      }

      if (itemsToSync.length === 0) {
        this.lastSyncedAt = new Date().toISOString();
        try {
          localStorage.setItem('shopflow_last_successful_sync_at', this.lastSyncedAt);
        } catch {
          // ignore
        }
        this.isSyncing = false;
        this.notify();
        return { success: true, synced: 0, failed: 0 };
      }

      // Sort strictly by createdAt ascending and respect dependency tier (Section 15: Category -> Brand -> Product)
      const ENTITY_DEPENDENCY_TIER: Record<string, number> = {
        categories: 1,
        brands: 2,
        products: 3,
        suppliers: 4,
        customers: 5,
        purchases: 6,
        sales: 7,
        saleItems: 8,
        payments: 9,
        inventoryMovements: 10,
        expenses: 11,
      };

      itemsToSync.sort((a, b) => {
        const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        const tierA = ENTITY_DEPENDENCY_TIER[a.entity] ?? 50;
        const tierB = ENTITY_DEPENDENCY_TIER[b.entity] ?? 50;
        return tierA - tierB;
      });

      // Mark items as SYNCING locally
      const now = new Date().toISOString();
      await db.syncQueue
        .where('id')
        .anyOf(itemsToSync.map((item) => item.id))
        .modify({ status: 'SYNCING' as SyncStatus, updatedAt: now });

      this.notify();

      // 2. Send batch to Cloudflare Worker
      const response = await api.sync(itemsToSync, currentShopId);

      // 3. Mark successful events as SYNCED
      if (response.successful && response.successful.length > 0) {
        await db.syncQueue
          .where('id')
          .anyOf(response.successful)
          .modify({ status: 'SYNCED' as SyncStatus, updatedAt: new Date().toISOString() });
      }

      // 4. Mark failed events as FAILED with exponential backoff bookkeeping
      if (response.failed && response.failed.length > 0) {
        for (const failure of response.failed) {
          const item = itemsToSync.find((i) => i.id === failure.id);
          const currentAttempts = (item?.attempts || 0) + 1;
          await db.syncQueue.update(failure.id, {
            status: 'FAILED',
            attempts: currentAttempts,
            lastAttemptAt: new Date().toISOString(),
            errorMessage: failure.error,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      this.lastSyncedAt = new Date().toISOString();
      if (response.failed.length === 0) {
        try {
          localStorage.setItem('shopflow_last_successful_sync_at', this.lastSyncedAt);
        } catch {
          // ignore
        }
      }
      this.lastError = response.failed.length > 0 ? `${response.failed.length} items failed` : null;

      // Schedule next backoff retry if any failed
      if (response.failed.length > 0) {
        this.scheduleBackoffRetry(1);
      }

      return {
        success: response.failed.length === 0,
        synced: response.successful.length,
        failed: response.failed.length,
      };
    } catch (err: any) {
      console.warn('Sync connection error (local data remains 100% safe):', err?.message);
      this.lastError = err?.message || 'Network error';

      // Revert items from SYNCING back to PENDING so they are not lost
      try {
        await db.syncQueue
          .where('status')
          .equals('SYNCING')
          .modify({ status: 'PENDING' as SyncStatus, updatedAt: new Date().toISOString() });
      } catch {
        // ignore
      }

      this.scheduleBackoffRetry(1);
      return { success: false, synced: 0, failed: 0, error: err?.message };
    } finally {
      this.isSyncing = false;
      this.notify();

      if (this.hasPendingSyncRequest) {
        this.hasPendingSyncRequest = false;
        setTimeout(() => {
          if (typeof navigator !== 'undefined' && navigator.onLine && !this.isSyncing) {
            this.syncPendingEvents();
          }
        }, 50);
      }
    }
  }

  // Schedule next retry with exponential backoff (Section 35)
  private scheduleBackoffRetry(attempt: number) {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);

    const backoffMs =
      BACKOFF_INTERVALS[Math.min(attempt - 1, BACKOFF_INTERVALS.length - 1)] || 5000;

    this.retryTimeout = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.syncPendingEvents();
      }
    }, backoffMs);
  }

  // Manual trigger for Settings screen (Section 16)
  async manualSync(): Promise<{ success: boolean; synced: number; failed: number; message: string }> {
    const res = await this.syncPendingEvents(true);
    if (!navigator.onLine) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'Device is offline. Connect to internet to sync.',
      };
    }

    if (res.success) {
      return {
        success: true,
        synced: res.synced,
        failed: 0,
        message: 'Everything is synced to cloud.',
      };
    }

    return {
      success: false,
      synced: res.synced,
      failed: res.failed,
      message: res.error || `${res.failed} items couldn't sync. Tap to retry.`,
    };
  }

  // Clear already synced items from IndexedDB
  async clearSynced(): Promise<number> {
    const count = await db.syncQueue.where('status').equals('SYNCED').count();
    await db.syncQueue.where('status').equals('SYNCED').delete();
    this.notify();
    return count;
  }

  // Human-friendly time helper (Section 3)
  formatLastSyncTime(isoStr?: string | null): string {
    const target = isoStr !== undefined ? isoStr : this.lastSyncedAt;
    if (!target) return 'Not backed up yet';

    try {
      const date = new Date(target);
      if (isNaN(date.getTime())) return 'Not backed up yet';

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;

      const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) return `Today, ${timeStr}`;

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

      if (isYesterday) return `Yesterday, ${timeStr}`;

      const dateFormatted = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
      return `${dateFormatted}, ${timeStr}`;
    } catch {
      return 'Recently';
    }
  }

  // Preview cloud records before restoring (Section 14)
  async getCloudPreview(shopId?: string): Promise<{
    success: boolean;
    shopName?: string;
    counts?: {
      products: number;
      customers: number;
      sales: number;
      payments: number;
      purchases: number;
      expenses: number;
      total: number;
    };
    error?: string;
  }> {
    try {
      const data = await api.bootstrap(shopId);
      const counts = {
        products: data.products?.length || 0,
        customers: data.customers?.length || 0,
        sales: data.sales?.length || 0,
        payments: data.payments?.length || 0,
        purchases: data.purchases?.length || 0,
        expenses: data.expenses?.length || 0,
        total:
          (data.products?.length || 0) +
          (data.customers?.length || 0) +
          (data.sales?.length || 0) +
          (data.payments?.length || 0) +
          (data.purchases?.length || 0) +
          (data.expenses?.length || 0),
      };
      return {
        success: true,
        shopName: data.shop?.name || 'Your Shop',
        counts,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to fetch cloud backup information',
      };
    }
  }

  // Bootstrap data from cloud into local IndexedDB for initial setup or recovery (Section 12, 13, 14, 20)
  async bootstrapFromCloud(shopId?: string): Promise<{
    success: boolean;
    importedCount: number;
    counts?: Record<string, number>;
    error?: string;
  }> {
    const targetShopId = shopId || api.getShopId() || DEFAULT_DEMO_SHOP_ID;

    try {
      const data = await api.bootstrap(targetShopId);
      let count = 0;

      await db.transaction(
        'rw',
        [
          db.categories,
          db.brands,
          db.products,
          db.customers,
          db.sales,
          db.saleItems,
          db.payments,
          db.purchases,
          db.suppliers,
          db.inventoryMovements,
          db.expenses,
        ],
        async () => {
          // Clear current local records for this shop to prevent duplicates
          await Promise.all([
            db.categories.filter((c) => (c.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.brands.filter((b) => (b.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.products.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.customers.filter((c) => (c.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.sales.filter((s) => (s.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.saleItems.filter((si) => (si.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.payments.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.purchases.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.suppliers.filter((s) => (s.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.inventoryMovements.filter((im) => (im.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.expenses.filter((e) => (e.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
          ]);

          // 1. Categories
          if (data.categories && data.categories.length > 0) {
            for (const cat of data.categories) {
              await db.categories.put({
                id: cat.id,
                shopId: targetShopId,
                name: cat.name,
                icon: cat.icon || 'package',
                sortOrder: Number(cat.sort_order ?? cat.sortOrder ?? 0),
                isActive: cat.is_active !== 0 && cat.isActive !== false,
                createdAt: cat.created_at || cat.createdAt || new Date().toISOString(),
                updatedAt: cat.updated_at || cat.updatedAt || new Date().toISOString(),
              });
              count++;
            }
          }

          // 2. Brands
          if (data.brands && data.brands.length > 0) {
            for (const br of data.brands) {
              await db.brands.put({
                id: br.id,
                shopId: targetShopId,
                categoryId: br.category_id || br.categoryId,
                name: br.name,
                sortOrder: Number(br.sort_order ?? br.sortOrder ?? 0),
                isActive: br.is_active !== 0 && br.isActive !== false,
                createdAt: br.created_at || br.createdAt || new Date().toISOString(),
                updatedAt: br.updated_at || br.updatedAt || new Date().toISOString(),
              });
              count++;
            }
          }

          // 3. Products
          if (data.products && data.products.length > 0) {
            for (const p of data.products) {
              await db.products.put({
                id: p.id,
                shopId: targetShopId,
                name: p.name,
                emoji: p.emoji || '📦',
                sellingPrice: Number(p.selling_price || 0),
                costPrice: Number(p.cost_price || 0),
                stock: Number(p.stock || 0),
                minStock: Number(p.min_stock || 5),
                openingStock: Number(p.opening_stock ?? p.stock ?? 0),
                category: p.category || 'Other',
                categoryId: p.category_id || p.categoryId || null,
                brandId: p.brand_id || p.brandId || null,
                sku: p.sku || undefined,
                barcode: p.barcode || undefined,
                active: p.active !== 0,
                createdAt: p.created_at || new Date().toISOString(),
                updatedAt: p.updated_at || new Date().toISOString(),
              });
              count++;
            }
          }

          // 2. Customers
          if (data.customers && data.customers.length > 0) {
            for (const c of data.customers) {
              await db.customers.put({
                id: c.id,
                shopId: targetShopId,
                name: c.name,
                phone: c.phone || undefined,
                balance: Number(c.balance || 0),
                notes: c.notes || undefined,
                createdAt: c.created_at || new Date().toISOString(),
                updatedAt: c.updated_at || new Date().toISOString(),
              });
              count++;
            }
          }

          // 3. Sales
          if (data.sales && data.sales.length > 0) {
            for (const s of data.sales) {
              await db.sales.put({
                id: s.id,
                shopId: targetShopId,
                saleNumber: s.sale_number || '#1000',
                customerId: s.customer_id || undefined,
                customerName: s.customer_name || undefined,
                totalAmount: Number(s.total || 0),
                paymentStatus: s.payment_status || 'PAID',
                paymentMethod: s.payment_method || undefined,
                itemCount: Number(s.item_count || 0),
                notes: s.notes || undefined,
                createdAt: s.created_at || new Date().toISOString(),
                updatedAt: s.updated_at || new Date().toISOString(),
              });
              count++;
            }
          }

          // 4. Sale Items
          if (data.saleItems && data.saleItems.length > 0) {
            for (const si of data.saleItems) {
              await db.saleItems.put({
                id: si.id,
                shopId: targetShopId,
                saleId: si.sale_id || si.saleId,
                productId: si.product_id || si.productId,
                productName: si.product_name || si.productName || 'Product',
                productEmoji: si.product_emoji || si.productEmoji || '📦',
                quantity: Number(si.quantity || 1),
                unitPrice: Number(si.unit_price ?? si.unitPrice ?? 0),
                totalPrice: Number(si.total_price ?? si.totalPrice ?? 0),
                unitCost: Number(si.unit_cost ?? si.unitCost ?? 0),
                createdAt: si.created_at || si.createdAt || new Date().toISOString(),
                updatedAt: si.updated_at || si.updatedAt || new Date().toISOString(),
              });
              count++;
            }
          }

          // 5. Payments
          if (data.payments && data.payments.length > 0) {
            for (const pay of data.payments) {
              await db.payments.put({
                id: pay.id,
                shopId: targetShopId,
                customerId: pay.customer_id || pay.customerId,
                amount: Number(pay.amount || 0),
                paymentMethod: pay.payment_method || pay.paymentMethod || 'CASH',
                note: pay.notes || pay.note || undefined,
                createdAt: pay.created_at || pay.createdAt || new Date().toISOString(),
                updatedAt: pay.updated_at || pay.updatedAt || new Date().toISOString(),
              });
              count++;
            }
          }

          // 6. Purchases
          if (data.purchases && data.purchases.length > 0) {
            for (const pur of data.purchases) {
              await db.purchases.put({
                id: pur.id,
                shopId: targetShopId,
                productId: pur.product_id || pur.productId,
                productName: pur.product_name || pur.productName || 'Product',
                quantity: Number(pur.quantity || 0),
                unitCost: Number(pur.unit_cost ?? pur.unitCost ?? 0),
                totalCost: Number(pur.total_cost ?? pur.totalCost ?? 0),
                supplierId: pur.supplier_id || pur.supplierId || undefined,
                supplierName: pur.supplier_name || pur.supplierName || undefined,
                note: pur.notes || pur.note || undefined,
                createdAt: pur.created_at || pur.createdAt || new Date().toISOString(),
                updatedAt: pur.updated_at || pur.updatedAt || new Date().toISOString(),
              });
              count++;
            }
          }

          // 7. Inventory Movements
          if (data.inventoryMovements && data.inventoryMovements.length > 0) {
            for (const im of data.inventoryMovements) {
              await db.inventoryMovements.put({
                id: im.id,
                shopId: targetShopId,
                productId: im.product_id || im.productId,
                type: im.type || 'SALE',
                quantity: Number(im.quantity || 0),
                previousStock: Number(im.previous_stock ?? im.previousStock ?? 0),
                newStock: Number(im.new_stock ?? im.balance_after ?? im.newStock ?? 0),
                referenceId: im.reference_id || im.referenceId || undefined,
                note: im.notes || im.note || undefined,
                createdAt: im.created_at || im.createdAt || new Date().toISOString(),
                updatedAt: im.updated_at || im.updatedAt || new Date().toISOString(),
              });
              count++;
            }
          }

          // 8. Expenses
          if (data.expenses && data.expenses.length > 0) {
            for (const exp of data.expenses) {
              await db.expenses.put({
                id: exp.id,
                shopId: targetShopId,
                amount: Number(exp.amount || 0),
                category: exp.category || 'Other',
                note: exp.note || exp.notes || exp.title || undefined,
                createdAt: exp.created_at || exp.createdAt || new Date().toISOString(),
                updatedAt: exp.updated_at || exp.updatedAt || new Date().toISOString(),
              });
              count++;
            }
          }

          // 9. Suppliers
          if (data.suppliers && data.suppliers.length > 0) {
            for (const sup of data.suppliers) {
              await db.suppliers.put({
                id: sup.id,
                shopId: targetShopId,
                name: sup.name,
                phone: sup.phone || undefined,
                notes: sup.notes || undefined,
                createdAt: sup.created_at || sup.createdAt || new Date().toISOString(),
                updatedAt: sup.updated_at || sup.updatedAt || new Date().toISOString(),
              });
              count++;
            }
          }
        }
      );

      this.lastSyncedAt = new Date().toISOString();
      try {
        localStorage.setItem('shopflow_last_successful_sync_at', this.lastSyncedAt);
      } catch {
        // ignore
      }

      this.notify();
      return {
        success: true,
        importedCount: count,
        counts: {
          products: data.products?.length || 0,
          customers: data.customers?.length || 0,
          sales: data.sales?.length || 0,
          payments: data.payments?.length || 0,
          purchases: data.purchases?.length || 0,
          expenses: data.expenses?.length || 0,
        },
      };
    } catch (err: any) {
      console.error('Bootstrap error:', err);
      return { success: false, importedCount: 0, error: err?.message };
    }
  }
}

export const syncService = new SyncService();
