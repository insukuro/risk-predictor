---
sidebar_position: 9
---

# Логирование

## Основной способ: Docker logs

Специализированная система логирования (ELK, Loki, CloudWatch) отсутствует. Все сервисы пишут в `stdout`/`stderr` — логи доступны через `docker compose logs`.

---

## Просмотр логов

```bash
# Все сервисы (follow)
docker compose logs -f

# Конкретный сервис
docker compose logs -f risk-backend
docker compose logs -f risk-ml
docker compose logs -f risk-calc
docker compose logs -f risk-db

# Последние 100 строк
docker compose logs --tail=100 risk-backend

# С временными метками
docker compose logs -f --timestamps risk-backend
```

## Уровни логирования

| Сервис | Уровень | Как изменить |
|---|---|---|
| Backend | `debug` (dev) / `info` (prod) | Переменная `LOG_LEVEL` в `.env` |
| ML Service | Стандартный uvicorn | Флаг `--log-level` в `CMD` Dockerfile |
| Calc Service | Стандартный uvicorn | Флаг `--log-level` в `CMD` Dockerfile |
| Nginx | `access_log` + `error_log` | Конфиг `infrastructure/nginx/default.conf` |

## Куда смотреть при проблемах

| Симптом | Куда смотреть |
|---|---|
| Не запускается сервис | `docker compose logs risk-backend` |
| Ошибка БД | `docker compose logs risk-db` |
| Модель не грузится | `docker compose logs risk-ml` |
| Ошибка расчёта шкал | `docker compose logs risk-calc` |
| 502 / 504 на фронте | `docker compose logs risk-frontend` (Nginx) |
| Медленные запросы | Uvicorn-логи backend — там время обработки |

## Пример вывода
risk-predictor-backend | Health Check - DB: connected, ML Service: ready
risk-predictor-backend | INFO:     172.18.0.5:45786 - "GET /health HTTP/1.1" 200 OK
risk-predictor-ml      | [Registry] Loaded 3 model versions: v1, v2, v3
risk-predictor-ml      | [Registry] Current version set to: v3
risk-predictor-calc    | INFO:     Started server process [1]

# Что логируется?
- Backend: health-чеки (статус БД и ML), входящие запросы, время ответа, ошибки валидации
- ML Service: загрузка версий моделей, /reload, ошибки предикта
- Calc Service: запросы на расчёт, ошибки нормализации данных
- Nginx: коды ответа, время обработки, upstream-ошибки