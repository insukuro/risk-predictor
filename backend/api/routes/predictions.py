import uuid
from typing import Dict, Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from backend.clients.ml_client import ml_client
from backend.db.session import get_db, SessionLocal
from backend.models.schemas import PredictRequest
from backend.services.prediction_service import PredictionService
from backend.db.models import Operation

router = APIRouter(prefix="/predictions", tags=["predictions"])
task_status: Dict[str, Dict[str, Any]] = {}

# ==========================================
# 1. СЛОЙ UI (BACKEND-FOR-FRONTEND)
# ==========================================

@router.get("/ui/schema")
async def get_ui_schema(version: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    UI Контракт: Динамически формирует схему полей для отрисовки на фронтенде.
    Запрашивает ML о нужных фичах, прокидывает зависимости через калькулятор 
    и отдает только необходимые raw-инпуты без дубликатов.
    """
    return await PredictionService.get_ui_schema(db, version)

@router.post("/ui/predict")
async def predict_ui(
    request: PredictRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    UI Эндпоинт: Запускает расчет с сохранением в БД (или без него).
    Поддерживает background-tasks для поллинга со стороны фронтенда.
    """
    # Если это "тестовый" расчет без сохранения
    if not request.operation_id:
        result = await PredictionService.process_ui_prediction(
            db=db, 
            features=request.features, 
            version=request.model_version
        )
        return {"status": "completed", "saved": False, "result": result}

    # Проверка существования операции
    op = db.query(Operation).filter(Operation.id == request.operation_id).first()
    if not op:
        raise HTTPException(
            status_code=404,
            detail=f"Операция с ID {request.operation_id} не найдена."
        )

    # Фоновая задача для фронтенда
    task_id = str(uuid.uuid4())
    task_status[task_id] = {"status": "pending", "operation_id": request.operation_id}
    background_tasks.add_task(run_async_prediction, task_id, request)
    
    return {"task_id": task_id, "status": "pending"}

@router.get("/ui/status/{task_id}")
async def get_task_status(task_id: str):
    """UI Polling: Фронтенд опрашивает этот эндпоинт для получения результата."""
    status = task_status.get(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return status

@router.get("/ui/history", response_model=List[Dict[str, Any]])
async def list_predictions(
    patient_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """UI Эндпоинт: История предсказаний для интерфейса."""
    return PredictionService.get_predictions_list(db, patient_id, skip, limit)

@router.get("/ui/demo-data")
async def get_demo_data(version: Optional[str] = Query(None)):
    """
    Возвращает валидный набор демо-данных для быстрой проверки формы.
    """
    try:
        data = await ml_client.get_demo_data(version)
        # Убеждаемся, что pump всегда есть в демо-данных
        if "pump (0/1)" not in data:
            data["pump (0/1)"] = 1
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# ==========================================
# 2. СЛОЙ API (ЧИСТАЯ ЛОГИКА / ИНТЕГРАЦИИ)
# ==========================================

@router.post("/predict")
async def predict_pure_api(request: PredictRequest):
    """
    API-First Эндпоинт: Прозрачная логика для внешних интеграций.
    Синхронно: принимает сырые данные -> калькулятор -> ML -> отдает прогноз.
    Никаких background tasks или привязок к UI.
    """
    try:
        # Прямой вызов чистой логики расчета без сохранения и UI-обвязки
        result = await PredictionService.perform_pure_prediction(
            features=request.features, 
            version=request.model_version
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ==========================================

async def run_async_prediction(task_id: str, request: PredictRequest):
    db = SessionLocal()
    try:
        service_result = await PredictionService.process_ui_prediction(
            db=db,
            features=request.features,
            version=request.model_version,
            operation_id=request.operation_id
        )
        task_status[task_id] = {
            "status": "completed",
            "result": service_result
        }
    except Exception as e:
        task_status[task_id] = {"status": "failed", "error": str(e)}
    finally:
        db.close()