import type {
  CalculatorResponse,
  HistoryRecord,
  PatientFeatures,
  PredictionResponse,
  RiskLevel,
  TargetRiskItem,
} from '../types';

// Имитация сетевой задержки
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Определение уровня риска
function getRiskLevel(score: number): RiskLevel {
  if (score < 5) return 'low';
  if (score < 15) return 'medium';
  if (score < 30) return 'high';
  return 'danger';
}

// Эвристический расчёт риска на основе признаков (симуляция ML)
function computeRiskScore(features: PatientFeatures): number {
  let score = 2; // базовый

  const age = Number(features['Возраст (лет)'] ?? 60);
  if (age > 75) score += 10;
  else if (age > 65) score += 5;
  else if (age > 55) score += 2;

  if (features['Пол (0=жен,1=муж)'] === 0) score += 2;
  if (features['Срочность (0=план,1=экстр)'] === 1) score += 12;

  const lvef = Number(features['Категория ФВ ЛЖ'] ?? 55);
  if (lvef <= 25) score += 15;
  else if (lvef <= 40) score += 7;

  const nyha = Number(features['ХСН ФК'] ?? 1);
  score += (nyha - 1) * 4;

  const creat = Number(features['Креатинин в ОРИТ (мкмоль/л)'] ?? 85);
  if (creat > 200) score += 10;
  else if (creat > 120) score += 5;

  if (features['Гипертония (0/1)'] === 1) score += 1;
  if (features['Сахарный диабет (0/1)'] === 1) score += 3;
  if (features['ХОБЛ (0/1)'] === 1) score += 5;
  if (features['ИМ в анамнезе (0/1)'] === 1) score += 4;
  if (features['ХСН (0/1)'] === 1) score += 4;
  if (features['ОНМК в анамнезе (0/1)'] === 1) score += 6;
  if (features['ФП в анамнезе (0/1)'] === 1) score += 3;
  if (features['Лёгочная гипертензия (0/1)'] === 1) score += 5;

  return Math.max(0.5, Math.min(99, score));
}

// Mock prediction endpoint
export async function predictRisk(
  features: PatientFeatures,
  _modelVersion?: string
): Promise<PredictionResponse> {
  await delay(400);

  const mainScore = computeRiskScore(features);

  const targets: TargetRiskItem[] = [
    {
      name: 'Летальность',
      score: Number(mainScore.toFixed(1)),
      level: getRiskLevel(mainScore),
    },
    {
      name: 'Острая почечная недостаточность',
      score: Number(
        (mainScore * 1.8 + (Number(features['Креатинин в ОРИТ (мкмоль/л)'] ?? 85) > 120 ? 10 : 0)).toFixed(1)
      ),
      level: 'medium',
    },
    {
      name: 'ИВЛ > 24 часов',
      score: Number((mainScore * 0.9 + (features['ХОБЛ (0/1)'] === 1 ? 8 : 0)).toFixed(1)),
      level: 'medium',
    },
    {
      name: 'Фибрилляция предсердий (послеоп.)',
      score: Number((mainScore * 0.7 + (features['Возраст (лет)'] > 70 ? 5 : 0)).toFixed(1)),
      level: 'low',
    },
    {
      name: 'Инфаркт миокарда (послеоп.)',
      score: Number((mainScore * 0.4).toFixed(1)),
      level: 'low',
    },
    {
      name: 'Повторная стернотомия',
      score: Number((mainScore * 0.3 + 2).toFixed(1)),
      level: 'low',
    },
  ].map((t) => ({ ...t, level: getRiskLevel(t.score) }));

  return {
    risk_score: mainScore,
    risk_level: getRiskLevel(mainScore),
    model_version: _modelVersion ?? 'v4-ensemble',
    targets,
  };
}

