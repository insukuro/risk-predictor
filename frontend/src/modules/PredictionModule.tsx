import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Clipboard, 
  Trash2, 
  Sparkles,
  Send,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { toast } from '../components/ui/Toast';
import { DropZone } from '../components/DropZone';
import { DynamicForm } from '../components/DynamicForm';
import { ResultDisplay } from '../components/ResultDisplay';
import { getUISchema, submitPrediction, getDemoData } from '../api/predictions';
import { parseClipboardText, validateFieldValue } from '../utils/clipboardParser';
import type { SchemaResponse, FormValues, PredictResponse, UIField } from '../types';

type ViewState = 'form' | 'loading' | 'result';

// Умный преобразователь значений на основе типа поля
const smartValueConverter = (value: any, field: UIField): any => {
  // Если значение null или undefined, возвращаем null
  if (value === null || value === undefined) return null;

  switch (field.type) {
    case 'number': {
      // Для числовых полей
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // Очищаем строку от пробелов и заменяем запятую на точку
        const cleaned = value.trim().replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      }
      return null;
    }

    case 'boolean': {
      // Для boolean полей (0 или 1)
      if (typeof value === 'number') return value ? 1 : 0;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        // Проверяем различные варианты true/1
        if (['1', 'true', 'да', 'yes', 'муж', 'есть', 'включено'].includes(lower)) return 1;
        // Проверяем различные варианты false/0
        if (['0', 'false', 'нет', 'no', 'жен', 'отсутствует', 'выключено'].includes(lower)) return 0;
        // Пробуем преобразовать в число
        const num = parseInt(lower, 10);
        if (!isNaN(num)) return num ? 1 : 0;
        return 0;
      }
      return 0;
    }

    case 'select': {
      // Для select полей
      if (typeof value === 'number' || typeof value === 'string') {
        // Проверяем, есть ли значение в options
        const optionExists = field.options?.some(opt => 
          opt.value === value || String(opt.value) === String(value)
        );
        if (optionExists) return value;

        // Ищем по label
        if (field.options) {
          const matchedOption = field.options.find(opt => 
            opt.label.toLowerCase() === String(value).toLowerCase()
          );
          if (matchedOption) return matchedOption.value;
        }

        // Если это число в строке, пробуем преобразовать
        if (typeof value === 'string') {
          const num = parseFloat(value);
          if (!isNaN(num) && field.options?.some(opt => opt.value === num)) {
            return num;
          }
        }

        return value;
      }
      return value;
    }

    default:
      return value;
  }
};

