import React, { useState } from 'react';
import {
  Activity,
  History,
  Calculator,
  Heart,
  Server,
  CheckCircle,
  XCircle,
  BarChart2,
} from 'lucide-react';
import { Tabs } from './components/ui/Tabs';
import { ToastProvider } from './components/ui/Toast';
import { PredictionModule } from './modules/PredictionModule';
import { HistoryModule } from './modules/HistoryModule';
import { CalculatorModule } from './modules/CalculatorModule';
import { checkHealth } from './api/predictions';
import { cn } from './utils/cn';
import { AnalyticsModule } from './modules/AnalyticsModule';

const tabs = [
  {
    id: 'prediction',
    label: 'ML-Прогноз',
    icon: <Activity className="h-4 w-4" />,
  },

  {
    id: 'calculator',
    label: 'Калькуляторы',
    icon: <Calculator className="h-4 w-4" />,
    
  },
    {
    id: 'history',
    label: 'Архив',
    icon: <History className="h-4 w-4" />,
  },
  {
    id: 'analytics',
    label: 'Аналитика',
    icon: <BarChart2 className="h-4 w-4" />,
    component: <AnalyticsModule />,
}
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('prediction');
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Check API health on mount
  React.useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const isHealthy = await checkHealth();
        setApiStatus(isHealthy ? 'online' : 'offline');
      } catch {
        setApiStatus('offline');
      }
    };
    
    checkApiStatus();
    // Check every 30 seconds
    const interval = setInterval(checkApiStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <ToastProvider />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  Risk Predictor
                </h1>
                <p className="text-xs text-slate-500">
                  Система прогнозирования рисков
                </p>
              </div>
            </div>

            {/* API Status */}
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
                apiStatus === 'online' && 'bg-green-100 text-green-700',
                apiStatus === 'offline' && 'bg-red-100 text-red-700',
                apiStatus === 'checking' && 'bg-slate-100 text-slate-600'
              )}>
                {apiStatus === 'online' && (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    API Online
                  </>
                )}
                {apiStatus === 'offline' && (
                  <>
                    <XCircle className="h-4 w-4" />
                    API Offline
                  </>
                )}
                {apiStatus === 'checking' && (
                  <>
                    <Server className="h-4 w-4 animate-pulse" />
                    Проверка...
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'prediction' && <PredictionModule />}
        {activeTab === 'history' && <HistoryModule />}
        {activeTab === 'calculator' && <CalculatorModule />}
        {activeTab === 'analytics' && <AnalyticsModule />} 
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
            <p>
              © {new Date().getFullYear()} Risk Predictor — Система прогнозирования сердечно-сосудистых рисков
            </p>
            <p className="text-xs">
              Версия 2.0.0 • Для медицинского использования
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
