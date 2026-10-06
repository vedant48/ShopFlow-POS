import React from 'react';
import { cn } from '../lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'paid' | 'udhaar' | 'low-stock' | 'in-stock' | 'neutral' | 'blue';
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className,
  size = 'md',
}) => {
  const variantStyles = {
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    udhaar: 'bg-violet-50 text-violet-700 border-violet-200',
    'low-stock': 'bg-rose-50 text-rose-700 border-rose-200 font-semibold animate-pulse',
    'in-stock': 'bg-slate-100 text-slate-700 border-slate-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 rounded-md font-medium border',
    md: 'text-xs px-2.5 py-1 rounded-full font-semibold border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 leading-none tracking-tight',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};
