/**
 * API client for communicating with Risk Predictor backend
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface PatientCreate {
  sex: string;
  birth_date: string;
}

interface PatientResponse {
  id: number;
  sex: string;
  birth_date: string;
  created_at: string;
}

interface OperationCreate {
  patient_id: number;
  type: string;
  date: string;
}

interface OperationResponse {
  id: number;
  patient_id: number;
  type: string;
  date: string;
  created_at: string;
}

interface PredictRequest {
  patient: {
    id: number | null;
    sex: string;
    birth_date: string;
  };
  operation: {
    type: string;
    date: string;
  };
  features: {
    age: number;
    blood_pressure: number;
    cholesterol: number;
    diabetes: boolean;
    smoking: boolean;
  };
}

interface PredictResponse {
  prediction_id: number;
  risk_score: number;
  risk_level: string;
  model_version: string;
  created_at: string;
}

interface PredictionRecord {
  id: number;
  operation_id: number;
  patient_id: number;
  risk_score: number;
  risk_level: string;
  model_version: string;
  created_at: string;
}

interface ModelInfo {
  version: string;
  features: string[];
}

class RiskPredictorAPI {
  private apiUrl: string;

  constructor(apiUrl: string = API_URL) {
    this.apiUrl = apiUrl;
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: unknown
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Health Check
  async healthCheck(): Promise<{ status: string }> {
    return this.request('/health');
  }

  // Patient endpoints
  async createPatient(patient: PatientCreate): Promise<PatientResponse> {
    return this.request('/patients', 'POST', patient);
  }

  async getPatient(patientId: number): Promise<PatientResponse> {
    return this.request(`/patients/${patientId}`);
  }

  // Operation endpoints
  async createOperation(operation: OperationCreate): Promise<OperationResponse> {
    return this.request('/operations', 'POST', operation);
  }

  // Prediction endpoints
  async predict(request: PredictRequest): Promise<PredictResponse> {
    return this.request('/predict', 'POST', request);
  }

  async getPredictions(patientId?: number): Promise<PredictionRecord[]> {
    const endpoint = patientId
      ? `/predictions?patient_id=${patientId}`
      : '/predictions';
    return this.request(endpoint);
  }

  async getPrediction(predictionId: number): Promise<PredictionRecord> {
    return this.request(`/predictions/${predictionId}`);
  }

  // Model endpoint
  async getModelInfo(): Promise<ModelInfo> {
    return this.request('/model/info');
  }
}

export default new RiskPredictorAPI();
export type {
  PatientCreate,
  PatientResponse,
  OperationCreate,
  OperationResponse,
  PredictRequest,
  PredictResponse,
  PredictionRecord,
  ModelInfo,
};
