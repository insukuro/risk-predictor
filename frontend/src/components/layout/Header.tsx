import { NavLink } from 'react-router-dom';
import { Activity, Calculator, History, HeartPulse } from 'lucide-react';
import { classNames } from '../../lib/utils';

const tabs = [
  { to: '/', label: 'Прогноз', icon: Activity },
  { to: '/calculators', label: 'Калькуляторы', icon: Calculator },
  { to: '/history', label: 'История', icon: History },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-red-600 shadow-sm">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-slate-900">Risk Predictor</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">CABG · АКШ</span>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  classNames(
                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Модель: <span className="font-semibold text-slate-900">v4-ensemble</span>
          </div>
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 md:inline-block">
            Tab ↹
          </kbd>
        </div>
      </div>
    </header>
  );
}
