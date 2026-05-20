from fastapi import FastAPI
from .app.api_endpoints import router as api_router
from .app.ui_endpoints import router as ui_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Clinical Calculator Platform", 
    version="2.0.0",
    description="Разделение на UI и API уровни. Поддержка цветовой индикации рисков."
)


# Подключение модулей
app.include_router(api_router)
app.include_router(ui_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Точный origin фронтенда
    allow_credentials=True,
    allow_methods=["*"],  # Разрешить все методы (GET, POST, etc.)
    allow_headers=["*"],  # Разрешить все заголовки
)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8005, reload=True)