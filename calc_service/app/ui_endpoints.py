from fastapi import APIRouter, HTTPException, Request
from .schemas import PatientData, UIAllMetricsResponse
from .engine import ClinicalEngine
from typing import Dict, Any

router = APIRouter(prefix="/ui", tags=["Frontend UI Endpoints"])

# --- ОПРЕДЕЛЕНИЕ СЛОВАРЯ МАППИНГА КАЛЬКУЛЯТОРОВ ---
CALCULATOR_MAPS = {
    "bmi": {
        "label": "Индекс массы тела (ИМТ)",
        "fields": ["weight", "height"],
        "metric_keys": ["ИМТ (кг/м²)"] # Связываем с ключами в ответе
    },
    "clcr": {
        "label": "Клиренс креатинина (Кокрофт-Голт)",
        "fields": ["sex", "age", "weight", "creatinine"],
        "metric_keys": ["Клиренс креатинина (мл/мин)"]
    },
    "euroscore": {
        "label": "EuroSCORE II",
        "fields": [
            "age", "sex", "weight", "creatinine", "pad", "bca", 
            "copd", "diabetes", "urgency", "nyha", "lvef", "paph"
        ],
        "metric_keys": ["EuroSCORE II (%)"]
    },
    "cci": {
        "label": "Индекс коморбидности Чарлсона (модифицированный",
        "fields": [
            "age", "sex", "weight", "creatinine", "mi", "chsn", 
            "lvef", "pad", "bca", "stroke", "copd", "peptic_ulcer", "diabetes"
        ],
        "metric_keys": ["Индекс коморбидности Чарлсона"]
    }
}

# Маппинг-нормализатор для входящих UI-ключей
FLAGS_MAPPING = {
    "Лёгочная гипертензия (0/1)": ["Лёгочная гипертензия (0/1)", "Лёгочная гипертензия", "paph"],
    "Гипертония (0/1)": ["Гипертония (0/1)", "Гипертония", "hypertension"],
    "Сахарный диабет (0/1)": ["Сахарный диабет (0/1)", "Сахарный диабет", "diabetes"],
    "ХОБЛ (0/1)": ["ХОБЛ (0/1)", "ХОБЛ", "copd"],
    "ИМ в анамнезе (0/1)": ["ИМ в анамнезе (0/1)", "ИМ в анамнезе", "mi"],
    "ХСН (0/1)": ["ХСН (0/1)", "ХСН", "chsn"],
    "ОНМК в анамнезе (0/1)": ["ОНМК в анамнезе (0/1)", "ОНМК в анамнезе", "stroke"],
    "Атеросклероз НК (0/1)": ["Атеросклероз НК (0/1)", "Атеросклероз НК", "pad"],
    "Атеросклероз БЦА (0/1)": ["Атеросклероз БЦА (0/1)", "Атеросклероз БЦА", "bca"],
    "Язвенная болезнь ЖКТ (0/1)": ["Язвенная болезнь ЖКТ (0/1)", "Язвенная болезнь ЖКТ", "peptic_ulcer"],
    "Срочность (0=план,1=экстр)": ["Срочность (0=план,1=экстр)", "Срочность", "urgency"],
    "pump": ["pump (0/1)", "pump", "on_pump"]
}

