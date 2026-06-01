"""Вспомогательные утилиты для нормализации данных и скоринга."""
from typing import List, Dict, Any
from ml_service.config import config

def get_risk_level_from_score(score_percent: float) -> str:
    """Определяет уровень риска по проценту скора [0.0, 100.0]."""
    if score_percent > config.RISK_THRESHOLDS["danger"]:
        return "danger"
    elif score_percent > config.RISK_THRESHOLDS["medium"]:
        return "medium"
    return "low"


def get_model_type(package: dict) -> str:
    """Определяет человекочитаемый тип архитектуры модели."""
    if package.get('is_ensemble'):
        models_ik = package.get('models_ik', {})
        sample_model = list(models_ik.values())[0] if models_ik else None
        return f"Ensemble ({type(sample_model).__name__})" if sample_model else "Ensemble"
    return type(package.get('model')).__name__ if package.get('model') else "unknown"


def normalize_feature_keys(features: dict, expected_features: List[str]) -> dict:
    """
    Нормализует ключи словаря признаков для соответствия ожидаемым моделью.
    Пример: "pump (0/1)" -> "pump", "Пол" -> "Пол"
    """
    normalized = {}
    
    for key, value in features.items():
        if key in expected_features:
            normalized[key] = value
            continue
        
        key_clean = key.lower().replace(' ', '').replace('(', '').replace(')', '').replace('_', '').replace('/', '')
        found = False
        
        for expected in expected_features:
            expected_clean = expected.lower().replace(' ', '').replace('(', '').replace(')', '').replace('_', '').replace('/', '')
            
            if key_clean == expected_clean or key_clean in expected_clean or expected_clean in key_clean:
                normalized[expected] = value
                found = True
                break
        
        if not found:
            normalized[key] = value
            
    return normalized


def get_default_value(feature_name: str) -> Any:
    """Возвращает безопасное дефолтное значение для клинического признака."""
    defaults = {
        'pump': 1,
        'Возраст (лет)': 60, 'Рост (м)': 1.70, 'Вес (кг)': 75,
        'ИМТ (кг/м²)': 25.0, 'ППТ (м²)': 1.8, 'ОЦК (л)': 5.0,
        'АД сист. исх. (мм рт.ст.)': 120, 'ЦВД исх. (мм рт.ст.)': 8,
        'SaO2 исх. (%)': 98, 't пищевод. исх. (°C)': 36.6,
        't ректал. исх. (°C)': 36.6, 'Кол-во дефибрилляций': 0,
        'Число вазопрессоров': 0, 'Число ЭДФ (из примечаний)': 0,
        'EuroSCORE II (%)': 0.0, 'Индекс Чарлсона': 0,
        'Число коморбидностей': 0, 'ХБП': 0, 'ХСН ФК': 0,
        'Пол': 'муж', 'Возрастная группа': '60-69',
        'Категория ИМТ': 'Норма', 'Срочность': 'Плановая',
        'Категория ФВ ЛЖ': 'Нормальная (>=50%)', 'ХСН стадия': 'I',
        'Пол (0=жен,1=муж)': 1, 'Срочность (0=план,1=экстр)': 0,
        'Гипертония (0/1)': 0, 'Сахарный диабет (0/1)': 0,
        'ХОБЛ (0/1)': 0, 'ФП в анамнезе (0/1)': 0,
        'ИМ в анамнезе (0/1)': 0, 'Лёгочная гипертензия (0/1)': 0,
    }
    
    if feature_name in defaults:
        return defaults[feature_name]
    
    clean_name = feature_name.lower().replace(' ', '').replace('(', '').replace(')', '')
    for key, val in defaults.items():
        clean_key = key.lower().replace(' ', '').replace('(', '').replace(')', '')
        if clean_name == clean_key or clean_key in clean_name:
            return val
            
    if '(0/1)' in feature_name:
        return 0
    return 0