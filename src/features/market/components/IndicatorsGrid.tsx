'use client';

import { TechnicalIndicators } from '@/types';
import { formatCurrency } from '@/lib/utils/format';

interface IndicatorsGridProps {
  indicators: TechnicalIndicators | null;
  currentPrice: number;
  currency: string;
}

export function IndicatorsGrid({ indicators, currentPrice, currency }: IndicatorsGridProps) {
  if (!indicators) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="mb-4 text-xl font-bold">Technical Indicators</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-8">
        <IndicatorCard
          label="RSI (14)"
          value={indicators.rsi.toFixed(1)}
          hint={indicators.rsi > 70 ? 'Overbought' : indicators.rsi < 30 ? 'Oversold' : 'Neutral'}
          hintClass={indicators.rsi > 70 ? 'text-red-500' : indicators.rsi < 30 ? 'text-green-500' : ''}
        />
        <IndicatorCard
          label="MACD"
          value={indicators.macd.histogram.toFixed(2)}
          hint={indicators.macd.histogram > 0 ? 'Bullish' : 'Bearish'}
          hintClass={indicators.macd.histogram > 0 ? 'text-green-500' : 'text-red-500'}
        />
        <IndicatorCard
          label="SMA 20"
          value={formatCurrency(indicators.sma20, currency)}
          hint={currentPrice > indicators.sma20 ? 'Above' : 'Below'}
          hintClass={currentPrice > indicators.sma20 ? 'text-green-500' : 'text-red-500'}
        />
        <IndicatorCard
          label="Volume Ratio"
          value={`${indicators.volume.ratio.toFixed(2)}x`}
          hint={indicators.volume.ratio > 1.5 ? 'High Activity' : 'Normal'}
          hintClass={indicators.volume.ratio > 1.5 ? 'text-yellow-500' : ''}
        />
        <IndicatorCard
          label="Bollinger %"
          value={`${(((currentPrice - indicators.bollingerBands.lower) / (indicators.bollingerBands.upper - indicators.bollingerBands.lower)) * 100).toFixed(0)}%`}
        />
        <IndicatorCard
          label="Trend (EMA)"
          value={indicators.ema12 > indicators.ema26 ? 'Bullish' : 'Bearish'}
          valueClass={indicators.ema12 > indicators.ema26 ? 'text-green-500' : 'text-red-500'}
        />
        <IndicatorCard
          label="ADX"
          value={indicators.adx.toFixed(1)}
          hint={indicators.adx >= 25 ? 'Strong Trend' : 'Weak Trend'}
          hintClass={indicators.adx >= 25 ? 'text-blue-400' : ''}
        />
        <IndicatorCard
          label="MFI"
          value={indicators.mfi.toFixed(1)}
          hint={indicators.mfi > 80 ? 'Hot Flow' : indicators.mfi < 20 ? 'Washed Out' : 'Balanced'}
          hintClass={indicators.mfi > 80 ? 'text-red-500' : indicators.mfi < 20 ? 'text-green-500' : ''}
        />
      </div>
    </div>
  );
}

function IndicatorCard({
  label,
  value,
  hint,
  hintClass,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  hintClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${valueClass || ''}`}>{value}</div>
      {hint ? <div className={`mt-1 text-xs ${hintClass || ''}`}>{hint}</div> : null}
    </div>
  );
}
