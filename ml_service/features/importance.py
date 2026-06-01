"""Универсальный расчет важности признаков для одиночных моделей и ансамблей."""
from typing import Dict, Tuple
import numpy as np
import pandas as pd
from ml_service.models.loader import detect_framework
from ml_service.constants import TARGET_FEATURES, REDUNDANT_FEATURES

def get_feature_importance(package: Dict) -> Tuple[np.ndarray, np.ndarray]:
    """Универсальное получение важности признаков (Legacy + Ensemble)."""
    feature_names = package['feature_names']
    
    # Определяем, откуда брать модель для эталонной важности
    if package.get('is_ensemble'):
        models_ik = package.get('models_ik', {})
        # Берем летальность как главную, иначе первую попавшуюся
        model = models_ik.get('Послеоп. летальность') or list(models_ik.values())[0]
        framework = detect_framework(model)
    else:
        model = package['model']
        framework = package.get('framework', 'unknown')

    try:
        if framework == 'catboost':
            importance = model.get_feature_importance()
        elif framework == 'sklearn':
            if hasattr(model, 'feature_importances_'):
                importance = model.feature_importances_
            elif hasattr(model, 'coef_'):
                importance = np.abs(model.coef_).flatten()
            else:
                importance = np.ones(len(feature_names))
        elif framework in ['xgboost', 'lightgbm']:
            importance = model.feature_importances_
        else:
            importance = np.ones(len(feature_names))
            
        return feature_names, importance
    except Exception as e:
        print(f"⚠️ Could not get feature importance: {e}")
        return feature_names, np.ones(len(feature_names))


def get_top_features(package: Dict, top_n: int = 10) -> list:
    """Возвращает топ-N наиболее важных признаков."""
    feature_names, importance = get_feature_importance(package)
    fi_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importance
    }).sort_values('importance', ascending=False)
    
    return fi_df.head(top_n)['feature'].tolist()


def get_input_top_features(package: Dict, top_n: int = 10) -> list:
    """
    Возвращает топ-N входных признаков.
    Теперь приоритизирует категориальные признаки, если они важны.
    """
    # Получаем абсолютный топ без фильтров
    all_top = get_top_features(package, top_n=20)
    categorical = package.get('categorical_features', [])
    
    input_features = []
    for f in all_top:
        # Если это категориальная фича модели (как 'Пол') — берем её обязательно
        if f in categorical:
            input_features.append(f)
            continue
            
        # Остальное фильтруем от мусора
        if f in TARGET_FEATURES or f in REDUNDANT_FEATURES:
            continue
        if '1-годичная' in f or '30-дневная' in f:
            continue
            
        input_features.append(f)
        
    # Возвращаем уникальные значения, обрезанные до top_n
    result = []
    for f in input_features:
        if f not in result:
            result.append(f)
        if len(result) >= top_n:
            break
            
    return result