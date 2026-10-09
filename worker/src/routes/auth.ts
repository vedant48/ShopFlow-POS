import type { Env, ShopRow, UserRow } from '../types';
import { hashPin, verifyPin, signJwt, generateSecureToken } from '../lib/crypto';
import { authenticateRequest, getJwtSecret } from '../middleware/auth';
import { checkLoginRateLimit, recordFailedLogin, clearLoginRateLimit } from '../middleware/rateLimit';
import { seedDefaultCategoriesIfEmpty } from '../services/categoryBrandService';

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export async function handleAuthRoutes(
  request: Request,
  env: Env,
  path: string
): Promise<Response | null> {
  const method = request.method;

  // 1. POST /api/auth/check-phone
  if (path === '/api/auth/check-phone' && method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const phone = cleanPhoneNumber(body?.phone || '');
    if (!phone) {
      return new Response(JSON.stringify({ error: 'Valid phone number is required' }), { status: 400 });
    }

    const user = await env.DB
      .prepare('SELECT id, name, shop_id FROM users WHERE phone = ?')
      .bind(phone)
      .first<{ id: string; name: string; shop_id: string }>();

    if (!user) {
      return new Response(JSON.stringify({ exists: false }), { status: 200 });
    }

    const shop = await env.DB
      .prepare('SELECT name FROM shops WHERE id = ?')
      .bind(user.shop_id)
      .first<{ name: string }>();

    return new Response(
      JSON.stringify({
        exists: true,
        shopName: shop?.name || 'My Shop',
        ownerName: user.name,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. POST /api/auth/register (Section 9)
  if (path === '/api/auth/register' && method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { name, shopName, pin, deviceId } = body;
    const phone = cleanPhoneNumber(body?.phone || '');

    // Validation
    if (!phone || phone.length < 10) {
      return new Response(JSON.stringify({ error: 'Please enter a valid 10-digit mobile number' }), { status: 400 });
    }
    if (!pin || !/^\d{4,6}$/.test(String(pin))) {
      return new Response(JSON.stringify({ error: 'PIN must be between 4 and 6 numeric digits' }), { status: 400 });
    }
    if (!name || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Please enter your name' }), { status: 400 });
    }
    if (!shopName || shopName.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Please enter your shop name' }), { status: 400 });
    }

    // Phone uniqueness check
    const existing = await env.DB
      .prepare('SELECT id FROM users WHERE phone = ?')
      .bind(phone)
      .first();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'An account with this phone number already exists. Please log in.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();
    const shopId = `shop_${generateSecureToken().substring(0, 16)}`;
    const userId = `user_${generateSecureToken().substring(0, 16)}`;
    const pinHash = await hashPin(String(pin));

    // Create shop and user
    await env.DB
      .prepare('INSERT INTO shops (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .bind(shopId, shopName.trim(), now, now)
      .run();

    await env.DB
      .prepare('INSERT INTO users (id, shop_id, name, phone, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(userId, shopId, name.trim(), phone, pinHash, now, now)
      .run();

    // Seed default categories for new shop
    await seedDefaultCategoriesIfEmpty(env.DB, shopId);

    // Create session and tokens
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      userId,
      shopId,
      phone,
      deviceId: deviceId || 'device_default',
      iat: nowSeconds,
      exp: nowSeconds + 86400 * 30, // 30 days access token
    };

    const accessToken = await signJwt(tokenPayload, getJwtSecret(env));
    const refreshToken = generateSecureToken();
    const sessionExpires = new Date(Date.now() + 86400 * 90 * 1000).toISOString();

    await env.DB
      .prepare('INSERT INTO sessions (id, user_id, shop_id, device_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(generateSecureToken(), userId, shopId, deviceId || 'device_default', refreshToken, now, sessionExpires)
      .run();

    return new Response(
      JSON.stringify({
        token: accessToken,
        refreshToken,
        user: { id: userId, name: name.trim(), phone, shop_id: shopId },
        shop: { id: shopId, name: shopName.trim() },
        message: 'Account created successfully',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. POST /api/auth/login (Section 10, 27, 28)
  if (path === '/api/auth/login' && method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { pin, deviceId } = body;
    const phone = cleanPhoneNumber(body?.phone || '');

    if (!phone || !pin) {
      return new Response(JSON.stringify({ error: 'Phone number or PIN is incorrect.' }), { status: 400 });
    }

    // Rate limiting check
    const rateLimit = await checkLoginRateLimit(env.DB, phone);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: `Too many incorrect attempts. Please try again in ${Math.ceil((rateLimit.retryAfterSeconds || 60) / 60)} minutes.`,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await env.DB
      .prepare('SELECT * FROM users WHERE phone = ?')
      .bind(phone)
      .first<UserRow>();

    if (!user || !user.pin_hash) {
      await recordFailedLogin(env.DB, phone);
      // Section 28: Never reveal whether the phone exists
      return new Response(JSON.stringify({ error: 'Phone number or PIN is incorrect.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isMatch = await verifyPin(String(pin), user.pin_hash);
    if (!isMatch) {
      await recordFailedLogin(env.DB, phone);
      return new Response(JSON.stringify({ error: 'Phone number or PIN is incorrect.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clear rate limits upon successful login
    await clearLoginRateLimit(env.DB, phone);

    const shop = await env.DB
      .prepare('SELECT * FROM shops WHERE id = ?')
      .bind(user.shop_id)
      .first<ShopRow>();

    if (!shop) {
      return new Response(JSON.stringify({ error: 'Shop account not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      userId: user.id,
      shopId: shop.id,
      phone: user.phone || phone,
      deviceId: deviceId || 'device_default',
      iat: nowSeconds,
      exp: nowSeconds + 86400 * 30,
    };

    const accessToken = await signJwt(tokenPayload, getJwtSecret(env));
    const refreshToken = generateSecureToken();
    const sessionExpires = new Date(Date.now() + 86400 * 90 * 1000).toISOString();

    await env.DB
      .prepare('INSERT INTO sessions (id, user_id, shop_id, device_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(generateSecureToken(), user.id, shop.id, deviceId || 'device_default', refreshToken, now, sessionExpires)
      .run();

    return new Response(
      JSON.stringify({
        token: accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, phone: user.phone, shop_id: user.shop_id },
        shop: { id: shop.id, name: shop.name },
        message: 'Logged in successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. GET /api/auth/me (Section 8)
  if (path === '/api/auth/me' && method === 'GET') {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    return new Response(
      JSON.stringify({
        user: {
          id: auth!.user.id,
          name: auth!.user.name,
          phone: auth!.user.phone,
          shop_id: auth!.user.shop_id,
        },
        shop: {
          id: auth!.shop.id,
          name: auth!.shop.name,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. POST /api/auth/refresh (Section 8)
  if (path === '/api/auth/refresh' && method === 'POST') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { refreshToken, deviceId } = body || {};
    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'Refresh token is required' }), { status: 400 });
    }

    const now = new Date().toISOString();
    const session = await env.DB
      .prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?')
      .bind(refreshToken, now)
      .first<{ user_id: string; shop_id: string }>();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401 });
    }

    const [user, shop] = await Promise.all([
      env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<UserRow>(),
      env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(session.shop_id).first<ShopRow>(),
    ]);

    if (!user || !shop) {
      return new Response(JSON.stringify({ error: 'User or shop not found' }), { status: 401 });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      userId: user.id,
      shopId: shop.id,
      phone: user.phone,
      deviceId: deviceId || 'device_default',
      iat: nowSeconds,
      exp: nowSeconds + 86400 * 30,
    };

    const newAccessToken = await signJwt(tokenPayload, getJwtSecret(env));

    return new Response(
      JSON.stringify({
        token: newAccessToken,
        user: { id: user.id, name: user.name, phone: user.phone, shop_id: user.shop_id },
        shop: { id: shop.id, name: shop.name },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 6. POST /api/auth/logout (Section 11)
  if (path === '/api/auth/logout' && method === 'POST') {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // body optional
    }

    if (body?.refreshToken) {
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(body.refreshToken).run();
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Logged out successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 7. PUT /api/auth/shop-profile (Section 17)
  if (path === '/api/auth/shop-profile' && method === 'PUT') {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { shopName, ownerName } = body || {};
    const now = new Date().toISOString();

    if (shopName && shopName.trim().length >= 2) {
      await env.DB
        .prepare('UPDATE shops SET name = ?, updated_at = ? WHERE id = ?')
        .bind(shopName.trim(), now, auth!.shop.id)
        .run();
      auth!.shop.name = shopName.trim();
    }

    if (ownerName && ownerName.trim().length >= 2) {
      await env.DB
        .prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ? AND shop_id = ?')
        .bind(ownerName.trim(), now, auth!.user.id, auth!.shop.id)
        .run();
      auth!.user.name = ownerName.trim();
    }

    return new Response(
      JSON.stringify({
        user: { id: auth!.user.id, name: auth!.user.name, phone: auth!.user.phone, shop_id: auth!.shop.id },
        shop: { id: auth!.shop.id, name: auth!.shop.name },
        message: 'Shop profile updated successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 8. GET /api/auth/sessions - List active logged in devices/sessions
  if (path === '/api/auth/sessions' && method === 'GET') {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    const now = new Date().toISOString();
    const { results } = await env.DB
      .prepare('SELECT id, device_id, created_at, expires_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC')
      .bind(auth!.user.id, now)
      .all<{ id: string; device_id: string; created_at: string; expires_at: string }>();

    const currentDeviceId = auth!.tokenPayload.deviceId || '';
    const currentRawId = currentDeviceId.split('|')[0];

    const sessions = (results || []).map((s) => {
      const [rawDevId, ...labelParts] = (s.device_id || '').split('|');
      const deviceName = labelParts.join('|') || null;
      const isCurrent = rawDevId === currentRawId;

      return {
        id: s.id,
        deviceId: rawDevId || s.device_id,
        deviceName,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
        isCurrent,
      };
    });

    return new Response(
      JSON.stringify({ sessions }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 9. DELETE /api/auth/sessions/:sessionId or POST /api/auth/sessions/terminate - Terminate specific session
  if (
    (path.startsWith('/api/auth/sessions/') && path !== '/api/auth/sessions/terminate-all-others' && path !== '/api/auth/sessions/terminate' && method === 'DELETE') ||
    (path === '/api/auth/sessions/terminate' && method === 'POST')
  ) {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    let sessionId = '';
    if (method === 'DELETE') {
      sessionId = path.replace('/api/auth/sessions/', '').trim();
    } else {
      try {
        const body: any = await request.json();
        sessionId = body?.sessionId || '';
      } catch {
        // ignore
      }
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), { status: 400 });
    }

    await env.DB
      .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, auth!.user.id)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: 'Session terminated successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 10. POST /api/auth/sessions/terminate-all-others - Terminate all sessions except current device
  if (path === '/api/auth/sessions/terminate-all-others' && method === 'POST') {
    const { auth, errorResponse } = await authenticateRequest(request, env);
    if (errorResponse) return errorResponse;

    const currentDeviceId = auth!.tokenPayload.deviceId || '';
    const currentRawId = currentDeviceId.split('|')[0];

    const res = await env.DB
      .prepare('DELETE FROM sessions WHERE user_id = ? AND device_id NOT LIKE ?')
      .bind(auth!.user.id, `${currentRawId}%`)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'All other sessions terminated successfully',
        terminatedCount: res.meta?.changes ?? 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return null;
}
