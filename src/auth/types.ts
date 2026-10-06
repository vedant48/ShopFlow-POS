export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  shop_id: string;
}

export interface AuthShop {
  id: string;
  name: string;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  user: AuthUser;
  shop: AuthShop;
  deviceId: string;
  pinHashLocal?: string; // For offline PIN verification on trusted device (Section 12, 13)
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  shop: AuthShop | null;
  deviceId: string;
  error: string | null;
}
