"""Prediction endpoints with async ML service integration."""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import httpx
import uuid
from datetime import datetime
import os

from backend.db.session import get_db
from backend.db.models import Prediction, Operation, ClinicalData  # Правильный импорт
from backend.models.schemas import (
    PredictRequest, PredictResponse,
    PredictionResponse, PredictionDetailResponse,
    ModelInfoResponse
)
from backend.services.prediction_service import PredictionService

router = APIRouter(prefix="/predictions", tags=["predictions"])

# ML Service configuration
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8007")
ML_SERVICE_TIMEOUT = int(os.getenv("ML_SERVICE_TIMEOUT", "30"))

# In-memory storage for async prediction status (in production use Redis)
async_predictions: Dict[str, Dict[str, Any]] = {}


async def call_ml_service(features: Dict[str, Any], model_version: Optional[str] = None) -> Dict[str, Any]:
    """Async call to ML service for prediction."""
    async with httpx.AsyncClient(timeout=ML_SERVICE_TIMEOUT) as client:
        request_data = {
            "features": features,
            "version": model_version
        }
        
        try:
            response = await client.post(
                f"{ML_SERVICE_URL}/predict",
                json=request_data
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="ML service timeout")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, 
                              detail=f"ML service error: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ML service connection error: {str(e)}")


async def get_model_features(model_version: Optional[str] = None) -> Dict[str, Any]:
    """Get model info and required features from ML service."""
    async with httpx.AsyncClient(timeout=ML_SERVICE_TIMEOUT) as client:
        url = f"{ML_SERVICE_URL}/model/info"
        if model_version:
            url += f"?version={model_version}"
        
        try:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")


async def get_model_versions() -> Dict[str, Any]:
    """Get available model versions from ML service."""
    async with httpx.AsyncClient(timeout=ML_SERVICE_TIMEOUT) as client:
        try:
            response = await client.get(f"{ML_SERVICE_URL}/models/versions")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get model versions: {str(e)}")


async def save_prediction_async(task_id: str):
    """Background task to get prediction from ML and save to DB."""
    from backend.db.session import SessionLocal
    
    task_data = async_predictions.get(task_id)
    if not task_data:
        return
    
    db = SessionLocal()
    
    try:
        # Call ML service
        ml_result = await call_ml_service(
            features=task_data["features"],
            model_version=task_data.get("model_version")
        )
        
        # Create prediction in DB
        prediction = Prediction(
            operation_id=task_data["operation_id"],
            risk_score=ml_result["risk_score"],
            risk_level=ml_result["risk_level"],
            model_version=ml_result["version"],
            created_at=datetime.now()
        )
        
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        
        # Update in-memory storage
        async_predictions[task_id]["status"] = "completed"
        async_predictions[task_id]["result"] = ml_result
        async_predictions[task_id]["completed_at"] = datetime.now().isoformat()
        async_predictions[task_id]["prediction_id"] = prediction.id
        
    except Exception as e:
        async_predictions[task_id]["status"] = "failed"
        async_predictions[task_id]["error"] = str(e)
    finally:
        db.close()


