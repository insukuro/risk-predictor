import { calcApi, handleApiError } from './client';
import { MOCK_CALCULATOR_METADATA, generateMockCalculatorResults } from './mockData';
import type {
  CalculatorMetadata,
  UIAllMetricsResponse,
  FormValues,
} from '../types';

// Enable mock mode when API is unavailable
const USE_MOCK = false;

/**
 * Get calculator metadata for dynamic form generation
 */
export const getCalculatorMetadata = async (): Promise<CalculatorMetadata> => {
  try {
    const response = await calcApi.get<CalculatorMetadata>('/ui/metadata');
    return response.data;
  } catch (error: any) {
    if (USE_MOCK) {
      console.log('[MOCK] Using mock calculator metadata');
      return MOCK_CALCULATOR_METADATA;
    }
    throw new Error(handleApiError(error));
  }
};

/**
 * Calculate all metrics
 */
export const calculateAllMetrics = async (
  data: FormValues
): Promise<UIAllMetricsResponse> => {
  try {
    // Transform form values to API format with Russian aliases
    const payload: Record<string, any> = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        payload[key] = value;
      }
    });
    
    const response = await calcApi.post<UIAllMetricsResponse>('/ui/calculate-all', payload);
    return response.data;
  } catch (error: any) {
    if (USE_MOCK) {
      console.log('[MOCK] Generating mock calculator results');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Calculate actual BMI if weight and height provided
      const weight = data['Вес (кг)'] as number;
      const height = data['Рост (м)'] as number;
      const results = generateMockCalculatorResults();
      
      if (weight && height) {
        const bmi = weight / (height * height);
        let bmiLevel: 'low' | 'medium' | 'high' | 'danger' = 'low';
        let bmiLabel = 'Норма';
        
        if (bmi < 18.5) {
          bmiLevel = 'medium';
          bmiLabel = 'Дефицит массы тела';
        } else if (bmi >= 25 && bmi < 30) {
          bmiLevel = 'medium';
          bmiLabel = 'Избыточная масса тела';
        } else if (bmi >= 30) {
          bmiLevel = 'high';
          bmiLabel = 'Ожирение';
        }
        
        results.metrics.BMI = {
          value: bmi,
          label: `Индекс массы тела: ${bmiLabel}`,
          level: bmiLevel as 'low' | 'medium' | 'high' | 'danger',
        };
      }
      
      return results;
    }
    throw new Error(handleApiError(error));
  }
};

/**
 * Calculate specific metric (BMI, CCI, EuroSCORE, etc.)
 */
export const calculateSpecificMetric = async (
  calculator: 'bmi' | 'clcr' | 'cci' | 'euroscore',
  data: FormValues
): Promise<any> => {
  try {
    const response = await calcApi.post(`/api/v1/calculate/${calculator}`, data);
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};
