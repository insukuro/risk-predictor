---
sidebar_position: 1
---

# Как добавить новую шкалу

Этот гайд проведёт вас через полный цикл добавления нового калькулятора клинической шкалы в Calc Service — от формулы до интерпретации результатов на фронтенде.

---

## Шаг 1: Добавить формулу расчёта в `ClinicalEngine`

Файл: `calc_service/app/engine.py`

Добавьте статический метод с формулой расчёта. Метод должен принимать объект `PatientData` и возвращать числовой результат.

```python
# calc_service/app/engine.py

@staticmethod
def calculate_grace_score(data: Any) -> int:
    """
    GRACE Score — риск внутригоспитальной смертности при ОКС.
    """
    score = 0
    
    age = getattr(data, "age", 60)
    heart_rate = getattr(data, "heart_rate", 75.0)
    systolic_bp = getattr(data, "systolic_bp", 120.0)
    creatinine = getattr(data, "creatinine", 85.0)
    
    # Возраст
    if age < 40: score += 0
    elif age < 50: score += 18
    elif age < 60: score += 36
    elif age < 70: score += 55
    elif age < 80: score += 73
    else: score += 91
    
    # ЧСС
    if heart_rate < 70: score += 0
    elif heart_rate < 90: score += 7
    elif heart_rate < 110: score += 13
    elif heart_rate < 150: score += 23
    else: score += 36
    
    # САД
    if systolic_bp < 80: score += 63
    elif systolic_bp < 100: score += 53
    elif systolic_bp < 120: score += 43
    elif systolic_bp < 140: score += 34
    elif systolic_bp < 160: score += 24
    else: score += 10
    
    # Креатинин (мкмоль/л → мг/дл)
    cr_mg_dl = creatinine / 88.4
    if cr_mg_dl < 0.8: score += 2
    elif cr_mg_dl < 1.2: score += 5
    elif cr_mg_dl < 1.6: score += 8
    elif cr_mg_dl < 2.0: score += 12
    else: score += 21
    
    # Killip class (если есть в модели)
    if getattr(data, "chsn", 0):  # ХСН как прокси
        score += 21
    
    return score 
```
## Шаг 2: Добавить пороги интерпретации в coefficients.json
Файл: calc_service/coefficients.json

Добавьте новый блок в секцию thresholds:
```json
{
  "thresholds": {
    "grace": [
      {"max": 108, "label": "Низкий риск (<1%)", "level": "low"},
      {"max": 140, "label": "Умеренный риск (1-3%)", "level": "medium"},
      {"max": 999, "label": "Высокий риск (>3%)", "level": "danger"}
    ]
  }
}
```

## Шаг 3: Добавить метод интерпретации
Файл: calc_service/app/engine.py

```python
@classmethod
def interpret_grace(cls, val: float) -> Dict[str, str]:
    return cls._get_status(val, "grace", "max")
```

## Шаг 4: Зарегистрировать калькулятор в CALCULATOR_MAPS
Файл: calc_service/app/ui_endpoints.py

Добавьте запись в словарь CALCULATOR_MAPS:

```python
CALCULATOR_MAPS = {
    # ... существующие калькуляторы ...
    
    "grace": {
        "label": "GRACE Score (ОКС)",
        "fields": [
            "age", "heart_rate", "systolic_bp", "creatinine", "chsn"
        ],
        "metric_keys": ["GRACE Score (Баллы)"]
    },
}
```

## Шаг 5: Добавить вычисление в /ui/calculate-all
В том же файле, в эндпоинте ui_calculate_all, добавьте вызов:

```python
grace = ClinicalEngine.calculate_grace_score(validated_data)

all_metrics = {
    # ... существующие метрики ...
    "GRACE Score (Баллы)": {
        "value": float(grace),
        **ClinicalEngine.interpret_grace(grace)
    },
}
```

## Шаг 6: Проверить метаданные полей
Убедитесь, что поля, которые нужны вашему калькулятору, уже описаны в FIELD_METADATA_BACKEND. Если какого-то поля нет — добавьте:

```python
FIELD_METADATA_BACKEND = {
    # ...
    'ЧСС (уд/мин)': {
        'label': 'ЧСС (уд/мин)',
        'group': 'Лабораторные показатели',
        'type': 'number',
        'min': 30,
        'max': 250
    },
}
```

## Шаг 7: Проверить, что поле есть в PatientData
Файл: calc_service/app/schemas.py

Если поле не описано в Pydantic-модели — добавьте:

```python
class PatientData(BaseModel):
    # ...
    heart_rate: Optional[float] = Field(default=75.0, alias="ЧСС (уд/мин)")
```

## Шаг 8: Протестировать локально
```bash
# Перезапустить calc-сервис
docker compose -f docker-compose.yml -f dev.docker-compose.yml restart risk-calc

# Проверить метаданные
curl http://localhost:8005/ui/metadata | jq '.calculators.grace'

# Проверить расчёт
curl -X POST http://localhost:8005/ui/calculate-all \
  -H "Content-Type: application/json" \
  -d '{
    "features": {
      "Возраст (лет)": 65,
      "ЧСС (уд/мин)": 95,
      "САД (мм рт.ст.)": 110,
      "Креатинин сыворотки (мкмоль/л)": 120,
      "Признаки ХСН (0/1)": 1
    },
    "calculator_id": "grace"
  }'
```

## Итог: что изменилось
| Файл | Что добавлено |
|------|---------------|
| `calc_service/app/engine.py` | `calculate_grace_score()` + `interpret_grace()` |
| `calc_service/coefficients.json` | Пороги `thresholds.grace` |
| `calc_service/app/ui_endpoints.py` | Запись в `CALCULATOR_MAPS` + вызов в `ui_calculate_all` |
| `calc_service/app/schemas.py` | Поля в `PatientData` (если нужно) |

После деплоя новая шкала автоматически появится в UI-схеме и будет доступна как через фронтенд, так и через API.