import json
import os

# 1. Определяем директорию, где находится сам config.py (это /app/calc_service)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Путь к JSON теперь строится прямо в этой же папке
JSON_PATH = os.path.join(CURRENT_DIR, "coefficients.json")

if not os.path.exists(JSON_PATH):
    raise FileNotFoundError(
        f"Критическая ошибка: конфигурационный файл не найден по пути: {JSON_PATH}. "
        f"Проверьте структуру папки calc_service."
    )

with open(JSON_PATH, "r", encoding="utf-8") as f:
    config_data = json.load(f)

COEFFICIENTS = config_data["euroscore_coefficients"]
THRESHOLDS = config_data["thresholds"]