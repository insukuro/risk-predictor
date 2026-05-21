import pandas as pd
import numpy as np
from typing import Dict, Any

def predict(package: dict, features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет предсказание с нормализацией ключей.
    """
    feature_names = package.get("feature_names", [])
    is_ensemble = package.get("is_ensemble", False)
    
    # Нормализуем входные ключи
    normalized_inputs = _normalize_keys(features, feature_names)
    
    # Готовим features через prepare_features для консистентности
    from ml_service.features.preprocessing import prepare_features
    df = prepare_features(package, normalized_inputs)
    
    # Определяем pump статус
    pump_value = _extract_pump_value(normalized_inputs)
    
    if is_ensemble:
        models_dict = (
            package.get("models_ik", {}) 
            if pump_value == 1 
            else package.get("models_offpump", {})
        )
        
        targets_outputs = []
        main_score = 0.0
        
        for target_name, model in models_dict.items():
            prob = float(model.predict_proba(df)[0][1])
            level = _get_risk_level(prob)
            
            targets_outputs.append({
                "name": target_name,
                "score": round(prob * 100, 2),
                "level": level
            })
            
            if not main_score:
                main_score = prob
        
        final_score = round(main_score * 100, 2)
        final_level = _get_risk_level(main_score)
        
        return {
            "risk_score": final_score,
            "risk_level": final_level,
            "targets": targets_outputs,
            "version": package.get("version", "v2")
        }
    else:
        model = package["model"]
        raw_pred = model.predict_proba(df)[0][1]
        score = round(float(raw_pred) * 100, 2)
        level = _get_risk_level(raw_pred)
        
        return {
            "risk_score": score,
            "risk_level": level,
            "version": package.get("version", "v1")
        }


def _normalize_keys(input_dict: Dict, expected_features: list) -> Dict:
    """Нормализует ключи: 'pump (0/1)' -> 'pump', 'Пол (0=жен,1=муж)' -> 'Пол'"""
    normalized = {}
    
    for key, value in input_dict.items():
        # Прямое совпадение
        if key in expected_features:
            normalized[key] = value
            continue
        
        # Чистим ключ для сравнения
        key_clean = key.lower().replace(' ', '').replace('(', '').replace(')', '')
        
        for expected in expected_features:
            expected_clean = expected.lower().replace(' ', '').replace('(', '').replace(')', '')
            
            if key_clean == expected_clean or key_clean in expected_clean or expected_clean in key_clean:
                normalized[expected] = value
                break
        else:
            normalized[key] = value
    
    return normalized


def _extract_pump_value(features: Dict) -> int:
    """Извлекает значение pump из разных возможных ключей."""
    for key, value in features.items():
        if 'pump' in key.lower():
            return int(value) if value else 1
    return 1  # По умолчанию считаем, что ИК


def _get_risk_level(probability: float) -> str:
    """Определяет уровень риска по вероятности."""
    if probability > 0.5:
        return "danger"
    elif probability > 0.15:
        return "medium"
    return "low"
        
def _predict_single(model, framework: str, features_df) -> float:
    """Атомарная функция предсказания для одной модели."""
    if framework == 'catboost':
        proba = model.predict_proba(features_df)
    else:
        proba = model.predict_proba(features_df) if hasattr(model, 'predict_proba') else model.predict(features_df)

    if isinstance(proba, np.ndarray):
        risk_score = float(proba[0][1]) if proba.ndim == 2 and proba.shape[1] > 1 else float(proba[0])
    else:
        risk_score = float(proba)
        
    #return normalize_risk_score(risk_score)
