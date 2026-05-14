import math
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="Clinical Calculator API", 
    version="1.0.0",
    description="API с защитой от пустых данных и раздельными эндпоинтами"
)

# --- МОДЕЛЬ ДАННЫХ ---
class PatientData(BaseModel):
    sex: int = Field(default=1, alias="Пол (0=жен,1=муж)")
    age: int = Field(default=60, alias="Возраст (лет)")
    weight: float = Field(default=75.0, alias="Вес (кг)")
    height: float = Field(default=175.0, alias="Рост (м)")
    creatinine: float = Field(default=85.0, alias="Креатинин в ОРИТ (мкмоль/л)")
    lvef: float = Field(default=55.0, alias="Категория ФВ ЛЖ") 
    nyha: int = Field(default=1, alias="ХСН ФК")
    paph: int = Field(default=0, alias="Лёгочная гипертензия (0/1)")
    hypertension: int = Field(default=0, alias="Гипертония (0/1)")
    af: int = Field(default=0, alias="ФП в анамнезе (0/1)")
    mi: int = Field(default=0, alias="ИМ в анамнезе (0/1)")
    chsn: int = Field(default=0, alias="ХСН (0/1)")
    diabetes: int = Field(default=0, alias="Сахарный диабет (0/1)")
    copd: int = Field(default=0, alias="ХОБЛ (0/1)")
    stroke: int = Field(default=0, alias="ОНМК в анамнезе (0/1)")
    pad: int = Field(default=0, alias="Атеросклероз НК (0/1)")
    bca: int = Field(default=0, alias="Атеросклероз БЦА (0/1)")
    peptic_ulcer: int = Field(default=0, alias="Язвенная болезнь ЖКТ (0/1)")
    urgency: int = Field(default=0, alias="Срочность (0=план,1=экстр)")
    on_pump: int = Field(default=1, alias="pump")

    class Config:
        populate_by_name = True

