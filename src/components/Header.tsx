import React from 'react';
import { Settings } from 'lucide-react';
import { NetworkStatusIndicator } from './NetworkStatusIndicator';

interface HeaderProps {
  onOpenSettings?: () => void;
  isSettingsActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, isSettingsActive = false }) => {

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#e5e5ea] px-3 py-2.5 sm:px-6 w-full max-w-full overflow-hidden transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0066cc] flex items-center justify-center text-white shadow-xs shrink-0 transition-transform active:scale-95">
            <span className="text-sm sm:text-base font-black">⚡</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base sm:text-lg font-semibold text-[#1d1d1f] tracking-tight apple-tight leading-none truncate">
                ShopFlow
              </h1>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#86868b] bg-[#f5f5f7] border border-[#e5e5ea] px-1.5 py-0.5 rounded-full hidden sm:inline-block">
                POS
              </span>
            </div>
            <p className="text-[11px] text-[#86868b] font-normal truncate hidden xs:block mt-0.5">
              High-Speed Kirana Counter
            </p>
          </div>
        </div>

        {/* Status Indicators & Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unified Online / Offline & Sync Indicator (Section 17 & 18) */}
          <NetworkStatusIndicator />

          {/* Prominent Top Bar Settings Button */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="ShopFlow Settings"
              aria-label="Settings"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer active:scale-95 apple-focus shrink-0 ${
                isSettingsActive
                  ? 'bg-[#0066cc] text-white border-[#0066cc] shadow-xs'
                  : 'bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] border-[#e5e5ea]'
              }`}
            >
              <Settings className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${isSettingsActive ? 'text-white rotate-45' : 'text-[#6e6e73]'}`} />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
