import httpx
import os
from typing import Dict, Any, Optional, List

class MLClient:
    def __init__(self):
        self.ml_url = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
        self.calc_url = os.getenv("CALC_SERVICE_URL", "http://localhost:8005")
        self.timeout = httpx.Timeout(30.0, connect=10.0)

    async def get_model_info(self, version: Optional[str]) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            versions = await client.get(f"{self.ml_url}/models/versions")
            current_v = version or versions.json().get("current_version", "v1")
            info = await client.get(f"{self.ml_url}/model/info", params={"version": current_v})
            return {
                "info": info.json(),
                "available_versions": list(versions.json().get("versions", {}).keys()),
                "current_version": current_v
            }

    async def calculate_features(self, features: Dict[str, Any]) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{self.calc_url}/calculate/all", json=features)
            resp.raise_for_status()
            return resp.json()

    async def get_calc_metadata(self) -> List[str]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.calc_url}/metadata")
                return resp.json().get("calculated_features", [])
        except Exception:
            return []

    async def predict(self, features: Dict[str, Any], version: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.ml_url}/predict", 
                json={"features": features, "version": version}
            )
            resp.raise_for_status()
            return resp.json()

ml_client = MLClient()