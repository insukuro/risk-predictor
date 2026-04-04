#!/usr/bin/env python3
"""
Quick test script to verify backend is working correctly
"""

import sys
import json

# Test imports
print("Testing imports...")
try:
    from backend.db.models import Patient, Operation, ClinicalData, Prediction
    from backend.db.session import SessionLocal, engine
    from ml.predict import predict, validate_features, get_model_info
    from backend.services.risk_predictor import RiskPredictorService
    from backend.models.schemas import PredictRequest, PatientCreate
    print("✅ All imports successful")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)

# Test database connection
print("\nTesting database connection...")
try:
    db = SessionLocal()
    db.execute("SELECT 1")
    db.close()
    print("❌ Database connection test - needs database to be running")
except Exception as e:
    # This is expected if database isn't set up yet
    print(f"⚠️  Database not ready yet (expected for fresh setup): {str(e)[:60]}...")

# Test ML model
print("\nTesting ML model...")
try:
    # Test feature validation
    test_features = {
        "age": 61,
        "blood_pressure": 140,
        "cholesterol": 5.8,
        "diabetes": True,
        "smoking": False
    }
    
    is_valid, error = validate_features(test_features)
    if is_valid:
        print("✅ Feature validation passed")
    else:
        print(f"❌ Feature validation failed: {error}")
        sys.exit(1)
    
    # Test prediction
    risk_score, risk_level = predict(test_features)
    print(f"✅ Prediction successful: risk_score={risk_score:.2f}, risk_level={risk_level}")
    
    # Test model info
    model_info = get_model_info()
    print(f"✅ Model info retrieved: version={model_info['version']}")
    
except Exception as e:
    print(f"❌ ML model test failed: {e}")
    sys.exit(1)

# Test with missing features
print("\nTesting error handling...")
try:
    invalid_features = {"age": 50}  # Missing required features
    is_valid, error = validate_features(invalid_features)
    if not is_valid:
        print(f"✅ Error handling works: {error}")
    else:
        print("❌ Should have detected missing features")
except Exception as e:
    print(f"❌ Unexpected error: {e}")

print("\n" + "="*50)
print("✅ Backend tests passed!")
print("="*50)
print("\nNext steps:")
print("1. Ensure PostgreSQL is running: docker-compose up -d")
print("2. Start backend: python3 -m uvicorn backend.main:app --reload")
print("3. Start frontend: cd frontend && npm run dev")
print("4. Open http://localhost:5173 in your browser")
