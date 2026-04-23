FROM python:3.12-slim

WORKDIR /app

# Устанавливаем curl для healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Копируем requirements
COPY requirements/ ./requirements/
RUN pip install --no-cache-dir -r requirements/ml.txt

# Копируем код ML сервиса
COPY ml_service/ ./ml_service/

# Создаем директорию для моделей
RUN mkdir -p /app/ml_service/model_versions

# Устанавливаем PYTHONPATH
ENV PYTHONPATH=/app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "-m", "uvicorn", "ml_service.main:app", "--host", "0.0.0.0", "--port", "8001"]