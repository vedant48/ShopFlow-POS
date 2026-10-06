import { db } from '../db';
import type { Customer, Payment, CustomerLedgerEntry, PaymentMethod } from '../types';
import { generateId } from '../lib/utils';
import { syncService } from './syncService';

export const customerService = {
  async getAllCustomers(shopId?: string): Promise<Customer[]> {
    const targetShopId =
      shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');
    return await db.customers.filter((c) => (c.shopId || 'shop_demo_001') === targetShopId).toArray();
  },

  async getCustomerById(id: string): Promise<Customer | undefined> {
    return await db.customers.get(id);
  },

  async addCustomer(
    customerData: {
      name: string;
      phone?: string;
      balance?: number;
      notes?: string;
      shopId?: string;
    }
  ): Promise<Customer> {
    const now = new Date().toISOString();
    const id = generateId('cust');
    const shopId =
      customerData.shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');

    const newCustomer: Customer = {
      id,
      shopId,
      name: customerData.name.trim(),
      phone: customerData.phone?.trim() || undefined,
      balance: customerData.balance ?? 0,
      notes: customerData.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.customers.add(newCustomer);
    await syncService.enqueue('customers', id, 'CREATE', newCustomer as unknown as Record<string, unknown>, shopId);
    return newCustomer;
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
    const now = new Date().toISOString();
    const updatedData = { ...updates, updatedAt: now };

    await db.customers.update(id, updatedData);
    await syncService.enqueue('customers', id, 'UPDATE', updatedData as Record<string, unknown>);
  },

  /**
   * Records a payment against customer's balance:
   * 1. Creates a Payment record in the payments table.
   * 2. Reduces the customer's balance.
   * 3. Creates syncQueue events.
   * Executed atomically in a Dexie transaction.
   */
  async recordPayment(
    customerId: string,
    amount: number,
    note?: string,
    paymentMethod: PaymentMethod = 'CASH'
  ): Promise<{ customer: Customer; payment: Payment }> {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    return await db.transaction('rw', [db.customers, db.payments, db.syncQueue], async () => {
      const customer = await db.customers.get(customerId);
      if (!customer) throw new Error(`Customer ${customerId} not found`);

      const now = new Date().toISOString();
      const currentBalance = customer.balance ?? 0;
      const newBalance = Math.max(0, currentBalance - amount);

      // 1. Create payment record
      const paymentId = generateId('pay');
      const payment: Payment = {
        id: paymentId,
        customerId,
        amount,
        note: note?.trim() || undefined,
        paymentMethod,
        createdAt: now,
        updatedAt: now,
      };
      await db.payments.add(payment);
      await syncService.enqueue('payments', paymentId, 'CREATE', payment as unknown as Record<string, unknown>);

      // 2. Update customer balance
      await db.customers.update(customerId, {
        balance: newBalance,
        updatedAt: now,
      });

      await syncService.enqueue('customers', customerId, 'UPDATE', {
        action: 'PAYMENT_RECEIVED',
        paymentId,
        amountPaid: amount,
        previousBalance: currentBalance,
        newBalance,
        note,
        updatedAt: now,
      });

      const updatedCustomer: Customer = {
        ...customer,
        balance: newBalance,
        updatedAt: now,
      };

      return { customer: updatedCustomer, payment };
    });
  },

  /**
   * Source of Truth Balance Calculation:
   * Total Udhaar sales - Total payments received = Outstanding balance
   */
  async getCustomerBalance(customerId: string): Promise<number> {
    const udhaarSales = await db.sales
      .where('customerId')
      .equals(customerId)
      .filter((s) => s.paymentStatus === 'UDHAAR')
      .toArray();

    const totalUdhaarSales = udhaarSales.reduce((sum, s) => sum + s.totalAmount, 0);

    const payments = await db.payments
      .where('customerId')
      .equals(customerId)
      .toArray();

    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    return Math.max(0, totalUdhaarSales - totalPayments);
  },

  /**
   * Generates a unified chronological transaction history for a customer:
   * - Udhaar sales (with item summary like "Coke × 2, Cigarette × 1")
   * - Payments received (with note and "-₹X")
   */
  async getCustomerHistory(customerId: string): Promise<CustomerLedgerEntry[]> {
    const udhaarSales = await db.sales
      .where('customerId')
      .equals(customerId)
      .filter((s) => s.paymentStatus === 'UDHAAR')
      .toArray();

    const payments = await db.payments
      .where('customerId')
      .equals(customerId)
      .toArray();

    const entries: CustomerLedgerEntry[] = [];

    // Format Udhaar sales
    for (const sale of udhaarSales) {
      const items = await db.saleItems.where('saleId').equals(sale.id).toArray();
      const itemsTitle =
        items.length > 0
          ? items.map((i) => `${i.productName} × ${i.quantity}`).join(', ')
          : `Sale ${sale.saleNumber}`;

      entries.push({
        id: `sale_${sale.id}`,
        type: 'UDHAAR_SALE',
        date: sale.createdAt,
        title: itemsTitle,
        amount: sale.totalAmount,
        isCredit: true, // +₹X
        referenceId: sale.id,
      });
    }

    // Format Payments
    for (const payment of payments) {
      entries.push({
        id: `pay_${payment.id}`,
        type: 'PAYMENT',
        date: payment.createdAt,
        title: payment.note ? `Payment: ${payment.note}` : 'Payment received',
        amount: payment.amount,
        isCredit: false, // -₹X
        referenceId: payment.id,
      });
    }

    // Sort newest first
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async deleteCustomer(id: string): Promise<void> {
    await db.customers.delete(id);
    await syncService.enqueue('customers', id, 'DELETE', { id });
  },
};
