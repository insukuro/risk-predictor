import React, { useState, useEffect, useCallback } from 'react';
import { Clipboard, RefreshCw, Send, FlaskConical, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { toast } from '../components/ui/Toast';
import { DropZone } from '../components/DropZone';
import { DynamicForm } from '../components/DynamicForm';
import { ResultDisplay } from '../components/ResultDisplay';
import { ModeSelector } from '../components/ModeSelector';
import { PatientSelector } from '../components/PatientSelector';
import { getUISchema, submitPrediction, getDemoData } from '../api/predictions';
import { parseClipboardText, validateFieldValue } from '../utils/clipboardParser';
import type {
  SchemaResponse, FormValues, PredictResponse,
  UIField, PredictionMode, Patient,
} from '../types';

type ViewState = 'form' | 'loading' | 'result';

// ─── Умный преобразователь значений ───
const smartValueConverter = (value: any, field: UIField): any => {
  if (value === null || value === undefined) return null;
  switch (field.type) {
    case 'number': {
      if (typeof value === 'number') return value;
      const cleaned = value.toString().trim();
      const romanMap: Record<string, number> = {
        'I': 1, 'II': 2, 'III': 3, 'IV': 4,
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4,
      };
      if (romanMap[cleaned] !== undefined) return romanMap[cleaned];
      const num = parseFloat(cleaned.replace(',', '.'));
      return isNaN(num) ? null : num;
    }
    case 'boolean': {
      if (typeof value === 'number') return value ? 1 : 0;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (['1','true','да','yes','муж','есть','включено','on'].includes(lower)) return 1;
        return 0;
      }
      return 0;
    }
    case 'select': {
      if (typeof value === 'string' && field.options) {
        const trimmed = value.trim();
        const byLabel = field.options.find(
          o => o.label.toLowerCase() === trimmed.toLowerCase()
        );
        if (byLabel) return byLabel.value;
        const byPartial = field.options.find(
          o =>
            trimmed.toLowerCase().includes(o.label.toLowerCase()) ||
            o.label.toLowerCase().includes(trimmed.toLowerCase())
        );
        if (byPartial) return byPartial.value;
        const numVal = parseFloat(trimmed);
        if (!isNaN(numVal) && field.options?.some(o => o.value === numVal))
          return numVal;
      }
      if (typeof value === 'number' && field.options?.some(o => o.value === value))
        return value;
      return value;
    }
    default:
      return value;
  }
};


