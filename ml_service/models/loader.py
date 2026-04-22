"""Загрузка моделей из файлов."""
from pathlib import Path
from datetime import datetime
import joblib
from typing import Dict

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
    """Валидирует структуру пакета модели."""
    if not isinstance(package, dict):
        print(f"   ❌ Invalid package format")
        return False
    
    if 'model' not in package:
        print(f"   ❌ No 'model' key in package")
        return False
    
    if 'feature_names' not in package:
        print(f"   ❌ No 'feature_names' in package")
        return False
    
    return True

def load_model_from_file(file_path: Path) -> tuple:
    """Загружает одну модель из файла."""
    version = file_path.stem.replace("model_", "")
    
    try:
        print(f"📦 Loading model {version}...")
        package = joblib.load(file_path)
        
        if not validate_model_package(package):
            return None, None
        
        # Определяем фреймворк если не указан
        if 'framework' not in package:
            package['framework'] = detect_framework(package['model'])
        
        # Добавляем runtime-информацию
        package['_loaded_at'] = datetime.now().isoformat()
        package['_file_path'] = str(file_path)
        package['_file_size_mb'] = round(file_path.stat().st_size / 1024 / 1024, 2)
        
        print(f"   ✅ Loaded: {len(package['feature_names'])} features")
        print(f"   🔧 Framework: {package['framework']}")
        
        return version, package
        
    except Exception as e:
        print(f"   ❌ Error loading {version}: {str(e)}")
        return None, None
