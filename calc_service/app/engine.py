import math
from typing import Dict, Any
from calc_service.config import COEFFICIENTS, THRESHOLDS

class ClinicalEngine:
    
    # --- УНИВЕРСАЛЬНЫЙ СУПЕР-МАППЕР СТАТУСОВ ---
    @staticmethod
    def _get_status(value: float, config_key: str, mode: str = "max"):
        try:
            value = float(value)
            if math.isnan(value):
                return {"label": "Нет данных", "level": "danger"}
        except:
            return {"label": "Нет данных", "level": "danger"}

        stages = THRESHOLDS[config_key]

        if mode == "max":
            for stage in stages:
                if value <= stage["max"]:
                    return {"label": stage["label"], "level": stage["level"]}
        else:
            for stage in stages:
                if value >= stage["min"]:
                    return {"label": stage["label"], "level": stage["level"]}

        return {"label": "Неизвестный статус", "level": "danger"}
    @classmethod
    def interpret_bmi(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "bmi", "max")
    
    @classmethod
    def interpret_clcr(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "cl_cr", "min")
    
    @classmethod
    def interpret_cci(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "cci", "max")
    
    @classmethod
    def interpret_euroscore(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "euroscore", "max")
    
    @classmethod
    def interpret_chads(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "chads_vasc", "max")
    
    @classmethod
    def interpret_has_bled(cls, val: float) -> Dict[str, str]: return cls._get_status(val, "has_bled", "max")

    # --- МАТЕМАТИКА ---
    @staticmethod
    def calculate_bmi(weight: float, height: float) -> float:
        h_m = height / 100 if height > 3 else height
        return round(weight / (h_m ** 2), 2)

    @staticmethod
    def calculate_clcr(sex: int, age: int, weight: float, creatinine: float) -> float:
        safe_creat = max(creatinine, 70)
        cr_mg_dl = safe_creat / 88.4
        cl_cr = ((140 - age) * weight) / (72 * cr_mg_dl)
        return cl_cr * 0.85 if sex == 0 else cl_cr

    @classmethod
    # Simplified comorbidity index based on Charlson methodology
    def calculate_cci(cls, age: int, sex: int, weight: float, creatinine: float, **kwargs) -> int:
        cl_cr = cls.calculate_clcr(sex, age, weight, creatinine)
        score = 0
        if kwargs.get("mi"): score += 1
        if kwargs.get("chsn") or kwargs.get("lvef", 55) < 40: score += 1
        if kwargs.get("pad") or kwargs.get("bca"): score += 1
        if kwargs.get("stroke"): score += 1
        if kwargs.get("copd"): score += 1
        if kwargs.get("peptic_ulcer"): score += 1
        if kwargs.get("diabetes"): score += 1
        if cl_cr < 60: score += 2
        if age >= 50: score += min(4, (age - 40) // 10)
        return score

    @classmethod
    def calculate_euroscore_ii(cls, age: int, sex: int, weight: float, creatinine: float, **kwargs) -> float:
        cl_cr = cls.calculate_clcr(sex, age, weight, creatinine)
        z = COEFFICIENTS["intercept"]
        
        print(f"\n=== EUROSCORE II TRACE ===")
        print(f"START: z = {z:.6f}")
        print(f"Inputs: age={age}, sex={sex}, weight={weight}, creatinine={creatinine}")
        print(f"ClCr = {cl_cr:.2f} ml/min")
        print(f"kwargs = {kwargs}")
        
        if age > 60:
            addition = (age - 60) * COEFFICIENTS["age"]
            z += addition
            print(f"Age > 60: +{addition:.6f} → z = {z:.6f}")
            
        if sex == 0:
            z += COEFFICIENTS["sex_female"]
            print(f"Female: +{COEFFICIENTS['sex_female']:.6f} → z = {z:.6f}")
        
        if kwargs.get("pad") or kwargs.get("bca"):
            z += COEFFICIENTS["extracardiac"]
            print(f"Extracardiac: +{COEFFICIENTS['extracardiac']:.6f} → z = {z:.6f}")
            
        if kwargs.get("copd"):
            z += COEFFICIENTS["copd"]
            print(f"COPD: +{COEFFICIENTS['copd']:.6f} → z = {z:.6f}")
            
        if kwargs.get("diabetes"):
            z += COEFFICIENTS["diabetes_insulin"]
            print(f"Diabetes: +{COEFFICIENTS['diabetes_insulin']:.6f} → z = {z:.6f}")
            
        if kwargs.get("urgency") == 1:
            z += COEFFICIENTS["urgency_urgent"]
            print(f"Urgency: +{COEFFICIENTS['urgency_urgent']:.6f} → z = {z:.6f}")
        
        if cl_cr < 50:
            z += COEFFICIENTS["renal_lt_50"]
            print(f"Renal <50: +{COEFFICIENTS['renal_lt_50']:.6f} → z = {z:.6f}")
        elif cl_cr <= 85:
            z += COEFFICIENTS["renal_50_85"]
            print(f"Renal 50-85: +{COEFFICIENTS['renal_50_85']:.6f} → z = {z:.6f}")
        
        nyha = kwargs.get("nyha", 1)
        nyha_bonus = {2: COEFFICIENTS["nyha_2"], 3: COEFFICIENTS["nyha_3"], 4: COEFFICIENTS["nyha_4"]}.get(nyha, 0)
        z += nyha_bonus
        if nyha_bonus > 0:
            print(f"NYHA {nyha}: +{nyha_bonus:.6f} → z = {z:.6f}")
        
        lvef = kwargs.get("lvef", 55)
        if lvef <= 30:
            z += COEFFICIENTS["lv_le_30"]
            print(f"LVEF ≤30: +{COEFFICIENTS['lv_le_30']:.6f} → z = {z:.6f}")
        elif lvef <= 50:
            z += COEFFICIENTS["lv_31_50"]
            print(f"LVEF 31-50: +{COEFFICIENTS['lv_31_50']:.6f} → z = {z:.6f}")
        
        if kwargs.get("paph"):
            z += COEFFICIENTS["paph_mod"]
            print(f"PAPH: +{COEFFICIENTS['paph_mod']:.6f} → z = {z:.6f}")
        
        result = round((math.exp(z) / (1 + math.exp(z))) * 100, 2)
        print(f"FINAL z = {z:.6f} → EuroSCORE = {result}%")
        print(f"===============================\n")
        
        return result
    
    @staticmethod
    def calculate_chads_vasc(sex: int, age: int, **kwargs) -> int:
        score = 0
        if kwargs.get("chsn") or kwargs.get("lvef", 55) < 40: score += 1
        if kwargs.get("hypertension"): score += 1
        if age >= 75: score += 2
        elif age >= 65: score += 1
        if kwargs.get("diabetes"): score += 1
        if kwargs.get("stroke"): score += 2
        if kwargs.get("mi") or kwargs.get("pad") or kwargs.get("bca"): score += 1
        if sex == 0: score += 1
        return score

    @staticmethod
    def calculate_has_bled(age: int, creatinine: float, **kwargs) -> int:
        score = 0
        if kwargs.get("hypertension"): score += 1
        if creatinine > 200: score += 1
        if kwargs.get("stroke"): score += 1
        if kwargs.get("peptic_ulcer"): score += 1
        if age > 65: score += 1
        return score