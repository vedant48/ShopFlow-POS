import React from 'react';
import { ShoppingBag, Package, Users, Receipt, BarChart3 } from 'lucide-react';

export type NavTab = 'home' | 'inventory' | 'customers' | 'sales' | 'reports' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  cartCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  cartCount = 0,
}) => {
  // Exactly 5 items in bottom bar as requested
  const navItems = [
    {
      id: 'home' as NavTab,
      label: 'Quick Sale',
      icon: ShoppingBag,
      badge: cartCount > 0 ? cartCount : undefined,
    },
    {
      id: 'inventory' as NavTab,
      label: 'Inventory',
      icon: Package,
    },
    {
      id: 'customers' as NavTab,
      label: 'Customers',
      icon: Users,
    },
    {
      id: 'sales' as NavTab,
      label: 'Sales',
      icon: Receipt,
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports',
      icon: BarChart3,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-[#e5e5ea] pb-safe">
      <div className="max-w-lg sm:max-w-xl md:max-w-2xl mx-auto flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer apple-focus ${
                isActive
                  ? 'text-[#0066cc]'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <div
                className={`relative p-1 rounded-xl transition-colors ${
                  isActive ? 'bg-[#0066cc]/10 text-[#0066cc]' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-[#0066cc] text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-2xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] leading-tight tracking-tight mt-0.5 ${isActive ? 'font-semibold text-[#0066cc]' : 'font-normal text-[#86868b]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
