from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session, joinedload

from backend.db.models import ClinicalData, Prediction, Operation, Patient
from backend.clients.ml_client import ml_client

class PredictionService:
    @staticmethod
    async def get_ui_config(db: Session, version: Optional[str] = None):
        """Собирает конфиг для фронтенда: какие поля нужно вводить вручную."""
        ml_data = await ml_client.get_model_info(version)
        calc_features = await ml_client.get_calc_metadata()
        
        all_req = ml_data["info"].get("required_features", [])
        # Оставляем только те, которые не умеет считать калькулятор
        ui_features = [f for f in all_req if f not in calc_features]
        
        return {
            "available_versions": ml_data["available_versions"],
            "current_version": ml_data["current_version"],
            "features": ui_features,
            "categorical_features": [f for f in ml_data["info"].get("categorical_features", []) if f in ui_features]
        }

    @staticmethod
    async def perform_prediction(
        db: Session, 
        features: Dict[str, Any], 
        version: str, 
        operation_id: Optional[int] = None
    ) -> Dict[str, Any]:
        
        # 0. Валидация
        if operation_id:
            op_exists = db.query(Operation).filter(Operation.id == operation_id).first()
            if not op_exists:
                raise ValueError(f"Operation with ID {operation_id} not found")

        # 1. Расчеты и ML
        calc_results = await ml_client.calculate_features(features)
        full_features = {**features, **calc_results}
        full_features.pop("status", None)

        ml_result = await ml_client.predict(full_features, version)

        # 2. Сохранение
        if operation_id:
            try:
                cd = ClinicalData(
                    operation_id=operation_id, 
                    features=full_features,
                    created_at=datetime.utcnow()
                )
                db.add(cd)
                
                prediction = Prediction(
                    operation_id=operation_id,
                    risk_score=ml_result["risk_score"],
                    risk_level=ml_result["risk_level"],
                    model_version=ml_result.get("version", version),
                    created_at=datetime.utcnow()
                )
                db.add(prediction)
                db.commit()
                db.refresh(prediction)
                
                # Возвращаем ПЛОСКИЙ словарь, чтобы не было вложенности result.result
                return {
                    "id": prediction.id,
                    "risk_score": prediction.risk_score,
                    "risk_level": prediction.risk_level,
                    "model_version": prediction.model_version,
                    "created_at": prediction.created_at.isoformat(),
                    "saved": True
                }
            except Exception as e:
                db.rollback()
                raise e

        # Если без сохранения, просто возвращаем данные из ML сервиса
        return {**ml_result, "saved": False}

    @staticmethod
    def get_predictions_list(db: Session, patient_id: Optional[int], skip: int, limit: int):
        query = db.query(Prediction).options(
            joinedload(Prediction.operation).joinedload(Operation.patient),
            joinedload(Prediction.operation).joinedload(Operation.clinical_data),
        )

        if patient_id:
            query = query.join(Operation).filter(Operation.patient_id == patient_id)

        predictions = query.order_by(Prediction.created_at.desc()).offset(skip).limit(limit).all()
        
        # Маппинг в удобный формат
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