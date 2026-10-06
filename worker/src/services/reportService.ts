export async function getShopReports(
  db: D1Database,
  shopId: string,
  startDate?: string,
  endDate?: string
) {
  let salesQuery = 'SELECT * FROM sales WHERE shop_id = ?';
  const salesParams: any[] = [shopId];

  if (startDate) {
    salesQuery += ' AND created_at >= ?';
    salesParams.push(startDate);
  }
  if (endDate) {
    salesQuery += ' AND created_at <= ?';
    salesParams.push(endDate);
  }

  let expensesQuery = 'SELECT * FROM expenses WHERE shop_id = ?';
  const expensesParams: any[] = [shopId];
  if (startDate) {
    expensesQuery += ' AND created_at >= ?';
    expensesParams.push(startDate);
  }
  if (endDate) {
    expensesQuery += ' AND created_at <= ?';
    expensesParams.push(endDate);
  }

  const [salesRes, expensesRes] = await Promise.all([
    db.prepare(salesQuery).bind(...salesParams).all(),
    db.prepare(expensesQuery).bind(...expensesParams).all(),
  ]);

  const sales = salesRes.results || [];
  const expenses = expensesRes.results || [];

  let totalRevenue = 0;
  let cashRevenue = 0;
  let upiRevenue = 0;
  let udhaarRevenue = 0;
  let transactionCount = sales.length;
  let itemsSold = 0;

  for (const s of sales as any[]) {
    const total = Number(s.total || 0);
    totalRevenue += total;
    itemsSold += Number(s.item_count || 0);

    if (s.payment_status === 'PAID') {
      if (s.payment_method === 'CASH') cashRevenue += total;
      else if (s.payment_method === 'UPI') upiRevenue += total;
      else cashRevenue += total;
    } else if (s.payment_status === 'UDHAAR') {
      udhaarRevenue += total;
    }
  }

  let totalExpenses = 0;
  for (const e of expenses as any[]) {
    totalExpenses += Number(e.amount || 0);
  }

  return {
    shopId,
    totalRevenue,
    cashRevenue,
    upiRevenue,
    udhaarRevenue,
    transactionCount,
    itemsSold,
    totalExpenses,
    salesCount: sales.length,
    expensesCount: expenses.length,
  };
}
