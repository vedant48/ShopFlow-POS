const baseUrl = 'https://shopflow-worker.vedant-753.workers.dev';

async function runTimingTest() {
  console.log('===============================================================');
  console.log('Testing Production Worker Timing & Latency Breakdown');
  console.log('===============================================================\n');

  // 1. Authenticate / Register a test shop
  const testPhone = '99' + Math.floor(10000000 + Math.random() * 90000000);
  console.log(`Registering test shop with phone: ${testPhone}...`);
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: testPhone,
      name: 'Diagnostic User',
      shopName: 'Latency Diagnosis Shop',
      pin: '1234',
      deviceId: 'diag_pc',
    }),
  });
  const regData: any = await regRes.json();
  const token = regData.token;
  const shopId = regData.shop?.id;
  console.log(`Registered successfully: shopId=${shopId}\n`);

  // Helper to send sync
  async function sendSync(label: string, events: any[]) {
    const start = performance.now();
    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shopId, events }),
    });
    const networkDur = performance.now() - start;
    const data: any = await res.json();
    console.log(`--- [${label}] ---`);
    console.log(`HTTP Status: ${res.status}`);
    console.log(`Total Frontend/Client Network Duration: ${networkDur.toFixed(2)}ms`);
    console.log(`Server-Timing header: ${res.headers.get('Server-Timing')}`);
    console.log(`Worker reported timings:`, JSON.stringify(data.timings, null, 2));
    console.log('');
    return { networkDur, data };
  }

  // TEST 1: First Write (Single Product)
  const prod1Id = `prod_t1_${Date.now()}`;
  const sync1Id = `sync_t1_${Date.now()}`;
  await sendSync('WRITE 1: First write (Product CREATE)', [
    {
      id: sync1Id,
      entity: 'products',
      entityId: prod1Id,
      operation: 'CREATE',
      payload: { name: 'Diag Product 1', sellingPrice: 100, costPrice: 80, stock: 50 },
      createdAt: new Date().toISOString(),
    },
  ]);

  // TEST 2: Second Write immediately after (Single Product)
  const prod2Id = `prod_t2_${Date.now()}`;
  const sync2Id = `sync_t2_${Date.now()}`;
  await sendSync('WRITE 2: Immediate second write (Product CREATE)', [
    {
      id: sync2Id,
      entity: 'products',
      entityId: prod2Id,
      operation: 'CREATE',
      payload: { name: 'Diag Product 2', sellingPrice: 200, costPrice: 150, stock: 30 },
      createdAt: new Date().toISOString(),
    },
  ]);

  // TEST 3: Simultaneous / Concurrent Writes (Simulate 2 requests in-flight at once)
  console.log('Sending TWO WRITES CONCURRENTLY (Promise.all)...');
  const conc1ProdId = `prod_c1_${Date.now()}`;
  const conc2ProdId = `prod_c2_${Date.now()}`;
  const concStart = performance.now();
  const [conc1Res, conc2Res] = await Promise.all([
    sendSync('CONCURRENT WRITE A', [
      {
        id: `sync_c1_${Date.now()}`,
        entity: 'products',
        entityId: conc1ProdId,
        operation: 'CREATE',
        payload: { name: 'Concurrent A', sellingPrice: 50, costPrice: 30, stock: 10 },
        createdAt: new Date().toISOString(),
      },
    ]),
    sendSync('CONCURRENT WRITE B', [
      {
        id: `sync_c2_${Date.now()}`,
        entity: 'products',
        entityId: conc2ProdId,
        operation: 'CREATE',
        payload: { name: 'Concurrent B', sellingPrice: 60, costPrice: 40, stock: 15 },
        createdAt: new Date().toISOString(),
      },
    ]),
  ]);
  console.log(`Concurrent writes total wall-clock time: ${(performance.now() - concStart).toFixed(2)}ms\n`);

  // TEST 4: Realistic Sale Write (Sale + Items + Movements + Product Updates = 8 events)
  console.log('Sending REALISTIC SALE WRITE (8 events in 1 sync batch)...');
  const saleId = `sale_${Date.now()}`;
  const saleEvents = [
    {
      id: `sync_sale_${Date.now()}`,
      entity: 'sales',
      entityId: saleId,
      operation: 'CREATE',
      payload: { totalAmount: 300, paymentStatus: 'PAID', paymentMethod: 'CASH', itemCount: 3 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_item1_${Date.now()}`,
      entity: 'saleItems',
      entityId: `item_1_${Date.now()}`,
      operation: 'CREATE',
      payload: { saleId, productId: prod1Id, quantity: 1, sellingPrice: 100, costPrice: 80, totalPrice: 100 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_mov1_${Date.now()}`,
      entity: 'inventoryMovements',
      entityId: `mov_1_${Date.now()}`,
      operation: 'CREATE',
      payload: { productId: prod1Id, type: 'SALE', quantityChange: -1, newStock: 49 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_prod_upd1_${Date.now()}`,
      entity: 'products',
      entityId: prod1Id,
      operation: 'UPDATE',
      payload: { stock: 49 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_item2_${Date.now()}`,
      entity: 'saleItems',
      entityId: `item_2_${Date.now()}`,
      operation: 'CREATE',
      payload: { saleId, productId: prod2Id, quantity: 2, sellingPrice: 100, costPrice: 70, totalPrice: 200 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_mov2_${Date.now()}`,
      entity: 'inventoryMovements',
      entityId: `mov_2_${Date.now()}`,
      operation: 'CREATE',
      payload: { productId: prod2Id, type: 'SALE', quantityChange: -2, newStock: 28 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_prod_upd2_${Date.now()}`,
      entity: 'products',
      entityId: prod2Id,
      operation: 'UPDATE',
      payload: { stock: 28 },
      createdAt: new Date().toISOString(),
    },
  ];
  await sendSync('WRITE 4: Sale batch (7 events)', saleEvents);

  // TEST 5: Second Sale Immediately After
  const sale2Id = `sale2_${Date.now()}`;
  const sale2Events = [
    {
      id: `sync_sale2_${Date.now()}`,
      entity: 'sales',
      entityId: sale2Id,
      operation: 'CREATE',
      payload: { totalAmount: 100, paymentStatus: 'PAID', paymentMethod: 'UPI', itemCount: 1 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_item21_${Date.now()}`,
      entity: 'saleItems',
      entityId: `item_21_${Date.now()}`,
      operation: 'CREATE',
      payload: { saleId: sale2Id, productId: prod1Id, quantity: 1, sellingPrice: 100, costPrice: 80, totalPrice: 100 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_mov21_${Date.now()}`,
      entity: 'inventoryMovements',
      entityId: `mov_21_${Date.now()}`,
      operation: 'CREATE',
      payload: { productId: prod1Id, type: 'SALE', quantityChange: -1, newStock: 48 },
      createdAt: new Date().toISOString(),
    },
    {
      id: `sync_prod_upd21_${Date.now()}`,
      entity: 'products',
      entityId: prod1Id,
      operation: 'UPDATE',
      payload: { stock: 48 },
      createdAt: new Date().toISOString(),
    },
  ];
  await sendSync('WRITE 5: Second Sale immediately after (4 events)', sale2Events);
}

runTimingTest().catch(console.error);
