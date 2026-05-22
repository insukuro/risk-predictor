
// modules/AnalyticsModule.tsx
import React, { useState, useEffect } from 'react';
import {
  BarChart2, Users, Activity, TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, getRiskLevelLabel } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import {
  getOperationsSummary,
  getAgeDistribution,
  getPredictionStats,
} from '../api/analytics';
import { cn } from '../utils/cn';
import type { AnalyticsSummary, AgeDistribution } from '../types';

// ──────────────────────────────────────────────
// Вспомогательные компоненты
// ──────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title, value, subtitle, icon, color = 'text-blue-600',
}) => (
  <Card>
    <CardContent className="pt-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={cn('text-3xl font-bold mt-1', color)}>{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn('p-2 rounded-lg bg-slate-50', color)}>{icon}</div>
      </div>
    </CardContent>
  </Card>
);

// Простой горизонтальный бар-чарт (без сторонних зависимостей)
interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  title: string;
  maxValue?: number;
}

const HorizontalBar: React.FC<BarChartProps> = ({ data, title, maxValue }) => {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1);
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 truncate max-w-[70%]">
                {item.label}
              </span>
              <span className="font-medium text-slate-900">{item.value}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  item.color ?? 'bg-blue-500'
                )}
                style={{ width: `${(item.value / max) }%` }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            Нет данных
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// ──────────────────────────────────────────────
// Основной модуль
// ──────────────────────────────────────────────


const OP_TYPE_COLORS: Record<string, string> = {
  CABG: 'bg-blue-500',
  AVR: 'bg-violet-500',
  MVR: 'bg-purple-500',
  OTHER: 'bg-slate-400',
};

export const AnalyticsModule: React.FC = () => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [ageData, setAgeData] = useState<AgeDistribution[]>([]);
  const [recentPredictions, setRecentPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Фильтры дат
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, ageDistData, predsData] = await Promise.all([
        getOperationsSummary(dateFrom || undefined, dateTo || undefined),
        getAgeDistribution(),
        getPredictionStats(undefined, 0, 100),
      ]);
      setSummary(summaryData);
      setAgeData(ageDistData);
      setRecentPredictions(predsData);
    } catch (e: any) {
      setError(e.message);
      toast.error('Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Подсчёт распределения риска из предсказаний
  const riskDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {};
    recentPredictions.forEach(p => {
      const level = p.risk_level || 'unknown';
      counts[level] = (counts[level] ?? 0) + 1;
    });
    return counts;
  }, [recentPredictions]);

  // Средний риск
  const avgRisk = React.useMemo(() => {
    if (recentPredictions.length === 0) return 0;
    const sum = recentPredictions.reduce(
      (acc, p) => acc + (p.risk_score ?? 0),
      0
    );
    return (sum / recentPredictions.length);
  }, [recentPredictions]);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-slate-600">Загрузка аналитики...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Аналитика</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Сводная статистика по операциям и прогнозам
          </p>
        </div>

        {/* Фильтр дат + кнопка */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">От</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className={cn(
                'px-3 py-1.5 border border-slate-300 rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-400'
              )}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">До</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className={cn(
                'px-3 py-1.5 border border-slate-300 rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-400'
              )}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            loading={loading}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Обновить
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Всего операций"
          value={summary?.total_operations ?? '—'}
          icon={<Activity className="h-5 w-5" />}
          color="text-blue-600"
          subtitle="в базе данных"
        />
        <StatCard
          title="Прогнозов"
          value={recentPredictions.length}
          icon={<BarChart2 className="h-5 w-5" />}
          color="text-violet-600"
          subtitle="последние 100"
        />
        <StatCard
          title="Средний риск"
          value={`${avgRisk.toFixed(1)}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          color={
            avgRisk < 15
              ? 'text-green-600'
              : avgRisk < 35
              ? 'text-yellow-600'
              : 'text-red-600'
          }
          subtitle="по последним прогнозам"
        />
        <StatCard
          title="Типов операций"
          value={Object.keys(summary?.by_type ?? {}).length}
          icon={<Users className="h-5 w-5" />}
          color="text-emerald-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* По типу операций */}
        <HorizontalBar
          title="Операции по типу"
          data={(() => {
            // Берем данные из summary
            const byType = summary?.by_type ?? {};
            
            // Преобразуем объект {CABG: 3, AVR: 2} в массив для графика
            return Object.entries(byType).map(([typeName, count]) => ({
              label: typeName,
              value: count,
              color: OP_TYPE_COLORS[typeName] ?? 'bg-slate-400',
            }));
          })()}
        />

        {/* Распределение риска */}
        <HorizontalBar
          title="Распределение уровней риска"
          data={[
            { label: 'Низкий', value: riskDistribution['low'] ?? 0, color: 'bg-green-500' },
            { label: 'Средний', value: riskDistribution['medium'] ?? 0, color: 'bg-yellow-500' },
            { label: 'Высокий', value: riskDistribution['high'] ?? 0, color: 'bg-orange-500' },
            { label: 'Критический', value: riskDistribution['danger'] ?? 0, color: 'bg-red-500' },
          ]}
        />
      </div>

      {/* Возрастное распределение */}
      {ageData.length > 0 && (
        <HorizontalBar
          title="Возрастное распределение пациентов"
          data={ageData.map(d => ({
            label: d.age_group,
            value: d.count,
            color: 'bg-indigo-500',
          }))}
        />
      )}

      {/* Последние прогнозы — таблица */}
      {recentPredictions.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-800">
              Последние прогнозы
            </h3>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 text-slate-500 font-medium">
                      ID
                    </th>
                    <th className="text-left py-2 pr-4 text-slate-500 font-medium">
                      Пациент
                    </th>
                    <th className="text-left py-2 pr-4 text-slate-500 font-medium">
                      Операция
                    </th>
                    <th className="text-left py-2 pr-4 text-slate-500 font-medium">
                      Риск
                    </th>
                    <th className="text-left py-2 pr-4 text-slate-500 font-medium">
                      Уровень
                    </th>
                    <th className="text-left py-2 text-slate-500 font-medium">
                      Дата
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentPredictions.slice(0, 15).map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        #{p.id}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {p.patient ? `#${p.patient.id}` : '—'}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {p.operation?.type ?? '—'}
                      </td>
                      <td className="py-2 pr-4 font-semibold">
                        {p.risk_score != null
                          ? `${(p.risk_score).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={p.risk_level as any} size="sm">
                          {getRiskLevelLabel(p.risk_level)}
                        </Badge>
                      </td>
                      <td className="py-2 text-slate-500 text-xs">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};