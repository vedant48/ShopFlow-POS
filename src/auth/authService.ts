import type { AuthUser, AuthShop, AuthSession, AuthState } from './types';
import {
  getOrCreateDeviceId,
  loadSavedSession,
  saveSession,
  clearSession,
  getTrustedShop,
  clearTrustedShop,
  getLastPhone,
  type TrustedShop,
} from './authStore';
import { api, DEFAULT_DEMO_SHOP_ID } from '../lib/api';
import { seedShopProducts } from '../db/seed';

// Simple SHA-256 helper for client-side offline PIN verification on trusted device (Section 12, 13)
async function hashPinClient(pin: string, salt = 'shopflow_device_salt'): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${pin}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback
  return `local_${pin}`;
}

type AuthListener = (state: AuthState) => void;

class AuthService {
  private currentSession: AuthSession | null = null;
  private listeners: Set<AuthListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const saved = loadSavedSession();
    if (saved && saved.user && saved.shop) {
      this.currentSession = saved;
    }
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Auth listener error:', err);
      }
    }
  }

  getState(): AuthState {
    return {
      isAuthenticated: !!this.currentSession?.token,
      isLoading: false,
      user: this.currentSession?.user || null,
      shop: this.currentSession?.shop || null,
      deviceId: getOrCreateDeviceId(),
      error: null,
    };
  }

  isAuthenticated(): boolean {
    return !!this.currentSession?.token;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentSession?.user || null;
  }

  getCurrentShop(): AuthShop | null {
    return this.currentSession?.shop || null;
  }

  getCurrentShopId(): string {
    return this.currentSession?.shop?.id || DEFAULT_DEMO_SHOP_ID;
  }

  getToken(): string | null {
    return this.currentSession?.token || null;
  }

  getLastPhone(): string | null {
    return getLastPhone();
  }

  getTrustedShop(): TrustedShop | null {
    return getTrustedShop();
  }

  clearTrustedShop(): void {
    clearTrustedShop();
  }

  clearSession(): void {
    clearSession();
    this.currentSession = null;
    this.notify();
  }

  // 1. Check if phone already registered (Section 2)
  async checkPhone(phone: string): Promise<{ exists: boolean; shopName?: string; ownerName?: string }> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Offline: check if current/last device session matches this phone
        const last = loadSavedSession();
        const trusted = getTrustedShop();
        const cleanPhone = phone.replace(/\D/g, '');
        if (last && last.user.phone.replace(/\D/g, '') === cleanPhone) {
          return { exists: true, shopName: last.shop.name, ownerName: last.user.name };
        }
        if (trusted && trusted.phone.replace(/\D/g, '') === cleanPhone) {
          return { exists: true, shopName: trusted.shopName, ownerName: trusted.ownerName };
        }
        return { exists: false };
      }
      return await api.checkPhone(phone);
    } catch {
      // In case of error, assume existing if matches local session
      const last = loadSavedSession();
      const trusted = getTrustedShop();
      const cleanPhone = phone.replace(/\D/g, '');
      if (last && last.user.phone.replace(/\D/g, '') === cleanPhone) {
        return { exists: true, shopName: last.shop.name, ownerName: last.user.name };
      }
      if (trusted && trusted.phone.replace(/\D/g, '') === cleanPhone) {
        return { exists: true, shopName: trusted.shopName, ownerName: trusted.ownerName };
      }
      return { exists: false };
    }
  }

  // 2. User Login with Phone + PIN (Section 3, 10, 12)
  async login(
    phone: string,
    pin: string
  ): Promise<{ success: boolean; error?: string; user?: AuthUser; shop?: AuthShop }> {
    const deviceId = getOrCreateDeviceId();
    const pinHashLocal = await hashPinClient(pin);
    const cleanPhone = phone.replace(/\D/g, '');

    // Offline PIN verification for trusted device (Section 12, 13)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const saved = loadSavedSession();
      const trusted = getTrustedShop();

      if (saved && saved.user.phone.replace(/\D/g, '') === cleanPhone) {
        if (saved.pinHashLocal && saved.pinHashLocal === pinHashLocal) {
          this.currentSession = saved;
          this.notify();
          return { success: true, user: saved.user, shop: saved.shop };
        }
        return { success: false, error: 'Incorrect PIN' };
      }

      if (trusted && trusted.phone.replace(/\D/g, '') === cleanPhone) {
        if (trusted.pinHashLocal && trusted.pinHashLocal === pinHashLocal) {
          const session: AuthSession = {
            token: trusted.token || saved?.token || `offline_trusted_${trusted.shopId}_${Date.now()}`,
            refreshToken: trusted.refreshToken || saved?.refreshToken,
            user: {
              id: trusted.userId || saved?.user.id || `user_${trusted.shopId}`,
              shop_id: trusted.shopId,
              name: trusted.ownerName || 'Owner',
              phone: trusted.phone,
            },
            shop: { id: trusted.shopId, name: trusted.shopName },
            deviceId,
            pinHashLocal,
            createdAt: new Date().toISOString(),
          };
          this.currentSession = session;
          saveSession(session);
          this.notify();
          return { success: true, user: session.user, shop: session.shop };
        }
        return { success: false, error: 'Incorrect PIN' };
      }

      return {
        success: false,
        error: 'Offline: You can only unlock previously logged-in accounts on this device while offline.',
      };
    }

    // Online Login
    try {
      const res = await api.login({ phone, pin, deviceId });

      const session: AuthSession = {
        token: res.token,
        refreshToken: res.refreshToken,
        user: res.user,
        shop: res.shop,
        deviceId,
        pinHashLocal,
        createdAt: new Date().toISOString(),
      };

      saveSession(session);
      this.currentSession = session;
      this.notify();

      return { success: true, user: res.user, shop: res.shop };
    } catch (err: any) {
      // Check offline fallback if network failed mid-flight
      const saved = loadSavedSession();
      if (saved && saved.user.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) {
        if (saved.pinHashLocal && saved.pinHashLocal === pinHashLocal) {
          this.currentSession = saved;
          this.notify();
          return { success: true, user: saved.user, shop: saved.shop };
        }
      }

      return {
        success: false,
        error: err?.message || 'Phone number or PIN is incorrect.',
      };
    }
  }

  // 3. User Registration (Section 9, 15)
  async register(params: {
    phone: string;
    name: string;
    shopName: string;
    pin: string;
    startWithSampleProducts?: boolean;
  }): Promise<{ success: boolean; error?: string; user?: AuthUser; shop?: AuthShop }> {
    const deviceId = getOrCreateDeviceId();
    const pinHashLocal = await hashPinClient(params.pin);

    try {
      const res = await api.register({
        phone: params.phone,
        name: params.name,
        shopName: params.shopName,
        pin: params.pin,
        deviceId,
      });

      const session: AuthSession = {
        token: res.token,
        refreshToken: res.refreshToken,
        user: res.user,
        shop: res.shop,
        deviceId,
        pinHashLocal,
        createdAt: new Date().toISOString(),
      };

      saveSession(session);
      this.currentSession = session;

      // Section 15: "How do you want to start?" -> Sample products vs Start empty
      if (params.startWithSampleProducts) {
        await seedShopProducts(res.shop.id);
      }

      this.notify();
      return { success: true, user: res.user, shop: res.shop };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to create shop account. Please try again.',
      };
    }
  }

  // 4. Logout (Section 11, 23)
  // Invalidate session, clear local auth tokens, DO NOT delete shop data on device
  async logout(): Promise<void> {
    try {
      if (this.currentSession?.refreshToken && navigator.onLine) {
        await api.logout(this.currentSession.refreshToken);
      }
    } catch {
      // ignore
    }

    clearSession();
    this.currentSession = null;
    this.notify();
  }

  // 5. Update Shop Profile (Section 17)
  async updateProfile(params: {
    shopName?: string;
    ownerName?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await api.updateShopProfile(params);
      if (this.currentSession) {
        if (res.shop) this.currentSession.shop = res.shop;
        if (res.user) this.currentSession.user = res.user;
        saveSession(this.currentSession);
        this.notify();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update shop profile' };
    }
  }
}

export const authService = new AuthService();
