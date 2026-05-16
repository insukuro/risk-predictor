import { useState } from 'react';
import { ClipboardPaste, Settings2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Textarea, Card } from '../ui/Primitives';
import {
  autoDetectMapping,
  loadColumnMapping,
  parseClipboardData,
  saveColumnMapping,
  type ColumnMapping,
} from '../../lib/parser';
import { FIELD_SCHEMA } from '../../lib/schema';
import type { PatientFeatures } from '../../types';
import toast from 'react-hot-toast';

interface ExcelPasterProps {
  onDataParsed: (data: Partial<PatientFeatures>) => void;
}

export function ExcelPaster({ onDataParsed }: ExcelPasterProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [headerRow, setHeaderRow] = useState('');
  const [dataRow, setDataRow] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const openModal = () => {
    setOpen(true);
    setMapping(loadColumnMapping());
    setStep(loadColumnMapping() && Object.keys(loadColumnMapping()).length > 0 ? 2 : 1);
    setHeaderRow('');
    setDataRow('');
  };

  const detectMapping = () => {
    if (!headerRow.trim()) {
      toast.error('Вставьте строку с заголовками из Excel');
      return;
    }
    const detected = autoDetectMapping(headerRow);
    if (Object.keys(detected).length === 0) {
      toast.error('Не удалось распознать заголовки. Попробуйте вручную.');
    }
    setMapping(detected);
  };

  const saveMappingAndNext = () => {
    if (Object.keys(mapping).length === 0) {
      toast.error('Настройте хотя бы одну колонку');
      return;
    }
    saveColumnMapping(mapping);
    toast.success(`Сохранён маппинг для ${Object.keys(mapping).length} полей`);
    setStep(2);
  };

  const handlePaste = () => {
    if (!dataRow.trim()) {
      toast.error('Вставьте строку с данными пациента');
      return;
    }
    const { data, parsed, total } = parseClipboardData(dataRow, mapping);
    if (parsed === 0) {
      toast.error('Не удалось распознать ни одного значения');
      return;
    }
    onDataParsed(data);
    toast.success(`Распознано ${parsed} из ${total} параметров`, { icon: '✅' });
    setOpen(false);
    setDataRow('');
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="group flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition group-hover:scale-105">
          <ClipboardPaste className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">Быстрый ввод из Excel / МИС</div>
          <div className="text-xs text-slate-500">
            Скопируйте строку и вставьте сюда (Ctrl+V). Настройка колонок сохраняется.
          </div>
        </div>
        <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
          Ctrl+V
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-0">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-900">Режим импорта таблиц</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 px-4 pt-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className={`flex-1 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition ${
                    step === 1
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  1. Настройка колонок
                </button>
                <button
                  onClick={() => setStep(2)}
                  className={`flex-1 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition ${
                    step === 2
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  2. Вставка данных
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4">
              {step === 1 && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800">
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">Один раз — и всё</div>
                        Вставьте первую строку с заголовками из вашего Excel-файла. Алгоритм попробует
                        автоматически определить колонки, но вы можете настроить маппинг вручную.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Строка с заголовками (вставьте из Excel)
                    </label>
                    <Textarea
                      value={headerRow}
                      onChange={(e) => setHeaderRow(e.target.value)}
                      placeholder="Пол	Возраст	Рост	Вес	..."
                      rows={2}
                    />
                    <Button variant="secondary" size="sm" onClick={detectMapping} className="mt-2">
                      Автоопределение
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-700">Маппинг колонок:</div>
                    <div className="max-h-64 space-y-1.5 overflow-y-auto">
                      {FIELD_SCHEMA.map((field) => (
                        <div key={field.key} className="flex items-center gap-2">
                          <span className="w-56 flex-shrink-0 text-xs text-slate-600">{field.label}</span>
                          <input
                            type="number"
                            min="-1"
                            value={mapping[field.key] ?? -1}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (Number.isNaN(v) || v < 0) {
                                const { [field.key]: _, ...rest } = mapping;
                                setMapping(rest);
                              } else {
                                setMapping({ ...mapping, [field.key]: v });
                              }
                            }}
                            className="w-16 rounded border border-slate-200 px-2 py-1 text-xs"
                            placeholder="-"
                          />
                          {mapping[field.key] !== undefined && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                    <div className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      <div>
                        Настроен маппинг для <b>{Object.keys(mapping).length}</b> полей.
                        Вставьте строку с данными пациента ниже.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Строка с данными пациента
                    </label>
                    <Textarea
                      value={dataRow}
                      onChange={(e) => setDataRow(e.target.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData('Text');
                        setDataRow(text);
                      }}
                      placeholder="1	68	1.75	95	0	1	1	0	115	40	2	1	0	..."
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handlePaste} className="flex-1">
                      <ClipboardPaste className="h-4 w-4" />
                      Применить к форме
                    </Button>
                    <Button variant="ghost" onClick={() => setStep(1)}>
                      Изменить маппинг
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 p-3">
              {step === 1 && (
                <Button onClick={saveMappingAndNext}>
                  Сохранить маппинг и перейти
                </Button>
              )}
              {step === 2 && (
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Закрыть
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
