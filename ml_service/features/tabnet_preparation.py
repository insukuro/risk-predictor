"""
Подготовка признаков ИСКЛЮЧИТЕЛЬНО для TabNet-моделей.

⚠️  ИЗОЛЯЦИЯ:
    Этот модуль вызывается ТОЛЬКО из tabnet_predictor.py.
    Он НЕ должен импортироваться в preparation.py или predictor.py.

Особенности TabNet:
    1. Использует sklearn LabelEncoder для категориальных признаков.
       Encoder обучен на конкретных значениях — нельзя применять к другим моделям.
    2. Использует StandardScaler для числовых признаков.
       Scaler обучен на другом распределении — нельзя применять к другим моделям.
    3. 'Пол' — полноценный категориальный признак (не числовой дубликат).
    4. Обучен на GPU, инференс патчится на CPU в loader.py.
    5. Входной тензор — float32 numpy array, размерность [1, 48].
"""

from typing import Any, Dict, Optional
import warnings
import numpy as np
import pandas as pd

from ml_service.constants import (
    TABNET_GENDER_DEFAULT,
    TABNET_GENDER_VALID_VALUES,
    TABNET_GENDER_NUMERIC_TO_STR,
    TARGET_FEATURES,
)
from ml_service.utils.helpers import get_default_value


# ── Дефолтные значения специфичные для TabNet ────────────────────────────────
_TABNET_DEFAULTS: Dict[str, Any] = {
    'Пол': TABNET_GENDER_DEFAULT,           # категориальный — строка
    'Пол (0=жен,1=муж)': 1,                 # числовой — int
    'Возрастная группа': '60-69',           # категориальный — строка
    'Категория ИМТ': 'Норма',               # категориальный — строка
    'Срочность': 'Плановая',               # категориальный — строка
    'Срочность (0=план,1=экстр)': 0,        # числовой — int
    'Категория ФВ ЛЖ': 'Нормальная (>=50%)', # категориальный — строка
    'ХСН стадия': 'I',                      # категориальный — строка
    'ХСН ФК': 0,
    'Возраст (лет)': 60,
    'Рост (м)': 1.70,
    'Вес (кг)': 75,
    'ИМТ (кг/м²)': 25.0,
    'ППТ (м²)': 1.8,
    'ОЦК (л)': 5.0,
    'EuroSCORE II (%)': 0.0,
    'Индекс Чарлсона': 0,
    'Число коморбидностей': 0,
    'ХБП': 0,
    'АД сист. исх. (мм рт.ст.)': 120,
    'ЦВД исх. (мм рт.ст.)': 8,
    'SaO2 исх. (%)': 98,
    't пищевод. исх. (°C)': 36.6,
    't ректал. исх. (°C)': 36.6,
}


def _resolve_gender_for_tabnet(
    features_dict: Dict[str, Any],
    warn: bool = True,
) -> str:
    """
    Определяет значение 'Пол' для TabNet с защитой от отсутствия.

    Стратегия разрешения (в порядке приоритета):
    1. Прямое значение 'Пол' в запросе (строка вида 'муж'/'жен')
    2. Числовое 'Пол (0=жен,1=муж)' → конвертируем в строку
    3. Дефолт TABNET_GENDER_DEFAULT с предупреждением

    Returns:
        str: одно из значений, известных LabelEncoder ('муж'/'жен'/...)
    """
    # ── Приоритет 1: прямое строковое значение ────────────────────────────
    gender_raw = features_dict.get('Пол')
    if gender_raw is not None:
        gender_str = str(gender_raw).strip().lower()
        if gender_str in TABNET_GENDER_VALID_VALUES:
            return _normalize_gender_string(gender_str)
        # Значение есть, но не распознано — попробуем numeric fallback
        if warn:
            print(
                f"  ⚠️ [TabNet] 'Пол' value '{gender_raw}' not recognized. "
                f"Trying numeric fallback..."
            )

    # ── Приоритет 2: числовой признак 'Пол (0=жен,1=муж)' ───────────────
    gender_numeric = features_dict.get('Пол (0=жен,1=муж)')
    if gender_numeric is not None:
        mapped = TABNET_GENDER_NUMERIC_TO_STR.get(gender_numeric)
        if mapped:
            if warn:
                print(
                    f"  ℹ️ [TabNet] 'Пол' resolved from numeric "
                    f"'Пол (0=жен,1=муж)'={gender_numeric} → '{mapped}'"
                )
            return mapped
        # Попробуем float/int конвертацию
        try:
            numeric_val = int(float(gender_numeric))
            mapped = TABNET_GENDER_NUMERIC_TO_STR.get(numeric_val)
            if mapped:
                return mapped
        except (ValueError, TypeError):
            pass

    # ── Приоритет 3: дефолт ──────────────────────────────────────────────
    if warn:
        warnings.warn(
            f"[TabNet] Признак 'Пол' отсутствует в запросе и не может быть "
            f"определён из 'Пол (0=жен,1=муж)'. "
            f"Используется дефолт: '{TABNET_GENDER_DEFAULT}'. "
            f"Это может повлиять на точность предсказания.",
            UserWarning,
            stacklevel=3,
        )
        print(
            f"  ⚠️ [TabNet] 'Пол' missing — using default='{TABNET_GENDER_DEFAULT}'"
        )

    return TABNET_GENDER_DEFAULT


