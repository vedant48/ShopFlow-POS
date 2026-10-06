/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  DEMO_SHOP_ID?: string;
  DEMO_SHOP_NAME?: string;
  JWT_SECRET?: string;
}

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncEventPayload {
  id: string; // sync queue id
  entity: string; // 'sales', 'saleItems', 'products', 'customers', etc.
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, any>;
  createdAt: string;
}

export interface SyncRequest {
  shopId: string;
  events: SyncEventPayload[];
}

export interface SyncResult {
  successful: string[];
  failed: Array<{ id: string; error: string }>;
}

export interface ShopRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  pin_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  shop_id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface BrandRow {
  id: string;
  shop_id: string;
  category_id: string;
  name: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  shop_id: string;
  name: string;
  emoji: string | null;
  selling_price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  opening_stock: number;
  unit: string;
  category: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  sku: string | null;
  barcode: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleRow {
  id: string;
  shop_id: string;
  sale_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  payment_status: string;
  payment_method: string | null;
  total: number;
  item_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItemRow {
  id: string;
  shop_id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_emoji: string | null;
  quantity: number;
  selling_price: number;
  cost_price: number;
  total_price: number;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  shop_id: string;
  customer_id: string;
  amount: number;
  payment_method: string | null;
  note: string | null;
  created_at: string;
}

export interface InventoryMovementRow {
  id: string;
  shop_id: string;
  product_id: string;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  shop_id: string;
  title: string;
  amount: number;
  category: string;
  note: string | null;
  created_at: string;
}

export interface SupplierRow {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRow {
  id: string;
  shop_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_cost: number;
  total: number;
  note: string | null;
  created_at: string;
}

export interface BootstrapResponse {
  shop: ShopRow;
  categories: CategoryRow[];
  brands: BrandRow[];
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
}
