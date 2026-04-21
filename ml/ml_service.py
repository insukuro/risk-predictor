"""ML Microservice - Multi-framework support WITHOUT metadata file."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import joblib
import numpy as np
import pandas as pd
import os
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime

# Только словарь с моделями в памяти
models = {}  # {"v1": package, "v2": package}
current_version = None

MODELS_DIR = os.getenv("MODELS_DIR", "ml/models")


def load_all_models():
    """Загружает все версии моделей из .pkl файлов."""
    global models, current_version
    
    models_dir = Path(MODELS_DIR)
    if not models_dir.exists():
        print(f"⚠️ Models directory not found: {MODELS_DIR}")
        return False
    
    # Ищем все файлы с моделями
    model_files = sorted(models_dir.glob("model_v*.pkl"))
    
    if not model_files:
        print(f"⚠️ No model files found in {MODELS_DIR}")
        return False
    
    for model_file in model_files:
        version = model_file.stem.replace("model_", "")
        
        try:
            print(f"📦 Loading model {version}...")
            package = joblib.load(model_file)
            
            # Базовая валидация пакета
            if not isinstance(package, dict):
                print(f"   ❌ Invalid package format for {version}")
                continue
            
            if 'model' not in package:
                print(f"   ❌ No 'model' key in package {version}")
                continue
            
            if 'feature_names' not in package:
                print(f"   ❌ No 'feature_names' in package {version}")
                continue
            
            # Определяем фреймворк если не указан
            if 'framework' not in package:
                package['framework'] = _detect_framework(package['model'])
            
            # Сохраняем в память
            models[version] = package
            
            # Добавляем runtime-информацию (только в памяти)
            package['_loaded_at'] = datetime.now().isoformat()
            package['_file_path'] = str(model_file)
            package['_file_size_mb'] = round(model_file.stat().st_size / 1024 / 1024, 2)
            
            print(f"   ✅ Loaded: {len(package['feature_names'])} features")
            print(f"   🔧 Framework: {package['framework']}")
            
        except Exception as e:
            print(f"   ❌ Error loading {version}: {str(e)}")
    
    if models:
        # Сортируем версии
        sorted_versions = sorted(models.keys(), key=lambda x: int(x.replace('v', '')))
        current_version = sorted_versions[-1]
        print(f"\n🎯 Current version: {current_version}")
        print(f"📚 Available: {', '.join(sorted_versions)}")
    
    return len(models) > 0


def _detect_framework(model) -> str:
    """Автоматически определяет фреймворк модели."""
    model_type = type(model).__name__
    model_module = type(model).__module__
    
    if 'catboost' in model_module.lower() or model_type.startswith('CatBoost'):
        return 'catboost'
    elif 'sklearn' in model_module.lower() or 'sklearn' in str(type(model)):
        return 'sklearn'
    elif 'xgboost' in model_module.lower() or model_type.startswith('XGB'):
        return 'xgboost'
    elif 'lightgbm' in model_module.lower() or model_type.startswith('LGBM'):
        return 'lightgbm'
    else:
        return 'unknown'


def get_model_package(version: Optional[str] = None) -> tuple:
    """Получить пакет модели по версии."""
    if not models:
        raise HTTPException(status_code=503, detail="No models loaded")
    
    if version is None:
        version = current_version
    
    if version not in models:
        available = list(models.keys())
        raise HTTPException(
            status_code=404, 
            detail=f"Version '{version}' not found. Available: {available}"
        )
    
    return models[version], version


def get_feature_importance(package: Dict) -> tuple:
    """Универсальное получение важности признаков."""
    model = package['model']
    feature_names = package['feature_names']
    framework = package.get('framework', 'unknown')
    
    try:
        if framework == 'catboost':
            importance = model.get_feature_importance()
            return feature_names, importance
        
        elif framework == 'sklearn':
            if hasattr(model, 'feature_importances_'):
                importance = model.feature_importances_
            elif hasattr(model, 'coef_'):
                importance = np.abs(model.coef_).flatten()
            else:
                importance = np.ones(len(feature_names))
            return feature_names, importance
        
        elif framework == 'xgboost':
            importance = model.feature_importances_
            return feature_names, importance
        
        elif framework == 'lightgbm':
            importance = model.feature_importances_
            return feature_names, importance
        
        else:
            # Равномерная важность для неизвестных
            return feature_names, np.ones(len(feature_names))
            
    except Exception as e:
        print(f"⚠️ Could not get feature importance: {e}")
        return feature_names, np.ones(len(feature_names))


def prepare_features(package: Dict, features_dict: Dict[str, Any]) -> pd.DataFrame:
    """Подготовка признаков."""
    all_features = package['feature_names']
    framework = package.get('framework', 'unknown')
    categorical_features = package.get('categorical_features', [])
    
    # Получаем важность и топ-10
    feature_names, importance = get_feature_importance(package)
    
    fi_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importance
    }).sort_values('importance', ascending=False)
    
    top10_features = fi_df.head(10)['feature'].tolist()
    
    # Создаем дефолтные значения для НЕ топ-10
    default_values = {}
    for feature in all_features:
        if feature not in top10_features:
            default_values[feature] = _get_default_value(feature)
    
    # Заполняем признаки
    full_features = default_values.copy()
    for key, value in features_dict.items():
        if key in top10_features:
            full_features[key] = value
    
    # Проверяем наличие всех топ-10
    missing = [f for f in top10_features if f not in features_dict]
    if missing:
        raise ValueError(f"Missing required features: {missing}")
    
    # Создаем DataFrame
    df = pd.DataFrame([full_features])
    
    # Обработка категориальных
    for cat_feat in categorical_features:
        if cat_feat in df.columns:
            if framework == 'catboost':
                df[cat_feat] = df[cat_feat].astype(str)
            else:
                df[cat_feat] = pd.Categorical(df[cat_feat]).codes
    
    # Числовые признаки
    numeric_features = [f for f in all_features if f not in categorical_features]
    for num_feat in numeric_features:
        if num_feat in df.columns:
            df[num_feat] = pd.to_numeric(df[num_feat], errors='coerce').fillna(0)
    
    # Правильный порядок
    return df[all_features]


def _get_default_value(feature_name: str) -> Any:
    """Дефолтные значения для признаков."""
    feature_lower = feature_name.lower()
    
    if '0/1' in feature_name or any(x in feature_lower for x in ['наличие', 'гипертония', 'диабет']):
        return 0
    
    if any(x in feature_lower for x in ['категория', 'стадия', 'фк', 'группа']):
        return 1
    
    if 'hb' in feature_lower or 'гемоглобин' in feature_lower:
        return 120.0
    
    if 'возраст' in feature_lower:
        return 60
    
    if 'креатинин' in feature_lower:
        return 80.0
    
    if 'мочевина' in feature_lower:
        return 5.0
    
    if 'k+' in feature_lower or 'калий' in feature_lower:
        return 4.0
    
    if 'na+' in feature_lower or 'натрий' in feature_lower:
        return 140.0
    
    if 'глюкоза' in feature_lower:
        return 5.5
    
    return 0.0


# FastAPI приложение
app = FastAPI(title="ML Service", version="1.4.0")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting ML Service...")
    load_all_models()
    yield
    print("👋 Shutting down...")


app.router.lifespan_context = lifespan


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": len(models),
        "current_version": current_version,
        "available_versions": list(models.keys())
    }


@app.get("/models/versions")
async def list_versions():
    """Список версий (информация берется из пакетов в памяти)."""
    versions_info = {}
    
    for version, package in models.items():
        versions_info[version] = {
            "is_current": version == current_version,
            "features_count": len(package['feature_names']),
            "framework": package.get('framework', 'unknown'),
            "model_type": type(package['model']).__name__,
            "loaded_at": package.get('_loaded_at'),
            "file_size_mb": package.get('_file_size_mb')
        }
    
    return {
        "current_version": current_version,
        "versions": versions_info
    }


@app.get("/model/info")
async def model_info(version: Optional[str] = None):
    """Информация о модели."""
    package, actual_version = get_model_package(version)
    
    feature_names, importance = get_feature_importance(package)
    
    fi_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importance
    }).sort_values('importance', ascending=False)
    
    top10_features = fi_df.head(10)['feature'].tolist()
    
    return {
        "version": actual_version,
        "is_current": actual_version == current_version,
        "framework": package.get('framework', 'unknown'),
        "model_type": type(package['model']).__name__,
        "total_features": len(feature_names),
        "required_features": top10_features,
        "categorical_features": package.get('categorical_features', []),
        "loaded_at": package.get('_loaded_at'),
        "file_path": package.get('_file_path')
    }


class PredictRequest(BaseModel):
    features: Dict[str, Any]
    version: Optional[str] = None


@app.post("/predict")
async def predict(request: PredictRequest):
    """Предсказание."""
    if not models:
        raise HTTPException(status_code=503, detail="No models loaded")
    
    try:
        package, version = get_model_package(request.version)
        model = package['model']
        framework = package.get('framework', 'unknown')
        
        # Подготовка признаков
        features_df = prepare_features(package, request.features)
        
        # Предсказание
        if framework == 'catboost':
            proba = model.predict_proba(features_df)
        elif framework == 'sklearn':
            proba = model.predict_proba(features_df) if hasattr(model, 'predict_proba') else model.predict(features_df)
        else:
            proba = model.predict_proba(features_df) if hasattr(model, 'predict_proba') else model.predict(features_df)
        
        # Извлечение вероятности
        if isinstance(proba, np.ndarray):
            risk_score = float(proba[0][1]) if proba.ndim == 2 and proba.shape[1] > 1 else float(proba[0])
        else:
            risk_score = float(proba)
        
        if risk_score > 1:
            risk_score = min(risk_score / 100, 1.0)
        
        risk_level = "low" if risk_score < 0.3 else "medium" if risk_score < 0.7 else "high"
        
        return {
            "version": version,
            "framework": framework,
            "risk_score": round(risk_score, 4),
            "risk_percent": round(risk_score * 100, 1),
            "risk_level": risk_level
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/models/reload")
async def reload_models():
    """Перезагрузить все модели из файлов."""
    global models, current_version
    
    models.clear()
    success = load_all_models()
    
    if success:
        return {
            "status": "reloaded",
            "models_loaded": len(models),
            "current_version": current_version
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to reload models")

@app.post("/models/set_version")
async def set_version(version: str):
    """Устанавливает текущую версию и возвращает топ-10 признаков."""
    global current_version
    
    if version not in models:
        raise HTTPException(status_code=404, detail=f"Version '{version}' not found")
    
    current_version = version
    package = models[version]
    model = package['model']
    feature_names = package['feature_names']
    
    # Получаем важность признаков (универсально)
    if hasattr(model, 'get_feature_importance'):
        # CatBoost
        importance = model.get_feature_importance()
    elif hasattr(model, 'feature_importances_'):
        # sklearn, XGBoost, LightGBM
        importance = model.feature_importances_
    elif hasattr(model, 'coef_'):
        # Линейные модели sklearn
        importance = np.abs(model.coef_).flatten()
    else:
        # Fallback - равномерная важность
        importance = np.ones(len(feature_names))
    
    # Топ-10 признаков
    fi_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importance
    }).sort_values('importance', ascending=False)
    
    top10_features = fi_df.head(10)['feature'].tolist()
    
    return {
        "version": current_version,
        "required_features": top10_features
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007)