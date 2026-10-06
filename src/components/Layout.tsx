import React from 'react';
import { Header } from './Header';
import { BottomNav, type NavTab } from './BottomNav';
import { InstallPromptBanner } from './InstallPromptBanner';
import { OfflineNoticeBar } from './NetworkStatusIndicator';
import { PwaUpdateToast } from './PwaUpdateToast';
import { ShoppingBag, Package, Users, Receipt, BarChart3 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  cartCount?: number;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  cartCount = 0,
}) => {
  const desktopTabs: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'Quick Sale POS', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'customers', label: 'Customers & Udhaar', icon: Users },
    { id: 'sales', label: 'Sales History', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 w-full max-w-full overflow-x-hidden">
      {/* PWA Service Worker Update Prompt */}
      <PwaUpdateToast />

      {/* App Header with Settings button on top bar only */}
      <Header
        isSettingsActive={activeTab === 'settings'}
        onOpenSettings={() => onTabChange(activeTab === 'settings' ? 'home' : 'settings')}
      />

      {/* Offline Status Bar Notice */}
      <OfflineNoticeBar />

      {/* PWA Android Install Banner */}
      <InstallPromptBanner />

      {/* Desktop Navigation Tabs (Visible on screens >= md) */}
      <div className="hidden md:block bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1">
          {desktopTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.id === 'home' && cartCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area: generous bottom padding ensures full scrolling above bottom bar */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-6 pb-36 sm:pb-36 md:pb-16">
        {children}
      </main>

      {/* Mobile Bottom Navigation (Visible on mobile/tablet) */}
      <div className="md:hidden">
        <BottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          cartCount={cartCount}
        />
      </div>
    </div>
  );
};
