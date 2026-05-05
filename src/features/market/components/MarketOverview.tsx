'use client';

import { useEffect, useState } from 'react';
import { QuoteSnapshot } from '@/types';
import { formatCurrency, formatPercent } from '@/lib/utils/format';

interface OverviewPayload {
  indiaIndices: QuoteSnapshot[];
  globalIndices: QuoteSnapshot[];
  trendingIndia: QuoteSnapshot[];
  indiaLeaders: QuoteSnapshot[];
  topGainers: QuoteSnapshot[];
}

export function MarketOverview({ onSelectStock }: { onSelectStock: (symbol: string, name: string) => void }) {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!shouldLoad) {
      return;
    }

    let cancelled = false;

    const fetchOverview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/market/overview');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch market overview');
        }

        if (!cancelled) {
          setOverview(data);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch market overview');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchOverview();

    return () => {
      cancelled = true;
    };
  }, [shouldLoad]);

  if (!shouldLoad) {
    return (
      <section className="mb-8">
        <div className="glass rounded-xl p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Market Overview</h3>
              <p className="text-sm text-muted-foreground">
                Load indices, trending symbols, and top movers on demand to avoid upstream rate limits.
              </p>
            </div>
            <button
              onClick={() => setShouldLoad(true)}
              className="btn btn-primary"
            >
              Load Market Overview
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading && !overview) {
    return <div className="mb-8 text-sm text-muted-foreground">Loading market overview...</div>;
  }

  if (error && !overview) {
    return <div className="mb-8 text-sm text-muted-foreground">{error}</div>;
  }

  if (!overview) {
    return null;
  }

  return (
    <section className="mb-8 space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewStrip
          title="India Indices"
          subtitle="Nifty, Bank Nifty, Sensex, and financials"
          items={overview.indiaIndices}
          onSelectStock={onSelectStock}
        />
        <OverviewStrip
          title="Global Indices"
          subtitle="US, Europe, and Asia risk pulse"
          items={overview.globalIndices}
          onSelectStock={onSelectStock}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <OverviewList
          title="Trending In India"
          items={overview.trendingIndia}
          onSelectStock={onSelectStock}
        />
        <OverviewList
          title="Indian Leaders"
          items={overview.indiaLeaders}
          onSelectStock={onSelectStock}
        />
      </div>

      <OverviewList
        title="Top Global Gainers"
        items={overview.topGainers}
        onSelectStock={onSelectStock}
      />
    </section>
  );
}

function OverviewStrip({
  title,
  subtitle,
  items,
  onSelectStock,
}: {
  title: string;
  subtitle: string;
  items: QuoteSnapshot[];
  onSelectStock: (symbol: string, name: string) => void;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.symbol}
            onClick={() => onSelectStock(item.symbol, item.name)}
            className="rounded-xl border border-white/10 bg-black/10 p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{item.symbol}</div>
            <div className="mt-1 text-lg font-semibold">{item.name}</div>
            <div className="mt-3 font-mono text-2xl">
              {formatCurrency(item.price, item.currency === 'INR' ? '₹' : '$')}
            </div>
            <div className={`mt-1 text-sm ${item.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(item.changePercent)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewList({
  title,
  items,
  onSelectStock,
}: {
  title: string;
  items: QuoteSnapshot[];
  onSelectStock: (symbol: string, name: string) => void;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{items.length} symbols</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.symbol}
            onClick={() => onSelectStock(item.symbol, item.name)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
          >
            <div>
              <div className="font-semibold">{item.symbol}</div>
              <div className="text-sm text-muted-foreground">{item.name}</div>
            </div>
            <div className="text-right">
              <div className="font-mono">
                {formatCurrency(item.price, item.currency === 'INR' ? '₹' : '$')}
              </div>
              <div className={`text-sm ${item.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(item.changePercent)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
