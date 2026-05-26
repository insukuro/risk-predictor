import math
from typing import Dict, Any
from calc_service.config import COEFFICIENTS, THRESHOLDS

class ClinicalEngine:
    
    @staticmethod
    def _get_status(value: float, config_key: str, mode: str = "max"):
        stages = THRESHOLDS[config_key]
        if mode == "max":
            for stage in stages:
                if value <= stage["max"]:
                    return {"label": stage["label"], "level": stage["level"]}
        else:
            for stage in stages:
                if value >= stage["min"]:
                    return {"label": stage["label"], "level": stage["level"]}
        return {"label": "Критический уровень", "level": "danger"}

    @classmethod
    def interpret_bmi(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "bmi", "max")
    @classmethod
    def interpret_clcr(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "cl_cr", "min")
    @classmethod
    def interpret_euroscore(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "euroscore", "max")
    @classmethod
    def interpret_crusade(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "crusade", "max")
    @classmethod
    def interpret_caprini(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "caprini", "max")
    @classmethod
    def interpret_chads(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "chads_vasc", "max")
    @classmethod
    def interpret_delirium(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "pre_deliric", "max")
    @classmethod
    def interpret_cleveland(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "cleveland_thakar", "max")
    @classmethod
    def interpret_resp(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "resp_failure", "max")
    @classmethod
    def interpret_nhsn(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "nhsn_infection", "max")

    @staticmethod
    def calculate_bmi(weight: float, height: float) -> float:
        h_m = height / 100 if height > 3 else height
        return round(weight / (h_m ** 2), 2)

    @staticmethod
    def calculate_clcr(sex: int, age: int, weight: float, creatinine_mkmol: float) -> float:
        cr_mg_dl = creatinine_mkmol / 88.4
        if cr_mg_dl <= 0: cr_mg_dl = 0.8
        cl_cr = ((140 - age) * weight) / (72 * cr_mg_dl)
        return round(cl_cr * 0.85 if sex == 0 else cl_cr, 2)

    @classmethod
    def calculate_euroscore_ii(cls, data: Any = None, **kwargs) -> float:
        # Двойной интерфейс: если пришел объект схемы, читаем из него, иначе из kwargs
        src = data if data is not None else type('Obj', (object,), kwargs)()
        
        coef = COEFFICIENTS["euroscore_coefficients"]
        z = coef["intercept"]
        
        # Защита от отсутствующих полей в старых API-запросах
        age = getattr(src, "age", kwargs.get("age", 60))
        sex = getattr(src, "sex", kwargs.get("sex", 1))
        creatinine = getattr(src, "creatinine", kwargs.get("creatinine", 85.0))
        weight = getattr(src, "weight", kwargs.get("weight", 75.0))
        
        if age > 60: z += (age - 60) * coef["age"]
        if sex == 0: z += coef["sex_female"]
        
        if getattr(src, "extracardiac_pathology", kwargs.get("pad", 0)) or kwargs.get("bca", 0): z += coef["extracardiac"]
        if getattr(src, "copd", kwargs.get("copd", 0)): z += coef["copd"]
        if getattr(src, "neurological_dysfunction", 0): z += coef["neuro_dysfunction"]
        if getattr(src, "previous_cardiac_surgery", 0): z += coef["prev_cardiac"]
        if getattr(src, "active_endocarditis", 0): z += coef["active_endocarditis"]
        if getattr(src, "critical_preop_state", 0): z += coef["critical_state"]
        if getattr(src, "recent_mi", 0): z += coef["recent_mi"]
        if getattr(src, "diabetes_insulin", kwargs.get("diabetes", 0)): z += coef["diabetes_insulin"]
        
        urgency = getattr(src, "urgency", kwargs.get("urgency", 0))
        if urgency >= 1: z += coef["urgency_urgent"]
            
        if creatinine > 200:
            z += coef["renal_lt_50"]
        else:
            cl_cr = cls.calculate_clcr(sex, age, weight, creatinine)
            if cl_cr < 50: z += coef["renal_lt_50"]
            elif cl_cr <= 85: z += coef["renal_50_85"]
            
        paph_val = getattr(src, "paph_val", 25.0) if data is not None else float(kwargs.get("paph", 0) * 35.0) # Для старой совместимости
        if paph_val > 30: z += coef["paph_mod"]
            
        lvef = getattr(src, "lvef", kwargs.get("lvef", 55.0))
        if lvef <= 30 or lvef == 3: z += coef["lv_le_30"] # поддержка старых категорий (1,2,3) и новых (%)
        elif lvef <= 50 or lvef == 2: z += coef["lv_31_50"]
            
        return round((math.exp(z) / (1 + math.exp(z))) * 100, 2)

    @classmethod
    def calculate_cci(cls, data: Any = None, **kwargs) -> int:
        src = data if data is not None else type('Obj', (object,), kwargs)()
        
        age = getattr(src, "age", kwargs.get("age", 60))
        sex = getattr(src, "sex", kwargs.get("sex", 1))
        weight = getattr(src, "weight", kwargs.get("weight", 75.0))
        creatinine = getattr(src, "creatinine", kwargs.get("creatinine", 85.0))
        
        cl_cr = cls.calculate_clcr(sex, age, weight, creatinine)
        score = 0
        
        if getattr(src, "recent_mi", kwargs.get("mi", 0)): score += 1
        if getattr(src, "chsn", kwargs.get("chsn", 0)): score += 1
        if getattr(src, "extracardiac_pathology", kwargs.get("pad", 0)) or kwargs.get("bca", 0): score += 1
        if getattr(src, "stroke_history", kwargs.get("stroke", 0)): score += 1
        if getattr(src, "copd", kwargs.get("copd", 0)): score += 1
        if kwargs.get("peptic_ulcer", 0): score += 1
        if getattr(src, "diabetes", kwargs.get("diabetes", 0)): score += 1
        if cl_cr < 60: score += 2
        if age >= 50: score += min(4, (age - 40) // 10)
        return score
    
    @staticmethod
    def calculate_bmi(weight: float, height: float) -> float:
        h_m = height / 100 if height > 3 else height
        return round(weight / (h_m ** 2), 2)

    @staticmethod
    def calculate_clcr(sex: int, age: int, weight: float, creatinine_mkmol: float) -> float:
        cr_mg_dl = creatinine_mkmol / 88.4
        if cr_mg_dl <= 0: cr_mg_dl = 0.8
        cl_cr = ((140 - age) * weight) / (72 * cr_mg_dl)
        return round(cl_cr * 0.85 if sex == 0 else cl_cr, 2)

    @classmethod
    def calculate_euroscore_ii(cls, data: Any) -> float:
        coef = COEFFICIENTS["euroscore_coefficients"]
        z = coef["intercept"]
        
        # Базовые демографические метрики
        if data.age > 60: z += (data.age - 60) * coef["age"]
        if data.sex == 0: z += coef["sex_female"]
        
        # Коморбидность по ТЗ
        if data.extracardiac_pathology: z += coef["extracardiac"]
        if data.copd: z += coef["copd"]
        if data.neurological_dysfunction: z += coef["neuro_dysfunction"]
        if data.previous_cardiac_surgery: z += coef["prev_cardiac"]
        if data.active_endocarditis: z += coef["active_endocarditis"]
        if data.critical_preop_state: z += coef["critical_state"]
        if data.recent_mi: z += coef["recent_mi"]
        if data.diabetes_insulin: z += coef["diabetes_insulin"]
        
        # Экстренность
        if data.urgency >= 1: z += coef["urgency_urgent"]
            
        # Функция почек (с учетом порога >200 мкмоль/л из ТЗ)
        if data.creatinine > 200:
            z += coef["renal_lt_50"]  # По ТЗ "особый учет" (соответствует терминальному снижению клиренса)
        else:
            cl_cr = cls.calculate_clcr(data.sex, data.age, data.weight, data.creatinine)
            if cl_cr < 50: z += coef["renal_lt_50"]
            elif cl_cr <= 85: z += coef["renal_50_85"]
            
        # Лёгочная гипертензия
        if data.paph_val > 55: z += coef["paph_mod"]
        elif data.paph_val > 30: z += coef["paph_mod"]
            
        # Фракция выброса ЛЖ
        if data.lvef <= 30: z += coef["lv_le_30"]
        elif data.lvef <= 50: z += coef["lv_31_50"]
            
        return round((math.exp(z) / (1 + math.exp(z))) * 100, 2)

    @classmethod
    def calculate_crusade(cls, data: Any) -> int:
        score = 0
        # 1. Гематокрит
        if data.hematocrit < 31.0: score += 9
        elif 31.0 <= data.hematocrit <= 35.9: score += 7
        
        # 2. Клиренс Креатинина
        cl_cr = cls.calculate_clcr(data.sex, data.age, data.weight, data.creatinine)
        if cl_cr < 15.0: score += 39
        elif 15.0 <= cl_cr <= 30.0: score += 35
        elif 31.0 <= cl_cr <= 60.0: score += 28
        elif 61.0 <= cl_cr <= 90.0: score += 17
        
        # 3. ЧСС
        if 71 <= data.heart_rate <= 80: score += 1
        elif 81 <= data.heart_rate <= 90: score += 3
        elif 91 <= data.heart_rate <= 100: score += 6
        elif 101 <= data.heart_rate <= 110: score += 8
        elif data.heart_rate > 110: score += 11
        
        # 4. Пол
        if data.sex == 0: score += 8
        
        # 5. ХСН
        if data.chsn: score += 7
        
        # 6. Диабет
        if data.diabetes: score += 6
        
        # 7. САД (Систолическое АД) - Строгая математика интервалов ТЗ
        if data.systolic_bp <= 90: score += 10 # Граница шокового состояния
        elif 91 <= data.systolic_bp <= 100: score += 10
        elif 101 <= data.systolic_bp <= 120: score += 5
        elif data.systolic_bp > 180: score += 1
            
        return score

    @classmethod
    def calculate_caprini(cls, data: Any) -> int:
        score = 0
        bmi = cls.calculate_bmi(data.weight, data.height)
        
        # 1 балл
        if 41 <= data.age <= 60: score += 1
        if bmi > 25.0: score += 1
        if data.caprini_edema: score += 1
        if data.caprini_varicose: score += 1
        if data.caprini_pregnancy_loss: score += 1
        if data.caprini_oc_hrt: score += 1
        if data.caprini_sepsis_month: score += 1
        if data.copd: score += 1
        if data.recent_mi: score += 1
        if data.chsn: score += 1
        if data.caprini_ibd: score += 1
        
        # 2 балла
        if 61 <= data.age <= 74: score += 2
        if data.caprini_arthroscopy: score += 2
        if data.caprini_malignancy: score += 2
        if data.caprini_immobilization: score += 2
        if data.caprini_plaster: score += 2
        if data.caprini_cvc: score += 2
        if data.cpb_duration > 45.0: score += 2  # Длительность операции >45 мин
        if data.previous_cardiac_surgery: score += 2  # Повторная большая операция
        
        # 3 балла
        if data.age >= 75: score += 3
        if data.caprini_vte_history: score += 3
        if data.caprini_family_vte: score += 3
        if data.caprini_thrombophilia: score += 3
        
        # 5 баллов
        if data.caprini_stroke_month: score += 5
        if data.caprini_arthroplasty: score += 5
        if data.caprini_fracture: score += 5
        if data.caprini_spine_injury: score += 5
        
        return score

    @staticmethod
    def calculate_chads_vasc(data: Any) -> int:
        score = 0
        if data.chsn or data.lvef < 40: score += 1
        if data.hypertension: score += 1
        if data.age >= 75: score += 2
        elif data.age >= 65: score += 1
        if data.diabetes: score += 1
        if data.stroke_history: score += 2
        if data.recent_mi or data.extracardiac_pathology: score += 1 # ИМ / Сосудистые поражения
        if data.sex == 0: score += 1
        return score

    @staticmethod
    def calculate_pre_deliric(data: Any) -> float:
        coma_map = {0: 0.0, 1: 0.2578, 2: 1.0721, 3: 1.3361}
        adm_map = {0: 0.0, 1: 0.1446, 2: 0.5316, 3: 0.6516}
        morph_map = {0: 0.0, 1: 0.1926, 2: 0.0625, 3: 0.2414}
        
        lin_pred = (-4.0367 
                    + 0.0183 * data.age 
                    + 0.0272 * data.delirium_apache
                    + coma_map.get(data.delirium_coma_type, 0.0)
                    + adm_map.get(data.delirium_admission_type, 0.0)
                    + 0.4965 * (1 if data.delirium_infection else 0)
                    + 0.1378 * (1 if data.delirium_acidosis else 0)
                    + morph_map.get(data.delirium_morphine, 0.0)
                    + 0.6581 * (1 if data.delirium_sedatives else 0)
                    + 0.0141 * data.urea
                    + 0.1891 * (1 if data.urgency >= 1 else 0))
        
        prob = 1 / (1 + math.exp(-lin_pred))
        return round(prob * 100, 1)

    @staticmethod
    def calculate_cleveland_thakar(data: Any) -> int:
        score = 0
        if data.sex == 0: score += 1
        if data.chsn: score += 1
        if data.lvef < 35: score += 1
        if data.iabp: score += 2
        if data.copd: score += 1
        if data.diabetes_insulin: score += 1
        if data.previous_cardiac_surgery: score += 1
        if data.urgency >= 2: score += 2  # Экстренная операция
        
        # Объем вмешательства
        if data.operation_type == 1: score += 1
        elif data.operation_type >= 2: score += 2
        
        # Креатинин сыворотки (перевод мкмоль/л строго в мг/дл)
        cr_mg_dl = data.creatinine / 88.4
        if cr_mg_dl >= 2.1: score += 5  # Исправлено пограничное условие
        elif 1.2 <= cr_mg_dl < 2.1: score += 2
            
        return score

    @classmethod
    def calculate_resp_failure(cls, data: Any) -> int:
        score = 0
        bmi = cls.calculate_bmi(data.weight, data.height)
        if data.age > 65: score += 1
        if data.urgency >= 2: score += 1
        if data.cpb_duration > 120.0: score += 1
        if bmi > 30.0: score += 1
        return score

    @classmethod
    def calculate_nhsn_infection(cls, data: Any) -> int:
        # Базовый NHSN Индекс (0-3 балла)
        base_score = 0
        if data.op_duration_long: base_score += 1
        if data.nhsn_asa_class >= 3: base_score += 1
        if data.nhsn_dirty_wound: base_score += 1
        
        # Дополнительные предикторы из ТЗ: каждый добавляет по 1 условному баллу тяжести риска
        additional_risk_factors = 0
        bmi = cls.calculate_bmi(data.weight, data.height)
        
        if data.diabetes: additional_risk_factors += 1
        if bmi > 30.0: additional_risk_factors += 1
        if data.op_duration_long: additional_risk_factors += 1
        if data.previous_cardiac_surgery: additional_risk_factors += 1  # Реоперация
        if data.nhsn_immunosuppression: additional_risk_factors += 1
            
        # Возвращаем интегрированную сумму тяжести
        return base_score + additional_risk_factors