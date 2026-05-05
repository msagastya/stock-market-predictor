'use client';

import { formatCurrency, formatNumber } from '@/lib/utils/format';

interface FundamentalsProps {
    marketCap: number;
    peRatio: number;
    eps: number;
    beta: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    avgVolume: number;
    currentPrice: number;
    dividendYield?: number;
    profitMargin?: number;
    debtToEquity?: number;
    roe?: number;
    currency: string; // 'USD' or 'INR'
}

export default function Fundamentals({
    marketCap,
    peRatio,
    eps,
    beta,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    avgVolume,
    currentPrice,
    dividendYield = 0,
    profitMargin = 0,
    debtToEquity = 0,
    roe = 0,
    currency
}: FundamentalsProps) {
    const currencySymbol = currency === 'INR' ? '₹' : '$';
    const fiftyTwoWeekPosition = ((currentPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;

    // Intelligent interpretations
    const getPERating = (pe: number) => {
        if (pe <= 0) return { text: 'N/A', color: 'text-gray-600', desc: 'No earnings' };
        if (pe < 15) return { text: 'Undervalued', color: 'text-green-600', desc: 'Low P/E' };
        if (pe < 25) return { text: 'Fair Value', color: 'text-yellow-600', desc: 'Moderate P/E' };
        return { text: 'Overvalued', color: 'text-red-600', desc: 'High P/E' };
    };

    const getBetaRating = (b: number) => {
        if (b <= 0) return { text: 'N/A', color: 'text-gray-600' };
        if (b < 0.8) return { text: 'Low Volatility', color: 'text-green-600' };
        if (b < 1.2) return { text: 'Market Average', color: 'text-yellow-600' };
        return { text: 'High Volatility', color: 'text-red-600' };
    };

    const peRating = getPERating(peRatio);
    const betaRating = getBetaRating(beta);

    return (
        <div className="glass card animate-fadeIn">
            <div className="card-header flex justify-between items-center">
                <div>
                    <h3 className="card-title">📊 Key Metrics & Fundamentals</h3>
                    <p className="card-description">All values in {currency === 'INR' ? 'Indian Rupees (₹)' : 'US Dollars ($)'}</p>
                </div>
                <div className="flex gap-2">
                    {profitMargin > 20 && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold">High Profit</span>}
                    {debtToEquity < 0.5 && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">Low Debt</span>}
                    {roe > 20 && <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-bold">High ROE</span>}
                </div>
            </div>
            <div className="card-content">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard label="Market Cap" value={formatCurrency(marketCap, currencySymbol)} sub="Company Size" color="blue" />
                    <MetricCard label="P/E Ratio" value={peRatio > 0 ? peRatio.toFixed(2) : 'N/A'} sub={peRating.text} color={peRating.color.replace('text-', '') as any} />
                    <MetricCard label="EPS (TTM)" value={`${currencySymbol}${eps > 0 ? eps.toFixed(2) : 'N/A'}`} sub="Earnings/Share" color="green" />
                    <MetricCard label="Beta" value={beta > 0 ? beta.toFixed(2) : 'N/A'} sub={betaRating.text} color={betaRating.color.replace('text-', '') as any} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 52-Week Range Visualization */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">52-Week Low</span>
                            <span className="font-bold">{currencySymbol}{fiftyTwoWeekLow.toFixed(2)}</span>
                        </div>
                        <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 w-full opacity-30"></div>
                            {/* Current Price Marker */}
                            <div
                                className="absolute top-0 h-full w-1 bg-blue-600 dark:bg-blue-400 shadow-lg transform -translate-x-1/2"
                                style={{ left: `${Math.min(100, Math.max(0, fiftyTwoWeekPosition))}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">52-Week High</span>
                            <span className="font-bold">{currencySymbol}{fiftyTwoWeekHigh.toFixed(2)}</span>
                        </div>
                        <div className="text-center mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                            Current: {currencySymbol}{currentPrice.toFixed(2)}
                        </div>
                    </div>

                    {/* Additional Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <MiniMetric label="Div Yield" value={dividendYield > 0 ? dividendYield.toFixed(2) + '%' : '-'} />
                        <MiniMetric label="Profit Margin" value={profitMargin > 0 ? profitMargin.toFixed(1) + '%' : '-'} />
                        <MiniMetric label="Debt/Equity" value={debtToEquity >= 0 ? debtToEquity.toFixed(2) : '-'} />
                        <MiniMetric label="ROE" value={roe > 0 ? roe.toFixed(1) + '%' : '-'} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, sub, color = 'gray' }: { label: string, value: string, sub: string, color?: string }) {
    const colorClasses: any = {
        blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
        green: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
        red: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
        yellow: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
        gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
    };

    // Handle tailwind color names passed directly
    let finalColorClass = colorClasses[color] || colorClasses.gray;
    if (color.includes('green')) finalColorClass = colorClasses.green;
    if (color.includes('red')) finalColorClass = colorClasses.red;
    if (color.includes('yellow')) finalColorClass = colorClasses.yellow;

    return (
        <div className={`p-4 rounded-lg ${finalColorClass}`}>
            <div className="text-xs opacity-70 mb-1">{label}</div>
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs mt-1 opacity-80">{sub}</div>
        </div>
    );
}

function MiniMetric({ label, value }: { label: string, value: string }) {
    return (
        <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-semibold">{value}</div>
        </div>
    );
}
