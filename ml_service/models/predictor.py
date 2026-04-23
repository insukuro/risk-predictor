"""Логика предсказаний."""
import numpy as np
from typing import Dict, Any
from features.engineering import prepare_features
from ml_service.utils.helpers import normalize_risk_score, get_risk_level

def predict(model_package: Dict, features: Dict[str, Any]) -> Dict[str, Any]:
    """Выполняет предсказание."""
    model = model_package['model']
    framework = model_package.get('framework', 'unknown')
    
    # Подготовка признаков
    features_df = prepare_features(model_package, features)
    
    # Предсказание
    if framework == 'catboost':
        proba = model.predict_proba(features_df)
    else:
        proba = model.predict_proba(features_df) if hasattr(model, 'predict_proba') else model.predict(features_df)
    
    # Извлечение вероятности
    if isinstance(proba, np.ndarray):
        risk_score = float(proba[0][1]) if proba.ndim == 2 and proba.shape[1] > 1 else float(proba[0])
    else:
        risk_score = float(proba)
    
    # Нормализация
    risk_score = normalize_risk_score(risk_score)
    
    return {
        "risk_score": round(risk_score, 4),
        "risk_percent": round(risk_score * 100, 1),
        "risk_level": get_risk_level(risk_score)
    }
