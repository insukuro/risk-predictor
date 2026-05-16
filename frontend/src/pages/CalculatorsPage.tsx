import { useEffect, useMemo, useState } from 'react';
import { Card, Input, Select, Switch } from '../components/ui/Primitives';
import { calculateMetrics } from '../lib/api';
import type { CalculatorResponse, PatientFeatures } from '../types';
import { riskLevelBg, riskLevelLabel } from '../lib/utils';
import { Activity, Calculator as CalcIcon, Heart, Scale, FlaskConical } from 'lucide-react';

type CalculatorKey = 'all' | 'bmi' | 'clcr' | 'euroscore' | 'cci' | 'chads';

const CALCULATORS: { key: CalculatorKey; label: string; icon: typeof Activity; desc: string }[] = [
  { key: 'all', label: 'Все расчёты', icon: CalcIcon, desc: 'Полный набор метрик' },
  { key: 'bmi', label: 'ИМТ', icon: Scale, desc: 'Индекс массы тела' },
  { key: 'clcr', label: 'Клиренс креатинина', icon: FlaskConical, desc: 'Формула Кокрофта-Голта' },
  { key: 'euroscore', label: 'EuroSCORE II', icon: Activity, desc: 'Операционный риск' },
  { key: 'cci', label: 'Индекс Чарлсона', icon: Heart, desc: 'Коморбидность' },
  { key: 'chads', label: 'CHA₂DS₂-VASc / HAS-BLED', icon: Activity, desc: 'Риск инсульта при ФП' },
];

