from fastapi import FastAPI
from .app.api_endpoints import router as api_router
from .app.ui_endpoints import router as ui_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Clinical Calculator Platform", 
    version="2.0.0",
    description="Разделение на UI и API уровни. Поддержка цветовой индикации рисков.",
    root_path="/api/calc"  # <-- Добавлено для корректной работы Swagger за Nginx
)

# Подключение модулей
app.include_router(api_router)
app.include_router(ui_router)

# Рекомендуется добавить ваш продакшн-домен в CORS на случай кросс-доменных запросов
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://cabg.insukuro.ru"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8005, reload=True)