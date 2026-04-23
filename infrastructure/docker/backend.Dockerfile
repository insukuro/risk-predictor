# Build stage
FROM python:3.12-slim as builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements/ ./requirements/
RUN pip install --no-cache-dir --prefix=/install -r requirements/backend.txt

# Runtime stage
FROM python:3.12-slim
WORKDIR /app

# Устанавливаем только нужные runtime-зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client curl libpq5 && rm -rf /var/lib/apt/lists/*

# Копируем зависимости из builder
COPY --from=builder /install /usr/local
COPY . .

# Копируем entrypoint и даем права
COPY infrastructure/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Настройка PYTHONPATH важна для твоего env.py
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]