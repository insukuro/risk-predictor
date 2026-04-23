#!/bin/bash
set -e

echo "Waiting for database..."
until pg_isready -h risk-db -U ${POSTGRES_USER} -d ${POSTGRES_DB}; do
    sleep 2
done

echo "✅ Database is ready!"

# Создаем таблицы через SQLAlchemy (если их нет)
echo "Creating tables from models..."
python -c "
from backend.db.session import engine
from backend.db.models import Base
Base.metadata.create_all(bind=engine)
print('✅ Tables created (if not exist)')
"

# Теперь накатываем миграции (они уже ничего не изменят, но отметят версию)
echo "Running Alembic migrations..."
alembic stamp head
echo "✅ Database version stamped"

echo "Starting application..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4