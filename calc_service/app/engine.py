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
        # Защита от нулевого/отрицательного роста и веса
        if height <= 0 or weight <= 0:
            return 0.0
        h_m = height / 100 if height > 3 else height
        if h_m <= 0:
            return 0.0
        return round(weight / (h_m ** 2), 2)

    @staticmethod
    def calculate_clcr(sex: int, age: int, weight: float, creatinine_mkmol: float) -> float:
        # Защита от нулевого/отрицательного креатинина
        if creatinine_mkmol <= 0:
            creatinine_mkmol = 88.4  # ~1.0 мг/дл по умолчанию
        cr_mg_dl = creatinine_mkmol / 88.4
        if cr_mg_dl <= 0:
            cr_mg_dl = 0.8
        # Защита от отрицательного возраста и веса
        if age < 0:
            age = 60
        if weight <= 0:
            weight = 75.0
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

    @classmethod
    def calculate_crusade(cls, data: Any) -> int:
        score = 0
        # 1. Гематокрит
        hematocrit = getattr(data, "hematocrit", 40.0)
        if hematocrit < 31.0: score += 9
        elif 31.0 <= hematocrit <= 35.9: score += 7
        
        # 2. Клиренс Креатинина
        sex = getattr(data, "sex", 1)
        age = getattr(data, "age", 60)
        weight = getattr(data, "weight", 75.0)
        creatinine = getattr(data, "creatinine", 85.0)
        cl_cr = cls.calculate_clcr(sex, age, weight, creatinine)
        if cl_cr < 15.0: score += 39
        elif 15.0 <= cl_cr <= 30.0: score += 35
        elif 31.0 <= cl_cr <= 60.0: score += 28
        elif 61.0 <= cl_cr <= 90.0: score += 17
        
        # 3. ЧСС
        heart_rate = getattr(data, "heart_rate", 75.0)
        if 71 <= heart_rate <= 80: score += 1
        elif 81 <= heart_rate <= 90: score += 3
        elif 91 <= heart_rate <= 100: score += 6
        elif 101 <= heart_rate <= 110: score += 8
        elif heart_rate > 110: score += 11
        
        # 4. Пол
        if sex == 0: score += 8
        
        # 5. ХСН
        if getattr(data, "chsn", 0): score += 7
        
        # 6. Диабет
        if getattr(data, "diabetes", 0): score += 6
        
        # 7. САД (Систолическое АД) - Строгая математика интервалов ТЗ
        systolic_bp = getattr(data, "systolic_bp", 120.0)
        if systolic_bp <= 90: score += 10 # Граница шокового состояния
        elif 91 <= systolic_bp <= 100: score += 10
        elif 101 <= systolic_bp <= 120: score += 5
        elif systolic_bp > 180: score += 1
            
        return score

    @classmethod
    def calculate_caprini(cls, data: Any) -> int:
        score = 0
        weight = getattr(data, "weight", 75.0)
        height = getattr(data, "height", 175.0)
        bmi = cls.calculate_bmi(weight, height)
        
        age = getattr(data, "age", 60)
        
        # 1 балл
        if 41 <= age <= 60: score += 1
        if bmi > 25.0: score += 1
        if getattr(data, "caprini_edema", 0): score += 1
        if getattr(data, "caprini_varicose", 0): score += 1
        if getattr(data, "caprini_pregnancy_loss", 0): score += 1
        if getattr(data, "caprini_oc_hrt", 0): score += 1
        if getattr(data, "caprini_sepsis_month", 0): score += 1
        if getattr(data, "copd", 0): score += 1
        if getattr(data, "recent_mi", 0): score += 1
        if getattr(data, "chsn", 0): score += 1
        if getattr(data, "caprini_ibd", 0): score += 1
        
        # 2 балла
        if 61 <= age <= 74: score += 2
        if getattr(data, "caprini_arthroscopy", 0): score += 2
        if getattr(data, "caprini_malignancy", 0): score += 2
        if getattr(data, "caprini_immobilization", 0): score += 2
        if getattr(data, "caprini_plaster", 0): score += 2
        if getattr(data, "caprini_cvc", 0): score += 2
        if getattr(data, "cpb_duration", 0) > 45.0: score += 2  # Длительность операции >45 мин
        if getattr(data, "previous_cardiac_surgery", 0): score += 2  # Повторная большая операция
        
        # 3 балла
        if age >= 75: score += 3
        if getattr(data, "caprini_vte_history", 0): score += 3
        if getattr(data, "caprini_family_vte", 0): score += 3
        if getattr(data, "caprini_thrombophilia", 0): score += 3
        
        # 5 баллов
        if getattr(data, "caprini_stroke_month", 0): score += 5
        if getattr(data, "caprini_arthroplasty", 0): score += 5
        if getattr(data, "caprini_fracture", 0): score += 5
        if getattr(data, "caprini_spine_injury", 0): score += 5
        
        return score

    @staticmethod
    def calculate_chads_vasc(data: Any) -> int:
        score = 0
        if getattr(data, "chsn", 0) or getattr(data, "lvef", 55.0) < 40: score += 1
        if getattr(data, "hypertension", 0): score += 1
        age = getattr(data, "age", 60)
        if age >= 75: score += 2
        elif age >= 65: score += 1
        if getattr(data, "diabetes", 0): score += 1
        if getattr(data, "stroke_history", 0): score += 2
        if getattr(data, "recent_mi", 0) or getattr(data, "extracardiac_pathology", 0): score += 1 # ИМ / Сосудистые поражения
        if getattr(data, "sex", 1) == 0: score += 1
        return score

    @staticmethod
    def calculate_cleveland_thakar(data: Any) -> int:
        score = 0
        if getattr(data, "sex", 1) == 0: score += 1
        if getattr(data, "chsn", 0): score += 1
        if getattr(data, "lvef", 55.0) < 35: score += 1
        if getattr(data, "iabp", 0): score += 2
        if getattr(data, "copd", 0): score += 1
        if getattr(data, "diabetes_insulin", 0): score += 1
        if getattr(data, "previous_cardiac_surgery", 0): score += 1
        if getattr(data, "urgency", 0) >= 2: score += 2  # Экстренная операция
        
        # Объем вмешательства
        operation_type = getattr(data, "operation_type", 0)
        if operation_type == 1: score += 1
        elif operation_type >= 2: score += 2
        
        # Креатинин сыворотки (перевод мкмоль/л строго в мг/дл)
        creatinine = getattr(data, "creatinine", 85.0)
        cr_mg_dl = creatinine / 88.4
        if cr_mg_dl >= 2.1: score += 5  # Исправлено пограничное условие
        elif 1.2 <= cr_mg_dl < 2.1: score += 2
            
        return score

    
    @classmethod
    def calculate_pre_deliric(cls, data: Any = None, **kwargs) -> float:
        age = getattr(data, "age", kwargs.get("age", 60))
        apache = getattr(data, "delirium_apache", kwargs.get("delirium_apache", 15))
        coma_type = getattr(data, "delirium_coma_type", kwargs.get("delirium_coma_type", 0))
        admission_type = getattr(data, "delirium_admission_type", kwargs.get("delirium_admission_type", 0))
        infection = getattr(data, "delirium_infection", kwargs.get("delirium_infection", 0))
        acidosis = getattr(data, "delirium_acidosis", kwargs.get("delirium_acidosis", 0))
        morphine = getattr(data, "delirium_morphine", kwargs.get("delirium_morphine", 0))
        sedatives = getattr(data, "delirium_sedatives", kwargs.get("delirium_sedatives", 0))
        urea = getattr(data, "urea", kwargs.get("urea", 6.0))
        urgency = getattr(data, "urgency", kwargs.get("urgency", 0)) # Защищено от AttributeError

        # Пример расчета логит-предикции делирия
        z = -3.87 + (0.025 * age) + (0.055 * apache) + (0.45 * infection) + (0.35 * acidosis)
        if coma_type > 0: z += 0.85
        if admission_type == 1: z += 0.3
        if morphine > 0: z += 0.25
        if sedatives: z += 0.6
        if urgency >= 1: z += 0.1891
        if urea > 7.0: z += 0.2

        prob = (math.exp(z) / (1 + math.exp(z))) * 100
        return round(prob, 2)

    @classmethod
    def calculate_resp_failure(cls, data: Any = None, **kwargs) -> int:
        weight = getattr(data, "weight", kwargs.get("weight", 75.0))
        height = getattr(data, "height", kwargs.get("height", 175.0))
        bmi = cls.calculate_bmi(weight, height) # Безопасный расчет

        age = getattr(data, "age", kwargs.get("age", 60))
        copd = getattr(data, "copd", kwargs.get("copd", 0))
        op_type = getattr(data, "operation_type", kwargs.get("operation_type", 0))
        urgency = getattr(data, "urgency", kwargs.get("urgency", 0))
        cpb = getattr(data, "cpb_duration", kwargs.get("cpb_duration", 90.0))

        score = 0
        if age > 65: score += 1
        if copd: score += 1
        if bmi > 30: score += 1
        if op_type >= 2: score += 1
        if urgency >= 1: score += 1
        if cpb > 120: score += 1
        return score

    @classmethod
    def calculate_nhsn_infection(cls, data: Any = None, **kwargs) -> int:
        weight = getattr(data, "weight", kwargs.get("weight", 75.0))
        height = getattr(data, "height", kwargs.get("height", 175.0))
        bmi = cls.calculate_bmi(weight, height) # Безопасный расчет

        dirty_wound = getattr(data, "nhsn_dirty_wound", kwargs.get("nhsn_dirty_wound", 0))
        asa_class = getattr(data, "nhsn_asa_class", kwargs.get("nhsn_asa_class", 2))
        immuno = getattr(data, "nhsn_immunosuppression", kwargs.get("nhsn_immunosuppression", 0))
        long_op = getattr(data, "op_duration_long", kwargs.get("op_duration_long", 0))

        score = 0
        if dirty_wound: score += 2
        if asa_class >= 3: score += 1
        if bmi > 35: score += 1
        if immuno: score += 1
        if long_op: score += 1
        return score