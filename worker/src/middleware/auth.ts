import type { Env, ShopRow, UserRow } from '../types';
import { verifyJwt } from '../lib/crypto';

export interface AuthContext {
  user: UserRow;
  shop: ShopRow;
  tokenPayload: {
    userId: string;
    shopId: string;
    phone: string;
    deviceId: string;
    exp: number;
  };
}

export function getJwtSecret(env: Env): string {
  return env.JWT_SECRET || 'shopflow-secret-signing-key-production-default-2026';
}

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1].trim();
  }
  return null;
}

export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<{ auth: AuthContext | null; errorResponse: Response | null }> {
  const token = extractBearerToken(request);

  if (!token) {
    // For demo/dev bootstrap fallback if enabled
    const fallbackShopId = request.headers.get('x-shop-id') || env.DEMO_SHOP_ID;
    if (env.ENVIRONMENT === 'development' && fallbackShopId === 'shop_demo_001') {
      const shop = await env.DB.prepare('SELECT * FROM shops WHERE id = ?')
        .bind('shop_demo_001')
        .first<ShopRow>();

      const user = await env.DB.prepare('SELECT * FROM users WHERE shop_id = ?')
        .bind('shop_demo_001')
        .first<UserRow>();

      if (shop && user) {
        return {
          auth: {
            user,
            shop,
            tokenPayload: {
              userId: user.id,
              shopId: shop.id,
              phone: user.phone || '9876543210',
              deviceId: 'dev_device',
              exp: Math.floor(Date.now() / 1000) + 86400,
            },
          },
          errorResponse: null,
        };
      }
    }

    return {
      auth: null,
      errorResponse: new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required. Please provide a valid Bearer token.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  const payload = await verifyJwt(token, getJwtSecret(env));
  if (!payload || !payload.userId || !payload.shopId) {
    return {
      auth: null,
      errorResponse: new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Invalid or expired authentication token. Please log in again.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  // Derive user and shop strictly from verified payload (Section 7, 26)
  const [user, shop] = await Promise.all([
    env.DB.prepare('SELECT * FROM users WHERE id = ? AND shop_id = ?')
      .bind(payload.userId, payload.shopId)
      .first<UserRow>(),
    env.DB.prepare('SELECT * FROM shops WHERE id = ?')
      .bind(payload.shopId)
      .first<ShopRow>(),
  ]);

  if (!user || !shop) {
    return {
      auth: null,
      errorResponse: new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'User account or shop not found.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return {
    auth: {
      user,
      shop,
      tokenPayload: payload,
    },
    errorResponse: null,
  };
}
