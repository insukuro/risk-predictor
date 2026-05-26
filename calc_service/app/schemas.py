from pydantic import BaseModel, Field
from typing import Dict, Optional

class BasePatientModel(BaseModel):
    class Config:
        populate_by_name = True

# --- ИЗОЛИРОВАННЫЕ СХЕМЫ ДЛЯ PURE MACHINE API ---
class BMISchema(BasePatientModel):
    weight: float = Field(..., alias="Вес (кг)")
    height: float = Field(..., alias="Рост (м)")

class ClCrSchema(BasePatientModel):
    sex: int = Field(..., alias="Пол (0=жен,1=муж)")
    age: int = Field(..., alias="Возраст (лет)")
    weight: float = Field(..., alias="Вес (кг)")
    creatinine: float = Field(..., alias="Креатинин в ОРИТ (мкмоль/л)")

class CCISchema(BasePatientModel):
    age: int = Field(..., alias="Возраст (лет)")
    sex: int = Field(..., alias="Пол (0=жен,1=муж)")
    weight: float = Field(..., alias="Вес (кг)")
    creatinine: float = Field(..., alias="Креатинин в ОРИТ (мкмоль/л)")
    mi: int = Field(0, alias="ИМ в анамнезе (0/1)")
    chsn: int = Field(0, alias="ХСН (0/1)")
    lvef: float = Field(55.0, alias="Категория ФВ ЛЖ")
    pad: int = Field(0, alias="Атеросклероз НК (0/1)")
    bca: int = Field(0, alias="Атеросклероз БЦА (0/1)")
    stroke: int = Field(0, alias="ОНМК в анамнезе (0/1)")
    copd: int = Field(0, alias="ХОБЛ (0/1)")
    peptic_ulcer: int = Field(0, alias="Язвенная болезнь ЖКТ (0/1)")
    diabetes: int = Field(0, alias="Сахарный диабет (0/1)")

class EuroScoreSchema(BasePatientModel):
    age: int = Field(..., alias="Возраст (лет)")
    sex: int = Field(..., alias="Пол (0=жен,1=муж)")
    weight: float = Field(..., alias="Вес (кг)")
    creatinine: float = Field(..., alias="Креатинин в ОРИТ (мкмоль/л)")
    pad: int = Field(0, alias="Атеросклероз НК (0/1)")
    bca: int = Field(0, alias="Атеросклероз БЦА (0/1)")
    copd: int = Field(0, alias="ХОБЛ (0/1)")
    diabetes: int = Field(0, alias="Сахарный диабет (0/1)")
    urgency: int = Field(0, alias="Срочность (0=план,1=экстр)")
    nyha: int = Field(1, alias="ХСН ФК")
    lvef: float = Field(55.0, alias="Категория ФВ ЛЖ")
    paph: int = Field(0, alias="Лёгочная гипертензия (0/1)")

