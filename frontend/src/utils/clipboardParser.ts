import type { UIField, FormValues, ClipboardParseResult } from '../types';

/**
 * Regex patterns for extracting medical data from unstructured text
 */
const EXTRACTION_PATTERNS: Record<string, RegExp[]> = {
  // Age patterns
  'Возраст (лет)': [
    /(?:возраст|лет|года)[:\s]*(\d+)/i,
    /(\d+)\s*(?:лет|года|год)/i,
    /(?:пациент|больной)[,\s]+(\d+)\s*(?:лет|года)/i,
  ],
  
  // Weight patterns
  'Вес (кг)': [
    /(?:вес|масса(?:\s+тела)?)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:кг)?/i,
    /(\d+(?:[.,]\d+)?)\s*кг/i,
  ],
  
  // Height patterns
  'Рост (м)': [
    /(?:рост)[:\s]*([01]?[.,]\d{1,2})/i,
    /(?:рост)[:\s]*(\d{3})\s*(?:см)?/i, // Height in cm
    /(?:рост)[:\s]*(\d+(?:[.,]\d+)?)\s*м/i,
  ],
  
  // Creatinine patterns
  'Креатинин в ОРИТ (мкмоль/л)': [
    /(?:креатинин(?:\s+(?:до|в|после)?\s*(?:операции|орит)?)?|креат)[:\s]*(\d+(?:[.,]\d+)?)/i,
    /(?:cr|creat)[:\s]*(\d+(?:[.,]\d+)?)/i,
  ],
  
  // Hemoglobin patterns
  'Hb до операции (г/л)': [
    /(?:hb|гемоглобин|hemoglobin)[:\s]*(\d+(?:[.,]\d+)?)/i,
    /(?:hgb)[:\s]*(\d+(?:[.,]\d+)?)/i,
  ],
  
  // Heart rate patterns
  'ЧСС исх. (уд/мин)': [
    /(?:чсс|пульс|hr)[:\s]*(\d+)/i,
  ],
  
  // Blood pressure patterns
  'АДс исх. (мм рт.ст.)': [
    /(?:ад|давление|bp)[:\s]*(\d+)\/\d+/i,
  ],
  'АДд исх. (мм рт.ст.)': [
    /(?:ад|давление|bp)[:\s]*\d+\/(\d+)/i,
  ],
};

/**
 * Binary marker patterns - check for presence/absence
 */
const BINARY_MARKERS: Record<string, { positive: RegExp[]; negative: RegExp[] }> = {
  'Гипертония (0/1)': {
    positive: [/гипертон/i, /\bаг\b/i, /артериальн\w*\s*гипертенз/i],
    negative: [/без\s+гипертон/i, /(?:нет|отрицает)\s+гипертон/i],
  },
  'Сахарный диабет (0/1)': {
    positive: [/диабет/i, /\bсд\b(?:\s*[12])?/i],
    negative: [/без\s+диабет/i, /(?:нет|отрицает)\s+диабет/i],
  },
  'ХОБЛ (0/1)': {
    positive: [/хобл/i, /хронич\w*\s*обструктив/i, /copd/i],
    negative: [/без\s+хобл/i, /(?:нет|отрицает)\s+хобл/i],
  },
  'ФП в анамнезе (0/1)': {
    positive: [/фибрилляц\w*\s*предсерд/i, /\bфп\b/i, /мерцательн\w*\s*аритм/i],
    negative: [/без\s+(?:фп|фибрилляц)/i, /(?:нет|отрицает)\s+(?:фп|фибрилляц)/i],
  },
  'ИМ в анамнезе (0/1)': {
    positive: [/инфаркт\s*миокард/i, /\bим\b/i, /(?:перенес(?:ённый|енный)?)\s*инфаркт/i],
    negative: [/без\s+(?:им|инфаркт)/i, /(?:нет|отрицает)\s+(?:им|инфаркт)/i],
  },
  'ХСН (0/1)': {
    positive: [/(?:хронич\w*\s*)?сердечн\w*\s*недостаточ/i, /\bхсн\b/i],
    negative: [/без\s+(?:хсн|сердечн\w*\s*недостаточ)/i],
  },
  'ОНМК в анамнезе (0/1)': {
    positive: [/онмк/i, /инсульт/i, /(?:острое\s+)?нарушен\w*\s*мозгов/i],
    negative: [/без\s+(?:онмк|инсульт)/i, /(?:нет|отрицает)\s+(?:онмк|инсульт)/i],
  },
  'Атеросклероз НК (0/1)': {
    positive: [/атеросклероз\w*\s*(?:нижн\w*\s*конечност|нк)/i, /облитерирующ\w*\s*атероскл/i],
    negative: [/без\s+атеросклероз/i],
  },
  'Атеросклероз БЦА (0/1)': {
    positive: [/атеросклероз\w*\s*(?:бца|брахиоцефальн)/i],
    negative: [],
  },
  'Язвенная болезнь ЖКТ (0/1)': {
    positive: [/язвенн\w*\s*болезн/i, /язва\s*(?:желудка|12-?перстн)/i],
    negative: [/без\s+язвенн/i],
  },
  'Лёгочная гипертензия (0/1)': {
    positive: [/л[её]гочн\w*\s*гипертенз/i, /\bлг\b/i],
    negative: [/без\s+л[её]гочн\w*\s*гипертенз/i],
  },
};

