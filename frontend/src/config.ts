
export const CONFIG = {
  // Основной API (через nginx proxy: /api -> backend:8000)
  ML_SERVICE_URL:"http://risk-ml:8001",
  CALC_SERVICE_URL:"http://risk-calc:8005",
  
  // Таймаут запросов (мс)
  API_TIMEOUT: 30000,
  
  // Интервал проверки здоровья API (мс)
  HEALTH_CHECK_INTERVAL: 30000,
  
  // Задержка debounce для поиска (мс)
  SEARCH_DEBOUNCE: 400,
  
  // Количество элементов на странице
  PAGE_SIZE: 20,
  
  // Production режим
  IS_PRODUCTION: import.meta.env.PROD,
};
// Вывод конфигурации в консоль при разработке
if (import.meta.env.DEV) {
  console.log('📋 CardioRisk AI Configuration:', CONFIG);
}