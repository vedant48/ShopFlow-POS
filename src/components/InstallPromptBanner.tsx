import React from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { Download, X } from 'lucide-react';

export const InstallPromptBanner: React.FC = () => {
  const { shouldShowBanner, promptInstall, dismissBanner } = useInstallPrompt();

  if (!shouldShowBanner) {
    return null;
  }

  const handleInstallClick = async () => {
    await promptInstall();
  };

  return (
    <div
      role="banner"
      aria-label="Install ShopFlow App"
      className="bg-blue-600 text-white shadow-md border-b border-blue-700 px-3 py-2.5 relative z-30 transition-all duration-300 w-full max-w-full overflow-hidden"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 w-full min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold leading-tight">Install ShopFlow</h4>
            <p className="text-xs text-blue-100 mt-0.5">
              Use ShopFlow like an app on your phone.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={dismissBanner}
            className="text-xs text-blue-100 hover:text-white px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors font-medium cursor-pointer"
          >
            NOT NOW
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            className="text-xs bg-white text-blue-700 hover:bg-blue-50 font-bold px-4 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5 tap-press"
          >
            <Download className="w-3.5 h-3.5" />
            <span>INSTALL</span>
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            title="Dismiss"
            className="text-blue-200 hover:text-white p-1 rounded-md sm:inline-block hidden cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