export const PredictionModule: React.FC = () => {
  // ─── State ───
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedVersion, setSelectedVersion] = useState('');
  const [viewState, setViewState] = useState<ViewState>('form');
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Режим
  const [predictionMode, setPredictionMode] = useState<PredictionMode>('test');
  const [selectedOperationId, setSelectedOperationId] = useState<number | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Поллинг
  const [pollProgress, setPollProgress] = useState<{ attempt: number; max: number } | null>(null);

  // ─── Загрузка схемы ───
  useEffect(() => { loadSchema(); }, []);

  const loadSchema = async (version?: string, keepValues = false) => {
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

  const initializeForm = (schemaData: SchemaResponse, keepExisting = false) => {
    if (keepExisting) {
      const updated: FormValues = { ...formValues };
      schemaData.ui_schema.form_blocks.forEach(block =>
        block.fields.forEach(field => {
          if (!(field.id in updated))
            updated[field.id] = field.type === 'boolean' ? 0 : null;
        })
      );
      setFormValues(updated);
    } else {
      const initial: FormValues = {};
      schemaData.ui_schema.form_blocks.forEach(block =>
        block.fields.forEach(field => {
          initial[field.id] = field.type === 'boolean' ? 0 : null;
        })
      );
      setFormValues(initial);
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
      const v = validateFieldValue(value, field);
      if (!v.valid) {
        setFormErrors(prev => ({ ...prev, [fieldId]: v.error || '' }));
      } else {
        setFormErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
      }
    }
  };

const smartDataImport = useCallback((rawData: Record<string, any>) => {
  const fields = getAllFields();
  const parsedData: FormValues = {};
  const newErrors: Record<string, string> = {};
  const fieldMap = new Map(fields.map(f => [f.id, f]));

  const fieldAliases = new Map<string, UIField>();

  const knownMappings: Record<string, string> = {
    'Креатинин до операции (мкмоль/л)': 'Креатинин в ОРИТ (мкмоль/л)',
    'Креатинин до операции': 'Креатинин в ОРИТ (мкмоль/л)',
    'Мочевина до операции (ммоль/л)': 'Мочевина в ОРИТ (ммоль/л)',
    'Hb до операции (г/л)': 'Hb в ОРИТ (г/л)',
    'Ht до операции (%)': 'Ht в ОРИТ (%)',
    'Глюкоза до операции (ммоль/л)': 'Глюкоза в ОРИТ (ммоль/л)',
    'K+ до операции (ммоль/л)': 'K+ в ОРИТ (ммоль/л)',
  };

  fields.forEach((f) => {
    const normalizedId = f.id.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
    fieldAliases.set(normalizedId, f);

    if (f.label) {
      const normalizedLabel = f.label.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
      fieldAliases.set(normalizedLabel, f);
    }

    Object.entries(knownMappings).forEach(([demoKey, fieldId]) => {
      if (fieldId === f.id) {
        const normalizedDemoKey = demoKey.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
        fieldAliases.set(normalizedDemoKey, f);
      }
    });
  });

  Object.entries(rawData).forEach(([key, value]) => {
    let field = fieldMap.get(key);

    if (!field) {
      const normalizedKey = key.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
      field = fieldAliases.get(normalizedKey);
    }

    if (!field) {
      const mappedFieldId = knownMappings[key];
      if (mappedFieldId) {
        field = fieldMap.get(mappedFieldId);
      }
    }

    if (!field) {
      console.warn(`No matching form field found for demo key: "${key}"`);
      return;
    }

    const convertedValue = smartValueConverter(value, field);

    console.log(
      `[DEMO IMPORT] "${key}" -> "${field.id}" raw=`,
      value,
      ' converted=',
      convertedValue
    );

    parsedData[field.id] = convertedValue;

    const validation = validateFieldValue(convertedValue, field);
    if (!validation.valid && validation.error) {
      newErrors[field.id] = validation.error;
    }
  });

  setFormValues((prev) => ({ ...prev, ...parsedData }));

  // ВАЖНО: удаляем старые ошибки у импортированных полей,
  // потом ставим только актуальные newErrors
  setFormErrors((prev) => {
    const next = { ...prev };

    Object.keys(parsedData).forEach((fieldId) => {
      delete next[fieldId];
    });

    Object.entries(newErrors).forEach(([fieldId, error]) => {
      next[fieldId] = error;
    });

    return next;
  });

  return {
    imported: Object.keys(parsedData).length,
    total: fields.length,
    errors: Object.keys(newErrors).length,
  };
}, [getAllFields]);
  const handleDataImport = (data: FormValues) => {
    const r = smartDataImport(data);
    toast.success(`Импортировано полей: ${r.imported} из ${r.total}`);
  };

  const handleClipboardPaste = async () => {
    try {
      const pr = await parseClipboardText(getAllFields());
      if (!pr.success) { toast.warning('Буфер обмена пуст'); return; }
      const r = smartDataImport(pr.values);
      toast.success(`Заполнено ${r.imported} из ${r.total} полей`);
    } catch { toast.error('Ошибка чтения буфера обмена'); }
  };

const handleLoadDemo = async () => {
  try {
    console.log('[handleLoadDemo] selectedVersion:', selectedVersion);

    const demo = await getDemoData(selectedVersion);

    console.log('[handleLoadDemo] demo keys:', Object.keys(demo));

    if (!demo || Object.keys(demo).length === 0) {
      toast.error('Демо-данные пусты');
      return;
    }

    const r = smartDataImport(demo);

    if (r.imported === 0) {
      toast.warning('Не удалось сопоставить данные');
      console.warn('[handleLoadDemo] No fields matched. Demo data:', demo);
      console.warn('[handleLoadDemo] Form fields:', getAllFields().map(f => f.id));
    } else {
      toast.success(`Демо-данные загружены (${r.imported} из ${r.total})`);
    }
  } catch (e: any) {
    toast.error(e.message || 'Ошибка');
  }
};

  const handleClearForm = () => {
    if (schema) { initializeForm(schema, false); toast.info('Форма очищена'); }
  };

  const handleModeChange = (mode: PredictionMode) => {
    setPredictionMode(mode);
    if (mode === 'test') { setSelectedOperationId(null); setSelectedPatient(null); }
  };

  const validateForm = (): boolean => {
    const ne: Record<string, string> = {};
    let ok = true;
    getAllFields().forEach(f => {
      const v = validateFieldValue(formValues[f.id], f);
      if (!v.valid && v.error) { ne[f.id] = v.error; ok = false; }
    });
    setFormErrors(ne);
    return ok;
  };

  const normalizeFieldValueForSubmit = (field: UIField, value: any) => {
  switch (field.type) {
    case 'boolean':
      return value === 1 || value === true || value === '1' ? 1 : 0;

    case 'number': {
      if (typeof value === 'number') {
        return Number.isNaN(value) ? null : value;
      }

      if (typeof value === 'string') {
        const normalized = value.replace(',', '.').trim();
        const num = Number(normalized);
        return Number.isNaN(num) ? null : num;
      }

      const num = Number(value);
      return Number.isNaN(num) ? null : num;
    }

    case 'select': {
      const matchedOption = field.options?.find(
        (opt) => String(opt.value) === String(value)
      );
      return matchedOption ? matchedOption.value : value;
    }

    default:
      return value;
  }
};
  // ─────────────────────────────────────────────────────
  // SUBMIT с поддержкой поллинга
  // ─────────────────────────────────────────────────────
const handleSubmit = async () => {
  if (predictionMode === 'patient' && !selectedOperationId) {
    toast.error('Выберите операцию пациента для сохранения прогноза');
    return;
  }

  if (!validateForm()) {
    toast.error('Исправьте ошибки в форме');
    return;
  }

  setSubmitLoading(true);
  setViewState('loading');
  setPollProgress(null);

  try {
    const calculatedFields = schema?.ui_schema.calculated_metrics_needed || [];
    const features: Record<string, any> = {};
    let hasMissing = false;
    const newErrors: Record<string, string> = {};

    getAllFields().forEach((field) => {
      if (calculatedFields.includes(field.id)) return;

      const rawValue = formValues[field.id];
      const normalizedValue = normalizeFieldValueForSubmit(field, rawValue);

      const isMissing =
        rawValue === null ||
        rawValue === undefined ||
        rawValue === '' ||
        (field.type === 'number' && normalizedValue === null) ||
        (field.type === 'select' &&
          (normalizedValue === null ||
            normalizedValue === undefined ||
            normalizedValue === ''));

      if (isMissing) {
        newErrors[field.id] = 'Поле обязательно';
        hasMissing = true;
        return;
      }

      features[field.id] = normalizedValue;
    });

    if (hasMissing) {
      setFormErrors((prev) => ({ ...prev, ...newErrors }));
      toast.error('Заполните все обязательные поля');
      setViewState('form');
      setSubmitLoading(false);
      return;
    }

    const operationId =
      predictionMode === 'patient' ? selectedOperationId ?? undefined : undefined;

    const response = await submitPrediction(
      features,
      selectedVersion,
      operationId,
      (attempt, max) => setPollProgress({ attempt, max })
    );

    setResult(response);
    setViewState('result');
    setPollProgress(null);

    toast.success(
      predictionMode === 'patient'
        ? 'Прогноз рассчитан и сохранён в БД'
        : 'Прогноз рассчитан (тестовый режим, не сохранён)'
    );
  } catch (error: any) {
    toast.error(error.message || 'Ошибка расчёта прогноза');
    setViewState('form');
    setPollProgress(null);
  } finally {
    setSubmitLoading(false);
  }
};

  // ─── Рендер: загрузка схемы ───
  if (schemaLoading)
    return <div className="p-8 text-center">Загрузка схемы формы...</div>;

  if (schemaError)
    return (
      <div className="p-8 text-center text-red-600">
        <p className="mb-4">Ошибка загрузки: {schemaError}</p>
        <Button onClick={() => loadSchema()}>Повторить</Button>
      </div>
    );

  // ─── Рендер: результат ───
  if (viewState === 'result' && result)
    return (
      <ResultDisplay
        result={result}
        onBack={() => { setViewState('form'); setResult(null); }}
        onNewPrediction={handleClearForm}
      />
    );

  // ─── Рендер: загрузка/поллинг ───
  if (viewState === 'loading')
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[320px] space-y-6">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />

        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-slate-800">
            {predictionMode === 'patient'
              ? 'Расчёт и сохранение прогноза...'
              : 'Расчёт прогноза...'}
          </h3>
          <p className="text-sm text-slate-500">
            {predictionMode === 'patient'
              ? 'Данные обрабатываются на сервере. Это может занять несколько секунд.'
              : 'Обработка данных...'}
          </p>
        </div>

        {/* Прогресс-бар поллинга */}
        {pollProgress && (
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Ожидание сервера</span>
              <span>
                {Math.min(
                  Math.round((pollProgress.attempt / pollProgress.max) * 100),
                  99
                )}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(
                    (pollProgress.attempt / pollProgress.max) * 100,
                    99
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-slate-400 text-center">
              Попытка {pollProgress.attempt} из {pollProgress.max}
            </p>
          </div>
        )}

        {/* Информация о привязке */}
        {predictionMode === 'patient' && selectedPatient && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700">
            Пациент #{selectedPatient.id} · Операция #{selectedOperationId}
          </div>
        )}
      </div>
    );

  // ─── Рендер: форма ───
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold">ML-прогнозирование рисков</h2>
          <p className="text-slate-500">Заполните данные пациента для расчета прогноза</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Версия модели */}
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

          {/* Выбор режима */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Режим расчёта</label>
            <ModeSelector
              mode={predictionMode}
              onChange={handleModeChange}
              disabled={submitLoading}
            />
          </div>

          {/* Привязка к пациенту */}
          {predictionMode === 'patient' && (
            <PatientSelector
              onOperationSelect={(opId, patient) => {
                setSelectedOperationId(opId);
                setSelectedPatient(patient);
              }}
              onClear={() => { setSelectedOperationId(null); setSelectedPatient(null); }}
              selectedOperationId={selectedOperationId}
            />
          )}

          {/* Тестовый баннер */}
          {predictionMode === 'test' && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <FlaskConical className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
              <span>
                Тестовый режим: результат будет рассчитан, но{' '}
                <strong>не сохранён</strong> в базу данных.
              </span>
            </div>
          )}

          {/* Кнопки импорта */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="secondary" onClick={handleClipboardPaste} className="w-full justify-start">
              <Clipboard className="w-4 h-4 mr-2" /> Вставить из буфера
            </Button>
            <Button variant="secondary" onClick={handleLoadDemo} className="w-full justify-start">
              <RefreshCw className="w-4 h-4 mr-2" /> Демо-данные
            </Button>
            <Button
              variant="secondary"
              onClick={handleClearForm}
              className="w-full justify-start text-red-600 hover:text-red-700"
            >
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

          {/* Кнопка отправки */}
          <div className="pt-6 border-t flex items-center gap-4">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={
                submitLoading ||
                (predictionMode === 'patient' && !selectedOperationId)
              }
              className="w-full md:w-auto px-12"
            >
              <Send className="w-5 h-5 mr-2" />
              {predictionMode === 'patient'
                ? 'Рассчитать и сохранить'
                : 'Рассчитать прогноз'}
            </Button>
            {predictionMode === 'patient' && !selectedOperationId && (
              <p className="text-sm text-amber-600">Выберите операцию пациента</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};