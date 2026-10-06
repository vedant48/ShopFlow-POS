import { db } from '../db';
import type {
  Product,
  InventoryMovement,
  Purchase,
  Supplier,
} from '../types';
import { generateId } from '../lib/utils';
import { syncService } from './syncService';

export interface RecordPurchaseInput {
  productId: string;
  quantity: number;
  unitCost: number;
  supplierId?: string;
  supplierName?: string;
  note?: string;
}

export interface RecordAdjustmentInput {
  productId: string;
  actualPhysicalStock: number;
  reason: string;
}

export const inventoryService = {
  async getAllProducts(options?: { activeOnly?: boolean; shopId?: string }): Promise<Product[]> {
    const targetShopId =
      options?.shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');

    return await db.products
      .filter((p) => {
        const matchesShop = (p.shopId || 'shop_demo_001') === targetShopId;
        if (!matchesShop) return false;
        if (options?.activeOnly) return p.active !== false;
        return true;
      })
      .toArray();
  },

  async getProductById(id: string): Promise<Product | undefined> {
    return await db.products.get(id);
  },

  async addProduct(
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'active'> & {
      active?: boolean;
    }
  ): Promise<Product> {
    const now = new Date().toISOString();
    const id = generateId('prod');
    const initialStock = productData.stock || 0;
    const shopId =
      productData.shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');

    const newProduct: Product = {
      ...productData,
      id,
      shopId,
      stock: initialStock,
      openingStock: initialStock,
      active: productData.active !== undefined ? productData.active : true,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction(
      'rw',
      [db.products, db.inventoryMovements, db.syncQueue],
      async () => {
        await db.products.add(newProduct);

        // Record initial stock movement as PURCHASE / opening stock if > 0
        if (initialStock > 0) {
          const movement: InventoryMovement = {
            id: generateId('mov'),
            productId: newProduct.id,
            shopId,
            type: 'PURCHASE',
            quantity: initialStock,
            quantityChange: initialStock,
            previousStock: 0,
            newStock: initialStock,
            referenceId: 'opening_stock',
            note: 'Opening stock',
            notes: 'Opening stock',
            createdAt: now,
            updatedAt: now,
          };
          await db.inventoryMovements.add(movement);
          await syncService.enqueue(
            'inventoryMovements',
            movement.id,
            'CREATE',
            movement as unknown as Record<string, unknown>,
            shopId
          );
        }

        await syncService.enqueue(
          'products',
          newProduct.id,
          'CREATE',
          newProduct as unknown as Record<string, unknown>,
          shopId
        );
      }
    );

    return newProduct;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    const existing = await db.products.get(id);
    if (!existing) throw new Error(`Product ${id} not found`);

    const now = new Date().toISOString();
    const updatedData = { ...updates, updatedAt: now };

    await db.products.update(id, updatedData);
    await syncService.enqueue(
      'products',
      id,
      'UPDATE',
      updatedData as Record<string, unknown>
    );
  },

  async toggleFavorite(id: string): Promise<boolean> {
    const existing = await db.products.get(id);
    if (!existing) throw new Error(`Product ${id} not found`);

    const newFav = !existing.isFavorite;
    await this.updateProduct(id, { isFavorite: newFav });
    return newFav;
  },

  /**
   * Requirement 21: Product deletion
   * Do NOT permanently delete products with sales history. Archive them instead.
   */
  async archiveProduct(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.products.update(id, { active: false, updatedAt: now });
    await syncService.enqueue('products', id, 'UPDATE', {
      active: false,
      updatedAt: now,
    });
  },

  async unarchiveProduct(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.products.update(id, { active: true, updatedAt: now });
    await syncService.enqueue('products', id, 'UPDATE', {
      active: true,
      updatedAt: now,
    });
  },

  /**
   * Delete product aliases to archive to preserve sales history (Requirement 21)
   */
  async deleteProduct(id: string): Promise<void> {
    return this.archiveProduct(id);
  },

  /**
   * Quick add stock convenience method delegating to recordPurchase
   */
  async addStock(
    productId: string,
    quantity: number,
    note?: string
  ): Promise<{ product: Product; purchase: Purchase; movement: InventoryMovement }> {
    const product = await db.products.get(productId);
    const unitCost = product?.costPrice || 0;
    return this.recordPurchase({
      productId,
      quantity,
      unitCost,
      note: note || 'Counter restock',
    });
  },

  /**
   * Requirement 9: Purchase / Restock workflow
   * Atomically records Purchase, creates PURCHASE movement, updates stock and syncQueue.
   */
  async recordPurchase(input: RecordPurchaseInput): Promise<{
    product: Product;
    purchase: Purchase;
    movement: InventoryMovement;
  }> {
    if (input.quantity <= 0) {
      throw new Error('Purchase quantity must be positive');
    }

    return await db.transaction(
      'rw',
      [
        db.products,
        db.purchases,
        db.inventoryMovements,
        db.suppliers,
        db.syncQueue,
      ],
      async () => {
        const product = await db.products.get(input.productId);
        if (!product) throw new Error(`Product ${input.productId} not found`);

        const prevStock = product.stock;
        const newStock = prevStock + input.quantity;
        const now = new Date().toISOString();
        const purchaseId = generateId('purch');

        // 1. Create Purchase record
        const purchase: Purchase = {
          id: purchaseId,
          productId: product.id,
          productName: product.name,
          quantity: input.quantity,
          unitCost: input.unitCost,
          totalCost: Math.round(input.quantity * input.unitCost),
          supplierId: input.supplierId,
          supplierName: input.supplierName,
          note: input.note,
          createdAt: now,
          updatedAt: now,
        };
        await db.purchases.add(purchase);
        await syncService.enqueue(
          'purchases',
          purchase.id,
          'CREATE',
          purchase as unknown as Record<string, unknown>
        );

        // 2. Create PURCHASE inventory movement (+quantity)
        const movement: InventoryMovement = {
          id: generateId('mov'),
          productId: product.id,
          type: 'PURCHASE',
          quantity: input.quantity,
          quantityChange: input.quantity,
          previousStock: prevStock,
          newStock,
          referenceId: purchase.id,
          note: input.supplierName
            ? `Purchase from ${input.supplierName}`
            : input.note || `Purchased +${input.quantity}`,
          notes: input.supplierName
            ? `Purchase from ${input.supplierName}`
            : input.note || `Purchased +${input.quantity}`,
          createdAt: now,
          updatedAt: now,
        };
        await db.inventoryMovements.add(movement);
        await syncService.enqueue(
          'inventoryMovements',
          movement.id,
          'CREATE',
          movement as unknown as Record<string, unknown>
        );

        // 3. Update Product stock and latest cost price
        await db.products.update(product.id, {
          stock: newStock,
          costPrice: input.unitCost > 0 ? input.unitCost : product.costPrice,
          updatedAt: now,
        });
        await syncService.enqueue('products', product.id, 'UPDATE', {
          stock: newStock,
          costPrice: input.unitCost > 0 ? input.unitCost : product.costPrice,
          updatedAt: now,
        });

        const updatedProduct: Product = {
          ...product,
          stock: newStock,
          costPrice: input.unitCost > 0 ? input.unitCost : product.costPrice,
          updatedAt: now,
        };

        return { product: updatedProduct, purchase, movement };
      }
    );
  },

  /**
   * Requirement 12: Stock adjustment
   * Physical count differs from app. Records ADJUSTMENT movement (+/- difference).
   */
  async recordAdjustment(input: RecordAdjustmentInput): Promise<{
    product: Product;
    movement: InventoryMovement;
  }> {
    return await db.transaction(
      'rw',
      [db.products, db.inventoryMovements, db.syncQueue],
      async () => {
        const product = await db.products.get(input.productId);
        if (!product) throw new Error(`Product ${input.productId} not found`);

        const prevStock = product.stock;
        const newStock = Math.max(0, input.actualPhysicalStock);
        const difference = newStock - prevStock;
        const now = new Date().toISOString();

        const movement: InventoryMovement = {
          id: generateId('mov'),
          productId: product.id,
          type: 'ADJUSTMENT',
          quantity: difference,
          quantityChange: difference,
          previousStock: prevStock,
          newStock,
          referenceId: 'manual_adjustment',
          note: input.reason || 'Physical count adjustment',
          notes: input.reason || 'Physical count adjustment',
          createdAt: now,
          updatedAt: now,
        };

        await db.inventoryMovements.add(movement);
        await syncService.enqueue(
          'inventoryMovements',
          movement.id,
          'CREATE',
          movement as unknown as Record<string, unknown>
        );

        await db.products.update(product.id, {
          stock: newStock,
          updatedAt: now,
        });
        await syncService.enqueue('products', product.id, 'UPDATE', {
          stock: newStock,
          updatedAt: now,
        });

        const updatedProduct: Product = {
          ...product,
          stock: newStock,
          updatedAt: now,
        };

        return { product: updatedProduct, movement };
      }
    );
  },

  /**
   * Requirement 19: Return capability
   * Customer returns product from a sale. Creates RETURN movement (+qty) and updates stock.
   */
  async recordReturn(input: {
    productId: string;
    quantity: number;
    saleId?: string;
    note?: string;
  }): Promise<{ product: Product; movement: InventoryMovement }> {
    if (input.quantity <= 0) {
      throw new Error('Return quantity must be positive');
    }

    return await db.transaction(
      'rw',
      [db.products, db.inventoryMovements, db.syncQueue],
      async () => {
        const product = await db.products.get(input.productId);
        if (!product) throw new Error(`Product ${input.productId} not found`);

        const prevStock = product.stock;
        const newStock = prevStock + input.quantity;
        const now = new Date().toISOString();

        const movement: InventoryMovement = {
          id: generateId('mov'),
          productId: product.id,
          type: 'RETURN',
          quantity: input.quantity,
          quantityChange: input.quantity,
          previousStock: prevStock,
          newStock,
          referenceId: input.saleId,
          note: input.note || 'Customer sale return',
          notes: input.note || 'Customer sale return',
          createdAt: now,
          updatedAt: now,
        };

        await db.inventoryMovements.add(movement);
        await syncService.enqueue(
          'inventoryMovements',
          movement.id,
          'CREATE',
          movement as unknown as Record<string, unknown>
        );

        await db.products.update(product.id, {
          stock: newStock,
          updatedAt: now,
        });
        await syncService.enqueue('products', product.id, 'UPDATE', {
          stock: newStock,
          updatedAt: now,
        });

        return {
          product: { ...product, stock: newStock, updatedAt: now },
          movement,
        };
      }
    );
  },

  /**
   * Requirement 16: Stock audit batch workflow
   * Checks multiple products and saves adjustments for differences.
   */
  async auditProducts(
    audits: { productId: string; physicalStock: number; reason?: string }[]
  ): Promise<{ checkedCount: number; discrepancyCount: number }> {
    let discrepancyCount = 0;

    for (const audit of audits) {
      const product = await db.products.get(audit.productId);
      if (product && product.stock !== audit.physicalStock) {
        discrepancyCount++;
        await this.recordAdjustment({
          productId: audit.productId,
          actualPhysicalStock: audit.physicalStock,
          reason: audit.reason || 'Stock Audit Adjustment',
        });
      }
    }

    return {
      checkedCount: audits.length,
      discrepancyCount,
    };
  },

  /**
   * Requirement 15: Expected stock calculation
   * Formula: Opening stock + all positive movements - all negative movements = current stock
   */
  async getExpectedStock(productId: string): Promise<{
    openingStock: number;
    purchases: number;
    returns: number;
    positiveAdjustments: number;
    sales: number;
    negativeAdjustments: number;
    calculatedStock: number;
    storedStock: number;
  }> {
    const product = await db.products.get(productId);
    if (!product) throw new Error(`Product ${productId} not found`);

    const movements = await db.inventoryMovements
      .where('productId')
      .equals(productId)
      .toArray();

    const openingStock = product.openingStock ?? 0;
    let purchases = 0;
    let returns = 0;
    let positiveAdjustments = 0;
    let sales = 0;
    let negativeAdjustments = 0;

    for (const m of movements) {
      const qty = m.quantity !== undefined ? m.quantity : m.quantityChange ?? 0;
      if (m.type === 'PURCHASE') {
        const isOpening =
          m.referenceId === 'opening_stock' ||
          m.referenceId === 'init_opening' ||
          Boolean(m.referenceId?.includes('opening')) ||
          Boolean(m.note?.toLowerCase().includes('opening'));
        if (!isOpening) {
          purchases += Math.abs(qty);
        }
      } else if (m.type === 'RETURN') {
        returns += Math.abs(qty);
      } else if (m.type === 'ADJUSTMENT') {
        if (qty >= 0) {
          positiveAdjustments += qty;
        } else {
          negativeAdjustments += Math.abs(qty);
        }
      } else if (m.type === 'SALE') {
        sales += Math.abs(qty);
      }
    }

    const calculatedStock =
      openingStock +
      purchases +
      returns +
      positiveAdjustments -
      sales -
      negativeAdjustments;

    return {
      openingStock,
      purchases,
      returns,
      positiveAdjustments,
      sales,
      negativeAdjustments,
      calculatedStock,
      storedStock: product.stock,
    };
  },

  async getMovements(productId?: string): Promise<InventoryMovement[]> {
    if (productId) {
      return await db.inventoryMovements
        .where('productId')
        .equals(productId)
        .reverse()
        .sortBy('createdAt');
    }
    return await db.inventoryMovements.reverse().sortBy('createdAt');
  },

  async getPurchases(productId?: string): Promise<Purchase[]> {
    if (productId) {
      return await db.purchases
        .where('productId')
        .equals(productId)
        .reverse()
        .sortBy('createdAt');
    }
    return await db.purchases.reverse().sortBy('createdAt');
  },

  // Supplier Management (Requirement 11)
  async getAllSuppliers(): Promise<Supplier[]> {
    return await db.suppliers.toArray();
  },

  async addSupplier(data: { name: string; phone?: string; notes?: string }): Promise<Supplier> {
    const now = new Date().toISOString();
    const id = generateId('supp');
    const supplier: Supplier = {
      id,
      name: data.name.trim(),
      phone: data.phone?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await db.suppliers.add(supplier);
    await syncService.enqueue('suppliers', id, 'CREATE', supplier as unknown as Record<string, unknown>);
    return supplier;
  },
};
