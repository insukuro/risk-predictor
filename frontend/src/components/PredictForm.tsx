import { useState } from 'react';
import api, { type PredictRequest } from '../api';
import './PredictForm.css';

interface PredictFormProps {
  patientId: number;
  onPredictionCreated: (predictionId: number) => void;
}

function PredictForm({ patientId, onPredictionCreated }: PredictFormProps) {
  const [sex, setSex] = useState('male');
  const [birthDate, setBirthDate] = useState('');
  const [operationType, setOperationType] = useState('CABG');
  const [operationDate, setOperationDate] = useState('');
  const [age, setAge] = useState('');
  const [bloodPressure, setBloodPressure] = useState('140');
  const [cholesterol, setCholesterol] = useState('5.5');
  const [diabetes, setDiabetes] = useState(false);
  const [smoking, setSmoking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPrediction(null);

    // Validate inputs
    if (!age || !operationDate) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsLoading(true);

      const request: PredictRequest = {
        patient: {
          id: patientId,
          sex,
          birth_date: birthDate || new Date().toISOString().split('T')[0],
        },
        operation: {
          type: operationType,
          date: operationDate,
        },
        features: {
          age: parseInt(age),
          blood_pressure: parseInt(bloodPressure),
          cholesterol: parseFloat(cholesterol),
          diabetes,
          smoking,
        },
      };

      const response = await api.predict(request);
      setPrediction(response);
      onPredictionCreated(response.prediction_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make prediction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="predict-form-card">
      <h2>Risk Prediction</h2>

      {error && <div className="error">{error}</div>}
      {prediction && (
        <div className="prediction-result">
          <h3>Prediction Result</h3>
          <div className={`risk-score ${prediction.risk_level}`}>
            <p>Risk Score: {(prediction.risk_score * 100).toFixed(1)}%</p>
            <p className="risk-level">Risk Level: {prediction.risk_level.toUpperCase()}</p>
          </div>
          <p>Model Version: {prediction.model_version}</p>
        </div>
      )}

      {!prediction && (
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Patient Information</legend>
            
            <div className="form-group">
              <label htmlFor="sex">Sex:</label>
              <select
                id="sex"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                disabled={isLoading}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="birthDate">Birth Date:</label>
              <input
                type="date"
                id="birthDate"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Operation Information</legend>

            <div className="form-group">
              <label htmlFor="operationType">Operation Type:</label>
              <input
                type="text"
                id="operationType"
                value={operationType}
                onChange={(e) => setOperationType(e.target.value)}
                disabled={isLoading}
                placeholder="e.g., CABG"
              />
            </div>

            <div className="form-group">
              <label htmlFor="operationDate">Operation Date:</label>
              <input
                type="date"
                id="operationDate"
                value={operationDate}
                onChange={(e) => setOperationDate(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Clinical Features</legend>

            <div className="form-group">
              <label htmlFor="age">Age (years):</label>
              <input
                type="number"
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={isLoading}
                min="0"
                max="120"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="bloodPressure">Blood Pressure (mmHg):</label>
              <input
                type="number"
                id="bloodPressure"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                disabled={isLoading}
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="cholesterol">Cholesterol (mmol/L):</label>
              <input
                type="number"
                id="cholesterol"
                value={cholesterol}
                onChange={(e) => setCholesterol(e.target.value)}
                disabled={isLoading}
                min="0"
                step="0.1"
                required
              />
            </div>

            <div className="form-group checkbox">
              <label htmlFor="diabetes">
                <input
                  type="checkbox"
                  id="diabetes"
                  checked={diabetes}
                  onChange={(e) => setDiabetes(e.target.checked)}
                  disabled={isLoading}
                />
                Diabetes
              </label>
            </div>

            <div className="form-group checkbox">
              <label htmlFor="smoking">
                <input
                  type="checkbox"
                  id="smoking"
                  checked={smoking}
                  onChange={(e) => setSmoking(e.target.checked)}
                  disabled={isLoading}
                />
                Smoking
              </label>
            </div>
          </fieldset>

          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? 'Calculating...' : 'Calculate Risk'}
          </button>
        </form>
      )}
    </div>
  );
}

export default PredictForm;
