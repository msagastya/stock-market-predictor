'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AnalysisSidebar } from '@/features/market/components/AnalysisSidebar';
import { AutomatedAnalysisPanel } from '@/features/market/components/AutomatedAnalysisPanel';
import { ChartPanel } from '@/features/market/components/ChartPanel';
import { IndicatorsGrid } from '@/features/market/components/IndicatorsGrid';
import { PatternsSection } from '@/features/market/components/PatternsSection';
import { StockHero } from '@/features/market/components/StockHero';
import { TipsSection } from '@/features/market/components/TipsSection';
import { useMarketDashboard } from '@/features/market/hooks/useMarketDashboard';

export function ResearchWorkspace({
  symbol,
  name,
}: {
  symbol: string;
  name: string;
}) {
  const initialStock = useMemo(() => ({ symbol, name }), [symbol, name]);

  const { state, actions } = useMarketDashboard({
    initialStock,
    autoLoad: true,
  });

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur lg:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-blue-300">Research</div>
            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Symbol Workspace</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              Focused stock research for {name}. Switch timeframes, inspect levels, review company context, and load
              peers or news only when needed.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/watchlist" className="btn btn-secondary">Watchlist</Link>
            <Link href="/portfolio" className="btn btn-secondary">Portfolio</Link>
          </div>
        </div>

        <StockHero
          name={state.selectedStock.name}
          symbol={state.selectedStock.symbol}
          currentPrice={state.currentPrice}
          priceChange={state.priceChange}
          priceChangePercent={state.priceChangePercent}
          currency={state.currency}
          lastUpdated={state.lastUpdated}
        />

        {state.dataWarning ? (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {state.dataWarning}
          </div>
        ) : null}

        {!state.hasLoadedOnce ? (
          <div className="glass mb-8 rounded-xl p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Loading Live Research</h3>
                <p className="text-sm text-muted-foreground">
                  The workspace now loads data automatically. If the upstream feed is blocked, retry manually.
                </p>
              </div>
              <button
                onClick={() => actions.handleSelectStock(state.selectedStock.symbol, state.selectedStock.name)}
                className="btn btn-primary"
              >
                Retry {state.selectedStock.symbol}
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <ChartPanel
            data={state.ohlcvData}
            indicators={state.indicators}
            supportResistance={state.supportResistance}
            isDarkMode={state.isDarkMode}
            chartType={state.chartType}
            overlays={state.overlays}
            showFibonacci={state.showFibonacci}
            timeframe={state.timeframe}
            isLoading={state.isLoading}
            errorMessage={state.errorMessage}
            onTimeframeChange={actions.handleTimeframeChange}
            onChartTypeChange={actions.setChartType}
            onOverlaysChange={actions.setOverlays}
            onToggleFibonacci={() => actions.setShowFibonacci((previousValue) => !previousValue)}
          />

          <AnalysisSidebar
            activeTab={state.activeTab}
            onTabChange={actions.setActiveTab}
            recommendation={state.recommendation}
            automatedAnalysis={state.automatedAnalysis}
            fundamentals={state.fundamentals}
            profile={state.profile}
            calendar={state.calendar}
            currency={state.currency}
            currentPrice={state.currentPrice}
            supportResistance={state.supportResistance}
            volumeInsights={state.volumeInsights}
            selectedSymbol={state.selectedStock.symbol}
            ohlcvData={state.ohlcvData}
            indicators={state.indicators}
          />
        </div>
      </section>

      <IndicatorsGrid
        indicators={state.indicators}
        currentPrice={state.currentPrice}
        currency={state.currency}
      />

      <AutomatedAnalysisPanel analysis={state.automatedAnalysis} />

      <TipsSection tips={state.relevantTips} />
      <PatternsSection recommendation={state.recommendation} />
    </div>
  );
}
