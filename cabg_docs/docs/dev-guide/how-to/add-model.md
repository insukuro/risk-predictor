---
sidebar_position: 2
---

# Как обучить и задеплоить новую модель

Полный путь от Jupyter-ноутбука до продакшена с автоматической перезагрузкой модели без остановки сервиса.

---

## Шаг 1: Обучение в ноутбуке

Обучите модель для каждого целевого осложнения. Одна модель = один бинарный классификатор.

```python
import pickle
from catboost import CatBoostClassifier

# Для каждого осложнения обучаем отдельную модель
models = {}
results = []

for target in target_columns:
    X_train, X_test, y_train, y_test = train_test_split(...)
    
    model = CatBoostClassifier(
        iterations=500,
        depth=6,
        learning_rate=0.05,
        verbose=False
    )
    model.fit(X_train, y_train)
    
    # Оцениваем качество
    y_pred = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred)
    
    models[target] = model
    results.append({
        'Осложнение': target,
        'ROC-AUC на тесте': auc
    })
```

## Шаг 2: Фильтрация моделей
Оставляем только модели с AUC выше порога:

```python
MIN_ROC_AUC = 0.47

def filter_good_models(results, models_dict):
    good_models = {}
    for row in results:
        if row['ROC-AUC на тесте'] >= MIN_ROC_AUC:
            good_models[row['Осложнение']] = models_dict[row['Осложнение']]
            print(f"✅ {row['Осложнение']}: {row['ROC-AUC на тесте']:.3f}")
        else:
            print(f"❌ {row['Осложнение']}: {row['ROC-AUC на тесте']:.3f}")
    return good_models

final_models = filter_good_models(results, models)
```

## Шаг 3: Создание демо-данных
Создайте реалистичный кейс тяжёлого пациента для тестирования UI:

```python
demo_data = {
    'Пол (0=жен,1=муж)': 1,
    'Возраст (лет)': 78,
    'Рост (м)': 1.72,
    'Вес (кг)': 105.0,
    'Срочность (0=план,1=экстр)': 1,
    'Сахарный диабет (0/1)': 1,
    'ХОБЛ (0/1)': 1,
    'ХБП': 3,
    'EuroSCORE II (%)': 18.4,
    # ... все фичи из X.columns ...
}
```

## Шаг 4: Упаковка и сохранение
```python
production_package = {
    'features_list': list(X.columns),
    'categorical_cols': cat_cols,
    'models': final_models,
    'demo_data': demo_data
}

# Нейминг: инкрементируем версию
file_name = 'model_v4.pkl'

with open(file_name, 'wb') as f:
    pickle.dump(production_package, f)

print(f"🚀 Готово: {file_name}")
```

### Соглашение об именовании:
| Файл | Версия |
|------|--------|
| `model_v1.pkl` | Базовая |
| `model_v2.pkl` | С новыми фичами |
| `model_v3.pkl` | Текущая |
| `model_v4.pkl` | Новая |

## Шаг 5: Добавить файл в репозиторий
```bash
# Копируем в папку с моделями
cp model_v4.pkl ml_service/model_versions/

# Коммитим и пушим
git add ml_service/model_versions/model_v4.pkl
git commit -m "feat: add model v4 with improved AUC"
git push origin main
```

## Шаг 6: Автоматический деплой через CI/CD
При пуше в ml_service/model_versions/** на ветке main срабатывает GitHub Actions:
```yml
name: Deploy ML Models

on:
  push:
    paths:
      - 'ml_service/model_versions/**'
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy models and reload
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            cd ${{ secrets.VPS_PROJECT_PATH }}
            git pull origin main
            docker compose restart risk-ml
            sleep 5
            docker exec risk-predictor-ml curl -X POST http://localhost:8001/models/reload
            docker compose restart risk-backend
            echo "✅ ML models deployed and reloaded"
```

### Что происходит на проде:
1. git pull — стягивается новая модель
2. docker compose restart risk-ml — перезапуск ML-сервиса
3. curl POST /models/reload — принудительная перезагрузка модели в память
4. docker compose restart risk-backend — перезапуск бэкенда для сброса кэша UI-схемы(Временное решение)

## Шаг 7: Проверить результат
```bash
# Проверить, что модель загрузилась
curl http://cabg.insukuro.ru/api/models/info | jq '.current_version'

# Проверить на демо-данных
curl -X POST http://cabg.insukuro.ru/api/predictions/ui/demo-data \
  -H "Content-Type: application/json" \
  -d '{"version": "v4"}'
```

## Итог: что изменилось
| Этап | Действие |
|---|---|
| Ноутбук | Обучены новые модели, отфильтрованы по AUC ≥ 0.47 |
| Файл | Сохранён `model_v4.pkl` с features_list, models, demo_data |
| Репозиторий | Файл добавлен в `ml_service/model_versions/` |
| CI/CD | Автоматический деплой и `/models/reload` |
| Проверка | Модель отвечает на запросы с новой версией |

- Время простоя: ~10 секунд (пока перезапускаются контейнеры).

- Откат: достаточно удалить файл из `model_versions/` и запустить CI/CD повторно — загрузится предыдущая версия.