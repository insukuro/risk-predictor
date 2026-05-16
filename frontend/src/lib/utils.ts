import type { RiskLevel } from '../types';

export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'text-emerald-600';
    case 'medium':
      return 'text-amber-600';
    case 'high':
      return 'text-orange-600';
    case 'danger':
      return 'text-red-600';
  }
}

export function riskLevelBg(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700';
    case 'medium':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    case 'high':
      return 'bg-orange-50 border-orange-200 text-orange-700';
    case 'danger':
      return 'bg-red-50 border-red-200 text-red-700';
  }
}

export function riskLevelSolidBg(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-emerald-500';
    case 'medium':
      return 'bg-amber-500';
    case 'high':
      return 'bg-orange-500';
    case 'danger':
      return 'bg-red-500';
  }
}

export function riskLevelRing(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'stroke-emerald-500';
    case 'medium':
      return 'stroke-amber-500';
    case 'high':
      return 'stroke-orange-500';
    case 'danger':
      return 'stroke-red-500';
  }
}

export function riskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'Низкий';
    case 'medium':
      return 'Умеренный';
    case 'high':
      return 'Высокий';
    case 'danger':
      return 'Критический';
  }
}

export function riskLevelGradient(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'from-emerald-500 to-green-500';
    case 'medium':
      return 'from-amber-500 to-yellow-500';
    case 'high':
      return 'from-orange-500 to-red-500';
    case 'danger':
      return 'from-red-500 to-rose-600';
  }
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
