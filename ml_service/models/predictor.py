import pandas as pd
import numpy as np
from typing import Dict, Any

import pandas as pd
import numpy as np
from typing import Dict, Any

def predict(package: dict, features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет предсказание на базе переданного пакета модели (одиночной или ансамбля).
    Защищено от несовпадения регистра и суффиксов в именах фич.
    """
    feature_names = package.get("feature_names", [])
    is_ensemble = package.get("is_ensemble", False)
    categorical_features = package.get("categorical_features", [])
    framework = package.get("framework", "catboost")
    
    # Строим нормализованный словарь входных данных (переводим ключи в нижний регистр для гибкого поиска)
    normalized_inputs = {str(k).lower().strip(): v for k, v in features.items()}
    
    # Формируем строго упорядоченный вектор признаков для модели
    ready_features = {}
    for expected_name in feature_names:
        clean_expected = str(expected_name).lower().strip()
        
        # Ищем точное или частичное совпадение фичи
        matched_val = None
        if clean_expected in normalized_inputs:
            matched_val = normalized_inputs[clean_expected]
        else:
            # Поиск по частичному вхождению (например "pump" в "pump (0/1)")
            for input_key, input_val in normalized_inputs.items():
                if input_key in clean_expected or clean_expected in input_key:
                    matched_val = input_val
                    break
        
        # Если фича не найдена, подставляем безопасный ноль
        if matched_val is None:
            # Проверяем, является ли признак категориальным
            is_categorical = any(
                expected_name.lower() in cat.lower() or cat.lower() in expected_name.lower() 
                for cat in categorical_features
            )
            if is_categorical:
                ready_features[expected_name] = "0" if framework == "catboost" else 0
            else:
                ready_features[expected_name] = 0.0
        else:
            # 🔑 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: проверяем, является ли признак категориальным
            is_categorical = any(
                expected_name.lower() in cat.lower() or cat.lower() in expected_name.lower() 
                for cat in categorical_features
            )
            
            # Если категориальный признак для CatBoost - преобразуем в строку
            if is_categorical and framework == "catboost":
                if isinstance(matched_val, str):
                    ready_features[expected_name] = matched_val
                elif isinstance(matched_val, (int, float)):
                    # Убираем .0 для CatBoost
                    if matched_val == int(matched_val):
                        ready_features[expected_name] = str(int(matched_val))
                    else:
                        ready_features[expected_name] = str(matched_val)
                else:
                    ready_features[expected_name] = str(matched_val)
            # Если категориальный для sklearn - оставляем как int
            elif is_categorical:
                if isinstance(matched_val, str):
                    ready_features[expected_name] = matched_val
                else:
                    ready_features[expected_name] = int(float(matched_val))
            # Если числовой признак
            else:
                if isinstance(matched_val, str):
                    try:
                        ready_features[expected_name] = float(matched_val)
                    except:
                        ready_features[expected_name] = 0.0
                else:
                    try:
                        ready_features[expected_name] = float(matched_val)
                    except:
                        ready_features[expected_name] = 0.0

    # Создаем DataFrame (модели CatBoost/Scikit-Learn требуют строгого порядка колонок)
    df = pd.DataFrame([ready_features], columns=feature_names)
    
    # 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: убеждаемся, что категориальные признаки - строки для CatBoost
    if framework == "catboost":
        for cat_feat in categorical_features:
            for col in df.columns:
                if cat_feat.lower() in col.lower() or col.lower() in cat_feat.lower():
                    # Преобразуем в строку, убирая .0
                    df[col] = df[col].apply(
                        lambda x: str(int(float(x))) if not isinstance(x, str) and pd.notna(x) 
                        else str(x) if isinstance(x, str) and x != '' 
                        else '0'
                    )

    # Выполнение предсказания
    if is_ensemble:
        # Логика для ансамбля (маршрутизация по флагу ИК / pump)
        # 🔧 ФИКС: ищем pump в ready_features
        pump_value = None
        for key, value in ready_features.items():
            if 'pump' in key.lower():
                pump_value = value
                break
        
        # Если pump не найден, ищем в исходных features
        if pump_value is None:
            for key, value in features.items():
                if 'pump' in key.lower():
                    pump_value = value
                    break
        
        # Преобразуем pump в int для проверки
        if pump_value is not None:
            try:
                is_on_pump = int(float(pump_value))
            except:
                is_on_pump = 1  # По умолчанию - ИК (более консервативный прогноз)
        else:
            is_on_pump = 1
        
        if is_on_pump == 1:
            models_dict = package.get("models_ik", {})
        else:
            models_dict = package.get("models_offpump", {})
        
        # Если соответствующий словарь моделей пуст, используем другой
        if not models_dict:
            models_dict = package.get("models_ik", package.get("models_offpump", {}))
            
        # Если это мультиклассовый ансамбль, собираем вероятности по таргет-задачам
        targets_outputs = []
        main_score = 0.0
        
        all_probs = []
        for target_name, model in models_dict.items():
            prob = float(model.predict_proba(df)[0][1])
            level = "low"
            if prob > 0.5: level = "danger"
            elif prob > 0.2: level = "medium"
            
            targets_outputs.append({
                "name": target_name,
                "score": round(prob * 100, 2),
                "level": level
            })
            all_probs.append(prob)
            # За основной скор берем первый таргет
            main_score = max(all_probs) if all_probs else 0

        # Расчет итогового уровня риска
        final_score = round(main_score * 100, 2)
        final_level = "low"
        if final_score > 15.0: final_level = "danger"
        elif final_score > 5.0: final_level = "medium"

        return {
            "risk_score": final_score,
            "risk_level": final_level,
            "targets": targets_outputs,
            "version": package.get("version", "v4")
        }
    else:
        # Старая логика одиночной модели
        model = package["model"]
        raw_pred = model.predict_proba(df)[0][1]
        
        score = round(float(raw_pred) * 100, 2)
        level = "low"
        if score > 15.0: level = "danger"
        elif score > 5.0: level = "medium"
        
        return {
            "risk_score": score,
            "risk_level": level,
            "version": package.get("version", "v1")
        }
        
        
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
