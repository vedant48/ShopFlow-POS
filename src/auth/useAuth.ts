import { useState, useEffect } from 'react';
import { authService } from './authService';
import type { AuthState } from './types';

export function useAuth() {
  const [state, setState] = useState<AuthState>(authService.getState());

  useEffect(() => {
    return authService.subscribe(setState);
  }, []);

  return {
    ...state,
    login: authService.login.bind(authService),
    register: authService.register.bind(authService),
    logout: authService.logout.bind(authService),
    checkPhone: authService.checkPhone.bind(authService),
    updateProfile: authService.updateProfile.bind(authService),
  };
}
