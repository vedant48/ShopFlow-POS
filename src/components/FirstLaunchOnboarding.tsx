import React, { useState } from 'react';
import { Plus, Sparkles, Store } from 'lucide-react';
import { seedDatabaseIfEmpty } from '../db/seed';

interface FirstLaunchOnboardingProps {
  onAddProducts: () => void;
  onDemoLoaded: () => void;
}

export const FirstLaunchOnboarding: React.FC<FirstLaunchOnboardingProps> = ({
  onAddProducts,
  onDemoLoaded,
}) => {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleUseDemo = async () => {
    setIsSeeding(true);
    try {
      await seedDatabaseIfEmpty();
      onDemoLoaded();
    } catch (err) {
      console.error('Failed to load demo products', err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-3xl shadow-inner">
          <Store className="w-8 h-8 text-blue-600" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Welcome to ShopFlow
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Let's add your first products.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={onAddProducts}
            className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer tap-press transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>ADD PRODUCTS</span>
          </button>

          <button
            type="button"
            disabled={isSeeding}
            onClick={handleUseDemo}
            className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer tap-press transition-all border border-slate-200"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>{isSeeding ? 'Loading demo catalog...' : 'USE DEMO PRODUCTS'}</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          No sign up required &bull; 100% offline on your device
        </p>
      </div>
    </div>
  );
};
