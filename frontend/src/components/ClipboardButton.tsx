import React, { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { cn } from '../utils/cn';
import { parseClipboardText } from '../utils/clipboardParser';
import { toast } from './ui/Toast';
import type { UIField, FormValues } from '../types';

interface ClipboardButtonProps {
  fields: UIField[];
  onDataImport: (data: FormValues) => void;
  disabled?: boolean;
}

export const ClipboardButton: React.FC<ClipboardButtonProps> = ({
  fields,
  onDataImport,
  disabled = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [parsedData, setParsedData] = useState<FormValues | null>(null);
  const [stats, setStats] = useState<{ filled: number; total: number } | null>(null);

  const handlePaste = async () => {
    if (disabled) return;
    
    setIsProcessing(true);
    
    try {
      const result = await parseClipboardText(fields);
      
      if (!result.success || result.filledFields === 0) {
        toast.warning('Буфер обмена пуст или данные не распознаны');
        setIsProcessing(false);
        return;
      }

      // If only a few fields, apply directly
      if (result.filledFields <= 5) {
        onDataImport(result.values);
        toast.success(`Заполнено ${result.filledFields} полей`);
      } else {
        // Show preview for larger imports
        setParsedData(result.values);
        setStats({ filled: result.filledFields, total: result.totalFields });
        setShowPreview(true);
      }
    } catch (error) {
      toast.error('Ошибка чтения буфера обмена. Разрешите доступ.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (parsedData) {
      onDataImport(parsedData);
      toast.success(`Успешно заполнено ${stats?.filled} из ${stats?.total} полей`);
    }
    setShowPreview(false);
    setParsedData(null);
    setStats(null);
  };

  const handleCancel = () => {
    setShowPreview(false);
    setParsedData(null);
    setStats(null);
  };

  // Get field label by id
  const getFieldLabel = (id: string): string => {
    const field = fields.find(f => f.id === id);
    return field?.label || id;
  };

  // Format value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return String(value);
      return value.toFixed(2);
    }
    return String(value);
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={handlePaste}
        loading={isProcessing}
        disabled={disabled}
        icon={<Clipboard className="h-4 w-4" />}
        className="justify-start"
      >
        Вставить из буфера
      </Button>

      <Modal
        isOpen={showPreview}
        onClose={handleCancel}
        title="Предварительный просмотр"
        size="lg"
      >
        <div className="space-y-4">
          <div className={cn(
            'flex items-center gap-3 p-4 rounded-lg',
            'bg-green-50 border border-green-200'
          )}>
            <Check className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">
                Распознано {stats?.filled} из {stats?.total} полей
              </p>
              <p className="text-sm text-green-700">
                Проверьте данные перед применением
              </p>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">
                    Поле
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-slate-600">
                    Значение
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedData && Object.entries(parsedData).map(([key, value]) => (
                  <tr key={key} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700">
                      {getFieldLabel(key)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {formatValue(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={handleCancel}>
              Отмена
            </Button>
            <Button onClick={handleConfirm} icon={<Check className="h-4 w-4" />}>
              Применить
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
