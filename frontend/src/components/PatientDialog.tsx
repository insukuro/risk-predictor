import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, UserPlus, Stethoscope, User, ChevronRight, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent } from './ui/Dialog';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { NativeSelect } from './ui/Select';
import { Badge } from './ui/Badge';
import { cn } from '../lib/utils';
import { fetchPatient, createPatient, createOperation } from '../lib/api';
import type { PatientResponse } from '../types';

const createPatientSchema = z.object({
  sex: z.string().min(1, 'Выберите пол'),
  birth_date: z.string().min(1, 'Укажите дату рождения'),
});

const operationSchema = z.object({
  type: z.string().min(1, 'Укажите тип операции'),
  date: z.string().min(1, 'Укажите дату операции'),
});

type CreatePatientForm = z.infer<typeof createPatientSchema>;
type OperationForm = z.infer<typeof operationSchema>;

type Step = 'patient' | 'operation' | 'saving';

interface PatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (operationId: number) => Promise<void>;
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
      <div className="flex items-center gap-1 mb-5">
        {steps.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-0.5">
                <div
                    className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors',
                        i < current ? 'bg-indigo-600 text-white' : i === current ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600 ring-offset-1' : 'bg-slate-100 text-slate-400',
                    )}
                >
                  {i < current ? '✓' : i + 1}
                </div>
                <span className={cn('text-[10px] whitespace-nowrap', i === current ? 'text-indigo-700 font-medium' : 'text-slate-400')}>
              {label}
            </span>
              </div>
              {i < steps.length - 1 && (
                  <div className={cn('flex-1 h-px mb-3 mx-0.5', i < current ? 'bg-indigo-300' : 'bg-slate-200')} />
              )}
            </div>
        ))}
      </div>
  );
}


