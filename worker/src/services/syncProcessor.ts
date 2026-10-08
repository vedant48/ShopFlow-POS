import type { SyncEventPayload, SyncResult } from '../types';

// Entity dependency ordering tier (Section 15)
// Categories must exist before Brands, Brands before Products, etc.
const ENTITY_DEPENDENCY_TIER: Record<string, number> = {
  categories: 1,
  brands: 2,
  products: 3,
  suppliers: 4,
  customers: 5,
  purchases: 6,
  sales: 7,
  saleItems: 8,
  payments: 9,
  inventoryMovements: 10,
  expenses: 11,
  openOrders: 12,
  openOrderItems: 13,
};

export async function processSyncEvents(
  db: D1Database,
  shopId: string,
  events: SyncEventPayload[],
  requestId: string = 'req_unknown'
): Promise<SyncResult> {
  const successful: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  const timings: any[] = [];

  // Sort events chronologically, and resolve dependency tiers (Section 15)
  const sortedEvents = [...events].sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const tierA = ENTITY_DEPENDENCY_TIER[a.entity] ?? 50;
    const tierB = ENTITY_DEPENDENCY_TIER[b.entity] ?? 50;
    return tierA - tierB;
  });

  // 1. Batch idempotency pre-check across all incoming events (Section 11 Optimization)
  const syncIds = sortedEvents.map((e) => e.id);
  const alreadyProcessed = new Set<string>();
  if (syncIds.length > 0) {
    const placeholders = syncIds.map(() => '?').join(',');
    const existing = await db
      .prepare(`SELECT id FROM sync_events WHERE id IN (${placeholders}) AND shop_id = ?`)
      .bind(...syncIds, shopId)
      .all<{ id: string }>();
    if (existing.results) {
      for (const row of existing.results) {
        alreadyProcessed.add(row.id);
      }
    }
  }

  for (const event of sortedEvents) {
    if (alreadyProcessed.has(event.id)) {
      console.log(`[Worker ${requestId}] Event ${event.id} (${event.entity}:${event.entityId}:${event.operation}) already processed idempotently`);
      successful.push(event.id);
      timings.push({
        id: event.id,
        entity: event.entity,
        entityId: event.entityId,
        operation: event.operation,
        totalEventMs: 0,
        skipped: 1,
      });
      continue;
    }

    const eventStart = performance.now();
    try {
      const eventTiming = await processSingleEvent(db, shopId, event, requestId, true);
      successful.push(event.id);
      timings.push({
        id: event.id,
        entity: event.entity,
        entityId: event.entityId,
        operation: event.operation,
        totalEventMs: performance.now() - eventStart,
        ...eventTiming,
      });
    } catch (err: any) {
      console.error(`[Worker ${requestId}] Sync error for event ${event.id} (${event.entity}:${event.entityId}:${event.operation}):`, err);
      failed.push({
        id: event.id,
        error: err?.message || 'Unknown processing error',
      });
      timings.push({
        id: event.id,
        entity: event.entity,
        entityId: event.entityId,
        operation: event.operation,
        totalEventMs: performance.now() - eventStart,
        error: err?.message,
      });
    }
  }

  return { successful, failed, timings };
}

