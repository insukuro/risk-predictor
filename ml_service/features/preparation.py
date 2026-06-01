"""Подготовка признаков для моделей (Полная совместимость с логикой прототипа)."""
from typing import Dict, Any, List
import pandas as pd
import numpy as np

from ml_service.utils.helpers import get_default_value
from ml_service.features.importance import get_top_features
from ml_service.constants import TARGET_FEATURES

def prepare_features(package: Dict, features_dict: Dict[str, Any]) -> pd.DataFrame:
    """Подготовка признаков для инференса. Полностью повторяет поведение прототипа."""
    all_features = package['feature_names']
    framework = package.get('framework', 'unknown')
    categorical_features = package.get('categorical_features', [])
    
    # 1. ФИЛЬТРАЦИЯ: убираем таргеты и дубликаты шкал
    cleaned_features = _clean_input_features(features_dict)
    
    # 2. НОРМАЛИЗАЦИЯ ВХОДНЫХ ДАННЫХ
    normalized = _normalize_input_keys(cleaned_features, all_features)
    
    # 3. Создаем дефолтные значения для ВСЕХ признаков (база прототипа)
    full_features = {
        feature: get_default_value(feature) 
        for feature in all_features
    }
    
    # 4. Заполняем признаками, которые пришли от пользователя/демо
    for key, value in normalized.items():
        if key in all_features:
            if 'pump' in key.lower():
                full_features[key] = _safe_convert_pump(value)
            else:
                full_features[key] = value
    
    # 5. МЯГКИЙ ФИКС PUMP
    pump_features_input = _extract_pump_from_input(features_dict)
    if pump_features_input is not None:
        for f in all_features:
            if 'pump' in f.lower():
                full_features[f] = _safe_convert_pump(pump_features_input)
                break
    
    # 6. ВАЛИДАЦИЯ ТОП-10 (Логика прототипа: пишем лог вместо падения в 500)
    top_features = get_top_features(package, top_n=10)
    missing = [f for f in top_features if f not in normalized]
    if missing:
        print(f"ℹ️ Note: Top features filled with defaults: {missing}")
    
    # 7. Создаем DataFrame
    df = pd.DataFrame([full_features])
    
    # 8. Обработка категориальных признаков
    _process_categorical_features(df, categorical_features, framework)
    
    # 9. Обработка числовых признаков
    numeric_features = [f for f in all_features if f not in categorical_features]
    _process_numeric_features(df, numeric_features)
    
    # 10. ФИНАЛЬНАЯ ГАРАНТИЯ PUMP
    _final_pump_check(df, framework)
    
    return df[all_features]


def _safe_convert_pump(value: Any) -> Any:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return 0
    try:
        numeric_value = float(value)
        if numeric_value in [0, 1, 0.0, 1.0]:
            return int(numeric_value)
    except (ValueError, TypeError):
        pass
    return value


def _extract_pump_from_input(features_dict: Dict[str, Any]) -> Any:
    for key, value in features_dict.items():
        if 'pump' in key.lower():
            return value
    return None


def _final_pump_check(df: pd.DataFrame, framework: str):
    pump_cols = [col for col in df.columns if 'pump' in col.lower()]
    for pump_col in pump_cols:
        if framework == 'catboost':
            df[pump_col] = df[pump_col].apply(lambda x: str(int(float(x))) if pd.notna(x) and x != '' else '0')
        else:
            df[pump_col] = df[pump_col].apply(lambda x: int(float(x)) if pd.notna(x) and x != '' else 0)


def _clean_input_features(features: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = {}
    for key, value in features.items():
        if key in TARGET_FEATURES or '1-годичная' in key or '30-дневная' in key:
            continue
        
        if key == 'Пол' and 'Пол (0=жен,1=муж)' in features:
            continue
        if key == 'Срочность' and 'Срочность (0=план,1=экстр)' in features:
            continue
        if key == 'Возрастная группа' and 'Возраст (лет)' in features:
            continue
        if key == 'Категория ИМТ' and 'ИМТ (кг/м²)' in features:
            continue
        
        cleaned[key] = value
    return cleaned


def _normalize_input_keys(input_dict: Dict[str, Any], expected_features: List[str]) -> Dict[str, Any]:
    """Улучшенная нормализация: находит точные совпадения по короткому имени."""
    normalized = {}
    for key, value in input_dict.items():
        if key in expected_features:
            normalized[key] = value
            continue
            
        key_clean = key.lower().replace(' ', '').replace('(', '').replace(')', '').replace('_', '').replace('/', '')
        
        # Сначала ищем точное совпадение по очищенному ключу
        found = False
        for expected in expected_features:
            expected_clean = expected.lower().replace(' ', '').replace('(', '').replace(')', '').replace('_', '').replace('/', '')
            if key_clean == expected_clean:
                normalized[expected] = value
                found = True
                break
                
        if found:
            continue
            
        # Если точного совпадения нет, ищем частичное (например, "пол" внутри "пол(0=жен,1=муж)")
        for expected in expected_features:
            expected_clean = expected.lower().replace(' ', '').replace('(', '').replace(')', '').replace('_', '').replace('/', '')
            if key_clean in expected_clean or expected_clean in key_clean:
                normalized[expected] = value
                found = True
                break
                
        if not found:
            normalized[key] = value
    return normalized


def _process_categorical_features(df: pd.DataFrame, categorical_features: list, framework: str):
    for cat_feat in categorical_features:
        if cat_feat in df.columns:
            if framework == 'catboost':
                df[cat_feat] = df[cat_feat].apply(
                    lambda x: str(int(float(x))) if not isinstance(x, str) and pd.notna(x) else str(x) if isinstance(x, str) and x != '' else '0'
                )
            else:
                df[cat_feat] = pd.Categorical(df[cat_feat]).codes


def _process_numeric_features(df: pd.DataFrame, numeric_features: list):
    for num_feat in numeric_features:
        if num_feat in df.columns:
            if 'pump' in num_feat.lower():
                continue
            df[num_feat] = pd.to_numeric(df[num_feat], errors='coerce').fillna(0.0)