"""API routes module."""
from fastapi import APIRouter
from backend.api.routes import health, patients, operations, predictions

router = APIRouter()

# Include route modules
router.include_router(health.router)
router.include_router(patients.router)
router.include_router(operations.router)
router.include_router(predictions.router)
