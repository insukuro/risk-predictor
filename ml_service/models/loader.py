from pathlib import Path
from datetime import datetime
import joblib
from typing import Dict, Any

def detect_framework(model) -> str:
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

def validate_model_package(package: dict) -> bool:
    """Валидирует структуру пакета модели с поддержкой обратной совместимости."""
    if not isinstance(package, dict):
        print(" ❌ Invalid package format")
        return False
    
    if 'feature_names' not in package:
        print(" ❌ No 'feature_names' in package")
        return False

    # Проверка на старый формат (одна модель) или новый (ансамбль)
    has_single_model = 'model' in package
    has_ensemble = 'models_ik' in package and 'models_offpump' in package
    
    if not (has_single_model or has_ensemble):
        print(" ❌ Package must contain either 'model' or ('models_ik' and 'models_offpump')")
        return False
        
    return True

def load_model_from_file(file_path: Path) -> tuple:
    """Загружает модель или ансамбль из файла."""
    version = file_path.stem.replace("model_", "")
    try:
        print(f"📦 Loading model {version}...")
        package = joblib.load(file_path)
        if 'feature_names' not in package and 'features_list' in package:
            package['feature_names'] = package['features_list']
        if 'categorical_features' not in package and 'categorical_cols' in package:
            package['categorical_features'] = package['categorical_cols']
        if not validate_model_package(package):
            return None, None
        package['version'] = version
        # Определяем фреймворк для одиночной модели
        if 'model' in package and 'framework' not in package:
            package['framework'] = detect_framework(package['model'])
        
        # Флаг ансамбля
        package['is_ensemble'] = 'models_ik' in package

        # Добавляем runtime-информацию
        package['_loaded_at'] = datetime.now().isoformat()
        package['_file_path'] = str(file_path)
        package['_file_size_mb'] = round(file_path.stat().st_size / 1024 / 1024, 2)
        
        print(f" ✅ Loaded: {len(package['feature_names'])} features. Ensemble: {package['is_ensemble']}")
        if 'demo_data' in package:
            print(f" 🎯 Demo data attached")
            
        return version, package
    except Exception as e:
        print(f" ❌ Error loading {version}: {str(e)}")
        return None, None