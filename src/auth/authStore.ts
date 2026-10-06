import type { AuthSession } from './types';
import { generateId } from '../lib/utils';

export interface TrustedShop {
  phone: string;
  shopName: string;
  ownerName?: string;
  shopId: string;
  userId?: string;
  token?: string;
  refreshToken?: string;
  pinHashLocal?: string;
}

const SESSION_KEY = 'shopflow_auth_session';
const DEVICE_ID_KEY = 'shopflow_device_id';
const LAST_PHONE_KEY = 'shopflow_last_phone';
const TRUSTED_SHOP_KEY = 'shopflow_trusted_shop';


export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'device_default';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateId('dev');
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function loadSavedSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session.user?.phone) {
    localStorage.setItem(LAST_PHONE_KEY, session.user.phone);
  }
  if (session.shop) {
    const trusted: TrustedShop = {
      phone: session.user.phone,
      shopName: session.shop.name,
      ownerName: session.user.name,
      shopId: session.shop.id,
      userId: session.user.id,
      token: session.token,
      refreshToken: session.refreshToken,
      pinHashLocal: session.pinHashLocal,
    };
    localStorage.setItem(TRUSTED_SHOP_KEY, JSON.stringify(trusted));
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

export function getTrustedShop(): TrustedShop | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TRUSTED_SHOP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TrustedShop;
  } catch {
    return null;
  }
}

export function saveTrustedShop(shop: TrustedShop): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRUSTED_SHOP_KEY, JSON.stringify(shop));
  localStorage.setItem(LAST_PHONE_KEY, shop.phone);
}

export function clearTrustedShop(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TRUSTED_SHOP_KEY);
  localStorage.removeItem(LAST_PHONE_KEY);
}

export function getLastPhone(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_PHONE_KEY);
}

