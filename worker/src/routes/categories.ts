import type { Env } from '../types';
import { authenticateRequest } from '../middleware/auth';
import {
  getCategories,
  createCategory,
  updateCategory,
  getBrands,
  createBrand,
  updateBrand,
} from '../services/categoryBrandService';

export async function handleCategoryAndBrandRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response | null> {
  const method = request.method;

  // 1. Categories endpoints
  // GET /api/categories
  // POST /api/categories
  if (path === '/api/categories') {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    const shopId = auth!.shop.id;

    if (method === 'GET') {
      const url = new URL(request.url);
      const includeInactive = url.searchParams.get('includeInactive') === 'true';
      const categories = await getCategories(env.DB, shopId, includeInactive);
      return new Response(JSON.stringify(categories), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Category name is required' }), { status: 400 });
      }

      const created = await createCategory(env.DB, shopId, {
        id: body.id,
        name: body.name.trim(),
        icon: body.icon,
        sortOrder: body.sortOrder,
      });

      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // PATCH /api/categories/:id
  // GET /api/categories/:id/brands
  const categoryMatch = path.match(/^\/api\/categories\/([^/]+)(\/brands)?$/);
  if (categoryMatch) {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    const shopId = auth!.shop.id;
    const categoryId = decodeURIComponent(categoryMatch[1]);
    const isBrandsSubresource = Boolean(categoryMatch[2]);

    if (isBrandsSubresource) {
      if (method === 'GET') {
        const url = new URL(request.url);
        const includeInactive = url.searchParams.get('includeInactive') === 'true';
        const brands = await getBrands(env.DB, shopId, categoryId, includeInactive);
        return new Response(JSON.stringify(brands), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    // PATCH /api/categories/:id
    if (method === 'PATCH' || method === 'PUT') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      const updated = await updateCategory(env.DB, shopId, categoryId, {
        name: body.name,
        icon: body.icon,
        sortOrder: body.sortOrder,
        isActive: body.isActive ?? body.is_active,
      });

      if (!updated) {
        return new Response(JSON.stringify({ error: 'Category not found' }), { status: 404 });
      }

      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // 2. Brands endpoints
  // POST /api/brands
  // GET /api/brands
  if (path === '/api/brands') {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    const shopId = auth!.shop.id;

    if (method === 'GET') {
      const url = new URL(request.url);
      const categoryId = url.searchParams.get('categoryId') || undefined;
      const includeInactive = url.searchParams.get('includeInactive') === 'true';
      const brands = await getBrands(env.DB, shopId, categoryId, includeInactive);
      return new Response(JSON.stringify(brands), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Brand name is required' }), { status: 400 });
      }

      const categoryId = body.categoryId || body.category_id;
      if (!categoryId) {
        return new Response(JSON.stringify({ error: 'Category ID is required for a brand' }), { status: 400 });
      }

      try {
        const created = await createBrand(env.DB, shopId, {
          id: body.id,
          categoryId,
          name: body.name.trim(),
          sortOrder: body.sortOrder,
        });

        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: err?.message || 'Failed to create brand' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // PATCH /api/brands/:id
  const brandMatch = path.match(/^\/api\/brands\/([^/]+)$/);
  if (brandMatch) {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    const shopId = auth!.shop.id;
    const brandId = decodeURIComponent(brandMatch[1]);

    if (method === 'PATCH' || method === 'PUT') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
      }

      const updated = await updateBrand(env.DB, shopId, brandId, {
        name: body.name,
        sortOrder: body.sortOrder,
        isActive: body.isActive ?? body.is_active,
      });

      if (!updated) {
        return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 });
      }

      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  return null;
}
