import { mainApi, handleApiError } from './client';
import { MOCK_SCHEMA, MOCK_DEMO_DATA, generateMockHistory } from './mockData';
import type {
  SchemaResponse,
  PredictRequest,
  PredictResponse,
  HistoryItem,
  FormValues,
} from '../types';

// Enable mock mode when API is unavailable
const USE_MOCK = false;

/**
 * Get UI schema for dynamic form generation
 * @param version - Optional model version to load schema for
 */
export const getUISchema = async (version?: string): Promise<SchemaResponse> => {
  try {
    const params: Record<string, string> = {};
    if (version) {
      params.version = version;
    }
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
 * Submit prediction request
 */
export const submitPrediction = async (
  features: FormValues,
  modelVersion?: string
): Promise<PredictResponse> => {
  try {
    const request: PredictRequest = {
      features: features as Record<string, any>,
      model_version: modelVersion,
    };
    const response = await mainApi.post<PredictResponse>('/predictions/ui/predict', request);
    return response.data;
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
          { name: '30-дневная летальность', score: score * 0.9, level: level as any },
          { name: 'ОПН', score: score * 1.1 > 1 ? 0.9 : score * 1.1, level: score * 1.1 > 0.5 ? 'high' : 'medium' },
          { name: 'ОНМК', score: score * 0.5, level: 'low' },
        ],
      };
    }
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
      if (patientId) {
        items = items.filter(item => item.patient_id === patientId);
      }
      return items.slice(skip, skip + limit);
    }
    throw new Error(handleApiError(error));
  }
};

/**
 * Get demo data for form
 */
export const getDemoData = async (): Promise<FormValues> => {
  try {
    const response = await mainApi.get<FormValues>('/predictions/ui/demo-data');
    return response.data;
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
    const response = await mainApi.get('/health');
    return response.data?.status === 'healthy';
  } catch {
    return false;
  }
};
