"""Operation management service."""
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from backend.db.models import Operation


class OperationService:
    """Service for operation management."""

    @staticmethod
    def create(db: Session, patient_id: int, operation_type: str, date_: date) -> Operation:
        """
        Create a new operation.
        
        Args:
            db: Database session
            patient_id: Patient ID
            operation_type: Type of operation
            date_: Operation date
            
        Returns:
            Created operation
        """
        operation = Operation(
            patient_id=patient_id,
            type=operation_type,
            date=date_
        )
        db.add(operation)
        db.commit()
        db.refresh(operation)
        return operation

    @staticmethod
    def get(db: Session, operation_id: int) -> Optional[Operation]:
        """Get operation by ID."""
        return db.query(Operation).filter(Operation.id == operation_id).first()
