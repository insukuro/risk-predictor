import { Controller, useForm } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, User, HeartPulse, Activity, FlaskConical } from 'lucide-react';
import { Card, Input, Select, Switch, Button } from '../ui/Primitives';
import { ExcelPaster } from './ExcelPaster';
import { FIELD_GROUPS, FIELD_SCHEMA, AVAILABLE_MODELS, DEMO_DATA } from '../../lib/schema';
import type { PatientFeatures } from '../../types';
import { classNames } from '../../lib/utils';

interface PredictiveFormProps {
  onValuesChange: (values: PatientFeatures) => void;
  modelVersion: string;
  onModelChange: (v: string) => void;
  resetTrigger: number;
}

const GROUP_ICONS = {
  general: User,
  anamnesis: HeartPulse,
  operation: Activity,
  labs: FlaskConical,
} as const;

export function PredictiveForm({
  onValuesChange,
  modelVersion,
  onModelChange,
  resetTrigger,
}: PredictiveFormProps) {
  const { control, watch, setValue, reset } = useForm<PatientFeatures>({
    defaultValues: DEMO_DATA,
    mode: 'onChange',
  });

  const values = watch();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Отправляем первое изменение при монтировании
    onValuesChange(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced update на изменения
  useEffect(() => {
    const timer = setTimeout(() => {
      onValuesChange(values);
    }, 300);
    return () => clearTimeout(timer);
  }, [values, onValuesChange]);

  // Reset handler
  useEffect(() => {
    if (resetTrigger > 0) {
      reset(DEMO_DATA);
    }
  }, [resetTrigger, reset]);

  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof FIELD_SCHEMA> = {};
    FIELD_SCHEMA.forEach((f) => {
      if (!groups[f.group]) groups[f.group] = [];
      groups[f.group].push(f);
    });
    return groups;
  }, []);

  const toggleGroup = (group: string) => {
    setCollapsed((c) => ({ ...c, [group]: !c[group] }));
  };

  const handlePaste = (data: Partial<PatientFeatures>) => {
    Object.entries(data).forEach(([k, v]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue(k as any, v as number);
    });
  };

  return (
    <div className="space-y-3">
      {/* Умный импорт */}
      <ExcelPaster onDataParsed={handlePaste} />

      {/* Модель и заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Данные пациента</h2>
          <p className="text-xs text-slate-500">
            Прогноз обновляется автоматически при изменении любого параметра
          </p>
        </div>
        <Select
          value={modelVersion}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-48"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Группы полей */}
      <div className="space-y-2">
        {Object.entries(groupedFields).map(([groupKey, fields]) => {
          const Icon = GROUP_ICONS[groupKey as keyof typeof GROUP_ICONS];
          const isCollapsed = collapsed[groupKey];
          const groupLabel = FIELD_GROUPS[groupKey as keyof typeof FIELD_GROUPS].label;
          return (
            <Card key={groupKey} padding={false} className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">{groupLabel}</div>
                  <div className="text-[11px] text-slate-500">{fields.length} параметров</div>
                </div>
                <ChevronDown
                  className={classNames(
                    'h-4 w-4 text-slate-400 transition-transform',
                    isCollapsed ? '-rotate-90' : 'rotate-0'
                  )}
                />
              </button>

              {!isCollapsed && (
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {fields.map((field) => (
                    <Controller
                      key={field.key}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      name={field.key as any}
                      control={control}
                      render={({ field: f }) => {
                        if (field.type === 'toggle') {
                          return (
                            <div className="flex items-center justify-between rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-slate-100">
                              <label className="text-xs font-medium text-slate-700">
                                {field.label}
                              </label>
                              <Switch
                                id={field.key}
                                checked={Boolean(f.value)}
                                onChange={(v) => f.onChange(v ? 1 : 0)}
                              />
                            </div>
                          );
                        }
                        if (field.type === 'select') {
                          return (
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-700">
                                {field.label}
                              </label>
                              <Select
                                value={String(f.value ?? '')}
                                onChange={(e) => f.onChange(Number(e.target.value))}
                              >
                                {field.options?.map((o) => (
                                  <option key={String(o.value)} value={String(o.value)}>
                                    {o.label}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          );
                        }
                        return (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">
                              {field.label}
                              {field.unit && (
                                <span className="ml-1 font-normal text-slate-400">({field.unit})</span>
                              )}
                            </label>
                            <Input
                              type="number"
                              step={field.step ?? 1}
                              min={field.min}
                              max={field.max}
                              value={f.value as number}
                              onChange={(e) => f.onChange(Number(e.target.value))}
                              placeholder={field.unit}
                            />
                          </div>
                        );
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Авто-расчёт активен
        </div>
        <Button variant="ghost" size="sm" onClick={() => reset(DEMO_DATA)}>
          Сбросить к демо-данным
        </Button>
      </div>
    </div>
  );
}
