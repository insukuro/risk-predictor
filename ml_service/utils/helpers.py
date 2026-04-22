"""Вспомогательные функции."""
from typing import Any

def get_risk_level(risk_score: float) -> str:
    """Определяет уровень риска по скору."""
    if risk_score < 0.3:
        return "low"
    elif risk_score < 0.7:
        return "medium"
    return "high"

def normalize_risk_score(score: float) -> float:
    """Нормализует риск скор в диапазон [0, 1]."""
    if score <= 1:
        return score
    return min(score / 100, 1.0)

def get_default_value(feature_name: str) -> Any:
    """Возвращает дефолтные значения для признаков."""
    feature_lower = feature_name.lower()
    
    if '0/1' in feature_name or any(x in feature_lower for x in ['наличие', 'гипертония', 'диабет']):
        return 0
    
    if any(x in feature_lower for x in ['категория', 'стадия', 'фк', 'группа']):
        return 1
    
    if 'hb' in feature_lower or 'гемоглобин' in feature_lower:
        return 120.0
    
    if 'возраст' in feature_lower:
        return 60
    
    if 'креатинин' in feature_lower:
        return 80.0
    
    if 'мочевина' in feature_lower:
        return 5.0
    
    if 'k+' in feature_lower or 'калий' in feature_lower:
        return 4.0
    
    if 'na+' in feature_lower or 'натрий' in feature_lower:
        return 140.0
    
    if 'глюкоза' in feature_lower:
        return 5.5
    
    return 0.0