@router.post("/predict", response_model=Dict[str, Any])
async def predict(
    request: PredictRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Async prediction endpoint.
    
    Returns task_id for polling the result.
    """
    try:
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Store prediction request
        async_predictions[task_id] = {
            "task_id": task_id,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "features": request.features,
            "model_version": request.model_version,
            "operation_id": request.operation_id
        }
        
        # Start async prediction
        background_tasks.add_task(save_prediction_async, task_id)
        
        return {
            "task_id": task_id,
            "status": "pending",
            "message": "Prediction started. Poll /predictions/status/{task_id} for result."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start prediction: {str(e)}")


@router.get("/status/{task_id}", response_model=Dict[str, Any])
async def get_prediction_status(task_id: str):
    """Get async prediction status and result."""
    task_data = async_predictions.get(task_id)
    
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    response = {
        "task_id": task_id,
        "status": task_data["status"],
        "created_at": task_data["created_at"]
    }
    
    if task_data["status"] == "completed":
        response["result"] = task_data["result"]
        response["prediction_id"] = task_data.get("prediction_id")
        response["completed_at"] = task_data.get("completed_at")
    elif task_data["status"] == "failed":
        response["error"] = task_data.get("error")
    
    return response


@router.post("/predict/sync", response_model=PredictResponse)
async def predict_sync(request: PredictRequest, db: Session = Depends(get_db)):
    """
    Synchronous prediction endpoint (fallback).
    
    Directly calls ML service and saves to DB.
    """
    try:
        # Call ML service
        ml_result = await call_ml_service(
            features=request.features,
            model_version=request.model_version
        )
        
        # Save to database
        prediction = Prediction(
            operation_id=request.operation_id,
            risk_score=ml_result["risk_score"],
            risk_level=ml_result["risk_level"],
            model_version=ml_result["version"],
            created_at=datetime.now()
        )
        
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        
        return {
            "prediction_id": prediction.id,
            "risk_score": prediction.risk_score,
            "risk_level": prediction.risk_level,
            "model_version": prediction.model_version,
            "created_at": prediction.created_at
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.get("/model/features", response_model=Dict[str, Any])
async def get_model_features_endpoint(version: Optional[str] = Query(None)):
    """
    Get model features dynamically from ML service.
    
    Frontend should call this to know which features are required.
    """
    try:
        model_info = await get_model_features(version)
        return model_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model features: {str(e)}")


@router.get("/model/versions", response_model=Dict[str, Any])
async def get_model_versions_endpoint():
    """Get available model versions from ML service."""
    try:
        versions_info = await get_model_versions()
        return versions_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model versions: {str(e)}")


@router.post("/model/set-version", response_model=Dict[str, Any])
async def set_model_version(version: str):
    """Set current model version in ML service."""
    async with httpx.AsyncClient(timeout=ML_SERVICE_TIMEOUT) as client:
        try:
            response = await client.post(
                f"{ML_SERVICE_URL}/models/set_version",
                params={"version": version}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to set model version: {str(e)}")


@router.get("", response_model=List[PredictionResponse])
async def get_predictions(
    patient_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get prediction history.
    
    Supports filtering by patient_id.
    """
    predictions = PredictionService.get_all(db, patient_id)
    
    result = []
    for pred in predictions:
        operation = pred.operation
        result.append({
            "id": pred.id,
            "operation_id": pred.operation_id,
            "patient_id": operation.patient_id,
            "risk_score": pred.risk_score,
            "risk_level": pred.risk_level,
            "model_version": pred.model_version,
            "created_at": pred.created_at
        })
    
    return result


@router.get("/{prediction_id}", response_model=PredictionDetailResponse)
async def get_prediction(prediction_id: int, db: Session = Depends(get_db)):
    """Get prediction details by ID."""
    prediction = PredictionService.get(db, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    
    # Get clinical data for full features
    clinical_data = None
    if prediction.operation.clinical_data:
        clinical_data = prediction.operation.clinical_data[0].features
    
    return {
        "id": prediction.id,
        "operation_id": prediction.operation_id,
        "patient_id": prediction.operation.patient_id,
        "risk_score": prediction.risk_score,
        "risk_level": prediction.risk_level,
        "model_version": prediction.model_version,
        "created_at": prediction.created_at,
        "features": clinical_data
    }


@router.get("/model/info", response_model=ModelInfoResponse)
async def get_model_info():
    """Get ML model information from ML service."""
    try:
        async with httpx.AsyncClient(timeout=ML_SERVICE_TIMEOUT) as client:
            response = await client.get(f"{ML_SERVICE_URL}/model/info")
            response.raise_for_status()
            ml_info = response.json()
            
            return {
                "version": ml_info["version"],
                "features": ml_info["required_features"],
                "framework": ml_info.get("framework", "unknown"),
                "total_features": ml_info.get("total_features", 0)
            }
    except Exception as e:
        # Fallback to basic info if ML service is unavailable
        return {
            "version": "unknown",
            "features": ["age", "sex", "operation_type"],
            "framework": "unknown",
            "total_features": 0
        }