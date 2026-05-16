// Типы для Risk Predictor

export type RiskLevel = 'low' | 'medium' | 'high' | 'danger';

export interface TargetRiskItem {
  name: string;
  score: number;
  level: RiskLevel;
}

export interface PredictionResponse {
  risk_score: number;
  risk_level: RiskLevel;
  model_version: string;
  targets: TargetRiskItem[];
}

export interface MetricItem {
  value: number;
  label: string;
  level: RiskLevel;
}

export interface CalculatorResponse {
  status: string;
  metrics: Record<string, MetricItem>;
}

export interface PatientFeatures {
  'Пол (0=жен,1=муж)': number;
  'Возраст (лет)': number;
  'Рост (м)': number;
  'Вес (кг)': number;
  'Срочность (0=план,1=экстр)': number;
  'Гипертония (0/1)': number;
  'Сахарный диабет (0/1)': number;
  'ХОБЛ (0/1)': number;
  'ХБП'?: number;
  'Креатинин в ОРИТ (мкмоль/л)': number;
  'Категория ФВ ЛЖ': number;
  'ХСН ФК': number;
  pump: number;
  'ФП в анамнезе (0/1)': number;
  'Лёгочная гипертензия (0/1)'?: number;
  'ИМ в анамнезе (0/1)'?: number;
  'ХСН (0/1)'?: number;
  'ОНМК в анамнезе (0/1)'?: number;
  'Атеросклероз НК (0/1)'?: number;
  'Атеросклероз БЦА (0/1)'?: number;
  'Язвенная болезнь ЖКТ (0/1)'?: number;
  [key: string]: number | string | undefined;
}

export interface HistoryRecord {
  id: number;
  date: string;
  operationId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  model: string;
  euroscore: number;
  features: PatientFeatures;
  targets: TargetRiskItem[];
}

export interface FieldSchema {
  key: string;
  label: string;
  type: 'number' | 'select' | 'toggle';
  group: 'general' | 'anamnesis' | 'operation' | 'labs';
  default?: number | string;
  unit?: string;
  options?: { label: string; value: number | string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface ModelVersion {
  id: string;
  label: string;
  description?: string;
}
