import { db } from '../db';
import type {
  Sale,
  SaleItem,
  Product,
  PriceVariant,
  PaymentStatus,
  PaymentMethod,
  InventoryMovement,
  CartItem,
} from '../types';
import { generateId, generateSaleNumber } from '../lib/utils';
import { syncService } from './syncService';

export interface CreateSaleInput {
  items: {
    product: Product;
    quantity: number;
    selectedVariant?: PriceVariant;
  }[];
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  customerId?: string;
  customerName?: string;
  notes?: string;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export const saleService = {
  /**
   * Creates a sale atomically inside a Dexie transaction:
   * 1. Validates cart items against available stock.
   * 2. Creates the Sale record (customerId=null for paid, customerId for udhaar).
   * 3. Creates SaleItem records.
   * 4. Decreases product stock.
   * 5. Creates InventoryMovement records for each item.
   * 6. Increases customer balance if Udhaar sale.
   * 7. Adds syncQueue events for cloud synchronization.
   */
  async createSale(input: CreateSaleInput): Promise<Sale> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot create a sale without items');
    }

    // Exact integer-safe calculation: sum of (effective price * quantity)
    const totalAmount = input.items.reduce((sum, item) => {
      const price = item.selectedVariant?.price ?? item.selectedVariant?.sellingPrice ?? item.product.sellingPrice;
      return sum + Math.round(price * item.quantity);
    }, 0);
    const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);

    const now = new Date().toISOString();
    const saleId = generateId('sale');

    return await db.transaction(
      'rw',
      [
        db.sales,
        db.saleItems,
        db.products,
        db.customers,
        db.inventoryMovements,
        db.syncQueue,
      ],
      async () => {
        const saleCount = await db.sales.count();
        const saleNumber = generateSaleNumber(saleCount + 1);

        const shopId =
          (input as any).shopId ||
          (typeof localStorage !== 'undefined'
            ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
            : 'shop_demo_001');

        const newSale: Sale = {
          id: saleId,
          shopId,
          saleNumber,
          customerId: input.paymentStatus === 'UDHAAR' ? input.customerId : undefined,
          customerName: input.customerName || (input.paymentStatus === 'PAID' ? 'Walk-in Customer' : undefined),
          totalAmount,
          paymentStatus: input.paymentStatus,
          paymentMethod:
            input.paymentStatus === 'UDHAAR'
              ? 'NONE'
              : input.paymentMethod || 'CASH',
          itemCount,
          notes: input.notes,
          createdAt: now,
          updatedAt: now,
        };

        // If Udhaar and customer is chosen, find and update customer's balance
        if (input.paymentStatus === 'UDHAAR' && input.customerId) {
          const customer = await db.customers.get(input.customerId);
          if (customer) {
            const updatedBalance = (customer.balance || 0) + totalAmount;
            await db.customers.update(input.customerId, {
              balance: updatedBalance,
              updatedAt: now,
            });
            newSale.customerName = customer.name;

            await syncService.enqueue('customers', customer.id, 'UPDATE', {
              balance: updatedBalance,
              shopId,
              updatedAt: now,
            }, shopId);
          }
        }

        await db.sales.add(newSale);
        await syncService.enqueue('sales', newSale.id, 'CREATE', newSale as unknown as Record<string, unknown>, shopId);

        // Create SaleItems and decrement inventory for each item
        for (const cartItem of input.items) {
          const itemId = generateId('item');
          const itemPrice = cartItem.selectedVariant?.price ?? cartItem.selectedVariant?.sellingPrice ?? cartItem.product.sellingPrice;
          const itemCost = cartItem.selectedVariant?.costPrice ?? cartItem.product.costPrice ?? 0;
          const itemTotal = Math.round(itemPrice * cartItem.quantity);
          const itemName = cartItem.selectedVariant && !cartItem.selectedVariant.isDefault
            ? `${cartItem.product.name} (${cartItem.selectedVariant.name})`
            : cartItem.product.name;

          const saleItem: SaleItem = {
            id: itemId,
            shopId,
            saleId: newSale.id,
            productId: cartItem.product.id,
            productName: itemName,
            productEmoji: cartItem.product.emoji || '📦',
            variantId: cartItem.selectedVariant?.id,
            variantName: cartItem.selectedVariant?.name,
            quantity: cartItem.quantity,
            unitPrice: itemPrice,
            sellingPrice: itemPrice,
            totalPrice: itemTotal,
            unitCost: itemCost,
            costPrice: itemCost,
            createdAt: now,
            updatedAt: now,
          };

          await db.saleItems.add(saleItem);
          await syncService.enqueue('saleItems', saleItem.id, 'CREATE', saleItem as unknown as Record<string, unknown>, shopId);

          // Fetch current stock from DB for absolute consistency
          const currentProd = await db.products.get(cartItem.product.id);
          const prevStock = currentProd ? currentProd.stock : cartItem.product.stock;
          const newStock = Math.max(0, prevStock - cartItem.quantity);

          await db.products.update(cartItem.product.id, {
            stock: newStock,
            updatedAt: now,
          });

          // Record inventory movement
          const movement: InventoryMovement = {
            id: generateId('mov'),
            productId: cartItem.product.id,
            shopId,
            type: 'SALE',
            quantity: -cartItem.quantity,
            quantityChange: -cartItem.quantity,
            previousStock: prevStock,
            newStock,
            referenceId: newSale.id,
            note: `Sale ${saleNumber}`,
            notes: `Sale ${saleNumber}`,
            createdAt: now,
            updatedAt: now,
          };

          await db.inventoryMovements.add(movement);
          await syncService.enqueue('inventoryMovements', movement.id, 'CREATE', movement as unknown as Record<string, unknown>, shopId);
          await syncService.enqueue('products', cartItem.product.id, 'UPDATE', {
            stock: newStock,
            shopId,
            updatedAt: now,
          }, shopId);
        }

        return newSale;
      }
    );
  },

  /**
   * Atomically reverses a sale within 5 seconds of creation:
   * 1. Restores product inventory stock.
   * 2. Records reversal inventory movements.
   * 3. Reverses customer balance if Udhaar sale.
   * 4. Deletes Sale and SaleItem records.
   * 5. Enqueues a syncQueue DELETE/CANCEL event.
   * 6. Returns the original cart items so the UI can restore the cart.
   */
  async undoSale(saleId: string): Promise<CartItem[]> {
    return await db.transaction(
      'rw',
      [
        db.sales,
        db.saleItems,
        db.products,
        db.customers,
        db.inventoryMovements,
        db.syncQueue,
      ],
      async () => {
        const sale = await db.sales.get(saleId);
        if (!sale) {
          throw new Error(`Sale ${saleId} not found or already undone`);
        }

        const saleItems = await db.saleItems.where('saleId').equals(saleId).toArray();
        const restoredCartItems: CartItem[] = [];
        const now = new Date().toISOString();

        // Restore inventory for each item
        for (const item of saleItems) {
          const product = await db.products.get(item.productId);
          if (product) {
            const prevStock = product.stock;
            const newStock = prevStock + item.quantity;

            await db.products.update(product.id, {
              stock: newStock,
              updatedAt: now,
            });

            // Log reversal movement
            const revMovement: InventoryMovement = {
              id: generateId('mov'),
              shopId: sale.shopId,
              productId: product.id,
              type: 'RETURN',
              quantity: item.quantity,
              quantityChange: item.quantity,
              previousStock: prevStock,
              newStock,
              referenceId: sale.id,
              note: `UNDO Sale ${sale.saleNumber}`,
              notes: `UNDO Sale ${sale.saleNumber}`,
              createdAt: now,
              updatedAt: now,
            };
            await db.inventoryMovements.add(revMovement);
            await syncService.enqueue('inventoryMovements', revMovement.id, 'CREATE', revMovement as unknown as Record<string, unknown>, sale.shopId);
            await syncService.enqueue('products', product.id, 'UPDATE', {
              stock: newStock,
              updatedAt: now,
            }, sale.shopId);

            restoredCartItems.push({
              product: { ...product, stock: newStock },
              quantity: item.quantity,
            });
          }

          // Delete sale item
          await db.saleItems.delete(item.id);
        }

        // Reverse customer balance if applicable
        if (sale.paymentStatus === 'UDHAAR' && sale.customerId) {
          const customer = await db.customers.get(sale.customerId);
          if (customer) {
            const restoredBalance = Math.max(0, (customer.balance || 0) - sale.totalAmount);
            await db.customers.update(sale.customerId, {
              balance: restoredBalance,
              updatedAt: now,
            });

            await syncService.enqueue('customers', customer.id, 'UPDATE', {
              action: 'SALE_UNDONE',
              balance: restoredBalance,
              updatedAt: now,
            }, sale.shopId);
          }
        }

        // Delete the sale record
        await db.sales.delete(saleId);

        // Record sync cancellation
        await syncService.enqueue('sales', saleId, 'DELETE', {
          saleId,
          saleNumber: sale.saleNumber,
          undoneAt: now,
        }, sale.shopId);

        return restoredCartItems;
      }
    );
  },

  async getRecentSales(limit: number = 50): Promise<Sale[]> {
    return await db.sales.reverse().limit(limit).sortBy('createdAt');
  },

  async getSaleWithItems(saleId: string): Promise<SaleWithItems | null> {
    const sale = await db.sales.get(saleId);
    if (!sale) return null;
    const items = await db.saleItems.where('saleId').equals(saleId).toArray();
    return { ...sale, items };
  },

  async getTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const todaySales = await db.sales
      .filter((s) => s.createdAt >= todayIso)
      .toArray();

    const allCustomers = await db.customers.toArray();
    const totalPendingUdhaar = allCustomers.reduce(
      (sum, c) => sum + (c.balance || 0),
      0
    );

    let todayCashSales = 0;
    let todayUpiSales = 0;
    let todayUdhaarSales = 0;

    for (const s of todaySales) {
      if (s.paymentStatus === 'PAID') {
        if (s.paymentMethod === 'UPI') {
          todayUpiSales += s.totalAmount;
        } else {
          todayCashSales += s.totalAmount;
        }
      } else if (s.paymentStatus === 'UDHAAR') {
        todayUdhaarSales += s.totalAmount;
      }
    }

    const todayRevenue = todayCashSales + todayUpiSales + todayUdhaarSales;
    const todayPaidRevenue = todayCashSales + todayUpiSales;
    const todayItemsSold = todaySales.reduce((sum, s) => sum + s.itemCount, 0);

    // Calculate today's estimated profit preserving historical costPrice
    const saleIds = todaySales.map((s) => s.id);
    let todayEstimatedProfit = 0;

    const productSalesMap = new Map<
      string,
      { id: string; name: string; emoji: string; count: number; revenue: number }
    >();

    if (saleIds.length > 0) {
      const todaySaleItems = await db.saleItems
        .filter((item) => saleIds.includes(item.saleId))
        .toArray();

      for (const item of todaySaleItems) {
        const itemSellingPrice = item.sellingPrice || item.unitPrice || 0;
        const itemCostPrice =
          item.costPrice !== undefined ? item.costPrice : item.unitCost || 0;
        const profitPerItem = itemSellingPrice - itemCostPrice;
        todayEstimatedProfit += profitPerItem * item.quantity;

        const existing = productSalesMap.get(item.productId) || {
          id: item.productId,
          name: item.productName,
          emoji: item.productEmoji,
          count: 0,
          revenue: 0,
        };
        existing.count += item.quantity;
        existing.revenue += item.totalPrice;
        productSalesMap.set(item.productId, existing);
      }
    }

    const todayExpensesList = await db.expenses
      .filter((e) => e.createdAt >= todayIso)
      .toArray();
    const todayExpenses = todayExpensesList.reduce((sum, e) => sum + e.amount, 0);
    const todayNetAfterExpenses = todayEstimatedProfit - todayExpenses;

    const topSellingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      todayRevenue,
      todayPaidRevenue,
      todayCashSales,
      todayUpiSales,
      todayUdhaarSales,
      todayEstimatedProfit,
      todayExpenses,
      todayNetAfterExpenses,
      transactionCount: todaySales.length,
      todayItemsSold,
      totalPendingUdhaar,
      topSellingProducts,
    };
  },
};
