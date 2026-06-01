---
sidebar_position: 8
---

# CI/CD (GitHub Actions)

Деплой разделён на пять независимых воркфлоу. Каждый срабатывает только при изменении своего сегмента кода.

## Общая логика

- **Триггер:** пуш в `main` при изменении файлов в определённых директориях
- **Стоп-кран:** `cancel-in-progress` для группы — новый пуш отменяет предыдущий деплой того же сервиса
- **Деплой:** `appleboy/ssh-action` выполняет команды на VPS

---

## Воркфлоу 1: Backend API
**Триггер:** изменения в `backend/**`, `alembic/**`, `requirements/backend.txt`, `infrastructure/docker/backend.Dockerfile`
```yaml
steps:
  - git pull origin main
  - docker compose build risk-backend
  - docker compose up -d --no-deps risk-backend
```
Пересобирается только backend-контейнер, остальные не трогаются.

## Воркфлоу 2: Calc Service
**Триггер**: изменения в calc_service/**, requirements/calc.txt, infrastructure/docker/calc_service.Dockerfile
```yaml
steps:
  - git pull origin main
  - docker compose build risk-calc
  - docker compose up -d --no-deps risk-calc
```

## Воркфлоу 3: ML Service (код)
**Триггер**: изменения в ml_service/** (кроме model_versions/), requirements/ml.txt, infrastructure/docker/ml_service.Dockerfile
```yaml
steps:
  - git pull origin main
  - docker compose build risk-ml
  - docker compose up -d --no-deps risk-ml
```

**Важно**: файлы моделей (model_versions/**) исключены из этого триггера — для них отдельный воркфлоу.
## Воркфлоу 4: ML Models (файлы моделей)
**Триггер**: изменения в ml_service/model_versions/**
```yaml
steps:
  - git pull origin main
  - docker compose restart risk-ml
  - docker exec risk-predictor-ml curl -X POST http://localhost:8001/models/reload
  - docker compose restart risk-backend
```
- Перезапускает ML-сервис, принудительно дёргает /models/reload, затем перезапускает бэкенд для сброса кэша UI-схемы.

## Воркфлоу 5: Frontend
**Триггер**: изменения в frontend/**, infrastructure/docker/frontend.Dockerfile
```yaml
steps:
  # Сборка на GitHub
  - npm ci && npm run build
  # Артефакт
  - upload-artifact: frontend/dist/
  # Копирование на VPS
  - scp: frontend/dist/ + Dockerfile + nginx config
  # Пересборка и перезапуск
  - docker compose build risk-frontend
  - docker compose up -d --no-deps risk-frontend
```
- Сборка фронтенда выполняется на раннере GitHub. На VPS копируется уже собранный dist/.

# Секреты репозитория
| Переменная | Назначение |
|---|---|
| `VPS_HOST` | IP-адрес сервера |
| `VPS_USER` | Пользователь для SSH |
| `VPS_SSH_KEY` | Приватный SSH-ключ |
| `VPS_PORT` | Порт SSH |
| `VPS_PROJECT_PATH` | Путь к проекту на сервере |

# Concurrency
Каждый воркфлоу использует concurrency.group — новый пуш в ту же ветку отменяет предыдущий запуск того же воркфлоу. Это исключает гонку деплоев.