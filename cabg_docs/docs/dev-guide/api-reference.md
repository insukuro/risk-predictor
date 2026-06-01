---
sidebar_position: 7
---

# Интерактивная документация

Каждый сервис предоставляет Swagger UI. Для детального изучения всех эндпоинтов,
схем запросов и ответов используйте:

| Сервис | Swagger |
|--------|---------|
| Backend API | `http://localhost:8000/docs` |
| Calc Service | `http://localhost:8005/docs` |
| ML Service | `http://localhost:8001/docs` |


# API Reference

## Backend (основной API)
## Health Check
### Запрос

```http
GET /health
```

### Ответ (200)

```json
{
  "status": "ok",
  "database": "connected",
  "model_service": "ready"
}
```

---

## Predictions — UI-слой (для фронтенда)

### Получить UI-схему

```http
GET /predictions/ui/schema?version=v3
```

Динамически формирует список полей для отрисовки формы. Учитывает зависимости от ML-сервиса и калькулятора.

### Ответ (200)

```json
{
  "available_versions": ["v1", "v2", "v3"],
  "current_version": "v3",
  "ui_schema": {
    "form_blocks": [
      {
        "block_name": "Общая информация",
        "fields": [
          {
            "id": "Возраст (лет)",
            "label": "Возраст (лет)",
            "type": "number",
            "order": 1,
            "min": 0,
            "max": 120
          }
        ]
      }
    ],
    "calculated_metrics_needed": ["euroscore", "cci"]
  }
}
```

### Запустить предсказание (UI)

```http
POST /predictions/ui/predict
Content-Type: application/json
```

```json
{
  "features": {
    "Возраст (лет)": 65,
    "Пол (0=жен,1=муж)": 1,
    "Вес (кг)": 80
  },
  "operation_id": null,
  "model_version": "v3"
}
```

#### Без `operation_id` — синхронный ответ

```json
{
  "status": "completed",
  "saved": false,
  "result": {
    "risk_score": 4.2,
    "risk_level": "medium",
    "targets": [...]
  }
}
```

#### С `operation_id` — фоновая задача

```json
{
  "task_id": "uuid-here",
  "status": "pending"
}
```

### Проверить статус задачи

```http
GET /predictions/ui/status/{task_id}
```

### Ответ

```json
{
  "status": "completed",
  "operation_id": 42,
  "result": {}
}
```

### История предсказаний

```http
GET /predictions/ui/history?patient_id=1&skip=0&limit=20
```

### Демо-данные

```http
GET /predictions/ui/demo-data?version=v3
```

Возвращает предзаполненные данные тяжёлого пациента, отфильтрованные по текущей UI-схеме.

---

## Predictions — API-слой (для внешних интеграций)

### Предсказание

```http
POST /predictions/predict
Content-Type: application/json
```

```json
{
  "features": {
    "Возраст (лет)": 65,
    "Пол (0=жен,1=муж)": 1,
    "Вес (кг)": 80
  },
  "model_version": "v3"
}
```

### Ответ (200)

```json
{
  "status": "success",
  "data": {
    "risk_score": 4.2,
    "risk_level": "medium",
    "targets": [
      {
        "name": "Общая летальность",
        "score": 4.2,
        "level": "medium"
      }
    ],
    "model_version": "v3"
  }
}
```

---

## Patients

| Метод  | Путь                               | Описание                |
| ------ | ---------------------------------- | ----------------------- |
| POST   | `/patients`                        | Создать пациента        |
| GET    | `/patients`                        | Список с фильтрами      |
| GET    | `/patients/{id}`                   | Получить пациента       |
| PUT    | `/patients/{id}`                   | Обновить пациента       |
| DELETE | `/patients/{id}`                   | Удалить пациента        |
| DELETE | `/patients/{id}/force`             | Принудительное удаление |
| GET    | `/patients/{id}/operations`        | Операции пациента       |
| GET    | `/patients/{id}/stats`             | Статистика пациента     |
| POST   | `/patients/{id}/merge/{target_id}` | Объединить пациентов    |

---

## Operations

| Метод  | Путь                             | Описание           |
| ------ | -------------------------------- | ------------------ |
| POST   | `/operations`                    | Создать операцию   |
| GET    | `/operations`                    | Список с фильтрами |
| GET    | `/operations/{id}`               | Получить операцию  |
| PUT    | `/operations/{id}`               | Обновить операцию  |
| DELETE | `/operations/{id}`               | Удалить операцию   |
| GET    | `/operations/{id}/clinical-data` | Клинические данные |
| GET    | `/operations/{id}/prediction`    | Последний предикт  |

---

## ML Service

Базовый URL: `http://risk-ml:8001`

| Метод | Путь                     | Описание                      |
| ----- | ------------------------ | ----------------------------- |
| GET   | `/health`                | Состояние и список версий     |
| GET   | `/models/versions`       | Метаданные всех версий        |
| GET   | `/model/info?version=v3` | Детальная информация о модели |
| GET   | `/model/demo?version=v3` | Демо-данные + предикт         |
| POST  | `/predict`               | Предсказание                  |
| POST  | `/models/reload`         | Перезагрузка моделей с диска  |
| POST  | `/models/set_version`    | Переключить активную версию   |

---

## Calc Service

Базовый URL: `http://risk-calc:8005`

### Чистый API (для машин)

| Метод | Путь                                 | Описание                         |
| ----- | ------------------------------------ | -------------------------------- |
| POST  | `/api/v1/calculate/bmi`              | ИМТ                              |
| POST  | `/api/v1/calculate/clcr`             | Клиренс креатинина               |
| POST  | `/api/v1/calculate/cci`              | Индекс Чарлсона                  |
| POST  | `/api/v1/calculate/euroscore`        | EuroSCORE II                     |
| POST  | `/api/v1/calculate/crusade`          | CRUSADE Bleeding                 |
| POST  | `/api/v1/calculate/caprini`          | Caprini VTE                      |
| POST  | `/api/v1/calculate/chads-vasc`       | CHA₂DS₂-VASc                     |
| POST  | `/api/v1/calculate/pre-deliric`      | PRE-DELIRIC                      |
| POST  | `/api/v1/calculate/cleveland-thakar` | Cleveland Clinic                 |
| POST  | `/api/v1/calculate/resp-failure`     | Риск дыхательной недостаточности |
| POST  | `/api/v1/calculate/nhsn-infection`   | NHSN Infection                   |

### UI-эндпоинты

| Метод | Путь                | Описание                                |
| ----- | ------------------- | --------------------------------------- |
| GET   | `/ui/metadata`      | Список калькуляторов, поля и метаданные |
| POST  | `/ui/calculate-all` | Рассчитать все шкалы разом              |
