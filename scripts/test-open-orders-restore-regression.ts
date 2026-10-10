import './setup-node-polyfills';

import { db } from '../src/db';
import { syncService } from '../src/services/syncService';
import { backupService } from '../src/services/backupService';
import { openOrderService } from '../src/services/openOrderService';
import { api } from '../src/lib/api';
import type { OpenOrder, OpenOrderItem, Product } from '../src/types';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRestoreRegressionTests() {
  console.log('========================================================================');
  console.log('SHOPFLOW: OPEN ORDERS CLOUD & JSON RESTORE REGRESSION TEST SUITE');
  console.log('========================================================================\n');

  const shop1Id = 'shop_test_restore_001';
  const shop2Id = 'shop_test_restore_002';

  // ---------------------------------------------------------------------------
  // TEST 1, 2, 3, 4: Cloud Restore with multiple orders, line items, and multiple statuses
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1, 2, 3, 4: Cloud Restore (Multiple orders, items, statuses, field fidelity) ---');

  const mockCloudBootstrapData = {
    shop: { id: shop1Id, name: 'Cloud Restored Shop' },
    products: [
      {
        id: 'prod_cloud_1',
        shop_id: shop1Id,
        name: 'Cloud Product 1',
        emoji: '🥤',
        selling_price: 25,
        cost_price: 18,
        mrp: 25,
        stock: 50,
        category: 'Drinks',
        active: 1,
        created_at: '2026-10-10T10:00:00.000Z',
      },
    ],
    customers: [
      {
        id: 'cust_cloud_1',
        shop_id: shop1Id,
        name: 'Suresh Kumar',
        phone: '9811223344',
        balance: 100,
        created_at: '2026-10-10T10:05:00.000Z',
      },
    ],
    sales: [],
    saleItems: [],
    payments: [],
    purchases: [],
    purchaseItems: [],
    inventoryMovements: [],
    expenses: [],
    suppliers: [],
    openOrders: [
      {
        id: 'ord_cloud_open',
        shop_id: shop1Id,
        customer_id: 'cust_cloud_1',
        temporary_customer_name: null,
        status: 'OPEN',
        total_amount: 50,
        item_count: 2,
        note: 'Customer waiting outside',
        sale_id: null,
        last_activity_at: '2026-10-10T10:20:00.000Z',
        created_at: '2026-10-10T10:15:00.000Z',
        updated_at: '2026-10-10T10:20:00.000Z',
      },
      {
        id: 'ord_cloud_checked_out',
        shop_id: shop1Id,
        customer_id: null,
        temporary_customer_name: 'Walk-in #1',
        status: 'CHECKED_OUT',
        total_amount: 75,
        item_count: 3,
        note: 'Checked out earlier',
        sale_id: 'sale_completed_123',
        last_activity_at: '2026-10-10T09:30:00.000Z',
        created_at: '2026-10-10T09:00:00.000Z',
        updated_at: '2026-10-10T09:30:00.000Z',
      },
      {
        id: 'ord_cloud_cancelled',
        shop_id: shop1Id,
        customer_id: null,
        temporary_customer_name: 'Walk-in #2',
        status: 'CANCELLED',
        total_amount: 25,
        item_count: 1,
        note: 'Customer cancelled',
        sale_id: null,
        last_activity_at: '2026-10-10T08:30:00.000Z',
        created_at: '2026-10-10T08:00:00.000Z',
        updated_at: '2026-10-10T08:30:00.000Z',
      },
    ],
    openOrderItems: [
      {
        id: 'oi_cloud_1',
        shop_id: shop1Id,
        open_order_id: 'ord_cloud_open',
        product_id: 'prod_cloud_1',
        product_name: 'Cloud Product 1',
        product_emoji: '🥤',
        variant_id: 'pv_1',
        variant_name: 'Standard',
        quantity: 2,
        unit_price: 25,
        total_price: 50,
        created_at: '2026-10-10T10:15:00.000Z',
        updated_at: '2026-10-10T10:20:00.000Z',
      },
      {
        id: 'oi_cloud_2',
        shop_id: shop1Id,
        open_order_id: 'ord_cloud_checked_out',
        product_id: 'prod_cloud_1',
        product_name: 'Cloud Product 1',
        product_emoji: '🥤',
        variant_id: 'pv_1',
        variant_name: 'Standard',
        quantity: 3,
        unit_price: 25,
        total_price: 75,
        created_at: '2026-10-10T09:00:00.000Z',
        updated_at: '2026-10-10T09:30:00.000Z',
      },
      {
        id: 'oi_cloud_3',
        shop_id: shop1Id,
        open_order_id: 'ord_cloud_cancelled',
        product_id: 'prod_cloud_1',
        product_name: 'Cloud Product 1',
        product_emoji: '🥤',
        variant_id: 'pv_1',
        variant_name: 'Standard',
        quantity: 1,
        unit_price: 25,
        total_price: 25,
        created_at: '2026-10-10T08:00:00.000Z',
        updated_at: '2026-10-10T08:30:00.000Z',
      },
    ],
  };

  // Mock api.bootstrap
  const originalBootstrap = api.bootstrap.bind(api);
  api.bootstrap = async (sId?: string) => {
    if (sId === shop1Id) {
      return mockCloudBootstrapData as any;
    }
    return originalBootstrap(sId);
  };

  try {
    // Execute cloud restore
    const restoreResult = await syncService.bootstrapFromCloud(shop1Id);
    assert(restoreResult.success, 'Cloud restore should return success: true');
    assert(restoreResult.importedCount >= 5, `Imported count should include orders and items (got ${restoreResult.importedCount})`);
    assert(restoreResult.counts?.openOrders === 3, 'Counts should report 3 openOrders');
    assert(restoreResult.counts?.openOrderItems === 3, 'Counts should report 3 openOrderItems');

    // Verify Open Orders in Dexie
    const restoredOrders = await db.openOrders.where('shopId').equals(shop1Id).toArray();
    assert(restoredOrders.length === 3, `Expected 3 orders in Dexie, found ${restoredOrders.length}`);

    // Verify Open Order 1 (OPEN)
    const openOrd = await db.openOrders.get('ord_cloud_open');
    assert(openOrd !== undefined, 'ord_cloud_open must exist in Dexie');
    assert(openOrd!.status === 'OPEN', 'Status should be OPEN');
    assert(openOrd!.customerId === 'cust_cloud_1', 'customerId preserved');
    assert(openOrd!.totalAmount === 50, 'totalAmount should be 50');
    assert(openOrd!.itemCount === 2, 'itemCount should be 2');
    assert(openOrd!.note === 'Customer waiting outside', 'Note preserved');
    assert(openOrd!.lastActivityAt === '2026-10-10T10:20:00.000Z', 'lastActivityAt preserved');

    // Verify items linked to Open Order 1
    const openOrdItems = await db.openOrderItems.where('openOrderId').equals('ord_cloud_open').toArray();
    assert(openOrdItems.length === 1, `Expected 1 item for ord_cloud_open, found ${openOrdItems.length}`);
    assert(openOrdItems[0].quantity === 2, 'Item quantity should be 2');
    assert(openOrdItems[0].unitPrice === 25, 'Item unit price should be 25');
    assert(openOrdItems[0].totalPrice === 50, 'Item total price should be 50');

    // Verify Open Order 2 (CHECKED_OUT)
    const checkedOutOrd = await db.openOrders.get('ord_cloud_checked_out');
    assert(checkedOutOrd !== undefined, 'ord_cloud_checked_out must exist');
    assert(checkedOutOrd!.status === 'CHECKED_OUT', 'CHECKED_OUT status preserved');
    assert(checkedOutOrd!.saleId === 'sale_completed_123', 'saleId preserved');
    assert(checkedOutOrd!.temporaryCustomerName === 'Walk-in #1', 'temporaryCustomerName preserved');

    // Verify Open Order 3 (CANCELLED)
    const cancelledOrd = await db.openOrders.get('ord_cloud_cancelled');
    assert(cancelledOrd !== undefined, 'ord_cloud_cancelled must exist');
    assert(cancelledOrd!.status === 'CANCELLED', 'CANCELLED status preserved');

    console.log('✓ TEST 1-4 PASSED: All orders, items, statuses, and fields restored accurately from cloud\n');

    // ---------------------------------------------------------------------------
    // TEST 5: Verify open order service & UI query visibility
    // ---------------------------------------------------------------------------
    console.log('--- TEST 5: Verify getOpenOrders (UI consumption) returns active orders ---');
    const visibleOrders = await openOrderService.getOpenOrders(shop1Id);
    assert(visibleOrders.length === 1, `UI should see exactly 1 OPEN order (found ${visibleOrders.length})`);
    assert(visibleOrders[0].id === 'ord_cloud_open', 'UI sees ord_cloud_open');

    const detailWithItems = await openOrderService.getOpenOrderWithItems('ord_cloud_open');
    assert(detailWithItems !== null, 'getOpenOrderWithItems must return the order');
    assert(detailWithItems!.items.length === 1, 'Order must include its 1 item');
    assert(detailWithItems!.items[0].productName === 'Cloud Product 1', 'Item name matches');
    console.log('✓ TEST 5 PASSED: Restored open orders load into UI service and live queries\n');

    // ---------------------------------------------------------------------------
    // TEST 6: Restore Idempotency (Restoring twice without duplicate records)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 6: Idempotent restore (Restoring twice) ---');
    const secondRestore = await syncService.bootstrapFromCloud(shop1Id);
    assert(secondRestore.success, 'Second restore should succeed');

    const allOrdersAfterSecond = await db.openOrders.where('shopId').equals(shop1Id).toArray();
    assert(allOrdersAfterSecond.length === 3, `Must still have exactly 3 orders after second restore, found ${allOrdersAfterSecond.length}`);

    const allItemsAfterSecond = await db.openOrderItems.where('shopId').equals(shop1Id).toArray();
    assert(allItemsAfterSecond.length === 3, `Must still have exactly 3 items after second restore, found ${allItemsAfterSecond.length}`);
    console.log('✓ TEST 6 PASSED: Re-running cloud restore is strictly idempotent (no duplicate orders or items)\n');

    // ---------------------------------------------------------------------------
    // TEST 7 & 9: Multi-Shop Isolation & Unrelated Local Records Intact
    // ---------------------------------------------------------------------------
    console.log('--- TEST 7 & 9: Multi-Shop Isolation & Local Business Data Preservation ---');
    // Create local data for Shop 2
    await db.openOrders.put({
      id: 'ord_shop_2_local',
      shopId: shop2Id,
      customerId: null,
      temporaryCustomerName: 'Shop 2 Walk-in',
      status: 'OPEN',
      totalAmount: 120,
      itemCount: 4,
      note: 'Shop 2 held order',
      saleId: null,
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.openOrderItems.put({
      id: 'oi_shop_2_local',
      shopId: shop2Id,
      openOrderId: 'ord_shop_2_local',
      productId: 'prod_shop_2',
      productName: 'Shop 2 Biscuit',
      productEmoji: '🍪',
      quantity: 4,
      unitPrice: 30,
      totalPrice: 120,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Re-restore Shop 1 from cloud
    await syncService.bootstrapFromCloud(shop1Id);

    // Verify Shop 2 open order and item are untouched
    const shop2Order = await db.openOrders.get('ord_shop_2_local');
    assert(shop2Order !== undefined, 'Shop 2 local open order must remain intact');
    assert(shop2Order!.totalAmount === 120, 'Shop 2 order total intact');

    const shop2Item = await db.openOrderItems.get('oi_shop_2_local');
    assert(shop2Item !== undefined, 'Shop 2 local order item must remain intact');

    const shop1VisibleOrders = await openOrderService.getOpenOrders(shop1Id);
    const shop2VisibleOrders = await openOrderService.getOpenOrders(shop2Id);
    assert(shop1VisibleOrders.every((o) => o.shopId === shop1Id), 'Shop 1 cannot see Shop 2');
    assert(shop2VisibleOrders.every((o) => o.shopId === shop2Id), 'Shop 2 cannot see Shop 1');
    console.log('✓ TEST 7 & 9 PASSED: Multi-shop isolation preserved; Shop 2 records untouched\n');

    // ---------------------------------------------------------------------------
    // TEST 8 & 11: Error Handling & Atomic Rollback
    // ---------------------------------------------------------------------------
    console.log('--- TEST 8 & 11: Malformed Data Handling & Failed Restore Rollback ---');
    // If api.bootstrap returns network error
    api.bootstrap = async () => {
      throw new Error('Simulated network disconnect');
    };

    const failedResult = await syncService.bootstrapFromCloud(shop1Id);
    assert(!failedResult.success, 'Restore must report success: false on error');
    assert(failedResult.error?.includes('Simulated network disconnect'), 'Error message preserved');

    // Existing Shop 1 orders must remain intact after failed restore
    const ordersAfterFailure = await db.openOrders.where('shopId').equals(shop1Id).toArray();
    assert(ordersAfterFailure.length === 3, 'Existing records must be preserved after failed restore');
    console.log('✓ TEST 8 & 11 PASSED: Unsuccessful restore reports failure and keeps local records intact\n');

    // ---------------------------------------------------------------------------
    // TEST 10: JSON Backup & Restore Testing
    // ---------------------------------------------------------------------------
    console.log('--- TEST 10: JSON Backup & Restore ---');
    // Restore api.bootstrap for normal operation
    api.bootstrap = async (sId?: string) => {
      if (sId === shop1Id) return mockCloudBootstrapData as any;
      return originalBootstrap(sId);
    };

    // Export JSON backup payload
    const jsonBackup = await backupService.createBackupPayload(shop1Id, 'JSON Test Shop');
    assert(jsonBackup.data.openOrders !== undefined, 'JSON backup must include openOrders');
    assert(jsonBackup.data.openOrders!.length === 3, 'JSON backup must have 3 openOrders');
    assert(jsonBackup.data.openOrderItems !== undefined, 'JSON backup must include openOrderItems');
    assert(jsonBackup.data.openOrderItems!.length === 3, 'JSON backup must have 3 openOrderItems');

    // Validate JSON backup
    const validation = backupService.validateBackup(JSON.stringify(jsonBackup), shop1Id);
    assert(validation.valid, 'JSON backup must validate as true');
    assert(validation.counts?.openOrders === 3, `Validation counts must report 3 openOrders (got ${validation.counts?.openOrders})`);
    assert(validation.counts?.total && validation.counts.total >= 5, 'Validation total must include open orders');

    // Clear Shop 1 local records
    await db.openOrders.where('shopId').equals(shop1Id).delete();
    await db.openOrderItems.where('shopId').equals(shop1Id).delete();
    const countAfterDelete = await db.openOrders.where('shopId').equals(shop1Id).count();
    assert(countAfterDelete === 0, 'Local orders cleared before JSON restore');

    // Restore JSON backup
    const jsonRestoreResult = await backupService.restoreBackup(jsonBackup, shop1Id);
    assert(jsonRestoreResult.success, 'JSON restore must succeed');
    assert(jsonRestoreResult.restoredCounts?.openOrders === 3, 'restoredCounts must report 3 openOrders');
    assert(jsonRestoreResult.restoredCounts?.openOrderItems === 3, 'restoredCounts must report 3 openOrderItems');
    assert(jsonRestoreResult.restoredCounts?.total && jsonRestoreResult.restoredCounts.total >= 5, 'total must include open orders');

    // Verify orders are back in Dexie
    const ordersAfterJsonRestore = await db.openOrders.where('shopId').equals(shop1Id).toArray();
    assert(ordersAfterJsonRestore.length === 3, 'All 3 orders restored from JSON');

    const itemsAfterJsonRestore = await db.openOrderItems.where('shopId').equals(shop1Id).toArray();
    assert(itemsAfterJsonRestore.length === 3, 'All 3 items restored from JSON');

    // Test rejection of corrupted JSON backup (orphaned open order item)
    const corruptedBackup = JSON.parse(JSON.stringify(jsonBackup));
    corruptedBackup.data.openOrderItems.push({
      id: 'oi_orphan',
      shopId: shop1Id,
      openOrderId: 'ord_non_existent',
      productId: 'prod_cloud_1',
      productName: 'Orphaned Item',
      quantity: 1,
      unitPrice: 10,
      totalPrice: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const corruptValidation = backupService.validateBackup(JSON.stringify(corruptedBackup), shop1Id);
    assert(!corruptValidation.valid, 'Corrupted JSON backup with orphaned item must be rejected');
    console.log(`Expected validation rejection caught: "${corruptValidation.error}"`);
    console.log('✓ TEST 10 PASSED: JSON export, validation, and restore fully verified for open orders & items\n');

    // ---------------------------------------------------------------------------
    // TEST 12: getCloudPreview verification
    // ---------------------------------------------------------------------------
    console.log('--- TEST 12: getCloudPreview includes openOrders count ---');
    const preview = await syncService.getCloudPreview(shop1Id);
    assert(preview.success, 'Cloud preview must succeed');
    assert(preview.counts?.openOrders === 3, `Cloud preview counts.openOrders should be 3 (got ${preview.counts?.openOrders})`);
    console.log('✓ TEST 12 PASSED: Cloud preview includes open orders in preview counts\n');

  } finally {
    api.bootstrap = originalBootstrap;
  }

  console.log('========================================================================');
  console.log('🎉 ALL OPEN ORDERS RESTORE REGRESSION TESTS PASSED (12/12)!');
  console.log('========================================================================');
}

runRestoreRegressionTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