export const PredictionModule: React.FC = () => {
  // Schema state
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Form state
  const [formValues, setFormValues] = useState<FormValues>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedVersion, setSelectedVersion] = useState<string>('');

  // View state
  const [viewState, setViewState] = useState<ViewState>('form');
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Load schema on mount
  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async (version?: string, keepValues: boolean = false) => {
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const data = await getUISchema(version);
      setSchema(data);
      setSelectedVersion(data.current_version);
      initializeForm(data, keepValues);
    } catch (error: any) {
      setSchemaError(error.message);
      toast.error('Ошибка загрузки схемы формы');
    } finally {
      setSchemaLoading(false);
    }
  };

  const initializeForm = (schemaData: SchemaResponse, keepExistingValues: boolean = false) => {
    if (keepExistingValues) {
      const updatedValues: FormValues = { ...formValues };
      
      schemaData.ui_schema.form_blocks.forEach(block => {
        block.fields.forEach(field => {
          if (!(field.id in updatedValues)) {
            updatedValues[field.id] = field.type === 'boolean' ? 0 : null;
          }
        });
      });
      
      setFormValues(updatedValues);
    } else {
      const initialValues: FormValues = {};
      schemaData.ui_schema.form_blocks.forEach(block => {
        block.fields.forEach(field => {
          if (field.type === 'boolean') {
            initialValues[field.id] = 0;
          } else {
            initialValues[field.id] = null;
          }
        });
      });
      setFormValues(initialValues);
    }
    
    setFormErrors({});
  };

  // Handle version change
  const handleVersionChange = (version: string) => {
    setSelectedVersion(version);
    loadSchema(version, true);
  };

  // Get all fields as flat array
  const getAllFields = useCallback((): UIField[] => {
    if (!schema) return [];
    return schema.ui_schema.form_blocks.flatMap(b => b.fields);
  }, [schema]);

  // Handle field change
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
    
    const field = getAllFields().find(f => f.id === fieldId);
    if (field) {
      const validation = validateFieldValue(value, field);
      if (!validation.valid) {
        setFormErrors(prev => ({ ...prev, [fieldId]: validation.error || '' }));
      } else {
        setFormErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[fieldId];
          return newErrors;
        });
      }
    }
  };

  // Умная обработка импорта данных (общая для всех источников)
  const smartDataImport = useCallback((rawData: Record<string, any>) => {
    const fields = getAllFields();
    const parsedData: FormValues = {};
    const newErrors: Record<string, string> = {};
    
    // Создаем карту полей для быстрого доступа
    const fieldMap = new Map(fields.map(f => [f.id, f]));
    
    // Также ищем поля по возможным альтернативным именам
    const fieldAliases = new Map<string, UIField>();
    fields.forEach(f => {
      // Добавляем варианты без пробелов и спецсимволов
      const normalizedId = f.id.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
      fieldAliases.set(normalizedId, f);
      
      // Добавляем варианты label как возможный ключ
      if (f.label) {
        const normalizedLabel = f.label.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
        fieldAliases.set(normalizedLabel, f);
      }
    });
    
    Object.entries(rawData).forEach(([key, value]) => {
      // Пробуем найти поле напрямую
      let field = fieldMap.get(key);
      
      // Если не нашли, ищем по альтернативным именам
      if (!field) {
        const normalizedKey = key.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
        field = fieldAliases.get(normalizedKey);
      }
      
      if (field) {
        // Преобразуем значение с учетом типа поля
        const convertedValue = smartValueConverter(value, field);
        parsedData[field.id] = convertedValue;
        
        // Валидируем преобразованное значение
        const validation = validateFieldValue(convertedValue, field);
        if (!validation.valid && validation.error) {
          newErrors[field.id] = validation.error;
        }
      } else {
        // Логируем неизвестные поля для отладки
        console.warn(`Unknown field in import: ${key}`);
      }
    });
    
    // Обновляем состояние
    setFormValues(prev => ({ ...prev, ...parsedData }));
    setFormErrors(prev => ({ ...prev, ...newErrors }));
    
    return {
      imported: Object.keys(parsedData).length,
      total: fields.length,
      errors: Object.keys(newErrors).length
    };
  }, [getAllFields]);

  // Handle data import from Excel
  const handleDataImport = (data: FormValues) => {
    const result = smartDataImport(data);
    toast.success(`Импортировано полей: ${result.imported} из ${result.total}`);
  };

  // Handle clipboard paste
  const handleClipboardPaste = async () => {
    try {
      const fields = getAllFields();
      const parseResult = await parseClipboardText(fields);
      
      if (!parseResult.success) {
        toast.warning('Буфер обмена пуст или данные не распознаны');
        return;
      }

      const result = smartDataImport(parseResult.values);
      toast.success(`Успешно заполнено ${result.imported} из ${result.total} полей`);
    } catch (error) {
      toast.error('Ошибка чтения буфера обмена. Разрешите доступ к буферу.');
    }
  };

  // Load demo data (теперь использует умный импорт)
