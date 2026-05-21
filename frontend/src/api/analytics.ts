// api/analytics.ts
import { mainApi, handleApiError } from './client';
import type { AnalyticsSummary, AgeDistribution } from '../types';

export const getOperationsSummary = async (
  dateFrom?: string,
  dateTo?: string
): Promise<AnalyticsSummary> => {
  try {
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const response = await mainApi.get<AnalyticsSummary>(
      '/operations/stats/summary',
      { params }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

export const getAgeDistribution = async (): Promise<AgeDistribution[]> => {
  try {
    const response = await mainApi.get<AgeDistribution[]>(
      '/patients/stats/age-distribution'
    );
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

export const getPredictionStats = async (
  patientId?: number,
  skip = 0,
  limit = 100
) => {
  try {
    const params: Record<string, any> = { skip, limit };
    if (patientId) params.patient_id = patientId;
    const response = await mainApi.get('/predictions/ui/history', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};