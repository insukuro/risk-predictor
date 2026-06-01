"""Конфигурация сервиса и единые пороги клинических рисков."""
import os
from pathlib import Path

class Config:
    MODELS_DIR = Path(os.getenv("MODELS_DIR", "ml_service/model_versions"))
    DEFAULT_PORT = int(os.getenv("PORT", 8001))
    HOST = os.getenv("HOST", "0.0.0.0")
    
    # Унифицированные пороги рисков в процентах (0 - 100)
    # Применяются одинаково и к общему скору, и к отдельным осложнениям
    RISK_THRESHOLDS = {
        "medium": 5.0,
        "danger": 15.0
    } 

config = Config()