from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session, joinedload

from backend.db.models import ClinicalData, Prediction, Operation
from backend.clients.ml_client import ml_client

# Маппинг: фича в ML-модели -> системный эндпоинт калькулятора в calc_service
ML_TO_CALC_MAPPING = {
    "EuroSCORE II (%)": "euroscore",
    "Индекс Чарлсона": "cci",
    "ИМТ": "bmi",
    "ИМТ (кг/м²)": "bmi",
    "Клиренс креатинина": "clcr"
}

CALC_TO_ML_MAPPING = {v: k for k, v in ML_TO_CALC_MAPPING.items()}

# Спецификация клинических блоков для идеального UX/UI формы фронтенда
FIELD_METADATA = {
    # Блок 1: Общая информация / Паспортная часть
    "Возраст (лет)": {"group": "Общая информация", "order": 1, "type": "number", "min": 0, "max": 120, "placeholder": "Пример: 65"},
    "Пол (0=жен,1=муж)": {"group": "Общая информация", "order": 2, "type": "select", "options": [{"value": 0, "label": "Женский"}, {"value": 1, "label": "Мужской"}]},
    "Рост (м)": {"group": "Общая информация", "order": 3, "type": "number", "min": 0.5, "max": 2.5, "step": 0.01, "placeholder": "Пример: 1.75"},
    "Вес (кг)": {"group": "Общая информация", "order": 4, "type": "number", "min": 10, "max": 250, "placeholder": "Пример: 80"},

    # Блок 2: Анамнез / Сопутствующие патологии
    "Гипертония (0/1)": {"group": "Анамнез и коморбидность", "order": 5, "type": "boolean", "label": "Артериальная гипертензия"},
    "Сахарный диабет (0/1)": {"group": "Анамнез и коморбидность", "order": 6, "type": "boolean", "label": "Сахарный диабет"},
    "ХОБЛ (0/1)": {"group": "Анамнез и коморбидность", "order": 7, "type": "boolean", "label": "ХОБЛ (Легочная патология)"},
    "ОНМК в анамнезе (0/1)": {"group": "Анамнез и коморбидность", "order": 8, "type": "boolean", "label": "ОНМК / Инсульт в анамнезе"},
    "Язвенная болезнь ЖКТ (0/1)": {"group": "Анамнез и коморбидность", "order": 9, "type": "boolean", "label": "Язвенная болезнь ЖКТ"},
    "Лёгочная гипертензия (0/1)": {"group": "Анамнез и коморбидность", "order": 10, "type": "boolean", "label": "Легочная гипертензия"},

    # Блок 3: Кардиальный статус и операция
    "pump (0/1)": {"group": "Статус операции и кардиометрия", "order": 11, "type": "boolean", "label": "Искусственное кровообращение (ИК) планируется?"},
    "ФВ ЛЖ до операции (%)": {"group": "Статус операции и кардиометрия", "order": 12, "type": "number", "min": 10, "max": 85, "label": "Фракция выброса ЛЖ (%)"},
    "Категория ФВ ЛЖ": {"group": "Статус операции и кардиометрия", "order": 13, "type": "select", "options": [{"value": 1, "label": "Нормальная (>=50%)"}, {"value": 2, "label": "Умеренно сниженная (30-49%)"}, {"value": 3, "label": "Низкая (<30%)"}]},
    "ХСН ФК": {"group": "Статус операции и кардиометрия", "order": 14, "type": "select", "options": [{"value": 0, "label": "Нет ХСН"}, {"value": 1, "label": "I ФК"}, {"value": 2, "label": "II ФК"}, {"value": 3, "label": "III ФК"}, {"value": 4, "label": "IV ФК"}]},
    "Срочность (0=план,1=экстр)": {"group": "Статус операции и кардиометрия", "order": 15, "type": "select", "options": [{"value": 0, "label": "Плановая"}, {"value": 1, "label": "Экстренная"}]},

    # Блок 4: Лабораторные исследования
    "Креатинин до операции (мкмоль/л)": {"group": "Лабораторные показатели", "order": 16, "type": "number", "placeholder": "Ввод значения..."},
    "Креатинин в ОРИТ (мкмоль/л)": {"group": "Лабораторные показатели", "order": 17, "type": "number", "placeholder": "Ввод значения..."},
    "Hb до операции (г/л)": {"group": "Лабораторные показатели", "order": 18, "type": "number", "label": "Гемоглобин (г/л)"},
    "Ht до операции (%)": {"group": "Лабораторные показатели", "order": 19, "type": "number", "label": "Гематокрит (%)"},
    "Тромбоциты до операции (×10⁹/л)": {"group": "Лабораторные показатели", "order": 20, "type": "number"},
    "Лейкоциты до операции (×10⁹/л)": {"group": "Лабораторные показатели", "order": 21, "type": "number"},
    "K+ до операции (ммоль/л)": {"group": "Лабораторные показатели", "order": 22, "type": "number", "label": "Калий (ммоль/л)"},
    "Фибриноген до операции (г/л)": {"group": "Лабораторные показатели", "order": 23, "type": "number"}
}

