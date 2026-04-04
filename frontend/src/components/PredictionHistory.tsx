import { useState } from 'react';
import { type PredictionRecord } from '../api';
import './PredictionHistory.css';

interface PredictionHistoryProps {
  predictions: PredictionRecord[];
  patientId: number | null;
  onPatientSelect: (patientId: number) => void;
}

function PredictionHistory({ predictions, patientId, onPatientSelect }: PredictionHistoryProps) {
  const [searchPatientId, setSearchPatientId] = useState('');

  const handleSearch = () => {
    if (searchPatientId) {
      onPatientSelect(parseInt(searchPatientId));
    }
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return 'risk-low';
      case 'moderate':
        return 'risk-moderate';
      case 'high':
        return 'risk-high';
      default:
        return '';
    }
  };

  return (
    <div className="prediction-history-card">
      <h2>Prediction History</h2>

      <div className="search-section">
        <div className="search-group">
          <input
            type="number"
            placeholder="Enter patient ID to search"
            value={searchPatientId}
            onChange={(e) => setSearchPatientId(e.target.value)}
            min="1"
          />
          <button onClick={handleSearch} className="btn-secondary">
            Search
          </button>
        </div>
      </div>

      {patientId && <p className="patient-filter">Showing predictions for patient #{patientId}</p>}

      {predictions.length === 0 ? (
        <p className="no-data">No predictions found. Make a prediction to get started.</p>
      ) : (
        <div className="predictions-list">
          {predictions.map((prediction) => (
            <div key={prediction.id} className="prediction-item">
              <div className="prediction-header">
                <span className="prediction-id">Prediction #{prediction.id}</span>
                <span className={`risk-badge ${getRiskColor(prediction.risk_level)}`}>
                  {prediction.risk_level.toUpperCase()}
                </span>
              </div>

              <div className="prediction-details">
                <div className="detail-row">
                  <span className="label">Patient ID:</span>
                  <span className="value">{prediction.patient_id}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Operation ID:</span>
                  <span className="value">{prediction.operation_id}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Risk Score:</span>
                  <span className="value risk-score">
                    {(prediction.risk_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Model Version:</span>
                  <span className="value">{prediction.model_version}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Created:</span>
                  <span className="value">
                    {new Date(prediction.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PredictionHistory;
