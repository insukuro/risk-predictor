import { GaugeChart } from './GaugeChart';
import { Badge, Card, Button } from '../ui/Primitives';
import { riskLevelBg } from '../../lib/utils';
import type { CalculatorResponse, PredictionResponse } from '../../types';
import { Save, RefreshCw, AlertTriangle } from 'lucide-react';

interface ResultDisplayProps {
  prediction: PredictionResponse | null;
  metrics: CalculatorResponse | null;
  isLoading: boolean;
  canSave: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function ResultDisplay({
  prediction,
  metrics,
  isLoading,
  canSave,
  onSave,
  onReset,
}: ResultDisplayProps) {
  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        <div className="mt-4 text-sm text-slate-500">Расчёт рисков…</div>
      </Card>
    );
  }

  if (!prediction) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <AlertTriangle className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">Нет данных</h3>
          <p className="mt-1 text-xs text-slate-500">
            Заполните форму слева — прогноз обновляется автоматически в реальном времени.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Главный риск */}
      <Card className="p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Главный риск</h3>
          <Badge level="info">v4-ensemble</Badge>
        </div>
        <GaugeChart value={prediction.risk_score} level={prediction.risk_level} />
      </Card>

      {/* Targets (мультикласс) */}
      <Card>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Вероятности осложнений
        </h3>
        <div className="space-y-2.5">
          {prediction.targets
            .filter((t) => t.name !== 'Летальность')
            .map((target) => (
              <div key={target.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{target.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${riskLevelBg(target.level).split(' ')[2]}`}>
                      {target.score.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      target.level === 'danger'
                        ? 'bg-gradient-to-r from-red-500 to-rose-600'
                        : target.level === 'high'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500'
                        : target.level === 'medium'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                        : 'bg-gradient-to-r from-emerald-400 to-green-500'
                    }`}
                    style={{ width: `${Math.min(100, target.score)}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* Клинические индексы */}
      {metrics && (
        <Card>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Клинические индексы
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(metrics.metrics).slice(0, 6).map(([name, m]) => (
              <div
                key={name}
                className={`rounded-lg border p-2.5 ${riskLevelBg(m.level)}`}
              >
                <div className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                  {name.replace(/ \(.*\)/, '')}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-lg font-bold leading-none">{m.value}</span>
                  <span className="text-[10px] opacity-70">
                    {name.includes('ИМТ') && 'кг/м²'}
                    {name.includes('Клиренс') && 'мл/мин'}
                    {name.includes('EuroSCORE') && '%'}
                  </span>
                </div>
                <div className="mt-1 text-[10px] opacity-80 line-clamp-1">{m.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Действия */}
      <div className="flex gap-2">
        <Button
          onClick={onSave}
          disabled={!canSave}
          className="flex-1"
          size="md"
        >
          <Save className="h-4 w-4" />
          Сохранить
        </Button>
        <Button onClick={onReset} variant="secondary" size="md">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