DEFAULT_METADATA = {"group": "Дополнительные параметры", "order": 99, "type": "number"}


class PredictionService:
    
    @staticmethod
    async def get_ui_schema(db: Session, version: Optional[str] = None) -> Dict[str, Any]:
        """
        Динамически формирует красивую, упорядоченную по клиническим блокам 
        структуру (схему) полей для отрисовки высококлассного UI.
        """
        # 1. Запрашиваем у ML-сервиса список необходимых фич
        ml_data = await ml_client.get_model_info(version)
        
        # --- ИСПРАВЛЕНИЕ: Безопасное извлечение списка фич без привязки к ключу "info" ---
        if "info" in ml_data and isinstance(ml_data["info"], dict):
            ml_required = ml_data["info"].get("required_features", [])
        else:
            ml_required = ml_data.get("required_features", [])
        # ---------------------------------------------------------------------------------

        # ---- ПРАВКА ДЛЯ PUMP ----
        # Принудительно гарантируем, что флаг pump всегда присутствует в запросах интерфейса,
        # так как он критически важен для проксирования и маршрутизации моделей бэкенда.
        PUMP_FLAG = "pump (0/1)"
        if PUMP_FLAG not in ml_required:
            ml_required.append(PUMP_FLAG)
        # ---------------------------------------------

        # 2. Запрашиваем метаданные у калькулятора шкал
        calc_meta = await ml_client.get_calc_metadata()
        calculators_config = calc_meta.get("calculators", calc_meta) 

        ui_features_set = set()
        required_calc_metrics = []

        # 3. Разбираем комплексные ML-признаки на составляющие инпуты калькулятора
        for feature in ml_required:
            calc_key = ML_TO_CALC_MAPPING.get(feature, feature.lower())
            
            if calc_key in calculators_config:
                required_calc_metrics.append(feature)
                calc_data = calculators_config[calc_key]
                inputs_needed = calc_data.get("inputs", []) if isinstance(calc_data, dict) else []
                
                # Загружаем базовые инпуты, если калькулятор вернул пустые массивы в метаданных
                if not inputs_needed and calc_key == "euroscore":
                    inputs_needed = [
                        "Пол (0=жен,1=муж)", "Возраст (лет)", "Вес (кг)", "Рост (м)", 
                        "Креатинин в ОРИТ (мкмоль/л)", "Категория ФВ ЛЖ", "ХСН ФК", 
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
                ui_features_set.add(feature)

        # 4. Группируем и сортируем поля для создания красивого UX
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

        # Сортируем поля внутри каждой группы согласно клиническому порядку (order)
        for group_name in groups:
            groups[group_name] = sorted(groups[group_name], key=lambda x: x["order"])

        # Превращаем в красивый отсортированный список блоков для фронтенда
        group_order = ["Общая информация", "Анамнез и коморбидность", "Статус операции и кардиометрия", "Лабораторные показатели"]
        ui_blocks = []
        for g_name in group_order:
            if g_name in groups:
                ui_blocks.append({
                    "block_name": g_name,
                    "fields": groups[g_name]
                })
        
        # Добавляем группы, не вошедшие в стандартный список (если появились новые)
        for g_name, g_fields in groups.items():
            if g_name not in group_order:
                ui_blocks.append({
                    "block_name": g_name,
                    "fields": g_fields
                })

        return {
            "available_versions": ml_data.get("available_versions", []),
            "current_version": ml_data.get("current_version", ml_data.get("version", "")),
            "ui_schema": {
                "form_blocks": ui_blocks,
                "calculated_metrics_needed": required_calc_metrics
            }
        }

    @staticmethod
    async def perform_pure_prediction(features: Dict[str, Any], version: str, required_metrics: Optional[List[str]] = None) -> Dict[str, Any]:
        """API-First пайплайн предсказания (Сырые данные -> Calc API -> Мердж -> ML)."""
        calc_results = {}
        if required_metrics:
            calc_endpoints = [ML_TO_CALC_MAPPING.get(m, m.lower()) for m in required_metrics]
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

        full_features = {**features, **calc_results}
        full_features.pop("status", None)

        # Вызов ML сервиса для предсказания
        ml_result = await ml_client.predict(full_features, version)
        ml_result["used_features"] = calc_results
        return ml_result

    @staticmethod
    async def process_ui_prediction(
        db: Session,
        features: Dict[str, Any],
        version: str,
        operation_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Оркестратор UI слоя (с поддержкой сохранения в БД и структуры мультиклассовости)."""
        if operation_id:
            op_exists = db.query(Operation).filter(Operation.id == operation_id).first()
            if not op_exists:
                raise ValueError(f"Operation with ID {operation_id} not found")

        schema_data = await PredictionService.get_ui_schema(db, version)
        needed_metrics = schema_data["ui_schema"]["calculated_metrics_needed"]

        # Получаем результат от пайплайна
        ml_result = await PredictionService.perform_pure_prediction(features, version, needed_metrics)

        # Поддержка структуры под мультикласс (закладываем маппинг targets)
        response_data = {
            "risk_score": ml_result.get("risk_score"),
            "risk_level": ml_result.get("risk_level"),
            # Если новая модель уже вернула мультиклассовый массив targets, прокидываем его, иначе инициализируем пустой
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
                cd = ClinicalData(operation_id=operation_id, features=full_saved_features, created_at=datetime.utcnow())
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

    @staticmethod
    def get_predictions_list(db: Session, patient_id: Optional[int], skip: int, limit: int):
        query = db.query(Prediction).options(
            joinedload(Prediction.operation).joinedload(Operation.patient),
            joinedload(Prediction.operation).joinedload(Operation.clinical_data),
        )
        if patient_id:
            query = query.join(Operation).filter(Operation.patient_id == patient_id)
        predictions = query.order_by(Prediction.created_at.desc()).offset(skip).limit(limit).all()
        return [PredictionService._format_prediction(p) for p in predictions]

    @staticmethod
    def _format_prediction(pred: Prediction) -> Dict[str, Any]:
        features = {}
        if pred.operation and pred.operation.clinical_data:
            for cd in pred.operation.clinical_data:
                if cd.features: features.update(cd.features)
        return {
            "id": pred.id,
            "risk_score": pred.risk_score,
            "risk_level": pred.risk_level,
            "created_at": pred.created_at,
            "model_version": pred.model_version,
            "operation": {"type": pred.operation.type, "date": pred.operation.date} if pred.operation else None,
            "patient": {
                "id": pred.operation.patient.id,
                "sex": pred.operation.patient.sex,
                "birth_date": pred.operation.patient.birth_date
            } if pred.operation and pred.operation.patient else None,
            "features": features,
        }
        
    @staticmethod
    async def get_ui_demo_data(db: Session, version: str) -> Dict[str, Any]:
        """
        Запрашивает сырые демо-данные у ML-сервиса и фильтрует их 
        строго по полям, которые запросил фронтенд в ui_schema.
        Это убивает проблему дублирования полей (например "Пол" и "Пол (0=жен,1=муж)").
        """
        # 1. Получаем сырую свалку демо-данных от ML
        raw_demo_data = await ml_client.get_demo_data(version)
        
        # 2. Получаем актуальную структуру UI для этой версии модели
        schema_data = await PredictionService.get_ui_schema(db, version)
        
        # 3. Собираем плоский набор ID полей, которые реально отрендерит фронтенд
        allowed_ui_fields = set()
        for block in schema_data["ui_schema"]["form_blocks"]:
            for field in block["fields"]:
                allowed_ui_fields.add(field["id"])
                
        # 4. Фильтруем демо-данные: оставляем только то, что знает интерфейс
        filtered_demo = {}
        for key, value in raw_demo_data.items():
            if key in allowed_ui_fields:
                filtered_demo[key] = value
                
        # Плюс гарантия наличия системных флагов
        if "pump (0/1)" in allowed_ui_fields and "pump (0/1)" not in filtered_demo:
            filtered_demo["pump (0/1)"] = 1
                
        return filtered_demo