import Dexie, { type Table } from 'dexie';
import type {
  Product,
  Category,
  Brand,
  Customer,
  Sale,
  SaleItem,
  Payment,
  Purchase,
  Supplier,
  InventoryMovement,
  Expense,
  SyncQueueItem,
} from '../types';

export class ShopFlowDatabase extends Dexie {
  categories!: Table<Category, string>;
  brands!: Table<Brand, string>;
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  sales!: Table<Sale, string>;
  saleItems!: Table<SaleItem, string>;
  payments!: Table<Payment, string>;
  purchases!: Table<Purchase, string>;
  suppliers!: Table<Supplier, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  expenses!: Table<Expense, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('ShopFlowDB');

    // Version 1 schema
    this.version(1).stores({
      products: 'id, shopId, name, stock, minStock, createdAt',
      customers: 'id, shopId, name, phone, pendingUdhaar, createdAt',
      sales: 'id, shopId, saleNumber, customerId, paymentStatus, createdAt',
      saleItems: 'id, shopId, saleId, productId, createdAt',
      inventoryMovements: 'id, shopId, productId, type, createdAt',
      syncQueue: 'id, shopId, entity, status, createdAt',
    });

    // Version 2 schema: adds payments table, updates customers to balance
    this.version(2)
      .stores({
        products: 'id, shopId, name, stock, minStock, createdAt',
        customers: 'id, shopId, name, phone, balance, createdAt',
        sales: 'id, shopId, saleNumber, customerId, paymentStatus, createdAt',
        saleItems: 'id, shopId, saleId, productId, createdAt',
        payments: 'id, shopId, customerId, createdAt',
        inventoryMovements: 'id, shopId, productId, type, createdAt',
        syncQueue: 'id, shopId, entity, status, createdAt',
      })
      .upgrade((tx) => {
        return tx
          .table('customers')
          .toCollection()
          .modify((cust: Record<string, unknown>) => {
            if (cust.balance === undefined) {
              cust.balance = cust.pendingUdhaar ?? 0;
              delete cust.pendingUdhaar;
            }
          });
      });

    // Version 3 schema: adds purchases, suppliers, active flag and search indices
    this.version(3)
      .stores({
        products: 'id, shopId, name, category, sku, barcode, stock, minStock, active, createdAt',
        customers: 'id, shopId, name, phone, balance, createdAt',
        sales: 'id, shopId, saleNumber, customerId, paymentStatus, createdAt',
        saleItems: 'id, shopId, saleId, productId, createdAt',
        payments: 'id, shopId, customerId, createdAt',
        purchases: 'id, shopId, productId, supplierId, createdAt',
        suppliers: 'id, shopId, name, createdAt',
        inventoryMovements: 'id, shopId, productId, type, referenceId, createdAt',
        syncQueue: 'id, shopId, entity, status, createdAt',
      })
      .upgrade((tx) => {
        return tx
          .table('products')
          .toCollection()
          .modify((prod: Record<string, unknown>) => {
            if (prod.active === undefined) {
              prod.active = true;
            }
            if (prod.openingStock === undefined) {
              prod.openingStock = prod.stock ?? 0;
            }
          });
      });

    // Version 4 schema: adds expenses table and indexes paymentMethod on sales
    this.version(4).stores({
      products: 'id, shopId, name, category, sku, barcode, stock, minStock, active, createdAt',
      customers: 'id, shopId, name, phone, balance, createdAt',
      sales: 'id, shopId, saleNumber, customerId, paymentStatus, paymentMethod, createdAt',
      saleItems: 'id, shopId, saleId, productId, createdAt',
      payments: 'id, shopId, customerId, createdAt',
      purchases: 'id, shopId, productId, supplierId, createdAt',
      suppliers: 'id, shopId, name, createdAt',
      inventoryMovements: 'id, shopId, productId, type, referenceId, createdAt',
      expenses: 'id, shopId, category, createdAt',
      syncQueue: 'id, shopId, entity, status, createdAt',
    });

    // Version 5 schema: adds isFavorite index on products for Quick Sale & Favorites
    this.version(5)
      .stores({
        products: 'id, shopId, name, category, sku, barcode, stock, minStock, active, isFavorite, createdAt',
        customers: 'id, shopId, name, phone, balance, createdAt',
        sales: 'id, shopId, saleNumber, customerId, paymentStatus, paymentMethod, createdAt',
        saleItems: 'id, shopId, saleId, productId, createdAt',
        payments: 'id, shopId, customerId, createdAt',
        purchases: 'id, shopId, productId, supplierId, createdAt',
        suppliers: 'id, shopId, name, createdAt',
        inventoryMovements: 'id, shopId, productId, type, referenceId, createdAt',
        expenses: 'id, shopId, category, createdAt',
        syncQueue: 'id, shopId, entity, status, createdAt',
      })
      .upgrade((tx) => {
        return tx
          .table('products')
          .toCollection()
          .modify((prod: Record<string, unknown>) => {
            if (prod.isFavorite === undefined) {
              prod.isFavorite = false;
            }
          });
      });