// Mock calculator endpoint
export async function calculateMetrics(features: PatientFeatures): Promise<CalculatorResponse> {
  await delay(200);

  const weight = Number(features['Вес (кг)'] ?? 75);
  const height = Number(features['Рост (м)'] ?? 1.75);
  const age = Number(features['Возраст (лет)'] ?? 60);
  const sex = Number(features['Пол (0=жен,1=муж)'] ?? 1);
  const creatinine = Number(features['Креатинин в ОРИТ (мкмоль/л)'] ?? 85);

  // ИМТ
  const bmi = weight / (height * height);
  let bmiLevel: RiskLevel = 'low';
  if (bmi < 18.5 || bmi >= 35) bmiLevel = 'high';
  else if (bmi < 20 || bmi >= 30) bmiLevel = 'medium';

  // Клиренс креатинина (Кокрофт-Голт)
  let clcr = ((140 - age) * weight) / (creatinine * 0.814);
  if (sex === 0) clcr *= 0.85;
  let clcrLevel: RiskLevel = 'low';
  if (clcr < 30) clcrLevel = 'danger';
  else if (clcr < 60) clcrLevel = 'high';
  else if (clcr < 90) clcrLevel = 'medium';

  // EuroSCORE II (упрощённая эвристика)
  const euro = computeRiskScore(features);
  const euroLevel = getRiskLevel(euro);

  // Индекс Чарлсона (упрощённо)
  let cci = 0;
  if (age >= 50) cci += Math.floor((age - 40) / 10);
  if (features['Сахарный диабет (0/1)'] === 1) cci += 1;
  if (features['ХСН (0/1)'] === 1) cci += 1;
  if (features['ИМ в анамнезе (0/1)'] === 1) cci += 1;
  if (features['ОНМК в анамнезе (0/1)'] === 1) cci += 1;
  if (features['ХОБЛ (0/1)'] === 1) cci += 1;
  let cciLevel: RiskLevel = 'low';
  if (cci >= 5) cciLevel = 'danger';
  else if (cci >= 3) cciLevel = 'high';
  else if (cci >= 2) cciLevel = 'medium';

  const metrics: CalculatorResponse['metrics'] = {
    'ИМТ (кг/м²)': { value: Number(bmi.toFixed(1)), label: bmiLabel(bmi), level: bmiLevel },
    'Клиренс креатинина (мл/мин)': { value: Number(clcr.toFixed(1)), label: clcrLabel(clcr), level: clcrLevel },
    'EuroSCORE II (%)': { value: Number(euro.toFixed(1)), label: euroLevel === 'danger' ? 'Критический риск' : euroLevel === 'high' ? 'Высокий риск' : euroLevel === 'medium' ? 'Умеренный риск' : 'Низкий риск', level: euroLevel },
    'Индекс коморбидности Чарлсона': { value: cci, label: cciLabel(cci), level: cciLevel },
  };

  // CHA₂DS₂-VASc и HAS-BLED только при ФП
  if (features['ФП в анамнезе (0/1)'] === 1) {
    let chads = 0;
    if (features['ХСН (0/1)'] === 1) chads += 1;
    if (features['Гипертония (0/1)'] === 1) chads += 1;
    if (age >= 75) chads += 2;
    else if (age >= 65) chads += 1;
    if (features['Сахарный диабет (0/1)'] === 1) chads += 1;
    if (features['ОНМК в анамнезе (0/1)'] === 1) chads += 2;
    if (features['Атеросклероз БЦА (0/1)'] === 1 || features['ИМ в анамнезе (0/1)'] === 1 || features['Атеросклероз НК (0/1)'] === 1) chads += 1;
    if (sex === 0) chads += 1;

    let hasbled = 0;
    if (features['Гипертония (0/1)'] === 1) hasbled += 1;
    if (creatinine > 200) hasbled += 1;
    if (features['ОНМК в анамнезе (0/1)'] === 1) hasbled += 1;
    if (features['Язвенная болезнь ЖКТ (0/1)'] === 1) hasbled += 1;
    if (age > 65) hasbled += 1;

    metrics['CHA₂DS₂-VASc'] = {
      value: chads,
      label: chads >= 3 ? 'Высокий риск инсульта' : chads >= 2 ? 'Умеренный риск' : 'Низкий риск',
      level: chads >= 3 ? 'danger' : chads >= 2 ? 'high' : 'low',
    };
    metrics['HAS-BLED'] = {
      value: hasbled,
      label: hasbled >= 3 ? 'Высокий риск кровотечения' : 'Низкий риск',
      level: hasbled >= 3 ? 'danger' : 'low',
    };
  }

  return { status: 'success', metrics };
}

function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'Дефицит массы';
  if (bmi < 25) return 'Норма';
  if (bmi < 30) return 'Избыточный вес';
  if (bmi < 35) return 'Ожирение I';
  if (bmi < 40) return 'Ожирение II';
  return 'Ожирение III';
}

function clcrLabel(clcr: number): string {
  if (clcr >= 90) return 'Норма';
  if (clcr >= 60) return 'С2 — лёгкое снижение';
  if (clcr >= 45) return 'С3а — умеренное снижение';
  if (clcr >= 30) return 'С3б — существенное снижение';
  if (clcr >= 15) return 'С4 — тяжёлое снижение';
  return 'С5 — терминальная ХПН';
}

function cciLabel(cci: number): string {
  // 10-летняя выживаемость
  if (cci === 0) return 'Выживаемость 99%';
  if (cci === 1) return 'Выживаемость 95%';
  if (cci === 2) return 'Выживаемость 90%';
  if (cci === 3) return 'Выживаемость 77%';
  if (cci === 4) return 'Выживаемость 53%';
  return 'Выживаемость ≤ 21%';
}

