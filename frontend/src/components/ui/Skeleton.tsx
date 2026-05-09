import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-lg bg-slate-100', className)}
            {...props}
        />
    );
}

export function SkeletonCard() {
    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
            </div>
        </div>
    );
}

export function SkeletonForm({ count = 8 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-9 w-full" />
                </div>
            ))}
        </div>
    );
}