    // Version 6 schema: adds categories & brands tables, categoryId and brandId on products (Section 10)
    this.version(6)
      .stores({
        categories: 'id, shopId, name, sortOrder, isActive, createdAt',
        brands: 'id, shopId, categoryId, name, sortOrder, isActive, createdAt',
        products: 'id, shopId, name, category, categoryId, brandId, sku, barcode, stock, minStock, active, isFavorite, createdAt',
        customers: 'id, shopId, name, phone, balance, createdAt',
        sales: 'id, shopId, saleNumber, customerId, paymentStatus, paymentMethod, createdAt',
        saleItems: 'id, shopId, saleId, productId, createdAt',
        payments: 'id, shopId, customerId, createdAt',
        purchases: 'id, shopId, productId, supplierId, createdAt',
        suppliers: 'id, shopId, name, createdAt',
        inventoryMovements: 'id, shopId, productId, type, referenceId, createdAt',
        expenses: 'id, shopId, category, createdAt',
        syncQueue: 'id, shopId, entity, status, createdAt',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();

        // 1. Seed default categories if none exist
        const catTable = tx.table('categories');
        const defaultCats = [
          { id: 'cat_seed_cigarettes', name: 'Cigarettes', icon: 'cigarette', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
          { id: 'cat_seed_cold_drinks', name: 'Cold Drinks', icon: 'drink', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
          { id: 'cat_seed_gutka', name: 'Gutka', icon: 'gutka', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
          { id: 'cat_seed_chocolate', name: 'Chocolate', icon: 'chocolate', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
          { id: 'cat_seed_snacks', name: 'Snacks', icon: 'snacks', sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
          { id: 'cat_seed_others', name: 'Others', icon: 'package', sortOrder: 6, isActive: true, createdAt: now, updatedAt: now },
        ];

        for (const cat of defaultCats) {
          const existing = await catTable.get(cat.id);
          if (!existing) {
            await catTable.add(cat);
          }
        }

        // 2. Seed initial brands for Cold Drinks & Cigarettes
        const brandTable = tx.table('brands');
        const defaultBrands = [
          { id: 'br_seed_coke', categoryId: 'cat_seed_cold_drinks', name: 'Coke', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
          { id: 'br_seed_pepsi', categoryId: 'cat_seed_cold_drinks', name: 'Pepsi', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
          { id: 'br_seed_gold_flake', categoryId: 'cat_seed_cigarettes', name: 'Gold Flake', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
          { id: 'br_seed_classic', categoryId: 'cat_seed_cigarettes', name: 'Classic', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
          { id: 'br_seed_marlboro', categoryId: 'cat_seed_cigarettes', name: 'Marlboro', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
        ];

        for (const br of defaultBrands) {
          const existing = await brandTable.get(br.id);
          if (!existing) {
            await brandTable.add(br);
          }
        }

        // 3. Migrate existing products to have proper categoryId and optional brandId safely
        await tx.table('products').toCollection().modify((prod: Record<string, any>) => {
          if (!prod.categoryId) {
            const nameLower = (prod.name || '').toLowerCase();
            const catLower = (prod.category || '').toLowerCase();

            if (catLower.includes('cold') || nameLower.includes('coke') || nameLower.includes('pepsi') || nameLower.includes('drink')) {
              prod.categoryId = 'cat_seed_cold_drinks';
              if (nameLower.includes('coke')) prod.brandId = 'br_seed_coke';
              else if (nameLower.includes('pepsi')) prod.brandId = 'br_seed_pepsi';
              else prod.brandId = null;
            } else if (catLower.includes('cig') || nameLower.includes('cig') || nameLower.includes('flake') || nameLower.includes('classic') || nameLower.includes('marlboro')) {
              prod.categoryId = 'cat_seed_cigarettes';
              if (nameLower.includes('flake') || nameLower.includes('gold')) prod.brandId = 'br_seed_gold_flake';
              else if (nameLower.includes('classic')) prod.brandId = 'br_seed_classic';
              else if (nameLower.includes('marlboro')) prod.brandId = 'br_seed_marlboro';
              else prod.brandId = null;
            } else if (catLower.includes('gutka') || nameLower.includes('vimal') || nameLower.includes('rajshree') || nameLower.includes('shikhar') || nameLower.includes('kamala')) {
              prod.categoryId = 'cat_seed_gutka';
              prod.brandId = null;
            } else if (catLower.includes('choc') || nameLower.includes('choc')) {
              prod.categoryId = 'cat_seed_chocolate';
              prod.brandId = null;
            } else if (catLower.includes('snack') || nameLower.includes('lays') || nameLower.includes('chips') || nameLower.includes('kurkure')) {
              prod.categoryId = 'cat_seed_snacks';
              prod.brandId = null;
            } else {
              prod.categoryId = 'cat_seed_others';
              prod.brandId = null;
            }
          }
          if (prod.brandId === undefined) {
            prod.brandId = null;
          }
        });
      });

    // Version 7: Wipe test products, test stocks, and test records to start fresh
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        // Clear all test products, inventory movements, sales, customers, suppliers, payments, purchases, expenses
        await tx.table('products').clear();
        await tx.table('inventoryMovements').clear();
        await tx.table('sales').clear();
        await tx.table('saleItems').clear();
        await tx.table('customers').clear();
        await tx.table('suppliers').clear();
        await tx.table('payments').clear();
        await tx.table('purchases').clear();
        await tx.table('expenses').clear();
        await tx.table('syncQueue').clear();
      });
  }
}

export const db = new ShopFlowDatabase();
