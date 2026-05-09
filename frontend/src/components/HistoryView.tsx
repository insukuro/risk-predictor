import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Clock,
    Filter,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    User,
    Activity,
    TrendingUp,
    AlertTriangle,
    Search,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Skeleton } from './ui/Skeleton';
import { cn, getRiskColor } from '../lib/utils';
import { fetchPredictions } from '../lib/api';
import type { PredictionRecord } from '../types';

function getOpTypeLabel(type: string): string {
    const map: Record<string, string> = {
        CABG: 'АКШ',
        Valve: 'Протезирование клапана',
        Aortic: 'Операция на аорте',
        Combined: 'Комбинированная',
    };
    return map[type] ?? type;
}

function formatRuDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

function MiniRiskBar({ score, level }: { score: number; level: string }) {
    const pct = Math.round(score * 100);
    const colors = getRiskColor(level as 'low' | 'medium' | 'high');

    return (
        <div className="flex items-center gap-3 min-w-[180px]">
            <div className="relative flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                {/* Зоны */}
                <div className="absolute inset-0 flex">
                    <div className="h-full bg-emerald-100" style={{ width: '30%' }} />
                    <div className="h-full bg-amber-100" style={{ width: '40%' }} />
                    <div className="h-full bg-red-100" style={{ width: '30%' }} />
                </div>
                {/* Значение */}
                <div
                    className={cn('absolute top-0 h-full rounded-full transition-all duration-500', colors.bar)}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-sm font-bold text-slate-800 w-10 text-right">{pct}%</span>
        </div>
    );
}

// Раскрытая карточка