// История (локальное хранилище)
const HISTORY_KEY = 'risk_predictor_history_v1';

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return generateSeedHistory();
    const parsed = JSON.parse(raw) as HistoryRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return generateSeedHistory();
    return parsed;
  } catch {
    return generateSeedHistory();
  }
}

export function saveRecord(record: HistoryRecord): HistoryRecord[] {
  const history = loadHistory();
  history.unshift(record);
  const trimmed = history.slice(0, 200);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function deleteRecord(id: number): HistoryRecord[] {
  const history = loadHistory().filter((r) => r.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

function generateSeedHistory(): HistoryRecord[] {
  const samples: HistoryRecord[] = [
    {
      id: 1001,
      date: '2026-01-14T09:30:00',
      operationId: 'CABG-2026-0041',
      riskScore: 18.4,
      riskLevel: 'danger',
      model: 'v4-ensemble',
      euroscore: 16.2,
      features: { ...({} as PatientFeatures), 'Возраст (лет)': 72, 'Пол (0=жен,1=муж)': 1, 'Вес (кг)': 88, 'Рост (м)': 1.78, 'Креатинин в ОРИТ (мкмоль/л)': 142, 'Категория ФВ ЛЖ': 40, 'ХСН ФК': 3, 'Срочность (0=план,1=экстр)': 0, 'Гипертония (0/1)': 1, 'Сахарный диабет (0/1)': 1 },
      targets: [
        { name: 'Летальность', score: 18.4, level: 'danger' },
        { name: 'Острая почечная недостаточность', score: 45.2, level: 'danger' },
        { name: 'ИВЛ > 24ч', score: 12.0, level: 'medium' },
      ],
    },
    {
      id: 1002,
      date: '2026-01-13T14:10:00',
      operationId: 'CABG-2026-0040',
      riskScore: 3.2,
      riskLevel: 'low',
      model: 'v4-ensemble',
      euroscore: 2.8,
      features: { ...({} as PatientFeatures), 'Возраст (лет)': 54, 'Пол (0=жен,1=муж)': 1, 'Вес (кг)': 82, 'Рост (м)': 1.8, 'Креатинин в ОРИТ (мкмоль/л)': 85, 'Категория ФВ ЛЖ': 55, 'ХСН ФК': 1, 'Срочность (0=план,1=экстр)': 0, 'Гипертония (0/1)': 1, 'Сахарный диабет (0/1)': 0 },
      targets: [
        { name: 'Летальность', score: 3.2, level: 'low' },
        { name: 'Острая почечная недостаточность', score: 4.1, level: 'low' },
      ],
    },
    {
      id: 1003,
      date: '2026-01-12T11:45:00',
      operationId: 'CABG-2026-0039',
      riskScore: 11.7,
      riskLevel: 'medium',
      model: 'v4-ensemble',
      euroscore: 9.8,
      features: { ...({} as PatientFeatures), 'Возраст (лет)': 66, 'Пол (0=жен,1=муж)': 0, 'Вес (кг)': 68, 'Рост (м)': 1.62, 'Креатинин в ОРИТ (мкмоль/л)': 105, 'Категория ФВ ЛЖ': 40, 'ХСН ФК': 2, 'Срочность (0=план,1=экстр)': 0, 'Гипертония (0/1)': 1, 'Сахарный диабет (0/1)': 1 },
      targets: [
        { name: 'Летальность', score: 11.7, level: 'medium' },
        { name: 'Острая почечная недостаточность', score: 18.4, level: 'high' },
      ],
    },
    {
      id: 1004,
      date: '2026-01-10T08:20:00',
      operationId: 'CABG-2026-0038',
      riskScore: 34.5,
      riskLevel: 'danger',
      model: 'v4-ensemble',
      euroscore: 31.2,
      features: { ...({} as PatientFeatures), 'Возраст (лет)': 78, 'Пол (0=жен,1=муж)': 0, 'Вес (кг)': 62, 'Рост (м)': 1.58, 'Креатинин в ОРИТ (мкмоль/л)': 220, 'Категория ФВ ЛЖ': 25, 'ХСН ФК': 4, 'Срочность (0=план,1=экстр)': 1, 'Гипертония (0/1)': 1, 'Сахарный диабет (0/1)': 1, 'ХОБЛ (0/1)': 1 },
      targets: [
        { name: 'Летальность', score: 34.5, level: 'danger' },
        { name: 'Острая почечная недостаточность', score: 68.3, level: 'danger' },
        { name: 'ИВЛ > 24ч', score: 52.1, level: 'danger' },
      ],
    },
  ];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(samples));
  return samples;
}
