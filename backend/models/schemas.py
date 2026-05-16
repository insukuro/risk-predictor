"""Pydantic schemas for request/response validation."""
from fastapi import Query
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, date
from typing import Optional, List, Dict, Any


# =====================
# Patient Schemas
# =====================

class PatientCreate(BaseModel):
    """Patient creation request."""
    sex: str = Field(..., pattern="^(male|female|other)$")
    birth_date: date


class PatientUpdate(BaseModel):
    """Patient update request."""
    sex: Optional[str] = Field(None, pattern="^(male|female|other)$")
    birth_date: Optional[date] = None


class PatientFilter(BaseModel):
    """Patient listing filters."""
    sex: Optional[str] = Query(None)
    age_min: Optional[int] = Query(None, ge=0, le=150)
    age_max: Optional[int] = Query(None, ge=0, le=150)
    has_operations: Optional[bool] = Query(None)
    search: Optional[str] = Query(None, description="Search by ID or text")


class PatientResponse(BaseModel):
    """Patient response."""
    id: int
    sex: str
    birth_date: date
    created_at: datetime
    age: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class PatientWithOperations(PatientResponse):
    """Patient with operations."""
    operations: List["OperationSummary"]
    total_operations: int
    last_operation_date: Optional[date] = None


class PatientOperationStats(BaseModel):
    """Patient operation statistics."""
    patient_id: int
    total_operations: int
    operation_types: Dict[str, int]
    operations_with_predictions: int
    operations_without_predictions: int
    avg_risk_score: Optional[float] = None
    risk_level_distribution: Dict[str, int]
    first_operation_date: Optional[date] = None
    last_operation_date: Optional[date] = None
    days_since_last_operation: Optional[int] = None


class AgeDistribution(BaseModel):
    """Age distribution statistics."""
    ranges: Dict[str, int]
    total_patients: int
    average_age: float


# =====================
# Operation Schemas
# =====================

class OperationCreate(BaseModel):
    """Operation creation request."""
    patient_id: int
    type: str
    date: date


class OperationUpdate(BaseModel):
    """Operation update request."""
    type: Optional[str] = None
    date: Optional[date] = None


class OperationFilter(BaseModel):
    """Operation listing filters."""
    patient_id: Optional[int] = Query(None)
    type: Optional[str] = Query(None)
    date_from: Optional[date] = Query(None)
    date_to: Optional[date] = Query(None)
    has_predictions: Optional[bool] = Query(None)


class OperationResponse(BaseModel):
    """Operation response."""
    id: int
    patient_id: int
    type: str
    date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OperationSummary(BaseModel):
    """Operation summary for nested responses."""
    id: int
    type: str
    date: date
    has_clinical_data: bool = False
    has_prediction: bool = False
    prediction_count: int = 0
    latest_risk_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ClinicalDataResponse(BaseModel):
    """Clinical data response."""
    id: int
    operation_id: int
    features: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OperationWithClinicalData(OperationResponse):
    """Operation with clinical data."""
    clinical_data: ClinicalDataResponse


class OperationWithPrediction(OperationResponse):
    """Operation with predictions."""
    predictions: List["PredictionResponse"]


# =====================
# Prediction Schemas
# =====================

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


# =====================
# Predict Request/Response
# =====================

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
    """Prediction request с поддержкой гибких полей ансамбля."""
    features: Dict[str, Any]
    model_version: Optional[str] = None
    operation_id: Optional[int] = None

    # Позволяет схеме не падать по 422, если с фронта/датасета прилетают дополнительные мета-поля
    model_config = ConfigDict(extra="allow")

# Добавьте класс описания одной цели/мишени риска
class TargetRiskItem(BaseModel):
    name: str
    score: float
    level: str

# Обновите основную схему ответа
class PredictResponse(BaseModel):
    """Расширенный ответ риска с поддержкой мультиклассовости."""
    prediction_id: Optional[int] = Field(None, alias="id") # поддержка id из БД
    risk_score: float
    risk_level: str
    model_version: str
    created_at: Optional[datetime] = None
    saved: bool = False
    targets: List[TargetRiskItem] = [] # Новый массив для детализации рисков (v4 ансамбль)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =====================
# Model Info Schemas
# =====================

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


# =====================
# Health Check
# =====================

class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    database: str
    ml_service: str = Field(alias="model_service")
    
    model_config = ConfigDict(
        populate_by_name=True,
        protected_namespaces=()
    )

PatientWithOperations.model_rebuild()
OperationWithPrediction.model_rebuild()