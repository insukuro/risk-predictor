import React from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: number | string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: number | string | undefined | null;
  onChange: (value: number | string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Выберите...',
  error,
  disabled,
  className,
}) => {
  const normalizedValue =
    value === null || value === undefined ? '' : String(value);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          value={normalizedValue}
          onChange={(e) => {
            const rawValue = e.target.value;
            const matchedOption = options.find(
              (option) => String(option.value) === rawValue
            );

            onChange(matchedOption ? matchedOption.value : rawValue);
          }}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-2 border rounded-lg appearance-none cursor-pointer',
            'text-slate-900 bg-white',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-colors duration-200',
            error ? 'border-red-500 bg-red-50' : 'border-slate-300 hover:border-slate-400',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>

          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};