def _normalize_gender_string(gender_str: str) -> str:
    """Нормализует строковое значение пола к формату, известному LabelEncoder."""
    mapping = {
        'муж': 'муж', 'мужской': 'муж', 'м': 'муж', 'male': 'муж',
        'жен': 'жен', 'женский': 'жен', 'ж': 'жен', 'female': 'жен',
    }
    return mapping.get(gender_str, TABNET_GENDER_DEFAULT)


def _apply_label_encoders(
    df: pd.DataFrame,
    label_encoders: Dict[str, Any],
    categorical_features: list,
) -> pd.DataFrame:
    """
    Применяет LabelEncoder из пакета TabNet к категориальным признакам.

    ⚠️  ИЗОЛЯЦИЯ: label_encoders специфичны для TabNet.
        Нельзя применять к CatBoost/sklearn моделям.

    При встрече неизвестного класса использует безопасный fallback (0),
    вместо падения с ValueError.
    """
    for feat in categorical_features:
        if feat not in df.columns:
            continue

        le = label_encoders.get(feat)
        if le is None:
            # Энкодера нет — кодируем через pandas Categorical как fallback
            df[feat] = pd.Categorical(df[feat]).codes
            continue

        raw_val = df[feat].iloc[0]

        try:
            # Стандартный путь: transform через обученный LabelEncoder
            encoded = le.transform([raw_val])[0]
            df[feat] = int(encoded)

        except ValueError:
            # Неизвестный класс (unseen label)
            known_classes = list(le.classes_)
            print(
                f"  ⚠️ [TabNet LabelEncoder] Unknown value '{raw_val}' "
                f"for '{feat}'. Known: {known_classes}. Using 0."
            )
            df[feat] = 0

        except Exception as e:
            print(f"  ⚠️ [TabNet LabelEncoder] Error encoding '{feat}': {e}. Using 0.")
            df[feat] = 0

    return df


def _apply_scaler(
    df: pd.DataFrame,
    scaler,
    numeric_columns: list,
    scaler_name: str = 'scaler',
) -> pd.DataFrame:
    """
    Применяет StandardScaler из пакета TabNet к числовым признакам.

    ⚠️  ИЗОЛЯЦИЯ: scaler обучен на TabNet-данных.
        Нельзя применять к другим моделям.

    Работает только с колонками, которые ЕСТЬ в df и в scaler.feature_names_in_.
    """
    try:
        # Определяем колонки, которые скейлер реально знает
        if hasattr(scaler, 'feature_names_in_'):
            cols_to_scale = [c for c in numeric_columns if c in df.columns
                             and c in scaler.feature_names_in_]
        else:
            cols_to_scale = [c for c in numeric_columns if c in df.columns]

        if not cols_to_scale:
            return df

        df[cols_to_scale] = scaler.transform(df[cols_to_scale].values.reshape(1, -1))

    except Exception as e:
        print(f"  ⚠️ [TabNet {scaler_name}] Scaling error: {e}. Using raw values.")

    return df


