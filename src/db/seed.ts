import { db } from './index';
import type { Product, Category, Brand, Customer, Supplier } from '../types';

export const INITIAL_PRODUCTS: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [];

export const INITIAL_CUSTOMERS: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>[] = [];

export const INITIAL_SUPPLIERS: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>[] = [];

export async function seedCategoriesAndBrands(shopId: string): Promise<{
  categories: Category[];
  brands: Brand[];
}> {
  const now = new Date().toISOString();

  const defaultCategories: Category[] = [
    { id: `cat_${shopId}_cigarettes`, shopId, name: 'Cigarettes', icon: 'cigarette', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: `cat_${shopId}_cold_drinks`, shopId, name: 'Cold Drinks', icon: 'drink', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
    { id: `cat_${shopId}_gutka`, shopId, name: 'Gutka', icon: 'gutka', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
    { id: `cat_${shopId}_chocolate`, shopId, name: 'Chocolate', icon: 'chocolate', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
    { id: `cat_${shopId}_snacks`, shopId, name: 'Snacks', icon: 'snacks', sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
    { id: `cat_${shopId}_others`, shopId, name: 'Others', icon: 'package', sortOrder: 6, isActive: true, createdAt: now, updatedAt: now },
  ];

  const defaultBrands: Brand[] = [
    { id: `br_${shopId}_coke`, shopId, categoryId: `cat_${shopId}_cold_drinks`, name: 'Coke', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: `br_${shopId}_pepsi`, shopId, categoryId: `cat_${shopId}_cold_drinks`, name: 'Pepsi', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
    { id: `br_${shopId}_gold_flake`, shopId, categoryId: `cat_${shopId}_cigarettes`, name: 'Gold Flake', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
    { id: `br_${shopId}_classic`, shopId, categoryId: `cat_${shopId}_cigarettes`, name: 'Classic', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
  ];

  const existingCats = await db.categories.where('shopId').equals(shopId).count();
  if (existingCats === 0) {
    await db.categories.bulkAdd(defaultCategories);
    await db.brands.bulkAdd(defaultBrands);

    // Queue for sync respecting dependency order: Categories first, then Brands (Section 15)
    try {
      const { syncService } = await import('../services/syncService');
      for (const cat of defaultCategories) {
        await syncService.enqueue('categories', cat.id, 'CREATE', cat as unknown as Record<string, unknown>, shopId);
      }
      for (const br of defaultBrands) {
        await syncService.enqueue('brands', br.id, 'CREATE', br as unknown as Record<string, unknown>, shopId);
      }
    } catch {
      // ignore
    }
  }

  return { categories: defaultCategories, brands: defaultBrands };
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  // Seed categories and brands for demo shop if none exist, but no sample products or stocks
  await seedCategoriesAndBrands('shop_demo_001');
}

// Seed initial categories and brands for newly registered real shop account (NO sample products)
export async function seedShopProducts(shopId: string): Promise<void> {
  // Seed categories and brands only! No sample products or sample stocks!
  await seedCategoriesAndBrands(shopId);
}
