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

# Health & Info Endpoints

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
    
    from ml_service.features.importance import get_input_top_features  # Импорт здесь или сверху
    
    feature_names, _ = get_feature_importance(package)
    top_features = get_input_top_features(package, top_n=10)  # ← Только входные!
    
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
        "required_features": top_features,  # ← Теперь без таргетов и дубликатов
        "categorical_features": package.get('categorical_features', []),
        "loaded_at": package.get('_loaded_at'),
        "file_path": package.get('_file_path')
    }


@app.get("/model/demo")
async def get_demo_data(version: str = None):
    """
    Получить демо-данные текущей модели (или указанной версии).
    """
    if not registry.models:
        raise HTTPException(status_code=503, detail="No models loaded")
    
    try:
        package, actual_version = registry.get_package(version)
        
        demo_data = package.get('demo_data')
        
        if demo_data is None:
            return {
                "version": actual_version,
                "demo_available": False,
                "message": "Demo data not embedded in this model.",
                "demo_input_features": {}
            }
        
        # Очищаем демо-данные для фронтенда
        if isinstance(demo_data, dict):
            # Копируем, чтобы не мутировать оригинал
            clean_demo = {}
            
            # Таргеты - не показываем
            targets = {
                '30-дневная', '1-годичная_x', '1-годичная_y',
                'Энцефалопатия', 'Диализ / ЗПТ', 'Рестернотомия',
                'Ревизия гемостаза', 'Медиастинит / ДГНР', 'Пневмония (инф.)',
                'Пневмония / ДН', 'ОРДС', 'Плеврит / гидроторакс',
            }
            
            for key, value in demo_data.items():
                # Пропускаем таргеты
                if key in targets or '1-годичная' in key or '30-дневная' in key:
                    continue
                # Пропускаем категориальные дубликаты
                if key == 'Пол' and 'Пол (0=жен,1=муж)' in demo_data:
                    continue
                if key == 'Срочность' and 'Срочность (0=план,1=экстр)' in demo_data:
                    continue
                if key == 'Возрастная группа' and 'Возраст (лет)' in demo_data:
                    continue
                if key == 'Категория ИМТ' and 'ИМТ (кг/м²)' in demo_data:
                    continue
                
                clean_demo[key] = value
            
            # Гарантируем pump
            if "pump (0/1)" not in clean_demo:
                clean_demo["pump (0/1)"] = clean_demo.get("pump", 1)
            
            # Нормализуем для predict
            normalized_demo = _normalize_feature_keys(clean_demo, package.get('feature_names', []))
        else:
            clean_demo = demo_data
            normalized_demo = demo_data

        # Предсказание
        prediction = predict(package, normalized_demo)
        
        return {
            "version": actual_version,
            "demo_available": True,
            "demo_input_features": clean_demo,  # Чистые данные для фронтенда
            "demo_prediction": prediction
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demo error: {str(e)}")

@app.post("/predict")
async def predict_endpoint(request: PredictRequest):
    """
    Эндпоинт предсказания с нормализацией.
    """
    try:
        features = request.features
        version = request.version
        
        # ИСПРАВЛЕНО: используем экземпляр registry, а не класс
        package, actual_version = registry.get_package(version)
        if not package:
            raise HTTPException(status_code=404, detail=f"Model version {version} not found")
        
        # Нормализуем ключи фич
        normalized_features = _normalize_feature_keys(features, package.get('feature_names', []))
        
        # ПРОВЕРКА: есть ли pump в фичах
        has_pump = any('pump' in k.lower() for k in normalized_features.keys())
        if not has_pump:
            # Добавляем pump=1 по умолчанию (модели ИК - более консервативный прогноз)
            normalized_features['pump'] = 1
        
        # Выполняем предсказание
        result = predict(package, normalized_features)
        
        return result
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal prediction error: {str(e)}")


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


def _normalize_feature_keys(features: dict, expected_features: list) -> dict:
    """
    Нормализует ключи словаря признаков для соответствия ожидаемым моделью.
    "pump (0/1)" -> "pump", "Пол" -> "Пол"
    """
    normalized = {}
    
    for key, value in features.items():
        # Прямое совпадение
        if key in expected_features:
            normalized[key] = value
            continue
        
        # Чистим ключ для сравнения
        key_clean = key.lower().replace(' ', '').replace('(', '').replace(')', '')
        
        found = False
        for expected in expected_features:
            expected_clean = expected.lower().replace(' ', '').replace('(', '').replace(')', '')
            
            if key_clean == expected_clean or key_clean in expected_clean or expected_clean in key_clean:
                normalized[expected] = value
                found = True
                break
        
        # Если не нашли соответствие, добавляем как есть
        if not found:
            normalized[key] = value
    
    return normalized


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.DEFAULT_PORT,
        reload=True
    )