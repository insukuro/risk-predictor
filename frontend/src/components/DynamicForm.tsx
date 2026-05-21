import React from 'react';
import { cn } from '../utils/cn';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Toggle } from './ui/Toggle'; // Убрано из /ui/ так как Toggle ниже экспортируется в корне
import { Card, CardContent } from './ui/Card';
import { AlertCircle } from 'lucide-react';
import type { FormBlock, UIField, FormValues } from '../types';

interface DynamicFormProps {
  formBlocks: FormBlock[];
  values: FormValues;
  onChange: (fieldId: string, value: any) => void;
  errors?: Record<string, string>;
  highlightPump?: boolean;
  visibleFields?: string[] | null;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  formBlocks,
  values,
  onChange,
  errors = {},
  highlightPump = true,
  visibleFields = null,
}) => {
  const pumpField = formBlocks
    .flatMap(b => b.fields)
    .find(f => f.id.toLowerCase().includes('pump'));

  const renderField = (field: UIField) => {
    if (visibleFields !== null && !visibleFields.includes(field.id)) return null;
    const value = values[field.id];
    const error = errors[field.id];
    const isPumpField = field.id.toLowerCase().includes('pump');

    return (
      <div key={field.id} className="flex flex-col space-y-1">
        {field.type === 'number' && (
          <Input
            label={field.label}
            type="number"
            value={value != null ? String(value) : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                onChange(field.id, null);
              } else {
                const normalized = val.replace(',', '.');
                const num = parseFloat(normalized);
                onChange(field.id, isNaN(num) ? val : num);
              }
            }}
            placeholder={field.placeholder || `Введите ${field.label.toLowerCase()}`}
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            step={field.step ?? undefined}
            error={error}
          />
        )}
        
        {field.type === 'select' && (
          <Select
            label={field.label}
            options={field.options || []}
            value={value as number | string | undefined}
            onChange={(val) => onChange(field.id, val)}
            placeholder={field.placeholder || 'Выберите...'}
            error={error}
          />
        )}
        
        {field.type === 'boolean' && (
          <div className="pt-6">
            <Toggle
              label={field.label}
              checked={value === 1 || value === true} // Исправлено: = на ===
              onChange={(checked) => onChange(field.id, checked ? 1 : 0)}
              variant={isPumpField && highlightPump ? 'danger' : 'default'}
              size={isPumpField && highlightPump ? 'lg' : 'md'}
            />
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderPumpHighlight = () => {
    if (!highlightPump || !pumpField) return null;
    const pumpValue = values[pumpField.id];
    const isOn = pumpValue === 1 || pumpValue === true; // Исправлено
    
    return (
      <Card className={cn("mb-6 border-2", isOn ? 'border-red-500 bg-red-50' : 'border-slate-200')}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className={cn('h-6 w-6', isOn ? 'text-red-600' : 'text-slate-400')} />
            <div>
              <h3 className="font-semibold text-lg">Искусственное кровообращение (ИК)</h3>
              <p className={cn("text-sm", isOn ? 'text-red-700' : 'text-slate-500')}>
                {isOn ? 'Операция с ИК — повышенный риск осложнений' : 'Операция без ИК (off-pump)'}
              </p>
            </div>
          </div>
          <Toggle
            checked={isOn}
            onChange={(checked) => onChange(pumpField.id, checked ? 1 : 0)}
            variant="danger"
            size="lg"
          />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {renderPumpHighlight()}
      {formBlocks.map((block) => {
        const visibleBlockFields = block.fields
          .filter(f => {
            if (highlightPump && f.id.toLowerCase().includes('pump')) return false;
            if (visibleFields !== null) return visibleFields.includes(f.id);
            return true;
          })
          .sort((a, b) => a.order - b.order);

        if (visibleBlockFields.length === 0) return null;

        return (
          <div key={block.block_name} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">
              {block.block_name}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleBlockFields.map(renderField)}
            </div>
          </div>
        );
      })}
    </div>
  );
};