// Load demo data
const handleLoadDemo = async () => {
  try {
    const apiResponse = await getDemoData();
    console.log('Raw API response:', apiResponse);
    
    // Извлекаем данные из ответа API
    let demoData: Record<string, any> = {};
    
    if (apiResponse) {
      if (apiResponse.data && typeof apiResponse.data === 'object' && !Array.isArray(apiResponse.data)) {
        // Стандартный формат: {status: 'success', data: {...}}
        demoData = apiResponse.data;
        console.log('Using response.data');
      } else if (apiResponse.status === 'success') {
        // Если data нет, но есть status, берем всё кроме status
        const { status, ...rest } = apiResponse;
        if (Object.keys(rest).length > 0) {
          demoData = rest;
          console.log('Using response without status');
        }
      } else if (typeof apiResponse === 'object' && !Array.isArray(apiResponse)) {
        // Возможно данные пришли напрямую
        demoData = apiResponse;
        console.log('Using direct response');
      }
    }
    
    console.log('Extracted demo data:', demoData);
    console.log('Demo data keys:', Object.keys(demoData));
    console.log('Form fields:', getAllFields().map(f => ({ id: f.id, type: f.type })));
    
    if (Object.keys(demoData).length === 0) {
      toast.error('Демо-данные пусты или имеют неверный формат');
      return;
    }
    
    const result = smartDataImport(demoData);
    
    if (result.imported === 0) {
      toast.warning('Не удалось сопоставить демо-данные с полями формы');
      // Покажем примеры ключей для отладки
      const demoSampleKeys = Object.keys(demoData).slice(0, 5);
      const formSampleKeys = getAllFields().slice(0, 5).map(f => f.id);
      console.log('Sample demo keys:', demoSampleKeys);
      console.log('Sample form keys:', formSampleKeys);
    } else {
      toast.success(`Демо-данные загружены (${result.imported} полей из ${result.total})`);
    }
  } catch (error: any) {
    console.error('Load demo error:', error);
    toast.error(error.message || 'Ошибка загрузки демо-данных');
  }
};

  // Clear form
  const handleClearForm = () => {
    if (schema) {
      initializeForm(schema, false);
      toast.info('Форма очищена');
    }
  };

  // Validate form before submit
  const validateForm = (): boolean => {
    const fields = getAllFields();
    const newErrors: Record<string, string> = {};
    let isValid = true;

    fields.forEach(field => {
      const value = formValues[field.id];
      const validation = validateFieldValue(value, field);
      
      if (!validation.valid && validation.error) {
        newErrors[field.id] = validation.error;
        isValid = false;
      }
    });

    setFormErrors(newErrors);
    return isValid;
  };

  // Submit prediction
  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Исправьте ошибки в форме');
      return;
    }

    setSubmitLoading(true);
    setViewState('loading');

    try {
      const calculatedFields = schema?.ui_schema.calculated_metrics_needed || [];
      const features: Record<string, any> = {};
      const newErrors: Record<string, string> = {};
      let hasMissingFields = false;
      
      const allFields = getAllFields();
      
      allFields.forEach(field => {
        if (calculatedFields.includes(field.id)) return;

        const value = formValues[field.id];

        if (value === null || value === undefined || value === '' || Number.isNaN(value)) {
          newErrors[field.id] = 'Поле обязательно для заполнения';
          hasMissingFields = true;
        } else {
          features[field.id] = field.type === 'boolean' 
            ? Boolean(value) 
            : Number(value); 
        }
      });

      if (hasMissingFields) {
        setFormErrors(prev => ({ ...prev, ...newErrors }));
        toast.error('Пожалуйста, заполните все обязательные поля');
        setViewState('form');
        setSubmitLoading(false);
        return;
      }

      const response = await submitPrediction(features, selectedVersion);
      setResult(response);
      setViewState('result');
      toast.success('Прогноз успешно рассчитан');
      
    } catch (error: any) {
      toast.error(error.message || 'Ошибка расчета прогноза');
      setViewState('form');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle back from results
  const handleBackToForm = () => {
    setViewState('form');
    setResult(null);
  };

  // Handle new prediction
  const handleNewPrediction = () => {
    handleClearForm();
    setViewState('form');
    setResult(null);
  };

  // Render loading state
  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-slate-600">Загрузка схемы формы...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (schemaError) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <Activity className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">
              Ошибка загрузки
            </h3>
            <p className="text-slate-600 mb-4">{schemaError}</p>
            <Button onClick={() => loadSchema()} icon={<RefreshCw className="h-4 w-4" />}>
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render result view
  if (viewState === 'result' && result) {
    return (
      <ResultDisplay
        result={result}
        onBack={handleBackToForm}
        onNewPrediction={handleNewPrediction}
      />
    );
  }

  // Render loading overlay
  if (viewState === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-slate-600">Расчёт прогноза...</p>
        </div>
      </div>
    );
  }

  // Render form
  return (
    <div className="space-y-6">
      {/* Header with tools */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            ML-прогнозирование рисков
          </h2>
          <p className="text-slate-600 mt-1">
            Заполните данные пациента для расчета прогноза
          </p>
        </div>

        {/* Version selector */}
        {schema && schema.available_versions.length > 1 && (
          <div className="w-48">
            <Select
              label="Версия модели"
              options={schema.available_versions.map(v => ({
                value: v,
                label: v === schema.current_version ? `${v} (текущая)` : v,
              }))}
              value={selectedVersion}
              onChange={(val) => handleVersionChange(String(val))}
              disabled={schemaLoading}
            />
          </div>
        )}
      </div>

      {/* Import tools */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <DropZone
                fields={getAllFields()}
                onDataImport={handleDataImport}
              />
            </div>

            <div className="flex flex-col gap-2 lg:w-56">
              <Button
                variant="secondary"
                onClick={handleClipboardPaste}
                icon={<Clipboard className="h-4 w-4" />}
                className="justify-start"
              >
                Вставить из буфера
              </Button>
              <Button
                variant="secondary"
                onClick={handleLoadDemo}
                icon={<Sparkles className="h-4 w-4" />}
                className="justify-start"
              >
                Демо-данные
              </Button>
              <Button
                variant="secondary"
                onClick={handleClearForm}
                icon={<Trash2 className="h-4 w-4" />}
                className="justify-start"
              >
                Очистить форму
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic form */}
      {schema && (
        <DynamicForm
          formBlocks={schema.ui_schema.form_blocks}
          values={formValues}
          onChange={handleFieldChange}
          errors={formErrors}
          highlightPump={true}
        />
      )}

      {/* Submit button */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={handleSubmit}
          loading={submitLoading}
          icon={<Send className="h-5 w-5" />}
          className="px-12"
        >
          Рассчитать прогноз
        </Button>
      </div>
    </div>
  );
};