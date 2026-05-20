import React from 'react';
import { Toaster, toast as hotToast } from 'react-hot-toast';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

export const ToastProvider: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#1e293b',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          maxWidth: '400px',
        },
      }}
    />
  );
};

export const toast = {
  success: (message: string) => {
    hotToast.custom((t) => (
      <div
        className={`flex items-center gap-3 bg-white border border-green-200 rounded-xl p-4 shadow-lg ${
          t.visible ? 'animate-enter' : 'animate-leave'
        }`}
      >
        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    ));
  },
  
  error: (message: string) => {
    hotToast.custom((t) => (
      <div
        className={`flex items-center gap-3 bg-white border border-red-200 rounded-xl p-4 shadow-lg ${
          t.visible ? 'animate-enter' : 'animate-leave'
        }`}
      >
        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    ));
  },
  
  warning: (message: string) => {
    hotToast.custom((t) => (
      <div
        className={`flex items-center gap-3 bg-white border border-yellow-200 rounded-xl p-4 shadow-lg ${
          t.visible ? 'animate-enter' : 'animate-leave'
        }`}
      >
        <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    ));
  },
  
  info: (message: string) => {
    hotToast.custom((t) => (
      <div
        className={`flex items-center gap-3 bg-white border border-blue-200 rounded-xl p-4 shadow-lg ${
          t.visible ? 'animate-enter' : 'animate-leave'
        }`}
      >
        <Info className="h-5 w-5 text-blue-500 shrink-0" />
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    ));
  },
};
