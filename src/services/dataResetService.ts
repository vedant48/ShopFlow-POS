import { db } from '../db';
import { seedCategoriesAndBrands } from '../db/seed';
import { authService } from '../auth/authService';

/**
 * Service to wipe test products, stocks, sales, customers and start 100% fresh
 */
export async function clearAllLocalTestData(shopId?: string): Promise<{
  success: boolean;
  message: string;
}> {
  const currentShopId = shopId || authService.getCurrentShopId();

  // 1. Clear all local transaction & inventory records
  await Promise.all([
    db.products.clear(),
    db.inventoryMovements.clear(),
    db.sales.clear(),
    db.saleItems.clear(),
    db.customers.clear(),
    db.suppliers.clear(),
    db.payments.clear(),
    db.purchases.clear(),
    db.expenses.clear(),
    db.syncQueue.clear(),
  ]);

  // 2. Ensure default categories & brands exist so shopkeeper can immediately start adding real items
  if (currentShopId) {
    await seedCategoriesAndBrands(currentShopId);
  }

  return {
    success: true,
    message: 'All test products, stocks, sales, and customers have been cleared. Shop is completely clean and fresh!',
  };
}

/**
 * Resets the device session and wipes local test records so the user can register or log in cleanly
 */
export async function resetDeviceAndStartFresh(): Promise<void> {
  await clearAllLocalTestData();
  authService.clearSession();
  authService.clearTrustedShop();
}
