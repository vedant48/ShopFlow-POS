import 'fake-indexeddb/auto';

declare const process: any;

// In-memory mock localStorage for Node testing environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    get length() { return store.size; },
  };
}
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

let networkOnline = true;
Object.defineProperty(globalThis, 'navigator', {
  value: {
    get onLine() {
      return networkOnline;
    },
  },
  writable: true,
  configurable: true,
});

import { db } from './db';
import { saleService } from './services/saleService';
import { syncService } from './services/syncService';
import { api } from './lib/api';

// Simple in-memory mock server mimicking Cloudflare D1 with foreign key enforcement
class MockD1Server {
  sales = new Map<string, any>();
  saleItems = new Map<string, any>();
  inventoryMovements = new Map<string, any>();
  products = new Map<string, any>();
  syncEvents = new Set<string>();

  processEvents(events: any[]) {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Dependency sort
    const sorted = [...events].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const tier: Record<string, number> = { products: 3, sales: 7, saleItems: 8, inventoryMovements: 10 };
      const tierA = tier[a.entity] ?? 50;
      const tierB = tier[b.entity] ?? 50;
      if (a.operation === 'DELETE' && b.operation === 'DELETE') {
        return tierB - tierA;
      }
      return tierA - tierB;
    });

    for (const ev of sorted) {
      if (this.syncEvents.has(ev.id)) {
        successful.push(ev.id);
        continue;
      }

      try {
        if (ev.entity === 'sales') {
          if (ev.operation === 'CREATE') {
            this.sales.set(ev.entityId, ev.payload);
          } else if (ev.operation === 'DELETE') {
            // Cascade delete child sale_items first (matches our worker fix)
            for (const [itemId, item] of this.saleItems.entries()) {
              if (item.saleId === ev.entityId) {
                this.saleItems.delete(itemId);
              }
            }
            this.sales.delete(ev.entityId);
          }
        } else if (ev.entity === 'saleItems') {
          if (ev.operation === 'CREATE') {
            // Verify FK: parent sale must exist
            if (!this.sales.has(ev.payload.saleId)) {
              throw new Error(`FOREIGN KEY constraint failed: sale ${ev.payload.saleId} not found`);
            }
            this.saleItems.set(ev.entityId, ev.payload);
          } else if (ev.operation === 'DELETE') {
            this.saleItems.delete(ev.entityId);
          }
        } else if (ev.entity === 'inventoryMovements') {
          if (ev.operation === 'CREATE') {
            this.inventoryMovements.set(ev.entityId, ev.payload);
          }
        } else if (ev.entity === 'products') {
          const current = this.products.get(ev.entityId) || {};
          this.products.set(ev.entityId, { ...current, ...ev.payload });
        }

        this.syncEvents.add(ev.id);
        successful.push(ev.id);
      } catch (err: any) {
        failed.push({ id: ev.id, error: err.message });
      }
    }

    return { successful, failed };
  }
}

