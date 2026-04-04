"""Database models for Risk Predictor application."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Date, Float, DateTime, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Patient(Base):
    """Patient model."""
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    sex = Column(String, nullable=False)
    birth_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    operations = relationship("Operation", back_populates="patient", cascade="all, delete-orphan")


class Operation(Base):
    """Surgical operation model."""
    __tablename__ = "operations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    type = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="operations")
    clinical_data = relationship("ClinicalData", back_populates="operation", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="operation", cascade="all, delete-orphan")


class ClinicalData(Base):
    """Clinical data for an operation."""
    __tablename__ = "clinical_data"

    id = Column(Integer, primary_key=True, index=True)
    operation_id = Column(Integer, ForeignKey("operations.id"), nullable=False)
    features = Column(JSON, nullable=False)  # Store features as JSON
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    operation = relationship("Operation", back_populates="clinical_data")


class Prediction(Base):
    """Risk prediction result."""
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    operation_id = Column(Integer, ForeignKey("operations.id"), nullable=False)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    model_version = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    operation = relationship("Operation", back_populates="predictions")
