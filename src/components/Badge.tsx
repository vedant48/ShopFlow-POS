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
    paid: 'bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9]',
    udhaar: 'bg-[#f3e8ff] text-[#6b21a8] border-[#e9d5ff]',
    'low-stock': 'bg-[#fff1f0] text-[#cf1322] border-[#ffa39e] font-semibold',
    'in-stock': 'bg-[#f5f5f7] text-[#1d1d1f] border-[#e5e5ea]',
    neutral: 'bg-[#f5f5f7] text-[#6e6e73] border-[#e5e5ea]',
    blue: 'bg-[#e8f2ff] text-[#0066cc] border-[#b6d7ff]',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded-full font-medium border',
    md: 'text-[11px] px-2.5 py-0.5 rounded-full font-medium border',
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
