import { Activity, ChevronDown, Check, Cpu } from 'lucide-react';
import * as RadixSelect from '@radix-ui/react-select';
import { cn } from '@/lib/utils';
import type { ModelConfig } from '@/types';

interface HeaderProps {
  config?: ModelConfig;
  selectedVersion: string;
  onVersionChange: (version: string) => void;
  isLoading?: boolean;
}

export function Header({ config, selectedVersion, onVersionChange, isLoading }: HeaderProps) {
  const versionInfo = config?.available_versions ?? [];
  // Try to get framework from somewhere — we'll pass it via config metadata later
  // For now, we show based on version name hints or leave generic

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-sm">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold text-slate-900 tracking-tight">Risk Predictor</span>
              <span className="text-xs text-slate-400">ML - powered Risk Assistment</span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Version selector */}
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-500 hidden sm:block">Модель:</span>
              <RadixSelect.Root
                value={selectedVersion}
                onValueChange={onVersionChange}
                disabled={isLoading || versionInfo.length === 0}
              >
                <RadixSelect.Trigger
                  className={cn(
                    'flex h-8 min-w-[90px] items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700',
                    'hover:bg-white hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <RadixSelect.Value placeholder="Версия" />
                  <RadixSelect.Icon>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </RadixSelect.Icon>
                </RadixSelect.Trigger>
                <RadixSelect.Portal>
                  <RadixSelect.Content
                    className="z-50 min-w-[120px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                    position="popper"
                    sideOffset={4}
                  >
                    <RadixSelect.Viewport className="p-1">
                      {versionInfo.map((v) => (
                        <RadixSelect.Item
                          key={v}
                          value={v}
                          className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 outline-none hover:bg-indigo-50 hover:text-indigo-700 data-[state=checked]:text-indigo-700"
                        >
                          <RadixSelect.ItemText>{v}</RadixSelect.ItemText>
                          <RadixSelect.ItemIndicator>
                            <Check className="h-3.5 w-3.5" />
                          </RadixSelect.ItemIndicator>
                        </RadixSelect.Item>
                      ))}
                    </RadixSelect.Viewport>
                  </RadixSelect.Content>
                </RadixSelect.Portal>
              </RadixSelect.Root>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              )} />
              <span className="hidden sm:block">{isLoading ? 'Загрузка...' : 'Готов'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
