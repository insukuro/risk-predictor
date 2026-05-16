import httpx
import os
import asyncio
from typing import Dict, Any, Optional, List

class MLClient:
    def __init__(self):
        self.ml_url = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
        self.calc_url = os.getenv("CALC_SERVICE_URL", "http://localhost:8005")
        self.timeout = httpx.Timeout(30.0, connect=10.0)

    async def get_model_info(self, version: Optional[str]) -> Dict[str, Any]:
        """Запрашивает информацию о метаданных фич у ML сервиса."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            versions = await client.get(f"{self.ml_url}/models/versions")
            current_v = version or versions.json().get("current_version", "v1")
            info = await client.get(f"{self.ml_url}/model/info", params={"version": current_v})
            return {
                "info": info.json(),
                "available_versions": list(versions.json().get("versions", {}).keys()),
                "current_version": current_v
            }

    async def get_calc_metadata(self) -> Dict[str, Any]:
        """
        Запрашивает метаданные у калькулятора. 
        Поддерживает эндпоинт /ui/metadata согласно спецификации.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.calc_url}/ui/metadata")
                resp.raise_for_status()
                return resp.json()
        except Exception:
            # На случай, если эндпоинт недоступен, возвращаем пустую структуру для ненарушения flow
            return {}

    async def calculate_batch(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Отправляет данные в пакетный калькулятор шкал."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # Передаем напрямую словарь фич, калькулятор сам выполнит адаптацию
                response = await client.post(f"{self.calc_url}/ui/calculate-all", json=features)
                if response.status_code != 200:
                    print(f"⚠️ Calc-service returned status {response.status_code}: {response.text}")
                    return {}
                
                # Извлекаем метрики и превращаем их в плоский словарь для ML
                data = response.json()
                metrics = data.get("metrics", {})
                
                flat_metrics = {}
                for key, metric_data in metrics.items():
                    flat_metrics[key] = metric_data.get("value")
                return flat_metrics
            except Exception as e:
                print(f"❌ Error communicating with calc-service batch: {e}")
                return {}

    async def calculate_pure_metrics(self, endpoints: List[str], features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Используется для API-First эндпоинта предсказаний.
        Вызывает пакетный расчет, но фильтрует только запрошенные метрики.
        """
        # Переиспользуем логику calculate_batch для стабильности маппинга признаков
        all_calculated = await self.calculate_batch(features)
        return all_calculated

    async def predict(self, features: Dict[str, Any], version: str) -> Dict[str, Any]:
        """Отправляет полный пул смердженных фич в ML сервис для предикта."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.ml_url}/predict",
                json={"features": features, "version": version}
            )
            resp.raise_for_status()
            return resp.json()

    async def get_demo_data(self, version: Optional[str]) -> Dict[str, Any]:
        """Запрашивает демо-данные у ML-сервиса по правильному контракту."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            # Если версия не передана, пускай ML-сервис сам решает (какая модель current)
            params = {"version": version} if version else {}
            try:
                resp = await client.get(f"{self.ml_url}/model/demo", params=params)
                resp.raise_for_status()
                
                # Достаем данные по правильному ключу из ответа ML-сервиса
                return resp.json().get("demo_input_features", {})
            except Exception as e:
                print(f"⚠️ Блок ML /model/demo недоступен или вернул ошибку: {e}")
                return {} # Фолбэк, чтобы не ломать UI бэкенда
ml_client = MLClient()