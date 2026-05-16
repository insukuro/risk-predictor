import type { RiskLevel } from '../../types';
import { riskLevelGradient, riskLevelLabel, riskLevelRing } from '../../lib/utils';

interface GaugeProps {
  value: number;
  level: RiskLevel;
  label?: string;
}

export function GaugeChart({ value, level, label = 'Летальность' }: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 80;
  const stroke = 14;
  const normalizedRadius = radius - stroke / 2;
  const circumference = Math.PI * normalizedRadius; // полуокружность
  const progress = (clamped / 100) * circumference;

  // Угол для стрелки спидометра
  const angle = -180 + (clamped / 100) * 180;

  return (
    <div className="relative flex flex-col items-center">
      <svg width={radius * 2} height={radius + 20} viewBox={`0 0 ${radius * 2} ${radius + 20}`}>
        {/* Фон */}
        <path
          d={`M ${stroke / 2} ${radius} a ${normalizedRadius} ${normalizedRadius} 0 1 1 ${normalizedRadius * 2} 0`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Прогресс */}
        <path
          d={`M ${stroke / 2} ${radius} a ${normalizedRadius} ${normalizedRadius} 0 1 1 ${normalizedRadius * 2} 0`}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className={riskLevelRing(level)}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
        />
        {/* Стрелка */}
        <g transform={`translate(${radius} ${radius}) rotate(${angle})`}>
          <line x1="0" y1="0" x2={normalizedRadius - 8} y2="0" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
          <circle r="4" fill="#334155" />
        </g>
        {/* Шкала - подписи */}
        <text x={10} y={radius + 16} fontSize="10" fill="#64748b">0</text>
        <text x={radius - 5} y={14} fontSize="10" fill="#64748b">50</text>
        <text x={radius * 2 - 20} y={radius + 16} fontSize="10" fill="#64748b">100</text>
      </svg>

      <div className="-mt-6 flex flex-col items-center">
        <div
          className={`bg-gradient-to-br bg-clip-text text-5xl font-bold tracking-tight text-transparent ${riskLevelGradient(level)}`}
        >
          {clamped.toFixed(1)}
          <span className="ml-1 text-2xl text-slate-400">%</span>
        </div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
        <div
          className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            level === 'danger'
              ? 'border-red-300 bg-red-100 text-red-700'
              : level === 'high'
              ? 'border-orange-300 bg-orange-100 text-orange-700'
              : level === 'medium'
              ? 'border-amber-300 bg-amber-100 text-amber-700'
              : 'border-emerald-300 bg-emerald-100 text-emerald-700'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              level === 'danger'
                ? 'bg-red-500 animate-pulse'
                : level === 'high'
                ? 'bg-orange-500'
                : level === 'medium'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />
          Риск: {riskLevelLabel(level)}
        </div>
      </div>
    </div>
  );
}
