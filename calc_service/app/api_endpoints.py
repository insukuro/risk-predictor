from fastapi import APIRouter
from .schemas import BMISchema, CapriniSchema, ChadsVascSchema, ClCrSchema, CCISchema, ClevelandThakarSchema, CrusadeSchema, EuroScoreSchema, NhsnInfectionSchema, PreDeliricSchema, RespFailureSchema
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
    return {"cci_score": ClinicalEngine.calculate_cci(data=data)} # Изменено с **data.model_dump()

@router.post("/euroscore")
async def api_euroscore(data: EuroScoreSchema):
    return {"euroscore_ii": ClinicalEngine.calculate_euroscore_ii(data=data)} # Изменено с **data.model_dump()

@router.post("/crusade")
async def api_crusade(data: CrusadeSchema):
    return {"crusade_score": ClinicalEngine.calculate_crusade(data=data)}

@router.post("/caprini")
async def api_caprini(data: CapriniSchema):
    return {"caprini_score": ClinicalEngine.calculate_caprini(data=data)}

@router.post("/chads-vasc")
async def api_chads_vasc(data: ChadsVascSchema):
    return {"chads_vasc_score": ClinicalEngine.calculate_chads_vasc(data=data)}

@router.post("/pre-deliric")
async def api_pre_deliric(data: PreDeliricSchema):
    return {"pre_deliric_probability": ClinicalEngine.calculate_pre_deliric(data=data)}

@router.post("/cleveland-thakar")
async def api_cleveland_thakar(data: ClevelandThakarSchema):
    return {"cleveland_thakar_score": ClinicalEngine.calculate_cleveland_thakar(data=data)}

@router.post("/resp-failure")
async def api_resp_failure(data: RespFailureSchema):
    return {"resp_failure_score": ClinicalEngine.calculate_resp_failure(data=data)}

@router.post("/nhsn-infection")
async def api_nhsn_infection(data: NhsnInfectionSchema):
    return {"nhsn_infection_score": ClinicalEngine.calculate_nhsn_infection(data=data)}