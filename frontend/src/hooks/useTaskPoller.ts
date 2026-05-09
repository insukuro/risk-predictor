import { useState, useEffect, useRef } from 'react';
import { fetchTaskStatus } from '../lib/api';
import type { PredictionResult } from '../types';

interface UseTaskPollerOptions {
  taskId: string | null;
  onComplete: (result: PredictionResult) => void;
  onError: (error: string) => void;
  interval?: number;
}

export function useTaskPoller({ taskId, onComplete, onError, interval = 1500 }: UseTaskPollerOptions) {
  const [isPolling, setIsPolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Храним колбэки в ref, чтобы избежать пересоздания интервала
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!taskId) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    const poll = async () => {
      try {
        const status = await fetchTaskStatus(taskId);

        if (status.status === 'completed' && status.result) {
          setIsPolling(false);
          if (timerRef.current) clearInterval(timerRef.current);
          onCompleteRef.current({
            risk_score: status.result.risk_score,
            risk_level: status.result.risk_level,
            version: status.result.version,
            framework: status.result.framework,
          });
        } else if (status.status === 'failed') {
          setIsPolling(false);
          if (timerRef.current) clearInterval(timerRef.current);
          onErrorRef.current(status.error ?? 'Задача завершилась с ошибкой');
        }
      } catch {
        setIsPolling(false);
        if (timerRef.current) clearInterval(timerRef.current);
        onErrorRef.current('Ошибка опроса статуса задачи');
      }
    };

    // Первый запрос сразу, потом через интервал
    poll();
    timerRef.current = setInterval(poll, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [taskId, interval]);

  return { isPolling };
}
