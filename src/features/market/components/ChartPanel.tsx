'use client';

import StockChart, { ChartOverlays, ChartType } from '@/components/charts/StockChart';
import { OHLCV, TechnicalIndicators } from '@/types';
import { SupportResistanceLevel } from '@/lib/analysis/support-resistance';

interface ChartPanelProps {
  data: OHLCV[];
  indicators: TechnicalIndicators | null;
  supportResistance: SupportResistanceLevel[];
  isDarkMode: boolean;
  chartType: ChartType;
  overlays: ChartOverlays;
  showFibonacci: boolean;
  timeframe: string;
  isLoading: boolean;
  errorMessage: string | null;
  onTimeframeChange: (timeframe: string) => void;
  onChartTypeChange: (chartType: ChartType) => void;
  onOverlaysChange: React.Dispatch<React.SetStateAction<ChartOverlays>>;
  onToggleFibonacci: () => void;
}

const TIMEFRAMES = ['1d', '1w', '1m', '3m', '1y', '5y'];

export function ChartPanel({
  data,
  indicators,
  supportResistance,
  isDarkMode,
  chartType,
  overlays,
  showFibonacci,
  timeframe,
  isLoading,
  errorMessage,
  onTimeframeChange,
  onChartTypeChange,
  onOverlaysChange,
  onToggleFibonacci,
}: ChartPanelProps) {
  return (
    <div className="glass min-h-[600px] overflow-hidden rounded-xl p-1 lg:col-span-8">
      <div className="flex flex-col gap-4 border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Price Action</h3>
          <div className="flex gap-2 text-xs">
            <span className="rounded border border-green-500/20 bg-green-500/10 px-2 py-1 text-green-500">Support</span>
            <span className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-500">Resistance</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {TIMEFRAMES.map((item) => (
              <button
                key={item}
                onClick={() => onTimeframeChange(item)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  timeframe === item
                    ? 'bg-white text-blue-600 shadow dark:bg-gray-700 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => onChartTypeChange('candlestick')}
              className={`rounded-md p-1.5 transition-colors ${chartType === 'candlestick' ? 'bg-white text-blue-600 shadow dark:bg-gray-700' : 'text-gray-500'}`}
              title="Candlestick"
            >
              🕯️
            </button>
            <button
              onClick={() => onChartTypeChange('line')}
              className={`rounded-md p-1.5 transition-colors ${chartType === 'line' ? 'bg-white text-blue-600 shadow dark:bg-gray-700' : 'text-gray-500'}`}
              title="Line"
            >
              📈
            </button>
            <button
              onClick={() => onChartTypeChange('area')}
              className={`rounded-md p-1.5 transition-colors ${chartType === 'area' ? 'bg-white text-blue-600 shadow dark:bg-gray-700' : 'text-gray-500'}`}
              title="Area"
            >
              ⛰️
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onOverlaysChange((previousValue) => ({ ...previousValue, sma20: !previousValue.sma20 }))}
              className={`rounded border px-2 py-1 text-xs ${overlays.sma20 ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-gray-200 dark:border-gray-700'}`}
            >
              SMA 20
            </button>
            <button
              onClick={() => onOverlaysChange((previousValue) => ({ ...previousValue, bollingerBands: !previousValue.bollingerBands }))}
              className={`rounded border px-2 py-1 text-xs ${overlays.bollingerBands ? 'border-purple-500 bg-purple-500/10 text-purple-500' : 'border-gray-200 dark:border-gray-700'}`}
            >
              BB
            </button>
            <button
              onClick={onToggleFibonacci}
              className={`rounded border px-2 py-1 text-xs ${showFibonacci ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-gray-200 dark:border-gray-700'}`}
            >
              Fib
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-900">
        {data.length > 0 ? (
          <StockChart
            data={data}
            indicators={indicators}
            supportResistance={supportResistance}
            isDarkMode={isDarkMode}
            chartType={chartType}
            overlays={overlays}
            showFibonacci={showFibonacci}
          />
        ) : (
          <div className="flex h-[500px] items-center justify-center text-muted-foreground">
            {isLoading ? 'Loading chart...' : errorMessage || 'No data available'}
          </div>
        )}
      </div>
    </div>
  );
}