def prepare_features_tabnet(
    package: Dict[str, Any],
    features_dict: Dict[str, Any],
    is_on_pump: int = 1,
) -> np.ndarray:
    """
    Подготавливает входной массив признаков ИСКЛЮЧИТЕЛЬНО для TabNet.

    Полный pipeline:
    1. Разрешение 'Пол' с защитой от отсутствия
    2. Сборка полного словаря с дефолтами
    3. Нормализация ключей входных данных
    4. Применение LabelEncoder (из пакета TabNet)
    5. Применение StandardScaler (из пакета TabNet)
    6. Конвертация в float32 numpy array

    Args:
        package:       пакет модели с encoders, scalers, feature_names
        features_dict: сырой словарь признаков из запроса
        is_on_pump:    1 = с ИК (используется scaler_ik), 0 = без ИК (scaler_offpump)

    Returns:
        np.ndarray shape [1, n_features] dtype=float32
    """
    all_features: list = package['feature_names']
    categorical_features: list = package.get('categorical_features', [])
    numeric_columns: list = package.get('numeric_columns', [])
    label_encoders: dict = package.get('label_encoders', {})

    # Выбираем нужный скейлер в зависимости от типа операции
    scaler = package.get('scaler_ik') if is_on_pump else package.get('scaler_offpump')
    scaler_name = 'scaler_ik' if is_on_pump else 'scaler_offpump'

    # ── Шаг 1: Разрешение 'Пол' ─────────────────────────────────────────────
    resolved_gender = _resolve_gender_for_tabnet(features_dict, warn=True)

    # ── Шаг 2: Базовые дефолты ───────────────────────────────────────────────
    full_features: Dict[str, Any] = {}
    for feat in all_features:
        full_features[feat] = _TABNET_DEFAULTS.get(feat, get_default_value(feat))

    # ── Шаг 3: Нормализация и подстановка входных признаков ──────────────────
    normalized_input = _normalize_input_for_tabnet(features_dict, all_features)

    for key, value in normalized_input.items():
        if key in all_features:
            full_features[key] = value

    # ── Шаг 4: ПРИНУДИТЕЛЬНАЯ установка 'Пол' ────────────────────────────────
    # Перезаписываем ПОСЛЕ нормализации, т.к. _resolve_gender_for_tabnet
    # уже содержит валидированное значение с учетом всех fallback-сценариев.
    full_features['Пол'] = resolved_gender

    # ── Шаг 5: Создаем DataFrame в правильном порядке ─────────────────────────
    df = pd.DataFrame([full_features])[all_features]

    # ── Шаг 6: LabelEncoding (ТОЛЬКО TabNet энкодеры) ─────────────────────────
    df = _apply_label_encoders(df, label_encoders, categorical_features)

    # ── Шаг 7: Числовые признаки → float ─────────────────────────────────────
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

    # ── Шаг 8: StandardScaler (ТОЛЬКО TabNet скейлер) ─────────────────────────
    if scaler is not None:
        df = _apply_scaler(df, scaler, numeric_columns, scaler_name)
    else:
        print(f"  ⚠️ [TabNet] {scaler_name} not found in package. Using raw values.")

    # ── Шаг 9: Конвертация в float32 numpy array ──────────────────────────────
    try:
        result = df[all_features].values.astype(np.float32)
    except Exception as e:
        print(f"  ⚠️ [TabNet] Array conversion error: {e}")
        # Принудительная числовая конвертация
        for col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
        result = df[all_features].values.astype(np.float32)

    return result


def _normalize_input_for_tabnet(
    input_dict: Dict[str, Any],
    expected_features: list,
) -> Dict[str, Any]:
    """
    Нормализация ключей входного словаря для TabNet.

    Отличие от общей normalize_feature_keys:
    - НЕ фильтрует 'Пол' (нужен TabNet)
    - Приоритет точного совпадения
    """
    normalized: Dict[str, Any] = {}

    for key, value in input_dict.items():
        # Пропускаем таргеты
        if key in TARGET_FEATURES:
            continue

        # Точное совпадение
        if key in expected_features:
            normalized[key] = value
            continue

        # Fuzzy matching
        key_clean = (
            key.lower()
            .replace(' ', '').replace('(', '').replace(')', '')
            .replace('_', '').replace('/', '')
        )

        found = False
        for expected in expected_features:
            exp_clean = (
                expected.lower()
                .replace(' ', '').replace('(', '').replace(')', '')
                .replace('_', '').replace('/', '')
            )
            if key_clean == exp_clean:
                normalized[expected] = value
                found = True
                break

        if not found:
            # Мягкое частичное совпадение (осторожно с коллизиями)
            for expected in expected_features:
                exp_clean = (
                    expected.lower()
                    .replace(' ', '').replace('(', '').replace(')', '')
                    .replace('_', '').replace('/', '')
                )
                if key_clean in exp_clean or exp_clean in key_clean:
                    normalized[expected] = value
                    found = True
                    break

        if not found:
            normalized[key] = value  # оставляем как есть

    return normalized