/**
 * Parse tabular data from clipboard (Excel row copy)
 */
const parseTabularData = (text: string, fields: UIField[]): FormValues => {
  const result: FormValues = {};
  
  // Try different delimiters
  const delimiters = ['\t', ';', ','];
  let values: string[] = [];
  
  for (const delimiter of delimiters) {
    const parts = text.split(delimiter).map(s => s.trim());
    if (parts.length > 3) {
      values = parts;
      break;
    }
  }
  
  if (values.length === 0) return result;
  
  // Check if first row is headers (contains text matching field labels)
  const lines = text.split('\n').filter(l => l.trim());
  let dataValues = values;
  let headers: string[] | null = null;
  
  if (lines.length >= 2) {
    const firstLine = lines[0].split(/[\t;,]/).map(s => s.trim());
    const secondLine = lines[1].split(/[\t;,]/).map(s => s.trim());
    
    // Check if first line looks like headers
    const firstLineHasLabels = firstLine.some(h => 
      fields.some(f => 
        f.label.toLowerCase().includes(h.toLowerCase()) || 
        f.id.toLowerCase().includes(h.toLowerCase())
      )
    );
    
    if (firstLineHasLabels) {
      headers = firstLine;
      dataValues = secondLine;
    }
  }
  
  if (headers) {
    // Map by headers
    headers.forEach((header, index) => {
      const field = fields.find(f => 
        f.id.toLowerCase() === header.toLowerCase() ||
        f.label.toLowerCase() === header.toLowerCase() ||
        f.id.toLowerCase().includes(header.toLowerCase()) ||
        header.toLowerCase().includes(f.id.toLowerCase().split(' ')[0])
      );
      
      if (field && dataValues[index]) {
        const value = convertClipboardValue(dataValues[index], field);
        if (value !== null) {
          result[field.id] = value;
        }
      }
    });
  } else {
    // Map sequentially by field order
    const sortedFields = [...fields].sort((a, b) => a.order - b.order);
    dataValues.forEach((value, index) => {
      if (index < sortedFields.length && value) {
        const field = sortedFields[index];
        const converted = convertClipboardValue(value, field);
        if (converted !== null) {
          result[field.id] = converted;
        }
      }
    });
  }
  
  return result;
};

/**
 * Parse unstructured text (medical notes, epicrisis)
 */
const parseUnstructuredText = (text: string, fields: UIField[]): FormValues => {
  const result: FormValues = {};
  const normalizedText = text.toLowerCase();
  
  // Extract numeric values using patterns
  fields.forEach(field => {
    const patterns = EXTRACTION_PATTERNS[field.id];
    if (patterns) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          let value = match[1].replace(',', '.');
          
          // Special handling for height in cm
          if (field.id === 'Рост (м)' && parseFloat(value) > 100) {
            value = String(parseFloat(value) / 100);
          }
          
          const converted = convertClipboardValue(value, field);
          if (converted !== null) {
            result[field.id] = converted;
            break;
          }
        }
      }
    }
  });
  
  // Extract binary markers
  Object.entries(BINARY_MARKERS).forEach(([fieldId, patterns]) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    // Check for negative first
    const hasNegative = patterns.negative.some(p => p.test(normalizedText));
    if (hasNegative) {
      result[fieldId] = 0;
      return;
    }
    
    // Check for positive
    const hasPositive = patterns.positive.some(p => p.test(normalizedText));
    if (hasPositive) {
      result[fieldId] = 1;
    }
  });
  
  return result;
};

