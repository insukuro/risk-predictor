"""ML Microservice - Main Application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from ml_service.config import config
from ml_service.models.registry import ModelRegistry
from ml_service.schemas.requests import PredictRequest, SetVersionRequest
from ml_service.features.importance import get_feature_importance, get_top_features
from ml_service.models.predictor import predict
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
    version="1.5.0",
    lifespan=lifespan
)

#Health & Info Endpoints

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
        # Определяем тип модели в зависимости от формата пакета
        if package.get('is_ensemble'):
            # Для ансамбля берем тип первой попавшейся модели из веток
            models_ik = package.get('models_ik', {})
            sample_model = list(models_ik.values())[0] if models_ik else None
            model_type = f"Ensemble ({type(sample_model).__name__})" if sample_model else "Ensemble"
        else:
            model_type = type(package.get('model')).__name__ if package.get('model') else "unknown"

        versions_info[version] = {
            "is_current": version == registry.current_version,
            "features_count": len(package['feature_names']),
            "framework": package.get('framework', 'unknown'),
            "model_type": model_type,
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
    
    # Защита от KeyError для типа модели
    if package.get('is_ensemble'):
        models_ik = package.get('models_ik', {})
        sample_model = list(models_ik.values())[0] if models_ik else None
        model_type = f"Ensemble ({type(sample_model).__name__})" if sample_model else "Ensemble"
    else:
        model_type = type(package.get('model')).__name__ if package.get('model') else "unknown"
    
    return {
        "version": actual_version,
        "is_current": actual_version == registry.current_version,
        "framework": package.get('framework', 'unknown'),
        "model_type": model_type,
        "total_features": len(feature_names),
        "required_features": top_features,
        "categorical_features": package.get('categorical_features', []),
        "loaded_at": package.get('_loaded_at'),
        "file_path": package.get('_file_path')
    }

@app.get("/model/demo")
async def get_demo_data(version: str = None):
    """
    Получить демо-данные текущей модели (или указанной версии).
    Возвращает пример признаков и результат предсказания на них.
    """
    if not registry.models:
        raise HTTPException(status_code=503, detail="No models loaded")
    
    try:
        package, actual_version = registry.get_package(version)
        
        # Проверяем, есть ли демо-данные в модели
        demo_data = package.get('demo_data')
        
        if demo_data is None:
            return {
                "version": actual_version,
                "demo_available": False,
                "message": "Demo data not embedded in this model. Use /model/info to see required features.",
                "demo_input_features": {}
            }
        
        # Гарантируем для контракта, что pump присутствует в признаках
        if isinstance(demo_data, dict):
            if "pump (0/1)" not in demo_data:
                # Если есть ключ 'pump', маппим его, иначе ставим 1
                demo_data["pump (0/1)"] = demo_data.get("pump", 1)

        # Запускаем предсказание на демо-данных
        prediction = predict(package, demo_data)
        
        return {
            "version": actual_version,
            "demo_available": True,
            "demo_input_features": demo_data,
            "demo_prediction": prediction
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demo error: {str(e)}")


#Prediction Endpoints 
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
