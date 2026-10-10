export interface BaseRecord {
  id: string;
  shopId?: string;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

export interface Category extends BaseRecord {
  name: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Brand extends BaseRecord {
  categoryId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export type ProductCategory =
  | 'Cigarettes'
  | 'Cold Drinks'
  | 'Snacks'
  | 'Chocolates'
  | 'Water'
  | 'Other';

export interface PriceVariant {
  id: string;
  name: string; // e.g. "Selling Price", "MRP", "Wholesale", "Pack of 10"
  price: number; // in INR ₹ (rate this variant sells at)
  sellingPrice?: number; // alias for backwards compatibility
  costPrice?: number; // in INR ₹
  isDefault?: boolean;
  type?: 'selling_price' | 'mrp' | 'custom';
}

export interface Product extends BaseRecord {
  name: string;
  emoji?: string;
  sellingPrice: number; // in INR ₹
  costPrice: number; // in INR ₹
  mrp?: number; // Maximum Retail Price in INR ₹
  priceVariants?: PriceVariant[]; // Price variants list (always includes default base variant)
  sortOrder?: number; // Custom sorting order within category / shop
  stock: number;
  minStock: number;
  openingStock?: number;
  category?: ProductCategory | string;
  categoryId?: string | null;
  brandId?: string | null;
  sku?: string;
  barcode?: string;
  active: boolean; // true = active, false = archived
  isFavorite?: boolean; // Section 2: mark/unmark product as favorite/quick item
}

export interface Supplier extends BaseRecord {
  name: string;
  phone?: string;
  notes?: string;
}

export interface Purchase extends BaseRecord {
  productId: string;
  productName: string;
  quantity: number; // Positive quantity purchased
  unitCost: number; // Cost price per unit
  totalCost: number; // quantity * unitCost
  supplierId?: string;
  supplierName?: string;
  note?: string;
}

export interface Customer extends BaseRecord {
  name: string;
  phone?: string;
  balance: number; // Current outstanding udhaar amount in INR ₹ (Positive = customer owes money)
  notes?: string;
}

export type PaymentStatus = 'PAID' | 'UDHAAR';
export type PaymentMethod = 'CASH' | 'UPI' | 'NONE' | 'UDHAAR';

export interface Sale extends BaseRecord {
  saleNumber: string; // e.g. #1001
  customerId?: string; // null for paid sales, customer's ID for udhaar sales
  customerName?: string;
  totalAmount: number; // total amount in INR ₹
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  itemCount: number;
  notes?: string;
}

export interface SaleItem extends BaseRecord {
  saleId: string;
  productId: string;
  productName: string;
  productEmoji: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  sellingPrice?: number; // Preserved selling price at the time of sale
  totalPrice: number;
  unitCost: number;
  costPrice?: number; // Preserved cost price at the time of sale for permanent profit integrity
}

export type ExpenseCategory =
  | 'Tea/Food'
  | 'Transport'
  | 'Electricity'
  | 'Rent'
  | 'Other';

export interface Expense extends BaseRecord {
  amount: number; // Amount spent in INR ₹
  category: ExpenseCategory | string;
  note?: string;
}

export interface Payment extends BaseRecord {
  customerId: string;
  amount: number; // Amount paid towards outstanding balance in INR ₹
  note?: string;
  paymentMethod?: PaymentMethod;
}

export type MovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN';

export interface InventoryMovement extends BaseRecord {
  productId: string;
  type: MovementType;
  quantity: number; // SALE: negative, PURCHASE: positive, ADJUSTMENT: +/-, RETURN: positive
  previousStock: number;
  newStock: number;
  referenceId?: string; // saleId, purchaseId, auditId, etc.
  note?: string;
  // Aliases for backwards compatibility with earlier steps
  quantityChange?: number;
  notes?: string;
}

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CANCELLED';

export interface SyncQueueItem extends BaseRecord {
  entity:
    | 'categories'
    | 'brands'
    | 'products'
    | 'customers'
    | 'sales'
    | 'saleItems'
    | 'inventoryMovements'
    | 'payments'
    | 'purchases'
    | 'suppliers'
    | 'expenses'
    | 'openOrders'
    | 'openOrderItems';
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  lastAttemptAt?: string;
  errorMessage?: string;
}

// Open Orders / Held Sales / Customer Timeline Models (Step 11)
export type OpenOrderStatus = 'OPEN' | 'CHECKED_OUT' | 'CANCELLED';

export interface OpenOrder extends BaseRecord {
  customerId?: string | null;
  temporaryCustomerName?: string | null;
  status: OpenOrderStatus;
  totalAmount: number;
  itemCount: number;
  note?: string | null;
  saleId?: string | null;
  lastActivityAt: string;
  createdById?: string;
}

export interface OpenOrderItem extends BaseRecord {
  openOrderId: string;
  productId: string;
  productName: string;
  productEmoji?: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number; // Captured selling price when item was added
  totalPrice: number; // quantity * unitPrice
}

// In-cart item state for Quick Sale tray
export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: PriceVariant; // Specific price variant chosen for this cart entry
}

// Unified Ledger Item for Customer Details History
export interface CustomerLedgerEntry {
  id: string;
  type: 'UDHAAR_SALE' | 'PAYMENT';
  date: string;
  title: string; // "Coke × 2, Cigarette × 1" or "Payment received"
  amount: number; // amount of this transaction in INR ₹
  isCredit: boolean; // true for +₹X (sale), false for -₹X (payment)
  referenceId: string;
}

