import { useState } from 'react';
import api from '../api';
import './PatientInfo.css';

interface PatientInfoProps {
  onPatientCreated: (patientId: number) => void;
}

function PatientInfo({ onPatientCreated }: PatientInfoProps) {
  const [sex, setSex] = useState('male');
  const [birthDate, setBirthDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!birthDate) {
      setError('Please select a birth date');
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.createPatient({
        sex,
        birth_date: birthDate,
      });
      setSuccess(true);
      setSex('male');
      setBirthDate('');
      
      // Notify parent component
      setTimeout(() => {
        onPatientCreated(response.id);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="patient-info-card">
      <h2>Create New Patient</h2>
      
      {error && <div className="error">{error}</div>}
      {success && <div className="success">Patient created successfully!</div>}

      <form onSubmit={handleSubmit}>
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
            required
          />
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? 'Creating...' : 'Create Patient'}
        </button>
      </form>
    </div>
  );
}

export default PatientInfo;
