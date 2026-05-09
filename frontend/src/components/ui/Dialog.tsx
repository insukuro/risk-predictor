import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

interface DialogContentProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    description?: string;
}

export function DialogContent({ children, className, title, description }: DialogContentProps) {
    return (
        <RadixDialog.Portal>
            <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
            <RadixDialog.Content
                className={cn(
                    'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
                    'w-full max-w-lg max-h-[90vh] overflow-y-auto',
                    'rounded-2xl border border-slate-200 bg-white shadow-2xl',
                    'animate-in fade-in-0 zoom-in-95',
                    className,
                )}
            >
                <div className="flex items-start justify-between p-5 pb-0">
                    <div>
                        {title && (
                            <RadixDialog.Title className="text-base font-semibold text-slate-900">
                                {title}
                            </RadixDialog.Title>
                        )}
                        {description && (
                            <RadixDialog.Description className="mt-0.5 text-sm text-slate-500">
                                {description}
                            </RadixDialog.Description>
                        )}
                    </div>
                    <RadixDialog.Close className="ml-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                        <X className="h-4 w-4" />
                    </RadixDialog.Close>
                </div>
                <div className="p-5">{children}</div>
            </RadixDialog.Content>
        </RadixDialog.Portal>
    );
}

export const DialogClose = RadixDialog.Close;
