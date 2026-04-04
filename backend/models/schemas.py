"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, date
from typing import Optional, List, Dict, Any


# Patient Schemas
class PatientCreate(BaseModel):
    """Patient creation request."""
    sex: str
    birth_date: date


class PatientResponse(BaseModel):
    """Patient response."""
    id: int
    sex: str
    birth_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Operation Schemas
class OperationCreate(BaseModel):
    """Operation creation request."""
    patient_id: int
    type: str
    date: date


class OperationResponse(BaseModel):
    """Operation response."""
    id: int
    patient_id: int
    type: str
    date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)





# Prediction Schemas
class PredictionResponse(BaseModel):
    """Prediction response."""
    id: int
    operation_id: int
    risk_score: float
    risk_level: str
    version: str = Field(..., alias="model_version")
    created_at: datetime
    patient_id: Optional[int] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class PredictionDetailResponse(PredictionResponse):
    """Detailed prediction response with features."""
    features: Optional[Dict[str, Any]] = None


# Predict Request/Response
class PatientInfo(BaseModel):
    """Patient info in predict request."""
    id: Optional[int] = None
    sex: str
    birth_date: date


class OperationInfo(BaseModel):
    """Operation info in predict request."""
    type: str
    date: date


class PredictRequest(BaseModel):
    """Risk prediction request."""
    patient: PatientInfo
    operation: OperationInfo
    features: Dict[str, Any] = Field(..., description="Features for prediction")


class PredictResponse(BaseModel):
    """Risk prediction response."""
    prediction_id: int
    risk_score: float
    risk_level: str
    model_version: str
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# Model Info Response
class ModelInfoResponse(BaseModel):
    """ML Model information response."""
    version: str
    features: List[str]


# Health Check Response
class HealthCheckResponse(BaseModel):
    """Health check response."""
    service: str = Field(..., alias="model_service")

    model_config = ConfigDict(populate_by_name=True)
    database: str
    model_service: str
