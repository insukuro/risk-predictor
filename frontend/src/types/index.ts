// =====================
// API Response Types
// =====================

// UI Schema Types
export interface FieldOption {
  value: number | string; // Изменено на number | string для поддержки кириллических/римских текстовых опций бэкенда
  label: string;
}

export interface UIField {
  id: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  order: number;
  min: number | null;
  max: number | null;
  step: number | null;
  placeholder: string;
  options: FieldOption[];
}

export interface FormBlock {
  block_name: string;
  fields: UIField[];
}

export interface UISchema {
  form_blocks: FormBlock[];
  calculated_metrics_needed: string[];
}

export interface SchemaResponse {
  available_versions: string[];
  current_version: string;
  ui_schema: UISchema;
}

// =====================
// Prediction Types
// =====================

export interface TargetRiskItem {
  name: string;
  score: number;
  level: 'low' | 'medium' | 'high' | 'danger';
}

export interface PredictResponse {
  prediction_id?: number;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'danger';
  model_version: string;
  created_at?: string;
  saved: boolean;
  targets: TargetRiskItem[];
}

export interface PredictRequest {
  features: Record<string, any>;
  model_version?: string;
  operation_id?: number;
}

// =====================
// History Types
// =====================

export interface HistoryItem {
  id: number;
  prediction_id?: number;
  patient_id?: number;
  operation_id?: number;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'danger';
  model_version: string;
  created_at: string;
  features?: Record<string, any>;
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
  skip: number;
  limit: number;
}

// =====================
// Calculator Types
// =====================

export interface CalculatorInfo {
  label: string;
  required_inputs: string[];
}

export interface CalculatorMetadata {
  required_inputs: string[];
  categorical_inputs: string[];
  calculators: Record<string, CalculatorInfo>;
}

export interface UIResultItem {
  value: number;
  label: string;
  level: 'low' | 'medium' | 'high' | 'danger';
}

export interface UIAllMetricsResponse {
  status: string;
  metrics: Record<string, UIResultItem>;
}

// =====================
// Patient Types
// =====================

export interface Patient {
  id: number;
  sex: string;
  birth_date: string;
  created_at: string;
  age?: number;
}

export interface PatientCreate {
  sex: 'male' | 'female' | 'other';
  birth_date: string;
}

// =====================
// Operation Types
// =====================

export interface Operation {
  id: number;
  patient_id: number;
  type: string;
  date: string;
  created_at: string;
}

// =====================
// Form State Types
// =====================

export type FormValues = Record<string, number | string | boolean | null>;

export interface ValidationError {
  field: string;
  message: string;
}

// =====================
// Excel Import Types
// =====================

export interface ExcelRow {
  rowIndex: number;
  data: Record<string, any>;
}

export interface ExcelParseResult {
  headers: string[];
  rows: ExcelRow[];
  totalRows: number;
}

// =====================
// Clipboard Parse Types
// =====================

export interface ClipboardParseResult {
  success: boolean;
  filledFields: number;
  totalFields: number;
  values: Record<string, any>;
}