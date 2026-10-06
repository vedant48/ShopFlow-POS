import { db } from '../db';
import type { Category } from '../types';
import { generateId } from '../lib/utils';
import { syncService } from './syncService';

function getCurrentShopId(explicitShopId?: string): string {
  if (explicitShopId) return explicitShopId;
  if (typeof localStorage !== 'undefined') {
    try {
      const session = JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}');
      if (session?.shop?.id) return session.shop.id;
    } catch {
      // ignore
    }
  }
  return 'shop_demo_001';
}

export const categoryService = {
  async getAllCategories(options?: {
    activeOnly?: boolean;
    shopId?: string;
  }): Promise<Category[]> {
    const shopId = getCurrentShopId(options?.shopId);
    const activeOnly = options?.activeOnly !== false; // default true

    const cats = await db.categories
      .filter((c) => {
        const matchesShop = (c.shopId || 'shop_demo_001') === shopId;
        if (!matchesShop) return false;
        if (activeOnly) return c.isActive !== false;
        return true;
      })
      .toArray();

    return cats.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  },

  async getCategoryById(id: string): Promise<Category | undefined> {
    return await db.categories.get(id);
  },

  async createCategory(
    data: {
      name: string;
      icon?: string;
      sortOrder?: number;
    },
    shopIdParam?: string
  ): Promise<Category> {
    const shopId = getCurrentShopId(shopIdParam);
    const now = new Date().toISOString();
    const id = generateId('cat');

    // Default sortOrder to highest + 1 if not specified
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const existing = await this.getAllCategories({ activeOnly: false, shopId });
      sortOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder || 0)) + 1 : 1;
    }

    const category: Category = {
      id,
      shopId,
      name: data.name.trim(),
      icon: data.icon || 'package',
      sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.categories.add(category);

    await syncService.enqueue(
      'categories',
      category.id,
      'CREATE',
      category as unknown as Record<string, unknown>,
      shopId
    );

    return category;
  },

  async updateCategory(
    id: string,
    updates: Partial<Category>
  ): Promise<Category> {
    const existing = await db.categories.get(id);
    if (!existing) {
      throw new Error(`Category ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated: Category = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    await db.categories.put(updated);

    await syncService.enqueue(
      'categories',
      id,
      'UPDATE',
      updated as unknown as Record<string, unknown>,
      existing.shopId
    );

    return updated;
  },

  async archiveCategory(id: string): Promise<void> {
    await this.updateCategory(id, { isActive: false });
  },

  async restoreCategory(id: string): Promise<void> {
    await this.updateCategory(id, { isActive: true });
  },

  async reorderCategories(orderedIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const existing = await db.categories.get(id);
      if (existing) {
        const updated = { ...existing, sortOrder: i + 1, updatedAt: now };
        await db.categories.put(updated);
        await syncService.enqueue(
          'categories',
          id,
          'UPDATE',
          updated as unknown as Record<string, unknown>,
          existing.shopId
        );
      }
    }
  },
};
