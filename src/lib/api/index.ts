import type { SyncQueueItem } from '../../types';

export const DEFAULT_DEMO_SHOP_ID = 'shop_demo_001';

class ApiClient {
  private baseUrl: string;
  private defaultShopId: string;

  constructor() {
    const nodeProcess = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
    const envUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
      nodeProcess?.env?.VITE_API_URL ||
      'https://shopflow-worker.vedant-753.workers.dev';
    this.baseUrl = (envUrl ? String(envUrl).replace(/\/$/, '') : '') + '/api';
    this.defaultShopId =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SHOP_ID) ||
      nodeProcess?.env?.VITE_SHOP_ID ||
      DEFAULT_DEMO_SHOP_ID;
  }

  getShopId(overrideShopId?: string): string {
    if (overrideShopId) return overrideShopId;
    // Check if session has shop ID
    try {
      const session = localStorage.getItem('shopflow_auth_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed?.shop?.id) return parsed.shop.id;
      }
    } catch {
      // fallback
    }
    return this.defaultShopId;
  }

  private getToken(): string | null {
    try {
      const session = localStorage.getItem('shopflow_auth_session');
      if (session) {
        const parsed = JSON.parse(session);
        return parsed?.token || null;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    shopId?: string
  ): Promise<T> {
    const effectiveShopId = this.getShopId(shopId);
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('x-shop-id', effectiveShopId);

    // Inject Bearer token if available
    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Request to ${endpoint} timed out after 12s`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorMessage = `API error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson && (errorJson.error || errorJson.message)) {
          errorMessage = errorJson.message || errorJson.error;
        }
      } catch {
        // use fallback
      }
      throw new Error(errorMessage);
    }

    return (await response.json()) as T;
  }

  // -------------------------------------------------------------
  // Authentication Endpoints (Section 8, 9, 10, 11)
  // -------------------------------------------------------------
  async checkPhone(phone: string): Promise<{ exists: boolean; shopName?: string; ownerName?: string }> {
    return this.request('/auth/check-phone', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async register(params: {
    phone: string;
    name: string;
    shopName: string;
    pin: string;
    deviceId: string;
  }): Promise<{
    token: string;
    refreshToken: string;
    user: { id: string; name: string; phone: string; shop_id: string };
    shop: { id: string; name: string };
  }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async login(params: {
    phone: string;
    pin: string;
    deviceId: string;
  }): Promise<{
    token: string;
    refreshToken: string;
    user: { id: string; name: string; phone: string; shop_id: string };
    shop: { id: string; name: string };
  }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getMe(): Promise<{ user: any; shop: any }> {
    return this.request('/auth/me');
  }

  async logout(refreshToken?: string): Promise<{ success: boolean }> {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async updateShopProfile(params: { shopName?: string; ownerName?: string }): Promise<{ user: any; shop: any }> {
    return this.request('/auth/shop-profile', {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  async getSessions(): Promise<{
    sessions: Array<{
      id: string;
      deviceId: string;
      deviceName?: string | null;
      createdAt: string;
      expiresAt: string;
      isCurrent: boolean;
    }>;
  }> {
    return this.request('/auth/sessions');
  }

  async terminateSession(sessionId: string): Promise<{ success: boolean; message?: string }> {
    return this.request('/auth/sessions/terminate', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async terminateAllOtherSessions(): Promise<{ success: boolean; message?: string; terminatedCount?: number }> {
    return this.request('/auth/sessions/terminate-all-others', {
      method: 'POST',
    });
  }

  // -------------------------------------------------------------
  // Health & Core Sync Endpoints
  // -------------------------------------------------------------
  async health(): Promise<{ status: string; timestamp: string; database?: string }> {
    return this.request('/health');
  }

  async sync(
    events: SyncQueueItem[],
    shopId?: string
  ): Promise<{
    shopId: string;
    successful: string[];
    failed: Array<{ id: string; error: string }>;
    processedCount: number;
    timestamp: string;
  }> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request(
      '/sync',
      {
        method: 'POST',
        body: JSON.stringify({
          shopId: effectiveShopId,
          events: events.map((ev) => ({
            id: ev.id,
            entity: ev.entity,
            entityId: ev.entityId,
            operation: ev.operation,
            payload: ev.payload,
            createdAt: ev.createdAt,
          })),
        }),
      },
      effectiveShopId
    );
  }

  async bootstrap(shopId?: string): Promise<{
    shop: any;
    categories?: any[];
    brands?: any[];
    products: any[];
    customers: any[];
    sales: any[];
    saleItems: any[];
    payments: any[];
    purchases: any[];
    purchaseItems: any[];
    inventoryMovements: any[];
    expenses: any[];
    suppliers: any[];
  }> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request(`/bootstrap?shopId=${encodeURIComponent(effectiveShopId)}`, {}, effectiveShopId);
  }

  async getCategories(shopId?: string): Promise<any[]> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request('/categories', {}, effectiveShopId);
  }

  async createCategory(data: any, shopId?: string): Promise<any> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }, effectiveShopId);
  }

  async updateCategory(id: string, updates: any, shopId?: string): Promise<any> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request(`/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }, effectiveShopId);
  }

  async getBrands(categoryId?: string, shopId?: string): Promise<any[]> {
    const effectiveShopId = this.getShopId(shopId);
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
    return this.request(`/brands${query}`, {}, effectiveShopId);
  }

  async createBrand(data: any, shopId?: string): Promise<any> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request('/brands', {
      method: 'POST',
      body: JSON.stringify(data),
    }, effectiveShopId);
  }

  async updateBrand(id: string, updates: any, shopId?: string): Promise<any> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request(`/brands/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }, effectiveShopId);
  }

  async getProducts(shopId?: string): Promise<any[]> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request(`/shop/${encodeURIComponent(effectiveShopId)}/products`, {}, effectiveShopId);
  }

  async getCustomers(shopId?: string): Promise<any[]> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request(`/shop/${encodeURIComponent(effectiveShopId)}/customers`, {}, effectiveShopId);
  }

  async getSales(shopId?: string, limit = 100): Promise<any[]> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request(
      `/shop/${encodeURIComponent(effectiveShopId)}/sales?limit=${limit}`,
      {},
      effectiveShopId
    );
  }

  async getInventory(shopId?: string): Promise<{ products: any[]; recentMovements: any[] }> {
    const effectiveShopId = this.getShopId(shopId);
    return this.request(`/shop/${encodeURIComponent(effectiveShopId)}/inventory`, {}, effectiveShopId);
  }

  async getReports(shopId?: string, startDate?: string, endDate?: string): Promise<any> {
    const effectiveShopId = this.getShopId(shopId);
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/shop/${encodeURIComponent(effectiveShopId)}/reports${qs}`, {}, effectiveShopId);
  }
}

export const api = new ApiClient();
