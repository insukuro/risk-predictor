import { TrendingUp, TrendingDown, Minus, UserPlus, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { cn, getRiskColor } from '../lib/utils';
import type { PredictionResult } from '../types';

interface ResultDisplayProps {
  result: PredictionResult;
  onSave?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
}

function RiskGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const r = 44;
  const circumference = 2 * Math.PI * r;
  // Показываем 75% окружности (270 градусов)
  const arc = circumference * 0.75;
  const fill = arc * (pct / 100);
  const offset = circumference * 0.125; // старт с 135 градусов

  const color = pct < 30 ? '#10b981' : pct < 70 ? '#f59e0b' : '#ef4444';

  return (
      <div className="relative flex items-center justify-center w-28 h-28 mx-auto">
        <svg className="w-28 h-28 -rotate-[135deg]" viewBox="0 0 100 100">
          {/* Фоновая дуга */}
          <circle
              cx="50" cy="50" r={r}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
              strokeDasharray={`${arc} ${circumference - arc}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
          />
          {/* Заполненная дуга */}
          <circle
              cx="50" cy="50" r={r}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={`${fill} ${circumference - fill}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold text-slate-900">{pct}%</span>
          <span className="text-[10px] text-slate-400 mt-0.5">риск</span>
        </div>
      </div>
  );
}

export function ResultDisplay({ result, onSave, isSaved, isSaving }: ResultDisplayProps) {
  const colors = getRiskColor(result.risk_level);
  const pct = Math.round(result.risk_score * 100);

  const Icon = pct < 30 ? TrendingDown : pct < 70 ? Minus : TrendingUp;

  return (
      <Card className={cn('border-2', colors.border, 'transition-all duration-300')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colors.bg)}>
                <Icon className={cn('h-4 w-4', colors.text)} />
              </div>
              <CardTitle>Результат прогноза</CardTitle>
            </div>
            <Badge className={cn(colors.badge, 'border', colors.border)} variant="outline">
              {colors.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Спидометр */}
          <div className={cn('rounded-xl p-4', colors.bg)}>
            <RiskGauge score={result.risk_score} />
          </div>

          {/* Прогресс-бар с зонами */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Низкий (0–30%)</span>
              <span>Средний (30–70%)</span>
              <span>Высокий (70–100%)</span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="absolute inset-0 flex">
                <div className="h-full bg-emerald-100" style={{ width: '30%' }} />
                <div className="h-full bg-amber-100" style={{ width: '40%' }} />
                <div className="h-full bg-red-100" style={{ width: '30%' }} />
              </div>
              <div
                  className={cn('absolute top-0 h-full rounded-full transition-all duration-700', colors.bar)}
                  style={{ width: `${pct}%`, opacity: 0.8 }}
              />
              <div
                  className="absolute top-0 h-full w-0.5 bg-slate-700 transition-all duration-700"
                  style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>0%</span>
              <span className={cn('font-medium', colors.text)}>{pct}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Мета-информация */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-slate-400">Версия модели</p>
              <p className="font-medium text-slate-700 mt-0.5">{result.version}</p>
            </div>
            {result.framework && (
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-slate-400">Фреймворк</p>
                  <p className="font-medium text-slate-700 mt-0.5 capitalize">{result.framework}</p>
                </div>
            )}
          </div>

          {/* Интерпретация */}
          <div className={cn('rounded-lg p-3 text-sm', colors.bg, colors.text)}>
            {result.risk_level === 'low' && (
                <>Низкий уровень риска. Рекомендуется плановое наблюдение.</>
            )}
            {result.risk_level === 'medium' && (
                <>Средний уровень риска. Рекомендуется дополнительное обследование.</>
            )}
            {result.risk_level === 'high' && (
                <>Высокий уровень риска. Требуется срочная консультация специалиста.</>
            )}
          </div>

          {/* Кнопки действий */}
          {!isSaved ? (
              <Button
                  className="w-full"
                  variant="outline"
                  icon={<UserPlus className="h-4 w-4" />}
                  onClick={onSave}
                  loading={isSaving}
                  size="md"
              >
                {isSaving ? 'Сохранение...' : 'Привязать к пациенту'}
              </Button>
          ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Сохранено в карту пациента</span>
              </div>
          )}
        </CardContent>
      </Card>
  );
}
