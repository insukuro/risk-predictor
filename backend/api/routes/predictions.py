import uuid
from typing import Dict, Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from backend.db.session import get_db, SessionLocal
from backend.services.prediction_service import PredictionService
from backend.models.schemas import PredictRequest, PredictionResponse

router = APIRouter(prefix="/predictions", tags=["predictions"])

# Словарь для хранения статусов фоновых задач
# Примечание: после рестарта докера он очистится. 
# Для продакшена лучше использовать Redis. - ИНТЕРЕСНО КОМУ ЖЕ Я ЭТО МОГУ ДЕЛЕГИРОВАТЬ ХММММММ
task_status: Dict[str, Dict[str, Any]] = {}

@router.get("/config")
async def get_model_config(version: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Возвращает конфигурацию полей для фронтенда."""
    return await PredictionService.get_ui_config(db, version)

@router.post("/predict")
async def predict(
    request: PredictRequest, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    """
    Создать предсказание. 
    Если operation_id не указан — выполнится синхронно без сохранения.
    Если указан — запустится фоновая задача сохранения.
    """
    # 1. Если это просто "тестовый" расчет без привязки к операции
    if not request.operation_id:
        result = await PredictionService.perform_prediction(
            db, request.features, request.model_version
        )
        return {"status": "completed", "saved": False, "result": result}

    # 2. Если есть operation_id, проверяем его существование сразу
    from backend.db.models import Operation
    op = db.query(Operation).filter(Operation.id == request.operation_id).first()
    if not op:
        raise HTTPException(
            status_code=404, 
            detail=f"Операция с ID {request.operation_id} не найдена. Создайте операцию перед предсказанием."
        )

    # 3. Создаем задачу для фонового выполнения
    task_id = str(uuid.uuid4())
    task_status[task_id] = {"status": "pending", "operation_id": request.operation_id}
    
    background_tasks.add_task(run_async_prediction, task_id, request)
    
    return {"task_id": task_id, "status": "pending"}

@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Эндпоинт, который фронтенд опрашивает (polling), чтобы узнать результат."""
    status = task_status.get(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Задача не найдена или сервер был перезагружен")
    return status

@router.get("", response_model=List[Dict[str, Any]])
async def list_predictions(
    patient_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Список всех предсказаний (для истории на фронте)."""
    return PredictionService.get_predictions_list(db, patient_id, skip, limit)

# --- Вспомогательная функция для фона ---

async def run_async_prediction(task_id: str, request: PredictRequest):
    db = SessionLocal()
    try:
        service_result = await PredictionService.perform_prediction(
            db, 
            request.features, 
            request.model_version, 
            request.operation_id
        )
        
        # Записываем так, чтобы на фронте было data.risk_level
        task_status[task_id] = {
            "status": "completed",
            "result": service_result  # Теперь тут нет лишней вложенности
        }
    except Exception as e:
        print(f"Background task error: {e}")
        task_status[task_id] = {"status": "failed", "error": str(e)}
    finally:
        db.close()