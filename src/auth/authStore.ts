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

export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web Device';
  const ua = navigator.userAgent;
  let os = 'Device';
  if (ua.includes('Android')) os = 'Android Phone';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Windows')) os = 'Windows PC';
  else if (ua.includes('Macintosh')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  return isStandalone ? `${os} App (PWA)` : `${os} · ${browser}`;
}

export function getFullDeviceId(): string {
  const id = getOrCreateDeviceId();
  const label = getDeviceLabel();
  return `${id}|${label}`;
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

