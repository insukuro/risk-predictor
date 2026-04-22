"""Подготовка признаков для моделей."""
from typing import Dict, Any
import pandas as pd
import numpy as np
from utils.helpers import get_default_value
from features.importance import get_top_features

def prepare_features(package: Dict, features_dict: Dict[str, Any]) -> pd.DataFrame:
    """Подготовка признаков для инференса."""
    all_features = package['feature_names']
    framework = package.get('framework', 'unknown')
    categorical_features = package.get('categorical_features', [])
    
    # Получаем топ-10 признаков по важности
    top_features = get_top_features(package, top_n=10)
    
    # Создаем дефолтные значения для НЕ топ-10 признаков
    default_values = {
        feature: get_default_value(feature) 
        for feature in all_features 
        if feature not in top_features
    }
    
    # Заполняем признаки
    full_features = default_values.copy()
    for key, value in features_dict.items():
        if key in top_features:
            full_features[key] = value
    
    # Проверяем наличие всех топ-10 признаков
    missing = [f for f in top_features if f not in features_dict]
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
