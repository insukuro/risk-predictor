import { FIELD_SCHEMA } from './schema';
import type { PatientFeatures } from '../types';

export interface ColumnMapping {
  [fieldKey: string]: number;
}

const MAPPING_STORAGE_KEY = 'risk_predictor_column_mapping_v1';

export function loadColumnMapping(): ColumnMapping {
  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveColumnMapping(mapping: ColumnMapping): void {
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping));
}

/**
 * Парсер данных из буфера обмена (Excel / МИС).
 * Разбивает строку по табуляции (стандартный разделитель Excel).
 */
export function parseClipboardData(
  text: string,
  mapping: ColumnMapping
): { data: Partial<PatientFeatures>; parsed: number; total: number } {
  const cleaned = text.replace(/\r/g, '');
  const rows = cleaned.split('\n').filter((r) => r.trim().length > 0);
  if (rows.length === 0) {
    return { data: {}, parsed: 0, total: 0 };
  }

  // Берём первую строку данных
  const cells = rows[0].split('\t').map((c) => c.trim());
  const totalFields = Object.keys(mapping).length;
  const result: Partial<PatientFeatures> = {};
  let parsedCount = 0;

  for (const [fieldKey, colIndex] of Object.entries(mapping)) {
    if (colIndex < 0 || colIndex >= cells.length) continue;
    const rawValue = cells[colIndex];
    if (rawValue === undefined || rawValue === '' || rawValue === '-') continue;

    // Нормализация: запятая -> точка, trim, parseInt/parseFloat
    const normalized = rawValue.replace(',', '.').trim().toLowerCase();

    // Специальная обработка бинарных/булевых значений
    const fieldSchema = FIELD_SCHEMA.find((f) => f.key === fieldKey);
    const isBinary =
      fieldSchema?.type === 'toggle' ||
      fieldKey.toLowerCase().includes('0/1') ||
      fieldKey === 'Срочность (0=план,1=экстр)' ||
      fieldKey === 'pump';

    if (isBinary) {
      if (['1', 'true', 'да', 'yes', 'y', 'экстренная', 'экстр', 'есть'].includes(normalized)) {
        result[fieldKey] = 1;
        parsedCount++;
      } else if (['0', 'false', 'нет', 'no', 'n', 'плановая', 'план', 'нет данных', ''].includes(normalized)) {
        result[fieldKey] = 0;
        parsedCount++;
      } else {
        const num = Number(normalized);
        if (!Number.isNaN(num)) {
          result[fieldKey] = num;
          parsedCount++;
        }
      }
    } else {
      const num = Number(normalized);
      if (!Number.isNaN(num)) {
        result[fieldKey] = num;
        parsedCount++;
      }
    }
  }

  return { data: result, parsed: parsedCount, total: totalFields };
}

/**
 * Попытка автоматически распознать заголовки из строки.
 * Возвращает маппинг "ключ поля -> индекс колонки".
 */
export function autoDetectMapping(headerRow: string): ColumnMapping {
  const headers = headerRow.split('\t').map((h) => h.trim().toLowerCase());
  const mapping: ColumnMapping = {};

  const fieldAliases: Record<string, string[]> = {
    'Пол (0=жен,1=муж)': ['пол', 'sex', 'gender'],
    'Возраст (лет)': ['возраст', 'age'],
    'Рост (м)': ['рост', 'height'],
    'Вес (кг)': ['вес', 'weight'],
    'Срочность (0=план,1=экстр)': ['срочность', 'urgency', 'экстренность'],
    'Гипертония (0/1)': ['гипертония', 'гипертензия', 'hypertension', 'аг'],
    'Сахарный диабет (0/1)': ['сахарный диабет', 'диабет', 'diabetes', 'сд'],
    'ХОБЛ (0/1)': ['хобл', 'copd'],
    'ИМ в анамнезе (0/1)': ['им ', 'инфаркт', 'миокард', 'mi ', ' infarction'],
    'ХСН (0/1)': ['хсн', 'chf'],
    'ОНМК в анамнезе (0/1)': ['онмк', 'инсульт', 'stroke'],
    'ФП в анамнезе (0/1)': ['фибрилляци', 'мерцательн', 'af ', ' fp '],
    'Атеросклероз НК (0/1)': ['атеросклероз нк', 'нижние конечност', 'pad'],
    'Атеросклероз БЦА (0/1)': ['атеросклероз бца', 'бца', 'bca'],
    'Язвенная болезнь ЖКТ (0/1)': ['язв', 'язвенн', 'ulcer'],
    'Лёгочная гипертензия (0/1)': ['лёгочн', 'легочн', 'лг', 'paph'],
    'Креатинин в ОРИТ (мкмоль/л)': ['креатинин', 'creatinine', 'creat'],
    'Категория ФВ ЛЖ': ['фв', 'фракция выброса', 'lvef', 'ef '],
    'ХСН ФК': ['хсн фк', 'nyha', 'фк'],
    pump: ['pump', 'ик ', 'искусственн', 'on_pump'],
    ХБП: ['хбп', 'стадия хбп', 'ckd'],
  };

  for (const [fieldKey, aliases] of Object.entries(fieldAliases)) {
    const idx = headers.findIndex((h) => aliases.some((alias) => h.includes(alias)));
    if (idx >= 0) {
      mapping[fieldKey] = idx;
    }
  }

  return mapping;
}
