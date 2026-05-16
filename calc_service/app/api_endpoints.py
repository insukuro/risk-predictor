from fastapi import APIRouter
from .schemas import BMISchema, ClCrSchema, CCISchema, EuroScoreSchema
from .engine import ClinicalEngine

router = APIRouter(prefix="/api/v1/calculate", tags=["Pure Machine API"])

@router.post("/bmi")
async def api_bmi(data: BMISchema):
    return {"bmi": ClinicalEngine.calculate_bmi(data.weight, data.height)}

@router.post("/clcr")
async def api_clcr(data: ClCrSchema):
    return {"cl_cr": round(ClinicalEngine.calculate_clcr(data.sex, data.age, data.weight, data.creatinine), 2)}

@router.post("/cci")
async def api_cci(data: CCISchema):
    return {"cci_score": ClinicalEngine.calculate_cci(**data.model_dump())}

@router.post("/euroscore")
async def api_euroscore(data: EuroScoreSchema):
    return {"euroscore_ii": ClinicalEngine.calculate_euroscore_ii(**data.model_dump())}