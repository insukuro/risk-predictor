import { useCallback, useEffect, useRef, useState } from 'react';
import { PredictiveForm } from '../components/predict/PredictiveForm';
import { ResultDisplay } from '../components/predict/ResultDisplay';
import { calculateMetrics, predictRisk, saveRecord } from '../lib/api';
import type { CalculatorResponse, PatientFeatures, PredictionResponse } from '../types';
import toast from 'react-hot-toast';

export function PredictPage() {
  const [features, setFeatures] = useState<PatientFeatures | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [metrics, setMetrics] = useState<CalculatorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelVersion, setModelVersion] = useState('v4-ensemble');
  const [resetTrigger, setResetTrigger] = useState(0);
  const featuresRef = useRef<PatientFeatures | null>(null);

  const handleValuesChange = useCallback((values: PatientFeatures) => {
    setFeatures(values);
    featuresRef.current = values;
  }, []);

  // Автоматический пересчёт при изменении features
  useEffect(() => {
    if (!features) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const [pred, calc] = await Promise.all([
          predictRisk(features, modelVersion),
          calculateMetrics(features),
        ]);
        setPrediction(pred);
        setMetrics(calc);
      } catch (e) {
        console.error(e);
        toast.error('Ошибка расчёта. Попробуйте ещё раз.');
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [features, modelVersion]);

  const handleSave = () => {
    if (!features || !prediction || !metrics) return;
    const euroMetric = metrics.metrics['EuroSCORE II (%)'];
    const record = saveRecord({
      id: Date.now(),
      date: new Date().toISOString(),
      operationId: `CABG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
      riskScore: prediction.risk_score,
      riskLevel: prediction.risk_level,
      model: prediction.model_version,
      euroscore: euroMetric?.value ?? 0,
      features,
      targets: prediction.targets,
    });
    toast.success(`Сохранено. Всего записей: ${record.length}`);
  };

  const handleReset = () => {
    setResetTrigger((t) => t + 1);
  };

  const canSave = Boolean(features && prediction && !isLoading);

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <PredictiveForm
            onValuesChange={handleValuesChange}
            modelVersion={modelVersion}
            onModelChange={setModelVersion}
            resetTrigger={resetTrigger}
          />
        </div>

        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <ResultDisplay
            prediction={prediction}
            metrics={metrics}
            isLoading={isLoading}
            canSave={canSave}
            onSave={handleSave}
            onReset={handleReset}
          />
        </div>
      </div>
    </div>
  );
}
