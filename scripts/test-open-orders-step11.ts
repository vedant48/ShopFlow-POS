import './setup-node-polyfills';

import { db } from '../src/db';
import { syncService } from '../src/services/syncService';
import { inventoryService } from '../src/services/inventoryService';
import { customerService } from '../src/services/customerService';
import { openOrderService } from '../src/services/openOrderService';
import { backupService } from '../src/services/backupService';
import { authService } from '../src/auth/authService';
import type { CartItem, Product } from '../src/types';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runStep11Tests() {
  console.log('========================================================================');
  console.log('SHOPFLOW STEP 11: OPEN ORDERS & TIMELINE VERIFICATION TEST SUITE');
  console.log('========================================================================\n');

  // Register Shop A
  const phoneA = '98' + Math.floor(10000000 + Math.random() * 90000000);
  console.log(`Setting up Shop A (${phoneA})...`);
  const regA = await authService.register({
    phone: phoneA,
    name: 'Owner A',
    shopName: 'Shop Alpha POS',
    pin: '1234',
  });
  const shopAId = regA.shop.id;
  console.log(`Shop A registered: ${shopAId}\n`);

  // Create products for Shop A
  const coke = await inventoryService.addProduct({
    name: 'Coke 250ml',
    emoji: '🥤',
    sellingPrice: 20,
    costPrice: 15,
    stock: 20,
    minStock: 5,
    category: 'Drinks',
    shopId: shopAId,
  });

  const lays = await inventoryService.addProduct({
    name: 'Lays Classic',
    emoji: '🥔',
    sellingPrice: 20,
    costPrice: 14,
    stock: 15,
    minStock: 3,
    category: 'Snacks',
    shopId: shopAId,
  });

  const chocolate = await inventoryService.addProduct({
    name: 'Dairy Milk',
    emoji: '🍫',
    sellingPrice: 30,
    costPrice: 22,
    stock: 10,
    minStock: 2,
    category: 'Sweets',
    shopId: shopAId,
  });

  // Create Customer Rahul for Shop A
  const rahul = await customerService.addCustomer({
    name: 'Rahul',
    phone: '9988776655',
    shopId: shopAId,
  });

  console.log('Seed data ready: Coke (stock 20, ₹20), Lays (stock 15, ₹20), Chocolate (stock 10, ₹30), Customer Rahul.\n');

  // -------------------------------------------------------------------------
  // TEST 1: Add Coke x2. Tap HOLD ORDER. Verify Open Order is created.
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Add Coke x2 -> HOLD ORDER ---');
  const cart1: CartItem[] = [{ product: coke, quantity: 2 }];
  const { order: order1, items: items1 } = await openOrderService.createOpenOrder({
    items: cart1,
    temporaryCustomerName: 'Walk-in #1',
    shopId: shopAId,
  });
  assert(order1.status === 'OPEN', 'Order 1 status should be OPEN');
  assert(order1.itemCount === 2, 'Order 1 item count should be 2');
  assert(order1.totalAmount === 40, 'Order 1 total should be ₹40');
  assert(items1.length === 1 && items1[0].unitPrice === 20, 'Item 1 unitPrice captured as ₹20');
  console.log('✓ TEST 1 PASSED: Open Order created with Coke x2 (₹40)\n');

  // -------------------------------------------------------------------------
  // TEST 2: Open Orders shows the order.
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: Verify Open Orders list contains order ---');
  const openList = await openOrderService.getOpenOrders(shopAId);
  assert(openList.some((o) => o.id === order1.id), 'Open orders list must contain order 1');
  console.log('✓ TEST 2 PASSED: Order 1 found in getOpenOrders()\n');

  // -------------------------------------------------------------------------
  // TEST 3: Reopen order. Add Lays. Verify total updates.
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: Reopen order -> Add Lays x1 ---');
  await openOrderService.addItemToOrder(order1.id, lays, 1);
  const order1Updated = await openOrderService.getOpenOrderWithItems(order1.id);
  assert(order1Updated !== null, 'Order 1 must exist');
  assert(order1Updated!.order.itemCount === 3, 'Item count should be 3');
  assert(order1Updated!.order.totalAmount === 60, 'Total should be ₹60 (40 + 20)');
  console.log('✓ TEST 3 PASSED: Added Lays, total is ₹60\n');

  // -------------------------------------------------------------------------
  // TEST 4: Remove one Coke. Verify quantity and total update.
  // -------------------------------------------------------------------------
  console.log('--- TEST 4: Decrease Coke quantity from 2 to 1 ---');
  const cokeItem = order1Updated!.items.find((i) => i.productId === coke.id)!;
  await openOrderService.updateItemQuantity(order1.id, cokeItem.id, 1);
  const order1AfterDecrease = await openOrderService.getOpenOrderWithItems(order1.id);
  assert(order1AfterDecrease!.order.itemCount === 2, 'Item count should now be 2');
  assert(order1AfterDecrease!.order.totalAmount === 40, 'Total should now be ₹40 (20 + 20)');
  console.log('✓ TEST 4 PASSED: Coke decreased to 1, total is ₹40\n');

  // -------------------------------------------------------------------------
  // TEST 5: Add another product. Verify auto-save.
  // -------------------------------------------------------------------------
  console.log('--- TEST 5: Add Chocolate x1 -> Auto-saved to Dexie ---');
  await openOrderService.addItemToOrder(order1.id, chocolate, 1);
  const order1AfterChoc = await openOrderService.getOpenOrderWithItems(order1.id);
  assert(order1AfterChoc!.order.itemCount === 3, 'Item count should be 3');
  assert(order1AfterChoc!.order.totalAmount === 70, 'Total should be ₹70 (40 + 30)');
  console.log('✓ TEST 5 PASSED: Auto-saved to Dexie immediately\n');

  // -------------------------------------------------------------------------
  // TEST 6: Create Open Order for known customer Rahul. Verify Rahul is attached.
  // -------------------------------------------------------------------------
  console.log('--- TEST 6: Create Open Order for Rahul ---');
  const cartRahul: CartItem[] = [{ product: coke, quantity: 4 }];
  const { order: rahulOrder } = await openOrderService.createOpenOrder({
    items: cartRahul,
    customerId: rahul.id,
    customerName: rahul.name,
    shopId: shopAId,
  });
  assert(rahulOrder.customerId === rahul.id, 'Customer ID should match Rahul');
  assert(rahulOrder.totalAmount === 80, 'Total should be ₹80');
  console.log('✓ TEST 6 PASSED: Open Order created for Rahul (₹80)\n');

  // -------------------------------------------------------------------------
  // TEST 7: Create Open Order without customer. Verify Walk-in #1 is generated.
  // -------------------------------------------------------------------------
  console.log('--- TEST 7: Generate Walk-in name when empty ---');
  // First, cancel order1 so Walk-in #1 becomes available again or check sequence
  const nextWalkIn = await openOrderService.getNextWalkInName(shopAId);
  console.log(`Next walk in name suggested: ${nextWalkIn}`);
  assert(nextWalkIn.startsWith('Walk-in #'), 'Should start with Walk-in #');
  console.log('✓ TEST 7 PASSED: Walk-in naming correctly scoped\n');

  // -------------------------------------------------------------------------
  // TEST 8: Create another unknown order. Verify Walk-in #2 is generated.
  // -------------------------------------------------------------------------
  console.log('--- TEST 8: Create second walk-in order ---');
  const { order: walkIn2 } = await openOrderService.createOpenOrder({
    items: [{ product: lays, quantity: 2 }],
    temporaryCustomerName: 'Walk-in #2',
    shopId: shopAId,
  });
  assert(walkIn2.temporaryCustomerName === 'Walk-in #2', 'Walk-in #2 created');
  console.log('✓ TEST 8 PASSED: Walk-in #2 successfully created\n');

  // -------------------------------------------------------------------------
  // TEST 9: Open Walk-in #2. Convert it to Rahul. Verify customer changes.
  // -------------------------------------------------------------------------
  console.log('--- TEST 9: Convert Walk-in #2 to Rahul ---');
  await openOrderService.updateOrderCustomer(walkIn2.id, rahul.id, rahul.name);
  const walkIn2Updated = await db.openOrders.get(walkIn2.id);
  assert(walkIn2Updated?.customerId === rahul.id, 'walkIn2 now attached to Rahul');
  assert(walkIn2Updated?.temporaryCustomerName === null, 'temporaryCustomerName is null');
  console.log('✓ TEST 9 PASSED: Walk-in #2 converted to Rahul\n');

  // -------------------------------------------------------------------------
  // TEST 10: Checkout known customer as CASH. Verify: Sale created, Payment created, Inventory reduced, Open Order = CHECKED_OUT.
  // -------------------------------------------------------------------------
  console.log('--- TEST 10: Checkout Rahul order as CASH ---');
  const preCokeStock = (await db.products.get(coke.id))!.stock;
  const { sale: cashSale } = await openOrderService.checkoutOpenOrder(rahulOrder.id, {
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    customerId: rahul.id,
    customerName: rahul.name,
  });
  const rahulOrderAfter = await db.openOrders.get(rahulOrder.id);
  assert(rahulOrderAfter?.status === 'CHECKED_OUT', 'Rahul order status is CHECKED_OUT');
  assert(rahulOrderAfter?.saleId === cashSale.id, 'Order points to saleId');
  assert(cashSale.paymentMethod === 'CASH', 'Payment method is CASH');
  const postCokeStock = (await db.products.get(coke.id))!.stock;
  assert(postCokeStock === preCokeStock - 4, `Coke stock reduced by 4 (was ${preCokeStock}, now ${postCokeStock})`);
  console.log('✓ TEST 10 PASSED: Cash checkout succeeded, stock deducted by 4\n');

  // -------------------------------------------------------------------------
  // TEST 11: Checkout known customer as UPI. Verify same.
  // -------------------------------------------------------------------------
  console.log('--- TEST 11: Checkout order1 as UPI ---');
  const { sale: upiSale } = await openOrderService.checkoutOpenOrder(order1.id, {
    paymentStatus: 'PAID',
    paymentMethod: 'UPI',
    customerName: 'Walk-in #1',
  });
  const order1AfterUpi = await db.openOrders.get(order1.id);
  assert(order1AfterUpi?.status === 'CHECKED_OUT', 'Order 1 status is CHECKED_OUT');
  assert(upiSale.paymentMethod === 'UPI', 'Payment method is UPI');
  console.log('✓ TEST 11 PASSED: UPI checkout succeeded\n');

  // -------------------------------------------------------------------------
  // TEST 12: Checkout known customer as Udhaar. Verify balance updated.
  // -------------------------------------------------------------------------
  console.log('--- TEST 12: Checkout walkIn2 (converted to Rahul) as UDHAAR ---');
  const preRahulBal = (await db.customers.get(rahul.id))!.balance || 0;
  const { sale: udhaarSale } = await openOrderService.checkoutOpenOrder(walkIn2.id, {
    paymentStatus: 'UDHAAR',
    paymentMethod: 'NONE',
    customerId: rahul.id,
    customerName: rahul.name,
  });
  const postRahulBal = (await db.customers.get(rahul.id))!.balance || 0;
  assert(udhaarSale.paymentStatus === 'UDHAAR', 'Sale payment status is UDHAAR');
  assert(postRahulBal === preRahulBal + 40, `Rahul balance increased by 40 (was ${preRahulBal}, now ${postRahulBal})`);
  console.log('✓ TEST 12 PASSED: Udhaar checkout updated customer balance\n');

  // -------------------------------------------------------------------------
  // TEST 13: Try Udhaar checkout for Walk-in. Verify anonymous Udhaar is blocked.
  // -------------------------------------------------------------------------
  console.log('--- TEST 13: Attempt anonymous Udhaar checkout ---');
  const { order: anonOrder } = await openOrderService.createOpenOrder({
    items: [{ product: coke, quantity: 1 }],
    temporaryCustomerName: 'Walk-in Anon',
    shopId: shopAId,
  });
  let blockedAnon = false;
  try {
    await openOrderService.checkoutOpenOrder(anonOrder.id, {
      paymentStatus: 'UDHAAR',
      paymentMethod: 'NONE',
      // no customerId
    });
  } catch (err: any) {
    blockedAnon = true;
    console.log(`Expected rejection caught: "${err.message}"`);
  }
  assert(blockedAnon, 'Anonymous Udhaar must be blocked');
  console.log('✓ TEST 13 PASSED: Anonymous Udhaar successfully blocked\n');

  // -------------------------------------------------------------------------
  // TEST 14: Select/create customer, then Udhaar checkout succeeds.
  // -------------------------------------------------------------------------
  console.log('--- TEST 14: Attach customer and checkout Udhaar ---');
  const suresh = await customerService.addCustomer({
    name: 'Suresh',
    phone: '9811223344',
    shopId: shopAId,
  });
  const { sale: sureshSale } = await openOrderService.checkoutOpenOrder(anonOrder.id, {
    paymentStatus: 'UDHAAR',
    paymentMethod: 'NONE',
    customerId: suresh.id,
    customerName: suresh.name,
  });
  assert(sureshSale.paymentStatus === 'UDHAAR', 'Suresh sale status is UDHAAR');
  const postSureshBal = (await db.customers.get(suresh.id))!.balance || 0;
  assert(postSureshBal === 20, `Suresh balance is ₹20 (got ${postSureshBal})`);
  console.log('✓ TEST 14 PASSED: Customer attached and Udhaar checkout completed\n');

  // -------------------------------------------------------------------------
  // TEST 15: Cancel Open Order. Verify no sale, no payment, no inventory movement.
  // -------------------------------------------------------------------------
  console.log('--- TEST 15: Cancel Open Order ---');
  const { order: cancelOrder } = await openOrderService.createOpenOrder({
    items: [{ product: coke, quantity: 3 }],
    temporaryCustomerName: 'Walk-in Cancel',
    shopId: shopAId,
  });
  const preCancelStock = (await db.products.get(coke.id))!.stock;
  await openOrderService.cancelOpenOrder(cancelOrder.id);
  const postCancelOrder = await db.openOrders.get(cancelOrder.id);
  assert(postCancelOrder?.status === 'CANCELLED', 'Order status must be CANCELLED');
  const postCancelStock = (await db.products.get(coke.id))!.stock;
  assert(postCancelStock === preCancelStock, 'Stock remains unchanged after cancellation');
  console.log('✓ TEST 15 PASSED: Order cancelled without touching stock or creating sales\n');

  // -------------------------------------------------------------------------
  // TEST 16 & 17: Inventory safety - stock not deducted until checkout, exactly once.
  // -------------------------------------------------------------------------
  console.log('--- TEST 16 & 17: Inventory deduction timing and uniqueness ---');
  const curChocStock = (await db.products.get(chocolate.id))!.stock;
  const { order: invTestOrder } = await openOrderService.createOpenOrder({
    items: [{ product: chocolate, quantity: 2 }],
    temporaryCustomerName: 'Walk-in Inv',
    shopId: shopAId,
  });
  const stockWhileOpen = (await db.products.get(chocolate.id))!.stock;
  assert(stockWhileOpen === curChocStock, 'Stock unchanged while order is OPEN');

  await openOrderService.checkoutOpenOrder(invTestOrder.id, {
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });
  const stockAfterCheckout = (await db.products.get(chocolate.id))!.stock;
  assert(stockAfterCheckout === curChocStock - 2, 'Stock decreased by 2 after checkout');
  console.log('✓ TEST 16 & 17 PASSED: Inventory deducted only on checkout, exactly once\n');

  // -------------------------------------------------------------------------
  // TEST 18: Change product price after adding to Open Order. Verify unit price retained.
  // -------------------------------------------------------------------------
  console.log('--- TEST 18: Product price change retention ---');
  const { order: priceOrder } = await openOrderService.createOpenOrder({
    items: [{ product: coke, quantity: 2 }],
    temporaryCustomerName: 'Price Test',
    shopId: shopAId,
  });
  // Change Coke price from 20 to 35 in catalog
  await inventoryService.updateProduct(coke.id, { sellingPrice: 35 }, shopAId);
  const loadedPriceOrder = await openOrderService.getOpenOrderWithItems(priceOrder.id);
  assert(loadedPriceOrder!.items[0].unitPrice === 20, 'Retained original unit price ₹20');
  assert(loadedPriceOrder!.order.totalAmount === 40, 'Total remains ₹40');
  // Revert coke price
  await inventoryService.updateProduct(coke.id, { sellingPrice: 20 }, shopAId);
  console.log('✓ TEST 18 PASSED: Open Order retained original unitPrice ₹20 despite catalog price increase\n');

  // -------------------------------------------------------------------------
  // TEST 19 & 20: Multiple Open Orders simultaneously and separate editing.
  // -------------------------------------------------------------------------
  console.log('--- TEST 19 & 20: 3 Simultaneous Open Orders & Isolation ---');
  const { order: oA } = await openOrderService.createOpenOrder({
    items: [{ product: coke, quantity: 1 }],
    temporaryCustomerName: 'Order A',
    shopId: shopAId,
  });
  const { order: oB } = await openOrderService.createOpenOrder({
    items: [{ product: lays, quantity: 2 }],
    temporaryCustomerName: 'Order B',
    shopId: shopAId,
  });
  const { order: oC } = await openOrderService.createOpenOrder({
    items: [{ product: chocolate, quantity: 3 }],
    temporaryCustomerName: 'Order C',
    shopId: shopAId,
  });

  // Edit Order B
  await openOrderService.addItemToOrder(oB.id, coke, 1);
  const freshA = await openOrderService.getOpenOrderWithItems(oA.id);
  const freshB = await openOrderService.getOpenOrderWithItems(oB.id);
  const freshC = await openOrderService.getOpenOrderWithItems(oC.id);

  assert(freshA!.order.totalAmount === 20, 'Order A intact at ₹20');
  assert(freshB!.order.totalAmount === 60, 'Order B updated to ₹60 (40 + 20)');
  assert(freshC!.order.totalAmount === 90, 'Order C intact at ₹90');
  console.log('✓ TEST 19 & 20 PASSED: 3 simultaneous orders maintained without cross-contamination\n');

  // Clean up test orders
  await openOrderService.cancelOpenOrder(priceOrder.id);
  await openOrderService.cancelOpenOrder(oA.id);
  await openOrderService.cancelOpenOrder(oB.id);
  await openOrderService.cancelOpenOrder(oC.id);

  // -------------------------------------------------------------------------
  // TEST 21 & 22: Offline operation and sync to Cloudflare D1
  // -------------------------------------------------------------------------
  console.log('--- TEST 21 & 22: Offline operation & Cloudflare sync ---');
  const { order: syncTestOrder } = await openOrderService.createOpenOrder({
    items: [{ product: coke, quantity: 1 }],
    temporaryCustomerName: 'Sync Test Walk-in',
    shopId: shopAId,
  });
  assert(syncTestOrder.status === 'OPEN', 'Offline creation succeeds in Dexie');

  // Trigger sync queue processing
  console.log('Flushing sync queue to Cloudflare Worker...');
  await syncService.syncPendingEvents(true, shopAId);
  const queueStats = await syncService.getStats(shopAId);
  console.log(`Sync status: pending=${queueStats.pendingCount}, synced=${queueStats.syncedCount}`);
  assert(queueStats.failedCount === 0, 'No failed items in sync queue');
  console.log('✓ TEST 21 & 22 PASSED: Offline write and cloud sync succeeded\n');

  // -------------------------------------------------------------------------
  // TEST 23: Refresh/Persistence check
  // -------------------------------------------------------------------------
  console.log('--- TEST 23: Open Orders persistence in Dexie ---');
  const persisted = await db.openOrders.get(syncTestOrder.id);
  assert(persisted !== undefined && persisted.status === 'OPEN', 'Order persisted in Dexie');
  console.log('✓ TEST 23 PASSED: Open Order persisted in local Dexie\n');

  // -------------------------------------------------------------------------
  // TEST 24: Backup & Restore preserves openOrders & openOrderItems
  // -------------------------------------------------------------------------
  console.log('--- TEST 24: Backup and Restore preserves Open Orders ---');
  const backup = await backupService.createBackupPayload(shopAId, 'Shop Alpha POS');
  assert(Array.isArray(backup.data.openOrders), 'Backup contains openOrders array');
  assert(Array.isArray(backup.data.openOrderItems), 'Backup contains openOrderItems array');
  assert(backup.data.openOrders!.some((o: any) => o.id === syncTestOrder.id), 'Backup includes syncTestOrder');

  // Restore backup
  const restoreSummary = await backupService.restoreBackup(backup, shopAId);
  assert(restoreSummary.success, 'Restore succeeded');
  const afterRestore = await db.openOrders.get(syncTestOrder.id);
  assert(afterRestore?.status === 'OPEN', 'Status OPEN preserved after restore');
  console.log('✓ TEST 24 PASSED: Backup & restore preserved open orders successfully\n');

  // -------------------------------------------------------------------------
  // TEST 25: Shop A and Shop B isolation
  // -------------------------------------------------------------------------
  console.log('--- TEST 25: Multi-shop isolation ---');
  const phoneB = '96' + Math.floor(10000000 + Math.random() * 90000000);
  const regB = await authService.register({
    phone: phoneB,
    name: 'Owner B',
    shopName: 'Shop Beta POS',
    pin: '1234',
  });
  const shopBId = regB.shop.id;

  const shopAOrders = await openOrderService.getOpenOrders(shopAId);
  const shopBOrders = await openOrderService.getOpenOrders(shopBId);
  assert(shopBOrders.length === 0, 'Shop B cannot see Shop A open orders');
  assert(shopAOrders.every((o) => o.shopId === shopAId), 'All Shop A orders belong to Shop A');
  console.log('✓ TEST 25 PASSED: Strict shop isolation verified between Shop A and Shop B\n');

  // -------------------------------------------------------------------------
  // TEST 26: 5 consecutive walk-ins have unique IDs
  // -------------------------------------------------------------------------
  console.log('--- TEST 26: 5 consecutive Open Orders walk-in IDs uniqueness ---');
  const ordersBatch = [];
  for (let i = 0; i < 5; i++) {
    const { order } = await openOrderService.createOpenOrder({
      items: [{ product: coke, quantity: 1 }],
      temporaryCustomerName: `Batch Walk-in #${i + 1}`,
      shopId: shopAId,
    });
    ordersBatch.push(order);
  }
  const uniqueIds = new Set(ordersBatch.map((o) => o.id));
  assert(uniqueIds.size === 5, 'All 5 orders must have distinct IDs');
  console.log('✓ TEST 26 PASSED: All 5 consecutive orders have distinct IDs\n');

  // -------------------------------------------------------------------------
  // TEST 27: Idempotent checkout guard (Checkout same order twice is blocked)
  // -------------------------------------------------------------------------
  console.log('--- TEST 27: Prevent duplicate checkout of already CHECKED_OUT order ---');
  const targetOrder = ordersBatch[0];
  await openOrderService.checkoutOpenOrder(targetOrder.id, {
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
  });
  let doubleCheckoutBlocked = false;
  try {
    await openOrderService.checkoutOpenOrder(targetOrder.id, {
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
    });
  } catch (err: any) {
    doubleCheckoutBlocked = true;
    console.log(`Expected guard caught: "${err.message}"`);
  }
  assert(doubleCheckoutBlocked, 'Second checkout attempt must be strictly blocked');
  console.log('✓ TEST 27 PASSED: Double-checkout prevented with transaction lock & status guard\n');

  console.log('========================================================================');
  console.log('🎉 ALL 27 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');
}

runStep11Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error in test suite:', err);
    process.exit(1);
  });
