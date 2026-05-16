from fastapi import APIRouter, HTTPException
from .schemas import PatientData, UIAllMetricsResponse
from .engine import ClinicalEngine

router = APIRouter(prefix="/ui", tags=["Frontend UI Endpoints"])

CALCULATOR_MAPS = {
    "euroscore": {"label": "EuroSCORE II", "fields": ["age", "sex", "weight", "creatinine", "pad", "bca", "copd", "diabetes", "urgency", "nyha", "lvef", "paph"]},
    "cci": {"label": "Индекс Чарлсона", "fields": ["age", "sex", "weight", "creatinine", "mi", "chsn", "lvef", "pad", "bca", "stroke", "copd", "peptic_ulcer", "diabetes"]},
    "bmi": {"label": "ИМТ", "fields": ["weight", "height"]},
    "clcr": {"label": "Клиренс креатинина", "fields": ["sex", "age", "weight", "creatinine"]}
}

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

@router.post("/calculate-all", response_model=UIAllMetricsResponse)
async def ui_calculate_all(data: PatientData):
    try:
        raw_dump = data.model_dump()
        bmi = ClinicalEngine.calculate_bmi(data.weight, data.height)
        cl_cr = ClinicalEngine.calculate_clcr(data.sex, data.age, data.weight, data.creatinine)
        euro = ClinicalEngine.calculate_euroscore_ii(**raw_dump)
        cci = ClinicalEngine.calculate_cci(**raw_dump)
        
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
        
        if data.af:
            chads = ClinicalEngine.calculate_chads_vasc(**raw_dump)
            has_b = ClinicalEngine.calculate_has_bled(**raw_dump)
            metrics["CHA₂DS₂-VASc"] = {"value": float(chads), **ClinicalEngine.interpret_chads(chads)}
            metrics["HAS-BLED"] = {"value": float(has_b), **ClinicalEngine.interpret_has_bled(has_b)}
            
        return {"status": "success", "metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))