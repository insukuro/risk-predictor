import Papa from 'papaparse';
import Fuse from 'fuse.js';
import type { ExcelParseResult, UIField, FormValues } from '../types';

/**
 * Parse Excel/CSV file and extract data
 */
export const parseExcelFile = async (file: File): Promise<ExcelParseResult> => {
     return new Promise((resolve, reject) => {
       Papa.parse(file, {
         skipEmptyLines: true,
         complete: (results) => {
           const data = results.data as any[][];
           // Map your data here just like you did with your original code
           // (Papa.parse result is an array of arrays)
           // ...
         },
         error: (err) => reject(err)
       });
     });
   };
/**
 * Fuzzy match column headers to schema fields
 */
export const fuzzyMatchHeaders = (
  headers: string[],
  fields: UIField[]
): Map<string, string> => {
  const mapping = new Map<string, string>();
  
  // Prepare field search targets
  const fieldTargets = fields.map(f => ({
    id: f.id,
    label: f.label,
    searchText: `${f.id} ${f.label}`.toLowerCase(),
  }));
  
  // Fuse.js configuration for fuzzy matching
  const fuse = new Fuse(fieldTargets, {
    keys: ['id', 'label', 'searchText'],
    threshold: 0.4,
    includeScore: true,
  });
  
  headers.forEach(header => {
    if (!header) return;
    
    const normalizedHeader = header.toLowerCase().trim();
    
    // Try exact match first
    const exactMatch = fieldTargets.find(
      f => f.id.toLowerCase() === normalizedHeader || 
           f.label.toLowerCase() === normalizedHeader
    );
    
    if (exactMatch) {
      mapping.set(header, exactMatch.id);
      return;
    }
    
    // Try fuzzy match
    const results = fuse.search(normalizedHeader);
    if (results.length > 0 && results[0].score! < 0.4) {
      mapping.set(header, results[0].item.id);
    }
  });
  
  return mapping;
};

/**
 * Extract and validate row data according to schema
 */
export const extractRowData = (
  rowData: Record<string, any>,
  headerMapping: Map<string, string>,
  fields: UIField[]
): FormValues => {
  const result: FormValues = {};
  const fieldMap = new Map(fields.map(f => [f.id, f]));
  
  Object.entries(rowData).forEach(([header, value]) => {
    const fieldId = headerMapping.get(header);
    if (!fieldId) return;
    
    const field = fieldMap.get(fieldId);
    if (!field) return;
    
    // Convert and validate value
    const convertedValue = convertValue(value, field);
    if (convertedValue !== null) {
      result[fieldId] = convertedValue;
    }
  });
  
  return result;
};

/**
 * Convert value to appropriate type based on field definition
 */
const convertValue = (value: any, field: UIField): number | boolean | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Handle string values
  let processedValue = value;
  if (typeof value === 'string') {
    // Replace comma with dot for decimals
    processedValue = value.replace(',', '.').trim();
  }
  
  switch (field.type) {
    case 'number': {
      const num = parseFloat(processedValue);
      if (isNaN(num)) return null;
      
      // Validate min/max
      if (field.min !== null && num < field.min) return null;
      if (field.max !== null && num > field.max) return null;
      
      return num;
    }
    
    case 'boolean': {
      if (typeof processedValue === 'boolean') return processedValue ? 1 : 0;
      if (typeof processedValue === 'number') return processedValue ? 1 : 0;
      const strVal = String(processedValue).toLowerCase();
      if (['1', 'да', 'yes', 'true', '+'].includes(strVal)) return 1;
      if (['0', 'нет', 'no', 'false', '-'].includes(strVal)) return 0;
      return null;
    }
    
    case 'select': {
      const num = parseFloat(processedValue);
      if (!isNaN(num)) {
        // Check if value exists in options
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
 * Get preview data for row selection modal
 */
export const getPreviewData = (
  parseResult: ExcelParseResult,
  maxRows: number = 10
): { headers: string[]; rows: Array<{ index: number; cells: string[] }> } => {
  const { headers, rows } = parseResult;
  
  const previewRows = rows.slice(0, maxRows).map(row => ({
    index: row.rowIndex,
    cells: headers.map(h => {
      const val = row.data[h];
      return val !== null && val !== undefined ? String(val) : '';
    }),
  }));
  
  return {
    headers,
    rows: previewRows,
  };
};
