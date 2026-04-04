"""Operation management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.models.schemas import OperationCreate, OperationResponse
from backend.services.patient_service import PatientService
from backend.services.operation_service import OperationService

router = APIRouter(prefix="/operations", tags=["operations"])


@router.post("", response_model=OperationResponse)
async def create_operation(operation: OperationCreate, db: Session = Depends(get_db)):
    """Create a new operation."""
    # Verify patient exists
    patient = PatientService.get(db, operation.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    created_operation = OperationService.create(
        db,
        patient_id=operation.patient_id,
        operation_type=operation.type,
        date_=operation.date
    )
    return created_operation
