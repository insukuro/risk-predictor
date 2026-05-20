import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  RefreshCw,
  Send,
  LayoutGrid,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { Badge, getRiskLevelLabel } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { getCalculatorMetadata, calculateAllMetrics } from '../api/calculators';
import { cn } from '../utils/cn';
import type { CalculatorMetadata, UIAllMetricsResponse, FormValues, UIResultItem } from '../types';

// Field metadata for grouping and display
const FIELD_METADATA: Record<string, {
  label: string;
  group: string;
  type: 'number' | 'select';
  options?: { value: number; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}> = {
  'Пол (0=жен,1=муж)': {
    label: 'Пол',
    group: 'Общая информация',
    type: 'select',
    options: [
      { value: 0, label: 'Женский' },
      { value: 1, label: 'Мужской' },
    ],
  },
  'Возраст (лет)': {
    label: 'Возраст (лет)',
    group: 'Общая информация',
    type: 'number',
    min: 0,
    max: 120,
  },
  'Вес (кг)': {
    label: 'Вес (кг)',
    group: 'Общая информация',
    type: 'number',
    min: 10,
    max: 300,
  },
  'Рост (м)': {
    label: 'Рост (м)',
    group: 'Общая информация',
    type: 'number',
    min: 0.5,
    max: 2.5,
    step: 0.01,
  },
  'Креатинин в ОРИТ (мкмоль/л)': {
    label: 'Креатинин (мкмоль/л)',
    group: 'Лабораторные показатели',
    type: 'number',
    min: 0,
    max: 2000,
  },
  'Категория ФВ ЛЖ': {
    label: 'Категория ФВ ЛЖ',
    group: 'Кардиометрия',
    type: 'select',
    options: [
      { value: 1, label: 'Нормальная (≥50%)' },
      { value: 2, label: 'Умеренно снижена (30-49%)' },
      { value: 3, label: 'Низкая (<30%)' },
    ],
  },
  'ХСН ФК': {
    label: 'ХСН Функциональный класс',
    group: 'Кардиометрия',
    type: 'select',
    options: [
      { value: 0, label: 'Нет ХСН' },
      { value: 1, label: 'I ФК' },
      { value: 2, label: 'II ФК' },
      { value: 3, label: 'III ФК' },
      { value: 4, label: 'IV ФК' },
    ],
  },
  'Лёгочная гипертензия (0/1)': {
    label: 'Лёгочная гипертензия',
    group: 'Кардиометрия',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'Гипертония (0/1)': {
    label: 'Артериальная гипертензия',
    group: 'Анамнез',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'ФП в анамнезе (0/1)': {
    label: 'Фибрилляция предсердий',
    group: 'Анамнез',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'ИМ в анамнезе (0/1)': {
    label: 'Инфаркт миокарда в анамнезе',
    group: 'Анамнез',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'ХСН (0/1)': {
    label: 'Хроническая сердечная недостаточность',
    group: 'Анамнез',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'Сахарный диабет (0/1)': {
    label: 'Сахарный диабет',
    group: 'Коморбидность',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'ХОБЛ (0/1)': {
    label: 'ХОБЛ',
    group: 'Коморбидность',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'ОНМК в анамнезе (0/1)': {
    label: 'ОНМК в анамнезе',
    group: 'Коморбидность',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'Атеросклероз НК (0/1)': {
    label: 'Атеросклероз нижних конечностей',
    group: 'Коморбидность',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'Атеросклероз БЦА (0/1)': {
    label: 'Атеросклероз БЦА',
    group: 'Коморбидность',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'Язвенная болезнь ЖКТ (0/1)': {
    label: 'Язвенная болезнь ЖКТ',
    group: 'Коморбидность',
    type: 'select',
    options: [
      { value: 0, label: 'Нет' },
      { value: 1, label: 'Да' },
    ],
  },
  'Срочность (0=план,1=экстр)': {
    label: 'Срочность операции',
    group: 'Операция',
    type: 'select',
    options: [
      { value: 0, label: 'Плановая' },
      { value: 1, label: 'Экстренная' },
    ],
  },
  'pump': {
    label: 'Искусственное кровообращение',
    group: 'Операция',
    type: 'select',
    options: [
      { value: 0, label: 'Off-pump' },
      { value: 1, label: 'On-pump' },
    ],
  },
};

export const CalculatorModule: React.FC = () => {
  // State
  const [metadata, setMetadata] = useState<CalculatorMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculator selection
  const [selectedCalculator, setSelectedCalculator] = useState<string>('all');

  // Form values
  const [formValues, setFormValues] = useState<FormValues>({});

  // Results
  const [results, setResults] = useState<UIAllMetricsResponse | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Load metadata
  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCalculatorMetadata();
      setMetadata(data);
      // Initialize form with default values
      initializeForm(data.required_inputs);
    } catch (err: any) {
      setError(err.message);
      toast.error('Ошибка загрузки метаданных калькулятора');
    } finally {
      setLoading(false);
    }
  };

  const initializeForm = (fields: string[]) => {
    const initialValues: FormValues = {};
    fields.forEach(fieldId => {
      const meta = FIELD_METADATA[fieldId];
      if (meta?.type === 'select' && meta.options) {
        initialValues[fieldId] = meta.options[0]?.value ?? 0;
      } else {
        initialValues[fieldId] = null;
      }
    });
    setFormValues(initialValues);
  };

  // Get visible fields based on selected calculator
  const visibleFields = useMemo(() => {
    if (!metadata) return [];

    if (selectedCalculator === 'all') {
      return metadata.required_inputs;
    }

    const calc = metadata.calculators[selectedCalculator];
    return calc?.required_inputs || [];
  }, [metadata, selectedCalculator]);

  // Group fields by category
  const groupedFields = useMemo(() => {
    const groups: Record<string, string[]> = {};

    visibleFields.forEach(fieldId => {
      const meta = FIELD_METADATA[fieldId];
      const group = meta?.group || 'Прочее';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(fieldId);
    });

    return groups;
  }, [visibleFields]);

  // Calculator options
  const calculatorOptions = useMemo(() => {
    if (!metadata) return [];

    const options = [
      { value: 'all', label: 'Общий калькулятор (Все шкалы)' },
    ];

    Object.entries(metadata.calculators).forEach(([id, calc]) => {
      options.push({ value: id, label: calc.label });
    });

    return options;
  }, [metadata]);

  // Handle field change
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
  };

  // Handle calculator change
  const handleCalculatorChange = (calcId: string) => {
    setSelectedCalculator(calcId);
    setResults(null);
  };

  // Handle calculate
  const handleCalculate = async () => {
    setCalculating(true);
    setResults(null);

    try {
      // Build payload with only visible fields
      const payload: FormValues = {};
      visibleFields.forEach(fieldId => {
        const value = formValues[fieldId];
        if (value !== null && value !== undefined) {
          payload[fieldId] = value;
        }
      });

      const response = await calculateAllMetrics(payload);
      setResults(response);
      toast.success('Расчёт выполнен успешно');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка расчёта');
    } finally {
      setCalculating(false);
    }
  };

  // Render field
  const renderField = (fieldId: string) => {
    const meta = FIELD_METADATA[fieldId];
    const value = formValues[fieldId];
    const isCategorical = metadata?.categorical_inputs.includes(fieldId);

    if (isCategorical || meta?.type === 'select') {
      return (
        <Select
          key={fieldId}
          label={meta?.label || fieldId}
          options={meta?.options || [
            { value: 0, label: 'Нет' },
            { value: 1, label: 'Да' },
          ]}
          value={value as number | undefined}
          onChange={(val) => handleFieldChange(fieldId, val)}
        />
      );
    }

    return (
      <Input
        key={fieldId}
        label={meta?.label || fieldId}
        type="number"
        value={value !== null && value !== undefined ? String(value) : ''}
        onChange={(e) => {
          const val = e.target.value.replace(',', '.');
          handleFieldChange(fieldId, val === '' ? null : parseFloat(val));
        }}
        min={meta?.min}
        max={meta?.max}
        step={meta?.step}
        placeholder={`Введите ${(meta?.label || fieldId).toLowerCase()}`}
      />
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-slate-600">Загрузка калькуляторов...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <Calculator className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">
              Ошибка загрузки
            </h3>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={loadMetadata} icon={<RefreshCw className="h-4 w-4" />}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Медицинские калькуляторы
          </h2>
          <p className="text-slate-600 mt-1">
            Расчёт клинических шкал и индексов
          </p>
        </div>

        {/* Calculator selector */}
        <div className="w-full lg:w-80">
          <Select
            label="Выберите калькулятор"
            options={calculatorOptions}
            value={selectedCalculator}
            onChange={(val) => handleCalculatorChange(String(val))}
          />
        </div>
      </div>

      {/* Calculator info */}
      {selectedCalculator !== 'all' && metadata?.calculators[selectedCalculator] && (
        <Card variant="default" className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Calculator className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-900">
                  {metadata.calculators[selectedCalculator].label}
                </h3>
                <p className="text-sm text-blue-700">
                  Требуется {visibleFields.length} параметров
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <div className="space-y-6">
        {Object.entries(groupedFields).map(([group, fields]) => (
          <Card key={group}>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">{group}</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fields.map(renderField)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calculate button */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={handleCalculate}
          loading={calculating}
          icon={<Send className="h-5 w-5" />}
          className="px-12"
        >
          Рассчитать метрики
        </Button>
      </div>

      {/* Results */}
      {results && results.metrics && (
        <ResultsGrid metrics={results.metrics} />
      )}
    </div>
  );
};

// Results grid component
interface ResultsGridProps {
  metrics: Record<string, UIResultItem>;
}

const ResultsGrid: React.FC<ResultsGridProps> = ({ metrics }) => {
  const getLevelBorderColor = (level: string): string => {
    switch (level) {
      case 'low': return 'border-green-400';
      case 'medium': return 'border-yellow-400';
      case 'high': return 'border-orange-400';
      case 'danger': return 'border-red-400';
      default: return 'border-slate-300';
    }
  };

  const getLevelBgColor = (level: string): string => {
    switch (level) {
      case 'low': return 'bg-green-50';
      case 'medium': return 'bg-yellow-50';
      case 'high': return 'bg-orange-50';
      case 'danger': return 'bg-red-50';
      default: return 'bg-slate-50';
    }
  };

  const getLevelTextColor = (level: string): string => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'danger': return 'text-red-600';
      default: return 'text-slate-600';
    }
  };

  const formatValue = (value: number): string => {
    if (value < 1) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value.toFixed(2);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
        <LayoutGrid className="h-5 w-5" />
        Результаты расчёта
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(metrics).map(([key, item]) => (
          <div
            key={key}
            className={cn(
              'rounded-xl border-2 p-5',
              getLevelBorderColor(item.level),
              getLevelBgColor(item.level)
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">
                {key}
              </h4>
              <Badge variant={item.level as any} size="sm">
                {getRiskLevelLabel(item.level)}
              </Badge>
            </div>
            <div className={cn(
              'text-4xl font-bold mb-2',
              getLevelTextColor(item.level)
            )}>
              {formatValue(item.value)}
            </div>
            <p className="text-sm text-slate-600">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
