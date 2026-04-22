"""Pydantic схемы для API."""
from typing import Dict, Any, Optional
from pydantic import BaseModel

class PredictRequest(BaseModel):
    features: Dict[str, Any]
    version: Optional[str] = None

class SetVersionRequest(BaseModel):
    version: str
