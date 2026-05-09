import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  return (
      <div className={cn('flex flex-col gap-1', className)}>
        {label && (
            <label className="text-xs font-medium text-slate-600 truncate" title={label}>
              {label}
            </label>
        )}
        <div className="flex items-center gap-2 h-9">
          <RadixSwitch.Root
              checked={checked}
              onCheckedChange={onCheckedChange}
              disabled={disabled}
              className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
                  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  checked ? 'bg-indigo-600' : 'bg-slate-200',
              )}
          >
            <RadixSwitch.Thumb
                className={cn(
                    'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                    checked ? 'translate-x-4' : 'translate-x-0',
                )}
            />
          </RadixSwitch.Root>
          <span className="text-sm text-slate-700">{checked ? 'Да' : 'Нет'}</span>
        </div>
      </div>
  );
}
