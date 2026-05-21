"""Подготовка признаков для моделей."""
from typing import Dict, Any, List
import pandas as pd
import numpy as np
from ml_service.utils.helpers import get_default_value
from ml_service.features.importance import get_input_top_features  # ← ИЗМЕНИЛИ ИМПОРТ


# Список признаков-таргетов
TARGET_FEATURES = {
    '30-дневная', '1-годичная_x', '1-годичная_y',
    'Энцефалопатия', 'Диализ / ЗПТ', 'Рестернотомия',
    'Ревизия гемостаза', 'Медиастинит / ДГНР', 'Пневмония (инф.)',
    'Пневмония / ДН', 'ОРДС', 'Плеврит / гидроторакс',
}


def prepare_features(package: Dict, features_dict: Dict[str, Any]) -> pd.DataFrame:
    """Подготовка признаков для инференса."""
    all_features = package['feature_names']
    framework = package.get('framework', 'unknown')
    categorical_features = package.get('categorical_features', [])
    
    # ФИЛЬТРАЦИЯ: убираем таргеты и дубликаты
    cleaned_features = _clean_input_features(features_dict)
    
    # НОРМАЛИЗАЦИЯ ВХОДНЫХ ДАННЫХ
    normalized = _normalize_input_keys(cleaned_features, all_features)
    
    # Получаем топ-10 ТОЛЬКО входных признаков (без таргетов и дубликатов)
    top_features = get_input_top_features(package, top_n=10)
    
    # Создаем дефолтные значения для ВСЕХ признаков
    full_features = {
        feature: get_default_value(feature) 
        for feature in all_features
    }
    
    # Заполняем признаками, которые пришли
    for key, value in normalized.items():
        if key in all_features:
            full_features[key] = value
    
    # Проверяем наличие всех топ-10 признаков
    missing = [f for f in top_features if f not in normalized]
    if missing:
        raise ValueError(f"Missing required features: {missing}")
    
    # Создаем DataFrame
    df = pd.DataFrame([full_features])
    
    # Обработка категориальных признаков
    _process_categorical_features(df, categorical_features, framework)
    
    # Обработка числовых признаков
    numeric_features = [f for f in all_features if f not in categorical_features]
    _process_numeric_features(df, numeric_features)
    
    # Возвращаем с правильным порядком колонок
    return df[all_features]


def _clean_input_features(features: Dict[str, Any]) -> Dict[str, Any]:
    """Очищает входные признаки: убирает таргеты и дубликаты."""
    cleaned = {}
    
    for key, value in features.items():
        # Пропускаем таргеты
        if key in TARGET_FEATURES:
            continue
        if '1-годичная' in key or '30-дневная' in key:
            continue
        
        # Пропускаем категориальные дубликаты
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
    """
    Нормализует ключи входного словаря, находя соответствия даже при разных именах.
    Например: "pump (0/1)" -> "pump", "Пол" -> "Пол"
    """
    normalized = {}
    
    for key, value in input_dict.items():
        # Прямое совпадение
        if key in expected_features:
            normalized[key] = value
            continue
        
        # Ищем частичное совпадение (игнорируем скобки, пробелы, подчеркивания)
        key_clean = _clean_key(key)
        
        found = False
        for expected in expected_features:
            expected_clean = _clean_key(expected)
            
            # Точное совпадение чистых ключей
            if key_clean == expected_clean:
                normalized[expected] = value
                found = True
                break
            
            # Один ключ содержит другой
            if key_clean in expected_clean or expected_clean in key_clean:
                normalized[expected] = value
                found = True
                break
        
        # Если не нашли, добавляем как есть
        if not found:
            normalized[key] = value
    
    return normalized


def _clean_key(key: str) -> str:
    """Очищает ключ для сравнения: нижний регистр, без пробелов и скобок."""
    return key.lower().replace(' ', '').replace('(', '').replace(')', '').replace('_', '').replace('/', '')


def _process_categorical_features(df: pd.DataFrame, categorical_features: list, framework: str):
    """Обрабатывает категориальные признаки."""
    for cat_feat in categorical_features:
        if cat_feat in df.columns:
            if framework == 'catboost':
                df[cat_feat] = df[cat_feat].astype(str)
            else:
                df[cat_feat] = pd.Categorical(df[cat_feat]).codes


def _process_numeric_features(df: pd.DataFrame, numeric_features: list):
    """Обрабатывает числовые признаки."""
    for num_feat in numeric_features:
        if num_feat in df.columns:
            df[num_feat] = pd.to_numeric(df[num_feat], errors='coerce').fillna(0)