"""Декларативное описание API маршрутов ML-сервиса."""
from fastapi import APIRouter, HTTPException, Request

from ml_service.schemas.requests import PredictRequest, SetVersionRequest
from ml_service.features.importance import get_feature_importance, get_input_top_features, get_top_features
from ml_service.utils.helpers import get_model_type, normalize_feature_keys
from ml_service.models.predictor import predict
from ml_service.constants import TARGET_FEATURES, REDUNDANT_FEATURES

router = APIRouter()

@router.get("/health")
async def health(request: Request):
    """Проверка состояния сервиса и доступных версий моделей."""
    registry = request.app.state.registry
    return {
        "status": "ok",
        "models_loaded": len(registry.models),
        "current_version": registry.current_version,
        "available_versions": list(registry.models.keys())
    }


@router.get("/models/versions")
async def list_versions(request: Request):
    """Список всех загруженных версий моделей с метаданными."""
    registry = request.app.state.registry
    versions_info = {}
    
    for version, package in registry.models.items():
        versions_info[version] = {
            "is_current": version == registry.current_version,
            "features_count": len(package['feature_names']),
            "framework": package.get('framework', 'unknown'),
            "model_type": get_model_type(package),
            "loaded_at": package.get('_loaded_at'),
            "file_size_mb": package.get('_file_size_mb')
        }
    
    return {
        "current_version": registry.current_version,
        "versions": versions_info
    }


@router.get("/model/info")
async def model_info(request: Request, version: str = None):
    """Детальная информация о конкретной (или текущей) модели."""
    registry = request.app.state.registry
    package, actual_version = registry.get_package(version)
    
    feature_names, _ = get_feature_importance(package)
    top_features = get_input_top_features(package, top_n=10)
    
    return {
        "version": actual_version,
        "is_current": actual_version == registry.current_version,
        "framework": package.get('framework', 'unknown'),
        "model_type": get_model_type(package),
        "total_features": len(feature_names),
        "required_features": top_features,
        "categorical_features": package.get('categorical_features', []),
        "loaded_at": package.get('_loaded_at'),
        "file_path": package.get('_file_path')
    }


@router.get("/model/demo")
async def get_demo_data(request: Request, version: str = None):
    """Получить очищенные демонстрационные данные для фронтенда."""
    registry = request.app.state.registry
    if not registry.models:
        raise HTTPException(status_code=503, detail="No models loaded")

    try:
        package, actual_version = registry.get_package(version)
        demo_data = package.get('demo_data')
        framework = package.get('framework', 'unknown')

        if demo_data is None:
            return {
                "version": actual_version,
                "demo_available": False,
                "message": "Demo data not embedded in this model.",
                "demo_input_features": {}
            }

        required_by_model = get_top_features(package, top_n=10)

        if isinstance(demo_data, dict):
            clean_demo = {}

            for k, v in demo_data.items():
                # Топ-10 обязательных — оставляем всегда
                if k in required_by_model:
                    clean_demo[k] = v
                    continue

                if k in TARGET_FEATURES:
                    continue

                if '1-годичная' in k or '30-дневная' in k:
                    if k not in package['feature_names']:
                        continue

                # ── Изоляция фильтрации REDUNDANT для не-TabNet ──────────────
                # 'Пол' НЕ фильтруем для TabNet — он нужен LabelEncoder
                if framework != 'tabnet':
                    if k in REDUNDANT_FEATURES:
                        continue
                    # NON_TABNET_REDUNDANT тоже применяем только для не-tabnet
                    from ml_service.constants import NON_TABNET_REDUNDANT_FEATURES
                    if k in NON_TABNET_REDUNDANT_FEATURES:
                        continue
                else:
                    # Для TabNet фильтруем только не-нужные дубликаты
                    if k in REDUNDANT_FEATURES:
                        continue
                    # 'Пол' для TabNet НЕ фильтруем

                clean_demo[k] = v

            if "pump (0/1)" not in clean_demo and "pump" not in clean_demo:
                clean_demo["pump (0/1)"] = 1

            normalized_demo = normalize_feature_keys(
                clean_demo, package.get('feature_names', [])
            )
        else:
            clean_demo = demo_data
            normalized_demo = demo_data

        prediction = predict(package, normalized_demo)

        return {
            "version": actual_version,
            "demo_available": True,
            "demo_input_features": clean_demo,
            "demo_prediction": prediction
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Demo error: {str(e)}")

@router.post("/predict")
async def predict_endpoint(request: Request, payload: PredictRequest):
    """Основной эндпоинт для проведения скоринга рисков пациента."""
    registry = request.app.state.registry
    try:
        package, actual_version = registry.get_package(payload.version)
        if not package:
            raise HTTPException(status_code=404, detail=f"Model version {payload.version} not found")
        
        result = predict(package, payload.features)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal prediction error: {str(e)}")


@router.post("/models/reload")
async def reload_models(request: Request):
    """Принудительная перезагрузка реестра моделей с диска."""
    registry = request.app.state.registry
    registry.clear()
    if registry.load_all():
        return {
            "status": "reloaded",
            "models_loaded": len(registry.models),
            "current_version": registry.current_version
        }
    raise HTTPException(status_code=500, detail="Failed to reload models")


@router.post("/models/set_version")
async def set_version(request: Request, payload: SetVersionRequest):
    """Переключение активной версии модели на лету."""
    registry = request.app.state.registry
    if not registry.set_version(payload.version):
        raise HTTPException(status_code=404, detail=f"Version '{payload.version}' not found")
    
    package, _ = registry.get_package(payload.version)
    top_features = get_top_features(package, top_n=10)
    
    return {
        "version": registry.current_version,
        "required_features": top_features
    }