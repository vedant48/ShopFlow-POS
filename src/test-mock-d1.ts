// In-memory mock D1 database for acceptance testing Cloudflare Worker
export class MockD1Database {
  private tables: Map<string, Map<string, any>> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.tables = new Map([
      ['shops', new Map()],
      ['users', new Map()],
      ['sessions', new Map()],
      ['auth_rate_limits', new Map()],
      ['products', new Map()],
      ['customers', new Map()],
      ['sales', new Map()],
      ['sale_items', new Map()],
      ['payments', new Map()],
      ['purchases', new Map()],
      ['purchase_items', new Map()],
      ['inventory_movements', new Map()],
      ['expenses', new Map()],
      ['suppliers', new Map()],
      ['sync_events', new Map()],
    ]);

    // Seed demo shop
    this.tables.get('shops')!.set('shop_demo_001', {
      id: 'shop_demo_001',
      name: 'ShopFlow Demo Counter',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed demo user for dev fallback
    this.tables.get('users')!.set('user_demo_001', {
      id: 'user_demo_001',
      shop_id: 'shop_demo_001',
      name: 'Demo Owner',
      phone: '9876543210',
      pin_hash: 'demo_pin_hash',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  getTableData(tableName: string): any[] {
    const table = this.tables.get(tableName);
    return table ? Array.from(table.values()) : [];
  }

  prepare(query: string) {
    const normalized = query.trim().replace(/\s+/g, ' ');
    let boundArgs: any[] = [];

    const stmt = {
      bind: (...args: any[]) => {
        boundArgs = args;
        return stmt;
      },
      first: async <T = any>(): Promise<T | null> => {
        const res = await stmt.all<T>();
        return res.results && res.results.length > 0 ? res.results[0] : null;
      },
      all: async <T = any>(): Promise<{ results: T[]; success: boolean }> => {
        // SELECT 1 (health check)
        if (normalized.toUpperCase().includes('SELECT 1')) {
          return { results: [{ '1': 1 }] as any, success: true };
        }

        // Auth: check phone or login user by phone
        if (normalized.includes('FROM users') && normalized.includes('WHERE') && (normalized.includes('u.phone = ?') || normalized.includes('phone = ?'))) {
          const phone = boundArgs[0];
          const users = Array.from(this.tables.get('users')?.values() || []);
          const user = users.find((u) => u.phone === phone);
          if (!user) return { results: [], success: true };
          const shop = this.tables.get('shops')?.get(user.shop_id);
          return {
            results: [
              {
                id: user.id,
                name: user.name,
                phone: user.phone,
                shop_id: user.shop_id,
                pin_hash: user.pin_hash,
                shop_name: shop?.name || '',
              } as any,
            ],
            success: true,
          };
        }

        // Auth: get user by id AND shop_id (auth middleware)
        if (normalized.includes('FROM users') && normalized.includes('id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const user = this.tables.get('users')?.get(id);
          if (user && user.shop_id === shopId) {
            return { results: [user as any], success: true };
          }
          return { results: [], success: true };
        }

        // Auth: get user by shop_id only (for dev/demo fallback)
        if (normalized.includes('FROM users WHERE shop_id = ?')) {
          const shopId = boundArgs[0];
          const users = Array.from(this.tables.get('users')?.values() || []);
          const user = users.find((u) => u.shop_id === shopId);
          return { results: user ? [user as any] : [], success: true };
        }

        // Auth: get user by ID (for auth middleware)
        if (normalized.includes('FROM users') && normalized.includes('WHERE') && (normalized.includes('u.id = ?') || normalized.includes(' WHERE id = ?'))) {
          const id = boundArgs[0];
          const user = this.tables.get('users')?.get(id);
          if (!user) return { results: [], success: true };
          const shop = this.tables.get('shops')?.get(user.shop_id);
          return {
            results: [
              {
                id: user.id,
                name: user.name,
                phone: user.phone,
                shop_id: user.shop_id,
                shop_name: shop?.name || '',
              } as any,
            ],
            success: true,
          };
        }

        // Auth: check rate limit
        if (normalized.includes('FROM auth_rate_limits WHERE key = ?')) {
          const key = boundArgs[0];
          const row = this.tables.get('auth_rate_limits')?.get(key);
          return { results: row ? [row as any] : [], success: true };
        }

        // Auth: session verification by token_hash
        if (normalized.includes('FROM sessions') && normalized.includes('token_hash = ?')) {
          const tokenHash = boundArgs[0];
          const nowStr = boundArgs[1] || new Date().toISOString();
          const sessions = Array.from(this.tables.get('sessions')?.values() || []);
          const session = sessions.find((s) => s.token_hash === tokenHash && s.expires_at > nowStr);
          if (!session) return { results: [], success: true };
          const user = this.tables.get('users')?.get(session.user_id);
          const shop = this.tables.get('shops')?.get(session.shop_id);
          return {
            results: [
              {
                id: session.id,
                user_id: session.user_id,
                shop_id: session.shop_id,
                device_id: session.device_id,
                user_name: user?.name,
                user_phone: user?.phone,
                shop_name: shop?.name,
              } as any,
            ],
            success: true,
          };
        }


        // SELECT FROM shops WHERE id = ?
        if (normalized.includes('FROM shops WHERE id = ?') || normalized.startsWith('SELECT id FROM shops') || normalized.startsWith('SELECT id, name FROM shops')) {
          const shopId = boundArgs[0];
          const shop = this.tables.get('shops')?.get(shopId);
          return { results: shop ? [shop as any] : [], success: true };
        }

        // SELECT FROM sync_events WHERE id = ? AND shop_id = ?
        if (normalized.includes('FROM sync_events WHERE id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const ev = this.tables.get('sync_events')?.get(`${shopId}_${id}`);
          return { results: ev ? [ev as any] : [], success: true };
        }

        // SELECT FROM sales WHERE id = ? AND shop_id = ?
        if (normalized.includes('FROM sales WHERE id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const item = this.tables.get('sales')?.get(`${shopId}_${id}`);
          return { results: item ? [item as any] : [], success: true };
        }

        // SELECT FROM sale_items WHERE id = ? AND shop_id = ?
        if (normalized.includes('FROM sale_items WHERE id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const item = this.tables.get('sale_items')?.get(`${shopId}_${id}`);
          return { results: item ? [item as any] : [], success: true };
        }

        // SELECT FROM payments WHERE id = ? AND shop_id = ?
        if (normalized.includes('FROM payments WHERE id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const item = this.tables.get('payments')?.get(`${shopId}_${id}`);
          return { results: item ? [item as any] : [], success: true };
        }

        // SELECT FROM inventory_movements WHERE id = ? AND shop_id = ?
        if (normalized.includes('FROM inventory_movements WHERE id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const item = this.tables.get('inventory_movements')?.get(`${shopId}_${id}`);
          return { results: item ? [item as any] : [], success: true };
        }

        // SELECT FROM expenses WHERE id = ? AND shop_id = ?
        if (normalized.includes('FROM expenses WHERE id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const item = this.tables.get('expenses')?.get(`${shopId}_${id}`);
          return { results: item ? [item as any] : [], success: true };
        }

        // SELECT FROM customers WHERE id = ? AND shop_id = ?
        if (normalized.includes('FROM customers WHERE id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const item = this.tables.get('customers')?.get(`${shopId}_${id}`);
          return { results: item ? [item as any] : [], success: true };
        }

        // SELECT FROM products WHERE id = ? AND shop_id = ?
        if (normalized.includes('FROM products WHERE id = ? AND shop_id = ?')) {
          const [id, shopId] = boundArgs;
          const item = this.tables.get('products')?.get(`${shopId}_${id}`);
          return { results: item ? [item as any] : [], success: true };
        }

        // General SELECT * FROM <table> WHERE shop_id = ?
        const match = normalized.match(/SELECT.*?FROM\s+(\w+)\s+WHERE\s+shop_id\s*=\s*\?/i);
        if (match) {
          const tableName = match[1].toLowerCase();
          const shopId = boundArgs[0];
          const table = this.tables.get(tableName);
          if (!table) return { results: [], success: true };
          const items = Array.from(table.values()).filter((it) => it.shop_id === shopId);
          return { results: items as any[], success: true };
        }

        return { results: [], success: true };
      },
      run: async (): Promise<{ success: boolean; meta: any }> => {
        // INSERT INTO shops
        if (normalized.startsWith('INSERT INTO shops')) {
          const [id, name, created_at, updated_at] = boundArgs;
          this.tables.get('shops')?.set(id, { id, name, created_at, updated_at });
          return { success: true, meta: { changes: 1 } };
        }

        // UPDATE shops SET name = ?, updated_at = ? WHERE id = ?
        if (normalized.startsWith('UPDATE shops SET name = ?')) {
          const [name, updated_at, id] = boundArgs;
          const shop = this.tables.get('shops')?.get(id);
          if (shop) {
            shop.name = name;
            shop.updated_at = updated_at;
          }
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO users
        if (normalized.startsWith('INSERT INTO users')) {
          const [id, shop_id, name, phone, pin_hash, created_at, updated_at] = boundArgs;
          this.tables.get('users')?.set(id, { id, shop_id, name, phone, pin_hash, created_at, updated_at });
          return { success: true, meta: { changes: 1 } };
        }

        // UPDATE users SET name = ?, updated_at = ? WHERE id = ?
        if (normalized.startsWith('UPDATE users SET name = ?')) {
          const [name, updated_at, id] = boundArgs;
          const user = this.tables.get('users')?.get(id);
          if (user) {
            user.name = name;
            user.updated_at = updated_at;
          }
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO sessions
        if (normalized.startsWith('INSERT INTO sessions')) {
          const [id, user_id, shop_id, device_id, token_hash, created_at, expires_at] = boundArgs;
          this.tables.get('sessions')?.set(id, { id, user_id, shop_id, device_id, token_hash, created_at, expires_at });
          return { success: true, meta: { changes: 1 } };
        }

        // DELETE FROM sessions
        if (normalized.includes('DELETE FROM sessions')) {
          const target = boundArgs[0];
          const sessions = this.tables.get('sessions');
          if (sessions) {
            for (const [sid, sess] of sessions.entries()) {
              if (sess.token_hash === target || sid === target) {
                sessions.delete(sid);
              }
            }
          }
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO auth_rate_limits
        if (normalized.startsWith('INSERT INTO auth_rate_limits')) {
          const key = boundArgs[0];
          const first_attempt_at = boundArgs[1];
          const last_attempt_at = boundArgs[2];
          this.tables.get('auth_rate_limits')?.set(key, {
            key,
            attempts: 1,
            first_attempt_at,
            last_attempt_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        // UPDATE auth_rate_limits
        if (normalized.startsWith('UPDATE auth_rate_limits')) {
          const [last_attempt_at, key] = boundArgs;
          const r = this.tables.get('auth_rate_limits')?.get(key);
          if (r) {
            r.attempts = (r.attempts || 0) + 1;
            r.last_attempt_at = last_attempt_at;
          }
          return { success: true, meta: { changes: 1 } };
        }

        // DELETE FROM auth_rate_limits
        if (normalized.includes('DELETE FROM auth_rate_limits')) {
          const key = boundArgs[0];
          this.tables.get('auth_rate_limits')?.delete(key);
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO sales
        if (normalized.includes('INSERT INTO sales')) {
          const [
            id,
            shop_id,
            sale_number,
            customer_id,
            customer_name,
            payment_status,
            payment_method,
            total,
            item_count,
            notes,
            created_at,
            updated_at,
          ] = boundArgs;
          this.tables.get('sales')?.set(`${shop_id}_${id}`, {
            id,
            shop_id,
            sale_number,
            customer_id,
            customer_name,
            payment_status,
            payment_method,
            total,
            item_count,
            notes,
            created_at,
            updated_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO sale_items
        if (normalized.includes('INSERT INTO sale_items')) {
          const [
            id,
            shop_id,
            sale_id,
            product_id,
            product_name,
            product_emoji,
            quantity,
            selling_price,
            cost_price,
            total_price,
            created_at,
          ] = boundArgs;
          this.tables.get('sale_items')?.set(`${shop_id}_${id}`, {
            id,
            shop_id,
            sale_id,
            product_id,
            product_name,
            product_emoji,
            quantity,
            selling_price,
            cost_price,
            total_price,
            created_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO payments
        if (normalized.includes('INSERT INTO payments')) {
          const [id, shop_id, customer_id, amount, payment_method, note, created_at] = boundArgs;
          this.tables.get('payments')?.set(`${shop_id}_${id}`, {
            id,
            shop_id,
            customer_id,
            amount,
            payment_method,
            note,
            created_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        // UPDATE customers SET balance = balance - ?
        if (normalized.includes('UPDATE customers SET balance = balance - ?')) {
          const [amount, updated_at, customer_id, shop_id] = boundArgs;
          const cust = this.tables.get('customers')?.get(`${shop_id}_${customer_id}`);
          if (cust) {
            cust.balance = (cust.balance || 0) - amount;
            cust.updated_at = updated_at;
          }
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO inventory_movements
        if (normalized.includes('INSERT INTO inventory_movements')) {
          const [
            id,
            shop_id,
            product_id,
            type,
            quantity,
            previous_stock,
            new_stock,
            reason,
            reference_id,
            created_at,
          ] = boundArgs;
          this.tables.get('inventory_movements')?.set(`${shop_id}_${id}`, {
            id,
            shop_id,
            product_id,
            type,
            quantity,
            previous_stock,
            new_stock,
            reason,
            reference_id,
            created_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        // UPDATE products SET stock = ?
        if (normalized.includes('UPDATE products SET stock = ?')) {
          const [stock, updated_at, product_id, shop_id] = boundArgs;
          const prod = this.tables.get('products')?.get(`${shop_id}_${product_id}`);
          if (prod) {
            prod.stock = stock;
            prod.updated_at = updated_at;
          }
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO customers
        if (normalized.includes('INSERT INTO customers')) {
          const [id, shop_id, name, phone, balance, notes, created_at, updated_at] = boundArgs;
          this.tables.get('customers')?.set(`${shop_id}_${id}`, {
            id,
            shop_id,
            name,
            phone,
            balance,
            notes,
            created_at,
            updated_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        // UPDATE customers SET
        if (normalized.includes('UPDATE customers SET')) {
          const [name, phone, balance, notes, updated_at, id, shop_id] = boundArgs;
          const cust = this.tables.get('customers')?.get(`${shop_id}_${id}`);
          if (cust) {
            if (name !== null) cust.name = name;
            if (phone !== null) cust.phone = phone;
            if (balance !== null) cust.balance = balance;
            if (notes !== null) cust.notes = notes;
            cust.updated_at = updated_at;
          }
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO products
        if (normalized.includes('INSERT INTO products')) {
          const [
            id,
            shop_id,
            name,
            emoji,
            selling_price,
            cost_price,
            stock,
            min_stock,
            opening_stock,
            unit,
            category,
            sku,
            barcode,
            active,
            created_at,
            updated_at,
          ] = boundArgs;
          this.tables.get('products')?.set(`${shop_id}_${id}`, {
            id,
            shop_id,
            name,
            emoji,
            selling_price,
            cost_price,
            stock,
            min_stock,
            opening_stock,
            unit,
            category,
            sku,
            barcode,
            active,
            created_at,
            updated_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO expenses
        if (normalized.includes('INSERT INTO expenses')) {
          const [id, shop_id, title, amount, category, note, created_at] = boundArgs;
          this.tables.get('expenses')?.set(`${shop_id}_${id}`, {
            id,
            shop_id,
            title,
            amount,
            category,
            note,
            created_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        // INSERT INTO sync_events
        if (normalized.includes('INSERT INTO sync_events')) {
          const [id, shop_id, entity_type, entity_id, operation, payload, processed_at] = boundArgs;
          this.tables.get('sync_events')?.set(`${shop_id}_${id}`, {
            id,
            shop_id,
            entity_type,
            entity_id,
            operation,
            payload,
            processed_at,
          });
          return { success: true, meta: { changes: 1 } };
        }

        return { success: true, meta: { changes: 1 } };
      },
    };

    return stmt;
  }
}
