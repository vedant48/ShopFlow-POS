import React from 'react';
import { Settings } from 'lucide-react';
import { NetworkStatusIndicator } from './NetworkStatusIndicator';

interface HeaderProps {
  onOpenSettings?: () => void;
  isSettingsActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, isSettingsActive = false }) => {

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-2.5 py-2 sm:px-6 w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 flex items-center justify-center text-white shadow-xs shadow-blue-500/20 shrink-0">
            <span className="text-base sm:text-lg font-black">⚡</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none truncate">
                ShopFlow
              </h1>
            </div>
            <p className="text-[10px] text-slate-500 font-medium truncate hidden xs:block">
              Offline POS
            </p>
          </div>
        </div>

        {/* Status Indicators & Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Unified Online / Offline & Sync Indicator (Section 17 & 18) */}
          <NetworkStatusIndicator />

          {/* Prominent Top Bar Settings Button */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="ShopFlow Settings"
              aria-label="Settings"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer tap-press shrink-0 ${
                isSettingsActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30'
                  : 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 border-slate-200'
              }`}
            >
              <Settings className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSettingsActive ? 'text-white rotate-45 transition-transform' : 'text-slate-600'}`} />
              <span className="hidden sm:inline text-xs">Settings</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
