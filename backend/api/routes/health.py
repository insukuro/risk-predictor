"""Health check endpoint."""
from fastapi import APIRouter
from backend.models.schemas import HealthCheckResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "database": "connected",
        "model_service": "ready"  # Will map to 'service' field via alias
    }
