import { useState, useEffect } from 'react';
import './App.css';
import PredictForm from './components/PredictForm';
import PredictionHistory from './components/PredictionHistory';
import PatientInfo from './components/PatientInfo';
import api, { type PredictionRecord } from './api';

function App() {
  const [currentPage, setCurrentPage] = useState<'predict' | 'history' | 'patient'>('predict');
  const [patientId, setPatientId] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check API health
    api.healthCheck().catch((err) => {
      console.error('API Health Check failed:', err);
      setError('Cannot connect to API. Make sure the backend is running.');
    });
  }, []);

  const handlePredictionCreated = async (predictionId: number) => {
    try {
      setIsLoading(true);
      const newPrediction = await api.getPrediction(predictionId);
      setPredictions([newPrediction, ...predictions]);
      setCurrentPage('history');
    } catch (err) {
      setError('Failed to fetch prediction');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientCreated = (id: number) => {
    setPatientId(id);
    setCurrentPage('predict');
  };

  const handleLoadPatientPredictions = async (id: number) => {
    try {
      setIsLoading(true);
      const patientPredictions = await api.getPredictions(id);
      setPredictions(patientPredictions);
      setPatientId(id);
      setCurrentPage('history');
    } catch (err) {
      setError('Failed to load predictions');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Risk Predictor</h1>
        <p>Cardiovascular Risk Prediction System</p>
      </header>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <nav className="main-nav">
        <button
          className={currentPage === 'patient' ? 'active' : ''}
          onClick={() => setCurrentPage('patient')}
        >
          New Patient
        </button>
        <button
          className={currentPage === 'predict' ? 'active' : ''}
          onClick={() => setCurrentPage('predict')}
          disabled={patientId === null}
        >
          Make Prediction
        </button>
        <button
          className={currentPage === 'history' ? 'active' : ''}
          onClick={() => setCurrentPage('history')}
        >
          History
        </button>
      </nav>

      <main className="main-content">
        {isLoading && <div className="loading">Loading...</div>}

        {currentPage === 'patient' && (
          <PatientInfo onPatientCreated={handlePatientCreated} />
        )}

        {currentPage === 'predict' && patientId && (
          <PredictForm
            patientId={patientId}
            onPredictionCreated={handlePredictionCreated}
          />
        )}

        {currentPage === 'history' && (
          <PredictionHistory
            predictions={predictions}
            patientId={patientId}
            onPatientSelect={handleLoadPatientPredictions}
          />
        )}

        {currentPage === 'predict' && patientId === null && (
          <div className="placeholder">
            <p>Please create a patient first</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 Risk Predictor. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
