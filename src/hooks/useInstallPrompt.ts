import { useState, useEffect, useCallback } from 'react';

// Store prompt in global scope to survive component re-renders
let globalDeferredPrompt: any = null;

const DISMISSAL_KEY = 'shopflow_install_dismissed_v1';

export function useInstallPrompt() {
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  const [hasPrompt, setHasPrompt] = useState<boolean>(globalDeferredPrompt !== null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISSAL_KEY) === 'true';
  });

  useEffect(() => {
    // Check display mode changes (e.g. user installed the app)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
      }
    };
    mediaQuery.addEventListener?.('change', handleDisplayChange);

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent automatic browser mini-infobar on mobile Chrome
      e.preventDefault();
      globalDeferredPrompt = e;
      setHasPrompt(true);
    };

    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      setHasPrompt(false);
      setIsStandalone(true);
      console.log('ShopFlow successfully installed as standalone PWA');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener?.('change', handleDisplayChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!globalDeferredPrompt) {
      return null;
    }
    try {
      globalDeferredPrompt.prompt();
      const choiceResult = await globalDeferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        globalDeferredPrompt = null;
        setHasPrompt(false);
        return 'accepted';
      } else {
        return 'dismissed';
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
      return null;
    }
  }, []);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISSAL_KEY, 'true');
    } catch {
      // ignore
    }
  }, []);

  const resetDismissal = useCallback(() => {
    setIsDismissed(false);
    try {
      localStorage.removeItem(DISMISSAL_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Show banner only if: not standalone, hasPrompt event fired, and not dismissed
  const shouldShowBanner = !isStandalone && hasPrompt && !isDismissed;

  return {
    isStandalone,
    hasPrompt,
    isDismissed,
    shouldShowBanner,
    promptInstall,
    dismissBanner,
    resetDismissal,
  };
}
