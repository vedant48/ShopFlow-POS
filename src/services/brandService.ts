import { db } from '../db';
import type { Brand } from '../types';
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

export const brandService = {
  async getBrands(options?: {
    categoryId?: string;
    activeOnly?: boolean;
    shopId?: string;
  }): Promise<Brand[]> {
    const shopId = getCurrentShopId(options?.shopId);
    const activeOnly = options?.activeOnly !== false;

    const brands = await db.brands
      .filter((b) => {
        const matchesShop = (b.shopId || 'shop_demo_001') === shopId;
        if (!matchesShop) return false;
        if (options?.categoryId && b.categoryId !== options.categoryId) return false;
        if (activeOnly) return b.isActive !== false;
        return true;
      })
      .toArray();

    return brands.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  },

  async getBrandById(id: string): Promise<Brand | undefined> {
    return await db.brands.get(id);
  },

  async createBrand(
    data: {
      categoryId: string;
      name: string;
      sortOrder?: number;
    },
    shopIdParam?: string
  ): Promise<Brand> {
    const shopId = getCurrentShopId(shopIdParam);
    const now = new Date().toISOString();
    const id = generateId('br');

    // Default sortOrder to highest + 1 in category if not specified
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const existing = await this.getBrands({ categoryId: data.categoryId, activeOnly: false, shopId });
      sortOrder = existing.length > 0 ? Math.max(...existing.map((b) => b.sortOrder || 0)) + 1 : 1;
    }

    const brand: Brand = {
      id,
      shopId,
      categoryId: data.categoryId,
      name: data.name.trim(),
      sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.brands.add(brand);

    await syncService.enqueue(
      'brands',
      brand.id,
      'CREATE',
      brand as unknown as Record<string, unknown>,
      shopId
    );

    return brand;
  },

  async updateBrand(
    id: string,
    updates: Partial<Brand>
  ): Promise<Brand> {
    const existing = await db.brands.get(id);
    if (!existing) {
      throw new Error(`Brand ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated: Brand = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    await db.brands.put(updated);

    await syncService.enqueue(
      'brands',
      id,
      'UPDATE',
      updated as unknown as Record<string, unknown>,
      existing.shopId
    );

    return updated;
  },

  async archiveBrand(id: string): Promise<void> {
    await this.updateBrand(id, { isActive: false });
  },

  async restoreBrand(id: string): Promise<void> {
    await this.updateBrand(id, { isActive: true });
  },

  async reorderBrands(orderedIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const existing = await db.brands.get(id);
      if (existing) {
        const updated = { ...existing, sortOrder: i + 1, updatedAt: now };
        await db.brands.put(updated);
        await syncService.enqueue(
          'brands',
          id,
          'UPDATE',
          updated as unknown as Record<string, unknown>,
          existing.shopId
        );
      }
    }
  },
};
