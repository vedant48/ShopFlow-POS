async function testWorkerEndpoints() {
  console.log('Testing Cloudflare Worker API on http://127.0.0.1:8787...\n');

  const randPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

  // 1. Register new shop
  const regRes = await fetch('http://127.0.0.1:8787/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ramesh Kumar',
      shopName: 'Ramesh General Store',
      phone: randPhone,
      pin: '1234',
    }),
  });

  const regData: any = await regRes.json();
  console.log('Register response status:', regRes.status);
  if (!regData.token) {
    throw new Error(`Register failed: ${JSON.stringify(regData)}`);
  }
  const token = regData.token;
  const shopId = regData.shop.id;
  console.log(`✓ 1. Registered shop: ${shopId} (${regData.shop.name})`);

  // 2. Fetch categories (should have default seeded categories from registration)
  const catRes = await fetch('http://127.0.0.1:8787/api/categories', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cats: any = await catRes.json();
  console.log(`✓ 2. GET /api/categories returned ${cats.length} categories`);
  if (!Array.isArray(cats) || cats.length === 0) {
    throw new Error('Expected default categories to be seeded on registration');
  }

  // 3. Create a custom category (Ice Cream)
  const createCatRes = await fetch('http://127.0.0.1:8787/api/categories', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Ice Cream',
      icon: 'icecream',
      sortOrder: 10,
    }),
  });
  const newCat: any = await createCatRes.json();
  console.log(`✓ 3. POST /api/categories created: ${newCat.name} (${newCat.id})`);

  // 4. Update the category
  const patchCatRes = await fetch(`http://127.0.0.1:8787/api/categories/${newCat.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Gourmet Ice Cream',
    }),
  });
  const updatedCat: any = await patchCatRes.json();
  console.log(`✓ 4. PATCH /api/categories/:id updated name: ${updatedCat.name}`);

  // 5. Create a brand under the new category
  const createBrandRes = await fetch('http://127.0.0.1:8787/api/brands', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categoryId: newCat.id,
      name: 'Amul',
    }),
  });
  const newBrand: any = await createBrandRes.json();
  console.log(`✓ 5. POST /api/brands created brand: ${newBrand.name} in category ${newCat.id}`);

  // 6. Get brands for category
  const getBrandsRes = await fetch(`http://127.0.0.1:8787/api/categories/${newCat.id}/brands`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const categoryBrands: any = await getBrandsRes.json();
  console.log(`✓ 6. GET /api/categories/:id/brands returned ${categoryBrands.length} brands`);

  // 7. Test sync endpoint with Category -> Brand -> Product events
  const syncPayload = {
    shopId,
    events: [
      {
        id: `sync_${Date.now()}_cat`,
        entity: 'categories',
        entityId: `cat_offline_${Date.now()}`,
        operation: 'CREATE',
        payload: {
          name: 'Stationery',
          icon: 'package',
          sortOrder: 20,
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: `sync_${Date.now()}_br`,
        entity: 'brands',
        entityId: `br_offline_${Date.now()}`,
        operation: 'CREATE',
        payload: {
          categoryId: `cat_offline_${Date.now()}`,
          name: 'Classmate',
          sortOrder: 1,
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: `sync_${Date.now()}_prod`,
        entity: 'products',
        entityId: `prod_offline_${Date.now()}`,
        operation: 'CREATE',
        payload: {
          name: 'Notebook 200pg',
          categoryId: `cat_offline_${Date.now()}`,
          brandId: `br_offline_${Date.now()}`,
          sellingPrice: 50,
          costPrice: 35,
          stock: 20,
          minStock: 5,
        },
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const syncRes = await fetch('http://127.0.0.1:8787/api/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(syncPayload),
  });
  const syncData: any = await syncRes.json();
  console.log(`✓ 7. POST /api/sync processed: ${syncData.syncedCount} events successfully, ${syncData.failedCount || 0} failed`);
  if (syncData.failedCount > 0) {
    throw new Error(`Sync had failures: ${JSON.stringify(syncData)}`);
  }

  // 8. Test bootstrap endpoint
  const bootRes = await fetch('http://127.0.0.1:8787/api/bootstrap', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const bootData: any = await bootRes.json();
  console.log(`✓ 8. GET /api/bootstrap returned: ${bootData.categories?.length} categories, ${bootData.brands?.length} brands, ${bootData.products?.length} products`);

  console.log('\n🎉 ALL WORKER API ENDPOINTS PASSED VERIFICATION!');
}

testWorkerEndpoints().catch((err) => {
  console.error('\n❌ WORKER API TEST FAILED:', err);
  process.exit(1);
});
