"""ML Microservice - Главный модуль сборки приложения."""
from contextlib import asynccontextmanager
from fastapi import FastAPI

from ml_service.config import config
from ml_service.models.registry import ModelRegistry
from ml_service.api.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом сервиса: ленивая инициализация реестра."""
    print("🚀 Starting ML Service...")
    
    # Создаем реестр и внедряем его в состояние приложения (state)
    registry = ModelRegistry(config.MODELS_DIR)
    registry.load_all()
    app.state.registry = registry
    
    yield
    print("👋 Shutting down ML Service...")


# Инициализация FastAPI приложения
app = FastAPI(
    title="Centralized ML Calculator API",
    version="1.5.0",
    lifespan=lifespan
)

# Подключаем роуты
app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.DEFAULT_PORT,
        reload=True
    )