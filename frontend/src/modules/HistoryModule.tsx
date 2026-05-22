import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Calendar,
  User,
  Activity,
  Eye,
  ChevronRight,
  RefreshCw,
  History,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, getRiskLevelLabel } from '../components/ui/Badge';
import { Drawer } from '../components/ui/Drawer';
import { toast } from '../components/ui/Toast';
import { useDebounce } from '../hooks/useDebounce';
import { getPredictionHistory } from '../api/predictions';
import { cn } from '../utils/cn';
import type { HistoryItem } from '../types';

const ITEMS_PER_PAGE = 20;

export const HistoryModule: React.FC = () => {
  // State
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [patientIdInput, setPatientIdInput] = useState('');
  const debouncedPatientId = useDebounce(patientIdInput, 400);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Drawer state
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load data
  const loadHistory = useCallback(async (page: number, patientId?: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const skip = page * ITEMS_PER_PAGE;
      const data = await getPredictionHistory(patientId, skip, ITEMS_PER_PAGE);
      
      if (page === 0) {
        setItems(data);
      } else {
        setItems(prev => [...prev, ...data]);
      }
      
      setHasMore(data.length === ITEMS_PER_PAGE);
    } catch (err: any) {
      setError(err.message);
      toast.error('Ошибка загрузки истории');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and filter changes
  useEffect(() => {
    setCurrentPage(0);
    const patientId = debouncedPatientId ? parseInt(debouncedPatientId) : undefined;
    loadHistory(0, patientId);
  }, [debouncedPatientId, loadHistory]);

  // Handle page change
  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    const patientId = debouncedPatientId ? parseInt(debouncedPatientId) : undefined;
    loadHistory(nextPage, patientId);
  };

  // Handle view details
  const handleViewDetails = (item: HistoryItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Render loading state
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-slate-600">Загрузка истории...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Клинический архив
          </h2>
          <p className="text-slate-600 mt-1">
            История выполненных прогнозов
          </p>
        </div>

        {/* Search */}
        <div className="w-full lg:w-80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="number"
              placeholder="Поиск по ID пациента..."
              value={patientIdInput}
              onChange={(e) => setPatientIdInput(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2 border rounded-lg text-slate-900 placeholder-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'border-slate-300 hover:border-slate-400'
              )}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <History className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">
              Ошибка загрузки
            </h3>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button
              onClick={() => {
                const patientId = debouncedPatientId ? parseInt(debouncedPatientId) : undefined;
                loadHistory(0, patientId);
              }}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Повторить
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!error && items.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">
              История пуста
            </h3>
            <p className="text-slate-600">
              {debouncedPatientId
                ? `Нет прогнозов для пациента #${debouncedPatientId}`
                : 'Выполните первый прогноз, чтобы он отобразился здесь'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* History grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              onViewDetails={() => handleViewDetails(item)}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && items.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="secondary"
            onClick={handleLoadMore}
            loading={loading}
            icon={<ChevronRight className="h-4 w-4" />}
          >
            Загрузить ещё
          </Button>
        </div>
      )}

      {/* Details drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Детали прогноза"
        width="lg"
      >
        {selectedItem && (
          <HistoryDetails item={selectedItem} formatDate={formatDate} />
        )}
      </Drawer>
    </div>
  );
};

// History card component
interface HistoryCardProps {
  item: HistoryItem;
  onViewDetails: () => void;
  formatDate: (date: string) => string;
}

const HistoryCard: React.FC<HistoryCardProps> = ({
  item,
  onViewDetails,
  formatDate,
}) => {
  const getBorderColor = (level: string): string => {
    switch (level) {
      case 'low': return 'border-l-green-500';
      case 'medium': return 'border-l-yellow-500';
      case 'high': return 'border-l-orange-500';
      case 'danger': return 'border-l-red-500';
      default: return 'border-l-slate-300';
    }
  };

  return (
    <Card
      className={cn('border-l-4', getBorderColor(item.risk_level))}
      hover
      onClick={onViewDetails}
    >
      <CardContent className="py-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="h-4 w-4" />
            {formatDate(item.created_at)}
          </div>
          <Badge variant={item.risk_level as any} size="sm">
            {getRiskLevelLabel(item.risk_level)}
          </Badge>
        </div>

        <div className="space-y-2">
          {item.patient_id && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">Пациент:</span>
              <span className="font-medium">#{item.patient_id}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-slate-400" />
            <span className="text-slate-600">Риск:</span>
            <span className={cn(
              'font-bold text-lg',
              item.risk_level === 'low' && 'text-green-600',
              item.risk_level === 'medium' && 'text-yellow-600',
              item.risk_level === 'high' && 'text-orange-600',
              item.risk_level === 'danger' && 'text-red-600'
            )}>
              {(item.risk_score).toFixed(1)}%
            </span>
          </div>

          <div className="text-xs text-slate-500">
            Модель: {item.model_version}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          icon={<Eye className="h-4 w-4" />}
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
        >
          Посмотреть детали
        </Button>
      </CardContent>
    </Card>
  );
};

// History details component
interface HistoryDetailsProps {
  item: HistoryItem;
  formatDate: (date: string) => string;
}

const HistoryDetails: React.FC<HistoryDetailsProps> = ({ item, formatDate }) => {
  const getLevelBgColor = (level: string): string => {
    switch (level) {
      case 'low': return 'bg-green-50 border-green-200';
      case 'medium': return 'bg-yellow-50 border-yellow-200';
      case 'high': return 'bg-orange-50 border-orange-200';
      case 'danger': return 'bg-red-50 border-red-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className={cn(
        'rounded-lg border-2 p-4',
        getLevelBgColor(item.risk_level)
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Общий риск</span>
          <Badge variant={item.risk_level as any}>
            {getRiskLevelLabel(item.risk_level)}
          </Badge>
        </div>
        <div className={cn(
          'text-4xl font-bold',
          item.risk_level === 'low' && 'text-green-600',
          item.risk_level === 'medium' && 'text-yellow-600',
          item.risk_level === 'high' && 'text-orange-600',
          item.risk_level === 'danger' && 'text-red-600'
        )}>
          {(item.risk_score).toFixed(1)}%
        </div>
      </div>

      {/* Meta info */}
      <div className="space-y-3">
        <h4 className="font-medium text-slate-900">Информация</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Дата:</span>
            <p className="font-medium">{formatDate(item.created_at)}</p>
          </div>
          <div>
            <span className="text-slate-500">Модель:</span>
            <p className="font-medium">{item.model_version}</p>
          </div>
          {item.patient_id && (
            <div>
              <span className="text-slate-500">ID пациента:</span>
              <p className="font-medium">#{item.patient_id}</p>
            </div>
          )}
          {item.operation_id && (
            <div>
              <span className="text-slate-500">ID операции:</span>
              <p className="font-medium">#{item.operation_id}</p>
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      {item.features && Object.keys(item.features).length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900">Входные параметры</h4>
          <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <dl className="space-y-2">
              {Object.entries(item.features).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <dt className="text-slate-600 truncate max-w-[60%]" title={key}>
                    {key}
                  </dt>
                  <dd className="font-medium text-slate-900">
                    {typeof value === 'number'
                      ? Number.isInteger(value) ? value : value.toFixed(2)
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};
