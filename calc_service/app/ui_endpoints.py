from fastapi import APIRouter, HTTPException, Request
from .schemas import PatientData, UIAllMetricsResponse
from .engine import ClinicalEngine

router = APIRouter(prefix="/ui", tags=["Frontend UI Endpoints"])

@router.post("/calculate-all", response_model=UIAllMetricsResponse)
async def ui_calculate_all(request: Request):
    try:
        # 1. Получаем сырой JSON в обход жесткой валидации Pydantic на верхнем уровне
        raw_json = await request.json()
        
        # Если данные обернуты в структуру {"features": {...}}, достаем их
        input_data = raw_json.get("features", raw_json) if isinstance(raw_json, dict) else {}

        # 2. Маппинг-нормализатор: превращаем любые вариации UI-ключей в строгие алиасы PatientData
        normalized = {}
        
        # Сначала переносим базовые параметры, очищая их от возможных пробелов и суффиксов
        normalized["Пол (0=жен,1=муж)"] = input_data.get("Пол (0=жен,1=муж)", input_data.get("Пол", 1))
        normalized["Возраст (лет)"] = input_data.get("Возраст (лет)", input_data.get("Возраст", 60))
        normalized["Вес (кг)"] = input_data.get("Вес (кг)", input_data.get("Вес", 75.0))
        normalized["Рост (м)"] = input_data.get("Рост (м)", input_data.get("Рост", 175.0))
        
        # Санитария лабораторных параметров и критических шкал
        normalized["Креатинин в ОРИТ (мкмоль/л)"] = input_data.get(
            "Креатинин в ОРИТ (мкмоль/л)", 
            input_data.get("Креатинин до операции (мкмоль/л)", input_data.get("creatinine", 85.0))
        )
        
        # Корректируем логику категории ФВ ЛЖ (маппинг из категорий 1,2,3 в реальные % для ClinicalEngine)
        lvef_raw = input_data.get("Категория ФВ ЛЖ", input_data.get("lvef", 55.0))
        # Если пришла категория текстом или числом 1,2,3 — транслируем в средний процент
        if lvef_raw == 1 or "Нормальная" in str(lvef_raw):
            normalized["Категория ФВ ЛЖ"] = 55.0
        elif lvef_raw == 2 or "Умеренно" in str(lvef_raw):
            normalized["Категория ФВ ЛЖ"] = 40.0
        elif lvef_raw == 3 or "Тяжелая" in str(lvef_raw):
            normalized["Категория ФВ ЛЖ"] = 25.0
        else:
            # Если уже пришло числом (%)
            try: normalized["Категория ФВ ЛЖ"] = float(lvef_raw)
            except: normalized["Категория ФВ ЛЖ"] = 55.0

        # Обработка NYHA / ХСН ФК
        nyha_raw = input_data.get("ХСН ФК", input_data.get("nyha", 1))
        try:
            normalized["ХСН ФК"] = int(nyha_raw)
        except:
            normalized["ХСН ФК"] = 1

        # Бинарные флаги сопутствующих заболеваний
        flags_mapping = {
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

        for target_alias, keys in flags_mapping.items():
            val = 0
            for k in keys:
                if k in input_data:
                    val = input_data[k]
                    break
            # Переводим в int (флаг 0 или 1)
            try:
                normalized[target_alias] = 1 if val in [1, True, "1", "true", "Экстренная"] else 0
            except:
                normalized[target_alias] = 0

        # ФП в анамнезе для расчета шкал фибрилляции
        af_val = input_data.get("ФП в анамнезе (0/1)", input_data.get("af", 0))
        normalized["ФП в анамнезе (0/1)"] = 1 if af_val in [1, True, "1"] else 0

        # 3. Валидируем уже очищенный и предсказуемый словарь через Pydantic
        validated_data = PatientData(**normalized)

        # 4. Выполняем расчеты в ClinicalEngine
        raw_dump = validated_data.model_dump()
        
        # Переименовываем ключи внутри словаря для совместимости с kwargs в ClinicalEngine
        engine_kwargs = {
            "age": validated_data.age,
            "sex": validated_data.sex,
            "weight": validated_data.weight,
            "height": validated_data.height,
            "creatinine": validated_data.creatinine,
            "lvef": normalized["Категория ФВ ЛЖ"], # Передаем число, а не ID категории
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
        print(traceback.format_exc()) # Логгируем стек ошибки в консоль контейнера
        raise HTTPException(status_code=400, detail=f"Data normalization error: {str(e)}")

@router.get("/metadata")
async def get_ui_metadata():
    flat_inputs = [f.alias or name for name, f in PatientData.model_fields.items()]
    categorical_inputs = [f.alias or name for name, f in PatientData.model_fields.items() if (f.json_schema_extra or {}).get("is_categorical")]
    
    calculators_config = {}
    for calc_id, config in CALCULATOR_MAPS.items():
        calculators_config[calc_id] = {
            "label": config["label"],
            "required_inputs": [PatientData.model_fields[name].alias or name for name in config["fields"] if name in PatientData.model_fields]
        }
    return {
        "required_inputs": flat_inputs,
        "categorical_inputs": categorical_inputs,
        "calculators": calculators_config
    }

