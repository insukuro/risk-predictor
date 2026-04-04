"""Patient management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.models.schemas import PatientCreate, PatientResponse
from backend.services.patient_service import PatientService

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    """Create a new patient."""
    created_patient = PatientService.create(
        db,
        sex=patient.sex,
        birth_date=patient.birth_date
    )
    return created_patient


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: int, db: Session = Depends(get_db)):
    """Get patient by ID."""
    patient = PatientService.get(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
