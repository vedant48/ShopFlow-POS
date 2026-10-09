import { db } from '../db';
import type {
  OpenOrder,
  OpenOrderItem,
  CartItem,
  Product,
  PriceVariant,
  PaymentStatus,
  PaymentMethod,
  Sale,
} from '../types';
import { generateId } from '../lib/utils';
import { syncService } from './syncService';
import { saleService } from './saleService';
import { authService } from '../auth/authService';

export interface CreateOpenOrderInput {
  items: CartItem[];
  customerId?: string;
  customerName?: string;
  temporaryCustomerName?: string;
  note?: string;
  shopId?: string;
}

export interface CheckoutOpenOrderInput {
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  customerId?: string;
  customerName?: string;
}

export const openOrderService = {
  /**
   * Generates next available walk-in customer label (e.g. Walk-in #1, Walk-in #2)
   * scoped sensibly to currently active OPEN orders for the shop.
   */
  async getNextWalkInName(targetShopId?: string): Promise<string> {
    const shopId = targetShopId || authService.getCurrentShopId();
    const openOrders = await db.openOrders
      .filter((o) => (o.shopId || 'shop_demo_001') === shopId && o.status === 'OPEN')
      .toArray();

    const usedNumbers = new Set<number>();
    for (const ord of openOrders) {
      if (ord.temporaryCustomerName) {
        const match = ord.temporaryCustomerName.match(/Walk-in #(\d+)/i);
        if (match) {
          usedNumbers.add(parseInt(match[1], 10));
        }
      }
    }

    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }

    return `Walk-in #${nextNumber}`;
  },

  /**
   * Creates an Open Order from active cart items.
   * DOES NOT reduce inventory. DOES NOT create a sale.
   */
  async createOpenOrder(input: CreateOpenOrderInput): Promise<{ order: OpenOrder; items: OpenOrderItem[] }> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot hold an empty order');
    }

    const shopId = input.shopId || authService.getCurrentShopId();
    const now = new Date().toISOString();
    const orderId = generateId('ord');

    let temporaryCustomerName: string | null = null;
    let customerId: string | null = input.customerId || null;

    if (!customerId) {
      temporaryCustomerName = input.temporaryCustomerName || (await this.getNextWalkInName(shopId));
    }

    return await db.transaction('rw', [db.openOrders, db.openOrderItems, db.syncQueue], async () => {
      const orderItems: OpenOrderItem[] = [];
      let totalAmount = 0;
      let itemCount = 0;

      for (const cartItem of input.items) {
        const itemId = generateId('oi');
        const unitPrice =
          cartItem.selectedVariant?.price ??
          cartItem.selectedVariant?.sellingPrice ??
          cartItem.product.sellingPrice;
        const itemTotal = Math.round(unitPrice * cartItem.quantity);
        const itemName =
          cartItem.selectedVariant && !cartItem.selectedVariant.isDefault
            ? `${cartItem.product.name} (${cartItem.selectedVariant.name})`
            : cartItem.product.name;

        const openItem: OpenOrderItem = {
          id: itemId,
          shopId,
          openOrderId: orderId,
          productId: cartItem.product.id,
          productName: itemName,
          productEmoji: cartItem.product.emoji || '📦',
          variantId: cartItem.selectedVariant?.id,
          variantName: cartItem.selectedVariant?.name,
          quantity: cartItem.quantity,
          unitPrice,
          totalPrice: itemTotal,
          createdAt: now,
          updatedAt: now,
        };

        orderItems.push(openItem);
        totalAmount += itemTotal;
        itemCount += cartItem.quantity;
      }

      const newOrder: OpenOrder = {
        id: orderId,
        shopId,
        customerId,
        temporaryCustomerName,
        status: 'OPEN',
        totalAmount,
        itemCount,
        note: input.note?.trim() || null,
        saleId: null,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      };

      await db.openOrders.add(newOrder);
      await syncService.enqueue('openOrders', newOrder.id, 'CREATE', newOrder as unknown as Record<string, unknown>, shopId);

      for (const oi of orderItems) {
        await db.openOrderItems.add(oi);
        await syncService.enqueue('openOrderItems', oi.id, 'CREATE', oi as unknown as Record<string, unknown>, shopId);
      }

      return { order: newOrder, items: orderItems };
    });
  },

  /**
   * Retrieves all currently OPEN orders for a shop, sorted by lastActivityAt DESC.
   */
  async getOpenOrders(targetShopId?: string): Promise<OpenOrder[]> {
    const shopId = targetShopId || authService.getCurrentShopId();
    const orders = await db.openOrders
      .filter((o) => (o.shopId || 'shop_demo_001') === shopId && o.status === 'OPEN')
      .toArray();

    return orders.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  },

  /**
   * Retrieves an Open Order and its items.
   */
  async getOpenOrderWithItems(orderId: string): Promise<{ order: OpenOrder; items: OpenOrderItem[] } | null> {
    const order = await db.openOrders.get(orderId);
    if (!order) return null;

    const items = await db.openOrderItems
      .where('openOrderId')
      .equals(orderId)
      .toArray();

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { order, items };
  },

  /**
   * Automatically adds a product to an existing Open Order and updates totals.
   */
  async addItemToOrder(
    orderId: string,
    product: Product,
    quantity: number = 1,
    variant?: PriceVariant
  ): Promise<void> {
    const now = new Date().toISOString();

    await db.transaction('rw', [db.openOrders, db.openOrderItems, db.syncQueue], async () => {
      const order = await db.openOrders.get(orderId);
      if (!order || order.status !== 'OPEN') {
        throw new Error('Order is not open');
      }

      const shopId = order.shopId || authService.getCurrentShopId();
      const effectiveVariant = variant || (product.priceVariants && product.priceVariants[0]);
      const effectivePrice =
        effectiveVariant?.price ?? effectiveVariant?.sellingPrice ?? product.sellingPrice;
      const itemName =
        effectiveVariant && !effectiveVariant.isDefault
          ? `${product.name} (${effectiveVariant.name})`
          : product.name;

      // Check if item already exists in open order
      const existingItems = await db.openOrderItems
        .where('openOrderId')
        .equals(orderId)
        .toArray();

      const existing = existingItems.find(
        (i) =>
          i.productId === product.id &&
          (effectiveVariant?.id ? i.variantId === effectiveVariant.id : !i.variantId)
      );

      if (existing) {
        const newQty = existing.quantity + quantity;
        const newTotal = Math.round(newQty * existing.unitPrice);
        await db.openOrderItems.update(existing.id, {
          quantity: newQty,
          totalPrice: newTotal,
          updatedAt: now,
        });

        await syncService.enqueue('openOrderItems', existing.id, 'UPDATE', {
          quantity: newQty,
          totalPrice: newTotal,
          shopId,
          updatedAt: now,
        }, shopId);
      } else {
        const newItemId = generateId('oi');
        const newItem: OpenOrderItem = {
          id: newItemId,
          shopId,
          openOrderId: orderId,
          productId: product.id,
          productName: itemName,
          productEmoji: product.emoji || '📦',
          variantId: effectiveVariant?.id,
          variantName: effectiveVariant?.name,
          quantity,
          unitPrice: effectivePrice,
          totalPrice: Math.round(effectivePrice * quantity),
          createdAt: now,
          updatedAt: now,
        };

        await db.openOrderItems.add(newItem);
        await syncService.enqueue('openOrderItems', newItem.id, 'CREATE', newItem as unknown as Record<string, unknown>, shopId);
      }

      // Recalculate order totals
      await this.recalculateOrderTotals(orderId, now);
    });
  },

  /**
   * Updates an item's quantity in an Open Order. If quantity reaches 0, removes the item.
   */
  async updateItemQuantity(orderId: string, itemId: string, newQuantity: number): Promise<void> {
    const now = new Date().toISOString();

    await db.transaction('rw', [db.openOrders, db.openOrderItems, db.syncQueue], async () => {
      const order = await db.openOrders.get(orderId);
      if (!order || order.status !== 'OPEN') {
        throw new Error('Order is not open');
      }

      const item = await db.openOrderItems.get(itemId);
      if (!item) return;

      const shopId = order.shopId || authService.getCurrentShopId();

      if (newQuantity <= 0) {
        await db.openOrderItems.delete(itemId);
        await syncService.enqueue('openOrderItems', itemId, 'DELETE', { id: itemId, shopId }, shopId);
      } else {
        const newTotal = Math.round(newQuantity * item.unitPrice);
        await db.openOrderItems.update(itemId, {
          quantity: newQuantity,
          totalPrice: newTotal,
          updatedAt: now,
        });

        await syncService.enqueue('openOrderItems', itemId, 'UPDATE', {
          quantity: newQuantity,
          totalPrice: newTotal,
          shopId,
          updatedAt: now,
        }, shopId);
      }

      await this.recalculateOrderTotals(orderId, now);
    });
  },

  /**
   * Removes an item completely from an Open Order.
   */
  async removeItemFromOrder(orderId: string, itemId: string): Promise<void> {
    await this.updateItemQuantity(orderId, itemId, 0);
  },

  /**
   * Recalculates totalAmount, itemCount, and lastActivityAt for an order.
   */
  async recalculateOrderTotals(orderId: string, now: string): Promise<void> {
    const items = await db.openOrderItems
      .where('openOrderId')
      .equals(orderId)
      .toArray();

    const totalAmount = items.reduce((sum, i) => sum + i.totalPrice, 0);
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const order = await db.openOrders.get(orderId);
    if (!order) return;

    const shopId = order.shopId || authService.getCurrentShopId();
    await db.openOrders.update(orderId, {
      totalAmount,
      itemCount,
      lastActivityAt: now,
      updatedAt: now,
    });

    await syncService.enqueue('openOrders', orderId, 'UPDATE', {
      totalAmount,
      itemCount,
      lastActivityAt: now,
      shopId,
      updatedAt: now,
    }, shopId);
  },

  /**
   * Attaches or updates customer on an Open Order (e.g. converting Walk-in #1 to Rahul).
   */
  async updateOrderCustomer(
    orderId: string,
    customerId: string,
    _customerName?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await db.transaction('rw', [db.openOrders, db.syncQueue], async () => {
      const order = await db.openOrders.get(orderId);
      if (!order || order.status !== 'OPEN') {
        throw new Error('Order is not open');
      }

      const shopId = order.shopId || authService.getCurrentShopId();
      await db.openOrders.update(orderId, {
        customerId,
        temporaryCustomerName: null,
        lastActivityAt: now,
        updatedAt: now,
      });

      await syncService.enqueue('openOrders', orderId, 'UPDATE', {
        customerId,
        temporaryCustomerName: null,
        lastActivityAt: now,
        shopId,
        updatedAt: now,
      }, shopId);
    });
  },

  /**
   * Updates note on an Open Order.
   */
  async updateOrderNote(orderId: string, note?: string): Promise<void> {
    const now = new Date().toISOString();

    await db.transaction('rw', [db.openOrders, db.syncQueue], async () => {
      const order = await db.openOrders.get(orderId);
      if (!order || order.status !== 'OPEN') {
        throw new Error('Order is not open');
      }

      const shopId = order.shopId || authService.getCurrentShopId();
      const updatedNote = note?.trim() || null;

      await db.openOrders.update(orderId, {
        note: updatedNote,
        lastActivityAt: now,
        updatedAt: now,
      });

      await syncService.enqueue('openOrders', orderId, 'UPDATE', {
        note: updatedNote,
        lastActivityAt: now,
        shopId,
        updatedAt: now,
      }, shopId);
    });
  },

  /**
   * Cancels an Open Order.
   * DOES NOT create a sale. DOES NOT create payments. DOES NOT change inventory.
   */
  async cancelOpenOrder(orderId: string): Promise<void> {
    const now = new Date().toISOString();

    await db.transaction('rw', [db.openOrders, db.syncQueue], async () => {
      const order = await db.openOrders.get(orderId);
      if (!order) return;
      if (order.status !== 'OPEN') {
        throw new Error(`Order is already ${order.status}`);
      }

      const shopId = order.shopId || authService.getCurrentShopId();
      await db.openOrders.update(orderId, {
        status: 'CANCELLED',
        lastActivityAt: now,
        updatedAt: now,
      });

      await syncService.enqueue('openOrders', orderId, 'UPDATE', {
        status: 'CANCELLED',
        lastActivityAt: now,
        shopId,
        updatedAt: now,
      }, shopId);
    });
  },

  /**
   * Converts an Open Order into a finalized Sale at checkout.
   * GUARANTEES IDEMPOTENCY: An already CHECKED_OUT order will throw an error and never create a duplicate sale.
   */
  async checkoutOpenOrder(
    orderId: string,
    payment: CheckoutOpenOrderInput
  ): Promise<{ order: OpenOrder; sale: Sale }> {
    const now = new Date().toISOString();

    // 1. Transactional validation and single-flight lock
    return await db.transaction(
      'rw',
      [
        db.openOrders,
        db.openOrderItems,
        db.sales,
        db.saleItems,
        db.products,
        db.customers,
        db.inventoryMovements,
        db.syncQueue,
      ],
      async () => {
        const order = await db.openOrders.get(orderId);
        if (!order) {
          throw new Error(`Order ${orderId} not found`);
        }
        if (order.status !== 'OPEN') {
          throw new Error(`Order ${orderId} is already ${order.status}. Duplicate checkout blocked.`);
        }

        const items = await db.openOrderItems
          .where('openOrderId')
          .equals(orderId)
          .toArray();

        if (items.length === 0) {
          throw new Error('Cannot checkout an empty order');
        }

        // Validate Udhaar customer requirement
        const customerId = payment.customerId || order.customerId;
        if (payment.paymentStatus === 'UDHAAR' && !customerId) {
          throw new Error('A registered customer is required for Udhaar checkout');
        }

        const shopId = order.shopId || authService.getCurrentShopId();

        // 2. Prepare items preserving captured unit price and product cost
        const products = await db.products.toArray();
        const prodMap = new Map(products.map((p) => [p.id, p]));

        const cartItems: CartItem[] = items.map((oi) => {
          const prod = prodMap.get(oi.productId);
          const matchedVariant = prod?.priceVariants?.find((v) => v.id === oi.variantId);
          const itemCost = matchedVariant?.costPrice ?? prod?.costPrice ?? 0;

          return {
            product: {
              id: oi.productId,
              name: oi.productName,
              emoji: oi.productEmoji || '📦',
              sellingPrice: oi.unitPrice, // Preserves captured price
              costPrice: itemCost,
              stock: prod ? prod.stock : 999999, // Stock deduction handled safely in createSale
              minStock: prod?.minStock || 0,
              active: true,
              createdAt: oi.createdAt,
              updatedAt: oi.updatedAt,
            } as Product,
            quantity: oi.quantity,
            selectedVariant: oi.variantId
              ? {
                  id: oi.variantId,
                  name: oi.variantName || 'Standard',
                  price: oi.unitPrice,
                  sellingPrice: oi.unitPrice,
                  costPrice: itemCost,
                  isDefault: false,
                }
              : undefined,
          };
        });

        // 3. Create the finalized Sale through existing saleService logic
        const sale = await saleService.createSale({
          items: cartItems,
          paymentStatus: payment.paymentStatus,
          paymentMethod: payment.paymentMethod,
          customerId: customerId || undefined,
          customerName: payment.customerName || (customerId ? undefined : order.temporaryCustomerName || undefined),
          notes: order.note || undefined,
          ...(shopId ? { shopId } : {}),
        });

        // 4. Mark Open Order as CHECKED_OUT and link saleId
        const updatedOrder: OpenOrder = {
          ...order,
          status: 'CHECKED_OUT',
          saleId: sale.id,
          lastActivityAt: now,
          updatedAt: now,
        };

        await db.openOrders.update(orderId, {
          status: 'CHECKED_OUT',
          saleId: sale.id,
          lastActivityAt: now,
          updatedAt: now,
        });

        await syncService.enqueue('openOrders', orderId, 'UPDATE', {
          status: 'CHECKED_OUT',
          saleId: sale.id,
          lastActivityAt: now,
          shopId,
          updatedAt: now,
        }, shopId);

        return { order: updatedOrder, sale };
      }
    );
  },
};
