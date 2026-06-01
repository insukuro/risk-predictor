---
sidebar_position: 4
---

# Описание сервисов

Система состоит из пяти контейнеризированных сервисов, каждый из которых решает свою задачу и взаимодействует с другими по HTTP (REST).

---

## Backend (API Gateway)

| Характеристика | Значение |
|---------------|----------|
| Контейнер | `risk-predictor-backend` |
| Порт | `8000` |
| Фреймворк | FastAPI 0.109 |
| Dockerfile | `infrastructure/docker/backend.Dockerfile` |

**Зона ответственности:**

- **Оркестрация** — принимает запросы от фронтенда и внешних систем, маршрутизирует их между ML-сервисом и калькулятором
- **Валидация** — проверяет входные данные через Pydantic-схемы
- **Сохранение** — пишет предикты и клинические данные в PostgreSQL через SQLAlchemy
- **Кэширование** — кэширует UI-схему и результаты предсказаний
- **Background-задачи** — поддерживает асинхронные расчёты с поллингом статуса

**Структура:**
```
backend/
├── api/
│ ├── dependencies/ # Зависимости (auth)
│ └── routes/ # Роуты: health, patients, operations, predictions
├── clients/
│ └── ml_client.py # HTTP-клиент к ML и Calc сервисам
├── core/
│ ├── config.py # Настройки из .env
│ └── metadata.py # Мэппинги полей, метаданные форм
├── db/
│ ├── models.py # SQLAlchemy-модели
│ └── session.py # Сессия БД
├── models/
│ └── schemas.py # Pydantic-схемы
├── services/
│ ├── cache_service.py # In-memory кэш
│ ├── prediction_service.py # Оркестратор предиктов
│ ├── patient_service.py # CRUD пациентов
│ └── operation_service.py # CRUD операций
└── main.py # Точка входа
```

---

## Calc Service (Калькулятор шкал)

| Характеристика | Значение |
|---------------|----------|
| Контейнер | `risk-predictor-calc` |
| Порт | `8005` |
| Фреймворк | FastAPI 0.109 |
| Dockerfile | `infrastructure/docker/calc_service.Dockerfile` |

**Зона ответственности:**

- **Расчёт клинических шкал** — EuroSCORE II (кардиохирургический риск), CCI (индекс коморбидности)
- **Метаданные** — предоставляет информацию о требуемых полях и формулах
- **Независимость** — не имеет доступа к БД, работает только с переданными данными

**Структура:**
```
calc_service/
├── app/
│ ├── api_endpoints.py # REST API для расчётов
│ ├── engine.py # Ядро калькулятора
│ ├── schemas.py # Pydantic-схемы
│ └── ui_endpoints.py # Эндпоинты для UI (metadata)
├── coefficients.json # Коэффициенты для формул
├── config.py
└── main.py
```
---

## ML Service (Инференс моделей)

| Характеристика | Значение |
|---------------|----------|
| Контейнер | `risk-predictor-ml` |
| Порт | `8001` |
| Фреймворк | FastAPI 0.109 |
| Dockerfile | `infrastructure/docker/ml_service.Dockerfile` |

**Зона ответственности:**

- **Инференс** — прогон данных через ML-модели (CatBoost, TabNet)
- **Загрузка моделей** — хранение и переключение версий моделей
- **Feature importance** — предоставляет информацию о значимости признаков
- **Reload на лету** — эндпоинт `/models/reload` для обновления модели без остановки сервиса

**Структура:**
```
ml_service/
├── api/
│ └── routes.py # Эндпоинты: predict, model_info, reload
├── features/
│ ├── importance.py # Feature importance
│ └── preparation.py # Предобработка признаков
├── models/
│ ├── loader.py # Загрузка моделей из файлов
│ ├── predictor.py # Предикт
│ └── registry.py # Реестр версий моделей
├── model_versions/ # Файлы моделей (.pkl)
├── schemas/
│ └── requests.py # Pydantic-схемы запросов
├── utils/
│ └── helpers.py
├── config.py
├── constants.py
└── main.py
```
---

## Frontend (React SPA)

| Характеристика | Значение |
|---------------|----------|
| Контейнер | `risk-predictor-frontend` |
| Порт | `80` |
| Стек | React + TypeScript + Vite |
| Dockerfile | `infrastructure/docker/frontend.Dockerfile` |

**Зона ответственности:**

- **Формы ввода** — динамическая генерация полей на основе UI-схемы от backend
- **Отображение результатов** — визуализация рисков, графики, цветовая индикация
- **Демо-режим** — работа с предзаполненными данными
- **Загрузка моделей** — интерфейс для drag-and-drop загрузки новых ML-моделей

---

## PostgreSQL

| Характеристика | Значение |
|---------------|----------|
| Контейнер | `risk-predictor-db` |
| Порт | `5432` |
| Версия | 16 Alpine |
| Dockerfile | `infrastructure/docker/database.Dockerfile` |

**Зона ответственности:**

- Хранение пациентов, операций, клинических данных и предиктов
- Инициализация через `init-db.sql` при первом запуске

**Основные таблицы:**
- `patients` — демография
- `operations` — типы и даты операций
- `clinical_data` — клинические показатели (JSON)
- `predictions` — результаты прогнозов

---

## Nginx (в составе Frontend)

| Характеристика | Значение |
|---------------|----------|
| Контейнер | `risk-predictor-frontend` |
| Конфигурация | `infrastructure/nginx/default.conf` |

**Правила проксирования:**

| Путь | Назначение |
|------|------------|
| `/*` | Статика React SPA |
| `/api/*` → `/*` | Backend API |
| `/calc/*` → `/*` | Calc Service |
| `/health`, `/docs` | Backend (системные эндпоинты) |

---

## Потоки данных

### UI-предикт (врач через интерфейс)
Frontend → Backend (/predictions/ui/predict)
→ Backend проверяет операцию в БД
→ Backend создаёт background-задачу
→ PredictionService:
→ Calc Service (рассчитать EuroSCORE, CCI)
→ ML Service (получить прогноз)
→ Сохраняет ClinicalData + Prediction в БД
→ Фронтенд опрашивает `/ui/status/{task_id}`
→ Результат отображается


### API-предикт (внешняя интеграция)
Внешняя система → Backend (/predictions/predict)
→ PredictionService:
→ Calc Service (метрики)
→ ML Service (прогноз)
→ Синхронный ответ (без сохранения в БД)


### Демо-режим
Frontend → Backend (/predictions/ui/demo-data)
→ Backend → ML Service (сырые демо-данные)
→ Backend фильтрует по UI-схеме
→ Отдаёт очищенные данные

