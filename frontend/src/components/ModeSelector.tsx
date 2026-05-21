// components/ModeSelector.tsx
import React from 'react';
import { FlaskConical, UserCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import type { PredictionMode } from '../types';

interface ModeSelectorProps {
  mode: PredictionMode;
  onChange: (mode: PredictionMode) => void;
  disabled?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  mode,
  onChange,
  disabled = false,
}) => {
  const options: Array<{
    value: PredictionMode;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      value: 'test',
      label: 'Тестовый режим',
      description: 'Расчёт без сохранения в базу данных',
      icon: <FlaskConical className="h-5 w-5" />,
      color: 'border-blue-500 bg-blue-50 text-blue-700',
    },
    {
      value: 'patient',
      label: 'Пациент',
      description: 'Расчёт с привязкой к карточке пациента',
      icon: <UserCheck className="h-5 w-5" />,
      color: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {options.map((opt) => {
        const isActive = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all flex-1',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isActive
                ? opt.color
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
            )}
          >
            <span className={cn(
              'mt-0.5 shrink-0',
              isActive ? '' : 'text-slate-400'
            )}>
              {opt.icon}
            </span>
            <div>
              <div className="font-semibold text-sm">{opt.label}</div>
              <div className={cn(
                'text-xs mt-0.5',
                isActive ? 'opacity-80' : 'text-slate-500'
              )}>
                {opt.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};