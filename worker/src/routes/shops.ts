import type { Env } from '../types';
import { authenticateRequest } from '../middleware/auth';
import {
  getShop,
  getProducts,
  getCustomers,
  getSales,
  getInventory,
} from '../services/shopService';
import { getShopReports } from '../services/reportService';

export async function handleShopRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response | null> {
  // Pattern: /api/shop/:shopId(/...) or /api/shops/:shopId(/...)
  const match = path.match(/^\/api\/shops?\/([^/]+)(\/(products|customers|sales|inventory|reports))?$/);
  if (!match) return null;

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authenticate user
  const { auth, errorResponse } = await authenticateRequest(request, env);
  if (errorResponse) return errorResponse;

  const requestedShopId = decodeURIComponent(match[1]);
  const subresource = match[3] || '';

  // Section 7: Enforce strict shop isolation - user cannot access another shop's data
  if (requestedShopId !== auth!.shop.id) {
    return new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Access denied: You do not have permission to access another shop data.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const shopId = auth!.shop.id;
  const url = new URL(request.url);

  switch (subresource) {
    case '': {
      const shop = await getShop(env.DB, shopId);
      return new Response(JSON.stringify(shop), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    case 'products': {
      const products = await getProducts(env.DB, shopId);
      return new Response(JSON.stringify(products), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    case 'customers': {
      const customers = await getCustomers(env.DB, shopId);
      return new Response(JSON.stringify(customers), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    case 'sales': {
      const limit = Number(url.searchParams.get('limit') || 100);
      const sales = await getSales(env.DB, shopId, limit);
      return new Response(JSON.stringify(sales), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    case 'inventory': {
      const inventory = await getInventory(env.DB, shopId);
      return new Response(JSON.stringify(inventory), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    case 'reports': {
      const startDate = url.searchParams.get('startDate') || undefined;
      const endDate = url.searchParams.get('endDate') || undefined;
      const reports = await getShopReports(env.DB, shopId, startDate, endDate);
      return new Response(JSON.stringify(reports), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    default:
      return null;
  }
}
