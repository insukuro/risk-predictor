import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RiskLevel } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRiskColor(level: RiskLevel) {
  switch (level) {
    case 'low':
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-700',
        bar: 'bg-emerald-500',
        ring: 'ring-emerald-200',
        label: 'Низкий риск',
      };
    case 'medium':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        badge: 'bg-amber-100 text-amber-700',
        bar: 'bg-amber-500',
        ring: 'ring-amber-200',
        label: 'Средний риск',
      };
    case 'high':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        badge: 'bg-red-100 text-red-700',
        bar: 'bg-red-500',
        ring: 'ring-red-200',
        label: 'Высокий риск',
      };
  }
}

export function getFrameworkColor(framework: string) {
  switch (framework?.toLowerCase()) {
    case 'catboost':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'sklearn':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'xgboost':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'lightgbm':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function getDefaultFeatureValue(featureName: string): number | string {
  const f = featureName.toLowerCase();
  if (f.includes('возраст') || f.includes('age')) return 60;
  if (f.includes('hb') || f.includes('гемоглобин') || f.includes('hemoglobin')) return 120;
  if (f.includes('креатинин') || f.includes('creatinine')) return 80;
  if (f.includes('мочевина') || f.includes('urea')) return 5;
  if (f.includes('k+') || f.includes('калий') || f.includes('potassium')) return 4.0;
  if (f.includes('na+') || f.includes('натрий') || f.includes('sodium')) return 140;
  if (f.includes('глюкоза') || f.includes('glucose')) return 5.5;
  if (f.includes('0/1') || f.includes('наличие') || f.includes('гипертония') || f.includes('диабет')) return 0;
  return 0;
}

export function isCategoricalBoolean(featureName: string): boolean {
  const f = featureName.toLowerCase();
  return (
      f.includes('0/1') ||
      f.includes('наличие') ||
      f.includes('гипертония') ||
      f.includes('диабет') ||
      f.includes('курение') ||
      f.includes('ожирение') ||
      f.includes('инфаркт') ||
      f.includes('инсульт') ||
      f.includes('фибрилляция')
  );
}
