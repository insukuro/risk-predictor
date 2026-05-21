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

// Расширяем тип метаданных, так как бэкенд теперь присылает и конфигурацию полей
interface ExtendedCalculatorMetadata extends CalculatorMetadata {
  field_metadata: Record<string, {
    label: string;
    group: string;
    type: 'number' | 'select';
    options?: { value: number; label: string }[];
    min?: number;
    max?: number;
    step?: number;
  }>;
}

export const CalculatorModule: React.FC = () => {
  // State
  const [metadata, setMetadata] = useState<ExtendedCalculatorMetadata | null>(null);
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
      const data = await getCalculatorMetadata() as ExtendedCalculatorMetadata;
      setMetadata(data);
      initializeForm(data.required_inputs, data.field_metadata);
    } catch (err: any) {
      setError(err.message);
      toast.error('Ошибка загрузки метаданных калькулятора');
    } finally {
      setLoading(false);
    }
  };

  const initializeForm = (fields: string[], fieldMetadata: Record<string, any>) => {
    const initialValues: FormValues = {};
    fields.forEach(fieldId => {
      const meta = fieldMetadata?.[fieldId];
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

    return metadata.calculators[selectedCalculator]?.required_inputs || [];
  }, [metadata, selectedCalculator]);

  // Group fields by category using dynamic metadata from backend
  const groupedFields = useMemo(() => {
    const groups: Record<string, string[]> = {};
    if (!metadata?.field_metadata) return groups;

    visibleFields.forEach(fieldId => {
      const meta = metadata.field_metadata[fieldId];
      const group = meta?.group || 'Прочее';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(fieldId);
    });

    return groups;
  }, [visibleFields, metadata]);

  // Calculator options for selection dropdown
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
    setResults(null); // Сбрасываем старые результаты, чтобы они не путали пользователя
    
    if (metadata) {
      // Переинициализируем форму под новый набор полей
      const fields = calcId === 'all' 
        ? metadata.required_inputs 
        : metadata.calculators[calcId]?.required_inputs || [];
      initializeForm(fields, metadata.field_metadata);
    }
  };

  // Handle calculate
  const handleCalculate = async () => {
    setCalculating(true);
    setResults(null);

    try {
      // Собираем фичи только для тех полей, которые видны на экране
      const features: FormValues = {};
      visibleFields.forEach(fieldId => {
        const value = formValues[fieldId];
        if (value !== null && value !== undefined) {
          features[fieldId] = value;
        }
      });

      // Передаем структурированный payload в обновленный API клиент
      const response = await calculateAllMetrics({
        features,
        calculator_id: selectedCalculator
      });
      
      setResults(response);
      toast.success('Расчёт выполнен успешно');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка расчёта');
    } finally {
      setCalculating(false);
    }
  };

  // Render field dynamically based on backend schema
  const renderField = (fieldId: string) => {
    const meta = metadata?.field_metadata?.[fieldId];
    const value = formValues[fieldId];
    const isCategorical = metadata?.categorical_inputs?.includes(fieldId);

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
          <p className="text-slate-600">Загрузка конфигурации калькуляторов...</p>
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
              Ошибка загрузки конфигурации
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
            Расчёт клинических шкал и индексов на основе динамических моделей бэкенда
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

      {/* Calculator info badge */}
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
                  Необходимо заполнить параметров: {visibleFields.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dynamic Form Blocks */}
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

      {/* Action button */}
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

      {/* Filtered Results */}
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