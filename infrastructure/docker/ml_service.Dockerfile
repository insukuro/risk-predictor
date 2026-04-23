# ml_service.Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Копируем requirements
COPY requirements/ ./requirements/
RUN pip install --no-cache-dir -r requirements/ml.txt

# Копируем код
COPY ml_service/ ./ml_service/

# ВАЖНО: Добавляем __init__.py если нет
RUN touch ml_service/__init__.py

# Устанавливаем PYTHONPATH
ENV PYTHONPATH=/app

EXPOSE 8001

CMD ["python", "-m", "uvicorn", "ml_service.main:app", "--host", "0.0.0.0", "--port", "8001"]