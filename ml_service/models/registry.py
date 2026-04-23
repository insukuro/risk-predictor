"""Реестр для управления версиями моделей."""
from typing import Dict, Optional, Tuple
from pathlib import Path
from fastapi import HTTPException
from ml_service.models.loader import load_model_from_file


class ModelRegistry:
    """Хранилище всех версий моделей."""
    
    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self._models: Dict[str, dict] = {}
        self._current_version: Optional[str] = None
    
    @property
    def current_version(self) -> Optional[str]:
        return self._current_version
    
    @property
    def models(self) -> Dict[str, dict]:
        return self._models
    
    def load_all(self) -> bool:
        """Загружает все модели из директории."""
        if not self.models_dir.exists():
            print(f"⚠️ Models directory not found: {self.models_dir}")
            return False
        
        model_files = sorted(self.models_dir.glob("model_v*.pkl"))
        
        if not model_files:
            print(f"⚠️ No model files found in {self.models_dir}")
            return False
        
        for model_file in model_files:
            version, package = load_model_from_file(model_file)
            if version and package:
                self._models[version] = package
        
        if self._models:
            sorted_versions = sorted(self._models.keys(), key=lambda x: int(x.replace('v', '')))
            self._current_version = sorted_versions[-1]
            print(f"\n🎯 Current version: {self._current_version}")
            print(f"📚 Available: {', '.join(sorted_versions)}")
        
        return len(self._models) > 0
    
    def get_package(self, version: Optional[str] = None) -> Tuple[dict, str]:
        """Получает пакет модели по версии."""
        if not self._models:
            raise HTTPException(status_code=503, detail="No models loaded")
        
        if version is None:
            version = self._current_version
        
        if version not in self._models:
            available = list(self._models.keys())
            raise HTTPException(
                status_code=404, 
                detail=f"Version '{version}' not found. Available: {available}"
            )
        
        return self._models[version], version
    
    def set_version(self, version: str) -> bool:
        """Устанавливает текущую версию."""
        if version not in self._models:
            return False
        self._current_version = version
        return True
    
    def clear(self):
        """Очищает реестр."""
        self._models.clear()
        self._current_version = None
