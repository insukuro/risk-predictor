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
from backend.services.prediction_service import PredictionService

router = APIRouter(prefix="/predictions", tags=["predictions"])

ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
CALC_SERVICE_URL = os.getenv("CALC_SERVICE_URL", "http://localhost:8005")

async_predictions: Dict[str, Dict[str, Any]] = {}

async def request_calc(features: Dict[str, Any]):
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # Отправляем сырые фичи, получаем объект с посчитанными метриками
            response = await client.post(f"{CALC_SERVICE_URL}/calculate/all", json=features)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Calc Service Error: {e}")
            # Если калькулятор упал, можно либо пробросить ошибку, 
            raise HTTPException(status_code=502, detail="Calculator service unavailable")
        
        
async def request_ml(path: str, method: str = "GET", data: Any = None):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if method == "POST":
                response = await client.post(f"{ML_SERVICE_URL}{path}", json=data)
            else:
                response = await client.get(f"{ML_SERVICE_URL}{path}")
            
            # Если ML вернул 400 или 500, мы хотим видеть ПОЧЕМУ
            if response.status_code != 200:
                print(f"ML Service Detail: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"ML Error: {response.text}")
                
            return response.json()
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail="Could not connect to ML Service")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        
        
@router.get("/config")
async def get_model_config(version: Optional[str] = Query(None)):
    # 1. Получаем инфо от ML
    versions_data = await request_ml("/models/versions")
    current_v = version or versions_data.get("current_version", "v1")
    model_info = await request_ml(f"/model/info?version={current_v}")
    
    all_required = model_info.get("required_features", [])
    
    # 2. Получаем список того, что считает калькулятор
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            calc_resp = await client.get(f"{CALC_SERVICE_URL}/metadata")
            calculated_features = calc_resp.json().get("calculated_features", [])
    except Exception:
        calculated_features = []

    # 3. ФИЛЬТРАЦИЯ: Оставляем только те поля, которые НЕ считаются автоматически
    # Это и будет списком полей для отрисовки на фронте
    ui_features = [f for f in all_required if f not in calculated_features]

    return {
        "available_versions": list(versions_data.get("versions", {}).keys()),
        "current_version": current_v,
        "features": ui_features, # Фронт рисует только "сырые" данные
        "categorical_features": [f for f in model_info.get("categorical_features", []) if f in ui_features],
        "demo": {
            "available": False # Демо лучше отключить или фильтровать аналогично
        }
    }

@router.post("/predict")
async def predict(request: PredictRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Вызываем калькулятор. 
    # Так как в PatientData стоит populate_by_name=True, 
    # он примет dict, где ключи совпадают с алиасами (например, "Возраст (лет)")
    calc_results = await request_calc(request.features)
    
    # 2. Формируем полный пакет (Сырые данные + Расчетные метрики)
    # Важно: расчетные значения из calc_results перекроют сырые, если вдруг будет дубль
    full_features = {**request.features, **calc_results}
    full_features.pop("status", None) # убираем служебное поле "success"

    ml_request_data = {
        "features": full_features,
        "version": request.model_version
    }

    if not request.operation_id:
        # Режим без сохранения (превью)
        result = await request_ml("/predict", "POST", ml_request_data)
        return {"status": "completed", "saved": False, "result": result}

    # Режим с сохранением (фоновая задача)
    task_id = str(uuid.uuid4())
    async_predictions[task_id] = {
        "status": "pending",
        "operation_id": request.operation_id,
        "features": full_features, # В БД сохраняем полный набор данных
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

@router.get("")
async def list_predictions(
    patient_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Вывести все предсказания и связанных с ней пациентов."""
    from sqlalchemy.orm import joinedload
    from backend.db.models import Operation, Patient, ClinicalData

    query = db.query(Prediction).options(
        joinedload(Prediction.operation).joinedload(Operation.patient),
        joinedload(Prediction.operation).joinedload(Operation.clinical_data),
    )

    if patient_id:
        query = query.join(Operation).filter(
            Operation.patient_id == patient_id
        )

    predictions = query.order_by(
        Prediction.created_at.desc()
    ).offset(skip).limit(limit).all()

    result = []
    for pred in predictions:
        # Берём features из clinical_data (если они вообще есть)
        features = {}
        if pred.operation and pred.operation.clinical_data:
            for cd in pred.operation.clinical_data:
                if cd.features:
                    features.update(cd.features)

        result.append({
            "id": pred.id,
            "risk_score": pred.risk_score,
            "risk_level": pred.risk_level,
            "created_at": pred.created_at.isoformat() if pred.created_at else None,
            "model_version": pred.model_version,
            "operation": {
                "type": pred.operation.type,
                "date": pred.operation.date.isoformat() if pred.operation.date else None,
            } if pred.operation else None,
            "patient": {
                "id": pred.operation.patient.id,
                "sex": pred.operation.patient.sex,
                "birth_date": pred.operation.patient.birth_date.isoformat() if pred.operation.patient.birth_date else None,
            } if pred.operation and pred.operation.patient else None,
            "features": features,
        })

    return result

@router.get("/status/{task_id}")
async def get_status(task_id: str):
    task = async_predictions.get(task_id)
    if not task: raise HTTPException(status_code=404)
    return task