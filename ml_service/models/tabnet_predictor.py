"""
Инференс ИСКЛЮЧИТЕЛЬНО для TabNet-ансамблей.

⚠️  ИЗОЛЯЦИЯ:
    Этот модуль вызывается ТОЛЬКО из predictor.py при framework=='tabnet'.
    LabelEncoder и StandardScaler из этого пакета НЕ применяются нигде else.
    CPU-патч применён в loader.py при загрузке.
"""

from typing import Any, Dict
import numpy as np

from ml_service.features.tabnet_preparation import prepare_features_tabnet
from ml_service.utils.helpers import get_risk_level_from_score


def predict_tabnet(package: dict, features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет инференс TabNet-ансамбля.

    Маршрутизация: ИК (models_ik) / без ИК (models_offpump).
    Все TabNet-специфичные шаги изолированы в tabnet_preparation.py.

    Returns:
        dict со структурой идентичной predict_ensemble для совместимости API.
    """
    # ── Определяем статус ИК ────────────────────────────────────────────────
    is_on_pump = _determine_pump_status_tabnet(features)

    # ── Подготовка признаков (ИЗОЛИРОВАНО для TabNet) ─────────────────────────
    # prepare_features_tabnet применяет LabelEncoder + StandardScaler из пакета
    X = prepare_features_tabnet(package, features, is_on_pump=is_on_pump)

    # ── Выбор группы моделей ─────────────────────────────────────────────────
    group_key = 'models_ik' if is_on_pump else 'models_offpump'
    models_dict: dict = package.get(group_key, {})

    if not models_dict:
        # Fallback на другую группу
        fallback_key = 'models_offpump' if is_on_pump else 'models_ik'
        models_dict = package.get(fallback_key, {})
        print(
            f"  ⚠️ [TabNet] '{group_key}' empty, "
            f"falling back to '{fallback_key}'"
        )

    if not models_dict:
        raise ValueError("[TabNet] No models found in package (neither models_ik nor models_offpump)")

    # ── Инференс по всем таргетам ────────────────────────────────────────────
    targets_outputs = []
    max_prob = 0.0

    for target_name, model in models_dict.items():
        prob = _tabnet_predict_proba(model, X, target_name)
        score_percent = round(prob * 100, 2)

        targets_outputs.append({
            "name": target_name,
            "score": score_percent,
            "level": get_risk_level_from_score(score_percent),
        })

        max_prob = max(max_prob, prob)

    final_score = round(max_prob * 100, 2)

    return {
        "risk_score": final_score,
        "risk_level": get_risk_level_from_score(final_score),
        "targets": targets_outputs,
        "version": package.get("version", "v5"),
        "framework": "tabnet",
        "operation_type": "on_pump" if is_on_pump else "off_pump",
    }


def _tabnet_predict_proba(model, X: np.ndarray, target_name: str) -> float:
    """
    Вызов predict_proba у TabNet-модели с обработкой ошибок.

    TabNet возвращает (predictions, masks) при некоторых конфигурациях,
    или просто ndarray. Обрабатываем оба случая.
    """
    import torch

    try:
        # Гарантируем CPU-контекст при инференсе
        with torch.no_grad():
            result = model.predict_proba(X)

        # result может быть ndarray или tuple
        if isinstance(result, tuple):
            proba_array = result[0]
        else:
            proba_array = result

        # Вероятность класса 1 (осложнение есть)
        prob = float(proba_array[0][1])
        return np.clip(prob, 0.0, 1.0)

    except Exception as e:
        print(f"  ❌ [TabNet] predict_proba error for '{target_name}': {e}")
        return 0.0


def _determine_pump_status_tabnet(features: Dict[str, Any]) -> int:
    """
    Извлекает статус ИК из словаря признаков для TabNet.

    TabNet-специфичная версия без df-зависимости.
    """
    for key, value in features.items():
        if 'pump' in key.lower():
            try:
                return int(float(value))
            except (ValueError, TypeError):
                continue

    # Дефолт: операция с ИК (консервативный сценарий)
    return 1