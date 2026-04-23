# Build stage
FROM python:3.12-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements/ ./requirements/

# Install dependencies
RUN pip install --no-cache-dir -r requirements/backend.txt

# Runtime stage
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/usr/local/bin:$PATH"

WORKDIR /app

# Install runtime dependencies including curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Create entrypoint script with proper error handling
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "========================================="\n\
echo "Starting Risk Predictor Backend"\n\
echo "========================================="\n\
echo "Environment: $ENVIRONMENT"\n\
echo "Database URL: ${DATABASE_URL//:([^:@]+)@/:****@}"\n\
echo "ML Service URL: $ML_SERVICE_URL"\n\
echo "========================================="\n\
\n\
echo "Waiting for database to be ready..."\n\
for i in {1..30}; do\n\
    if pg_isready -h risk-db -U ${POSTGRES_USER} -d ${POSTGRES_DB} -t 1 > /dev/null 2>&1; then\n\
        echo "✅ Database is ready!"\n\
        break\n\
    fi\n\
    echo "⏳ Waiting for database... ($i/30)"\n\
    sleep 2\n\
done\n\
\n\
echo "Running Alembic migrations..."\n\
if alembic upgrade head; then\n\
    echo "✅ Migrations completed successfully"\n\
else\n\
    echo "❌ Migration failed!"\n\
    exit 1\n\
fi\n\
\n\
echo "Current Alembic version:"\n\
alembic current\n\
\n\
echo "Starting FastAPI application..."\n\
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Healthcheck using curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]