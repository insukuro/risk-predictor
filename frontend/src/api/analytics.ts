// api/analytics.ts
import { mainApi, handleApiError } from './client';
import type { AnalyticsSummary, AgeDistribution } from '../types';

/**
 * Получить сводку по операциям
 */
export const getOperationsSummary = async (
  dateFrom?: string,
  dateTo?: string
): Promise<AnalyticsSummary> => {
  try {
    const params: Record<string, string> = {};
    // Передаем параметры только если они не пустые
    if (dateFrom && dateFrom.trim() !== '') params.date_from = dateFrom;
    if (dateTo && dateTo.trim() !== '') params.date_to = dateTo;

    const response = await mainApi.get<any>(
      '/operations/stats/summary',
      { params }
    );
    
    const data = response.data;
    
    // ПРЕОБРАЗУЕМ ДАННЫЕ В НУЖНЫЙ ФОРМАТ
    let by_type: Record<string, number> = {};
    
    if (Array.isArray(data.by_type)) {
      // Новый формат: массив [{type: "CABG", count: 3}, ...]
      for (const item of data.by_type) {
        const typeName = item.type || 'Unknown';
        by_type[typeName] = item.count || 0;
      }
    } else if (typeof data.by_type === 'object' && data.by_type !== null) {
      // Старый формат: объект {CABG: 3, AVR: 2}
      by_type = data.by_type;
    }
    
    return {
      total_operations: data.total_operations || 0,
      by_type: by_type
    };
    
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

/**
 * Получить распределение по возрастам
 */
export const getAgeDistribution = async (): Promise<AgeDistribution[]> => {
  try {
    const response = await mainApi.get<any>(
      '/patients/stats/age-distribution'
    );
    
    const data = response.data;
    
    // ПРЕОБРАЗУЕМ В МАССИВ, ЕСЛИ ПРИШЕЛ ОБЪЕКТ
    if (data.ranges) {
      // Новый формат: { ranges: {"0-18": 2, "19-30": 0}, ... }
      const result: AgeDistribution[] = [];
      
      for (const [ageGroup, count] of Object.entries(data.ranges)) {
        result.push({
          age_group: ageGroup,
          count: count as number
        });
      }
      
      return result;
    }
    
    if (Array.isArray(data)) {
      // Уже массив — возвращаем как есть
      return data;
    }
    
    // Если пришел просто объект без поля ranges
    if (typeof data === 'object' && data !== null) {
      const result: AgeDistribution[] = [];
      
      for (const [ageGroup, count] of Object.entries(data)) {
        // Пропускаем служебные поля
        if (ageGroup === 'total_patients' || ageGroup === 'average_age') continue;
        
        result.push({
          age_group: ageGroup,
          count: count as number
        });
      }
      
      return result;
    }
    
    return [];
    
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

/**
 * Получить статистику по предсказаниям
 */
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