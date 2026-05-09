import { Database, Layers, FileCode2, Calendar, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Skeleton } from './ui/Skeleton';

import type { ModelConfig } from '../types';

interface ModelInfoCardProps {
  config?: ModelConfig;
  isLoading?: boolean;
  selectedVersion: string;
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 truncate">{label}</p>
          <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
        </div>
      </div>
  );
}

export function ModelInfoCard({ config, isLoading, selectedVersion }: ModelInfoCardProps) {
  if (isLoading) {
    return (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
    );
  }

  if (!config) return null;

  const featuresCount = config.features.length;
  const catCount = config.categorical_features.length;

  return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <Layers className="h-4 w-4 text-indigo-600" />
              </div>
              <CardTitle>Информация о модели</CardTitle>
            </div>
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200" variant="outline">
              {selectedVersion}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <InfoItem
                icon={<Hash className="h-3.5 w-3.5" />}
                label="Признаков (топ)"
                value={`${featuresCount} фичей`}
            />
            <InfoItem
                icon={<FileCode2 className="h-3.5 w-3.5" />}
                label="Категориальных"
                value={catCount > 0 ? `${catCount} признаков` : 'Нет'}
            />
            <InfoItem
                icon={<Database className="h-3.5 w-3.5" />}
                label="Числовых признаков"
                value={`${featuresCount - catCount}`}
            />
            <InfoItem
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Версия API"
                value={config.current_version}
            />
          </div>

          {config.categorical_features.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">Категориальные признаки</p>
                <div className="flex flex-wrap gap-1.5">
                  {config.categorical_features.slice(0, 6).map((f) => (
                      <Badge key={f} className="bg-purple-50 text-purple-700 border-purple-100 text-xs" variant="outline">
                        {f}
                      </Badge>
                  ))}
                  {config.categorical_features.length > 6 && (
                      <Badge className="bg-slate-50 text-slate-500 border-slate-200 text-xs" variant="outline">
                        +{config.categorical_features.length - 6}
                      </Badge>
                  )}
                </div>
              </div>
          )}
        </CardContent>
      </Card>
  );
}
