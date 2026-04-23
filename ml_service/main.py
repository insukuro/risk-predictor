"""ML Microservice - Main Application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from ml_service.config import config
from ml_service.models.registry import ModelRegistry
from ml_service.schemas.requests import PredictRequest, SetVersionRequest
from ml_service.utils import get_feature_importance, get_top_features, predict


# Инициализация реестра моделей
registry = ModelRegistry(config.MODELS_DIR)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting ML Service...")
    registry.load_all()
    yield
    print("👋 Shutting down...")

# Создание FastAPI приложения
app = FastAPI(
    title="ML Service",
    version="1.4.0",
    lifespan=lifespan
)

# ============ Health & Info Endpoints ============

@app.get("/health")
async def health():
    """Проверка состояния сервиса."""
    return {
        "status": "ok",
        "models_loaded": len(registry.models),
        "current_version": registry.current_version,
        "available_versions": list(registry.models.keys())
    }

@app.get("/models/versions")
async def list_versions():
    """Список всех версий моделей."""
    versions_info = {}
    
    for version, package in registry.models.items():
        versions_info[version] = {
            "is_current": version == registry.current_version,
            "features_count": len(package['feature_names']),
            "framework": package.get('framework', 'unknown'),
            "model_type": type(package['model']).__name__,
            "loaded_at": package.get('_loaded_at'),
            "file_size_mb": package.get('_file_size_mb')
        }
    
    return {
        "current_version": registry.current_version,
        "versions": versions_info
    }

@app.get("/model/info")
async def model_info(version: str = None):
    """Информация о конкретной модели."""
    package, actual_version = registry.get_package(version)
    
    feature_names, _ = get_feature_importance(package)
    top_features = get_top_features(package, top_n=10)
    
    return {
        "version": actual_version,
        "is_current": actual_version == registry.current_version,
        "framework": package.get('framework', 'unknown'),
        "model_type": type(package['model']).__name__,
        "total_features": len(feature_names),
        "required_features": top_features,
        "categorical_features": package.get('categorical_features', []),
        "loaded_at": package.get('_loaded_at'),
        "file_path": package.get('_file_path')
    }

# ============ Prediction Endpoints ============

@app.post("/predict")
async def predict_endpoint(request: PredictRequest):
    """Выполнить предсказание."""
    if not registry.models:
        raise HTTPException(status_code=503, detail="No models loaded")
    
    try:
        package, version = registry.get_package(request.version)
        prediction = predict(package, request.features)
        
        return {
            "version": version,
            "framework": package.get('framework', 'unknown'),
            **prediction
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")



@app.post("/models/reload")
async def reload_models():
    """Перезагрузить все модели."""
    registry.clear()
    success = registry.load_all()
    
    if success:
        return {
            "status": "reloaded",
            "models_loaded": len(registry.models),
            "current_version": registry.current_version
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to reload models")

@app.post("/models/set_version")
async def set_version(request: SetVersionRequest):
    """Установить текущую версию модели."""
    if not registry.set_version(request.version):
        raise HTTPException(status_code=404, detail=f"Version '{request.version}' not found")
    
    package, _ = registry.get_package(request.version)
    top_features = get_top_features(package, top_n=10)
    
    return {
        "version": registry.current_version,
        "required_features": top_features
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.DEFAULT_PORT,
        reload=True
    )
