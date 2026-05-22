"""Operation management service."""
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import func, and_
from sqlalchemy.orm import Session, joinedload
from backend.db.models import Operation, ClinicalData, Prediction


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
    @staticmethod
    def get_by_patient_and_date(
        db: Session, 
        patient_id: int, 
        operation_date: date,
        operation_type: str
    ) -> Optional[Operation]:
        """Check for duplicate operations."""
        return db.query(Operation).filter(
            Operation.patient_id == patient_id,
            Operation.date == operation_date,
            Operation.type == operation_type
        ).first()
    
    @staticmethod
    def get_with_clinical_data(db: Session, operation_id: int) -> Optional[Operation]:
        """Get operation with clinical data eagerly loaded."""
        return db.query(Operation).options(
            joinedload(Operation.clinical_data)
        ).filter(Operation.id == operation_id).first()
    
    @staticmethod
    def get_with_predictions(db: Session, operation_id: int) -> Optional[Operation]:
        """Get operation with predictions eagerly loaded."""
        return db.query(Operation).options(
            joinedload(Operation.predictions)
        ).filter(Operation.id == operation_id).first()
    
    @staticmethod
    def list_filtered(
        db: Session,
        patient_id: Optional[int] = None,
        operation_type: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        has_predictions: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[Operation]:
        """Filtered operation list with pagination."""
        query = db.query(Operation)
        
        if patient_id:
            query = query.filter(Operation.patient_id == patient_id)
        if operation_type:
            query = query.filter(Operation.type == operation_type)
        if date_from:
            query = query.filter(Operation.date >= date_from)
        if date_to:
            query = query.filter(Operation.date <= date_to)
        if has_predictions is not None:
            if has_predictions:
                query = query.filter(Operation.predictions.any())
            else:
                query = query.filter(~Operation.predictions.any())
        
        return query.order_by(Operation.date.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def update(db: Session, operation_id: int, **kwargs) -> Optional[Operation]:
        """Update operation fields."""
        operation = db.query(Operation).filter(Operation.id == operation_id).first()
        if operation:
            for key, value in kwargs.items():
                if hasattr(operation, key) and value is not None:
                    setattr(operation, key, value)
            db.commit()
            db.refresh(operation)
        return operation
    
    @staticmethod
    def delete(db: Session, operation_id: int):
        """Delete operation."""
        operation = db.query(Operation).filter(Operation.id == operation_id).first()
        if operation:
            db.delete(operation)
            db.commit()
    
    @staticmethod
    def get_by_patient(
        db: Session, 
        patient_id: int, 
        skip: int = 0, 
        limit: int = 20
    ) -> List[Operation]:
        """Get all operations for a patient with pagination."""
        return db.query(Operation).filter(
            Operation.patient_id == patient_id
        ).order_by(Operation.date.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_summary_stats(
        db: Session, 
        date_from: Optional[str] = None, 
        date_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get operation summary statistics."""
        from datetime import datetime
        
        query = db.query(Operation)
        
        # Применяем фильтры по датам
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d')
                query = query.filter(Operation.date >= date_from_obj)
            except ValueError:
                pass
        
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d')
                query = query.filter(Operation.date <= date_to_obj)
            except ValueError:
                pass
        
        # Общее количество операций
        total_operations = query.count()
        
        # Группировка по типам
        type_counts = (
            query.with_entities(
                Operation.type, 
                func.count(Operation.id).label('count')
            )
            .group_by(Operation.type)
            .all()
        )
        
        # Формируем словарь by_type
        by_type = {}
        for op_type, count in type_counts:
            by_type[op_type or 'OTHER'] = count
        
        return {
            "total_operations": total_operations,
            "by_type": by_type
        }