# --- ЯДРО РАСЧЕТОВ ---
class ClinicalEngine:
    @staticmethod
    def get_preprocessed_values(data: PatientData) -> Dict[str, Any]:
        """Вспомогательный метод для подготовки общих переменных"""
        h_m = data.height / 100 if data.height > 3 else data.height
        bmi = round(data.weight / (h_m ** 2), 2)
        
        safe_creat = data.creatinine if data.creatinine > 0 else 85.0
        cr_mg_dl = safe_creat / 88.4
        cl_cr = ((140 - data.age) * data.weight) / (72 * cr_mg_dl)
        if data.sex == 0: cl_cr *= 0.85
        
        return {"h_m": h_m, "bmi": bmi, "cl_cr": cl_cr}

    @staticmethod
    def calculate_cci(data: PatientData, cl_cr: float) -> int:
        score = 0
        if data.mi: score += 1
        if data.chsn or data.lvef < 40: score += 1
        if data.pad or data.bca: score += 1
        if data.stroke: score += 1
        if data.copd: score += 1
        if data.peptic_ulcer: score += 1
        if data.diabetes: score += 1
        if cl_cr < 60: score += 2
        if data.age >= 50:
            score += min(4, (data.age - 40) // 10)
        return score

    @staticmethod
    def calculate_euroscore_ii(data: PatientData, cl_cr: float) -> float:
        coeffs = {
            "intercept": -5.324537, "age": 0.0285181, "sex_female": 0.2196434,
            "extracardiac": 0.5306827, "copd": 0.1886564, "diabetes_insulin": 0.3542749,
            "urgency_urgent": 0.3174673, "renal_50_85": 0.303553, "renal_lt_50": 0.8592256,
            "nyha_2": 0.1070545, "nyha_3": 0.2958358, "nyha_4": 0.5593929,
            "lv_31_50": 0.3150652, "lv_le_30": 0.8039273, "paph_mod": 0.1788899
        }
        z = coeffs["intercept"]
        if data.age > 60: z += (data.age - 60) * coeffs["age"]
        if data.sex == 0: z += coeffs["sex_female"]
        if data.pad or data.bca: z += coeffs["extracardiac"]
        if data.copd: z += coeffs["copd"]
        if data.diabetes: z += coeffs["diabetes_insulin"]
        if data.urgency == 1: z += coeffs["urgency_urgent"]
        if cl_cr < 50: z += coeffs["renal_lt_50"]
        elif cl_cr <= 85: z += coeffs["renal_50_85"]
        z += {2: coeffs["nyha_2"], 3: coeffs["nyha_3"], 4: coeffs["nyha_4"]}.get(data.nyha, 0)
        if data.lvef <= 30: z += coeffs["lv_le_30"]
        elif data.lvef <= 50: z += coeffs["lv_31_50"]
        if data.paph: z += coeffs["paph_mod"]
        
        return round((math.exp(z) / (1 + math.exp(z))) * 100, 2)
    
    @staticmethod
    def calculate_chads_vasc(data: PatientData) -> int:
        """Расчет CHA₂DS₂-VASc для пациентов с ФП"""
        score = 0
        # Сердечная недостаточность
        if data.chsn or data.lvef < 40: score += 1
        # Гипертония
        if data.hypertension: score += 1
        # Возраст >= 75 (2 балла), 65-74 (1 балл)
        if data.age >= 75: score += 2
        elif data.age >= 65: score += 1
        # Диабет
        if data.diabetes: score += 1
        # Инсульт
        if data.stroke: score += 2
        # Сосудистые заболевания (ИМ, атеросклероз)
        if data.mi or data.pad or data.bca: score += 1
        # Женский пол
        if data.sex == 0: score += 1
        return score

    @staticmethod
    def calculate_has_bled(data: PatientData) -> int:
        """Расчет HAS-BLED для пациентов с ФП"""
        score = 0
        # Гипертония (систолическое >160 мм рт.ст.) - упрощенно
        if data.hypertension: score += 1
        # Нарушение функции почек (диализ, креатинин >200)
        if data.creatinine and data.creatinine > 200: score += 1
        # Нарушение функции печени - у нас нет данных, пропускаем
        # Инсульт в анамнезе
        if data.stroke: score += 1
        # Кровотечение в анамнезе (язва ЖКТ)
        if data.peptic_ulcer: score += 1
        # Лабильное МНО - нет данных, пропускаем
        # Возраст > 65 лет
        if data.age > 65: score += 1
        # Алкоголь - нет данных, пропускаем
        return score

# --- ЭНДПОИНТЫ ---
@app.get("/metadata")
async def get_metadata():
    """Возвращает список ключей, которые сервис рассчитывает самостоятельно."""
    return {
        "calculated_features": [
            "EuroSCORE II (%)",
            "Индекс коморбидности Чарлсона",
            "Индекс Чарлсона",
            "ИМТ (кг/м²)",
            "СКФ (мл/мин)",
            "CHA₂DS₂-VASc",
            "HAS-BLED"
        ]
    }
    
@app.post("/calculate/euroscore")
async def get_euroscore(data: PatientData):
    prep = ClinicalEngine.get_preprocessed_values(data)
    result = ClinicalEngine.calculate_euroscore_ii(data, prep["cl_cr"])
    return {"euroscore_ii": result}

@app.post("/calculate/cci")
async def get_cci(data: PatientData):
    prep = ClinicalEngine.get_preprocessed_values(data)
    result = ClinicalEngine.calculate_cci(data, prep["cl_cr"])
    return {"cci_score": result}

@app.post("/calculate/bmi")
async def get_bmi(data: PatientData):
    prep = ClinicalEngine.get_preprocessed_values(data)
    return {"bmi": prep["bmi"]}

@app.post("/calculate/clcr")
async def get_clcr(data: PatientData):
    prep = ClinicalEngine.get_preprocessed_values(data)
    return {"cl_cr": round(prep["cl_cr"], 2)}

@app.post("/calculate/all")
async def calculate_all_metrics(data: PatientData):
    try:
        prep = ClinicalEngine.get_preprocessed_values(data)
        euroscore = ClinicalEngine.calculate_euroscore_ii(data, prep["cl_cr"])
        cci = ClinicalEngine.calculate_cci(data, prep["cl_cr"])
        
        # Считаем CHADS и HAS-BLED только если есть ФП
        chads = None
        has_bled = None
        if data.af:
            chads = ClinicalEngine.calculate_chads_vasc(data)
            has_bled = ClinicalEngine.calculate_has_bled(data)
        
        return {
            "status": "success",
            "EuroSCORE II (%)": euroscore,
            "Индекс коморбидности Чарлсона": cci,
            "Индекс Чарлсона": cci,
            "ИМТ (кг/м²)": prep["bmi"],
            "СКФ (мл/мин)": round(prep["cl_cr"], 1),
            "CHA₂DS₂-VASc": chads,
            "HAS-BLED": has_bled
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)