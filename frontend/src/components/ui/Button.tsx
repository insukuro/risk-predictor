import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
        const base =
            'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';

        const variants = {
            primary:
                'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-indigo-500 shadow-sm',
            secondary:
                'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400',
            outline:
                'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-slate-400',
            ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400',
            danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500 shadow-sm',
        };

        const sizes = {
            sm: 'text-xs px-3 py-1.5 h-8',
            md: 'text-sm px-4 py-2 h-9',
            lg: 'text-sm px-5 py-2.5 h-11',
        };

        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                className={cn(base, variants[variant], sizes[size], className)}
                {...props}
            >
                {loading ? <Spinner size="sm" /> : icon}
                {children}
            </button>
        );
    },
);

Button.displayName = 'Button';
