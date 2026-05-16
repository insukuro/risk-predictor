from pydantic import BaseModel, Field
from typing import Dict, Optional

class BasePatientModel(BaseModel):
    class Config:
        populate_by_name = True

# --- Входные схемы ---
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

class PatientData(BasePatientModel):
    sex: int = Field(default=1, alias="Пол (0=жен,1=муж)", json_schema_extra={"is_categorical": True})
    age: int = Field(default=60, alias="Возраст (лет)")
    weight: float = Field(default=75.0, alias="Вес (кг)")
    height: float = Field(default=175.0, alias="Рост (м)")
    creatinine: float = Field(default=85.0, alias="Креатинин в ОРИТ (мкмоль/л)")
    lvef: float = Field(default=55.0, alias="Категория ФВ ЛЖ", json_schema_extra={"is_categorical": True}) 
    nyha: int = Field(default=1, alias="ХСН ФК", json_schema_extra={"is_categorical": True})
    paph: int = Field(default=0, alias="Лёгочная гипертензия (0/1)", json_schema_extra={"is_categorical": True})
    hypertension: int = Field(default=0, alias="Гипертония (0/1)", json_schema_extra={"is_categorical": True})
    af: int = Field(default=0, alias="ФП в анамнезе (0/1)", json_schema_extra={"is_categorical": True})
    mi: int = Field(default=0, alias="ИМ в анамнезе (0/1)", json_schema_extra={"is_categorical": True})
    chsn: int = Field(default=0, alias="ХСН (0/1)", json_schema_extra={"is_categorical": True})
    diabetes: int = Field(default=0, alias="Сахарный диабет (0/1)", json_schema_extra={"is_categorical": True})
    copd: int = Field(default=0, alias="ХОБЛ (0/1)", json_schema_extra={"is_categorical": True})
    stroke: int = Field(default=0, alias="ОНМК в анамнезе (0/1)", json_schema_extra={"is_categorical": True})
    pad: int = Field(default=0, alias="Атеросклероз НК (0/1)", json_schema_extra={"is_categorical": True})
    bca: int = Field(default=0, alias="Атеросклероз БЦА (0/1)", json_schema_extra={"is_categorical": True})
    peptic_ulcer: int = Field(default=0, alias="Язвенная болезнь ЖКТ (0/1)", json_schema_extra={"is_categorical": True})
    urgency: int = Field(default=0, alias="Срочность (0=план,1=экстр)", json_schema_extra={"is_categorical": True})
    on_pump: int = Field(default=1, alias="pump", json_schema_extra={"is_categorical": True})

# --- Выходные UI схемы ---
class UIResultItem(BaseModel):
    value: float
    label: str
    level: str  # low, medium, high, danger

class UIAllMetricsResponse(BaseModel):
    status: str
    metrics: Dict[str, UIResultItem]