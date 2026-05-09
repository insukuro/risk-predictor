import { forwardRef } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
                         value,
                         onValueChange,
                         options,
                         placeholder = 'Выберите...',
                         label,
                         error,
                         disabled,
                         className,
                       }: SelectProps) {
  return (
      <div className={cn('flex flex-col gap-1', className)}>
        {label && (
            <label className="text-xs font-medium text-slate-600 truncate" title={label}>
              {label}
            </label>
        )}
        <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
          <RadixSelect.Trigger
              className={cn(
                  'flex h-9 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm',
                  'text-slate-900 transition-colors focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  error && 'border-red-400',
                  !value && 'text-slate-400',
              )}
          >
            <RadixSelect.Value placeholder={placeholder} />
            <RadixSelect.Icon>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </RadixSelect.Icon>
          </RadixSelect.Trigger>
          <RadixSelect.Portal>
            <RadixSelect.Content
                className="z-50 min-w-[8rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                position="popper"
                sideOffset={4}
            >
              <RadixSelect.Viewport className="p-1">
                {options.map((opt) => (
                    <RadixSelect.Item
                        key={opt.value}
                        value={opt.value}
                        className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-indigo-50 hover:text-indigo-700 data-[state=checked]:text-indigo-700"
                    >
                      <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                      <RadixSelect.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </RadixSelect.ItemIndicator>
                    </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
  );
}

export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }>(
    ({ className, label, error, children, ...props }, ref) => (
        <div className="flex flex-col gap-1">
          {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
          <select
              ref={ref}
              className={cn(
                  'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900',
                  'focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100',
                  error && 'border-red-400',
                  className,
              )}
              {...props}
          >
            {children}
          </select>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    ),
);
NativeSelect.displayName = 'NativeSelect';
