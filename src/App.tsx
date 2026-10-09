import { useEffect, useState, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import type { NavTab } from './components/BottomNav';
import { HomePage } from './pages/HomePage';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { AuthScreen } from './features/auth/AuthScreen';
import { useAuth } from './auth/useAuth';
import { CartProvider } from './context/CartContext';
import { useCart } from './hooks/useCart';
import { requestStoragePersistence } from './lib/storagePersistence';

// Code-split secondary pages for fast mobile startup (Requirement 23)
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const SalesPage = lazy(() => import('./pages/SalesPage').then((m) => ({ default: m.SalesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isDbReady, setIsDbReady] = useState(false);
  const { isAuthenticated } = useAuth();
  const { totalItems } = useCart();

  useEffect(() => {
    // 1. Request persistent browser storage in background (Requirement 16)
    requestStoragePersistence();

    const handlePopState = (e: PopStateEvent) => {
      const tab = e.state?.tab as NavTab | undefined;
      if (tab) {
        setActiveTab(tab);
      } else {
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    setIsDbReady(true);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync hash state with authentication status
  useEffect(() => {
    if (isAuthenticated) {
      try {
        window.history.replaceState({ tab: activeTab }, '', '#' + activeTab);
      } catch {
        // ignore
      }
    } else {
      try {
        window.history.replaceState({ tab: 'login' }, '', '#login');
      } catch {
        // ignore
      }
    }
  }, [isAuthenticated, activeTab]);

  const handleTabChange = (newTab: NavTab) => {
    if (newTab !== activeTab) {
      try {
        window.history.pushState({ tab: newTab }, '', '#' + newTab);
      } catch {
        // ignore
      }
      setActiveTab(newTab);
    }
  };

  if (!isDbReady) {
    return <AppLoadingScreen />;
  }

  // Section 19: Protected App view - show AuthScreen if unauthenticated
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange} cartCount={totalItems}>
      {activeTab === 'home' && <HomePage onNavigateToTab={handleTabChange} />}
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12 text-slate-400 text-xs font-semibold">
            Loading...
          </div>
        }
      >
        {activeTab === 'inventory' && <InventoryPage />}
        {activeTab === 'customers' && <CustomersPage />}
        {activeTab === 'sales' && <SalesPage />}
        {activeTab === 'reports' && <ReportsPage onNavigateToTab={handleTabChange} />}
        {activeTab === 'settings' && <SettingsPage />}
      </Suspense>
    </Layout>
  );
}

export function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

export default App;
