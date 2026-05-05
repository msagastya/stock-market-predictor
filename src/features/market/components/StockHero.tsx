'use client';

import { formatCurrency, formatPercent, getColorForChange } from '@/lib/utils/format';

interface StockHeroProps {
  name: string;
  symbol: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  currency: string;
  lastUpdated: Date | null;
}

export function StockHero({
  name,
  symbol,
  currentPrice,
  priceChange,
  priceChangePercent,
  currency,
  lastUpdated,
}: StockHeroProps) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-bold">{name}</h2>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-sm text-muted-foreground">{symbol}</span>
          {lastUpdated ? (
            <span className="text-xs text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-3xl font-bold">{formatCurrency(currentPrice, currency)}</div>
        <div className={`text-lg font-medium ${getColorForChange(priceChange)}`}>
          {priceChange > 0 ? '+' : ''}
          {formatCurrency(priceChange, currency)} ({formatPercent(priceChangePercent)})
        </div>
      </div>
    </div>
  );
}
