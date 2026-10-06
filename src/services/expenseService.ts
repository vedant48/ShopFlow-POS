import { db } from '../db';
import type { Expense, ExpenseCategory } from '../types';
import { generateId } from '../lib/utils';
import { syncService } from './syncService';

export interface CreateExpenseInput {
  amount: number;
  category: ExpenseCategory | string;
  note?: string;
}

export const expenseService = {
  async addExpense(input: CreateExpenseInput): Promise<Expense> {
    if (input.amount <= 0) {
      throw new Error('Expense amount must be greater than 0');
    }

    const now = new Date().toISOString();
    const id = generateId('exp');
    const shopId =
      (input as any).shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');

    const expense: Expense = {
      id,
      shopId,
      amount: Math.round(input.amount),
      category: input.category,
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.expenses, db.syncQueue], async () => {
      await db.expenses.add(expense);
      await syncService.enqueue(
        'expenses',
        expense.id,
        'CREATE',
        expense as unknown as Record<string, unknown>,
        shopId
      );
    });

    return expense;
  },

  async getTodayExpenses(shopId?: string): Promise<Expense[]> {
    const targetShopId =
      shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    return await db.expenses
      .filter((e) => e.createdAt >= todayIso && (e.shopId || 'shop_demo_001') === targetShopId)
      .reverse()
      .sortBy('createdAt');
  },

  async getDateRangeExpenses(startDate: string, endDate: string, shopId?: string): Promise<Expense[]> {
    const targetShopId =
      shopId ||
      (typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem('shopflow_auth_session') || '{}')?.shop?.id || 'shop_demo_001'
        : 'shop_demo_001');

    return await db.expenses
      .filter(
        (e) =>
          e.createdAt >= startDate &&
          e.createdAt <= endDate &&
          (e.shopId || 'shop_demo_001') === targetShopId
      )
      .reverse()
      .sortBy('createdAt');
  },

  async getAllExpenses(): Promise<Expense[]> {
    return await db.expenses.reverse().sortBy('createdAt');
  },

  async deleteExpense(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.transaction('rw', [db.expenses, db.syncQueue], async () => {
      await db.expenses.delete(id);
      await syncService.enqueue('expenses', id, 'DELETE', {
        expenseId: id,
        deletedAt: now,
      });
    });
  },
};
