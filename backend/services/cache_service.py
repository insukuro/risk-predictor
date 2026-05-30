import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from collections import OrderedDict

from backend.core.config import CACHE_MAX_SIZE


class CacheService:
    """Простой in-memory кэш с TTL и LRU-вытеснением (для MVP без Redis)."""
    
    def __init__(self, max_size: int = CACHE_MAX_SIZE):
        self._store: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._max_size = max_size
    #
    def _make_key(self, prefix: str, data: Dict[str, Any]) -> str:
        raw = json.dumps(data, sort_keys=True, default=str)
        return f"{prefix}:{hashlib.md5(raw.encode()).hexdigest()}"
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        entry = self._store.get(key)
        if entry is None:
            return None
        if datetime.utcnow() > entry["expires_at"]:
            del self._store[key]
            return None
        # LRU: перемещаем в конец
        self._store.move_to_end(key)
        print("✅ Cache hit for key:", key)
        return entry["value"]
    
    def set(self, key: str, value: Dict[str, Any], ttl_seconds: int = 3600) -> None:
        # Если ключ уже есть — обновляем
        if key in self._store:
            del self._store[key]
        # Если кэш переполнен — удаляем самый старый
        while len(self._store) >= self._max_size:
            self._store.popitem(last=False)
        self._store[key] = {
            "value": value,
            "expires_at": datetime.utcnow() + timedelta(seconds=ttl_seconds)
        }
    
    def invalidate(self, key: str) -> None:
        if key in self._store:
            del self._store[key]
    
    def flush(self) -> None:
        self._store.clear()


# Глобальный экземпляр кэша
cache = CacheService()