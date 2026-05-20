import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'low' | 'medium' | 'high' | 'danger';
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  hover = false,
  onClick,
}) => {
  const variants = {
    default: 'bg-white border-slate-200',
    low: 'bg-green-50 border-green-300',
    medium: 'bg-yellow-50 border-yellow-300',
    high: 'bg-orange-50 border-orange-300',
    danger: 'bg-red-50 border-red-300',
  };

  return (
    <div
      className={cn(
        'rounded-xl border-2 shadow-sm',
        variants[variant],
        hover && 'hover:shadow-md transition-shadow cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('px-5 py-4 border-b border-slate-100', className)}>
    {children}
  </div>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('px-5 py-4', className)}>
    {children}
  </div>
);

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl', className)}>
    {children}
  </div>
);
