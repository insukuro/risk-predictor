from typing import Dict, Tuple
import numpy as np
import pandas as pd
from ml_service.models.loader import detect_framework

# Таргеты, которые не должны быть в топе входных признаков
TARGET_FEATURES = {
    '30-дневная', '1-годичная_x', '1-годичная_y',
    'Энцефалопатия', 'Диализ / ЗПТ', 'Рестернотомия',
    'Ревизия гемостаза', 'Медиастинит / ДГНР', 'Пневмония (инф.)',
    'Пневмония / ДН', 'ОРДС', 'Плеврит / гидроторакс',
    # Добавьте другие если есть
}

# Дубликаты - категориальные версии, которые не нужны если есть числовые
REDUNDANT_FEATURES = {
    'Пол',              # дубликат "Пол (0=жен,1=муж)"
    'Срочность',         # дубликат "Срочность (0=план,1=экстр)"
    'Возрастная группа', # вычисляется из "Возраст (лет)"
    'Категория ИМТ',     # вычисляется из "ИМТ (кг/м²)"
}


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
    Возвращает топ-N входных признаков (без таргетов и дубликатов).
    Используется для UI - показывает, какие данные нужны от пользователя.
    """
    all_top = get_top_features(package, top_n=50)  # Берем больше, чтобы хватило после фильтрации
    
    # Фильтруем: убираем таргеты и дубликаты
    input_features = []
    for f in all_top:
        # Пропускаем таргеты
        if f in TARGET_FEATURES:
            continue
        # Пропускаем дубликаты
        if f in REDUNDANT_FEATURES:
            continue
        # Пропускаем "1-годичная..." и "30-дневная" на всякий случай
        if '1-годичная' in f or '30-дневная' in f:
            continue
        
        input_features.append(f)
        
        if len(input_features) >= top_n:
            break
    
    return input_features