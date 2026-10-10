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
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col text-[#1d1d1f] w-full max-w-full overflow-x-hidden">
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

      {/* Desktop Navigation Tabs (Apple Sub-Nav frosted style) */}
      <div className="hidden md:block bg-white/95 backdrop-blur-md border-b border-[#e5e5ea] sticky top-[57px] z-20">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1.5 h-12">
          {desktopTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 h-full px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer apple-focus ${
                  isActive
                    ? 'border-[#0066cc] text-[#0066cc] bg-[#0066cc]/5'
                    : 'border-transparent text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
                <span>{tab.label}</span>
                {tab.id === 'home' && cartCount > 0 && (
                  <span className="bg-[#0066cc] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
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
