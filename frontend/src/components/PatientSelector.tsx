// components/PatientSelector.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, UserPlus, ChevronUp,
  Calendar, User, Plus, Check,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { toast } from './ui/Toast';
import { Card, CardContent } from './ui/Card';
import {
  listPatients,
  createPatient,
  getPatientOperations,
  createOperation,
} from '../api/patients';
import type { Patient, Operation } from '../types';

const OPERATION_TYPES = [
  { value: 'CABG', label: 'АКШ (CABG)' },
  { value: 'AVR', label: 'Протезирование аортального клапана' },
  { value: 'MVR', label: 'Протезирование митрального клапана' },
  { value: 'CABG+AVR', label: 'АКШ + Протезирование АК' },
  { value: 'CABG+MVR', label: 'АКШ + Протезирование МК' },
  { value: 'OTHER', label: 'Другое' },
];

interface PatientSelectorProps {
  onOperationSelect: (operationId: number, patient: Patient) => void;
  onClear: () => void;
  selectedOperationId?: number | null;
}

type Step = 'search' | 'create-patient' | 'select-operation' | 'create-operation';

export const PatientSelector: React.FC<PatientSelectorProps> = ({
  onOperationSelect,
  onClear,
  selectedOperationId,
}) => {
  const [step, setStep] = useState<Step>('search');
  const [isExpanded, setIsExpanded] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // New patient form
  const [newPatientSex, setNewPatientSex] = useState<number>(1);
  const [newPatientBirth, setNewPatientBirth] = useState('');
  const [createPatientLoading, setCreatePatientLoading] = useState(false);

  // Operations
  const [operations, setOperations] = useState<Operation[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(false);

  // New operation form
  const [newOpType, setNewOpType] = useState('CABG');
  const [newOpDate, setNewOpDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [createOpLoading, setCreateOpLoading] = useState(false);

  // Поиск пациентов
  const searchPatients = useCallback(async (query: string) => {
    setSearchLoading(true);
    try {
      const results = await listPatients(query || undefined, 0, 10);
      setPatients(results);
    } catch {
      toast.error('Ошибка поиска пациентов');
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchPatients]);

  // Начальная загрузка списка
  useEffect(() => {
    searchPatients('');
  }, [searchPatients]);

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setStep('select-operation');
    setOperationsLoading(true);
    try {
      const ops = await getPatientOperations(patient.id);
      setOperations(ops);
    } catch {
      toast.error('Ошибка загрузки операций');
    } finally {
      setOperationsLoading(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatientBirth) {
      toast.error('Укажите дату рождения');
      return;
    }
    setCreatePatientLoading(true);
    try {
      const patient = await createPatient({
        sex: newPatientSex === 1 ? 'male' : newPatientSex === 0 ? 'female' : 'other',
        birth_date: newPatientBirth,
      });
      toast.success(`Пациент #${patient.id} создан`);
      await handleSelectPatient(patient);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания пациента');
    } finally {
      setCreatePatientLoading(false);
    }
  };

  const handleCreateOperation = async () => {
    if (!selectedPatient) return;
    setCreateOpLoading(true);
    try {
      const op = await createOperation({
        patient_id: selectedPatient.id,
        type: newOpType,
        date: newOpDate,
      });
      toast.success(`Операция #${op.id} создана`);
      onOperationSelect(op.id, selectedPatient);
      setIsExpanded(false);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания операции');
    } finally {
      setCreateOpLoading(false);
    }
  };

  const handleSelectOperation = (op: Operation) => {
    if (!selectedPatient) return;
    onOperationSelect(op.id, selectedPatient);
    setIsExpanded(false);
    toast.success(`Операция #${op.id} выбрана`);
  };

  const handleClear = () => {
    setSelectedPatient(null);
    setOperations([]);
    setStep('search');
    setIsExpanded(true);
    onClear();
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU');
    } catch {
      return dateStr;
    }
  };

  // Collapsed state — показываем выбранную операцию
  if (!isExpanded && selectedOperationId) {
    return (
      <Card className="border-2 border-emerald-500 bg-emerald-50">
        <CardContent className="py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-emerald-600" />
            <div>
              <span className="text-sm font-semibold text-emerald-800">
                Пациент #{selectedPatient?.id} · Операция #{selectedOperationId}
              </span>
              <span className="text-xs text-emerald-600 ml-2">
                {Number(selectedPatient?.sex) === 1 ? 'Мужской' : 'Женский'} ·{' '}
                {selectedPatient?.birth_date
                  ? formatDate(selectedPatient.birth_date)
                  : ''}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="text-xs text-emerald-700 underline hover:no-underline"
              onClick={() => setIsExpanded(true)}
            >
              Изменить
            </button>
            <button
              className="text-xs text-red-600 underline hover:no-underline ml-2"
              onClick={handleClear}
            >
              Сбросить
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-emerald-200">
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <User className="h-4 w-4" />
            Привязка к пациенту
          </h3>
          {selectedOperationId && (
            <button
              className="text-slate-400 hover:text-slate-600"
              onClick={() => setIsExpanded(false)}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* STEP: Search */}
        {(step === 'search' || step === 'create-patient') && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  step === 'search'
                    ? 'border-emerald-500 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
                onClick={() => setStep('search')}
              >
                Найти пациента
              </button>
              <button
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  step === 'create-patient'
                    ? 'border-emerald-500 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
                onClick={() => setStep('create-patient')}
              >
                <UserPlus className="h-3.5 w-3.5 inline mr-1" />
                Новый пациент
              </button>
            </div>

            {step === 'search' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Поиск по ID пациента..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2 border rounded-lg text-sm',
                      'border-slate-300 focus:outline-none focus:ring-2',
                      'focus:ring-emerald-400 focus:border-transparent'
                    )}
                  />
                </div>

                {searchLoading && (
                  <p className="text-sm text-slate-500 text-center py-2">
                    Поиск...
                  </p>
                )}

                {!searchLoading && patients.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Пациенты не найдены
                  </p>
                )}

                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg border text-sm',
                        'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50',
                        'transition-colors flex items-center justify-between'
                      )}
                    >
                      <span className="font-medium text-slate-800">
                        Пациент #{p.id}
                      </span>
                      <span className="text-xs text-slate-500">
                        {Number(p.sex) === 1 ? '♂ Мужской' : '♀ Женский'} ·{' '}
                        {p.birth_date ? formatDate(p.birth_date) : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'create-patient' && (
              <div className="space-y-3">
                <Select
                  label="Пол"
                  options={[
                    { value: 1, label: 'Мужской' },
                    { value: 0, label: 'Женский' },
                  ]}
                  value={newPatientSex}
                  onChange={(v) => setNewPatientSex(Number(v))}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Дата рождения
                  </label>
                  <input
                    type="date"
                    value={newPatientBirth}
                    onChange={(e) => setNewPatientBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={cn(
                      'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-emerald-400'
                    )}
                  />
                </div>
                <Button
                  onClick={handleCreatePatient}
                  loading={createPatientLoading}
                  className="w-full"
                  icon={<UserPlus className="h-4 w-4" />}
                >
                  Создать пациента
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP: Select or Create Operation */}
        {(step === 'select-operation' || step === 'create-operation') &&
          selectedPatient && (
            <div className="space-y-4">
              {/* Patient info */}
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <div className="text-sm">
                  <span className="font-semibold text-slate-700">
                    Пациент #{selectedPatient.id}
                  </span>
                  <span className="text-slate-500 ml-2">
                    {Number(selectedPatient.sex) === 1 ? '♂' : '♀'} ·{' '}
                    {formatDate(selectedPatient.birth_date)}
                  </span>
                </div>
                <button
                  className="text-xs text-slate-500 underline hover:no-underline"
                  onClick={() => {
                    setSelectedPatient(null);
                    setStep('search');
                  }}
                >
                  Сменить
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    step === 'select-operation'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                  onClick={() => setStep('select-operation')}
                >
                  Существующая операция
                </button>
                <button
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    step === 'create-operation'
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  )}
                  onClick={() => setStep('create-operation')}
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />
                  Новая операция
                </button>
              </div>

              {step === 'select-operation' && (
                <div className="space-y-2">
                  {operationsLoading && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Загрузка операций...
                    </p>
                  )}

                  {!operationsLoading && operations.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-500 mb-2">
                        Операций не найдено
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setStep('create-operation')}
                      >
                        Создать новую
                      </Button>
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {operations.map((op) => (
                      <button
                        key={op.id}
                        onClick={() => handleSelectOperation(op)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg border text-sm',
                          'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50',
                          'transition-colors flex items-center justify-between'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-800">
                            #{op.id} · {op.type}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {formatDate(op.date)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'create-operation' && (
                <div className="space-y-3">
                  <Select
                    label="Тип операции"
                    options={OPERATION_TYPES}
                    value={newOpType}
                    onChange={(v) => setNewOpType(String(v))}
                  />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Дата операции
                    </label>
                    <input
                      type="date"
                      value={newOpDate}
                      onChange={(e) => setNewOpDate(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-400'
                      )}
                    />
                  </div>
                  <Button
                    onClick={handleCreateOperation}
                    loading={createOpLoading}
                    className="w-full"
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Создать операцию
                  </Button>
                </div>
              )}
            </div>
          )}
      </CardContent>
    </Card>
  );
};