# --- УНИВЕРСАЛЬНАЯ СХЕМА ДЛЯ ФРОНТЕНДА (ДИНАМИЧЕСКИЙ UI) ---
class PatientData(BasePatientModel):
    sex: int = Field(default=1, alias="Пол (0=жен,1=муж)", json_schema_extra={"is_categorical": True})
    age: int = Field(default=60, alias="Возраст (лет)")
    weight: float = Field(default=75.0, alias="Вес (кг)")
    height: float = Field(default=175.0, alias="Рост (м)")
    copd: int = Field(default=0, alias="Хронические заболевания лёгких (0/1)", json_schema_extra={"is_categorical": True})
    extracardiac_pathology: int = Field(default=0, alias="Экстракардиальная артериопатия (0/1)", json_schema_extra={"is_categorical": True})
    neurological_dysfunction: int = Field(default=0, alias="Неврологическая дисфункция (0/1)", json_schema_extra={"is_categorical": True})
    previous_cardiac_surgery: int = Field(default=0, alias="Предыдущая операция на сердце (0/1)", json_schema_extra={"is_categorical": True})
    active_endocarditis: int = Field(default=0, alias="Активный эндокардит (0/1)", json_schema_extra={"is_categorical": True})
    critical_preop_state: int = Field(default=0, alias="Критическое состояние перед операцией (0/1)", json_schema_extra={"is_categorical": True})
    recent_mi: int = Field(default=0, alias="Недавний инфаркт миокарда (0/1)", json_schema_extra={"is_categorical": True})
    diabetes: int = Field(default=0, alias="Сахарный диабет (0/1)", json_schema_extra={"is_categorical": True})
    diabetes_insulin: int = Field(default=0, alias="Инсулинозависимый СД (0/1)", json_schema_extra={"is_categorical": True})
    chsn: int = Field(default=0, alias="Признаки ХСН (0/1)", json_schema_extra={"is_categorical": True})
    hypertension: int = Field(default=0, alias="Артериальная гипертензия (0/1)", json_schema_extra={"is_categorical": True})
    stroke_history: int = Field(default=0, alias="Инсульт/ТИА в анамнезе (0/1)", json_schema_extra={"is_categorical": True})
    af: int = Field(default=0, alias="ФП в анамнезе (0/1)", json_schema_extra={"is_categorical": True})
    creatinine: float = Field(default=85.0, alias="Креатинин сыворотки (мкмоль/л)")
    hematocrit: float = Field(default=40.0, alias="Гематокрит (%)")
    heart_rate: float = Field(default=75.0, alias="ЧСС (уд/мин)")
    systolic_bp: float = Field(default=120.0, alias="САД (мм рт.ст.)")
    paph_val: float = Field(default=25.0, alias="Лёгочная гипертензия (мм рт.ст.)")
    lvef: float = Field(default=55.0, alias="Фракция выброса ЛЖ (%)")
    urea: float = Field(default=6.0, alias="Мочевина (ммоль/л)")
    urgency: int = Field(default=0, alias="Экстренность операции (0=план,1=ург,2=экстр)", json_schema_extra={"is_categorical": True})
    operation_type: int = Field(default=0, alias="Тип операции (0=АКШ,1=клапан,2=АКШ+клапан,3=другая)", json_schema_extra={"is_categorical": True})
    cpb_duration: float = Field(default=90.0, alias="Длительность ИК (мин)")
    op_duration_long: int = Field(default=0, alias="Длительность операции >75 перцентиля (0/1)", json_schema_extra={"is_categorical": True})
    iabp: int = Field(default=0, alias="Внутриаортальная баллонная контрпульсация (0/1)", json_schema_extra={"is_categorical": True})
    caprini_edema: int = Field(default=0, alias="Отёк ног (0/1)", json_schema_extra={"is_categorical": True})
    caprini_varicose: int = Field(default=0, alias="Варикозное расширение вен (0/1)", json_schema_extra={"is_categorical": True})
    caprini_pregnancy_loss: int = Field(default=0, alias="Необъяснимое прерывание беременности (0/1)", json_schema_extra={"is_categorical": True})
    caprini_oc_hrt: int = Field(default=0, alias="Оральные контрацептивы/ЗГТ (0/1)", json_schema_extra={"is_categorical": True})
    caprini_sepsis_month: int = Field(default=0, alias="Сепсис <1 мес (0/1)", json_schema_extra={"is_categorical": True})
    caprini_ibd: int = Field(default=0, alias="Воспалительные заболевания кишечника (0/1)", json_schema_extra={"is_categorical": True})
    caprini_arthroscopy: int = Field(default=0, alias="Артроскопия (0/1)", json_schema_extra={"is_categorical": True})
    caprini_malignancy: int = Field(default=0, alias="Злокачественное новообразование (0/1)", json_schema_extra={"is_categorical": True})
    caprini_immobilization: int = Field(default=0, alias="Обездвиженность >72 час (0/1)", json_schema_extra={"is_categorical": True})
    caprini_plaster: int = Field(default=0, alias="Гипсовая иммобилизация (0/1)", json_schema_extra={"is_categorical": True})
    caprini_cvc: int = Field(default=0, alias="Центральный венозный катетер (0/1)", json_schema_extra={"is_categorical": True})
    caprini_vte_history: int = Field(default=0, alias="ВТЭ в анамнезе (0/1)", json_schema_extra={"is_categorical": True})
    caprini_family_vte: int = Field(default=0, alias="Семейный анамнез ВТЭ (0/1)", json_schema_extra={"is_categorical": True})
    caprini_thrombophilia: int = Field(default=0, alias="Врождённые тромбофилии (0/1)", json_schema_extra={"is_categorical": True})
    caprini_stroke_month: int = Field(default=0, alias="Инсульт <1 мес (0/1)", json_schema_extra={"is_categorical": True})
    caprini_arthroplasty: int = Field(default=0, alias="Элективная артропластика (0/1)", json_schema_extra={"is_categorical": True})
    caprini_fracture: int = Field(default=0, alias="Перелом бедра/таза (0/1)", json_schema_extra={"is_categorical": True})
    caprini_spine_injury: int = Field(default=0, alias="Острая травма позвоночника (0/1)", json_schema_extra={"is_categorical": True})
    delirium_apache: int = Field(default=15, alias="APACHE-II балл")
    delirium_coma_type: int = Field(default=0, alias="Тип комы (0=Нет, 1=медикаментозная, 2=различная, 3=комбинированная)", json_schema_extra={"is_categorical": True})
    delirium_admission_type: int = Field(default=0, alias="Категория поступления (0=Хирург, 1=Терапевт, 2=Травма, 3=Невролог)", json_schema_extra={"is_categorical": True})
    delirium_infection: int = Field(default=0, alias="Инфекция (0/1)", json_schema_extra={"is_categorical": True})
    delirium_acidosis: int = Field(default=0, alias="Метаболический ацидоз (0/1)", json_schema_extra={"is_categorical": True})
    delirium_morphine: int = Field(default=0, alias="Использование морфина (0=Нет, 1=0.01-7.1, 2=7.2-18.6, 3=>18.6)", json_schema_extra={"is_categorical": True})
    delirium_sedatives: int = Field(default=0, alias="Использование седативных ЛС (0/1)", json_schema_extra={"is_categorical": True})
    nhsn_dirty_wound: int = Field(default=0, alias="Контаминированная/грязная рана (0/1)", json_schema_extra={"is_categorical": True})
    nhsn_asa_class: int = Field(default=2, alias="ASA класс")
    nhsn_immunosuppression: int = Field(default=0, alias="Иммуносупрессия (0/1)", json_schema_extra={"is_categorical": True})

class UIResultItem(BaseModel):
    value: float
    label: str
    level: str

class UIAllMetricsResponse(BaseModel):
    status: str
    metrics: Dict[str, UIResultItem]