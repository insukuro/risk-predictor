"""Работа с важностью признаков."""
from typing import Dict, Tuple
import numpy as np
import pandas as pd

def get_feature_importance(package: Dict) -> Tuple[np.ndarray, np.ndarray]:
    """Универсальное получение важности признаков."""
    model = package['model']
    feature_names = package['feature_names']
    framework = package.get('framework', 'unknown')
    
    try:
        if framework == 'catboost':
            importance = model.get_feature_importance()
        
        elif framework == 'sklearn':
            if hasattr(model, 'feature_importances_'):
                importance = model.feature_importances_
            elif hasattr(model, 'coef_'):
                importance = np.abs(model.coef_).flatten()
            else:
                importance = np.ones(len(feature_names))
        
        elif framework in ['xgboost', 'lightgbm']:
            importance = model.feature_importances_
        
        else:
            importance = np.ones(len(feature_names))
        
        return feature_names, importance
        
    except Exception as e:
        print(f"⚠️ Could not get feature importance: {e}")
        return feature_names, np.ones(len(feature_names))

def get_top_features(package: Dict, top_n: int = 10) -> list:
    """Возвращает топ-N наиболее важных признаков."""
    feature_names, importance = get_feature_importance(package)
    
    fi_df = pd.DataFrame({
        'feature': feature_names,
        'importance': importance
    }).sort_values('importance', ascending=False)
    
    return fi_df.head(top_n)['feature'].tolist()