function PredictionDetail({ record }: { record: PredictionRecord }) {
    const colors = getRiskColor(record.risk_level);
    const pct = Math.round(record.risk_score * 100);

    return (
        <div className="border-t border-slate-100 p-5 bg-slate-50/60 space-y-4">
            {/* Верхняя часть */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Пациент */}
                {record.patient && (
                    <div className="bg-white rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500 uppercase">Пациент</span>
                        </div>
                        <p className="text-sm text-slate-800">
                            ID: {record.patient.id} ·{' '}
                            {record.patient.sex === 'М' || record.patient.sex === 'male' ? 'Муж.' : 'Жен.'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Дата рождения: {new Date(record.patient.birth_date).toLocaleDateString('ru-RU')}
                        </p>
                    </div>
                )}

                {/* Операция */}
                <div className="bg-white rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500 uppercase">Операция</span>
                    </div>
                    <p className="text-sm text-slate-800">{getOpTypeLabel(record.operation.type)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Дата: {new Date(record.operation.date).toLocaleDateString('ru-RU')}
                    </p>
                </div>

                {/* Риск */}
                <div className={cn('rounded-lg p-3 border', colors.border, colors.bg)}>
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium uppercase">Уровень риска</span>
                    </div>
                    <p className={cn('text-2xl font-bold', colors.text)}>{pct}%</p>
                    <Badge className={cn(colors.badge, 'border', colors.border, 'mt-1')} variant="outline">
                        {colors.label}
                    </Badge>
                </div>
            </div>

            {/* Признаки */}
            <div>
                <p className="text-xs font-medium text-slate-400 uppercase mb-2">Клинические показатели</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {Object.entries(record.features).map(([key, val]) => (
                        <div
                            key={key}
                            className="bg-white rounded-lg px-3 py-2 border border-slate-100"
                        >
                            <p className="text-[11px] text-slate-400 truncate" title={key}>
                                {key}
                            </p>
                            <p className="text-sm font-medium text-slate-800">
                                {typeof val === 'number' ? (val % 1 !== 0 ? val.toFixed(2) : val) : String(val)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Дата расчёта */}
            <p className="text-xs text-slate-400 text-right">
                Рассчитано: {formatRuDate(record.created_at)}
            </p>
        </div>
    );
}

export function HistoryView() {
    const [searchId, setSearchId] = useState('');
    const [appliedFilter, setAppliedFilter] = useState<number | undefined>(undefined);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Загружаем предсказания
    const {
        data: predictions = [],
        isLoading,
        isError,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['predictions', appliedFilter],
        queryFn: () => fetchPredictions(appliedFilter),
        staleTime: 10_000,
    });

    // Обработываем фильтр
    const handleApplyFilter = () => {
        const id = searchId.trim() ? Number(searchId) : undefined;
        setAppliedFilter(isNaN(id as number) ? undefined : id);
    };

    const handleClearFilter = () => {
        setSearchId('');
        setAppliedFilter(undefined);
    };

    // Статистика
    const stats = useMemo(() => {
        const total = predictions.length;
        const high = predictions.filter(p => p.risk_level === 'high').length;
        const medium = predictions.filter(p => p.risk_level === 'medium').length;
        const low = predictions.filter(p => p.risk_level === 'low').length;
        return { total, high, medium, low };
    }, [predictions]);

    return (
        <div className="space-y-5">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                        <Clock className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">История предсказаний</h2>
                        <p className="text-xs text-slate-400">
                            Все сохранённые расчёты привязанные к пациентам
                        </p>
                    </div>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />}
                    onClick={() => refetch()}
                >
                    Обновить
                </Button>
            </div>

            {/* Статистика */}
            {!isLoading && predictions.length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: 'Всего', value: stats.total, color: 'text-slate-700 bg-slate-50 border-slate-200' },
                        { label: 'Низкий', value: stats.low, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                        { label: 'Средний', value: stats.medium, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                        { label: 'Высокий', value: stats.high, color: 'text-red-700 bg-red-50 border-red-200' },
                    ].map(s => (
                        <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.color)}>
                            <p className="text-2xl font-bold">{s.value}</p>
                            <p className="text-xs font-medium opacity-70">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Фильтр */}
            <Card>
                <CardContent className="flex items-end gap-3 py-3">
                    <div className="flex-1">
                        <Input
                            label="Фильтр по ID пациента"
                            type="number"
                            placeholder="Введите ID пациента..."
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                        />
                    </div>
                    <Button
                        variant="primary"
                        size="md"
                        icon={<Search className="h-4 w-4" />}
                        onClick={handleApplyFilter}
                    >
                        Найти
                    </Button>
                    {appliedFilter !== undefined && (
                        <Button
                            variant="ghost"
                            size="md"
                            onClick={handleClearFilter}
                        >
                            Сбросить
                        </Button>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <span className="text-xs text-slate-400">
              {appliedFilter ? `Пациент #${appliedFilter}` : 'Все записи'}
                            {' · '}
                            Найдено: {predictions.length}
            </span>
                    </div>
                </CardContent>
            </Card>

            {/* Загрузка */}
            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                    <Skeleton className="h-8 w-32 rounded-lg" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Ошибка */}
            {isError && (
                <Card className="border-red-200">
                    <CardContent className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-red-700">Не удалось загрузить историю</p>
                            <p className="text-xs text-red-500 mt-0.5">
                                Проверьте подключение к серверу и попробуйте обновить
                            </p>
                        </div>
                        <Button variant="outline" size="sm" className="ml-auto" onClick={() => refetch()}>
                            Повторить
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Пусто */}
            {!isLoading && !isError && predictions.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                            <Clock className="h-7 w-7 text-slate-300" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-600">Нет сохранённых предсказаний</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                Рассчитайте риск на вкладке «Калькулятор» и нажмите «Привязать к пациенту»,
                                чтобы результат появился здесь.
                            </p>
                        </div>
                        {appliedFilter !== undefined && (
                            <Button variant="ghost" size="sm" onClick={handleClearFilter}>
                                Сбросить фильтр
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Список предсказаний */}
            {!isLoading && predictions.length > 0 && (
                <div className="space-y-2">
                    {predictions.map((pred) => {
                        const isExpanded = expandedId === pred.id;
                        const colors = getRiskColor(pred.risk_level);

                        return (
                            <Card
                                key={pred.id}
                                className={cn(
                                    'overflow-hidden transition-all duration-200',
                                    isExpanded && 'ring-1 ring-indigo-200',
                                )}
                            >
                                {/* Строка-заголовок */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : pred.id)}
                                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors text-left"
                                >
                                    {/* ID */}
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                                        <span className="text-xs font-bold text-slate-500">#{pred.id}</span>
                                    </div>

                                    {/* Дата */}
                                    <span className="text-sm text-slate-500 w-36 shrink-0 hidden sm:block">
                    {formatRuDate(pred.created_at)}
                  </span>

                                    {/* Пациент */}
                                    {pred.patient && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <User className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="text-sm text-slate-600">
                        #{pred.patient.id}
                      </span>
                                        </div>
                                    )}

                                    {/* Операция */}
                                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 shrink-0" variant="outline">
                                        {getOpTypeLabel(pred.operation.type)}
                                    </Badge>

                                    {/* Риск — растягивается */}
                                    <div className="flex-1 flex items-center justify-end gap-3">
                                        <MiniRiskBar score={pred.risk_score} level={pred.risk_level} />
                                        <Badge className={cn(colors.badge, 'border', colors.border, 'shrink-0')} variant="outline">
                                            {colors.label}
                                        </Badge>
                                        {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                                        )}
                                    </div>
                                </button>

                                {/* Детали */}
                                {isExpanded && <PredictionDetail record={pred} />}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
