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

    async def calculate_pure_metrics(self, metrics: List[str], features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Вызывает точечные интеграционные эндпоинты (Pure Machine API).
        Пример: POST /api/v1/calculate/euroscore, POST /api/v1/calculate/cci
        """
        results = {}
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Строим задачи для параллельного выполнения запросов к калькулятору
            tasks = []
            for metric in metrics:
                url = f"{self.calc_url}/api/v1/calculate/{metric}"
                tasks.append(client.post(url, json=features))
            
            # Выполняем параллельно
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            for resp in responses:
                if isinstance(resp, httpx.Response) and resp.status_code == 200:
                    try:
                        results.update(resp.json())
                    except Exception:
                        pass
        return results

    async def calculate_batch(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Пакетный расчет всех медицинских шкал через UI слой калькулятора."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{self.calc_url}/ui/calculate-all", json=features)
            resp.raise_for_status()
            return resp.json()

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
        """Запрашивает демо-данные у ML-сервиса."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            current_v = version or "v3" # фоллбэк
            try:
                resp = await client.get(f"{self.ml_url}/model/demo-data", params={"version": current_v})
                resp.raise_for_status()
                return resp.json().get("features", {})
            except Exception:
                return {} # Если эндпоинт ML временно недоступен
ml_client = MLClient()