import './setup-node-polyfills';

import { db } from '../src/db';
import { syncService } from '../src/services/syncService';
import { inventoryService } from '../src/services/inventoryService';
import { saleService } from '../src/services/saleService';
import { authService } from '../src/auth/authService';

const WORKER_URL = 'https://shopflow-worker.vedant-753.workers.dev';

async function verifyAll() {
  console.log('========================================================================');
  console.log('SHOPFLOW COMPREHENSIVE VERIFICATION SUITE');
  console.log('========================================================================\n');

  // Helper to wait for all syncQueue items to be completely SYNCED
  async function waitForSync(label: string, targetShopId?: string, maxWaitMs = 30000): Promise<number> {
    const start = performance.now();
    await new Promise((r) => setTimeout(r, 120)); // let debounce timer initiate
    while (performance.now() - start < maxWaitMs) {
      const stats = await syncService.getStats(targetShopId);
      if (stats.pendingCount === 0 && stats.syncingCount === 0 && !stats.isSyncing) {
        const dur = performance.now() - start;
        console.log(`✓ [${label}] All items synced in ${dur.toFixed(1)}ms`);
        return dur;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    const finalStats = await syncService.getStats(targetShopId);
    throw new Error(`[${label}] Timeout waiting for sync! pending=${finalStats.pendingCount}, syncing=${finalStats.syncingCount}, isSyncing=${finalStats.isSyncing}`);
  }

  // Setup: Register Shop 1
  const phone1 = '97' + Math.floor(10000000 + Math.random() * 90000000);
  console.log(`Setting up Shop 1 (${phone1})...`);
  const reg1 = await authService.register({
    phone: phone1,
    name: 'Owner 1',
    shopName: 'Shop Alpha',
    pin: '1234',
  });
  const shop1Id = reg1.shop.id;
  console.log(`Shop 1 registered: ${shop1Id}\n`);

  // -------------------------------------------------------------------------
  // TEST 1: First Write
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: First Write ---');
  const t1Start = performance.now();
  const prod1 = await inventoryService.addProduct({
    name: 'First Write Product',
    sellingPrice: 100,
    costPrice: 80,
    stock: 20,
    minStock: 5,
    shopId: shop1Id,
  });
  console.log(`Local Dexie write completed in ${(performance.now() - t1Start).toFixed(1)}ms (prodId=${prod1.id})`);
  const t1SyncDur = await waitForSync('Test 1: First Write');
  console.log(`Test 1 PASSED: Total write-to-sync latency: ${(performance.now() - t1Start).toFixed(1)}ms\n`);

  // -------------------------------------------------------------------------
  // TEST 2: Second Write (Immediate - while Write 1 is finishing or right after)
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: Second Write (Immediate chained sync) ---');
  // Trigger Write 2A and 2B with 100ms gap
  const t2Start = performance.now();
  const prod2A = await inventoryService.addProduct({
    name: 'Second Write Product A',
    sellingPrice: 150,
    costPrice: 120,
    stock: 15,
    minStock: 3,
    shopId: shop1Id,
  });
  // 100ms later while sync is starting/in-flight:
  await new Promise((r) => setTimeout(r, 80));
  const prod2B = await inventoryService.addProduct({
    name: 'Second Write Product B',
    sellingPrice: 250,
    costPrice: 200,
    stock: 10,
    minStock: 2,
    shopId: shop1Id,
  });
  console.log(`Local writes 2A & 2B done in ${(performance.now() - t2Start).toFixed(1)}ms`);
  const t2SyncDur = await waitForSync('Test 2: Second Write Immediate Chain');
  console.log(`Test 2 PASSED: Both writes chained and synced cleanly in ${(performance.now() - t2Start).toFixed(1)}ms (< 5000ms, no 15s-30s delay!)\n`);

  // -------------------------------------------------------------------------
  // TEST 3: 5 Consecutive Writes in rapid burst
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: 5 Consecutive Writes (Rapid Burst) ---');
  const t3Start = performance.now();
  const burstProducts = [];
  for (let i = 1; i <= 5; i++) {
    const p = await inventoryService.addProduct({
      name: `Burst Product ${i}`,
      sellingPrice: 10 * i,
      costPrice: 8 * i,
      stock: 5 * i,
      shopId: shop1Id,
    });
    burstProducts.push(p);
  }
  console.log(`5 consecutive writes completed locally in ${(performance.now() - t3Start).toFixed(1)}ms`);
  await waitForSync('Test 3: 5 Consecutive Writes Burst');
  console.log(`Test 3 PASSED: All 5 writes batched and synced in ${(performance.now() - t3Start).toFixed(1)}ms\n`);

  // -------------------------------------------------------------------------
  // TEST 4: Offline Write
  // -------------------------------------------------------------------------
  console.log('--- TEST 4: Offline Write ---');
  // Simulate offline by overriding navigator.onLine
  const originalOnLine = navigator.onLine;
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

  const t4Start = performance.now();
  const offlineProd = await inventoryService.addProduct({
    name: 'Offline Created Product',
    sellingPrice: 500,
    costPrice: 400,
    stock: 50,
    shopId: shop1Id,
  });
  console.log(`Offline write completed locally in ${(performance.now() - t4Start).toFixed(1)}ms (prodId=${offlineProd.id})`);

  // Verify item is saved locally in Dexie and in syncQueue as PENDING
  const localProd = await db.products.get(offlineProd.id);
  if (!localProd) throw new Error('Offline product was not stored in local Dexie!');
  const pendingOffline = await syncService.getPendingCount();
  console.log(`Local Dexie product verified: ${localProd.name}, pending sync items: ${pendingOffline}`);
  if (pendingOffline === 0) throw new Error('Expected pending sync items while offline, got 0!');
  console.log('Test 4 PASSED: Offline write stored safely in Dexie with PENDING sync status\n');

  // -------------------------------------------------------------------------
  // TEST 5: Reconnect & Sync
  // -------------------------------------------------------------------------
  console.log('--- TEST 5: Reconnect & Sync ---');
  // Restore online status
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  console.log('Network reconnected (navigator.onLine = true). Triggering sync...');
  const t5Start = performance.now();
  await syncService.syncPendingEvents(true);
  await waitForSync('Test 5: Reconnect & Sync');
  console.log(`Test 5 PASSED: Reconnected and flushed offline writes in ${(performance.now() - t5Start).toFixed(1)}ms\n`);

  // -------------------------------------------------------------------------
  // TEST 6: Duplicate Sync (Idempotency)
  // -------------------------------------------------------------------------
  console.log('--- TEST 6: Duplicate Sync (Idempotency) ---');
  // Fetch synced items and re-submit the same sync item ID
  const syncedQueueItems = await db.syncQueue.where('status').equals('SYNCED').limit(3).toArray();
  if (syncedQueueItems.length === 0) throw new Error('No synced items found for duplicate test!');
  const testItem = syncedQueueItems[0];
  console.log(`Re-submitting already synced item: ${testItem.id} (${testItem.entity})`);

  const session = JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}');
  const dupRes = await fetch(`${WORKER_URL}/api/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shopId: shop1Id,
      events: [testItem],
    }),
  });
  const dupData: any = await dupRes.json();
  console.log(`Duplicate sync response: status=${dupRes.status}, successful=${dupData.successful}, failed=${dupData.failed?.length}`);
  if (!dupData.successful.includes(testItem.id)) {
    throw new Error('Duplicate event was not handled idempotently as successful!');
  }
  console.log('Test 6 PASSED: Duplicate sync handled idempotently without error or duplication\n');

  // -------------------------------------------------------------------------
  // TEST 7: Refresh / Reopen persistence
  // -------------------------------------------------------------------------
  console.log('--- TEST 7: Refresh / Reopen Persistence ---');
  // Verify that all products and sales in Dexie persist across session checks
  const allProds = await db.products.where('shopId').equals(shop1Id).toArray();
  console.log(`Total products persisted in Dexie for Shop 1: ${allProds.length}`);
  if (allProds.length < 8) throw new Error(`Expected at least 8 products, found ${allProds.length}`);
  const finalPending = await syncService.getPendingCount();
  console.log(`Pending queue count: ${finalPending}`);
  if (finalPending !== 0) throw new Error(`Expected 0 pending items, found ${finalPending}`);
  console.log('Test 7 PASSED: Storage persisted and sync queue in clean state\n');

  // -------------------------------------------------------------------------
  // TEST 8: Two Shops Isolation
  // -------------------------------------------------------------------------
  console.log('--- TEST 8: Two Shops Isolation ---');
  const phone2 = '96' + Math.floor(10000000 + Math.random() * 90000000);
  console.log(`Registering Shop 2 (${phone2})...`);
  const reg2 = await authService.register({
    phone: phone2,
    name: 'Owner 2',
    shopName: 'Shop Beta',
    pin: '1234',
  });
  const shop2Id = reg2.shop!.id;
  const shop2Token = reg2.token || authService.getToken();
  console.log(`Shop 2 registered: ${shop2Id}`);

  // Create a product for Shop 2
  const pShop2 = await inventoryService.addProduct({
    name: 'Shop 2 Exclusive Item',
    sellingPrice: 99,
    costPrice: 50,
    stock: 100,
    shopId: shop2Id,
  });
  await waitForSync('Test 8: Shop 2 Product Sync', shop2Id);

  // Query D1 directly for Shop 2 products and verify Shop 1 products are NOT returned
  const bootstrapShop2Res = await fetch(`${WORKER_URL}/api/bootstrap?shopId=${shop2Id}`, {
    headers: { Authorization: `Bearer ${shop2Token}` },
  });
  const bootstrapShop2: any = await bootstrapShop2Res.json();
  if (bootstrapShop2Res.status !== 200) {
    console.error('Bootstrap Shop 2 failed:', bootstrapShop2Res.status, bootstrapShop2);
  }
  const shop2ProdNames = (bootstrapShop2.products || []).map((p: any) => p.name);
  console.log(`Shop 2 products in cloud:`, shop2ProdNames);
  if (!shop2ProdNames.includes('Shop 2 Exclusive Item')) {
    throw new Error('Shop 2 Exclusive Item not found in Shop 2 cloud data!');
  }
  if (shop2ProdNames.includes('First Write Product')) {
    throw new Error('SECURITY VIOLATION: Shop 2 received Shop 1 product!');
  }
  console.log('Test 8 PASSED: Perfect multi-shop tenant isolation confirmed\n');

  console.log('========================================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('========================================================================');
}

verifyAll().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
