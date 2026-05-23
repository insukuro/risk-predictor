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
 * Интерфейс аргументов для функции расчёта, 
 * полностью соответствующий новой структуре запроса
 */
interface CalculateMetricsArgs {
  features: FormValues;
  calculator_id: string;
}

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
 * Calculate all metrics (Обновлено под вложенный payload)
 */
export const calculateAllMetrics = async (
  args: CalculateMetricsArgs // <-- Теперь функция знает, что принимает объект с фичами и ID
): Promise<UIAllMetricsResponse> => {
  try {
    const { features, calculator_id } = args;

    // Трансформируем и чистим только объект с фичами
    const cleanedFeatures: Record<string, any> = {};
    
    Object.entries(features).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (typeof value === 'number' && !Number.isFinite(value)) return;

      cleanedFeatures[key] = value;
    });

    // Собираем payload, который ждёт ваш обновлённый бэкенд
    const payload = {
      features: cleanedFeatures,
      calculator_id: calculator_id
    };
    
    const response = await calcApi.post<UIAllMetricsResponse>('/ui/calculate-all', payload);
    return response.data;
  } catch (error: any) {
    if (USE_MOCK) {
      console.log('[MOCK] Generating mock calculator results');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const data = args.features;
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
        
        // Мапим в ИМТ с русским ключом, если бэк работает на русскоязычных алиасах
        results.metrics['ИМТ (кг/м²)'] = {
          value: bmi,
          label: `Индекс массы тела: ${bmiLabel}`,
          level: bmiLevel,
        };
      }

      // Имитируем фильтрацию результатов для мока конкретного калькулятора
      if (args.calculator_id === 'bmi' && results.metrics['ИМТ (кг/м²)']) {
        return {
          status: 'success',
          metrics: { 'ИМТ (кг/м²)': results.metrics['ИМТ (кг/м²)'] }
        };
      }
      
      return results;
    }
    throw new Error(handleApiError(error));
  }
};

/**
 * Calculate specific metric via old endpoints (if preserved)
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