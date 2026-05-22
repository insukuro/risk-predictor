"""Extended PatientService with data features"""
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import func, and_, case, extract
from sqlalchemy.orm import Session, joinedload
from backend.db.models import Patient, Operation, ClinicalData, Prediction


class PatientService:
    
    @staticmethod
    def create(db: Session, sex: str, birth_date: date) -> Patient:
        """Create a new patient."""
        patient = Patient(sex=sex, birth_date=birth_date)
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return patient
    
    @staticmethod
    def get(db: Session, patient_id: int) -> Optional[Patient]:
        """Get patient by ID."""
        return db.query(Patient).filter(Patient.id == patient_id).first()
    
    @staticmethod
    def find_duplicate(db: Session, sex: str, birth_date: date, exclude_id: Optional[int] = None) -> Optional[Patient]:
        """Find duplicate patient by sex and birth_date."""
        query = db.query(Patient).filter(
            Patient.sex == sex,
            Patient.birth_date == birth_date
        )
        if exclude_id:
            query = query.filter(Patient.id != exclude_id)
        return query.first()
    
    @staticmethod
    def calculate_age(birth_date: date) -> int:
        """Calculate age from birth date."""
        today = date.today()
        return today.year - birth_date.year - (
            (today.month, today.day) < (birth_date.month, birth_date.day)
        )
    
    @staticmethod
    def list_filtered(
        db: Session,
        sex: Optional[str] = None,
        age_min: Optional[int] = None,
        age_max: Optional[int] = None,
        has_operations: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[Patient]:
        """List patients with various filters."""
        query = db.query(Patient)
        
        if sex:
            query = query.filter(Patient.sex == sex)
        
        if age_min is not None or age_max is not None:
            today = date.today()
            if age_min is not None:
                max_birth = today.replace(year=today.year - age_min)
                query = query.filter(Patient.birth_date <= max_birth)
            if age_max is not None:
                min_birth = today.replace(year=today.year - age_max - 1)
                query = query.filter(Patient.birth_date >= min_birth)
        
        if has_operations is not None:
            if has_operations:
                query = query.filter(Patient.operations.any())
            else:
                query = query.filter(~Patient.operations.any())
        
        if search:
            # Search by ID or partial text in sex field
            if search.isdigit():
                query = query.filter(Patient.id == int(search))
            else:
                query = query.filter(Patient.sex.ilike(f"%{search}%"))
        
        return query.order_by(Patient.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def update(db: Session, patient_id: int, **kwargs) -> Optional[Patient]:
        """Update patient fields."""
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if patient:
            for key, value in kwargs.items():
                if hasattr(patient, key) and value is not None:
                    setattr(patient, key, value)
            db.commit()
            db.refresh(patient)
        return patient
    
    @staticmethod
    def delete(db: Session, patient_id: int):
        """Soft check delete - won't delete if has predictions."""
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if patient:
            db.delete(patient)
            db.commit()
    
    @staticmethod
    def force_delete(db: Session, patient_id: int):
        """Force delete patient and all related data."""
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if patient:
            # Delete predictions for all operations
            operations = db.query(Operation).filter(Operation.patient_id == patient_id).all()
            for op in operations:
                db.query(Prediction).filter(Prediction.operation_id == op.id).delete()
                db.query(ClinicalData).filter(ClinicalData.operation_id == op.id).delete()
            
            # Delete operations
            db.query(Operation).filter(Operation.patient_id == patient_id).delete()
            
            # Delete patient
            db.delete(patient)
            db.commit()
    
    @staticmethod
    def get_with_operations(
        db: Session, 
        patient_id: int,
        operation_type: Optional[str] = None
    ) -> Optional[Patient]:
        """Get patient with operations eagerly loaded."""
        query = db.query(Patient).options(
            joinedload(Patient.operations)
        ).filter(Patient.id == patient_id)
        
        patient = query.first()
        
        if patient and operation_type:
            patient.operations = [
                op for op in patient.operations 
                if op.type == operation_type
            ]
        
        return patient
    
    @staticmethod
    def get_stats(db: Session, patient_id: int) -> Dict[str, Any]:
        """Get comprehensive statistics for a patient."""
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return None
        
        operations = patient.operations
        
        # Operation types count
        op_types = {}
        for op in operations:
            op_types[op.type] = op_types.get(op.type, 0) + 1
        
        # Predictions stats
        ops_with_preds = [op for op in operations if op.predictions]
        risk_scores = []
        risk_levels = {}
        
        for op in ops_with_preds:
            for pred in op.predictions:
                risk_scores.append(pred.risk_score)
                risk_levels[pred.risk_level] = risk_levels.get(pred.risk_level, 0) + 1
        
        # Dates
        sorted_dates = sorted([op.date for op in operations])
        first_op_date = sorted_dates[0] if sorted_dates else None
        last_op_date = sorted_dates[-1] if sorted_dates else None
        
        days_since_last = None
        if last_op_date:
            days_since_last = (date.today() - last_op_date).days
        
        return {
            "patient_id": patient_id,
            "total_operations": len(operations),
            "operation_types": op_types,
            "operations_with_predictions": len(ops_with_preds),
            "operations_without_predictions": len(operations) - len(ops_with_preds),
            "avg_risk_score": sum(risk_scores) / len(risk_scores) if risk_scores else None,
            "risk_level_distribution": risk_levels,
            "first_operation_date": first_op_date,
            "last_operation_date": last_op_date,
            "days_since_last_operation": days_since_last
        }
    
    @staticmethod
    def get_age_distribution(db: Session) -> List[Dict[str, Any]]:
        """Get age distribution of all patients with operations."""
        # Получаем пациентов, у которых есть операции
        patients_with_ops = db.query(Patient).join(
            Operation, Patient.id == Operation.patient_id
        ).distinct().all()
        
        age_ranges = {
            "0-18": 0,
            "19-30": 0,
            "31-50": 0,
            "51-70": 0,
            "71+": 0
        }
        
        for patient in patients_with_ops:
            age = PatientService.calculate_age(patient.birth_date)
            
            if age <= 18:
                age_ranges["0-18"] += 1
            elif age <= 30:
                age_ranges["19-30"] += 1
            elif age <= 50:
                age_ranges["31-50"] += 1
            elif age <= 70:
                age_ranges["51-70"] += 1
            else:
                age_ranges["71+"] += 1
        
        # Возвращаем массив объектов
        return [
            {"age_group": group, "count": count}
            for group, count in age_ranges.items()
        ]
    
    @staticmethod
    def merge_patients(db: Session, source_id: int, target_id: int) -> int:
        """Merge source patient into target patient."""
        # Move all operations from source to target
        operations = db.query(Operation).filter(
            Operation.patient_id == source_id
        ).all()
        
        for op in operations:
            op.patient_id = target_id
        
        # Delete source patient
        source = db.query(Patient).filter(Patient.id == source_id).first()
        if source:
            db.delete(source)
        
        db.commit()
        return len(operations)