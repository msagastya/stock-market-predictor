'use client';

import { AISummary } from '@/components/AISummary';
import { StockComparison } from '@/components/StockComparison';
import Fundamentals from '@/components/analysis/Fundamentals';
import NewsFeed from '@/components/news/NewsFeed';
import { AutomatedAnalysis, CompanyCalendar, CompanyProfile, StockFundamentals, Recommendation, TechnicalIndicators, OHLCV } from '@/types';
import { SupportResistanceLevel } from '@/lib/analysis/support-resistance';
import { formatCurrency, getRecommendationColor } from '@/lib/utils/format';

interface AnalysisSidebarProps {
  activeTab: 'analysis' | 'fundamentals' | 'news';
  onTabChange: (tab: 'analysis' | 'fundamentals' | 'news') => void;
  recommendation: Recommendation | null;
  automatedAnalysis: AutomatedAnalysis | null;
  fundamentals: StockFundamentals | null;
  profile: CompanyProfile | null;
  calendar: CompanyCalendar | null;
  currency: string;
  currentPrice: number;
  supportResistance: SupportResistanceLevel[];
  volumeInsights: string[];
  selectedSymbol: string;
  ohlcvData: OHLCV[];
  indicators: TechnicalIndicators | null;
}

export function AnalysisSidebar({
  activeTab,
  onTabChange,
  recommendation,
  automatedAnalysis,
  fundamentals,
  profile,
  calendar,
  currency,
  currentPrice,
  supportResistance,
  volumeInsights,
  selectedSymbol,
  ohlcvData,
  indicators,
}: AnalysisSidebarProps) {
  return (
    <div className="flex flex-col lg:col-span-4">
      <div className="glass flex-1 overflow-hidden rounded-xl">
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <TabButton label="Analysis" active={activeTab === 'analysis'} onClick={() => onTabChange('analysis')} />
          <TabButton label="Fundamentals" active={activeTab === 'fundamentals'} onClick={() => onTabChange('fundamentals')} />
          <TabButton label="News" active={activeTab === 'news'} onClick={() => onTabChange('news')} />
        </div>

        <div className="max-h-[600px] overflow-y-auto p-6">
          {activeTab === 'analysis' ? (
            <div className="animate-fadeIn space-y-6">
              {recommendation ? (
                <div
                  className="rounded-xl border-l-4 bg-gray-50 p-4 dark:bg-gray-800/50"
                  style={{ borderLeftColor: getRecommendationColor(recommendation.rating).includes('green') ? '#22c55e' : '#ef4444' }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">AI Signal</h3>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${getRecommendationColor(recommendation.rating)}`}>
                      {recommendation.rating.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {recommendation.reasoning.map((reason, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <span className="mt-1">•</span>
                        <p>{reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {automatedAnalysis ? (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Automated Bias</h3>
                    <span className="rounded-full border border-blue-400/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-blue-200">
                      {automatedAnalysis.marketRegime}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{automatedAnalysis.strategicSummary}</p>
                </div>
              ) : null}

              <div className="space-y-8">
                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12">
                  <h3 className="mb-12 text-3xl font-bold text-white">Key Metrics</h3>
                  {fundamentals ? (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
                        <MetricBlock label="Market Cap" value={`${currency === 'INR' ? '₹' : '$'}${(fundamentals.marketCap / 1000000000).toFixed(2)}B`} />
                        <MetricBlock label="P/E Ratio" value={fundamentals.peRatio?.toFixed(2) || 'N/A'} />
                      </div>

                      <div className="border-t border-gray-800" />

                      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
                        <MetricBlock label="52-Week High" value={`${currency === 'INR' ? '₹' : '$'}${fundamentals.fiftyTwoWeekHigh?.toLocaleString()}`} accent="text-green-400" />
                        <MetricBlock label="52-Week Low" value={`${currency === 'INR' ? '₹' : '$'}${fundamentals.fiftyTwoWeekLow?.toLocaleString()}`} accent="text-red-400" />
                      </div>

                      <div className="border-t border-gray-800" />

                      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                        <MiniMetricBlock label="EPS" value={fundamentals.eps?.toFixed(2) || 'N/A'} />
                        <MiniMetricBlock label="Beta" value={fundamentals.beta?.toFixed(2) || 'N/A'} />
                        <MiniMetricBlock label="ROE" value={`${fundamentals.roe?.toFixed(1)}%`} />
                        <MiniMetricBlock label="Div Yield" value={`${fundamentals.dividendYield?.toFixed(2)}%`} />
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-lg text-gray-500">No data available</div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12">
                  <AISummary
                    symbol={selectedSymbol}
                    data={ohlcvData}
                    fundamentals={fundamentals}
                    profile={profile}
                    calendar={calendar}
                  />
                </div>

                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12">
                  <StockComparison currentSymbol={selectedSymbol} />
                </div>
              </div>

              <div>
                <h3 className="mb-4 font-semibold">Key Levels</h3>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Support Zones</p>
                    <div className="flex flex-wrap gap-2">
                      {supportResistance
                        .filter((level) => level.type === 'support')
                        .slice(0, 3)
                        .map((level, index) => (
                          <span key={index} className="rounded border border-green-500/20 bg-green-500/10 px-2 py-1 text-xs text-green-500">
                            {formatCurrency(level.price, currency)}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Resistance Zones</p>
                    <div className="flex flex-wrap gap-2">
                      {supportResistance
                        .filter((level) => level.type === 'resistance')
                        .slice(0, 3)
                        .map((level, index) => (
                          <span key={index} className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-500">
                            {formatCurrency(level.price, currency)}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-4 font-semibold">Volume Analysis</h3>
                <ul className="space-y-2">
                  {volumeInsights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              {!recommendation && !fundamentals && ohlcvData.length === 0 ? (
                <EmptyTabState
                  title="Waiting for market data"
                  description="The analysis tab is active. If live data has not arrived yet, the cards above will populate automatically once the symbol feed responds."
                />
              ) : null}
            </div>
          ) : null}

          {activeTab === 'fundamentals' ? (
            fundamentals && indicators ? (
            <div className="animate-fadeIn">
              <Fundamentals
                marketCap={fundamentals.marketCap || 0}
                peRatio={fundamentals.peRatio || 0}
                eps={fundamentals.eps || 0}
                beta={fundamentals.beta || 0}
                fiftyTwoWeekHigh={fundamentals.fiftyTwoWeekHigh || 0}
                fiftyTwoWeekLow={fundamentals.fiftyTwoWeekLow || 0}
                avgVolume={fundamentals.avgVolume || 0}
                currentPrice={currentPrice}
                dividendYield={fundamentals.dividendYield || 0}
                profitMargin={fundamentals.profitMargin || 0}
                debtToEquity={fundamentals.debtToEquity || 0}
                roe={fundamentals.roe || 0}
                currency={currency}
              />
            </div>
            ) : (
            <EmptyTabState
              title="Fundamentals tab is open"
              description="Fundamental data has not loaded for this symbol yet. This can happen while the quote request is still running or when the upstream feed does not provide company fundamentals."
            />
            )
          ) : null}

          {activeTab === 'news' ? (
            <div className="animate-fadeIn">
              <NewsFeed symbol={selectedSymbol} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyTabState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
      <div className="font-semibold text-white">{title}</div>
      <p className="mt-2 leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-medium transition-colors ${
        active
          ? 'border-b-2 border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
          : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

function MetricBlock({ label, value, accent = 'text-white' }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`font-mono text-4xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function MiniMetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="font-mono text-xl text-gray-300">{value}</p>
    </div>
  );
}