export function CalculatorsPage() {
  const [selected, setSelected] = useState<CalculatorKey>('all');
  const [features, setFeatures] = useState<PatientFeatures>({
    'Пол (0=жен,1=муж)': 1,
    'Возраст (лет)': 65,
    'Рост (м)': 1.75,
    'Вес (кг)': 80,
    'Креатинин в ОРИТ (мкмоль/л)': 90,
    'Категория ФВ ЛЖ': 55,
    'ХСН ФК': 1,
    'Срочность (0=план,1=экстр)': 0,
    'Гипертония (0/1)': 1,
    'Сахарный диабет (0/1)': 0,
    'ХОБЛ (0/1)': 0,
    'ИМ в анамнезе (0/1)': 0,
    'ХСН (0/1)': 0,
    'ОНМК в анамнезе (0/1)': 0,
    'ФП в анамнезе (0/1)': 0,
    'Атеросклероз НК (0/1)': 0,
    'Атеросклероз БЦА (0/1)': 0,
    'Язвенная болезнь ЖКТ (0/1)': 0,
    'Лёгочная гипертензия (0/1)': 0,
    pump: 1,
  } as PatientFeatures);
  const [metrics, setMetrics] = useState<CalculatorResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await calculateMetrics(features);
        setMetrics(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [features]);

  const updateField = (key: keyof PatientFeatures, value: number) => {
    setFeatures((f) => ({ ...f, [key]: value }));
  };

  const filteredMetrics = useMemo(() => {
    if (!metrics) return {};
    if (selected === 'all') return metrics.metrics;
    const map: Record<string, string[]> = {
      bmi: ['ИМТ (кг/м²)'],
      clcr: ['Клиренс креатинина (мл/мин)'],
      euroscore: ['EuroSCORE II (%)'],
      cci: ['Индекс коморбидности Чарлсона'],
      chads: ['CHA₂DS₂-VASc', 'HAS-BLED'],
    };
    const keys = map[selected] ?? [];
    const out: Record<string, CalculatorResponse['metrics'][string]> = {};
    keys.forEach((k) => {
      if (metrics.metrics[k]) out[k] = metrics.metrics[k];
    });
    return out;
  }, [metrics, selected]);

  const currentCalc = CALCULATORS.find((c) => c.key === selected)!;

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Клинические калькуляторы</h1>
        <p className="text-sm text-slate-500">Отдельный доступ к валидированным формулам</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_360px]">
        {/* Меню калькуляторов */}
        <Card padding={false}>
          <div className="p-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Калькуляторы
          </div>
          <div className="space-y-0.5 p-2">
            {CALCULATORS.map((c) => {
              const Icon = c.icon;
              const isActive = selected === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setSelected(c.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.label}</div>
                    <div className="truncate text-[10px] text-slate-500">{c.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Форма */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <currentCalc.icon className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">{currentCalc.label}</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              label="Возраст"
              unit="лет"
              value={features['Возраст (лет)'] as number}
              onChange={(v) => updateField('Возраст (лет)', v)}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Пол</label>
              <Select
                value={String(features['Пол (0=жен,1=муж)'])}
                onChange={(e) => updateField('Пол (0=жен,1=муж)', Number(e.target.value))}
              >
                <option value="1">Мужской</option>
                <option value="0">Женский</option>
              </Select>
            </div>
            <NumberField
              label="Рост"
              unit="м"
              step={0.01}
              value={features['Рост (м)'] as number}
              onChange={(v) => updateField('Рост (м)', v)}
            />
            <NumberField
              label="Вес"
              unit="кг"
              step={0.5}
              value={features['Вес (кг)'] as number}
              onChange={(v) => updateField('Вес (кг)', v)}
            />
            <NumberField
              label="Креатинин"
              unit="мкмоль/л"
              value={features['Креатинин в ОРИТ (мкмоль/л)'] as number}
              onChange={(v) => updateField('Креатинин в ОРИТ (мкмоль/л)', v)}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">ФВ ЛЖ</label>
              <Select
                value={String(features['Категория ФВ ЛЖ'])}
                onChange={(e) => updateField('Категория ФВ ЛЖ', Number(e.target.value))}
              >
                <option value="55">Нормальная (&gt;50%)</option>
                <option value="40">Умеренно снижена</option>
                <option value="25">Тяжёлая дисфункция</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">ХСН ФК (NYHA)</label>
              <Select
                value={String(features['ХСН ФК'])}
                onChange={(e) => updateField('ХСН ФК', Number(e.target.value))}
              >
                <option value="1">I ФК</option>
                <option value="2">II ФК</option>
                <option value="3">III ФК</option>
                <option value="4">IV ФК</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Срочность</label>
              <Select
                value={String(features['Срочность (0=план,1=экстр)'])}
                onChange={(e) =>
                  updateField('Срочность (0=план,1=экстр)', Number(e.target.value))
                }
              >
                <option value="0">Плановая</option>
                <option value="1">Экстренная</option>
              </Select>
            </div>

            {/* Флаги */}
            <ToggleField
              label="Гипертония"
              checked={Boolean(features['Гипертония (0/1)'])}
              onChange={(v) => updateField('Гипертония (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="Сахарный диабет"
              checked={Boolean(features['Сахарный диабет (0/1)'])}
              onChange={(v) => updateField('Сахарный диабет (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="ХОБЛ"
              checked={Boolean(features['ХОБЛ (0/1)'])}
              onChange={(v) => updateField('ХОБЛ (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="ИМ в анамнезе"
              checked={Boolean(features['ИМ в анамнезе (0/1)'])}
              onChange={(v) => updateField('ИМ в анамнезе (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="ХСН"
              checked={Boolean(features['ХСН (0/1)'])}
              onChange={(v) => updateField('ХСН (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="ОНМК / Инсульт"
              checked={Boolean(features['ОНМК в анамнезе (0/1)'])}
              onChange={(v) => updateField('ОНМК в анамнезе (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="Фибрилляция предсердий"
              checked={Boolean(features['ФП в анамнезе (0/1)'])}
              onChange={(v) => updateField('ФП в анамнезе (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="Атеросклероз БЦА"
              checked={Boolean(features['Атеросклероз БЦА (0/1)'])}
              onChange={(v) => updateField('Атеросклероз БЦА (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="Атеросклероз НК"
              checked={Boolean(features['Атеросклероз НК (0/1)'])}
              onChange={(v) => updateField('Атеросклероз НК (0/1)', v ? 1 : 0)}
            />
            <ToggleField
              label="Язвенная болезнь ЖКТ"
              checked={Boolean(features['Язвенная болезнь ЖКТ (0/1)'])}
              onChange={(v) => updateField('Язвенная болезнь ЖКТ (0/1)', v ? 1 : 0)}
            />
          </div>
        </Card>

        {/* Результат */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Результат (live)
          </h3>
          {loading && (
            <div className="rounded-lg bg-slate-100 p-3 text-center text-xs text-slate-500">
              Расчёт…
            </div>
          )}
          {!loading && Object.keys(filteredMetrics).length === 0 && selected === 'chads' && (
            <Card className="p-4 text-center text-sm text-slate-500">
              Для расчёта CHA₂DS₂-VASc и HAS-BLED включите «Фибрилляция предсердий»
            </Card>
          )}
          {Object.entries(filteredMetrics).map(([name, m]) => (
            <Card key={name} className={`border-2 ${riskLevelBg(m.level)}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                {name}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{m.value}</span>
                <span className="text-xs opacity-70">{m.label}</span>
              </div>
              <div className="mt-1 text-[11px] font-medium">
                Интерпретация: <span className="font-bold">{riskLevelLabel(m.level)}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-700">
        {label} {unit && <span className="text-slate-400">({unit})</span>}
      </label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}
