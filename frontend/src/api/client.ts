import axios, { AxiosInstance, AxiosError } from 'axios';

export const MAIN_API_URL = '/api';
export const CALC_API_URL = '/api/calc';
// Create axios instances
export const mainApi: AxiosInstance = axios.create({
  baseURL: MAIN_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const calcApi: AxiosInstance = axios.create({
  baseURL: CALC_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
export const handleApiError = (error: AxiosError): string => {
  if (error.response) {
    const data = error.response.data as any;
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      if (Array.isArray(data.detail)) {
        return data.detail.map((e: any) => e.msg || e.message).join(', ');
      }
    }
    return `Ошибка сервера: ${error.response.status}`;
  }
  if (error.request) {
    return 'Сервер недоступен. Проверьте подключение.';
  }
  return error.message || 'Неизвестная ошибка';
};
