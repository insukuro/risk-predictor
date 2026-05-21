import React from 'react';
import { cn } from '../utils/cn';
import { Card, CardContent } from './ui/Card';
import { Badge, getRiskLevelLabel } from './ui/Badge';
import { Button } from './ui/Button';
import { ArrowLeft, RefreshCw, Download, Share2, AlertTriangle, Heart, Activity, CheckCircle } from 'lucide-react';
import type { PredictResponse, TargetRiskItem } from '../types';

interface ResultDisplayProps {
  result: PredictResponse & { result?: PredictResponse }; // Добавили гибкость для типов
  onBack: () => void;
  onNewPrediction: () => void;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result: rawResult, onBack, onNewPrediction }) => {
  
  // Умная распаковка: если бэк прислал { status, result: {...} }, берем внутренности
  const result = (rawResult && 'result' in rawResult && rawResult.result) 
    ? (rawResult.result as PredictResponse) 
    : (rawResult as PredictResponse);

  // Безопасное извлечение полей с дефолтными значениями на случай битых данных
  const risk_level = result?.risk_level || 'low';
  const risk_score = result?.risk_score ?? 0;
  const model_version = result?.model_version || 'unknown';
  const targets = result?.targets || [];

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'medium': return <Activity className="w-12 h-12 text-yellow-500" />;
      case 'high': return <AlertTriangle className="w-12 h-12 text-orange-500" />;
      case 'danger': return <Heart className="w-12 h-12 text-red-500" />;
      default: return <Activity className="w-12 h-12 text-slate-500" />;
    }
  };

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'danger': return 'text-red-600';
      default: return 'text-slate-600';
    }
  };

  const getLevelBgColor = (level: string): string => {
    switch (level) {
      case 'low': return 'bg-green-50 border-green-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'danger': return 'bg-red-50 border-red-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  // Исправлено: Защита от undefined/null при форматировании
  const formatScore = (score: number | undefined | null): string => {
    const validScore = score ?? 0;
    return `${validScore.toFixed(1)}%`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Назад к форме
      </Button>

      <Card className={cn('border-2 shadow-sm', getLevelBgColor(risk_level))}>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4">{getLevelIcon(risk_level)}</div>
          <h2 className="text-2xl font-semibold mb-2">Общий риск осложнений</h2>
          <div className={cn('text-6xl font-bold mb-4', getLevelColor(risk_level))}>
            {formatScore(risk_score)}
          </div>
          <Badge variant={risk_level as any} size="lg" className="mb-4">
            {getRiskLevelLabel(risk_level)}
          </Badge>
          <div className="text-sm text-slate-500">
            Модель: {model_version}
            {result?.created_at && ` • ${new Date(result.created_at).toLocaleDateString('ru-RU')}`}
          </div>
        </CardContent>
      </Card>

      {targets.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Детализация рисков по категориям</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targets.map((target, index) => (
              <TargetCard key={index} target={target} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mt-8">
        <Button onClick={onNewPrediction}>
          <RefreshCw className="w-4 h-4 mr-2" /> Новый расчёт
        </Button>
        <Button variant="outline" onClick={() => console.log('Export:', result)}>
          <Download className="w-4 h-4 mr-2" /> Экспорт
        </Button>
        <Button variant="outline" onClick={() => console.log('Share:', result)}>
          <Share2 className="w-4 h-4 mr-2" /> Поделиться
        </Button>
      </div>

      <div className="mt-8 p-4 bg-slate-50 rounded-lg text-sm text-slate-500 border border-slate-200">
        <p className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-slate-400" />
          <span>
            Данный прогноз носит информационный характер и не является заменой клинического суждения врача. 
            Окончательное решение о тактике лечения принимается лечащим врачом с учетом всех индивидуальных особенностей пациента.
          </span>
        </p>
      </div>
    </div>
  );
};

const TargetCard: React.FC<{ target: TargetRiskItem }> = ({ target }) => {
  const borderColors: Record<string, string> = {
    low: 'border-l-green-500', 
    medium: 'border-l-yellow-500',
    high: 'border-l-orange-500', 
    danger: 'border-l-red-500'
  };
  const textColors: Record<string, string> = {
    low: 'text-green-600', 
    medium: 'text-yellow-600',
    high: 'text-orange-600', 
    danger: 'text-red-600'
  };

  // Защита от отсутствия score в target
  const score = target?.score ?? 0;
  const level = target?.level || 'low';

  return (
    <div className={cn('bg-white rounded-lg shadow-sm border-y border-r border-l-4 p-4 border-slate-200', borderColors[level] || 'border-l-slate-500')}>
      <h4 className="text-sm font-medium text-slate-600 mb-2">{target?.name || 'Показатель'}</h4>
      <div className="flex items-end justify-between">
        <span className={cn('text-2xl font-bold', textColors[level] || 'text-slate-600')}>
          {score.toFixed(1)}%
        </span>
        <Badge variant={level as any} size="sm">
          {getRiskLevelLabel(level)}
        </Badge>
      </div>
    </div>
  );
};