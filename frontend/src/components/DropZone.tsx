import React, { useCallback, useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, Check } from 'lucide-react';
import { cn } from '../utils/cn';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { parseExcelFile, getPreviewData, fuzzyMatchHeaders, extractRowData } from '../utils/excelParser';
import { toast } from './ui/Toast';
import type { ExcelParseResult, UIField, FormValues } from '../types';

interface DropZoneProps {
  fields: UIField[];
  onDataImport: (data: FormValues) => void;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  fields,
  onDataImport,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  const handleFile = useCallback(async (file: File) => {
    // Защита от повторных вызовов
    if (isProcessingRef.current || isLoading) {
      console.warn('Already processing a file');
      return;
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    
    const isValidExt = file.name.endsWith('.xlsx') || 
                       file.name.endsWith('.xls') || 
                       file.name.endsWith('.csv');
    
    if (!validTypes.includes(file.type) && !isValidExt) {
      toast.error('Поддерживаются только файлы .xlsx, .xls и .csv');
      return;
    }

    // Проверка размера файла (макс 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Файл слишком большой. Максимальный размер: 50MB');
      return;
    }

    isProcessingRef.current = true;
    setIsLoading(true);
    
    try {
      console.log('Starting file parsing:', file.name, 'size:', file.size);
      
      // Добавляем таймаут в 30 секунд
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Превышено время обработки файла (30с)')), 30000);
      });
      
      const result = await Promise.race([
        parseExcelFile(file),
        timeoutPromise
      ]);
      
      console.log('File parsed successfully, rows:', result?.totalRows);
      
      // Проверяем валидность результата
      if (!result || !result.headers || !result.rows || result.totalRows === 0) {
        throw new Error('Файл не содержит данных или имеет неверный формат');
      }
      
      setParseResult(result);
      setSelectedRow(null);
      setIsModalOpen(true);
      toast.success(`Файл прочитан: ${result.totalRows} строк данных`);
    } catch (error: any) {
      console.error('Error parsing file:', error);
      
      // Показываем понятное сообщение об ошибке
      if (error.message?.includes('timeout') || error.message?.includes('Превышено время')) {
        toast.error('Обработка файла заняла слишком много времени. Попробуйте файл меньшего размера.');
      } else if (error.message?.includes('format') || error.message?.includes('неверный формат')) {
        toast.error('Неверный формат файла. Проверьте структуру данных.');
      } else {
        toast.error(error.message || 'Ошибка чтения файла. Проверьте формат данных.');
      }
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  }, [isLoading]); // Добавляем зависимость от isLoading

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessingRef.current) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isProcessingRef.current) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, handleFile]);

  const handleClick = () => {
    if (!disabled && !isProcessingRef.current && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRowSelect = (rowIndex: number) => {
    setSelectedRow(rowIndex);
  };

  const handleImport = useCallback(() => {
    if (!parseResult || selectedRow === null) return;

    const rowData = parseResult.rows.find(r => r.rowIndex === selectedRow);
    if (!rowData) {
      toast.error('Строка не найдена');
      return;
    }

    try {
      const headerMapping = fuzzyMatchHeaders(parseResult.headers, fields);
      const extractedData = extractRowData(rowData.data, headerMapping, fields);
      
      const filledCount = Object.keys(extractedData).length;
      
      if (filledCount === 0) {
        toast.warning('Не удалось сопоставить данные с полями формы. Проверьте заголовки столбцов.');
        return;
      }

      onDataImport(extractedData);
      setIsModalOpen(false);
      setParseResult(null);
      setSelectedRow(null);
      toast.success(`Заполнено ${filledCount} полей из файла`);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Ошибка при импорте данных: ' + (error.message || 'Неизвестная ошибка'));
    }
  }, [parseResult, selectedRow, fields, onDataImport]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setParseResult(null);
    setSelectedRow(null);
  }, []);

  const previewData = parseResult ? getPreviewData(parseResult, 10) : null;

  return (
    <>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-6 transition-all duration-200',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50',
          disabled && 'opacity-50 cursor-not-allowed',
          isLoading && 'pointer-events-none',
          !disabled && !isLoading && 'cursor-pointer'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="Загрузить Excel файл"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled || isLoading}
        />
        
        <div className="flex flex-col items-center gap-3 text-center">
          {isLoading ? (
            <>
              <div className="animate-spin h-10 w-10 border-3 border-blue-500 border-t-transparent rounded-full" />
              <p className="text-sm text-slate-500">Обработка файла...</p>
            </>
          ) : (
            <>
              <div className={cn(
                'p-3 rounded-full',
                isDragging ? 'bg-blue-100' : 'bg-slate-100'
              )}>
                {isDragging ? (
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                ) : (
                  <Upload className="h-8 w-8 text-slate-500" />
                )}
              </div>
              
              <div>
                <p className="font-medium text-slate-700">
                  {isDragging 
                    ? 'Отпустите файл для загрузки' 
                    : 'Перетащите Excel-файл или нажмите для выбора'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Поддерживаются форматы .xlsx, .xls, .csv (до 50MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row Selection Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Выбор строки пациента"
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Данные успешно прочитаны. Выберите строку с данными пациента, кликнув на неё:
          </p>
          
          {previewData ? (
            <div className="overflow-x-auto border rounded-lg max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                      №
                    </th>
                    {previewData.headers.slice(0, 8).map((header, idx) => (
                      <th 
                        key={idx}
                        className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase truncate max-w-32"
                        title={header}
                      >
                        {header}
                      </th>
                    ))}
                    {previewData.headers.length > 8 && (
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">
                        +{previewData.headers.length - 8}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewData.rows.map((row) => (
                    <tr
                      key={row.index}
                      onClick={() => handleRowSelect(row.index)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        selectedRow === row.index
                          ? 'bg-blue-100 hover:bg-blue-100'
                          : 'hover:bg-slate-50'
                      )}
                    >
                      <td className="px-3 py-2 font-medium text-slate-600">
                        {row.index}
                      </td>
                      {row.cells.slice(0, 8).map((cell, idx) => (
                        <td 
                          key={idx} 
                          className="px-3 py-2 text-slate-700 truncate max-w-32"
                          title={cell}
                        >
                          {cell || '—'}
                        </td>
                      ))}
                      {row.cells.length > 8 && (
                        <td className="px-3 py-2 text-slate-400">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              Нет данных для отображения
            </div>
          )}

          {parseResult && parseResult.totalRows > 10 && (
            <p className="text-sm text-slate-500">
              Показаны первые 10 строк из {parseResult.totalRows}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={handleCloseModal}
            >
              <X className="h-4 w-4" />
              Отмена
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedRow === null}
              icon={<Check className="h-4 w-4" />}
            >
              Импортировать строку {selectedRow ?? ''}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};