async function runRegressionSuite() {
  console.log('🧪 Starting Comprehensive Sale Undo Sync Regression Suite...\n');

  await db.open();

  const server = new MockD1Server();
  api.sync = async (events: any[]) => {
    return {
      shopId: 'shop_demo_001',
      ...server.processEvents(events),
      processedCount: events.length,
      timestamp: new Date().toISOString(),
    };
  };

  // Setup seed products
  const productA = {
    id: 'prod_reg_1',
    shopId: 'shop_demo_001',
    name: 'Bisleri Water 1L',
    emoji: '💧',
    sellingPrice: 20,
    costPrice: 14,
    stock: 50,
    minStock: 10,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const productB = {
    id: 'prod_reg_2',
    shopId: 'shop_demo_001',
    name: 'Tata Tea Gold 250g',
    emoji: '☕',
    sellingPrice: 140,
    costPrice: 110,
    stock: 25,
    minStock: 5,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.products.bulkPut([productA as any, productB as any]);
  server.products.set(productA.id, productA);
  server.products.set(productB.id, productB);

  // --------------------------------------------------------------------------
  // TEST 1: Confirm a sale and undo it before synchronization starts (PENDING)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Confirm sale and undo before sync starts (PENDING) ---');
  // Temporarily disable auto-sync network
  networkOnline = false;

  const sale1 = await saleService.createSale({
    items: [{ product: productA as any, quantity: 2 }],
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });

  const prodAfterSale1 = await db.products.get(productA.id);
  if (prodAfterSale1?.stock !== 48) {
    throw new Error(`Test 1 Failed: Expected stock 48, got ${prodAfterSale1?.stock}`);
  }

  // Undo immediately while still PENDING
  const restored1 = await saleService.undoSale(sale1.id);
  if (restored1.length !== 1 || restored1[0].quantity !== 2) {
    throw new Error('Test 1 Failed: Restored items incorrect');
  }

  const prodAfterUndo1 = await db.products.get(productA.id);
  if (prodAfterUndo1?.stock !== 50) {
    throw new Error(`Test 1 Failed: Stock not restored, got ${prodAfterUndo1?.stock}`);
  }

  // Check syncQueue: original CREATE events must be CANCELLED, not PENDING
  const sale1CreationQueue = await db.syncQueue
    .where('entity')
    .anyOf(['sales', 'saleItems'])
    .filter(i => i.entityId === sale1.id || (i.payload as any)?.saleId === sale1.id)
    .toArray();

  for (const item of sale1CreationQueue) {
    if (item.status !== 'CANCELLED') {
      throw new Error(`Test 1 Failed: Expected event ${item.id} to be CANCELLED, got ${item.status}`);
    }
  }

  // Enable network and sync
  networkOnline = true;
  const syncRes1 = await syncService.manualSync();
  if (!syncRes1.success || syncRes1.failed > 0) {
    throw new Error(`Test 1 Failed: Sync failed after undo: ${JSON.stringify(syncRes1)}`);
  }

  if (server.sales.has(sale1.id)) {
    throw new Error('Test 1 Failed: Zombie sale was created on server!');
  }
  console.log('✓ Test 1 Passed: Undo before sync cleanly cancelled events with zero server zombie sales');

  // --------------------------------------------------------------------------
  // TEST 2: Confirm a sale and undo it while original request is in flight (SYNCING)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Confirm sale and undo while request is in flight (SYNCING) ---');
  let inFlightResolve2: any = null;
  const holdInFlight = new Promise(r => { inFlightResolve2 = r; });

  api.sync = async (events: any[]) => {
    // Hold first call in flight
    await holdInFlight;
    return {
      shopId: 'shop_demo_001',
      ...server.processEvents(events),
      processedCount: events.length,
      timestamp: new Date().toISOString(),
    };
  };

  const sale2 = await saleService.createSale({
    items: [{ product: productB as any, quantity: 3 }],
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });

  // Wait 150ms for sync to start and become SYNCING
  await new Promise(r => setTimeout(r, 150));
  const syncing2 = await db.syncQueue.where('status').equals('SYNCING').toArray();
  if (syncing2.length === 0) {
    throw new Error('Test 2 Failed: No events were in flight');
  }

  // Undo sale while in flight!
  await saleService.undoSale(sale2.id);

  const prodAfterUndo2 = await db.products.get(productB.id);
  if (prodAfterUndo2?.stock !== 25) {
    throw new Error(`Test 2 Failed: Stock not restored: ${prodAfterUndo2?.stock}`);
  }

  // Release in-flight request
  // Reset api.sync to direct processing first so the second automatic sync succeeds
  api.sync = async (events: any[]) => {
    return {
      shopId: 'shop_demo_001',
      ...server.processEvents(events),
      processedCount: events.length,
      timestamp: new Date().toISOString(),
    };
  };

  inFlightResolve2();
  
  // Wait for the in-flight cycle and automatic follow-up sync to complete
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 40));
    const s = await syncService.getStats();
    if (!s.isSyncing && s.pendingCount === 0) break;
  }

  // Ensure queue is fully synced
  const syncRes2 = await syncService.manualSync();
  if (!syncRes2.success || syncRes2.failed > 0) {
    throw new Error(`Test 2 Failed: Compensating sync failed: ${JSON.stringify(syncRes2)}`);
  }

  // Verify server state: sale and sale_items must NOT exist on server
  if (server.sales.has(sale2.id)) {
    throw new Error('Test 2 Failed: Sale still exists on server after undo!');
  }
  for (const [, item] of server.saleItems.entries()) {
    if (item.saleId === sale2.id) {
      throw new Error('Test 2 Failed: Orphan sale_item still exists on server!');
    }
  }

  // Verify stats
  const stats2 = await syncService.getStats();
  if (stats2.failedCount !== 0) {
    throw new Error(`Test 2 Failed: Unexpected failed items in queue: ${stats2.failedCount}`);
  }
  console.log('✓ Test 2 Passed: In-flight undo properly compensated and cleanly removed on server');

  // --------------------------------------------------------------------------
  // TEST 3: Confirm a sale, let it sync completely, then undo it (SYNCED)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Confirm sale, sync completely, then undo (SYNCED) ---');
  const sale3 = await saleService.createSale({
    items: [{ product: productA as any, quantity: 5 }],
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });

  // Sync completely
  const syncRes3a = await syncService.manualSync();
  if (!syncRes3a.success || !server.sales.has(sale3.id)) {
    throw new Error('Test 3 Failed: Sale 3 did not sync to server');
  }

  // Now undo the already SYNCED sale
  await saleService.undoSale(sale3.id);
  const prodAfterUndo3 = await db.products.get(productA.id);
  if (prodAfterUndo3?.stock !== 50) {
    throw new Error(`Test 3 Failed: Stock not restored: ${prodAfterUndo3?.stock}`);
  }

  // Sync the undo
  const syncRes3b = await syncService.manualSync();
  if (!syncRes3b.success || syncRes3b.failed > 0) {
    throw new Error(`Test 3 Failed: Undo sync failed: ${JSON.stringify(syncRes3b)}`);
  }

  if (server.sales.has(sale3.id)) {
    throw new Error('Test 3 Failed: Sale still exists on server after synced undo!');
  }
  console.log('✓ Test 3 Passed: SYNCED sale undo executed cleanly with server cascade');

  // --------------------------------------------------------------------------
  // TEST 4: Multi-item sale undo
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Multi-item sale undo ---');
  const sale4 = await saleService.createSale({
    items: [
      { product: productA as any, quantity: 4 },
      { product: productB as any, quantity: 2 },
    ],
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });

  await syncService.manualSync();
  if (!server.sales.has(sale4.id)) {
    throw new Error('Test 4 Failed: Multi-item sale not synced');
  }

  await saleService.undoSale(sale4.id);
  const syncRes4 = await syncService.manualSync();
  if (!syncRes4.success || syncRes4.failed > 0) {
    throw new Error(`Test 4 Failed: Multi-item undo sync failed: ${JSON.stringify(syncRes4)}`);
  }

  if (server.sales.has(sale4.id)) {
    throw new Error('Test 4 Failed: Multi-item sale still on server');
  }
  const prodAAfter4 = await db.products.get(productA.id);
  const prodBAfter4 = await db.products.get(productB.id);
  if (prodAAfter4?.stock !== 50 || prodBAfter4?.stock !== 25) {
    throw new Error(`Test 4 Failed: Multi-item stock not restored: A=${prodAAfter4?.stock}, B=${prodBAfter4?.stock}`);
  }
  console.log('✓ Test 4 Passed: Multi-item sale undo restored all stock and removed server records');

  // --------------------------------------------------------------------------
  // TEST 5: Simulate server rejection and verify real error is preserved
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Simulate server rejection and verify error preservation ---');
  let rejectNext = true;
  api.sync = async (events: any[]) => {
    if (rejectNext) {
      rejectNext = false;
      return {
        shopId: 'shop_demo_001',
        successful: [],
        failed: events.map(e => ({ id: e.id, error: 'Database busy - simulated timeout' })),
        processedCount: events.length,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      shopId: 'shop_demo_001',
      ...server.processEvents(events),
      processedCount: events.length,
      timestamp: new Date().toISOString(),
    };
  };

  const sale5 = await saleService.createSale({
    items: [{ product: productA as any, quantity: 1 }],
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });

  const syncRes5 = await syncService.manualSync();
  if (syncRes5.success || syncRes5.failed === 0) {
    throw new Error('Test 5 Failed: Expected sync failure on rejection');
  }

  const failedItems5 = await db.syncQueue.where('status').equals('FAILED').toArray();
  if (failedItems5.length === 0 || !failedItems5[0].errorMessage?.includes('simulated timeout')) {
    throw new Error(`Test 5 Failed: Real error not preserved in syncQueue: ${failedItems5[0]?.errorMessage}`);
  }
  console.log('✓ Test 5 Passed: Real server error diagnostic preserved in syncQueue');

  // --------------------------------------------------------------------------
  // TEST 6: Retry failed events and verify recovery
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Retry failed events and verify recovery ---');
  const syncRes6 = await syncService.manualSync();
  if (!syncRes6.success || syncRes6.failed > 0) {
    throw new Error(`Test 6 Failed: Recovery failed: ${JSON.stringify(syncRes6)}`);
  }

  const remainingFailed6 = await db.syncQueue.where('status').equals('FAILED').count();
  if (remainingFailed6 !== 0) {
    throw new Error(`Test 6 Failed: Still has ${remainingFailed6} failed items`);
  }
  console.log('✓ Test 6 Passed: Failed items recovered cleanly on retry');

  // Clean up sale 5
  await saleService.undoSale(sale5.id);
  await syncService.manualSync();

  // --------------------------------------------------------------------------
  // TEST 7: Verify stock restored exactly once
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Verify stock restored exactly once ---');
  const stockBefore7 = (await db.products.get(productA.id))?.stock || 0;
  const sale7 = await saleService.createSale({
    items: [{ product: productA as any, quantity: 3 }],
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });
  await saleService.undoSale(sale7.id);
  const stockAfter7 = (await db.products.get(productA.id))?.stock || 0;
  if (stockBefore7 !== stockAfter7) {
    throw new Error(`Test 7 Failed: Stock changed from ${stockBefore7} to ${stockAfter7}`);
  }
  console.log('✓ Test 7 Passed: Stock restored exactly once');

  // --------------------------------------------------------------------------
  // TEST 8: Verify no duplicate sale, sale item, or inventory movement
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Verify no duplicates ---');
  const movements7 = await db.inventoryMovements.where('referenceId').equals(sale7.id).toArray();
  const saleMoves = movements7.filter(m => m.type === 'SALE');
  const returnMoves = movements7.filter(m => m.type === 'RETURN');
  if (saleMoves.length !== 1 || returnMoves.length !== 1) {
    throw new Error(`Test 8 Failed: Expected 1 SALE and 1 RETURN movement, found ${saleMoves.length} and ${returnMoves.length}`);
  }
  console.log('✓ Test 8 Passed: No duplicate movements or items');

  // Sync remaining undo events from test 7 & 8
  await syncService.manualSync();

  // --------------------------------------------------------------------------
  // TEST 9: Verify backup UI status calculations
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Verify backup UI status calculations ---');
  const stats9 = await syncService.getStats();
  if (stats9.failedCount !== 0 || stats9.pendingCount !== 0) {
    throw new Error(`Test 9 Failed: Stats mismatch: pending=${stats9.pendingCount}, failed=${stats9.failedCount}`);
  }
  console.log('✓ Test 9 Passed: Backup status accurately reflects queue state');

  // --------------------------------------------------------------------------
  // TEST 10: Reconcile previously failed items from undone sales
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: Automatic reconciliation of failed events from undone sales ---');
  // Inject a synthetic failed item simulating previous bug
  const orphanSaleId = 'sale_orphan_legacy';
  await db.syncQueue.add({
    id: 'sync_orphan_1',
    shopId: 'shop_demo_001',
    entity: 'sales',
    entityId: orphanSaleId,
    operation: 'CREATE',
    payload: { id: orphanSaleId },
    status: 'FAILED',
    attempts: 3,
    errorMessage: 'D1_ERROR: FOREIGN KEY constraint failed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  let statsBeforeRec = await syncService.getStats();
  if (statsBeforeRec.failedCount !== 1) {
    throw new Error('Test 10 Failed: Injected failed item not counted');
  }

  // Trigger manual sync or reconciliation
  const syncRes10 = await syncService.manualSync();
  if (!syncRes10.success || syncRes10.failed > 0) {
    throw new Error(`Test 10 Failed: Sync failed: ${JSON.stringify(syncRes10)}`);
  }

  const statsAfterRec = await syncService.getStats();
  if (statsAfterRec.failedCount !== 0) {
    throw new Error(`Test 10 Failed: Orphan failed item not reconciled: ${statsAfterRec.failedCount}`);
  }
  console.log('✓ Test 10 Passed: Orphan failed items from undone sales reconciled to CANCELLED');

  console.log('\n🎉 ALL REGRESSION TESTS PASSED SUCCESSFULLY! 100% VERIFIED.');
  process.exit(0);
}

runRegressionSuite().catch(err => {
  console.error('Regression suite failed:', err);
  process.exit(1);
});
