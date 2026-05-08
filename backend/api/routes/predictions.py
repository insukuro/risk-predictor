from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import httpx
import uuid
from datetime import datetime
import os

from backend.db.session import get_db, SessionLocal
from backend.db.models import Prediction, ClinicalData
from backend.models.schemas import PredictRequest, PredictionResponse

router = APIRouter(prefix="/predictions", tags=["predictions"])

ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8001")

async_predictions: Dict[str, Dict[str, Any]] = {}

async def request_ml(path: str, method: str = "GET", data: Any = None):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if method == "POST":
                # ВАЖНО: передаем в ML сервис ключ "version", как он просит
                response = await client.post(f"{ML_SERVICE_URL}{path}", json=data)
            else:
                response = await client.get(f"{ML_SERVICE_URL}{path}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"ML Service Error: {e}")
            raise HTTPException(status_code=502, detail="ML Service unavailable")

@router.get("/config")
async def get_model_config(version: Optional[str] = Query(None)):
    """Собирает конфиг для фронтенда."""
    # 1. Получаем список версий
    versions_data = await request_ml("/models/versions")
    v_dict = versions_data.get("versions", {})
    v_list = list(v_dict.keys())
    
    current_v = version or versions_data.get("current_version", "v1")
    
    # 2. Получаем инфо по конкретной версии
    model_info = await request_ml(f"/model/info?version={current_v}")
    # 3. Пробуем получить демо-данные (не падаем если их нет)
    demo_input = None
    demo_result = None
    try:
        demo_data = await request_ml(f"/model/demo?version={current_v}")
        if demo_data.get("demo_available"):
            demo_input = demo_data.get("demo_input_features")
            demo_result = demo_data.get("demo_prediction")
    except Exception:
        pass
    
    return {
        "available_versions": v_list,
        "current_version": current_v,
        "features": model_info.get("required_features", []),
        "top_features": model_info.get("required_features", []),
        "categorical_features": model_info.get("categorical_features", []),
        "demo": {
            "available": demo_input is not None,
            "input": demo_input,
            "result": demo_result
        }
    }

@router.post("/predict")
async def predict(request: PredictRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Подготовка данных для ML (согласно его схеме PredictRequest)
    ml_request_data = {
        "features": request.features,
        "version": request.model_version  # Фронт шлет model_version -> ML ждет version
    }

    # Режим БЕЗ сохранения в БД
    if not request.operation_id:
        result = await request_ml("/predict", "POST", ml_request_data)
        return {"status": "completed", "saved": False, "result": result}

    # Режим С сохранением (асинхронно)
    task_id = str(uuid.uuid4())
    async_predictions[task_id] = {
        "status": "pending",
        "operation_id": request.operation_id,
        "features": request.features,
        "version": request.model_version
    }
    background_tasks.add_task(process_and_save, task_id)
    return {"task_id": task_id, "status": "pending"}

async def process_and_save(task_id: str):
    task = async_predictions.get(task_id)
    db = SessionLocal()
    try:
        # 1. Запрос к ML
        ml_result = await request_ml("/predict", "POST", {
            "features": task["features"],
            "version": task["version"]
        })
        
        # 2. Сохранение ClinicalData (признаки)
        cd = ClinicalData(operation_id=task["operation_id"], features=task["features"])
        db.add(cd)
        
        # 3. Сохранение Prediction
        pred = Prediction(
            operation_id=task["operation_id"],
            risk_score=ml_result["risk_score"],
            risk_level=ml_result["risk_level"],
            model_version=ml_result["version"]
        )
        db.add(pred)
        db.commit()
        task.update({"status": "completed", "result": ml_result})
    except Exception as e:
        task.update({"status": "failed", "error": str(e)})
    finally:
        db.close()

@router.get("/status/{task_id}")
async def get_status(task_id: str):
    task = async_predictions.get(task_id)
    if not task: raise HTTPException(status_code=404)
    return task