/**
 * Convert clipboard value to appropriate type
 */
const convertClipboardValue = (value: string, field: UIField): number | null => {
  if (!value || value.trim() === '') return null;
  
  let processedValue = value.replace(',', '.').trim();
  
  switch (field.type) {
    case 'number': {
      const num = parseFloat(processedValue);
      if (isNaN(num)) return null;
      if (field.min !== null && num < field.min) return null;
      if (field.max !== null && num > field.max) return null;
      return num;
    }
    
    case 'boolean': {
      const lower = processedValue.toLowerCase();
      if (['1', 'да', 'yes', 'true', '+'].includes(lower)) return 1;
      if (['0', 'нет', 'no', 'false', '-'].includes(lower)) return 0;
      const num = parseFloat(processedValue);
      if (!isNaN(num)) return num ? 1 : 0;
      return null;
    }
    
    case 'select': {
      const num = parseFloat(processedValue);
      if (!isNaN(num)) {
        const validOption = field.options.find(o => o.value === num);
        if (validOption) return num;
      }
      return null;
    }
    
    default:
      return null;
  }
};

/**
 * Main clipboard parsing function
 */
export const parseClipboardText = async (
  fields: UIField[]
): Promise<ClipboardParseResult> => {
  try {
    const text = await navigator.clipboard.readText();
    
    if (!text || text.trim() === '') {
      return {
        success: false,
        filledFields: 0,
        totalFields: fields.length,
        values: {},
      };
    }
    
    // Determine format: tabular or unstructured
    const hasTabDelimiters = /[\t;]/.test(text);
    const hasMultipleCommas = (text.match(/,/g) || []).length > 5;
    const looksTabular = hasTabDelimiters || (hasMultipleCommas && !text.includes('\n'));
    
    let values: FormValues;
    
    if (looksTabular) {
      values = parseTabularData(text, fields);
    } else {
      values = parseUnstructuredText(text, fields);
    }
    
    const filledFields = Object.keys(values).length;
    
    return {
      success: filledFields > 0,
      filledFields,
      totalFields: fields.length,
      values,
    };
  } catch (error) {
    console.error('Clipboard parse error:', error);
    return {
      success: false,
      filledFields: 0,
      totalFields: fields.length,
      values: {},
    };
  }
};

const normalizeText = (value: any): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е');

export const normalizeSelectValue = (
  value: any,
  field: UIField
): number | string | null => {
  if (value === null || value === undefined || value === '') return null;

  const options = field.options || [];
  if (!options.length) return value;

  // 1. exact by option.value
  const byValue = options.find(
    (option) => String(option.value) === String(value)
  );
  if (byValue) return byValue.value;

  // 2. exact by label
  const normalizedValue = normalizeText(value);
  const byLabel = options.find(
    (option) => normalizeText(option.label) === normalizedValue
  );
  if (byLabel) return byLabel.value;

  // 3. partial by label
  const byPartialLabel = options.find((option) => {
    const normalizedLabel = normalizeText(option.label);
    return (
      normalizedLabel.includes(normalizedValue) ||
      normalizedValue.includes(normalizedLabel)
    );
  });
  if (byPartialLabel) return byPartialLabel.value;

  return value;
};

/**
 * Validate value against field constraints
 */
export const validateFieldValue = (
  value: any,
  field: UIField
): { valid: boolean; error?: string } => {
  // Пустые значения не валидируем — это забота submit-логики
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  switch (field.type) {
    case 'number': {
      const num =
        typeof value === 'number'
          ? value
          : parseFloat(String(value).replace(',', '.'));

      if (isNaN(num)) {
        return { valid: false, error: 'Введите число' };
      }

      if (field.min != null && num < field.min) {
        return { valid: false, error: `Минимум: ${field.min}` };
      }

      if (field.max != null && num > field.max) {
        return { valid: false, error: `Максимум: ${field.max}` };
      }

      return { valid: true };
    }

  case 'select': {
    const normalized = normalizeSelectValue(value, field);
    if (normalized === null) {
      return { valid: false, error: 'Некорректное значение' };
    }
    return { valid: true };
  }

    case 'boolean': {
      const valid =
        value === 0 ||
        value === 1 ||
        value === true ||
        value === false;

      return valid
        ? { valid: true }
        : { valid: false, error: 'Некорректное значение' };
    }

    default:
      return { valid: true };
  }
};
