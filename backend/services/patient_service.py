"""Patient management service."""
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from backend.db.models import Patient


class PatientService:
    """Service for patient operations."""

    @staticmethod
    def create(db: Session, sex: str, birth_date: date) -> Patient:
        """
        Create a new patient.
        
        Args:
            db: Database session
            sex: Patient sex
            birth_date: Patient birth date
            
        Returns:
            Created patient
        """
        patient = Patient(sex=sex, birth_date=birth_date)
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return patient

    @staticmethod
    def get(db: Session, patient_id: int) -> Optional[Patient]:
        """Get patient by ID."""
        return db.query(Patient).filter(Patient.id == patient_id).first()
