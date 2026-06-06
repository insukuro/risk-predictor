import { mainApi, handleApiError } from './client';
import { MOCK_SCHEMA, MOCK_DEMO_DATA, generateMockHistory } from './mockData';
import type {
  SchemaResponse,
  PredictRequest,
  PredictResponse,
  HistoryItem,
  FormValues,
} from '../types';

type HealthResponse = { status: string };

const USE_MOCK = false;

// ─── Типы для асинхронного поллинга ───

interface AsyncTaskResponse {
  task_id: string;
  status: 'pending';
}

interface TaskStatusPending {
  status: 'pending';
  operation_id?: number;
}

interface TaskStatusCompleted {
  status: 'completed';
  result: PredictResponse;
}

interface TaskStatusFailed {
  status: 'failed';
  error: string;
}

type TaskStatusResponse = TaskStatusPending | TaskStatusCompleted | TaskStatusFailed;

// Тип-гард: тестовый (синхронный) ответ — приходит сразу с result
interface SyncPredictResponse {
  status: 'completed';
  saved: boolean;
  result: PredictResponse;
}

function isSyncResponse(data: any): data is SyncPredictResponse {
  return data?.status === 'completed' && data?.result !== undefined;
}

function isAsyncResponse(data: any): data is AsyncTaskResponse {
  return typeof data?.task_id === 'string' && data?.status === 'pending';
}

// ─── Поллинг ───

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 120; // макс ~3 минуты

/**
 * Поллит статус задачи до завершения или ошибки.
 * Вызывает onProgress при каждом шаге (для UI-индикатора).
 */
export const pollTaskStatus = async (
  taskId: string,
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<PredictResponse> => {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    onProgress?.(attempt, MAX_POLL_ATTEMPTS);

    const response = await mainApi.get<TaskStatusResponse>(
      `/predictions/ui/status/${taskId}`
    );
    const data = response.data;

    if (data.status === 'completed') {
      return (data as TaskStatusCompleted).result;
    }

    if (data.status === 'failed') {
      throw new Error((data as TaskStatusFailed).error || 'Ошибка расчёта на сервере');
    }

    // status === 'pending' → ждём и повторяем
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Превышено время ожидания результата. Попробуйте позже.');
};


/**
 * Get UI schema for dynamic form generation
 */
export const getUISchema = async (version?: string): Promise<SchemaResponse> => {
  try {
    const params: Record<string, string> = {};
    if (version) params.version = version;
    const response = await mainApi.get<SchemaResponse>('/predictions/ui/schema', { params });
    return response.data;
  } catch (error: any) {
    if (USE_MOCK) {
      console.log('[MOCK] Using mock schema data');
      return MOCK_SCHEMA;
    }
    throw new Error(handleApiError(error));
  }
};


/**
 * Submit prediction request.
 *
 * Поведение зависит от наличия operationId:
 *  - без operationId → тестовый режим, ответ синхронный
 *  - с operationId   → бэк возвращает task_id, нужен поллинг
 *
 * @param onPollProgress — колбэк для отображения прогресса поллинга
 */
export const submitPrediction = async (
  features: FormValues,
  modelVersion?: string,
  operationId?: number,
  onPollProgress?: (attempt: number, maxAttempts: number) => void
): Promise<PredictResponse> => {
  try {
    const request: PredictRequest = {
      features: features as Record<string, any>,
      model_version: modelVersion,
      operation_id: operationId,
    };

    const response = await mainApi.post<any>('/predictions/ui/predict', request);
    const data = response.data;

    // ─── Синхронный ответ (тестовый режим) ───
    if (isSyncResponse(data)) {
      return data.result;
    }

    // ─── Асинхронный ответ (с привязкой к пациенту) ───
    if (isAsyncResponse(data)) {
      return await pollTaskStatus(data.task_id, onPollProgress);
    }

    // ─── Фоллбэк: ответ уже является результатом (для совместимости) ───
    if (data.risk_score !== undefined) {
      return data as PredictResponse;
    }

    throw new Error('Неизвестный формат ответа от сервера');
  } catch (error: any) {
    if (USE_MOCK) {
      console.log('[MOCK] Generating mock prediction');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const score = Math.random() * 0.5 + 0.1;
      const level = score < 0.15 ? 'low' : score < 0.35 ? 'medium' : score < 0.6 ? 'high' : 'danger';
      return {
        prediction_id: Math.floor(Math.random() * 10000),
        risk_score: score,
        risk_level: level as any,
        model_version: modelVersion || 'v2',
        created_at: new Date().toISOString(),
        saved: true,
        targets: [
          { name: 'Госпитальная летальность', score: score * 0.8, level: level as any },
          { name: 'ОПН', score: score * 1.1, level: 'medium' },
        ],
      } as PredictResponse;
    }

    // Если это уже наша ошибка — пробрасываем
    if (error instanceof Error && error.message) throw error;
    throw new Error(handleApiError(error));
  }
};


/**
 * Get prediction history
 */
export const getPredictionHistory = async (
  patientId?: number,
  skip: number = 0,
  limit: number = 20
): Promise<HistoryItem[]> => {
  try {
    const params: Record<string, any> = { skip, limit };
    if (patientId !== undefined && patientId !== null) {
      params.patient_id = patientId;
    }
    const response = await mainApi.get<HistoryItem[]>('/predictions/ui/history', { params });
    return response.data;
  } catch (error: any) {
    if (USE_MOCK) {
      console.log('[MOCK] Generating mock history');
      let items = generateMockHistory(50);
      if (patientId) items = items.filter(item => item.patient_id === patientId);
      return items.slice(skip, skip + limit);
    }
    throw new Error(handleApiError(error));
  }
};


/**
 * Get demo data for form
 */
export const getDemoData = async (version?: string): Promise<FormValues> => {
  try {
    const params: Record<string, string> = {};
    if (version) params.version = version;

    const response = await mainApi.get('/predictions/ui/demo-data', { params });

    // если ответ обёрнут в { status, data }
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      response.data.data &&
      typeof response.data.data === 'object'
    ) {
      return response.data.data as FormValues;
    }

    // fallback на старый формат
    return response.data as FormValues;
  } catch (error: any) {
    if (USE_MOCK) {
      console.log('[MOCK] Using mock demo data');
      return MOCK_DEMO_DATA;
    }
    throw new Error(handleApiError(error));
  }
};

/**
 * Check API health
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await mainApi.get<HealthResponse>('/health');
    return response.status === 200 && response.data?.status === 'ok';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
};