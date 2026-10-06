import type { Env } from './types';
import { handleCors, withCors } from './middleware/cors';
import { handleHealth } from './routes/health';
import { handleSync } from './routes/sync';
import { handleBootstrap } from './routes/bootstrap';
import { handleCategoryAndBrandRoutes } from './routes/categories';
import { handleShopRoutes } from './routes/shops';
import { handleAuthRoutes } from './routes/auth';

export default {
  async fetch(request: Request, env: Env, _ctx?: any): Promise<Response> {
    // 1. Handle CORS preflight
    const corsPreflight = handleCors(request);
    if (corsPreflight) {
      return corsPreflight;
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      let response: Response;

      // 2. Health check
      if (path === '/api/health' || path === '/health') {
        response = await handleHealth(request, env);
      }
      // 3. Authentication Routes (Section 8)
      else if (path.startsWith('/api/auth/')) {
        const authResponse = await handleAuthRoutes(request, env, path);
        if (authResponse) {
          response = authResponse;
        } else {
          response = new Response(
            JSON.stringify({ error: 'Not Found', message: 'Authentication route not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      // 4. Batch Sync
      else if (path === '/api/sync') {
        response = await handleSync(request, env);
      }
      // 5. Initial Bootstrap
      else if (path === '/api/bootstrap') {
        response = await handleBootstrap(request, env);
      }
      // 6. Categories & Brands
      else if (path.startsWith('/api/categories') || path.startsWith('/api/brands')) {
        const catResponse = await handleCategoryAndBrandRoutes(request, env, path);
        if (catResponse) {
          response = catResponse;
        } else {
          response = new Response(
            JSON.stringify({ error: 'Not Found', message: 'Category or Brand route not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      // 7. Shop Sub-resources
      else {
        const shopResponse = await handleShopRoutes(request, env, path);
        if (shopResponse) {
          response = shopResponse;
        } else {
          response = new Response(
            JSON.stringify({
              error: 'Not Found',
              path,
              message: 'Route does not exist in ShopFlow Worker API',
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // 7. Return response with CORS headers
      return withCors(response);
    } catch (err: any) {
      console.error('Unhandled Worker error:', err);
      const errorResponse = new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: err?.message || 'An unexpected error occurred',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return withCors(errorResponse);
    }
  },
};
