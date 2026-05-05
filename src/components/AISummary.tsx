import React from 'react';
import { CompanyCalendar, CompanyProfile, OHLCV, StockFundamentals } from '@/types';
import { formatLargeNumber } from '@/lib/utils/format';

interface AISummaryProps {
    symbol: string;
    data: OHLCV[];
    fundamentals: StockFundamentals | null;
    profile: CompanyProfile | null;
    calendar: CompanyCalendar | null;
}

export const AISummary: React.FC<AISummaryProps> = ({ symbol, data, fundamentals, profile, calendar }) => {
    if (!data || data.length < 14) return null;

    // Simple technical analysis logic
    const closePrices = data.map(d => d.close);
    const currentPrice = closePrices[closePrices.length - 1];
    const prevPrice = closePrices[closePrices.length - 2];

    // Calculate RSI (simplified 14-period)
    const calculateRSI = (prices: number[]) => {
        let gains = 0;
        let losses = 0;
        for (let i = prices.length - 14; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    };

    const rsi = calculateRSI(closePrices);
    const isOverbought = rsi > 70;
    const isOversold = rsi < 30;

    // Trend Analysis (SMA 50 vs SMA 200 simplified)
    const sma20 = closePrices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const isBullish = currentPrice > sma20;

    // Fundamental Analysis
    const pe = fundamentals?.peRatio || 0;
    const isUndervalued = pe > 0 && pe < 15;
    const isOvervalued = pe > 30;

    // Generate Insights
    const insights = [];

    // Technical Insights
    if (isOverbought) insights.push({ type: 'bearish', text: `RSI is ${rsi.toFixed(1)} (Overbought). Potential pullback ahead.` });
    else if (isOversold) insights.push({ type: 'bullish', text: `RSI is ${rsi.toFixed(1)} (Oversold). Potential buying opportunity.` });
    else insights.push({ type: 'neutral', text: `RSI is neutral at ${rsi.toFixed(1)}.` });

    if (isBullish) insights.push({ type: 'bullish', text: `Price is above 20-day SMA. Short-term trend is Bullish.` });
    else insights.push({ type: 'bearish', text: `Price is below 20-day SMA. Short-term trend is Bearish.` });

    // Fundamental Insights
    if (fundamentals) {
        if (isUndervalued) insights.push({ type: 'bullish', text: `P/E Ratio of ${pe.toFixed(1)} suggests the stock is undervalued.` });
        else if (isOvervalued) insights.push({ type: 'bearish', text: `P/E Ratio of ${pe.toFixed(1)} suggests the stock is expensive.` });
        else insights.push({ type: 'neutral', text: `Valuation is fair with a P/E of ${pe.toFixed(1)}.` });

        if (fundamentals.roe > 15) insights.push({ type: 'bullish', text: `Strong ROE of ${fundamentals.roe.toFixed(1)}% indicates efficient management.` });
    }

    const bullishCount = insights.filter(i => i.type === 'bullish').length;
    const bearishCount = insights.filter(i => i.type === 'bearish').length;
    let sentiment = 'Neutral';
    let sentimentColor = 'text-yellow-400';

    if (bullishCount > bearishCount) {
        sentiment = 'Bullish';
        sentimentColor = 'text-green-400';
    } else if (bearishCount > bullishCount) {
        sentiment = 'Bearish';
        sentimentColor = 'text-red-400';
    }

    const nearestEarningsDate = calendar?.earningsDates?.[0]
        ? new Date(calendar.earningsDates[0]).toLocaleDateString()
        : null;

    const businessSummary = profile?.longBusinessSummary
        ? `${profile.longBusinessSummary.slice(0, 240)}${profile.longBusinessSummary.length > 240 ? '...' : ''}`
        : null;

    return (
        <>
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h3 className="text-3xl font-bold text-white">Research Summary</h3>
                    <p className="mt-2 text-sm text-gray-500">Structured view for {symbol}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-base font-bold bg-opacity-10 border ${sentimentColor.replace('text', 'bg')} ${sentimentColor.replace('text', 'border')} ${sentimentColor}`}>
                    {sentiment}
                </span>
            </div>

            {profile ? (
                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <StatCard label="Sector" value={profile.sector || 'N/A'} />
                    <StatCard label="Industry" value={profile.industry || 'N/A'} />
                    <StatCard label="Employees" value={profile.fullTimeEmployees ? formatLargeNumber(profile.fullTimeEmployees) : 'N/A'} />
                </div>
            ) : null}

            {businessSummary ? (
                <div className="mb-8 rounded-xl border border-gray-800 bg-gray-950/50 p-5">
                    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">Business</h4>
                    <p className="text-sm leading-relaxed text-gray-300">{businessSummary}</p>
                </div>
            ) : null}

            <ul className="space-y-6">
                {insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-4">
                        <span className={`mt-2 w-3 h-3 rounded-full flex-shrink-0 ${insight.type === 'bullish' ? 'bg-green-500' :
                                insight.type === 'bearish' ? 'bg-red-500' : 'bg-gray-500'
                            }`} />
                        <span className="text-gray-300 text-lg leading-relaxed">
                            {insight.text}
                        </span>
                    </li>
                ))}
            </ul>

            {(nearestEarningsDate || calendar?.exDividendDate || profile?.website) ? (
                <div className="mt-10 grid grid-cols-1 gap-4 border-t border-gray-800 pt-8 md:grid-cols-3">
                    <StatCard label="Next Earnings" value={nearestEarningsDate || 'N/A'} />
                    <StatCard
                        label="Ex-Dividend"
                        value={calendar?.exDividendDate ? new Date(calendar.exDividendDate).toLocaleDateString() : 'N/A'}
                    />
                    <StatCard label="Website" value={profile?.website || 'N/A'} />
                </div>
            ) : null}

            <div className="mt-10 pt-8 border-t border-gray-800">
                <p className="text-sm text-gray-500 text-center leading-relaxed">
                    Summary blends market action with company context. Not financial advice.
                </p>
            </div>
        </>
    );
};

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
            <p className="mb-1 text-xs uppercase tracking-wider text-gray-500">{label}</p>
            <p className="break-words text-sm font-medium text-gray-200">{value}</p>
        </div>
    );
}
