import type { Env } from '../types';

export async function handleHealth(_request: Request, env: Env): Promise<Response> {
  let dbStatus = 'ok';
  try {
    if (env.DB) {
      await env.DB.prepare('SELECT 1').first();
    } else {
      dbStatus = 'unbound';
    }
  } catch (err: any) {
    dbStatus = `error: ${err?.message || 'unknown'}`;
  }

  return new Response(
    JSON.stringify({
      status: 'ok',
      service: 'shopflow-backend',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      env: env.ENVIRONMENT || 'development',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
