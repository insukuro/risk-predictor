---
sidebar_position: 1
---

# Локальная разработка

## Быстрый старт

```bash
# 1. Клонируем репозиторий
git clone https://github.com/Kilisaki/risk-predictor
cd risk-predictor

# 2. Создаём .env из примера
cp .env.example .env
nano .env  # указать пароль к БД

# 3. Создаём Docker-сеть
docker network create docker_web-network

# 4. Запускаем в dev-режиме
docker compose -f docker-compose.yml -f dev.docker-compose.yml up -d

# 5. Проверяем
curl http://localhost:8000/health
```

## Особенности dev-режима

Для локальной разработки используется override-файл `dev.docker-compose.yml`, который добавляет hot-reload и проброс портов на хост-машину.

## Доступные порты

| Сервис | Порт на хосте | Назначение |
|---------|--------------|------------|
| Backend API | 8000 | Основной API + Swagger `/docs` |
| ML Service | 8001 | Инференс моделей + health |
| Calc Service | 8005 | Калькуляторы шкал |
| PostgreSQL | 5432 | Прямое подключение к БД |
| Frontend | 80 | Через Nginx |

## Hot-reload

| Сервис | Hot-reload | Что мониторится |
|---------|-----------|----------------|
| risk-backend | ✅ | `./backend/` — все Python-файлы |
| risk-calc | ✅ | `./calc_service/` — все Python-файлы |
| risk-ml | ✅ | `./ml_service/` — все Python-файлы |

Изменения в коде подхватываются автоматически, перезапуск контейнеров не требуется.

## Монтируемые директории

| Сервис | Что монтируется |
|---------|----------------|
| risk-backend | `./backend/`, `./alembic/`, `./alembic.ini`, `./requirements/` |
| risk-calc | `./calc_service/` |
| risk-ml | `./ml_service/`, `./ml_service/model_versions/` |

## Порядок запуска при старте

При запуске dev-режима backend-контейнер выполняет:

1. **Ожидание БД** — проверка через `pg_isready`.
2. **Создание таблиц** — `Base.metadata.create_all()` из SQLAlchemy-моделей (если таблиц ещё нет).
3. **Миграции** — `alembic upgrade head` + `alembic stamp head`.
4. **Запуск uvicorn** — с флагами `--reload` и `--reload-dir /app/backend`.

## Переменные для dev-режима

```ini
# Форсируем перезагрузку при изменениях
WATCHFILES_FORCE_POLLING=true

# Подробное логирование
LOG_LEVEL=debug

# Отключаем кэширование байткода
PYTHONDONTWRITEBYTECODE=1
PYTHONUNBUFFERED=1
```

## Подключение к БД напрямую

Порт `5432` проброшен на хост. Можно подключиться любым клиентом:

```bash
psql -h localhost -p 5432 -U risk_prod_user -d risk_predictor_db
```

## Частые проблемы

### Ошибка `network not found`

```bash
docker network create docker_web-network
```

### Не подхватываются изменения

Проверить, что в `.env` установлено:

```ini
WATCHFILES_FORCE_POLLING=true
```

Пересоздать контейнеры:

```bash
docker compose -f docker-compose.yml -f dev.docker-compose.yml up -d --force-recreate
```

### Порт занят

```bash
# Посмотреть, что висит на порту
lsof -i :8000

# Остановить все контейнеры
docker compose -f docker-compose.yml -f dev.docker-compose.yml down
```