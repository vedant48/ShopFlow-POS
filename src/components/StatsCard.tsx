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
    blue: 'border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#b6d7ff]',
    violet: 'border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#e9d5ff]',
    emerald: 'border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#c8e6c9]',
    amber: 'border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#ffe7ba]',
    slate: 'border-[#e5e5ea] bg-white text-[#1d1d1f] hover:border-[#d1d1d6]',
  };

  const accentColors = {
    blue: 'text-[#0066cc]',
    violet: 'text-[#7c3aed]',
    emerald: 'text-[#10b981]',
    amber: 'text-[#d97706]',
    slate: 'text-[#6e6e73]',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3.5 sm:p-4 rounded-2xl border shadow-2xs flex flex-col justify-between transition-all apple-card',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-xs active:scale-[0.98]'
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#86868b] truncate">
          {label}
        </span>
        {icon && <span className={cn('text-sm', accentColors[variant])}>{icon}</span>}
      </div>

      <div>
        <div className="text-xl sm:text-2xl font-semibold tracking-tight apple-tight leading-tight truncate text-[#1d1d1f]">
          {value}
        </div>
        {subValue && (
          <div className="text-[11px] font-normal text-[#86868b] mt-0.5 truncate">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};
