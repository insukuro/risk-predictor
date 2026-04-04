"""Prediction endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.db.session import get_db
from backend.models.schemas import (
    PredictRequest, PredictResponse,
    PredictionResponse, PredictionDetailResponse,
    ModelInfoResponse
)
from backend.services.prediction_service import PredictionService

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest, db: Session = Depends(get_db)):
    """
    Predict risk score for a patient operation.
    
    This is the main endpoint for risk prediction.
    """
    try:
        prediction = PredictionService.create_prediction(db, request)
        
        return {
            "prediction_id": prediction.id,
            "risk_score": prediction.risk_score,
            "risk_level": prediction.risk_level,
            "model_version": prediction.model_version,
            "created_at": prediction.created_at
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


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
    """Get ML model information."""
    return {
        "version": "1.0.0",
        "features": ["age", "sex", "operation_type"]
    }