async function processSingleEvent(
  db: D1Database,
  shopId: string,
  event: SyncEventPayload,
  requestId: string = 'req_unknown',
  skipIdempotencyCheck: boolean = false
): Promise<Record<string, number>> {
  const { id: syncId, entity, entityId, operation, payload, createdAt } = event;
  const now = new Date().toISOString();
  const eventCreatedAt = createdAt || now;

  let q1Duration = 0;
  if (!skipIdempotencyCheck) {
    const q1Start = performance.now();
    const existingSync = await db
      .prepare('SELECT id FROM sync_events WHERE id = ? AND shop_id = ?')
      .bind(syncId, shopId)
      .first();
    q1Duration = performance.now() - q1Start;

    if (existingSync) {
      console.log(`[Worker ${requestId}] Event ${syncId} (${entity}:${entityId}:${operation}) already processed idempotently (check took ${q1Duration.toFixed(2)}ms)`);
      return { q1IdempotencyMs: q1Duration, skipped: 1 };
    }
  }

  const entityOpStart = performance.now();

  // 2. Route by entity type with strict shop isolation
  switch (entity) {
    case 'sales': {
      if (operation === 'CREATE') {
        const existing = await db
          .prepare('SELECT id FROM sales WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .first();

        if (!existing) {
          await db
            .prepare(
              `INSERT INTO sales (
                id, shop_id, sale_number, customer_id, customer_name,
                payment_status, payment_method, total, item_count, notes,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.saleNumber || null,
              payload.customerId || null,
              payload.customerName || null,
              payload.paymentStatus || 'PAID',
              payload.paymentMethod || 'NONE',
              Number(payload.totalAmount ?? payload.total ?? 0),
              Number(payload.itemCount || 0),
              payload.notes || null,
              eventCreatedAt,
              payload.updatedAt || eventCreatedAt
            )
            .run();
        }
      } else if (operation === 'DELETE') {
        await db
          .prepare('DELETE FROM sales WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .run();
      }
      break;
    }

    case 'saleItems': {
      if (operation === 'CREATE') {
        const existing = await db
          .prepare('SELECT id FROM sale_items WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .first();

        if (!existing) {
          const sellingPrice = Number(payload.sellingPrice ?? payload.unitPrice ?? 0);
          const costPrice = Number(payload.costPrice ?? payload.unitCost ?? 0);
          const quantity = Number(payload.quantity || 1);
          const totalPrice = Number(payload.totalPrice ?? sellingPrice * quantity);

          await db
            .prepare(
              `INSERT INTO sale_items (
                id, shop_id, sale_id, product_id, product_name,
                product_emoji, quantity, selling_price, cost_price,
                total_price, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.saleId,
              payload.productId,
              payload.productName || 'Product',
              payload.productEmoji || '📦',
              quantity,
              sellingPrice,
              costPrice,
              totalPrice,
              eventCreatedAt
            )
            .run();
        }
      }
      break;
    }

    case 'payments': {
      if (operation === 'CREATE') {
        const existing = await db
          .prepare('SELECT id FROM payments WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .first();

        if (!existing) {
          const amount = Number(payload.amount || 0);
          await db
            .prepare(
              `INSERT INTO payments (
                id, shop_id, customer_id, amount, payment_method, note, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.customerId,
              amount,
              payload.paymentMethod || 'CASH',
              payload.note || null,
              eventCreatedAt
            )
            .run();

          // Section 23: Materialize customer balance (Udhaar - Payments)
          if (payload.customerId) {
            await db
              .prepare(
                'UPDATE customers SET balance = balance - ?, updated_at = ? WHERE id = ? AND shop_id = ?'
              )
              .bind(amount, now, payload.customerId, shopId)
              .run();
          }
        }
      }
      break;
    }

    case 'inventoryMovements': {
      if (operation === 'CREATE') {
        const existing = await db
          .prepare('SELECT id FROM inventory_movements WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .first();

        if (!existing) {
          const qty = Number(payload.quantity ?? payload.quantityChange ?? 0);
          const prev = Number(payload.previousStock ?? 0);
          const next = Number(payload.newStock ?? prev + qty);

          await db
            .prepare(
              `INSERT INTO inventory_movements (
                id, shop_id, product_id, type, quantity,
                previous_stock, new_stock, reason, reference_id, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.productId,
              payload.type || 'SALE',
              qty,
              prev,
              next,
              payload.reason || payload.note || payload.notes || null,
              payload.referenceId || null,
              eventCreatedAt
            )
            .run();

          // Update product stock on server to stay in sync
          if (payload.productId) {
            await db
              .prepare(
                'UPDATE products SET stock = ?, updated_at = ? WHERE id = ? AND shop_id = ?'
              )
              .bind(next, now, payload.productId, shopId)
              .run();
          }
        }
      }
      break;
    }

    case 'expenses': {
      if (operation === 'CREATE') {
        const existing = await db
          .prepare('SELECT id FROM expenses WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .first();

        if (!existing) {
          await db
            .prepare(
              `INSERT INTO expenses (
                id, shop_id, title, amount, category, note, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.title || payload.note || 'Expense',
              Number(payload.amount || 0),
              payload.category || 'Other',
              payload.note || null,
              eventCreatedAt
            )
            .run();
        }
      } else if (operation === 'DELETE') {
        await db
          .prepare('DELETE FROM expenses WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .run();
      }
      break;
    }

    case 'customers': {
      const existing: any = await db
        .prepare('SELECT id, updated_at FROM customers WHERE id = ? AND shop_id = ?')
        .bind(entityId, shopId)
        .first();

      if (operation === 'CREATE') {
        if (!existing) {
          await db
            .prepare(
              `INSERT INTO customers (
                id, shop_id, name, phone, balance, notes, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.name || 'Customer',
              payload.phone || null,
              Number(payload.balance || 0),
              payload.notes || null,
              eventCreatedAt,
              payload.updatedAt || eventCreatedAt
            )
            .run();
        } else {
          // Last write wins (Section 21)
          await db
            .prepare(
              `UPDATE customers SET 
                name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                balance = COALESCE(?, balance),
                notes = COALESCE(?, notes),
                updated_at = ?
              WHERE id = ? AND shop_id = ?`
            )
            .bind(
              payload.name ?? null,
              payload.phone ?? null,
              payload.balance !== undefined ? Number(payload.balance) : null,
              payload.notes ?? null,
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'UPDATE') {
        if (existing) {
          await db
            .prepare(
              `UPDATE customers SET 
                name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                balance = COALESCE(?, balance),
                notes = COALESCE(?, notes),
                updated_at = ?
              WHERE id = ? AND shop_id = ?`
            )
            .bind(
              payload.name ?? null,
              payload.phone ?? null,
              payload.balance !== undefined ? Number(payload.balance) : null,
              payload.notes ?? null,
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'DELETE') {
        await db
          .prepare('DELETE FROM customers WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .run();
      }
      break;
    }

    case 'categories': {
      const existing: any = await db
        .prepare('SELECT id, updated_at FROM categories WHERE id = ? AND shop_id = ?')
        .bind(entityId, shopId)
        .first();

      if (operation === 'CREATE') {
        if (!existing) {
          await db
            .prepare(
              `INSERT INTO categories (
                id, shop_id, name, icon, sort_order, is_active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.name || 'Category',
              payload.icon || 'package',
              Number(payload.sortOrder ?? payload.sort_order ?? 0),
              payload.isActive !== false && payload.is_active !== 0 ? 1 : 0,
              eventCreatedAt,
              payload.updatedAt || eventCreatedAt
            )
            .run();
        } else {
          await db
            .prepare(
              `UPDATE categories SET 
                name = COALESCE(?, name),
                icon = COALESCE(?, icon),
                sort_order = COALESCE(?, sort_order),
                is_active = COALESCE(?, is_active),
                updated_at = ?
              WHERE id = ? AND shop_id = ?`
            )
            .bind(
              payload.name ?? null,
              payload.icon ?? null,
              payload.sortOrder ?? payload.sort_order ?? null,
              payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : (payload.is_active !== undefined ? payload.is_active : null),
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'UPDATE') {
        if (existing) {
          await db
            .prepare(
              `UPDATE categories SET 
                name = COALESCE(?, name),
                icon = COALESCE(?, icon),
                sort_order = COALESCE(?, sort_order),
                is_active = COALESCE(?, is_active),
                updated_at = ?
              WHERE id = ? AND shop_id = ?`
            )
            .bind(
              payload.name ?? null,
              payload.icon ?? null,
              payload.sortOrder ?? payload.sort_order ?? null,
              payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : (payload.is_active !== undefined ? payload.is_active : null),
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'DELETE') {
        await db
          .prepare('UPDATE categories SET is_active = 0, updated_at = ? WHERE id = ? AND shop_id = ?')
          .bind(now, entityId, shopId)
          .run();
      }
      break;
    }

    case 'brands': {
      const existing: any = await db
        .prepare('SELECT id, updated_at FROM brands WHERE id = ? AND shop_id = ?')
        .bind(entityId, shopId)
        .first();

      const targetCategoryId = payload.categoryId || payload.category_id || null;

      if (operation === 'CREATE') {
        if (!existing) {
          await db
            .prepare(
              `INSERT INTO brands (
                id, shop_id, category_id, name, sort_order, is_active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              targetCategoryId,
              payload.name || 'Brand',
              Number(payload.sortOrder ?? payload.sort_order ?? 0),
              payload.isActive !== false && payload.is_active !== 0 ? 1 : 0,
              eventCreatedAt,
              payload.updatedAt || eventCreatedAt
            )
            .run();
        } else {
          await db
            .prepare(
              `UPDATE brands SET 
                category_id = COALESCE(?, category_id),
                name = COALESCE(?, name),
                sort_order = COALESCE(?, sort_order),
                is_active = COALESCE(?, is_active),
                updated_at = ?
              WHERE id = ? AND shop_id = ?`
            )
            .bind(
              targetCategoryId,
              payload.name ?? null,
              payload.sortOrder ?? payload.sort_order ?? null,
              payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : (payload.is_active !== undefined ? payload.is_active : null),
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'UPDATE') {
        if (existing) {
          await db
            .prepare(
              `UPDATE brands SET 
                category_id = COALESCE(?, category_id),
                name = COALESCE(?, name),
                sort_order = COALESCE(?, sort_order),
                is_active = COALESCE(?, is_active),
                updated_at = ?
              WHERE id = ? AND shop_id = ?`
            )
            .bind(
              targetCategoryId,
              payload.name ?? null,
              payload.sortOrder ?? payload.sort_order ?? null,
              payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : (payload.is_active !== undefined ? payload.is_active : null),
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'DELETE') {
        await db
          .prepare('UPDATE brands SET is_active = 0, updated_at = ? WHERE id = ? AND shop_id = ?')
          .bind(now, entityId, shopId)
          .run();
      }
      break;
    }

    case 'products': {
      const existing: any = await db
        .prepare('SELECT id, category_id, brand_id, updated_at FROM products WHERE id = ? AND shop_id = ?')
        .bind(entityId, shopId)
        .first();

      const catId = payload.categoryId !== undefined ? payload.categoryId : (payload.category_id !== undefined ? payload.category_id : null);
      const brId = payload.brandId !== undefined ? payload.brandId : (payload.brand_id !== undefined ? payload.brand_id : null);

      if (operation === 'CREATE') {
        if (!existing) {
          const mrpVal = payload.mrp !== undefined ? Number(payload.mrp) : Number(payload.sellingPrice || 0);
          const variantsJson = payload.priceVariants
            ? (typeof payload.priceVariants === 'string' ? payload.priceVariants : JSON.stringify(payload.priceVariants))
            : null;
          const sortVal = Number(payload.sortOrder ?? payload.sort_order ?? 0);

          await db
            .prepare(
              `INSERT INTO products (
                id, shop_id, name, emoji, selling_price, cost_price, mrp, price_variants, sort_order,
                stock, min_stock, opening_stock, unit, category, category_id, brand_id, sku,
                barcode, active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.name || 'Product',
              payload.emoji || '📦',
              Number(payload.sellingPrice || 0),
              Number(payload.costPrice || 0),
              mrpVal,
              variantsJson,
              sortVal,
              Number(payload.stock || 0),
              Number(payload.minStock || 5),
              Number(payload.openingStock ?? payload.stock ?? 0),
              payload.unit || 'pcs',
              payload.category || 'Other',
              catId,
              brId,
              payload.sku || null,
              payload.barcode || null,
              payload.active !== false ? 1 : 0,
              eventCreatedAt,
              payload.updatedAt || eventCreatedAt
            )
            .run();
        } else {
          // Last write wins
          const nextCatId = catId !== null ? catId : existing.category_id;
          const nextBrId = payload.brandId !== undefined ? payload.brandId : (payload.brand_id !== undefined ? payload.brand_id : existing.brand_id);
          const variantsJson = payload.priceVariants
            ? (typeof payload.priceVariants === 'string' ? payload.priceVariants : JSON.stringify(payload.priceVariants))
            : null;

          await db
            .prepare(
              `UPDATE products SET 
                name = COALESCE(?, name),
                emoji = COALESCE(?, emoji),
                selling_price = COALESCE(?, selling_price),
                cost_price = COALESCE(?, cost_price),
                mrp = COALESCE(?, mrp),
                price_variants = COALESCE(?, price_variants),
                sort_order = COALESCE(?, sort_order),
                stock = COALESCE(?, stock),
                min_stock = COALESCE(?, min_stock),
                category = COALESCE(?, category),
                category_id = ?,
                brand_id = ?,
                sku = COALESCE(?, sku),
                barcode = COALESCE(?, barcode),
                active = COALESCE(?, active),
                updated_at = ?
              WHERE id = ? AND shop_id = ?`
            )
            .bind(
              payload.name ?? null,
              payload.emoji ?? null,
              payload.sellingPrice !== undefined ? Number(payload.sellingPrice) : null,
              payload.costPrice !== undefined ? Number(payload.costPrice) : null,
              payload.mrp !== undefined ? Number(payload.mrp) : null,
              variantsJson,
              payload.sortOrder !== undefined ? Number(payload.sortOrder) : (payload.sort_order !== undefined ? Number(payload.sort_order) : null),
              payload.stock !== undefined ? Number(payload.stock) : null,
              payload.minStock !== undefined ? Number(payload.minStock) : null,
              payload.category ?? null,
              nextCatId,
              nextBrId,
              payload.sku ?? null,
              payload.barcode ?? null,
              payload.active !== undefined ? (payload.active ? 1 : 0) : null,
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'UPDATE') {
        if (existing) {
          const nextCatId = catId !== null ? catId : existing.category_id;
          const nextBrId = payload.brandId !== undefined ? payload.brandId : (payload.brand_id !== undefined ? payload.brand_id : existing.brand_id);
          const variantsJson = payload.priceVariants
            ? (typeof payload.priceVariants === 'string' ? payload.priceVariants : JSON.stringify(payload.priceVariants))
            : null;

          await db
            .prepare(
              `UPDATE products SET 
                name = COALESCE(?, name),
                emoji = COALESCE(?, emoji),
                selling_price = COALESCE(?, selling_price),
                cost_price = COALESCE(?, cost_price),
                mrp = COALESCE(?, mrp),
                price_variants = COALESCE(?, price_variants),
                sort_order = COALESCE(?, sort_order),
                stock = COALESCE(?, stock),
                min_stock = COALESCE(?, min_stock),
                category = COALESCE(?, category),
                category_id = ?,
                brand_id = ?,
                sku = COALESCE(?, sku),
                barcode = COALESCE(?, barcode),
                active = COALESCE(?, active),
                updated_at = ?
              WHERE id = ? AND shop_id = ?`
            )
            .bind(
              payload.name ?? null,
              payload.emoji ?? null,
              payload.sellingPrice !== undefined ? Number(payload.sellingPrice) : null,
              payload.costPrice !== undefined ? Number(payload.costPrice) : null,
              payload.mrp !== undefined ? Number(payload.mrp) : null,
              variantsJson,
              payload.sortOrder !== undefined ? Number(payload.sortOrder) : (payload.sort_order !== undefined ? Number(payload.sort_order) : null),
              payload.stock !== undefined ? Number(payload.stock) : null,
              payload.minStock !== undefined ? Number(payload.minStock) : null,
              payload.category ?? null,
              nextCatId,
              nextBrId,
              payload.sku ?? null,
              payload.barcode ?? null,
              payload.active !== undefined ? (payload.active ? 1 : 0) : null,
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'DELETE') {
        // Soft delete / archive
        await db
          .prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ? AND shop_id = ?')
          .bind(now, entityId, shopId)
          .run();
      }
      break;
    }

    case 'purchases': {
      if (operation === 'CREATE') {
        const existing = await db
          .prepare('SELECT id FROM purchases WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .first();

        if (!existing) {
          await db
            .prepare(
              `INSERT INTO purchases (
                id, shop_id, supplier_id, supplier_name, product_id,
                product_name, quantity, unit_cost, total, note, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.supplierId || null,
              payload.supplierName || null,
              payload.productId || null,
              payload.productName || null,
              Number(payload.quantity || 0),
              Number(payload.unitCost || 0),
              Number(payload.totalCost ?? payload.total ?? 0),
              payload.note || null,
              eventCreatedAt
            )
            .run();
        }
      }
      break;
    }

    case 'suppliers': {
      const existing = await db
        .prepare('SELECT id FROM suppliers WHERE id = ? AND shop_id = ?')
        .bind(entityId, shopId)
        .first();

      if (operation === 'CREATE' && !existing) {
        await db
          .prepare(
            `INSERT INTO suppliers (id, shop_id, name, phone, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            entityId,
            shopId,
            payload.name || 'Supplier',
            payload.phone || null,
            payload.notes || null,
            eventCreatedAt,
            payload.updatedAt || eventCreatedAt
          )
          .run();
      }
      break;
    }

    case 'openOrders': {
      if (operation === 'CREATE') {
        const existing = await db
          .prepare('SELECT id FROM open_orders WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .first();

        if (!existing) {
          await db
            .prepare(
              `INSERT INTO open_orders (
                id, shop_id, customer_id, temporary_customer_name, status,
                total_amount, item_count, note, sale_id, last_activity_at,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.customerId || null,
              payload.temporaryCustomerName || null,
              payload.status || 'OPEN',
              Number(payload.totalAmount || 0),
              Number(payload.itemCount || 0),
              payload.note || null,
              payload.saleId || null,
              payload.lastActivityAt || eventCreatedAt,
              eventCreatedAt,
              payload.updatedAt || eventCreatedAt
            )
            .run();
        } else {
          await db
            .prepare(
              `UPDATE open_orders SET
                customer_id = ?, temporary_customer_name = ?, status = ?,
                total_amount = ?, item_count = ?, note = ?, sale_id = ?,
                last_activity_at = ?, updated_at = ?
               WHERE id = ? AND shop_id = ?`
            )
            .bind(
              payload.customerId || null,
              payload.temporaryCustomerName || null,
              payload.status || 'OPEN',
              Number(payload.totalAmount || 0),
              Number(payload.itemCount || 0),
              payload.note || null,
              payload.saleId || null,
              payload.lastActivityAt || now,
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'UPDATE') {
        await db
          .prepare(
            `UPDATE open_orders SET
              customer_id = coalesce(?, customer_id),
              temporary_customer_name = coalesce(?, temporary_customer_name),
              status = coalesce(?, status),
              total_amount = coalesce(?, total_amount),
              item_count = coalesce(?, item_count),
              note = coalesce(?, note),
              sale_id = coalesce(?, sale_id),
              last_activity_at = coalesce(?, last_activity_at),
              updated_at = ?
             WHERE id = ? AND shop_id = ?`
          )
          .bind(
            payload.customerId !== undefined ? payload.customerId : null,
            payload.temporaryCustomerName !== undefined ? payload.temporaryCustomerName : null,
            payload.status || null,
            payload.totalAmount !== undefined ? Number(payload.totalAmount) : null,
            payload.itemCount !== undefined ? Number(payload.itemCount) : null,
            payload.note !== undefined ? payload.note : null,
            payload.saleId !== undefined ? payload.saleId : null,
            payload.lastActivityAt || null,
            payload.updatedAt || now,
            entityId,
            shopId
          )
          .run();
      } else if (operation === 'DELETE') {
        await db.batch([
          db.prepare('DELETE FROM open_order_items WHERE open_order_id = ? AND shop_id = ?').bind(entityId, shopId),
          db.prepare('DELETE FROM open_orders WHERE id = ? AND shop_id = ?').bind(entityId, shopId),
        ]);
      }
      break;
    }

    case 'openOrderItems': {
      if (operation === 'CREATE') {
        const existing = await db
          .prepare('SELECT id FROM open_order_items WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .first();

        if (!existing) {
          await db
            .prepare(
              `INSERT INTO open_order_items (
                id, shop_id, open_order_id, product_id, product_name,
                product_emoji, variant_id, variant_name, quantity, unit_price,
                total_price, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.openOrderId,
              payload.productId,
              payload.productName || 'Product',
              payload.productEmoji || '📦',
              payload.variantId || null,
              payload.variantName || null,
              Number(payload.quantity || 1),
              Number(payload.unitPrice || 0),
              Number(payload.totalPrice || 0),
              eventCreatedAt,
              payload.updatedAt || eventCreatedAt
            )
            .run();
        } else {
          await db
            .prepare(
              `UPDATE open_order_items SET
                quantity = ?, unit_price = ?, total_price = ?, updated_at = ?
               WHERE id = ? AND shop_id = ?`
            )
            .bind(
              Number(payload.quantity || 1),
              Number(payload.unitPrice || 0),
              Number(payload.totalPrice || 0),
              payload.updatedAt || now,
              entityId,
              shopId
            )
            .run();
        }
      } else if (operation === 'UPDATE') {
        await db
          .prepare(
            `UPDATE open_order_items SET
              quantity = coalesce(?, quantity),
              unit_price = coalesce(?, unit_price),
              total_price = coalesce(?, total_price),
              updated_at = ?
             WHERE id = ? AND shop_id = ?`
          )
          .bind(
            payload.quantity !== undefined ? Number(payload.quantity) : null,
            payload.unitPrice !== undefined ? Number(payload.unitPrice) : null,
            payload.totalPrice !== undefined ? Number(payload.totalPrice) : null,
            payload.updatedAt || now,
            entityId,
            shopId
          )
          .run();
      } else if (operation === 'DELETE') {
        await db
          .prepare('DELETE FROM open_order_items WHERE id = ? AND shop_id = ?')
          .bind(entityId, shopId)
          .run();
      }
      break;
    }

    default:
      console.warn(`Unknown sync entity type: ${entity}`);
      break;
  }

  const entityOpDuration = performance.now() - entityOpStart;

  // 3. Record processed event in sync_events for permanent audit and idempotency
  const q4Start = performance.now();
  await db
    .prepare(
      `INSERT INTO sync_events (
        id, shop_id, entity_type, entity_id, operation, payload, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      syncId,
      shopId,
      entity,
      entityId,
      operation,
      JSON.stringify(payload),
      now
    )
    .run();
  const q4Duration = performance.now() - q4Start;
  const totalD1 = q1Duration + entityOpDuration + q4Duration;

  console.log(`[Worker ${requestId}] Event ${syncId} (${entity}:${entityId}:${operation}) D1 queries: q1_idemp=${q1Duration.toFixed(2)}ms, entity_op=${entityOpDuration.toFixed(2)}ms, q4_audit=${q4Duration.toFixed(2)}ms | total_D1=${totalD1.toFixed(2)}ms`);

  return {
    q1IdempotencyMs: q1Duration,
    entityOpMs: entityOpDuration,
    q4AuditMs: q4Duration,
    totalD1Ms: totalD1,
  };
}
