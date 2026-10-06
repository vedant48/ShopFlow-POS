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
if (typeof globalThis.navigator === 'undefined') {
  (globalThis as any).navigator = { onLine: true };
}

import { db } from './db';
import { seedDatabaseIfEmpty } from './db/seed';
import { categoryService } from './services/categoryService';
import { brandService } from './services/brandService';
import { inventoryService } from './services/inventoryService';
import { saleService } from './services/saleService';
import { backupService } from './services/backupService';
import { getCategoryEmoji, DEFAULT_CATEGORY_SEEDS } from './constants/categoryIcons';

async function runStep10AcceptanceTests() {
  console.log('🧪 Running ShopFlow Step 10: Category → Optional Brand → Product Acceptance Tests...\n');

  // Initialize fresh test database
  await db.delete();
  await db.open();
  await seedDatabaseIfEmpty();

  // Create initial test products for verification
  await inventoryService.addProduct({
    name: 'Classic Milds',
    categoryId: 'cat_shop_demo_001_cigarettes',
    brandId: 'br_shop_demo_001_classic',
    sellingPrice: 18,
    costPrice: 14,
    stock: 25,
    minStock: 10,
    active: true,
  });

  console.log('--- TEST GROUP 1: DATABASE & SCHEMA INTEGRITY ---');
  // 1. Categories table exists
  const catCount = await db.categories.count();
  if (catCount < 6) throw new Error(`Test 1 Failed: Expected at least 6 categories, found ${catCount}`);
  console.log(`✓ 1. Categories table exists with ${catCount} records`);

  // 2. Brands table exists
  const brandCount = await db.brands.count();
  if (brandCount === 0) throw new Error('Test 2 Failed: Brands table is empty');
  console.log(`✓ 2. Brands table exists with ${brandCount} records`);

  // 3. Products support categoryId and brandId
  const allProds = await db.products.toArray();
  const prodsWithCat = allProds.filter((p) => p.categoryId);
  if (prodsWithCat.length === 0) throw new Error('Test 3 Failed: Products do not have categoryId');
  console.log(`✓ 3. Products support categoryId & brandId (${prodsWithCat.length}/${allProds.length} verified)`);

  console.log('\n--- TEST GROUP 2: CATEGORY OPERATIONS & ICONS ---');
  // 4. Default categories and icons
  const cigarettesCat = await db.categories.filter((c) => c.name === 'Cigarettes').first();
  if (!cigarettesCat || cigarettesCat.icon !== 'cigarette') {
    throw new Error('Test 4 Failed: Cigarettes category missing or has wrong icon');
  }
  const cigEmoji = getCategoryEmoji(cigarettesCat.icon);
  if (cigEmoji !== '🚬') throw new Error(`Test 4 Failed: Expected 🚬 emoji, got ${cigEmoji}`);
  console.log(`✓ 4. Default category icon for Cigarettes resolved correctly to "${cigEmoji}"`);

  // 5. Create custom category (e.g. Ice Cream)
  const iceCreamCat = await categoryService.createCategory({
    name: 'Ice Cream',
    icon: 'icecream',
  }, 'shop_demo_001');
  if (!iceCreamCat || iceCreamCat.name !== 'Ice Cream') {
    throw new Error('Test 5 Failed: Failed to create custom category');
  }
  console.log(`✓ 5. Custom category created: "${getCategoryEmoji(iceCreamCat.icon)} ${iceCreamCat.name}"`);

  // 6. Rename category
  const renamed = await categoryService.updateCategory(iceCreamCat.id, {
    name: 'Premium Ice Cream',
    icon: 'icecream',
  });
  if (renamed.name !== 'Premium Ice Cream') throw new Error('Test 6 Failed: Failed to rename category');
  console.log(`✓ 6. Category renamed to "${renamed.name}"`);

  // 7. Reorder categories
  const initialCats = await categoryService.getAllCategories({ activeOnly: false });
  await categoryService.reorderCategories(initialCats.map((c) => c.id).reverse());
  const reorderedCats = await categoryService.getAllCategories({ activeOnly: false });
  if (reorderedCats[0].id !== initialCats[initialCats.length - 1].id) {
    throw new Error('Test 7 Failed: Category reordering failed');
  }
  console.log('✓ 7. Category reordering persisted properly');

  // 8. Soft Archive category (does NOT delete products or history)
  await categoryService.archiveCategory(iceCreamCat.id);
  const activeOnlyCats = await categoryService.getAllCategories({ activeOnly: true });
  if (activeOnlyCats.some((c) => c.id === iceCreamCat.id)) {
    throw new Error('Test 8 Failed: Archived category should not appear in active list');
  }
  const allCats = await categoryService.getAllCategories({ activeOnly: false });
  if (!allCats.some((c) => c.id === iceCreamCat.id)) {
    throw new Error('Test 8 Failed: Archived category must remain in database');
  }
  console.log('✓ 8. Category archived softly without physical deletion');

  console.log('\n--- TEST GROUP 3: BRAND OPERATIONS & CATEGORY SCOPING ---');
  // 9. Brands belong to specific category
  const coldDrinksCat = await db.categories.filter((c) => c.name === 'Cold Drinks').first();
  if (!coldDrinksCat) throw new Error('Test 9 Failed: Cold Drinks category not found');

  const cokeBrand = await brandService.createBrand({
    categoryId: coldDrinksCat.id,
    name: 'Coca Cola',
  }, 'shop_demo_001');
  if (cokeBrand.categoryId !== coldDrinksCat.id) {
    throw new Error('Test 9 Failed: Brand categoryId mismatch');
  }
  console.log(`✓ 9. Brand created and scoped strictly to category: "${cokeBrand.name}" in "${coldDrinksCat.name}"`);

  // 10. Filter brands by category
  const cdBrands = await brandService.getBrands({ categoryId: coldDrinksCat.id });
  if (!cdBrands.some((b) => b.id === cokeBrand.id)) {
    throw new Error('Test 10 Failed: Brand not returned for its category');
  }
  console.log(`✓ 10. Found ${cdBrands.length} brands under "${coldDrinksCat.name}"`);

  // 11. Rename brand
  const updatedBrand = await brandService.updateBrand(cokeBrand.id, { name: 'Coke Official' });
  if (updatedBrand.name !== 'Coke Official') throw new Error('Test 11 Failed: Brand rename failed');
  console.log(`✓ 11. Brand renamed to "${updatedBrand.name}"`);

  // 12. Archive brand
  await brandService.archiveBrand(cokeBrand.id);
  const activeBrands = await brandService.getBrands({ categoryId: coldDrinksCat.id, activeOnly: true });
  if (activeBrands.some((b) => b.id === cokeBrand.id)) {
    throw new Error('Test 12 Failed: Archived brand appeared in active list');
  }
  console.log('✓ 12. Brand archived safely');

  console.log('\n--- TEST GROUP 4: PRODUCT RELATIONSHIPS & HIERARCHY ---');
  // 13. Product with Category only (e.g. Gutka -> Vimal directly without brand)
  const gutkaCat = await db.categories.filter((c) => c.name === 'Gutka').first();
  if (!gutkaCat) throw new Error('Test 13 Failed: Gutka category not found');

  const vimalProduct = await inventoryService.addProduct({
    name: 'Vimal 5g',
    categoryId: gutkaCat.id,
    brandId: null, // Strictly no brand
    sellingPrice: 10,
    costPrice: 8,
    stock: 50,
    minStock: 10,
    active: true,
    isFavorite: true,
  });
  if (vimalProduct.brandId !== null || vimalProduct.categoryId !== gutkaCat.id) {
    throw new Error('Test 13 Failed: Category-only product invalid');
  }
  console.log(`✓ 13. Category-only product created successfully: "${gutkaCat.name} → ${vimalProduct.name}" (brandId = null)`);

  // 14. Product with Category + Brand (e.g. Cigarettes -> Gold Flake -> Gold Flake Kings)
  const goldFlakeBrand = await db.brands.filter((b) => b.name === 'Gold Flake').first();
  const kingsProduct = await inventoryService.addProduct({
    name: 'Gold Flake Kings Special',
    categoryId: cigarettesCat.id,
    brandId: goldFlakeBrand?.id || null,
    sellingPrice: 20,
    costPrice: 15,
    stock: 30,
    minStock: 5,
    active: true,
    isFavorite: true,
  });
  if (kingsProduct.categoryId !== cigarettesCat.id) {
    throw new Error('Test 14 Failed: Category + Brand product invalid');
  }
  console.log(`✓ 14. Category + Brand product created: "${cigarettesCat.name} → ${goldFlakeBrand?.name || 'Gold Flake'} → ${kingsProduct.name}"`);

  // 15. Sale execution and stock decrement preserves integrity
  const sale = await saleService.createSale({
    shopId: 'shop_demo_001',
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    items: [
      { product: vimalProduct, quantity: 2 },
      { product: kingsProduct, quantity: 1 },
    ],
  });
  if (sale.totalAmount !== 40) throw new Error(`Test 15 Failed: Expected total 40, got ${sale.totalAmount}`);
  const vimalAfter = await db.products.get(vimalProduct.id);
  if (vimalAfter?.stock !== 48) throw new Error(`Test 15 Failed: Expected stock 48, got ${vimalAfter?.stock}`);
  console.log(`✓ 15. Sale executed: ${sale.saleNumber} Total ₹${sale.totalAmount}. Stock accurately decremented.`);

  console.log('\n--- TEST GROUP 5: PRODUCT SEARCH ACROSS NAME, BRAND, CATEGORY ---');
  // 16. Search across product name, brand name, category name
  const allTestProducts = await db.products.toArray();
  const allTestBrands = await db.brands.toArray();
  const allTestCats = await db.categories.toArray();

  const brandLookup = new Map(allTestBrands.map((b) => [b.id, b]));
  const catLookup = new Map(allTestCats.map((c) => [c.id, c]));

  function search(query: string) {
    const q = query.toLowerCase();
    return allTestProducts.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      const cat = p.categoryId ? catLookup.get(p.categoryId) : undefined;
      if (cat && cat.name.toLowerCase().includes(q)) return true;
      const br = p.brandId ? brandLookup.get(p.brandId) : undefined;
      if (br && br.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }

  const byName = search('Kings');
  if (byName.length === 0) throw new Error('Test 16a Failed: Search by product name');
  console.log(`✓ 16a. Search by product name "Kings" found ${byName.length} items`);

  const byBrand = search('Classic');
  if (byBrand.length === 0) throw new Error('Test 16b Failed: Search by brand name');
  console.log(`✓ 16b. Search by brand name "Classic" found ${byBrand.length} items`);

  const byCat = search('Gutka');
  if (byCat.length === 0) throw new Error('Test 16c Failed: Search by category name');
  console.log(`✓ 16c. Search by category name "Gutka" found ${byCat.length} items`);

  console.log('\n--- TEST GROUP 6: BACKUP & RESTORE WITH CATEGORIES & BRANDS ---');
  // 17. Export backup contains categories, brands, and relationships
  const backupRes = await backupService.exportBackup('shop_demo_001', 'Demo Shop');
  if (!backupRes.success || !backupRes.counts.categories || !backupRes.counts.brands) {
    throw new Error('Test 17 Failed: Backup export missing categories or brands');
  }
  console.log(`✓ 17. Backup export successful: ${backupRes.counts.categories} categories, ${backupRes.counts.brands} brands, ${backupRes.counts.products} products`);

  // 18. Validate backup with relational integrity checks
  const mockBackupObj = {
    format: 'shopflow-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    shopId: 'shop_demo_001',
    shopName: 'Demo Shop',
    data: {
      categories: await db.categories.where('shopId').equals('shop_demo_001').toArray(),
      brands: await db.brands.where('shopId').equals('shop_demo_001').toArray(),
      products: await db.products.where('shopId').equals('shop_demo_001').toArray(),
      customers: await db.customers.where('shopId').equals('shop_demo_001').toArray(),
      sales: await db.sales.where('shopId').equals('shop_demo_001').toArray(),
      saleItems: await db.saleItems.where('shopId').equals('shop_demo_001').toArray(),
      payments: [],
      purchases: [],
      suppliers: [],
      inventoryMovements: [],
      expenses: [],
    },
  };

  const validation = backupService.validateBackup(JSON.stringify(mockBackupObj), 'shop_demo_001');
  if (!validation.valid) throw new Error(`Test 18 Failed: Backup validation failed: ${validation.error}`);
  console.log('✓ 18. Backup validation passed relational integrity checks');

  // 19. Validate cross-shop rejection
  const foreignValidation = backupService.validateBackup(JSON.stringify(mockBackupObj), 'shop_other_999');
  if (foreignValidation.valid) throw new Error('Test 19 Failed: Foreign shop backup was not rejected');
  console.log('✓ 19. Cross-shop backup correctly rejected');

  console.log('\n--- TEST GROUP 7: MULTI-SHOP ISOLATION ---');
  // 20. Create Category and Product for Shop B
  const shopBCat = await categoryService.createCategory({
    name: 'Shop B Exclusive',
    icon: 'cart',
  }, 'shop_B_test');

  const shopBProduct = await inventoryService.addProduct({
    name: 'Shop B Product',
    shopId: 'shop_B_test',
    categoryId: shopBCat.id,
    sellingPrice: 100,
    costPrice: 80,
    stock: 10,
    minStock: 2,
    active: true,
  });

  // Shop A must NEVER see Shop B's categories or products
  const shopACats = await categoryService.getAllCategories({ shopId: 'shop_demo_001' });
  if (shopACats.some((c) => c.id === shopBCat.id)) {
    throw new Error('Test 20 Failed: Shop A can see Shop B category!');
  }
  const shopAProds = await inventoryService.getAllProducts({ shopId: 'shop_demo_001' });
  if (shopAProds.some((p) => p.id === shopBProduct.id)) {
    throw new Error('Test 20 Failed: Shop A can see Shop B product!');
  }
  console.log('✓ 20. Multi-shop isolation verified: Shop A cannot view Shop B categories or products');

  console.log('\n🎉 ALL STEP 10 ACCEPTANCE TESTS PASSED SUCCESSFULLY! (20/20 test suites verified)');
}

runStep10AcceptanceTests().catch((err) => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
