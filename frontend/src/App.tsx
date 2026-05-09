import { useState, useCallback } from 'react';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { Activity, Brain, Shield, BarChart3, Calculator, Clock } from 'lucide-react';
import axios from 'axios';

import { Header } from './components/Header';
import { ModelInfoCard } from './components/ModelInfoCard';
import { PredictiveForm } from './components/PredictiveForm';
import { ResultDisplay } from './components/ResultDisplay';
import { PatientDialog } from './components/PatientDialog';
import { HistoryView } from './components/HistoryView';
import { Card, CardContent } from './components/ui/Card';
import { Skeleton } from './components/ui/Skeleton';
import { useTaskPoller } from './hooks/useTaskPoller';
import { fetchModelConfig, predict } from './lib/api';
import { cn } from './lib/utils';
import type { PredictionResult, PredictResponse } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

type TabId = 'calculator' | 'history';

function AppInner() {
  const [activeTab, setActiveTab] = useState<TabId>('calculator');
  
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [predResult, setPredResult] = useState<PredictionResult | null>(null);
  const [pendingFeatures, setPendingFeatures] = useState<Record<string, unknown>>({});
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: config, isLoading: configLoading, error: configError } = useQuery({
    queryKey: ['config', selectedVersion],
    queryFn: () => fetchModelConfig(selectedVersion || undefined),
    staleTime: 30_000,
  });

  const effectiveVersion = selectedVersion || config?.current_version || '';

  const { data: versionedConfig, isLoading: versionedLoading } = useQuery({
    queryKey: ['config-versioned', effectiveVersion],
    queryFn: () => fetchModelConfig(effectiveVersion),
    staleTime: 30_000,
    enabled: !!effectiveVersion && !!config,
  });

  const activeConfig = selectedVersion ? versionedConfig : config;
  const isConfigLoading = configLoading || (!!selectedVersion && versionedLoading);

  const predictMutation = useMutation({
    mutationFn: predict,
    onSuccess: (data: PredictResponse) => {
      if (data.status === 'completed' && 'result' in data) {
        const r = data.result;
        setPredResult({
          risk_score: r.risk_score,
          risk_level: r.risk_level,
          version: r.version,
          framework: r.framework,
        });
        setIsSaved(false);
        toast.success('Расчёт завершён', {
          description: `Risk Score: ${Math.round(r.risk_score * 100)}%`,
        });
      } else if ('task_id' in data) {
        setPendingTaskId(data.task_id);
        toast.info('Расчёт запущен', { description: 'Ожидание результата...' });
      }
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 502) {
          toast.error('ML-сервис недоступен', {
            description: 'Не удалось подключиться к сервису прогнозирования (502)',
          });
        } else if (error.response?.status === 400) {
          toast.error('Ошибка данных', {
            description: error.response?.data?.detail ?? 'Проверьте введённые значения',
          });
        } else {
          toast.error('Ошибка расчёта', {
            description: error.response?.data?.detail ?? error.message,
          });
        }
      } else {
        toast.error('Неизвестная ошибка', { description: String(error) });
      }
    },
  });
  
  useTaskPoller({
    taskId: pendingTaskId,
    onComplete: (result) => {
      setPredResult(result);
      setPendingTaskId(null);
      setIsSaved(true);
      toast.success('Расчёт сохранён', {
        description: `Risk Score: ${Math.round(result.risk_score * 100)}% — данные привязаны к пациенту`,
      });
      // Обновляем историю
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
    },
    onError: (err) => {
      setPendingTaskId(null);
      toast.error('Ошибка фоновой задачи', { description: err });
    },
  });

  const handleVersionChange = useCallback((version: string) => {
    setSelectedVersion(version);
    setPredResult(null);
    setPendingTaskId(null);
    setIsSaved(false);
  }, []);

  const handlePredict = useCallback(
      (features: Record<string, unknown>) => {
        setPendingFeatures(features);
        setPredResult(null);
        setIsSaved(false);
        predictMutation.mutate({
          features,
          model_version: effectiveVersion || undefined,
        });
      },
      [effectiveVersion, predictMutation],
  );

  const handleSaveStart = () => {
    setDialogOpen(true);
  };

  const handleSaveConfirm = async (operationId: number) => {
    await new Promise<void>((resolve, reject) => {
      predictMutation.mutate(
          {
            features: pendingFeatures,
            model_version: effectiveVersion || undefined,
            operation_id: operationId,
          },
          {
            onSuccess: () => {
              setIsSaved(true);
              // Обновляем историю после сохранения
              queryClient.invalidateQueries({ queryKey: ['predictions'] });
              resolve();
            },
            onError: (e) => reject(e),
          },
      );
    });
  };

  const isPolling = !!pendingTaskId;
  const isPredicting = predictMutation.isPending || isPolling;

  return (
      <div className="min-h-screen bg-slate-50">
        {/* Шапка */}
        <Header
            config={activeConfig}
            selectedVersion={effectiveVersion}
            onVersionChange={handleVersionChange}
            isLoading={isConfigLoading}
        />

        {/* Навигация по вкладкам */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <nav className="flex gap-1">
              <button
                  onClick={() => setActiveTab('calculator')}
                  className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                      activeTab === 'calculator'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                  )}
              >
                <Calculator className="h-4 w-4" />
                Калькулятор риска
              </button>
              <button
                  onClick={() => setActiveTab('history')}
                  className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                      activeTab === 'history'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                  )}
              >
                <Clock className="h-4 w-4" />
                История
              </button>
            </nav>
          </div>
        </div>

        {/* Контент вкладок */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
          {/* Калькулятор */}
          {activeTab === 'calculator' && (
              <div className="space-y-6">
                {/* Полоска статистики */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Brain, label: 'ML-модель', value: effectiveVersion || '—', color: 'text-indigo-600 bg-indigo-50' },
                    { icon: BarChart3, label: 'Признаков', value: activeConfig ? String(activeConfig.features.length) : '—', color: 'text-violet-600 bg-violet-50' },
                    { icon: Shield, label: 'Категориальных', value: activeConfig ? String(activeConfig.categorical_features.length) : '—', color: 'text-sky-600 bg-sky-50' },
                    { icon: Activity, label: 'Статус', value: configError ? 'Ошибка' : isConfigLoading ? 'Загрузка' : 'Готов', color: configError ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50' },
                  ].map(({ icon: Icon, label, value, color }) => (
                      <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 truncate">{label}</p>
                          {isConfigLoading ? (
                              <Skeleton className="h-4 w-12 mt-0.5" />
                          ) : (
                              <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
                          )}
                        </div>
                      </div>
                  ))}
                </div>

                {/* Ошибка */}
                {configError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <strong>Не удалось загрузить конфигурацию.</strong> Проверьте, что бэкенд запущен.
                      {axios.isAxiosError(configError) && (
                          <span className="ml-1 text-red-500">
                    (Статус: {configError.response?.status ?? 'сетевая ошибка'})
                  </span>
                      )}
                    </div>
                )}

                {/* Форма и результат */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Левая колонка */}
                  <div className="lg:col-span-2 space-y-5">
                    <ModelInfoCard
                        config={activeConfig}
                        isLoading={isConfigLoading}
                        selectedVersion={effectiveVersion}
                    />

                    <Card>
                      <CardContent className="space-y-0">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                            <Activity className="h-4 w-4 text-violet-600" />
                          </div>
                          <h3 className="text-base font-semibold text-slate-900">
                            Параметры расчёта
                          </h3>
                        </div>
                        <PredictiveForm
                            config={activeConfig}
                            isLoading={isConfigLoading}
                            isPredicting={isPredicting}
                            onSubmit={handlePredict}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Правая колонка */}
                  <div className="space-y-5">
                    {predResult ? (
                        <ResultDisplay
                            result={predResult}
                            onSave={handleSaveStart}
                            isSaved={isSaved}
                            isSaving={isPolling}
                        />
                    ) : (
                        <>
                          <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                                <Activity className="h-6 w-6 text-slate-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-600">
                                  Результат появится здесь
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  Заполните форму и нажмите «Рассчитать риск»
                                </p>
                              </div>

                              {isPolling && (
                                  <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
                                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                                    Ожидание результата...
                                  </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Подсказка */}
                          <Card className="bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100">
                            <CardContent className="space-y-3 pt-5">
                              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                                Как работает система
                              </p>
                              {[
                                { n: '1', text: 'Выберите версию модели в шапке' },
                                { n: '2', text: 'Заполните клинические параметры пациента' },
                                { n: '3', text: 'Получите прогноз риска мгновенно' },
                                { n: '4', text: 'При необходимости — привяжите к карте пациента' },
                              ].map(({ n, text }) => (
                                  <div key={n} className="flex items-start gap-2.5">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                              {n}
                            </span>
                                    <span className="text-xs text-indigo-800">{text}</span>
                                  </div>
                              ))}
                            </CardContent>
                          </Card>
                        </>
                    )}
                  </div>
                </div>
              </div>
          )}
          
          {activeTab === 'history' && <HistoryView />}
        </div>

        {/* Диалог пациента */}
        <PatientDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onConfirm={handleSaveConfirm}
        />

        {/* Уведомления */}
        <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{ duration: 5000 }}
        />
      </div>
  );
}

export default function App() {
  return (
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
  );
}
