import type { Env, SyncRequest } from '../types';
import { authenticateRequest } from '../middleware/auth';
import { processSyncEvents } from '../services/syncProcessor';

export async function handleSync(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Derive shop identity strictly from authenticated user/session (Section 7, 21, 26)
  const { auth, errorResponse } = await authenticateRequest(request, env);
  if (errorResponse) return errorResponse;

  const authenticatedShopId = auth!.shop.id;

  let body: SyncRequest;
  try {
    body = (await request.json()) as SyncRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body || !Array.isArray(body.events)) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid "events" array in request body' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Section 22: Validate that all events belong to the authenticated user's shop
  const validEvents: typeof body.events = [];
  const rejectedFailures: Array<{ id: string; error: string }> = [];

  for (const ev of body.events) {
    if (ev.payload?.shopId && ev.payload.shopId !== authenticatedShopId) {
      rejectedFailures.push({
        id: ev.id,
        error: `Cross-shop security violation: event shopId (${ev.payload.shopId}) does not match authenticated shop (${authenticatedShopId})`,
      });
    } else {
      validEvents.push(ev);
    }
  }

  const result = await processSyncEvents(env.DB, authenticatedShopId, validEvents);

  return new Response(
    JSON.stringify({
      shopId: authenticatedShopId,
      successful: result.successful,
      failed: [...rejectedFailures, ...result.failed],
      processedCount: result.successful.length + result.failed.length + rejectedFailures.length,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
