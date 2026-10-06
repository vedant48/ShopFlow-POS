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
};

export async function processSyncEvents(
  db: D1Database,
  shopId: string,
  events: SyncEventPayload[]
): Promise<SyncResult> {
  const successful: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

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

  for (const event of sortedEvents) {
    try {
      await processSingleEvent(db, shopId, event);
      successful.push(event.id);
    } catch (err: any) {
      console.error(`Sync error for event ${event.id}:`, err);
      failed.push({
        id: event.id,
        error: err?.message || 'Unknown processing error',
      });
    }
  }

  return { successful, failed };
}

async function processSingleEvent(
  db: D1Database,
  shopId: string,
  event: SyncEventPayload
): Promise<void> {
  const { id: syncId, entity, entityId, operation, payload, createdAt } = event;
  const now = new Date().toISOString();
  const eventCreatedAt = createdAt || now;

  // 1. Idempotency Check (Section 11)
  // If this exact sync queue event ID has already been recorded in sync_events, it was processed
  const existingSync = await db
    .prepare('SELECT id FROM sync_events WHERE id = ? AND shop_id = ?')
    .bind(syncId, shopId)
    .first();

  if (existingSync) {
    return; // Already processed idempotently
  }

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
          await db
            .prepare(
              `INSERT INTO products (
                id, shop_id, name, emoji, selling_price, cost_price,
                stock, min_stock, opening_stock, unit, category, category_id, brand_id, sku,
                barcode, active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              entityId,
              shopId,
              payload.name || 'Product',
              payload.emoji || '📦',
              Number(payload.sellingPrice || 0),
              Number(payload.costPrice || 0),
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

          await db
            .prepare(
              `UPDATE products SET 
                name = COALESCE(?, name),
                emoji = COALESCE(?, emoji),
                selling_price = COALESCE(?, selling_price),
                cost_price = COALESCE(?, cost_price),
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

          await db
            .prepare(
              `UPDATE products SET 
                name = COALESCE(?, name),
                emoji = COALESCE(?, emoji),
                selling_price = COALESCE(?, selling_price),
                cost_price = COALESCE(?, cost_price),
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

    default:
      console.warn(`Unknown sync entity type: ${entity}`);
      break;
  }

  // 3. Record processed event in sync_events for permanent audit and idempotency
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
}
