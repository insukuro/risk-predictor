"""Выполнение предсказаний на базе одиночных моделей или ансамблей."""
from typing import Dict, Any
import pandas as pd

from ml_service.features.preparation import prepare_features
from ml_service.utils.helpers import get_risk_level_from_score

def predict(package: dict, features: Dict[str, Any]) -> Dict[str, Any]:
    """Основная точка расчета рисков для переданного пакета модели."""
    # Делегируем сборку и валидацию матрицы признаков специализированному модулю
    df = prepare_features(package, features)
    
    if package.get("is_ensemble", False):
        return _predict_ensemble(package, df, features)
    return _predict_single(package, df)


def _predict_ensemble(package: dict, df: pd.DataFrame, original_features: dict) -> Dict[str, Any]:
    """Инференс клинического ансамбля с маршрутизацией ИК / без ИК."""
    is_on_pump = _determine_pump_status(df, original_features)
    
    # Маршрутизация по типу операции (с искусственным кровообращением или на работающем сердце)
    models_dict = package.get("models_ik" if is_on_pump == 1 else "models_offpump", {})
    if not models_dict:
        models_dict = package.get("models_ik", package.get("models_offpump", {}))
        
    targets_outputs = []
    max_prob = 0.0
    
    for target_name, model in models_dict.items():
        # Считаем вероятность [0.0, 1.0]
        prob = float(model.predict_proba(df)[0][1])
        # Переводим в проценты [0.0, 100.0] для унификации с API
        score_percent = round(prob * 100, 2)
        
        targets_outputs.append({
            "name": target_name,
            "score": score_percent,
            "level": get_risk_level_from_score(score_percent)  # 🔑 ИСПРАВЛЕНО: единая шкала
        })
        max_prob = max(max_prob, prob)

    final_score = round(max_prob * 100, 2)
    
    return {
        "risk_score": final_score,
        "risk_level": get_risk_level_from_score(final_score),
        "targets": targets_outputs,
        "version": package.get("version", "v4")
    }


def _predict_single(package: dict, df: pd.DataFrame) -> Dict[str, Any]:
    """Инференс базовой изолированной модели."""
    model = package["model"]
    raw_pred = model.predict_proba(df)[0][1]
    score_percent = round(float(raw_pred) * 100, 2)
    
    return {
        "risk_score": score_percent,
        "risk_level": get_risk_level_from_score(score_percent),
        "version": package.get("version", "v1")
    }


def _determine_pump_status(df: pd.DataFrame, original_features: dict) -> int:
    """Извлекает бинарный статус проведения ИК."""
    pump_cols = [col for col in df.columns if 'pump' in col.lower()]
    if pump_cols:
        try:
            return int(float(df[pump_cols[0]].iloc[0]))
        except (ValueError, TypeError):
            pass
            
    for key, value in original_features.items():
        if 'pump' in key.lower():
            try:
                return int(float(value))
            except (ValueError, TypeError):
                break
    return 1  # По умолчанию ИК (консервативный сценарий)