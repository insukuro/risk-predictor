import React, { useState, useEffect, useCallback } from 'react';
import { Clipboard, RefreshCw, Send } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
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
  if (value == null) return null; // Исправлено: было value = null

  switch (field.type) {
    case 'number': {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const cleaned = value.trim().replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      }
      return null;
    }
    case 'boolean': {
      if (typeof value === 'number') return value ? 1 : 0;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (['1', 'true', 'да', 'yes', 'муж', 'есть', 'включено'].includes(lower)) return 1;
        if (['0', 'false', 'нет', 'no', 'жен', 'отсутствует', 'выключено'].includes(lower)) return 0;
        const num = parseInt(lower, 10);
        if (!isNaN(num)) return num ? 1 : 0;
        return 0;
      }
      return 0;
    }
    case 'select': {
      if (typeof value === 'number' || typeof value === 'string') { // Исправлено: было =
        const optionExists = field.options?.some(opt => 
          opt.value == value || String(opt.value) === String(value) // Исправлено
        );
        if (optionExists) return value;
        
        if (field.options) {
          const matchedOption = field.options.find(opt => 
            opt.label.toLowerCase() === String(value).toLowerCase()
          );
          if (matchedOption) return matchedOption.value;
        }
        
        if (typeof value === 'string') {
          const num = parseFloat(value);
          if (!isNaN(num) && field.options?.some(opt => opt.value === num)) {
            return num;
          }
        }
      }
      return value;
    }
    default:
      return value;
  }
};

export const PredictionModule: React.FC = () => {
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedVersion, setSelectedVersion] = useState('');
  const [viewState, setViewState] = useState<ViewState>('form');
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

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
          initialValues[field.id] = field.type === 'boolean' ? 0 : null;
        });
      });
      setFormValues(initialValues);
    }
    setFormErrors({});
  };

  const handleVersionChange = (version: string) => {
    setSelectedVersion(version);
    loadSchema(version, true);
  };

  const getAllFields = useCallback((): UIField[] => {
    if (!schema) return [];
    return schema.ui_schema.form_blocks.flatMap(b => b.fields);
  }, [schema]);

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

  const smartDataImport = useCallback((rawData: Record<string, any>) => {
    const fields = getAllFields();
    const parsedData: FormValues = {};
    const newErrors: Record<string, string> = {};
    const fieldMap = new Map(fields.map(f => [f.id, f]));
    const fieldAliases = new Map<string, UIField>();

    fields.forEach(f => {
      const normalizedId = f.id.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
      fieldAliases.set(normalizedId, f);
      if (f.label) {
        const normalizedLabel = f.label.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
        fieldAliases.set(normalizedLabel, f);
      }
    });

    Object.entries(rawData).forEach(([key, value]) => {
      let field = fieldMap.get(key);
      if (!field) {
        const normalizedKey = key.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
        field = fieldAliases.get(normalizedKey);
      }
      if (field) {
        const convertedValue = smartValueConverter(value, field);
        parsedData[field.id] = convertedValue;
        const validation = validateFieldValue(convertedValue, field);
        if (!validation.valid && validation.error) {
          newErrors[field.id] = validation.error;
        }
      } else {
        console.warn(`Unknown field in import: ${key}`);
      }
    });

    setFormValues(prev => ({ ...prev, ...parsedData }));
    setFormErrors(prev => ({ ...prev, ...newErrors }));
    
    return {
      imported: Object.keys(parsedData).length,
      total: fields.length,
      errors: Object.keys(newErrors).length
    };
  }, [getAllFields]);

  const handleDataImport = (data: FormValues) => {
    const result = smartDataImport(data);
    toast.success(`Импортировано полей: ${result.imported} из ${result.total}`);
  };

  const handleClipboardPaste = async () => {
    try {
      const parseResult = await parseClipboardText(getAllFields());
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

  const handleLoadDemo = async () => {
    try {
      const apiResponse = await getDemoData();
      let demoData: Record<string, any> = {};
      
      if (apiResponse?.data && typeof apiResponse.data === 'object' && !Array.isArray(apiResponse.data)) {
        demoData = apiResponse.data;
      } else if (apiResponse?.status === 'success') {
        const { status, ...rest } = apiResponse;
        demoData = rest;
      } else if (apiResponse && typeof apiResponse === 'object' && !Array.isArray(apiResponse)) {
        demoData = apiResponse;
      }

      if (Object.keys(demoData).length === 0) {
        toast.error('Демо-данные пусты или имеют неверный формат');
        return;
      }
      
      const result = smartDataImport(demoData);
      if (result.imported === 0) {
        toast.warning('Не удалось сопоставить демо-данные с полями формы');
      } else {
        toast.success(`Демо-данные загружены (${result.imported} полей из ${result.total})`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Ошибка загрузки демо-данных');
    }
  };

  const handleClearForm = () => {
    if (schema) {
      initializeForm(schema, false);
      toast.info('Форма очищена');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;
    getAllFields().forEach(field => {
      const validation = validateFieldValue(formValues[field.id], field);
      if (!validation.valid && validation.error) {
        newErrors[field.id] = validation.error;
        isValid = false;
      }
    });
    setFormErrors(newErrors);
    return isValid;
  };

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
      let hasMissingFields = false;
      const newErrors: Record<string, string> = {};

      getAllFields().forEach(field => {
        if (calculatedFields.includes(field.id)) return;
        const value = formValues[field.id];
        
        if (value == null || value === '' || Number.isNaN(value as any)) {
          newErrors[field.id] = 'Поле обязательно для заполнения';
          hasMissingFields = true;
        } else {
          features[field.id] = field.type === 'boolean' ? Boolean(value) : Number(value);
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

  if (schemaLoading) return <div className="p-8 text-center">Загрузка схемы формы...</div>;
  
  if (schemaError) return (
    <div className="p-8 text-center text-red-600">
      <p className="mb-4">Ошибка загрузки: {schemaError}</p>
      <Button onClick={() => loadSchema()}>Повторить</Button>
    </div>
  );

  if (viewState === 'result' && result) {
    return (
      <ResultDisplay 
        result={result} 
        onBack={() => { setViewState('form'); setResult(null); }} 
        onNewPrediction={handleClearForm} 
      />
    );
  }

  if (viewState === 'loading') return <div className="p-8 text-center">Расчёт прогноза...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold">ML-прогнозирование рисков</h2>
          <p className="text-slate-500">Заполните данные пациента для расчета прогноза</p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {schema && schema.available_versions.length > 1 && (
            <div className="w-64">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="secondary" onClick={handleClipboardPaste} className="w-full justify-start">
              <Clipboard className="w-4 h-4 mr-2" /> Вставить из буфера
            </Button>
            <Button variant="secondary" onClick={handleLoadDemo} className="w-full justify-start">
              <RefreshCw className="w-4 h-4 mr-2" /> Демо-данные
            </Button>
            <Button variant="secondary" onClick={handleClearForm} className="w-full justify-start text-red-600 hover:text-red-700">
               Очистить форму
            </Button>
          </div>
          
          <DropZone fields={getAllFields()} onDataImport={handleDataImport} />

          {schema && (
            <DynamicForm
              formBlocks={schema.ui_schema.form_blocks}
              values={formValues}
              onChange={handleFieldChange}
              errors={formErrors}
              highlightPump={true}
            />
          )}

          <div className="pt-6 border-t">
            <Button size="lg" onClick={handleSubmit} disabled={submitLoading} className="w-full md:w-auto px-12">
              <Send className="w-5 h-5 mr-2" /> Рассчитать прогноз
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};