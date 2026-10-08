import type { Env, SyncRequest } from '../types';
import { authenticateRequest } from '../middleware/auth';
import { processSyncEvents } from '../services/syncProcessor';

export async function handleSync(request: Request, env: Env): Promise<Response> {
  const reqStart = performance.now();
  const requestId = request.headers.get('x-request-id') || `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[Worker ${requestId}] [handleSync] request received at ${new Date().toISOString()}`);

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Derive shop identity strictly from authenticated user/session (Section 7, 21, 26)
  const authStart = performance.now();
  console.log(`[Worker ${requestId}] [handleSync] auth start at 0.00ms`);
  const { auth, errorResponse } = await authenticateRequest(request, env);
  const authEnd = performance.now();
  const authDuration = authEnd - authStart;
  console.log(`[Worker ${requestId}] [handleSync] auth end, took ${authDuration.toFixed(2)}ms`);

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

  const syncEventStart = performance.now();
  console.log(`[Worker ${requestId}] [handleSync] sync events start (${validEvents.length} events) at ${(syncEventStart - reqStart).toFixed(2)}ms`);
  const result = await processSyncEvents(env.DB, authenticatedShopId, validEvents, requestId);
  const syncEventEnd = performance.now();
  const syncDuration = syncEventEnd - syncEventStart;
  console.log(`[Worker ${requestId}] [handleSync] sync events end, took ${syncDuration.toFixed(2)}ms`);

  const responseStart = performance.now();
  const totalWorkerDuration = responseStart - reqStart;
  console.log(`[Worker ${requestId}] [handleSync] response start, total worker duration: ${totalWorkerDuration.toFixed(2)}ms`);

  return new Response(
    JSON.stringify({
      shopId: authenticatedShopId,
      successful: result.successful,
      failed: [...rejectedFailures, ...result.failed],
      processedCount: result.successful.length + result.failed.length + rejectedFailures.length,
      timestamp: new Date().toISOString(),
      timings: {
        requestId,
        totalWorkerDurationMs: totalWorkerDuration,
        authDurationMs: authDuration,
        syncDurationMs: syncDuration,
        eventTimings: result.timings || [],
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': requestId,
        'Server-Timing': `auth;dur=${authDuration.toFixed(1)}, sync;dur=${syncDuration.toFixed(1)}, total;dur=${totalWorkerDuration.toFixed(1)}`,
      },
    }
  );
}
