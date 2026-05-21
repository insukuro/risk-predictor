// api/patients.ts
import { mainApi, handleApiError } from './client';
import type { Patient, PatientCreate, Operation, OperationCreate } from '../types';

/**
 * Создать нового пациента
 */
export const createPatient = async (data: PatientCreate): Promise<Patient> => {
  try {
    const response = await mainApi.post<Patient>('/patients', data);
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

/**
 * Получить список пациентов с фильтрацией
 */
export const listPatients = async (
  search?: string,
  skip = 0,
  limit = 20
): Promise<Patient[]> => {
  try {
    const params: Record<string, any> = { skip, limit };
    if (search) params.search = search;
    const response = await mainApi.get<Patient[]>('/patients', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

/**
 * Получить пациента по ID
 */
export const getPatient = async (id: number): Promise<Patient> => {
  try {
    const response = await mainApi.get<Patient>(`/patients/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

/**
 * Создать операцию для пациента
 */
export const createOperation = async (data: OperationCreate): Promise<Operation> => {
  try {
    const response = await mainApi.post<Operation>('/operations', data);
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

/**
 * Получить операции пациента
 */
export const getPatientOperations = async (
  patientId: number,
  skip = 0,
  limit = 20
): Promise<Operation[]> => {
  try {
    const response = await mainApi.get<Operation[]>(
      `/operations/patient/${patientId}`,
      { params: { skip, limit } }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};