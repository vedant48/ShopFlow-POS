import { db } from '../db';
import type {
  Product,
  Category,
  Brand,
  Customer,
  Sale,
  SaleItem,
  Payment,
  Purchase,
  Supplier,
  InventoryMovement,
  Expense,
  OpenOrder,
  OpenOrderItem,
} from '../types';
import { DEFAULT_DEMO_SHOP_ID } from '../lib/api';

export interface ShopFlowBackupData {
  categories?: Category[];
  brands?: Brand[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  saleItems: SaleItem[];
  payments: Payment[];
  purchases: Purchase[];
  suppliers?: Supplier[];
  inventoryMovements: InventoryMovement[];
  expenses: Expense[];
  openOrders?: OpenOrder[];
  openOrderItems?: OpenOrderItem[];
}

export interface ShopFlowBackup {
  format: 'shopflow-backup';
  version: 1;
  exportedAt: string;
  shopId: string;
  shopName: string;
  data: ShopFlowBackupData;
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  backup?: ShopFlowBackup;
  counts?: {
    categories?: number;
    brands?: number;
    products: number;
    customers: number;
    sales: number;
    payments: number;
    purchases: number;
    expenses: number;
    total: number;
  };
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  restoredCounts?: {
    categories?: number;
    brands?: number;
    products: number;
    customers: number;
    sales: number;
    saleItems: number;
    payments: number;
    purchases: number;
    inventoryMovements: number;
    expenses: number;
    total: number;
  };
}

class BackupService {
  /**
   * Export the authenticated shop's data into a clean, versioned JSON backup file.
   * Strictly omits sensitive authentication credentials (PIN, tokens, session secrets).
   */
  async createBackupPayload(shopId?: string, shopName?: string): Promise<ShopFlowBackup> {
    const targetShopId = shopId || DEFAULT_DEMO_SHOP_ID;

    // Fetch all entities for this shop
    const [
      categories,
      brands,
      products,
      customers,
      sales,
      saleItems,
      payments,
      purchases,
      suppliers,
      inventoryMovements,
      expenses,
      openOrders,
      openOrderItems,
    ] = await Promise.all([
      db.categories.filter((c) => (c.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.brands.filter((b) => (b.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.products.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.customers.filter((c) => (c.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.sales.filter((s) => (s.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.saleItems.filter((si) => (si.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.payments.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.purchases.filter((p) => (p.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.suppliers.filter((s) => (s.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.inventoryMovements.filter((im) => (im.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.expenses.filter((e) => (e.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.openOrders.filter((oo) => (oo.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
      db.openOrderItems.filter((oi) => (oi.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).toArray(),
    ]);

    return {
      format: 'shopflow-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      shopId: targetShopId,
      shopName: shopName || 'My Shop',
      data: {
        categories,
        brands,
        products,
        customers,
        sales,
        saleItems,
        payments,
        purchases,
        suppliers,
        inventoryMovements,
        expenses,
        openOrders,
        openOrderItems,
      },
    };
  }

  /**
   * Export the authenticated shop's data into a clean, versioned JSON backup file.
   * Strictly omits sensitive authentication credentials (PIN, tokens, session secrets).
   */
  async exportBackup(
    shopId: string,
    shopName: string
  ): Promise<{ success: boolean; filename: string; counts: Record<string, number> }> {
    const backupPayload = await this.createBackupPayload(shopId, shopName);
    const jsonString = JSON.stringify(backupPayload, null, 2);
    const cleanShopName = (shopName || 'shop').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `shopflow-backup-${cleanShopName}-${dateStr}.json`;

    // Trigger browser file download (mobile Android friendly)
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    const d = backupPayload.data;
    const counts = {
      categories: d.categories?.length || 0,
      brands: d.brands?.length || 0,
      products: d.products.length,
      customers: d.customers.length,
      sales: d.sales.length,
      saleItems: d.saleItems.length,
      payments: d.payments.length,
      purchases: d.purchases.length,
      expenses: d.expenses.length,
      inventoryMovements: d.inventoryMovements.length,
      openOrders: d.openOrders?.length || 0,
    };

    return { success: true, filename, counts };
  }

  /**
   * Validate a candidate backup JSON string before attempting restore.
   * Performs deep checks on format, version, shop isolation, and relational integrity (Section 30).
   */
  validateBackup(fileContent: string, currentShopId: string): BackupValidationResult {
    let parsed: any;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      return {
        valid: false,
        error: 'Backup file is invalid or unsupported.',
      };
    }

    // 1. Format check
    if (!parsed || typeof parsed !== 'object' || parsed.format !== 'shopflow-backup') {
      return {
        valid: false,
        error: 'Backup file is invalid or unsupported.',
      };
    }

    // 2. Version check
    if (parsed.version !== 1) {
      return {
        valid: false,
        error: 'Backup file version is unsupported.',
      };
    }

    // 3. Shop ID protection (Section 11, 31)
    if (parsed.shopId && parsed.shopId !== currentShopId) {
      return {
        valid: false,
        error: 'This backup belongs to another shop.',
      };
    }

    // 4. Data structure check
    if (!parsed.data || typeof parsed.data !== 'object') {
      return {
        valid: false,
        error: 'Backup file is invalid or unsupported.',
      };
    }

    const d = parsed.data;
    if (
      !Array.isArray(d.products) ||
      !Array.isArray(d.customers) ||
      !Array.isArray(d.sales)
    ) {
      return {
        valid: false,
        error: 'Backup file is invalid or unsupported.',
      };
    }

    // 5. Relational integrity check (Section 30: categories, brands, products)
    const backupCats: Category[] = Array.isArray(d.categories) ? d.categories : [];
    const backupBrands: Brand[] = Array.isArray(d.brands) ? d.brands : [];

    const categoryIdSet = new Set<string>(backupCats.map((c) => c.id));
    const brandMap = new Map<string, Brand>();
    for (const b of backupBrands) {
      brandMap.set(b.id, b);
      // Validate that brand belongs to referenced category if categories exist
      if (backupCats.length > 0 && b.categoryId && !categoryIdSet.has(b.categoryId)) {
        return {
          valid: false,
          error: `Brand "${b.name}" references a non-existent category in this backup.`,
        };
      }
    }

    if (backupCats.length > 0) {
      for (const p of d.products) {
        if (p.categoryId && !categoryIdSet.has(p.categoryId)) {
          return {
            valid: false,
            error: `Product "${p.name}" references a non-existent category in this backup.`,
          };
        }
        if (p.brandId && brandMap.has(p.brandId)) {
          const br = brandMap.get(p.brandId)!;
          if (p.categoryId && br.categoryId !== p.categoryId) {
            return {
              valid: false,
              error: `Product "${p.name}" brand does not belong to the selected category.`,
            };
          }
        }
      }
    }

    const counts = {
      categories: backupCats.length,
      brands: backupBrands.length,
      products: Array.isArray(d.products) ? d.products.length : 0,
      customers: Array.isArray(d.customers) ? d.customers.length : 0,
      sales: Array.isArray(d.sales) ? d.sales.length : 0,
      payments: Array.isArray(d.payments) ? d.payments.length : 0,
      purchases: Array.isArray(d.purchases) ? d.purchases.length : 0,
      expenses: Array.isArray(d.expenses) ? d.expenses.length : 0,
      total:
        (d.products?.length || 0) +
        (d.customers?.length || 0) +
        (d.sales?.length || 0) +
        (d.payments?.length || 0) +
        (d.purchases?.length || 0) +
        (d.expenses?.length || 0),
    };

    return {
      valid: true,
      backup: parsed as ShopFlowBackup,
      counts,
    };
  }

  /**
   * Restore all shop data inside an atomic IndexedDB/Dexie transaction.
   * If any step fails, the entire transaction rolls back cleanly with zero data loss.
   */
  async restoreBackup(backup: ShopFlowBackup, currentShopId: string): Promise<RestoreResult> {
    const targetShopId = currentShopId || backup.shopId || DEFAULT_DEMO_SHOP_ID;

    try {
      const d = backup.data;

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
          db.openOrders,
          db.openOrderItems,
        ],
        async () => {
          // 1. Clear existing local records for this shop
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
            db.openOrders.filter((oo) => (oo.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
            db.openOrderItems.filter((oi) => (oi.shopId || DEFAULT_DEMO_SHOP_ID) === targetShopId).delete(),
          ]);

          // 2. Insert records from backup (re-associating with currentShopId)
          if (d.categories && d.categories.length > 0) {
            await db.categories.bulkPut(d.categories.map((c) => ({ ...c, shopId: targetShopId })));
          }
          if (d.brands && d.brands.length > 0) {
            await db.brands.bulkPut(d.brands.map((b) => ({ ...b, shopId: targetShopId })));
          }
          if (d.products && d.products.length > 0) {
            await db.products.bulkPut(d.products.map((p) => ({ ...p, shopId: targetShopId })));
          }
          if (d.customers && d.customers.length > 0) {
            await db.customers.bulkPut(d.customers.map((c) => ({ ...c, shopId: targetShopId })));
          }
          if (d.sales && d.sales.length > 0) {
            await db.sales.bulkPut(d.sales.map((s) => ({ ...s, shopId: targetShopId })));
          }
          if (d.saleItems && d.saleItems.length > 0) {
            await db.saleItems.bulkPut(d.saleItems.map((si) => ({ ...si, shopId: targetShopId })));
          }
          if (d.payments && d.payments.length > 0) {
            await db.payments.bulkPut(d.payments.map((p) => ({ ...p, shopId: targetShopId })));
          }
          if (d.purchases && d.purchases.length > 0) {
            await db.purchases.bulkPut(d.purchases.map((p) => ({ ...p, shopId: targetShopId })));
          }
          if (d.suppliers && d.suppliers.length > 0) {
            await db.suppliers.bulkPut(d.suppliers.map((s) => ({ ...s, shopId: targetShopId })));
          }
          if (d.inventoryMovements && d.inventoryMovements.length > 0) {
            await db.inventoryMovements.bulkPut(d.inventoryMovements.map((im) => ({ ...im, shopId: targetShopId })));
          }
          if (d.expenses && d.expenses.length > 0) {
            await db.expenses.bulkPut(d.expenses.map((e) => ({ ...e, shopId: targetShopId })));
          }
          if (d.openOrders && d.openOrders.length > 0) {
            // Restore status exactly as stored; never turn CHECKED_OUT into OPEN
            await db.openOrders.bulkPut(d.openOrders.map((oo) => ({ ...oo, shopId: targetShopId })));
          }
          if (d.openOrderItems && d.openOrderItems.length > 0) {
            await db.openOrderItems.bulkPut(d.openOrderItems.map((oi) => ({ ...oi, shopId: targetShopId })));
          }
        }
      );

      const restoredCounts = {
        categories: d.categories?.length || 0,
        brands: d.brands?.length || 0,
        products: d.products?.length || 0,
        customers: d.customers?.length || 0,
        sales: d.sales?.length || 0,
        saleItems: d.saleItems?.length || 0,
        payments: d.payments?.length || 0,
        purchases: d.purchases?.length || 0,
        inventoryMovements: d.inventoryMovements?.length || 0,
        expenses: d.expenses?.length || 0,
        total:
          (d.products?.length || 0) +
          (d.customers?.length || 0) +
          (d.sales?.length || 0) +
          (d.payments?.length || 0) +
          (d.purchases?.length || 0) +
          (d.expenses?.length || 0),
      };

      return {
        success: true,
        restoredCounts,
      };
    } catch (err: any) {
      console.error('Failed to restore backup in Dexie transaction:', err);
      return {
        success: false,
        error: err?.message || 'Restore failed. Local data has been kept intact.',
      };
    }
  }
}

export const backupService = new BackupService();
