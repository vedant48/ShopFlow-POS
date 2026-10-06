import React from 'react';
import { cn } from '../lib/utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  variant?: 'blue' | 'violet' | 'emerald' | 'amber' | 'slate';
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  subValue,
  icon,
  variant = 'slate',
  onClick,
}) => {
  const variantStyles = {
    blue: 'border-blue-100 bg-gradient-to-br from-blue-50/60 to-white text-blue-900',
    violet: 'border-violet-100 bg-gradient-to-br from-violet-50/60 to-white text-violet-900',
    emerald: 'border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white text-emerald-900',
    amber: 'border-amber-100 bg-gradient-to-br from-amber-50/60 to-white text-amber-900',
    slate: 'border-slate-200/90 bg-white text-slate-900',
  };

  const accentColors = {
    blue: 'text-blue-600',
    violet: 'text-violet-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    slate: 'text-slate-600',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 sm:p-4 rounded-2xl border shadow-2xs flex flex-col justify-between transition-all',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-xs active:scale-98'
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 truncate">
          {label}
        </span>
        {icon && <span className={cn('text-sm', accentColors[variant])}>{icon}</span>}
      </div>

      <div>
        <div className="text-lg sm:text-2xl font-black tracking-tight leading-tight truncate">
          {value}
        </div>
        {subValue && (
          <div className="text-[10px] sm:text-xs font-semibold text-slate-400 mt-0.5 truncate">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};
