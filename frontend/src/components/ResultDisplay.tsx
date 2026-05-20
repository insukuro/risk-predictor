import React from 'react';
import { cn } from '../utils/cn';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Badge, getRiskLevelLabel } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  Heart, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  ArrowLeft,
  Download,
  Share2 
} from 'lucide-react';
import type { PredictResponse, TargetRiskItem } from '../types';

interface ResultDisplayProps {
  result: PredictResponse;
  onBack: () => void;
  onNewPrediction: () => void;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  result,
  onBack,
  onNewPrediction,
}) => {
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'low':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'medium':
        return <Activity className="h-6 w-6 text-yellow-500" />;
      case 'high':
        return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      case 'danger':
        return <Heart className="h-6 w-6 text-red-500" />;
      default:
        return <Activity className="h-6 w-6 text-slate-500" />;
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
      case 'low': return 'from-green-50 to-green-100 border-green-200';
      case 'medium': return 'from-yellow-50 to-yellow-100 border-yellow-200';
      case 'high': return 'from-orange-50 to-orange-100 border-orange-200';
      case 'danger': return 'from-red-50 to-red-100 border-red-200';
      default: return 'from-slate-50 to-slate-100 border-slate-200';
    }
  };

  const formatScore = (score: number): string => {
    return `${(score * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={onBack}
        icon={<ArrowLeft className="h-4 w-4" />}
      >
        Назад к форме
      </Button>

      {/* Main Result Card */}
      <div className={cn(
        'rounded-2xl border-2 bg-gradient-to-br p-8',
        getLevelBgColor(result.risk_level)
      )}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4">
            {getLevelIcon(result.risk_level)}
          </div>
          
          <h2 className="text-lg font-medium text-slate-600 mb-2">
            Общий риск осложнений
          </h2>
          
          <div className={cn(
            'text-6xl font-bold mb-3',
            getLevelColor(result.risk_level)
          )}>
            {formatScore(result.risk_score)}
          </div>
          
          <Badge 
            variant={result.risk_level as any} 
            size="lg"
          >
            {getRiskLevelLabel(result.risk_level)}
          </Badge>

          <p className="mt-4 text-sm text-slate-600">
            Модель: <span className="font-medium">{result.model_version}</span>
            {result.created_at && (
              <> • {new Date(result.created_at).toLocaleDateString('ru-RU')}</>
            )}
          </p>
        </div>
      </div>

      {/* Multi-class Targets (if available) */}
      {result.targets && result.targets.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">
              Детализация рисков по категориям
            </h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.targets.map((target: TargetRiskItem, index: number) => (
                <TargetCard key={index} target={target} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          variant="primary"
          onClick={onNewPrediction}
          icon={<Activity className="h-4 w-4" />}
        >
          Новый расчёт
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            // TODO: Implement export
            console.log('Export result:', result);
          }}
          icon={<Download className="h-4 w-4" />}
        >
          Экспорт
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            // TODO: Implement share
            console.log('Share result:', result);
          }}
          icon={<Share2 className="h-4 w-4" />}
        >
          Поделиться
        </Button>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-500 text-center max-w-xl mx-auto">
        * Данный прогноз носит информационный характер и не является заменой клинического суждения врача. 
        Окончательное решение о тактике лечения принимается лечащим врачом с учетом всех индивидуальных особенностей пациента.
      </p>
    </div>
  );
};

// Sub-component for target risk items
const TargetCard: React.FC<{ target: TargetRiskItem }> = ({ target }) => {
  const getBorderColor = (level: string): string => {
    switch (level) {
      case 'low': return 'border-l-green-500';
      case 'medium': return 'border-l-yellow-500';
      case 'high': return 'border-l-orange-500';
      case 'danger': return 'border-l-red-500';
      default: return 'border-l-slate-500';
    }
  };

  const getTextColor = (level: string): string => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'danger': return 'text-red-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className={cn(
      'bg-white rounded-lg border-l-4 border border-slate-200 p-4',
      getBorderColor(target.level)
    )}>
      <p className="text-sm font-medium text-slate-700 mb-2 line-clamp-2">
        {target.name}
      </p>
      <div className="flex items-baseline justify-between">
        <span className={cn('text-2xl font-bold', getTextColor(target.level))}>
          {(target.score * 100).toFixed(1)}%
        </span>
        <Badge variant={target.level as any} size="sm">
          {getRiskLevelLabel(target.level)}
        </Badge>
      </div>
    </div>
  );
};
