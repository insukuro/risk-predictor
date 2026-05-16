import { useMemo, useState } from 'react';
import { Card, Badge, Button, Input, Select } from '../components/ui/Primitives';
import { deleteRecord, loadHistory } from '../lib/api';
import { riskLevelBg, riskLevelLabel, formatDate } from '../lib/utils';
import type { HistoryRecord, RiskLevel } from '../types';
import { Search, Trash2, X, Download, History as HistIcon, TrendingUp } from 'lucide-react';

export function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>(() => loadHistory());
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | RiskLevel>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [selected, setSelected] = useState<HistoryRecord | null>(null);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (levelFilter !== 'all' && r.riskLevel !== levelFilter) return false;
      if (dateFrom && new Date(r.date) < new Date(dateFrom)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.operationId.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q) ||
          r.id.toString().includes(q)
        );
      }
      return true;
    });
  }, [records, levelFilter, dateFrom, search]);

  const stats = useMemo(() => {
    const total = records.length;
    const highRisk = records.filter((r) => r.riskLevel === 'danger' || r.riskLevel === 'high').length;
    const avgScore = total > 0 ? records.reduce((s, r) => s + r.riskScore, 0) / total : 0;
    return { total, highRisk, avgScore };
  }, [records]);

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Удалить запись из истории?')) return;
    const updated = deleteRecord(id);
    setRecords(updated);
    if (selected?.id === id) setSelected(null);
  };

  const exportCSV = () => {
    const header = 'ID,Дата,Операция,Риск%,Уровень,Модель,EuroSCORE\n';
    const rows = filtered
      .map(
        (r) =>
          `${r.id},${r.date},${r.operationId},${r.riskScore.toFixed(1)},${riskLevelLabel(r.riskLevel)},${r.model},${r.euroscore.toFixed(1)}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">История прогнозов</h1>
          <p className="text-sm text-slate-500">
            {filtered.length} из {records.length} записей
          </p>
        </div>
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="h-4 w-4" />
          Экспорт CSV
        </Button>
      </div>

      {/* Статистика */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <HistIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Всего прогнозов
            </div>
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Высокий риск
            </div>
            <div className="text-xl font-bold text-slate-900">{stats.highRisk}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Средний риск
            </div>
            <div className="text-xl font-bold text-slate-900">{stats.avgScore.toFixed(1)}%</div>
          </div>
        </Card>
      </div>

      {/* Фильтры */}
      <Card className="mb-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Поиск по ID операции, модели…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}>
            <option value="all">Все уровни риска</option>
            <option value="danger">Критический</option>
            <option value="high">Высокий</option>
            <option value="medium">Умеренный</option>
            <option value="low">Низкий</option>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Дата от"
          />
        </div>
      </Card>

      {/* Таблица */}
      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  Дата
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  ID операции
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  Риск
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  EuroSCORE
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  Модель
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                    Записей не найдено
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-xs text-slate-600">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900">
                    {r.operationId}
                  </td>
                  <td className="px-4 py-3">
                    <Badge level={r.riskLevel}>
                      {r.riskScore.toFixed(1)}% · {riskLevelLabel(r.riskLevel)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.euroscore.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                      {r.model}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => handleDelete(r.id, e)}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Drawer с деталями */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4">
              <div>
                <div className="text-xs text-slate-500">Детали прогноза</div>
                <div className="font-mono text-sm font-semibold text-slate-900">
                  {selected.operationId}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {/* Главный риск */}
              <Card className={riskLevelBg(selected.riskLevel)}>
                <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  Летальность (основной прогноз)
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{selected.riskScore.toFixed(1)}%</span>
                  <span className="text-sm font-semibold">{riskLevelLabel(selected.riskLevel)}</span>
                </div>
              </Card>

              {/* Targets */}
              <Card>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Целевые риски
                </h3>
                <div className="space-y-2">
                  {selected.targets.map((t) => (
                    <div
                      key={t.name}
                      className={`flex items-center justify-between rounded-lg border p-2.5 ${riskLevelBg(t.level)}`}
                    >
                      <span className="text-xs font-medium">{t.name}</span>
                      <span className="font-mono text-sm font-bold">{t.score.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Метаданные */}
              <Card>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Метаданные
                </h3>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Дата</dt>
                    <dd className="font-medium text-slate-900">{formatDate(selected.date)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">ID записи</dt>
                    <dd className="font-mono font-medium text-slate-900">#{selected.id}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Модель</dt>
                    <dd className="font-mono font-medium text-slate-900">{selected.model}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">EuroSCORE II</dt>
                    <dd className="font-medium text-slate-900">{selected.euroscore.toFixed(1)}%</dd>
                  </div>
                </dl>
              </Card>

              {/* Features */}
              <Card>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Введённые параметры ({Object.keys(selected.features).length})
                </h3>
                <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
                  {Object.entries(selected.features)
                    .filter(([, v]) => v !== undefined && v !== null && v !== '')
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-100 py-1">
                        <span className="text-slate-600">{k}</span>
                        <span className="font-mono font-medium text-slate-900">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
