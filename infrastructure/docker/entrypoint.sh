#!/bin/bash
set -e

echo "Waiting for database to be ready..."
until pg_isready -h risk-db -U ${POSTGRES_USER} -d ${POSTGRES_DB}; do
  echo "⏳ Waiting for database..."
  sleep 2
done

echo "✅ Database is ready!"

echo "Running Alembic migrations..."
# Важно: Alembic будет брать DATABASE_URL из окружения, если настроен env.py
alembic upgrade head

echo "Starting FastAPI application..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 2