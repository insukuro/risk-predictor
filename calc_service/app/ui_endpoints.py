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
        "metric_keys": ["ИМТ (кг/м²)"]
    },
    "clcr": {
        "label": "Клиренс креатинина (Кокрофт-Голт)",
        "fields": ["sex", "age", "weight", "creatinine"],
        "metric_keys": ["Клиренс креатинина (мл/мин)"]
    },
    "euroscore": {
        "label": "EuroSCORE II",
        "fields": [
            "age", "sex", "weight", "creatinine", "copd", "extracardiac_pathology",
            "neurological_dysfunction", "previous_cardiac_surgery", "active_endocarditis",
            "critical_preop_state", "urgency", "lvef", "recent_mi", "paph_val"
        ],
        "metric_keys": ["EuroSCORE II (Летальность %)"]
    },
    "crusade": {
        "label": "CRUSADE Bleeding Score",
        "fields": ["hematocrit", "creatinine", "heart_rate", "sex", "chsn", "diabetes", "systolic_bp"],
        "metric_keys": ["CRUSADE Bleeding (Баллы)"]
    },
    "caprini": {
        "label": "Caprini Risk Score (ВТЭ)",
        "fields": [
            "age", "weight", "height", "copd", "recent_mi", "chsn", "previous_cardiac_surgery", "cpb_duration",
            "caprini_edema", "caprini_varicose", "caprini_pregnancy_loss", "caprini_oc_hrt", "caprini_sepsis_month",
            "caprini_ibd", "caprini_arthroscopy", "caprini_malignancy", "caprini_immobilization", "caprini_plaster",
            "caprini_cvc", "caprini_vte_history", "caprini_family_vte", "caprini_thrombophilia", "caprini_stroke_month",
            "caprini_arthroplasty", "caprini_fracture", "caprini_spine_injury"
        ],
        "metric_keys": ["Caprini VTE Risk (Баллы)"]
    },
    "chads_vasc": {
        "label": "CHA₂DS₂-VASc Score",
        "fields": ["chsn", "lvef", "hypertension", "age", "diabetes", "stroke_history", "recent_mi", "extracardiac_pathology", "sex"],
        "metric_keys": ["CHA₂DS₂-VASc (Тромбоэмболии)"]
    },
    "pre_deliric": {
        "label": "PRE-DELIRIC Model (Делирий)",
        "fields": ["age", "delirium_apache", "delirium_coma_type", "delirium_admission_type", "delirium_infection", "delirium_acidosis", "delirium_morphine", "delirium_sedatives", "urea", "urgency"],
        "metric_keys": ["PRE-DELIRIC (Вероятность делирия %)"]
    },
    "cleveland_thakar": {
        "label": "Cleveland Clinic Score (Thakar)",
        "fields": ["sex", "chsn", "lvef", "iabp", "copd", "diabetes_insulin", "previous_cardiac_surgery", "urgency", "operation_type", "creatinine"],
        "metric_keys": ["Cleveland Clinic Thakar (Баллы)"]
    },
    "resp_failure": {
        "label": "Риск дыхательной недостаточности",
        "fields": ["age", "urgency", "cpb_duration", "weight", "height"],
        "metric_keys": ["Дыхательная недостаточность (Баллы)"]
    },
    "nhsn_infection": {
        "label": "NHSN Risk Index",
        "fields": ["op_duration_long", "nhsn_asa_class", "nhsn_dirty_wound", "diabetes", "weight", "height", "previous_cardiac_surgery", "nhsn_immunosuppression"],
        "metric_keys": ["NHSN Риск инфекции области вмешательства"]
    }
}

