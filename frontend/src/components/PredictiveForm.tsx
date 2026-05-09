import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { Button } from './ui/Button';
import { SkeletonForm } from './ui/Skeleton';
import { getDefaultFeatureValue, isCategoricalBoolean } from '../lib/utils';
import type { ModelConfig } from '../types';

interface PredictiveFormProps {
  config?: ModelConfig;
  isLoading?: boolean;
  isPredicting?: boolean;
  onSubmit: (features: Record<string, unknown>) => void;
}

function buildSchema(features: string[], categoricals: string[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of features) {
    if (categoricals.includes(f) || isCategoricalBoolean(f)) {
      shape[f] = z.boolean();
    } else {
      shape[f] = z.preprocess(
          (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
          z.number({ message: 'Введите число' }),
      );
    }
  }
  return z.object(shape);
}

function buildDefaults(features: string[], categoricals: string[]) {
  const defaults: Record<string, unknown> = {};
  for (const f of features) {
    if (categoricals.includes(f) || isCategoricalBoolean(f)) {
      defaults[f] = false;
    } else {
      defaults[f] = getDefaultFeatureValue(f);
    }
  }
  return defaults;
}

export function PredictiveForm({ config, isLoading, isPredicting, onSubmit }: PredictiveFormProps) {
  const features = config?.features ?? [];
  const categoricals = config?.categorical_features ?? [];

  const featuresKey = features.join(',');
  const categoricalsKey = categoricals.join(',');

  const schema = useMemo(() => buildSchema(features, categoricals), [featuresKey, categoricalsKey]);
  const defaults = useMemo(() => buildDefaults(features, categoricals), [featuresKey, categoricalsKey]);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    reset(defaults);
  }, [featuresKey]);

  const handleFormSubmit = (data: Record<string, unknown>) => {
    // Конвертируем boolean → 0/1 для категориальных
    const converted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      converted[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
    }
    onSubmit(converted);
  };

  if (isLoading || features.length === 0) {
    return (
        <div className="space-y-5">
          <SkeletonForm count={8} />
          <div className="flex justify-end">
            <div className="h-9 w-36 rounded-lg bg-slate-100 animate-pulse" />
          </div>
        </div>
    );
  }

  return (
      <form onSubmit={handleSubmit(handleFormSubmit as never)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
          {features.map((feature) => {
            const isCat = categoricals.includes(feature) || isCategoricalBoolean(feature);
            const fieldError = errors[feature]?.message as string | undefined;

            if (isCat) {
              return (
                  <Controller
                      key={feature}
                      name={feature}
                      control={control}
                      render={({ field }) => (
                          <Switch
                              label={feature}
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                          />
                      )}
                  />
              );
            }

            return (
                <Controller
                    key={feature}
                    name={feature}
                    control={control}
                    render={({ field }) => (
                        <Input
                            {...field}
                            label={feature}
                            type="number"
                            step="any"
                            value={field.value as number}
                            onChange={(e) => field.onChange(e.target.value)}
                            error={fieldError}
                            placeholder={String(getDefaultFeatureValue(feature))}
                        />
                    )}
                />
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => reset(defaults)}
          >
            Сбросить
          </Button>
          <Button
              type="submit"
              loading={isPredicting}
              icon={!isPredicting ? <FlaskConical className="h-4 w-4" /> : undefined}
              size="md"
          >
            {isPredicting ? 'Вычисление...' : 'Рассчитать риск'}
          </Button>
        </div>
      </form>
  );
}
