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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 pb-safe">
      <div className="max-w-lg sm:max-w-xl md:max-w-2xl mx-auto flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-90 ${
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div
                className={`relative p-1 rounded-xl transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-600' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-1.5 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white animate-bounce">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-tight tracking-tight mt-0.5">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
