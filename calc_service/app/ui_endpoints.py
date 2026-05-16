from fastapi import APIRouter, HTTPException, Request
from .schemas import PatientData, UIAllMetricsResponse
from .engine import ClinicalEngine
from typing import Dict, Any

router = APIRouter(prefix="/ui", tags=["Frontend UI Endpoints"])

# --- ОПРЕДЕЛЕНИЕ СЛОВАРЯ МАППИНГА КАЛЬКУЛЯТОРОВ ---
# Ключи полей (в массиве "fields") должны строго совпадать с внутренними именами свойств в PatientData
CALCULATOR_MAPS = {
    "bmi": {
        "label": "Индекс массы тела (ИМТ)",
        "fields": ["weight", "height"]
    },
    "clcr": {
        "label": "Клиренс креатинина (Кокрофт-Голт)",
        "fields": ["sex", "age", "weight", "creatinine"]
    },
    "euroscore": {
        "label": "EuroSCORE II",
        "fields": [
            "age", "sex", "weight", "creatinine", "pad", "bca", 
            "copd", "diabetes", "urgency", "nyha", "lvef", "paph"
        ]
    },
    "cci": {
        "label": "Индекс коморбидности Чарлсона",
        "fields": [
            "age", "sex", "weight", "creatinine", "mi", "chsn", 
            "lvef", "pad", "bca", "stroke", "copd", "peptic_ulcer", "diabetes"
        ]
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


@router.post("/calculate-all", response_model=UIAllMetricsResponse)
async def ui_calculate_all(request: Request):
    try:
        raw_json = await request.json()
        input_data = raw_json.get("features", raw_json) if isinstance(raw_json, dict) else {}

        normalized = {}
        normalized["Пол (0=жен,1=муж)"] = input_data.get("Пол (0=жен,1=муж)", input_data.get("Пол", 1))
        normalized["Возраст (лет)"] = input_data.get("Возраст (лет)", input_data.get("Возраст", 60))
        normalized["Вес (кг)"] = input_data.get("Вес (кг)", input_data.get("Вес", 75.0))
        normalized["Рост (м)"] = input_data.get("Рост (м)", input_data.get("Рост", 175.0))
        
        normalized["Креатинин в ОРИТ (мкмоль/л)"] = input_data.get(
            "Креатинин в ОРИТ (мкмоль/л)", 
            input_data.get("Креатинин до операции (мкмоль/л)", input_data.get("creatinine", 85.0))
        )
        
        lvef_raw = input_data.get("Категория ФВ ЛЖ", input_data.get("lvef", 55.0))
        if lvef_raw == 1 or "Нормальная" in str(lvef_raw):
            normalized["Категория ФВ ЛЖ"] = 55.0
        elif lvef_raw == 2 or "Умеренно" in str(lvef_raw):
            normalized["Категория ФВ ЛЖ"] = 40.0
        elif lvef_raw == 3 or "Тяжелая" in str(lvef_raw):
            normalized["Категория ФВ ЛЖ"] = 25.0
        else:
            try: normalized["Категория ФВ ЛЖ"] = float(lvef_raw)
            except: normalized["Категория ФВ ЛЖ"] = 55.0

        nyha_raw = input_data.get("ХСН ФК", input_data.get("nyha", 1))
        try:
            normalized["ХСН ФК"] = int(nyha_raw)
        except:
            normalized["ХСН ФК"] = 1

        for target_alias, keys in FLAGS_MAPPING.items():
            val = 0
            for k in keys:
                if k in input_data:
                    val = input_data[k]
                    break
            try:
                normalized[target_alias] = 1 if val in [1, True, "1", "true", "Экстренная"] else 0
            except:
                normalized[target_alias] = 0

        af_val = input_data.get("ФП в анамнезе (0/1)", input_data.get("af", 0))
        normalized["ФП в анамнезе (0/1)"] = 1 if af_val in [1, True, "1"] else 0

        validated_data = PatientData(**normalized)

        engine_kwargs = {
            "age": validated_data.age,
            "sex": validated_data.sex,
            "weight": validated_data.weight,
            "height": validated_data.height,
            "creatinine": validated_data.creatinine,
            "lvef": normalized["Категория ФВ ЛЖ"],
            "nyha": validated_data.nyha,
            "paph": normalized["Лёгочная гипертензия (0/1)"],
            "hypertension": normalized["Гипертония (0/1)"],
            "mi": normalized["ИМ в анамнезе (0/1)"],
            "chsn": normalized["ХСН (0/1)"],
            "diabetes": normalized["Сахарный диабет (0/1)"],
            "copd": normalized["ХОБЛ (0/1)"],
            "stroke": normalized["ОНМК в анамнезе (0/1)"],
            "pad": normalized["Атеросклероз НК (0/1)"],
            "bca": normalized["Атеросклероз БЦА (0/1)"],
            "peptic_ulcer": normalized["Язвенная болезнь ЖКТ (0/1)"],
            "urgency": normalized["Срочность (0=план,1=экстр)"],
            "af": normalized["ФП в анамнезе (0/1)"]
        }

        bmi = ClinicalEngine.calculate_bmi(validated_data.weight, validated_data.height)
        cl_cr = ClinicalEngine.calculate_clcr(validated_data.sex, validated_data.age, validated_data.weight, validated_data.creatinine)
        
        euro = ClinicalEngine.calculate_euroscore_ii(**engine_kwargs)
        cci = ClinicalEngine.calculate_cci(**engine_kwargs)
        
        bmi_status = ClinicalEngine.interpret_bmi(bmi)
        cl_cr_status = ClinicalEngine.interpret_clcr(cl_cr)
        euro_status = ClinicalEngine.interpret_euroscore(euro)
        cci_status = ClinicalEngine.interpret_cci(cci)

        metrics = {
            "ИМТ (кг/м²)": {"value": bmi, **bmi_status},
            "Клиренс креатинина (мл/мин)": {"value": round(cl_cr, 1), **cl_cr_status},
            "EuroSCORE II (%)": {"value": euro, **euro_status},
            "Индекс коморбидности Чарлсона": {"value": float(cci), **cci_status}
        }
        
        if validated_data.af:
            chads = ClinicalEngine.calculate_chads_vasc(**engine_kwargs)
            has_b = ClinicalEngine.calculate_has_bled(**engine_kwargs)
            metrics["CHA₂DS₂-VASc"] = {"value": float(chads), **ClinicalEngine.interpret_chads(chads)}
            metrics["HAS-BLED"] = {"value": float(has_b), **ClinicalEngine.interpret_has_bled(has_b)}
            
        return {"status": "success", "metrics": metrics}

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Data normalization error: {str(e)}")


@router.get("/metadata")
async def get_ui_metadata():
    # Собираем плоский список системных алиасов
    flat_inputs = [f.alias or name for name, f in PatientData.model_fields.items()]
    categorical_inputs = [f.alias or name for name, f in PatientData.model_fields.items() if (f.json_schema_extra or {}).get("is_categorical")]
    
    calculators_config = {}
    for calc_id, config in CALCULATOR_MAPS.items():
        calculators_config[calc_id] = {
            "label": config["label"],
            # Маппим внутренние имена свойств обратно в их публичные строковые UI-алиасы
            "required_inputs": [
                PatientData.model_fields[name].alias or name 
                for name in config["fields"] 
                if name in PatientData.model_fields
            ]
        }
    return {
        "required_inputs": flat_inputs,
        "categorical_inputs": categorical_inputs,
        "calculators": calculators_config
    }