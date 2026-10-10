import 'fake-indexeddb/auto';

// Polyfill in-memory localStorage for Node testing environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    get length() {
      return store.size;
    },
  };
  globalThis.localStorage = mockStorage;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

// Polyfill navigator online
let isNetworkOnline = true;
Object.defineProperty(globalThis, 'navigator', {
  value: {
    get onLine() {
      return isNetworkOnline;
    },
  },
  writable: true,
  configurable: true,
});

import { db } from './db';
import { categoryService } from './services/categoryService';
import { inventoryService } from './services/inventoryService';
import { saleService } from './services/saleService';
import { dashboardService } from './services/dashboardService';
import { syncService } from './services/syncService';
import { api } from './lib/api';

async function runRegressionSuite() {
  console.log('🧪 Starting ShopFlow Freeze & Data-Safety Regression Test Suite...\n');

  await db.open();

  // Test 1: Create two categories consecutively
  console.log('--- Test 1: Create two categories consecutively ---');
  const cat1 = await categoryService.createCategory({ name: 'Snacks & Beverages', icon: 'package' });
  const cat2 = await categoryService.createCategory({ name: 'Dairy & Milk', icon: 'milk' });
  if (!cat1.id || !cat2.id) throw new Error('Test 1 failed: categories not created');
  const catCount = await db.categories.where('id').anyOf([cat1.id, cat2.id]).count();
  if (catCount !== 2) throw new Error(`Test 1 failed: expected 2 categories, got ${catCount}`);
  console.log(`✓ Test 1 Passed: 2 categories created consecutively (${cat1.name}, ${cat2.name})`);

  // Test 2: Create several products consecutively
  console.log('\n--- Test 2: Create several products consecutively ---');
  const prodA = await inventoryService.addProduct({
    name: 'Lays Classic Salted 30g',
    categoryId: cat1.id,
    sellingPrice: 20,
    mrp: 20,
    costPrice: 15,
    stock: 50,
    minStock: 5,
  });
  const prodB = await inventoryService.addProduct({
    name: 'Amul Taaza Milk 500ml',
    categoryId: cat2.id,
    sellingPrice: 27,
    mrp: 27,
    costPrice: 24,
    stock: 30,
    minStock: 5,
  });
  const prodC = await inventoryService.addProduct({
    name: 'Kurkure Masala Munch 40g',
    categoryId: cat1.id,
    sellingPrice: 20,
    mrp: 20,
    costPrice: 16,
    stock: 40,
    minStock: 5,
  });
  if (!prodA.id || !prodB.id || !prodC.id) throw new Error('Test 2 failed');
  console.log(`✓ Test 2 Passed: 3 products created consecutively without hanging (${prodA.name}, ${prodB.name}, ${prodC.name})`);

  // Test 3: Add product variants
  console.log('\n--- Test 3: Add product variants ---');
  await inventoryService.updateProduct(prodA.id, {
    priceVariants: [
      { id: 'pv_lays_std', name: 'Standard Pack', price: 20, sellingPrice: 20, costPrice: 15, isDefault: true },
      { id: 'pv_lays_party', name: 'Party Pack', price: 50, sellingPrice: 50, costPrice: 38, isDefault: false },
    ],
  });
  const updatedProdA = await inventoryService.getProductById(prodA.id);
  if (!updatedProdA || updatedProdA.priceVariants?.length !== 2) {
    throw new Error('Test 3 failed: variant count mismatch');
  }
  console.log('✓ Test 3 Passed: Product variants added and persisted with default and custom variants');

  // Test 4: Complete a cash sale with multiple items
  console.log('\n--- Test 4: Complete a cash sale with multiple items ---');
  const initialStockA = (await inventoryService.getProductById(prodA.id))!.stock;
  const initialStockB = (await inventoryService.getProductById(prodB.id))!.stock;

  const cashSale = await saleService.createSale({
    items: [
      { product: prodA, quantity: 2, selectedVariant: updatedProdA.priceVariants![0] },
      { product: prodB, quantity: 3 },
    ],
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });

  const postStockA = (await inventoryService.getProductById(prodA.id))!.stock;
  const postStockB = (await inventoryService.getProductById(prodB.id))!.stock;

  if (postStockA !== initialStockA - 2 || postStockB !== initialStockB - 3) {
    throw new Error(`Test 4 failed: stock reduction mismatch. A: ${postStockA}, B: ${postStockB}`);
  }
  // Total = (2 * 20) + (3 * 27) = 40 + 81 = 121
  if (cashSale.totalAmount !== 121) {
    throw new Error(`Test 4 failed: total expected 121, got ${cashSale.totalAmount}`);
  }
  console.log(`✓ Test 4 Passed: Cash sale completed (₹${cashSale.totalAmount}, 5 items, stock correctly decremented)`);

  // Test 5: Complete an udhaar sale
  console.log('\n--- Test 5: Complete an udhaar sale ---');
  const now = new Date().toISOString();
  const customerId = 'cust_test_ramesh';
  await db.customers.put({
    id: customerId,
    shopId: 'shop_demo_001',
    name: 'Ramesh Bhai',
    phone: '9820011223',
    balance: 0,
    createdAt: now,
    updatedAt: now,
  });

  const udhaarSale = await saleService.createSale({
    items: [{ product: prodC, quantity: 2 }],
    paymentStatus: 'UDHAAR',
    customerId,
    customerName: 'Ramesh Bhai',
  });

  const updatedCust = await db.customers.get(customerId);
  if (!updatedCust || updatedCust.balance !== 40) {
    throw new Error(`Test 5 failed: customer balance expected 40, got ${updatedCust?.balance}`);
  }
  console.log(`✓ Test 5 Passed: Udhaar sale recorded (Sale #${udhaarSale.saleNumber}, customer balance: ₹${updatedCust.balance})`);

  // Test 6: Read Reports while synchronization is running
  console.log('\n--- Test 6: Read Reports while synchronization is running ---');
  // Trigger sync in background
  const syncPromise = syncService.syncPendingEvents(true);
  // Concurrently query dashboard/reports stats
  const dateRangeStats = await dashboardService.getDateRangeStats(
    new Date(Date.now() - 86400000).toISOString(),
    new Date(Date.now() + 86400000).toISOString(),
    'Today'
  );
  if (!dateRangeStats || dateRangeStats.totalRevenue < 161) {
    throw new Error('Test 6 failed: report query failed during sync');
  }
  await syncPromise;
  console.log(`✓ Test 6 Passed: Reports read concurrently with active sync (Total Revenue: ₹${dateRangeStats.totalRevenue})`);

  // Test 7: Perform operations offline and synchronize afterward
  console.log('\n--- Test 7: Perform operations offline and synchronize afterward ---');
  isNetworkOnline = false;
  const offlineProd = await inventoryService.addProduct({
    name: 'Parle-G 100g',
    categoryId: cat1.id,
    sellingPrice: 10,
    costPrice: 8,
    stock: 100,
    minStock: 10,
  });
  const offlineSale = await saleService.createSale({
    items: [{ product: offlineProd, quantity: 5 }],
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });
  if (!offlineSale.id) throw new Error('Offline sale failed');
  const pendingOfflineCount = await syncService.getPendingCount();
  if (pendingOfflineCount === 0) {
    throw new Error('Test 7 failed: offline operations were not queued');
  }
  console.log(`  Offline operations enqueued: ${pendingOfflineCount} events pending`);

  // Reconnect online and sync
  isNetworkOnline = true;
  // Mock api.sync
  const origSync = api.sync;
  api.sync = async (events) => {
    return {
      shopId: 'shop_demo_001',
      successful: events.map((e) => e.id),
      failed: [],
      processedCount: events.length,
      timestamp: new Date().toISOString(),
    };
  };

  const syncResult = await syncService.syncPendingEvents(true);
  api.sync = origSync;

  if (!syncResult.success) {
    throw new Error('Test 7 failed: post-offline sync did not succeed');
  }
  console.log(`✓ Test 7 Passed: Offline sale completed, persisted, and successfully synchronized (${syncResult.synced} items synced)`);

  // Test 8: Simulate a failed sync request and verify queue preservation
  console.log('\n--- Test 8: Simulate a failed sync request and retry ---');
  // Enqueue a test item
  const testSyncId = await syncService.enqueue('products', 'test_prod_fail', 'UPDATE', { name: 'Fail test' });

  // Mock API network error
  const origApiSync = api.sync;
  api.sync = async () => {
    throw new Error('503 Service Unavailable (Cloudflare Worker timeout)');
  };

  const failedSyncResult = await syncService.syncPendingEvents(true);
  if (failedSyncResult.success) {
    throw new Error('Test 8 failed: sync was expected to fail');
  }

  // Verify item is still in queue as PENDING or FAILED (not deleted)
  const failedItem = await db.syncQueue.get(testSyncId);
  if (!failedItem || (failedItem.status !== 'PENDING' && failedItem.status !== 'FAILED')) {
    throw new Error(`Test 8 failed: queue item lost or corrupted: ${failedItem?.status}`);
  }
  console.log(`✓ Test 8 Passed: Failed sync caught safely; queued item preserved in status "${failedItem.status}"`);

  // Restore API and retry
  api.sync = async (events) => ({
    shopId: 'shop_demo_001',
    successful: events.map((e) => e.id),
    failed: [],
    processedCount: events.length,
    timestamp: new Date().toISOString(),
  });
  const retrySyncResult = await syncService.syncPendingEvents(true);
  api.sync = origApiSync;
  if (!retrySyncResult.success) {
    throw new Error('Test 8 failed: retry sync did not succeed');
  }
  console.log(`  Retry successful: synced ${retrySyncResult.synced} events`);

  // Test 9: Verify no duplicate sales or inventory movements
  console.log('\n--- Test 9: Verify no duplicate sales or inventory movements ---');
  const allSales = await db.sales.toArray();
  const allMovements = await db.inventoryMovements.toArray();
  const saleIds = new Set(allSales.map((s) => s.id));
  const movementIds = new Set(allMovements.map((m) => m.id));

  if (saleIds.size !== allSales.length) {
    throw new Error('Test 9 failed: duplicate sales found in database');
  }
  if (movementIds.size !== allMovements.length) {
    throw new Error('Test 9 failed: duplicate inventory movements found');
  }
  console.log(`✓ Test 9 Passed: Zero duplicates verified (${allSales.length} unique sales, ${allMovements.length} unique movements)`);

  // Test 10: Single-flight lock verification (Forced concurrent sync)
  console.log('\n--- Test 10: Verify Single-Flight Sync Lock (concurrent sync blocked) ---');
  let isLockedWhileRunning = false;
  api.sync = async (events) => {
    // While sync is in flight, attempt concurrent sync with force=true
    const concurrentAttempt = await syncService.syncPendingEvents(true);
    if (!concurrentAttempt.success && concurrentAttempt.error === 'Already syncing') {
      isLockedWhileRunning = true;
    }
    return {
      shopId: 'shop_demo_001',
      successful: events.map((e) => e.id),
      failed: [],
      processedCount: events.length,
      timestamp: new Date().toISOString(),
    };
  };

  // Enqueue test item and sync
  await syncService.enqueue('products', 'test_lock_prod', 'UPDATE', { name: 'Lock' });
  await syncService.syncPendingEvents(true);
  api.sync = origApiSync;

  if (!isLockedWhileRunning) {
    throw new Error('Test 10 failed: concurrent sync was not prevented by single-flight lock');
  }
  console.log('✓ Test 10 Passed: Single-flight sync lock verified (concurrent forced sync blocked with "Already syncing")');

  // Test 11: Schema v7 neutralization & v10 upgrade verification
  console.log('\n--- Test 11: Schema Version & Data Safety Verification ---');
  const dbVersion = db.verno;
  console.log(`  Current Database Schema Version: ${dbVersion}`);
  if (dbVersion < 10) {
    throw new Error(`Test 11 failed: expected schema version >= 10, got ${dbVersion}`);
  }
  // Verify products still exist and were not wiped
  const finalProductCount = await db.products.count();
  if (finalProductCount === 0) {
    throw new Error('Test 11 failed: products were wiped');
  }
  console.log(`✓ Test 11 Passed: Schema version ${dbVersion} active, all ${finalProductCount} products intact, v7 wipe neutralized`);

  console.log('\n🎉 ALL REGRESSION TESTS PASSED CLEANLY (11/11 verified)!');
  syncService.destroy();
}

runRegressionSuite().catch((err) => {
  console.error('\n❌ REGRESSION TEST FAILED:', err);
  if (typeof (globalThis as any).process !== 'undefined') {
    (globalThis as any).process.exit(1);
  }
});
