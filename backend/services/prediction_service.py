import hashlib
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session, joinedload

from backend.db.models import ClinicalData, Prediction, Operation
from backend.clients.ml_client import ml_client
from backend.core.metadata import (
    ML_TO_CALC_MAPPING, CALC_TO_ML_MAPPING,
    INTRAOP_FIELDS, REDUNDANT_FIELDS, PUMP_FLAG,
    FIELD_METADATA, DEFAULT_METADATA, GROUP_ORDER
)
from backend.core.config import CACHE_TTL_UI_SCHEMA, CACHE_TTL_PREDICTION
from backend.services.cache_service import cache


class PredictionService:
    """Оркестратор предиктов с кэшированием UI-схемы и результатов."""

    
    #  UI SCHEMA
    

    @staticmethod
    async def get_ui_schema(db: Session, version: Optional[str] = None) -> Dict[str, Any]:
        """
        Динамически формирует схему полей для фронтенда.
        Результат кэшируется, т.к. модель и калькулятор меняются редко.
        """
        # --- Проверка кэша ---
        cache_key_data = {"version": version or "latest"}
        cache_key = cache._make_key("ui_schema", cache_key_data)
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        # --- Запрос к ML ---
        ml_data = await ml_client.get_model_info(version)

        if "info" in ml_data and isinstance(ml_data["info"], dict):
            ml_required = ml_data["info"].get("required_features", [])
        else:
            ml_required = ml_data.get("required_features", [])

        # Гарантируем наличие pump
        if PUMP_FLAG not in ml_required:
            ml_required.append(PUMP_FLAG)

        # --- Запрос к калькулятору ---
        calc_meta = await ml_client.get_calc_metadata()
        calculators_config = calc_meta.get("calculators", calc_meta)

        ui_features_set = set()
        required_calc_metrics = []

        # --- Разбор ML-фич на UI-поля ---
        for feature in ml_required:
            calc_key = ML_TO_CALC_MAPPING.get(feature, feature.lower())

            if calc_key in calculators_config:
                required_calc_metrics.append(feature)
                calc_data = calculators_config[calc_key]
                inputs_needed = calc_data.get("inputs", []) if isinstance(calc_data, dict) else []

                # Заполняем базовые инпуты, если калькулятор вернул пустые массивы
                if not inputs_needed and calc_key == "euroscore":
                    inputs_needed = [
                        "Пол (0=жен,1=муж)", "Возраст (лет)", "Вес (кг)", "Рост (м)",
                        "Креатинин в ОРИТ (мкмоль/л)", "Категория ФВ ЛЖ", "ХСН стадия",
                        "Лёгочная гипертензия (0/1)", "Гипертония (0/1)", "Срочность (0=план,1=экстр)"
                    ]
                elif not inputs_needed and calc_key == "cci":
                    inputs_needed = [
                        "Возраст (лет)", "Сахарный диабет (0/1)", "ХОБЛ (0/1)",
                        "ОНМК в анамнезе (0/1)", "Язвенная болезнь ЖКТ (0/1)"
                    ]

                for inp in inputs_needed:
                    ui_features_set.add(inp)
            else:
                if feature not in INTRAOP_FIELDS and feature not in REDUNDANT_FIELDS:
                    ui_features_set.add(feature)

        # --- Группировка полей ---
        groups: Dict[str, List[Dict[str, Any]]] = {}

        for field_name in ui_features_set:
            meta = FIELD_METADATA.get(field_name, DEFAULT_METADATA.copy())
            group_name = meta["group"]

            field_structure = {
                "id": field_name,
                "label": meta.get("label", field_name),
                "type": meta["type"],
                "order": meta["order"],
                "min": meta.get("min"),
                "max": meta.get("max"),
                "step": meta.get("step"),
                "placeholder": meta.get("placeholder", ""),
                "options": meta.get("options", [])
            }

            if group_name not in groups:
                groups[group_name] = []
            groups[group_name].append(field_structure)

        # --- Сортировка ---
        for group_name in groups:
            groups[group_name] = sorted(groups[group_name], key=lambda x: x["order"])

        ui_blocks = []
        for g_name in GROUP_ORDER:
            if g_name in groups:
                ui_blocks.append({"block_name": g_name, "fields": groups[g_name]})

        for g_name, g_fields in groups.items():
            if g_name not in GROUP_ORDER:
                ui_blocks.append({"block_name": g_name, "fields": g_fields})

        result = {
            "available_versions": ml_data.get("available_versions", []),
            "current_version": ml_data.get("current_version", ml_data.get("version", "")),
            "ui_schema": {
                "form_blocks": ui_blocks,
                "calculated_metrics_needed": required_calc_metrics
            }
        }

        # --- Сохранение в кэш ---
        cache.set(cache_key, result, ttl_seconds=CACHE_TTL_UI_SCHEMA)
        return result

    
    #  DEMO DATA
    

    @staticmethod
    async def get_ui_demo_data(db: Session, version: str) -> Dict[str, Any]:
        """
        Запрашивает сырые демо-данные у ML-сервиса и фильтрует их
        строго по полям, которые запросил фронтенд в ui_schema.
        """
        raw_demo_data = await ml_client.get_demo_data(version)
        schema_data = await PredictionService.get_ui_schema(db, version)

        allowed_ui_fields = set()
        for block in schema_data["ui_schema"]["form_blocks"]:
            for field in block["fields"]:
                allowed_ui_fields.add(field["id"])

        filtered_demo = {}
        for key, value in raw_demo_data.items():
            if key in allowed_ui_fields:
                filtered_demo[key] = value

        if PUMP_FLAG in allowed_ui_fields and PUMP_FLAG not in filtered_demo:
            filtered_demo[PUMP_FLAG] = 1

        return filtered_demo

    
    #  PURE PREDICTION
    

    @staticmethod
    async def perform_pure_prediction(
        features: Dict[str, Any],
        version: str,
        required_metrics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        API-First пайплайн: Сырые данные → Calc API → Мердж → ML.
        Результат кэшируется для одинаковых входных данных.
        """
        # --- Проверка кэша ---
        cache_key_data = {
            "features": features,
            "version": version,
            "metrics": required_metrics or []
        }
        cache_key = cache._make_key("prediction", cache_key_data)
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        # --- Расчёт метрик через калькулятор ---
        calc_results = {}

        if required_metrics:
            calc_endpoints = [
                ML_TO_CALC_MAPPING.get(m, m.lower()) for m in required_metrics
            ]
            raw_calc_outputs = await ml_client.calculate_pure_metrics(calc_endpoints, features)

            for key, value in raw_calc_outputs.items():
                matched_ml_key = None
                for calc_name, ml_name in CALC_TO_ML_MAPPING.items():
                    if calc_name in key:
                        matched_ml_key = ml_name
                        break
                if matched_ml_key:
                    calc_results[matched_ml_key] = value
                else:
                    calc_results[key] = value
        else:
            calc_results = await ml_client.calculate_batch(features)

        # --- Мердж фич и вызов ML ---
        full_features = {**features, **calc_results}
        full_features.pop("status", None)

        ml_result = await ml_client.predict(full_features, version)
        ml_result["used_features"] = calc_results

        # --- Сохранение в кэш ---
        cache.set(cache_key, ml_result, ttl_seconds=CACHE_TTL_PREDICTION)
        return ml_result

    
    #  UI PREDICTION (с сохранением в БД)
    

    @staticmethod
    async def process_ui_prediction(
        db: Session,
        features: Dict[str, Any],
        version: str,
        operation_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Оркестратор UI слоя с поддержкой сохранения в БД и мультиклассовости."""
        if operation_id:
            op_exists = db.query(Operation).filter(Operation.id == operation_id).first()
            if not op_exists:
                raise ValueError(f"Operation with ID {operation_id} not found")

        schema_data = await PredictionService.get_ui_schema(db, version)
        needed_metrics = schema_data["ui_schema"]["calculated_metrics_needed"]

        ml_result = await PredictionService.perform_pure_prediction(
            features, version, needed_metrics
        )

        response_data = {
            "risk_score": ml_result.get("risk_score"),
            "risk_level": ml_result.get("risk_level"),
            "targets": ml_result.get("targets", [
                {
                    "name": "Общая летальность",
                    "score": ml_result.get("risk_score"),
                    "level": ml_result.get("risk_level")
                }
            ]),
            "model_version": ml_result.get("version", version),
            "saved": False
        }

        if operation_id:
            try:
                full_saved_features = {**features, **ml_result.get("used_features", {})}
                cd = ClinicalData(
                    operation_id=operation_id,
                    features=full_saved_features,
                    created_at=datetime.utcnow()
                )
                db.add(cd)

                prediction = Prediction(
                    operation_id=operation_id,
                    risk_score=response_data["risk_score"],
                    risk_level=response_data["risk_level"],
                    model_version=response_data["model_version"],
                    created_at=datetime.utcnow()
                )
                db.add(prediction)
                db.commit()
                db.refresh(prediction)

                response_data["id"] = prediction.id
                response_data["created_at"] = prediction.created_at.isoformat()
                response_data["saved"] = True

                return response_data
            except Exception as e:
                db.rollback()
                raise e

        return response_data

    
    #  HISTORY & FORMATTING
    

    @staticmethod
    def get_predictions_list(
        db: Session, patient_id: Optional[int], skip: int, limit: int
    ):
        query = db.query(Prediction).options(
            joinedload(Prediction.operation).joinedload(Operation.patient),
            joinedload(Prediction.operation).joinedload(Operation.clinical_data),
        )
        if patient_id:
            query = query.join(Operation).filter(Operation.patient_id == patient_id)

        predictions = (
            query.order_by(Prediction.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [PredictionService._format_prediction(p) for p in predictions]

    @staticmethod
    def _format_prediction(pred: Prediction) -> Dict[str, Any]:
        features = {}
        if pred.operation and pred.operation.clinical_data:
            for cd in pred.operation.clinical_data:
                if cd.features:
                    features.update(cd.features)

        return {
            "id": pred.id,
            "risk_score": pred.risk_score,
            "risk_level": pred.risk_level,
            "created_at": pred.created_at,
            "model_version": pred.model_version,
            "operation": (
                {"type": pred.operation.type, "date": pred.operation.date}
                if pred.operation else None
            ),
            "patient": (
                {
                    "id": pred.operation.patient.id,
                    "sex": pred.operation.patient.sex,
                    "birth_date": pred.operation.patient.birth_date
                }
                if pred.operation and pred.operation.patient else None
            ),
            "features": features,
        }