# --- МЕТАДАННЫЕ ПОЛЕЙ ДЛЯ РЕНДЕРА НА ТУПОМ ФРОНТЕНДЕ ---
FIELD_METADATA_BACKEND = {
    'Пол (0=жен,1=муж)': {'label': 'Пол', 'group': 'Общая информация', 'type': 'select', 'options': [{'value': 0, 'label': 'Женский'}, {'value': 1, 'label': 'Мужской'}]},
    'Возраст (лет)': {'label': 'Возраст (лет)', 'group': 'Общая информация', 'type': 'number', 'min': 0, 'max': 120},
    'Вес (кг)': {'label': 'Вес (кг)', 'group': 'Общая информация', 'type': 'number', 'min': 10, 'max': 300},
    'Рост (м)': {'label': 'Рост (м)', 'group': 'Общая информация', 'type': 'number', 'min': 0.5, 'max': 2.5, 'step': 0.01},
    
    'Хронические заболевания лёгких (0/1)': {'label': 'Хронические заболевания лёгких / ХОБЛ', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Экстракардиальная артериопатия (0/1)': {'label': 'Экстракардиальная артериопатия', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Неврологическая дисфункция (0/1)': {'label': 'Неврологическая дисфункция', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Предыдущая операция на сердце (0/1)': {'label': 'Предыдущая операция на сердце (Реоперация)', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Активный эндокардит (0/1)': {'label': 'Активный эндокардит', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Критическое состояние перед операцией (0/1)': {'label': 'Критическое состояние перед операцией', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Недавний инфаркт миокарда (0/1)': {'label': 'Недавний инфаркт миокарда', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Сахарный диабет (0/1)': {'label': 'Сахарный диабет', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Инсулинозависимый СД (0/1)': {'label': 'Инсулинозависимый СД', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Признаки ХСН (0/1)': {'label': 'Признаки ХСН', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Артериальная гипертензия (0/1)': {'label': 'Артериальная гипертензия', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Инсульт/ТИА в анамнезе (0/1)': {'label': 'Инсульт / ТИА в анамнезе', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'ФП в анамнезе (0/1)': {'label': 'Фибрилляция предсердий', 'group': 'Анамнез', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},

    'Креатинин сыворотки (мкмоль/л)': {'label': 'Креатинин сыворотки (мкмоль/л)', 'group': 'Лабораторные показатели', 'type': 'number'},
    'Гематокрит (%)': {'label': 'Гематокрит (%)', 'group': 'Лабораторные показатели', 'type': 'number'},
    'ЧСС (уд/мин)': {'label': 'ЧСС (уд/мин)', 'group': 'Лабораторные показатели', 'type': 'number'},
    'САД (мм рт.ст.)': {'label': 'САД (мм рт.ст.)', 'group': 'Лабораторные показатели', 'type': 'number'},
    'Лёгочная гипертензия (мм рт.ст.)': {'label': 'Лёгочная гипертензия (мм рт.ст.)', 'group': 'Кардиометрия', 'type': 'number'},
    'Фракция выброса ЛЖ (%)': {'label': 'Фракция выброса ЛЖ (%)', 'group': 'Кардиометрия', 'type': 'number'},
    'Мочевина (ммоль/л)': {'label': 'Мочевина (ммоль/л)', 'group': 'Лабораторные показатели', 'type': 'number'},

    'Экстренность операции (0=план,1=ург,2=экстр)': {'label': 'Экстренность операции', 'group': 'Операция', 'type': 'select', 'options': [{'value': 0, 'label': 'Плановая'}, {'value': 1, 'label': 'Ургентная'}, {'value': 2, 'label': 'Экстренная'}]},
    'Тип операции (0=АКШ,1=клапан,2=АКШ+клапан,3=другая)': {'label': 'Тип операции', 'group': 'Операция', 'type': 'select', 'options': [{'value': 0, 'label': 'АКШ только'}, {'value': 1, 'label': 'Клапанная'}, {'value': 2, 'label': 'АКШ + Клапанная'}, {'value': 3, 'label': 'Другая'}]},
    'Длительность ИК (мин)': {'label': 'Длительность ИК (мин)', 'group': 'Операция', 'type': 'number'},
    'Длительность операции >75 перцентиля (0/1)': {'label': 'Длительность операции >75 перцентиля', 'group': 'Операция', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Внутриаортальная баллонная контрпульсация (0/1)': {'label': 'ВАБК', 'group': 'Операция', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},

    'Отёк ног (0/1)': {'label': 'Отёк ног', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Варикозное расширение вен (0/1)': {'label': 'Варикозное расширение вен', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Необъяснимое прерывание беременности (0/1)': {'label': 'Необъяснимое прерывание беременности', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Оральные контрацептивы/ЗГТ (0/1)': {'label': 'Оральные контрацептивы/ЗГТ', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Сепсис <1 мес (0/1)': {'label': 'Сепсис <1 мес', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Воспалительные заболевания кишечника (0/1)': {'label': 'ВЗК', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Артроскопия (0/1)': {'label': 'Артроскопия', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Злокачественное новообразование (0/1)': {'label': 'Злокачественное новообразование', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Обездвиженность >72 час (0/1)': {'label': 'Обездвиженность >72 час', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Гипсовая иммобилизация (0/1)': {'label': 'Гипсовая иммобилизация', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Центральный венозный катетер (0/1)': {'label': 'Центральный венозный катетер', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'ВТЭ в анамнезе (0/1)': {'label': 'ВТЭ в анамнезе', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Семейный анамнез ВТЭ (0/1)': {'label': 'Семейный анамнез ВТЭ', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Врождённые тромбофилии (0/1)': {'label': 'Врождённые тромбофилии', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Инсульт <1 мес (0/1)': {'label': 'Инсульт <1 мес', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Элективная артропластика (0/1)': {'label': 'Элективная артропластика', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Перелом бедра/таза (0/1)': {'label': 'Перелом бедра/таза', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Острая травма позвоночника (0/1)': {'label': 'Острая травма позвоночника', 'group': 'Шкала Caprini', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},

    'APACHE-II балл': {'label': 'APACHE-II балл', 'group': 'Шкала PRE-DELIRIC', 'type': 'number'},
    'Тип комы (0=Нет, 1=медикаментозная, 2=различная, 3=комбинированная)': {'label': 'Тип комы', 'group': 'Шкала PRE-DELIRIC', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет комы'}, {'value': 1, 'label': 'Медикаментозная'}, {'value': 2, 'label': 'Различная'}, {'value': 3, 'label': 'Комбинированная'}]},
    'Категория поступления (0=Хирург, 1=Терапевт, 2=Травма, 3=Невролог)': {'label': 'Категория поступления', 'group': 'Шкала PRE-DELIRIC', 'type': 'select', 'options': [{'value': 0, 'label': 'Хирург'}, {'value': 1, 'label': 'Терапевт'}, {'value': 2, 'label': 'Травма'}, {'value': 3, 'label': 'Невролог'}]},
    'Инфекция (0/1)': {'label': 'Инфекция', 'group': 'Шкала PRE-DELIRIC', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Метаболический ацидоз (0/1)': {'label': 'Метаболический ацидоз', 'group': 'Шкала PRE-DELIRIC', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'Использование морфина (0=Нет, 1=0.01-7.1, 2=7.2-18.6, 3=>18.6)': {'label': 'Использование морфина', 'group': 'Шкала PRE-DELIRIC', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': '0.01-7.1'}, {'value': 2, 'label': '7.2-18.6'}, {'value': 3, 'label': '>18.6'}]},
    'Использование седативных ЛС (0/1)': {'label': 'Использование седативных ЛС', 'group': 'Шкала PRE-DELIRIC', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},

    'Контаминированная/грязная рана (0/1)': {'label': 'Контаминированная/грязная рана', 'group': 'Шкала NHSN', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]},
    'ASA класс': {'label': 'ASA класс', 'group': 'Шкала NHSN', 'type': 'number'},
    'Иммуносупрессия (0/1)': {'label': 'Иммуносупрессия', 'group': 'Шкала NHSN', 'type': 'select', 'options': [{'value': 0, 'label': 'Нет'}, {'value': 1, 'label': 'Да'}]}
}


def to_bool(v):
    return str(v).lower() in ["1", "true", "yes", "да", "экстренная", "ургентная"]


@router.post("/calculate-all", response_model=UIAllMetricsResponse)
async def ui_calculate_all(request: Request):
    try:
        raw_json = await request.json()
        input_data = raw_json.get("features", raw_json)
        calculator_id = raw_json.get("calculator_id", "all")

        # Парсеры
        def extract_bool(keys_list) -> int:
            for key in keys_list:
                if key in input_data:
                    return 1 if to_bool(input_data[key]) else 0
            return 0

        def extract_numeric(keys_list, default=0.0) -> float:
            for key in keys_list:
                if key in input_data:
                    try: return float(input_data[key])
                    except: pass
            return default

        # Нормализация
        normalized = {
            "sex": int(extract_numeric(["Пол (0=жен,1=муж)", "Пол", "sex"], 1)),
            "age": int(extract_numeric(["Возраст (лет)", "Возраст", "age"], 60)),
            "weight": extract_numeric(["Вес (кг)", "Вес", "weight"], 75.0),
            "height": extract_numeric(["Рост (м)", "Рост", "height"], 1.75),
            
            "copd": extract_bool(["Хронические заболевания лёгких (0/1)", "Хронические заболевания лёгких", "ХОБЛ (0/1)", "ХОБЛ", "copd"]),
            "extracardiac_pathology": extract_bool(["Экстракардиальная артериопатия (0/1)", "Экстракардиальная артериопатия", "Атеросклероз НК (0/1)", "pad"]),
            "neurological_dysfunction": extract_bool(["Неврологическая дисфункция (0/1)", "Неврологическая дисфункция", "neuro_dysfunction"]),
            "previous_cardiac_surgery": extract_bool(["Предыдущая операция на сердце (0/1)", "Предыдущая операция на сердце", "previous_cardiac_surgery"]),
            "active_endocarditis": extract_bool(["Активный эндокардит (0/1)", "Активный эндокардит", "active_endocarditis"]),
            "critical_preop_state": extract_bool(["Критическое состояние перед операцией (0/1)", "Критическое состояние перед операцией", "critical_preop_state"]),
            "recent_mi": extract_bool(["Недавний инфаркт миокарда (0/1)", "Недавний инфаркт миокарда", "ИМ в анамнезе (0/1)", "mi"]),
            "diabetes": extract_bool(["Сахарный диабет (0/1)", "Сахарный диабет", "diabetes"]),
            "diabetes_insulin": extract_bool(["Инсулинозависимый СД (0/1)", "Инсулинозависимый СД", "diabetes_insulin"]),
            "chsn": extract_bool(["Признаки ХСН (0/1)", "Признаки ХСН", "ХСН (0/1)", "chsn"]),
            "hypertension": extract_bool(["Артериальная гипертензия (0/1)", "Артериальная гипертензия", "Гипертония (0/1)", "hypertension"]),
            "stroke_history": extract_bool(["Инсульт/ТИА в анамнезе (0/1)", "Инсульт/ТИА в анамнезе", "ОНМК в анамнезе (0/1)", "stroke"]),
            "af": extract_bool(["ФП в анамнезе (0/1)", "ФП в анамнезе", "af"]),
            
            "creatinine": extract_numeric(["Креатинин сыворотки (мкмоль/л)", "Креатинин в ОРИТ (мкмоль/л)", "creatinine"], 85.0),
            "hematocrit": extract_numeric(["Гематокрит (%)", "Гематокрит", "hematocrit"], 40.0),
            "heart_rate": extract_numeric(["ЧСС (уд/мин)", "ЧСС", "heart_rate"], 75.0),
            "systolic_bp": extract_numeric(["САД (мм рт.ст.)", "САД", "systolic_bp"], 120.0),
            "paph_val": extract_numeric(["Лёгочная гипертензия (мм рт.ст.)", "paph_val"], 25.0),
            "lvef": extract_numeric(["Фракция выброса ЛЖ (%)", "Фракция выброса ЛЖ", "lvef"], 55.0),
            "urea": extract_numeric(["Мочевина (ммоль/л)", "Мочевина", "urea"], 6.0),
            
            "urgency": int(extract_numeric(["Экстренность операции (0=план,1=ург,2=экстр)", "Экстренность операции", "Срочность (0=план,1=экстр)", "urgency"], 0)),
            "operation_type": int(extract_numeric(["Тип операции (0=АКШ,1=клапан,2=АКШ+клапан,3=другая)", "Тип операции", "operation_type"], 0)),
            "cpb_duration": extract_numeric(["Длительность ИК (мин)", "Длительность ИК", "cpb_duration"], 90.0),
            "op_duration_long": extract_bool(["Длительность операции >75 перцентиля (0/1)", "Длительность операции >75 перцентиля", "op_duration_long"]),
            "iabp": extract_bool(["Внутриаортальная баллонная контрпульсация (0/1)", "Внутриаортальная баллонная контрпульсация", "iabp"]),
            
            "caprini_edema": extract_bool(["Отёк ног (0/1)", "Отёк ног"]),
            "caprini_varicose": extract_bool(["Варикозное расширение вен (0/1)", "Варикозное расширение вен"]),
            "caprini_pregnancy_loss": extract_bool(["Необъяснимое прерывание беременности (0/1)", "Необъяснимое прерывание беременности"]),
            "caprini_oc_hrt": extract_bool(["Оральные контрацептивы/ЗГТ (0/1)", "Оральные контрацептивы/ЗГТ"]),
            "caprini_sepsis_month": extract_bool(["Сепсис <1 мес (0/1)", "Сепсис <1 мес"]),
            "caprini_ibd": extract_bool(["Воспалительные заболевания кишечника (0/1)", "Воспалительные заболевания кишечника"]),
            "caprini_arthroscopy": extract_bool(["Артроскопия (0/1)", "Артроскопия"]),
            "caprini_malignancy": extract_bool(["Злокачественное новообразование (0/1)", "Злокачественное новообразование"]),
            "caprini_immobilization": extract_bool(["Обездвиженность >72 час (0/1)", "Обездвиженность >72 час"]),
            "caprini_plaster": extract_bool(["Гипсовая иммобилизация (0/1)", "Гипсовая иммобилизация"]),
            "caprini_cvc": extract_bool(["Центральный венозный катетер (0/1)", "Центральный венозный катетер"]),
            "caprini_vte_history": extract_bool(["ВТЭ в анамнезе (0/1)", "ВТЭ в анамнезе"]),
            "caprini_family_vte": extract_bool(["Семейный анамнез ВТЭ (0/1)", "Семейный анамнез ВТЭ"]),
            "caprini_thrombophilia": extract_bool(["Врождённые тромбофилии (0/1)", "Врождённые тромбофилии"]),
            "caprini_stroke_month": extract_bool(["Инсульт <1 мес (0/1)", "Инсульт <1 мес"]),
            "caprini_arthroplasty": extract_bool(["Элективная артропластика (0/1)", "Элективная артропластика"]),
            "caprini_fracture": extract_bool(["Перелом бедра/таза (0/1)", "Перелом бедра/таза"]),
            "caprini_spine_injury": extract_bool(["Острая травма позвоночника (0/1)", "Острая травма позвоночника"]),

            "delirium_apache": int(extract_numeric(["APACHE-II балл", "delirium_apache"], 15)),
            "delirium_coma_type": int(extract_numeric(["Тип комы (0=Нет, 1=медикаментозная, 2=различная, 3=комбинированная)", "delirium_coma_type"], 0)),
            "delirium_admission_type": int(extract_numeric(["Категория поступления (0=Хирург, 1=Терапевт, 2=Травма, 3=Невролог)", "delirium_admission_type"], 0)),
            "delirium_infection": extract_bool(["Инфекция (0/1)", "Инфекция", "delirium_infection"]),
            "delirium_acidosis": extract_bool(["Метаболический ацидоз (0/1)", "Метаболический ацидоз", "delirium_acidosis"]),
            "delirium_morphine": int(extract_numeric(["Использование морфина (0=Нет, 1=0.01-7.1, 2=7.2-18.6, 3=>18.6)", "delirium_morphine"], 0)),
            "delirium_sedatives": extract_bool(["Использование седативных ЛС (0/1)", "Использование седативных ЛС", "delirium_sedatives"]),

            "nhsn_dirty_wound": extract_bool(["Контаминированная/грязная рана (0/1)", "Контаминированная/грязная рана"]),
            "nhsn_asa_class": int(extract_numeric(["ASA класс", "nhsn_asa_class"], 2)),
            "nhsn_immunosuppression": extract_bool(["Иммуносупрессия (0/1)", "Иммуносупрессия"])
        }

        validated_data = PatientData(**normalized)

        # Вычисления
        bmi = ClinicalEngine.calculate_bmi(validated_data.weight, validated_data.height)
        cl_cr = ClinicalEngine.calculate_clcr(validated_data.sex, validated_data.age, validated_data.weight, validated_data.creatinine)
        euro = ClinicalEngine.calculate_euroscore_ii(validated_data)
        crusade = ClinicalEngine.calculate_crusade(validated_data)
        caprini = ClinicalEngine.calculate_caprini(validated_data)
        chads = ClinicalEngine.calculate_chads_vasc(validated_data)
        delirium = ClinicalEngine.calculate_pre_deliric(validated_data)
        cleveland = ClinicalEngine.calculate_cleveland_thakar(validated_data)
        resp = ClinicalEngine.calculate_resp_failure(validated_data)
        nhsn = ClinicalEngine.calculate_nhsn_infection(validated_data)

        all_metrics = {
            "ИМТ (кг/м²)": {"value": bmi, **ClinicalEngine.interpret_bmi(bmi)},
            "Клиренс креатинина (мл/мин)": {"value": round(cl_cr, 1), **ClinicalEngine.interpret_clcr(cl_cr)},
            "EuroSCORE II (Летальность %)": {"value": euro, **ClinicalEngine.interpret_euroscore(euro)},
            "CRUSADE Bleeding (Баллы)": {"value": float(crusade), **ClinicalEngine.interpret_crusade(crusade)},
            "Caprini VTE Risk (Баллы)": {"value": float(caprini), **ClinicalEngine.interpret_caprini(caprini)},
            "CHA₂DS₂-VASc (Тромбоэмболии)": {"value": float(chads), **ClinicalEngine.interpret_chads(chads)},
            "PRE-DELIRIC (Вероятность делирия %)": {"value": delirium, **ClinicalEngine.interpret_delirium(delirium)},
            "Cleveland Clinic Thakar (Баллы)": {"value": float(cleveland), **ClinicalEngine.interpret_cleveland(cleveland)},
            "Дыхательная недостаточность (Баллы)": {"value": float(resp), **ClinicalEngine.interpret_resp(resp)},
            "NHSN Риск инфекции области вмешательства": {"value": float(nhsn), **ClinicalEngine.interpret_nhsn(nhsn)}
        }

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
        # БЕЗОПАСНЫЙ МАППИНГ: ищем поле в Pydantic и берем его alias (русское название)
        mapped_inputs = []
        for name in config["fields"]:
            field_obj = PatientData.model_fields.get(name)
            if field_obj and field_obj.alias:
                mapped_inputs.append(field_obj.alias)
            else:
                mapped_inputs.append(name)

        calculators_config[calc_id] = {
            "label": config["label"],
            "required_inputs": mapped_inputs
        }
    return {
        "required_inputs": flat_inputs,
        "categorical_inputs": categorical_inputs,
        "calculators": calculators_config,
        "field_metadata": FIELD_METADATA_BACKEND
    }