export function PatientDialog({ open, onOpenChange, onConfirm }: PatientDialogProps) {
  const [step, setStep] = useState<Step>('patient');
  const [currentStep, setCurrentStep] = useState(0);

  // Состояние пациента
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundPatient, setFoundPatient] = useState<PatientResponse | null>(null);
  const [searchError, setSearchError] = useState('');
  const [mode, setMode] = useState<'search' | 'create'>('search');

  // Состояние операции
  const [patientId, setPatientId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const patientForm = useForm<CreatePatientForm>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: { sex: '', birth_date: '' },
  });

  const operationForm = useForm<OperationForm>({
    resolver: zodResolver(operationSchema),
    defaultValues: { type: '', date: new Date().toISOString().split('T')[0] },
  });

  const resetAll = () => {
    setStep('patient');
    setCurrentStep(0);
    setSearchId('');
    setFoundPatient(null);
    setSearchError('');
    setPatientId(null);
    setSaveError('');
    setMode('search');
    patientForm.reset();
    operationForm.reset({ type: '', date: new Date().toISOString().split('T')[0] });
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetAll();
    onOpenChange(v);
  };

  // Поиск пациента

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    setSearchError('');
    setFoundPatient(null);
    try {
      const patient = await fetchPatient(Number(searchId));
      setFoundPatient(patient);
    } catch {
      setSearchError('Пациент не найден. Создайте новую запись.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseFound = () => {
    if (!foundPatient) return;
    setPatientId(foundPatient.id);
    setCurrentStep(1);
    setStep('operation');
  };
  
  const handleCreatePatient = async (data: CreatePatientForm) => {
    try {
      const patient = await createPatient(data);
      setPatientId(patient.id);
      setFoundPatient(patient);
      setCurrentStep(1);
      setStep('operation');
    } catch {
      patientForm.setError('root', { message: 'Ошибка создания пациента' });
    }
  };

  const handleCreateOperation = async (data: OperationForm) => {
    if (!patientId) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const operation = await createOperation({
        patient_id: patientId,
        type: data.type,
        date: data.date,
      });
      await onConfirm(operation.id);
      handleOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const sexOptions = [
    { value: 'male', label: 'Мужской' },
    { value: 'female', label: 'Женский' },
  ];

  const getPatientAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const now = new Date();
    return now.getFullYear() - birth.getFullYear();
  };

  return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
            title="Привязка к пациенту"
            description="Найдите существующего пациента или создайте новую запись"
            className="max-w-lg"
        >
          <StepIndicator
              current={currentStep}
              steps={['Пациент', 'Операция']}
          />

          {/* Шаг 1: Пациент */}
          {step === 'patient' && (
              <div className="space-y-4">
                {/* Переключатель режима */}
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 gap-1">
                  <button
                      type="button"
                      onClick={() => setMode('search')}
                      className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all',
                          mode === 'search' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700',
                      )}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Поиск по ID
                  </button>
                  <button
                      type="button"
                      onClick={() => setMode('create')}
                      className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all',
                          mode === 'create' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700',
                      )}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Новый пациент
                  </button>
                </div>

                {/* Режим поиска */}
                {mode === 'search' && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                            label="ID пациента"
                            type="number"
                            value={searchId}
                            onChange={(e) => { setSearchId(e.target.value); setSearchError(''); setFoundPatient(null); }}
                            placeholder="Введите ID..."
                            className="flex-1"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-transparent">.</label>
                          <Button
                              type="button"
                              onClick={handleSearch}
                              loading={isSearching}
                              icon={!isSearching ? <Search className="h-4 w-4" /> : undefined}
                              size="md"
                              disabled={!searchId.trim()}
                          >
                            Найти
                          </Button>
                        </div>
                      </div>

                      {searchError && (
                          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{searchError}</span>
                          </div>
                      )}

                      {foundPatient && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                                  <User className="h-4 w-4 text-emerald-700" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-emerald-900">
                                    {foundPatient.sex === 'М' ? 'Мужчина' : foundPatient.sex === 'Ж' ? 'Женщина' : foundPatient.sex}
                                  </p>
                                  <p className="text-xs text-emerald-600">
                                    ID: {foundPatient.id} · {new Date(foundPatient.birth_date).getFullYear()} г.р. · {getPatientAge(foundPatient.birth_date)} лет
                                  </p>
                                </div>
                              </div>
                              <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleUseFound}
                                  icon={<ChevronRight className="h-3.5 w-3.5" />}
                              >
                                Выбрать
                              </Button>
                            </div>
                          </div>
                      )}
                    </div>
                )}

                {/* Режим создания */}
                {mode === 'create' && (
                    <form onSubmit={patientForm.handleSubmit(handleCreatePatient)} className="space-y-3">
                      <NativeSelect
                          label="Пол"
                          error={patientForm.formState.errors.sex?.message}
                          {...patientForm.register('sex')}
                      >
                        <option value="">Выберите пол...</option>
                        {sexOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </NativeSelect>

                      <Input
                          label="Дата рождения"
                          type="date"
                          error={patientForm.formState.errors.birth_date?.message}
                          {...patientForm.register('birth_date')}
                      />

                      {patientForm.formState.errors.root && (
                          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            {patientForm.formState.errors.root.message}
                          </div>
                      )}

                      <Button
                          type="submit"
                          className="w-full"
                          loading={patientForm.formState.isSubmitting}
                          icon={!patientForm.formState.isSubmitting ? <UserPlus className="h-4 w-4" /> : undefined}
                      >
                        Создать пациента
                      </Button>
                    </form>
                )}
              </div>
          )}

          {/* Шаг 2: Операция */}
          {step === 'operation' && (
              <form onSubmit={operationForm.handleSubmit(handleCreateOperation)} className="space-y-4">
                {foundPatient && (
                    <div className="flex items-center gap-2.5 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                        <User className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-indigo-900">
                          {foundPatient.sex === 'М' ? 'Мужчина' : foundPatient.sex === 'Ж' ? 'Женщина' : foundPatient.sex}
                        </p>
                        <p className="text-xs text-indigo-500">
                          ID: {foundPatient.id} · {new Date(foundPatient.birth_date).getFullYear()} г.р.
                        </p>
                      </div>
                      <Badge className="ml-auto bg-indigo-100 text-indigo-700 border-indigo-200" variant="outline">
                        Пациент выбран
                      </Badge>
                    </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Stethoscope className="h-4 w-4 text-slate-500" />
                    Данные операции
                  </div>

                  <Input
                      label="Тип операции"
                      placeholder="Например: Аортокоронарное шунтирование"
                      error={operationForm.formState.errors.type?.message}
                      {...operationForm.register('type')}
                  />

                  <Input
                      label="Дата операции"
                      type="date"
                      error={operationForm.formState.errors.date?.message}
                      {...operationForm.register('date')}
                  />
                </div>

                {saveError && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{saveError}</span>
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setStep('patient'); setCurrentStep(0); }}
                  >
                    Назад
                  </Button>
                  <Button
                      type="submit"
                      className="flex-1"
                      loading={isSaving}
                      icon={!isSaving ? <Stethoscope className="h-4 w-4" /> : undefined}
                  >
                    {isSaving ? 'Сохранение...' : 'Сохранить расчёт'}
                  </Button>
                </div>
              </form>
          )}
        </DialogContent>
      </Dialog>
  );
}
