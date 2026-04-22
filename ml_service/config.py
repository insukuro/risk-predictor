"""Конфигурация сервиса."""
import os
from pathlib import Path

class Config:
    MODELS_DIR = Path(os.getenv("MODELS_DIR", "ml_service/model_versions"))
    DEFAULT_PORT = int(os.getenv("PORT", 8001))
    HOST = os.getenv("HOST", "0.0.0.0")
    
    # Пороги для уровней риска
    RISK_THRESHOLDS = {
        "low": 0.3,
        "medium": 0.7
    }

config = Config()
