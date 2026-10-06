import React from 'react';

export const AppLoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 select-none">
      <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-500/25">
        ⚡
      </div>
      <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-4">
        ShopFlow
      </h1>
      <p className="text-sm font-medium text-slate-500 mt-1">
        Opening your shop...
      </p>
    </div>
  );
};
