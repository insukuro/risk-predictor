import type { FieldSchema, ModelVersion, PatientFeatures } from '../types';

// Схема полей формы (имитация ответа GET /ui/metadata)
export const FIELD_SCHEMA: FieldSchema[] = [
  // Общая информация
  {
    key: 'Пол (0=жен,1=муж)',
    label: 'Пол',
    type: 'select',
    group: 'general',
    default: 1,
    options: [
      { label: 'Мужской', value: 1 },
      { label: 'Женский', value: 0 },
    ],
  },
  {
    key: 'Возраст (лет)',
    label: 'Возраст',
    type: 'number',
    group: 'general',
    default: 68,
    unit: 'лет',
    min: 18,
    max: 120,
    step: 1,
  },
  {
    key: 'Рост (м)',
    label: 'Рост',
    type: 'number',
    group: 'general',
    default: 1.75,
    unit: 'м',
    min: 1.0,
    max: 2.5,
    step: 0.01,
  },
  {
    key: 'Вес (кг)',
    label: 'Вес',
    type: 'number',
    group: 'general',
    default: 95,
    unit: 'кг',
    min: 30,
    max: 250,
    step: 0.5,
  },
  // Анамнез и коморбидность
  {
    key: 'Гипертония (0/1)',
    label: 'Артериальная гипертензия',
    type: 'toggle',
    group: 'anamnesis',
    default: 1,
  },
  {
    key: 'Сахарный диабет (0/1)',
    label: 'Сахарный диабет',
    type: 'toggle',
    group: 'anamnesis',
    default: 1,
  },
  {
    key: 'ХОБЛ (0/1)',
    label: 'ХОБЛ',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  {
    key: 'ИМ в анамнезе (0/1)',
    label: 'Инфаркт миокарда в анамнезе',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  {
    key: 'ХСН (0/1)',
    label: 'Хроническая сердечная недостаточность',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  {
    key: 'ОНМК в анамнезе (0/1)',
    label: 'ОНМК / Инсульт',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  {
    key: 'ФП в анамнезе (0/1)',
    label: 'Фибрилляция предсердий',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  {
    key: 'Атеросклероз НК (0/1)',
    label: 'Атеросклероз нижних конечностей',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  {
    key: 'Атеросклероз БЦА (0/1)',
    label: 'Атеросклероз БЦА',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  {
    key: 'Язвенная болезнь ЖКТ (0/1)',
    label: 'Язвенная болезнь ЖКТ',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  {
    key: 'Лёгочная гипертензия (0/1)',
    label: 'Лёгочная гипертензия',
    type: 'toggle',
    group: 'anamnesis',
    default: 0,
  },
  // Статус операции
  {
    key: 'Срочность (0=план,1=экстр)',
    label: 'Срочность операции',
    type: 'select',
    group: 'operation',
    default: 0,
    options: [
      { label: 'Плановая', value: 0 },
      { label: 'Экстренная', value: 1 },
    ],
  },
  {
    key: 'Категория ФВ ЛЖ',
    label: 'Фракция выброса ЛЖ',
    type: 'select',
    group: 'operation',
    default: 40,
    options: [
      { label: 'Нормальная (>50%)', value: 55 },
      { label: 'Умеренно сниженная (31-50%)', value: 40 },
      { label: 'Тяжёлая дисфункция (≤30%)', value: 25 },
    ],
  },
  {
    key: 'ХСН ФК',
    label: 'ФК ХСН (NYHA)',
    type: 'select',
    group: 'operation',
    default: 2,
    options: [
      { label: 'I ФК', value: 1 },
      { label: 'II ФК', value: 2 },
      { label: 'III ФК', value: 3 },
      { label: 'IV ФК', value: 4 },
    ],
  },
  {
    key: 'pump',
    label: 'Использование ИК',
    type: 'select',
    group: 'operation',
    default: 1,
    options: [
      { label: 'На насосе', value: 1 },
      { label: 'Off-pump', value: 0 },
    ],
  },
  // Лаборатория
  {
    key: 'Креатинин в ОРИТ (мкмоль/л)',
    label: 'Креатинин',
    type: 'number',
    group: 'labs',
    default: 115,
    unit: 'мкмоль/л',
    min: 20,
    max: 1500,
    step: 1,
  },
  {
    key: 'ХБП',
    label: 'Стадия ХБП',
    type: 'select',
    group: 'labs',
    default: 2,
    options: [
      { label: 'Нет / С1', value: 0 },
      { label: 'С2', value: 1 },
      { label: 'С3а', value: 2 },
      { label: 'С3б', value: 3 },
      { label: 'С4', value: 4 },
      { label: 'С5 (диализ)', value: 5 },
    ],
  },
];

// Группы полей
export const FIELD_GROUPS = {
  general: { label: 'Общая информация', icon: 'User' },
  anamnesis: { label: 'Анамнез и коморбидность', icon: 'HeartPulse' },
  operation: { label: 'Статус операции', icon: 'Activity' },
  labs: { label: 'Лабораторные показатели', icon: 'FlaskConical' },
} as const;

// Демо-данные для разработки
export const DEMO_DATA: PatientFeatures = {
  'Пол (0=жен,1=муж)': 1,
  'Возраст (лет)': 68,
  'Рост (м)': 1.75,
  'Вес (кг)': 95,
  'Срочность (0=план,1=экстр)': 0,
  'Гипертония (0/1)': 1,
  'Сахарный диабет (0/1)': 1,
  'ХОБЛ (0/1)': 0,
  'ИМ в анамнезе (0/1)': 0,
  'ХСН (0/1)': 0,
  'ОНМК в анамнезе (0/1)': 0,
  'ФП в анамнезе (0/1)': 0,
  'Атеросклероз НК (0/1)': 0,
  'Атеросклероз БЦА (0/1)': 0,
  'Язвенная болезнь ЖКТ (0/1)': 0,
  'Лёгочная гипертензия (0/1)': 0,
  ХБП: 2,
  'Креатинин в ОРИТ (мкмоль/л)': 115.0,
  'Категория ФВ ЛЖ': 40.0,
  'ХСН ФК': 2,
  pump: 1,
};

// Доступные версии моделей
export const AVAILABLE_MODELS: ModelVersion[] = [
  { id: 'v4-ensemble', label: 'v4-ensemble (ансамбль)', description: 'Мультиклассовый прогноз осложнений' },
  { id: 'v2', label: 'v2 (логистическая регрессия)', description: 'Базовая модель летальности' },
];

// Маппинг для парсера Excel (по умолчанию)
export const DEFAULT_COLUMN_MAPPING: Record<string, number> = {
  'Пол (0=жен,1=муж)': 0,
  'Возраст (лет)': 1,
  'Рост (м)': 2,
  'Вес (кг)': 3,
  'Срочность (0=план,1=экстр)': 4,
  'Гипертония (0/1)': 5,
  'Сахарный диабет (0/1)': 6,
  'ХОБЛ (0/1)': 7,
  'Креатинин в ОРИТ (мкмоль/л)': 8,
  'Категория ФВ ЛЖ': 9,
  'ХСН ФК': 10,
  pump: 11,
  'ФП в анамнезе (0/1)': 12,
};