# --- МЕТАДАННЫЕ ПОЛЕЙ (перенесены с фронтенда) ---
FIELD_METADATA_BACKEND = {
    'Пол (0=жен,1=муж)': {'label': 'Пол', 'group': 'Общая информация', 'type': 'select', 'options': [{'value': 0, 'label': 'Женский'}, {'value': 1, 'label': 'Мужской'}]},
    'Возраст (лет)': {'label': 'Возраст (лет)', 'group': 'Общая информация', 'type': 'number', 'min': 0, 'max': 120},
    'Вес (кг)': {'label': 'Вес (кг)', 'group': 'Общая информация', 'type': 'number', 'min': 10, 'max': 300},
    'Рост (м)': {'label': 'Рост (м)', 'group': 'Общая информация', 'type': 'number', 'min': 0.5, 'max': 2.5, 'step': 0.01},
    'Креатинин в ОРИТ (мкмоль/л)': {'label': 'Креатинин (мкмоль/л)', 'group': 'Лабораторные показатели', 'type': 'number', 'min': 0, 'max': 2000},
    'Категория ФВ ЛЖ': {'label': 'Категория ФВ ЛЖ', 'group': 'Кардиометрия', 'type': 'select', 'options': [{'value': 1, 'label': 'Нормальная (≥50%)'}, {'value': 2, 'label': 'Умеренно снижена (30-49%)'}, {'value': 3, 'label': 'Низкая (<30%)'}]},
    'ХСН ФК': {'label': 'ХСН Функциональный класс', 'group': 'Кардиометрия', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет ХСН'}, {'value': 1, 'label': 'I ФК'}, {'value': 2, 'label': 'II ФК'}, {'value': 3, 'label': 'III ФК'}, {'value': 4, 'label': 'IV ФК'}]},
    'Лёгочная гипертензия (0/1)': {'label': 'Лёгочная гипертензия', 'group': 'Кардиометрия', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Гипертония (0/1)': {'label': 'Артериальная гипертензия', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'ФП в анамнезе (0/1)': {'label': 'Фибрилляция предсердий', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'ИМ в анамнезе (0/1)': {'label': 'Инфаркт миокарда в анамнезе', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'ХСН (0/1)': {'label': 'Хроническая сердечная недостаточность', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Сахарный диабет (0/1)': {'label': 'Сахарный диабет', 'group': 'Коморбидность', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'ХОБЛ (0/1)': {'label': 'ХОБЛ', 'group': 'Коморбидность', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'ОНМК в анамнезе (0/1)': {'label': 'ОНМК в анамнезе', 'group': 'Коморбидность', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Атеросклероз НК (0/1)': {'label': 'Атеросклероз нижних конечностей', 'group': 'Коморбидность', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Атеросклероз БЦА (0/1)': {'label': 'Атеросклероз БЦА', 'group': 'Коморбидность', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Язвенная болезнь ЖКТ (0/1)': {'label': 'Язвенная болезнь ЖКТ', 'group': 'Коморбидность', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Срочность (0=план,1=экстр)': {'label': 'Срочность операции', 'group': 'Операция', 'type': 'select', 'options': [{'value': 0, 'label': 'Плановая'}, {'value': 1, 'label': 'Экстренная'}]},
    'pump': {'label': 'Искусственное кровообращение', 'group': 'Операция', 'type': 'select', 'options': [{'value': 0, 'label': 'Off-pump'}, {'value': 1, 'label': 'On-pump'}]}
}

LVEF_MAP = {
    1: 55.0,
    2: 40.0,
    3: 25.0,

    "Нормальная (≥50%)": 55.0,
    "Нормальная": 55.0,

    "Умеренно сниженная (30-49%)": 40.0,
    "Умеренно снижена (30-49%)": 40.0,
    "Умеренно": 40.0,

    "Тяжелая дисфункция (<30%)": 25.0,
    "Тяжелая дисфункция": 25.0,
    "Тяжелая": 25.0,
}
def to_bool(v):
    return str(v).lower() in ["1", "true", "yes", "да", "экстренная"]
@router.post("/calculate-all", response_model=UIAllMetricsResponse)
async def ui_calculate_all(request: Request):
    try:
        raw_json = await request.json()
        # Получаем данные и calculator_id
        input_data = raw_json.get("features", raw_json)
        calculator_id = raw_json.get("calculator_id", "all")

        normalized = {}
        # ... (существующая логика нормализации без изменений)
        normalized["Пол (0=жен,1=муж)"] = input_data.get("Пол (0=жен,1=муж)", input_data.get("Пол", 1))
        normalized["Возраст (лет)"] = input_data.get("Возраст (лет)", input_data.get("Возраст", 60))
        normalized["Вес (кг)"] = input_data.get("Вес (кг)", input_data.get("Вес", 75.0))
        normalized["Рост (м)"] = input_data.get("Рост (м)", input_data.get("Рост", 175.0))
        normalized["Креатинин в ОРИТ (мкмоль/л)"] = input_data.get("Креатинин в ОРИТ (мкмоль/л)", input_data.get("Креатинин до операции (мкмоль/л)", input_data.get("creatinine", 85.0)))
        
        lvef_raw = input_data.get("Категория ФВ ЛЖ", input_data.get("lvef", 55.0))

        def normalize_lvef(x):
            if x in LVEF_MAP:
                return LVEF_MAP[x]

            # если пришёл int/float строкой
            try:
                val = int(x)
                if val in LVEF_MAP:
                    return LVEF_MAP[val]
            except:
                pass

            try:
                return float(x)
            except:
                return 55.0

        normalized["Категория ФВ ЛЖ"] = normalize_lvef(lvef_raw)

        nyha_raw = input_data.get("ХСН ФК", input_data.get("nyha", 1))
        try: normalized["ХСН ФК"] = int(nyha_raw)
        except: normalized["ХСН ФК"] = 1

        for target_alias, keys in FLAGS_MAPPING.items():
            val = 0
            for k in keys:
                if k in input_data:
                    val = input_data[k]
                    break
            try: normalized[target_alias] = 1 if to_bool(val) else 0
            except: normalized[target_alias] = 0

        af_val = input_data.get("ФП в анамнезе (0/1)", input_data.get("af", 0))
        normalized["ФП в анамнезе (0/1)"] = 1 if af_val in [1, True, "1"] else 0

        validated_data = PatientData(**normalized)

        engine_kwargs = {
            "age": validated_data.age, "sex": validated_data.sex,
            "weight": validated_data.weight, "height": validated_data.height,
            "creatinine": validated_data.creatinine, "lvef": normalized["Категория ФВ ЛЖ"],
            "nyha": validated_data.nyha, "paph": normalized["Лёгочная гипертензия (0/1)"],
            "hypertension": normalized["Гипертония (0/1)"], "mi": normalized["ИМ в анамнезе (0/1)"],
            "chsn": normalized["ХСН (0/1)"], "diabetes": normalized["Сахарный диабет (0/1)"],
            "copd": normalized["ХОБЛ (0/1)"], "stroke": normalized["ОНМК в анамнезе (0/1)"],
            "pad": normalized["Атеросклероз НК (0/1)"], "bca": normalized["Атеросклероз БЦА (0/1)"],
            "peptic_ulcer": normalized["Язвенная болезнь ЖКТ (0/1)"], "urgency": normalized["Срочность (0=план,1=экстр)"],
            "af": normalized["ФП в анамнезе (0/1)"]
        }

        # Всегда считаем всё
        bmi = ClinicalEngine.calculate_bmi(validated_data.weight, validated_data.height)
        cl_cr = ClinicalEngine.calculate_clcr(validated_data.sex, validated_data.age, validated_data.weight, validated_data.creatinine)
        euro = ClinicalEngine.calculate_euroscore_ii(**engine_kwargs)
        cci = ClinicalEngine.calculate_cci(**engine_kwargs)

        all_metrics = {
            "ИМТ (кг/м²)": {"value": bmi, **ClinicalEngine.interpret_bmi(bmi)},
            "Клиренс креатинина (мл/мин)": {"value": round(cl_cr, 1), **ClinicalEngine.interpret_clcr(cl_cr)},
            "EuroSCORE II (%)": {"value": euro, **ClinicalEngine.interpret_euroscore(euro)},
            "Индекс коморбидности Чарлсона": {"value": float(cci), **ClinicalEngine.interpret_cci(cci)}
        }
        
        if validated_data.af:
            chads = ClinicalEngine.calculate_chads_vasc(**engine_kwargs)
            has_b = ClinicalEngine.calculate_has_bled(**engine_kwargs)
            all_metrics["CHA₂DS₂-VASc"] = {"value": float(chads), **ClinicalEngine.interpret_chads(chads)}
            all_metrics["HAS-BLED"] = {"value": float(has_b), **ClinicalEngine.interpret_has_bled(has_b)}
            
        # --- ИСПРАВЛЕНИЕ ОШИБКИ: Фильтрация метрик по calculator_id ---
        if calculator_id != "all" and calculator_id in CALCULATOR_MAPS:
            allowed_keys = CALCULATOR_MAPS[calculator_id]["metric_keys"]
            metrics = {k: v for k, v in all_metrics.items() if k in allowed_keys}
        else:
            metrics = all_metrics
            
        return {"status": "success", "metrics": metrics}

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Data normalization error: {str(e)}")


@router.get("/metadata")
async def get_ui_metadata():
    flat_inputs = [f.alias or name for name, f in PatientData.model_fields.items()]
    categorical_inputs = [f.alias or name for name, f in PatientData.model_fields.items() if (f.json_schema_extra or {}).get("is_categorical")]
    
    calculators_config = {}
    for calc_id, config in CALCULATOR_MAPS.items():
        calculators_config[calc_id] = {
            "label": config["label"],
            "required_inputs": [
                PatientData.model_fields[name].alias or name 
                for name in config["fields"] 
                if name in PatientData.model_fields
            ]
        }
    return {
        "required_inputs": flat_inputs,
        "categorical_inputs": categorical_inputs,
        "calculators": calculators_config,
        "field_metadata": FIELD_METADATA_BACKEND # <--- Передаем метаданные фронтенду
    }