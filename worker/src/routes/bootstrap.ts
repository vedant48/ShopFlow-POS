import type { Env } from '../types';
import { authenticateRequest } from '../middleware/auth';
import { getBootstrapData } from '../services/shopService';

export async function handleBootstrap(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Derive shop identity strictly from authenticated user/session (Section 7, 14, 26)
  const { auth, errorResponse } = await authenticateRequest(request, env);
  if (errorResponse) return errorResponse;

  const shopId = auth!.shop.id;
  const data = await getBootstrapData(env.DB, shopId);

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
