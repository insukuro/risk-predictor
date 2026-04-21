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
    operation_id: int
    features: Dict[str, Any]
    model_version: Optional[str] = None

class PredictResponse(BaseModel):
    """Risk prediction response."""
    prediction_id: int
    risk_score: float
    risk_level: str
    model_version: str
    created_at: datetime

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# Model Info Response
class ModelVersionInfo(BaseModel):
    """Info about specific model version."""
    is_current: bool
    features_count: int
    framework: str
    model_type: str
    loaded_at: Optional[str] = None
    file_size_mb: Optional[float] = None


class ModelVersionResponse(BaseModel):
    """Response schema for model versions list."""
    current_version: str
    versions: Dict[str, ModelVersionInfo]

# В backend/models/schemas.py

class ModelInfoResponse(BaseModel):
    """Response schema for model information from ML service."""
    version: str
    is_current: Optional[bool] = None
    framework: Optional[str] = None
    model_type: Optional[str] = None
    total_features: int
    required_features: List[str]
    categorical_features: Optional[List[str]] = []
    loaded_at: Optional[str] = None
    file_path: Optional[str] = None

class SetVersionResponse(BaseModel):
    """Response when setting current model version."""
    version: str
    required_features: List[str]
# Health Check Response
class HealthCheckResponse(BaseModel):
    """Health check response."""
    service: str = Field(..., alias="model_service")

    model_config = ConfigDict(populate_by_name=True)
    database: str
    model_service: str
