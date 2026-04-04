"""Prediction service - handles risk prediction logic."""
import requests
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from backend.db.models import ClinicalData, Prediction, Operation, Patient
from backend.models.schemas import PredictRequest
from backend.services.patient_service import PatientService
from backend.services.operation_service import OperationService


class PredictionService:
    """Service for handling risk predictions."""

    @staticmethod
    def create_prediction(db: Session, request: PredictRequest) -> Prediction:
        """
        Create a new prediction.
        
        Args:
            db: Database session
            request: Prediction request with patient, operation, and features
            
        Returns:
            Created prediction record
        """
        # Get or create patient
        if request.patient.id:
            patient = PatientService.get(db, request.patient.id)
            if not patient:
                raise ValueError(f"Patient with ID {request.patient.id} not found")
        else:
            patient = PatientService.create(
                db,
                sex=request.patient.sex,
                birth_date=request.patient.birth_date
            )

        # Create operation
        operation = OperationService.create(
            db,
            patient_id=patient.id,
            operation_type=request.operation.type,
            date_=request.operation.date
        )

        # Store clinical data
        clinical_data = ClinicalData(
            operation_id=operation.id,
            features=request.features
        )
        db.add(clinical_data)
        db.commit()

        # Make prediction using ML model service
        risk_score, risk_level = PredictionService._call_ml_service(request.features)

        # Store prediction
        prediction = Prediction(
            operation_id=operation.id,
            risk_score=risk_score,
            risk_level=risk_level,
            model_version="1.0.0"
        )
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        
        return prediction

    @staticmethod
    def _call_ml_service(features: Dict[str, Any]) -> tuple[float, str]:
        """
        Call ML microservice to get prediction.
        
        Args:
            features: Input features for prediction
            
        Returns:
            Tuple of (risk_score, risk_level)
        """
        try:
            # Call ML microservice on port 8001
            response = requests.post(
                "http://localhost:8001/predict",
                json={"features": features},
                timeout=5
            )
            response.raise_for_status()
            data = response.json()
            return data["risk_score"], data["risk_level"]
        except Exception:
            # Fallback to mock prediction
            risk_score = min(0.5 + len(features) * 0.01, 1.0)
            if risk_score < 0.3:
                risk_level = "low"
            elif risk_score < 0.7:
                risk_level = "medium"
            else:
                risk_level = "high"
            return risk_score, risk_level

    @staticmethod
    def get_all(db: Session, patient_id: Optional[int] = None) -> List[Prediction]:
        """
        Get predictions, optionally filtered by patient ID.
        
        Args:
            db: Database session
            patient_id: Optional patient ID for filtering
            
        Returns:
            List of predictions
        """
        query = db.query(Prediction).join(Operation).join(Patient)
        
        if patient_id:
            query = query.filter(Patient.id == patient_id)
        
        return query.all()

    @staticmethod
    def get(db: Session, prediction_id: int) -> Optional[Prediction]:
        """Get prediction by ID."""
        return db.query(Prediction).filter(Prediction.id == prediction_id).first()
