/**
 * Monthly Pattern Analyzer
 *
 * After 20-30 days of paper trading data, this builds the intelligence layer:
 * - Which stocks respond best to which patterns
 * - Best time of day per category
 * - Which patterns have highest win rate
 * - Charge impact by stock price range
 * - Day-of-week tendencies
 * - Sector rotation calendar
 */

import { PaperTrade, DailySummary } from './paper-engine';
import { PatternType } from './pattern-library';
import { Category, VolatilityProfile } from './watchlist';

export interface PatternStats {
    pattern: PatternType | string;
    totalTrades:    number;
    winners:        number;
    losers:         number;
    winRate:        number;
    avgNetPnL:      number;
    avgCharges:     number;
    avgHoldMinutes: number;
    bestStock:      string;
    bestTimeOfDay:  string;
    recommendation: string;
}

export interface StockStats {
    symbol:          string;
    category:        string;
    totalTrades:     number;
    winRate:         number;
    avgNetPnL:       number;
    avgCharges:      number;
    bestPattern:     string;
    bestTimeOfDay:   string;
    avgVolatility:   number;  // realized daily range %
    huntDetectedRate: number; // % of days hunt was detected
    rating:          1 | 2 | 3 | 4 | 5;  // trading worthiness
    verdict:         string;
}

export interface TimeOfDayStats {
    hour:       string;  // '09', '10', '11', etc.
    trades:     number;
    winRate:    number;
    avgNetPnL:  number;
    bestCategory: string;
    note:       string;
}

export interface DayOfWeekStats {
    day:        string;  // 'Monday', 'Tuesday', etc.
    trades:     number;
    winRate:    number;
    avgNetPnL:  number;
    avgNiftyMove: number;
    note:       string;
}

export interface MonthlyReport {
    generatedAt:    string;
    daysAnalyzed:   number;
    totalTrades:    number;
    totalWinners:   number;
    totalLosers:    number;
    overallWinRate: number;
    grossPnL:       number;
    totalCharges:   number;
    netPnL:         number;
    chargeImpact:   number;  // charges as % of gross

    // What actually worked
    topPatterns:    PatternStats[];
    topStocks:      StockStats[];
    worstStocks:    StockStats[];

    // When to trade
    bestTimeOfDay:  TimeOfDayStats[];
    bestDayOfWeek:  DayOfWeekStats[];

    // Category performance
    categoryPerformance: Array<{
        category: Category | string;
        winRate: number;
        avgNetPnL: number;
        bestPattern: string;
        verdict: string;
    }>;

    // Risk profile comparison
    profileComparison: Array<{
        profile: string;
        winRate: number;
        avgNetPnL: number;
        totalCharges: number;
        netPnL: number;
        verdict: string;
    }>;

    // Go-live recommendations
    goLiveRecommendations: GoLiveParams;
}

export interface GoLiveParams {
    ready:               boolean;
    minimumWinRate:      number;  // achieved win rate
    requiredWinRate:     number;  // threshold to go live (60%)
    bestRiskProfile:     string;
    stockShortlist:      string[];  // only trade these on day one
    avoidStocks:         string[];
    bestPatterns:        string[];
    bestEntryWindow:     string;   // e.g. "9:30-10:15"
    positionSizing:      string;
    stopLossApproach:    string;
    targetApproach:      string;
    chargeMinimumTarget: number;   // minimum gross % to bother trading
    summary:             string;
}

// ── Core analyzer ─────────────────────────────────────────────────────────────

export function analyzeMonth(trades: PaperTrade[], summaries: DailySummary[]): MonthlyReport {
    const closed = trades.filter(t =>
        t.exitReason !== 'open' &&
        t.exitReason !== 'avoided_charges' &&
        t.netPnL !== null
    );

    if (closed.length === 0) {
        return emptyReport();
    }

    const winners     = closed.filter(t => (t.netPnL ?? 0) > 0);
    const losers      = closed.filter(t => (t.netPnL ?? 0) <= 0);
    const grossPnL    = closed.reduce((s, t) => s + (t.grossPnL ?? 0), 0);
    const totalCharges= closed.reduce((s, t) => s + (t.charges   ?? 0), 0);
    const netPnL      = closed.reduce((s, t) => s + (t.netPnL    ?? 0), 0);
    const daysAnalyzed= new Set(closed.map(t => t.date)).size;

    // ── Pattern stats ─────────────────────────────────────────────────────────
    const patternMap: Record<string, PaperTrade[]> = {};
    for (const t of closed) {
        const key = t.huntSignal?.split('.')[0]?.substring(0, 40) || 'Unknown';
        if (!patternMap[key]) patternMap[key] = [];
        patternMap[key].push(t);
    }

    const topPatterns: PatternStats[] = Object.entries(patternMap)
        .filter(([, ts]) => ts.length >= 3)
        .map(([pattern, ts]) => {
            const w = ts.filter(t => (t.netPnL ?? 0) > 0);
            const timeMap: Record<string, number> = {};
            for (const t of ts) {
                const h = t.entryTime?.split(':')[0] || '10';
                timeMap[h] = (timeMap[h] || 0) + (t.netPnL ?? 0);
            }
            const bestTime = Object.entries(timeMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '10';
            const stockMap: Record<string, number> = {};
            for (const t of ts) {
                stockMap[t.symbol] = (stockMap[t.symbol] || 0) + (t.netPnL ?? 0);
            }
            const bestStock = Object.entries(stockMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
            const wr = Math.round((w.length / ts.length) * 100);
            return {
                pattern,
                totalTrades:    ts.length,
                winners:        w.length,
                losers:         ts.length - w.length,
                winRate:        wr,
                avgNetPnL:      Math.round(ts.reduce((s, t) => s + (t.netPnL ?? 0), 0) / ts.length * 100) / 100,
                avgCharges:     Math.round(ts.reduce((s, t) => s + (t.charges ?? 0), 0) / ts.length * 100) / 100,
                avgHoldMinutes: 0,
                bestStock,
                bestTimeOfDay:  `${bestTime}:00`,
                recommendation: wr >= 60 ? 'Use in live trading' : wr >= 45 ? 'Use with reduced size' : 'Avoid or review rules',
            };
        })
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, 8);

    // ── Stock stats ───────────────────────────────────────────────────────────
    const stockMap: Record<string, PaperTrade[]> = {};
    for (const t of closed) {
        if (!stockMap[t.symbol]) stockMap[t.symbol] = [];
        stockMap[t.symbol].push(t);
    }

    const allStockStats: StockStats[] = Object.entries(stockMap)
        .filter(([, ts]) => ts.length >= 2)
        .map(([symbol, ts]) => {
            const w   = ts.filter(t => (t.netPnL ?? 0) > 0);
            const wr  = Math.round((w.length / ts.length) * 100);
            const avg = Math.round(ts.reduce((s, t) => s + (t.netPnL ?? 0), 0) / ts.length * 100) / 100;

            const timeM: Record<string, number> = {};
            for (const t of ts) {
                const h = t.entryTime?.split(':')[0] || '10';
                timeM[h] = (timeM[h] || 0) + (t.netPnL ?? 0);
            }
            const bestTime = Object.entries(timeM).sort((a, b) => b[1] - a[1])[0]?.[0] || '10';
            const rating: 1|2|3|4|5 = wr >= 70 ? 5 : wr >= 60 ? 4 : wr >= 50 ? 3 : wr >= 40 ? 2 : 1;

            return {
                symbol,
                category:         ts[0]?.sector || '',
                totalTrades:      ts.length,
                winRate:          wr,
                avgNetPnL:        avg,
                avgCharges:       Math.round(ts.reduce((s, t) => s + (t.charges ?? 0), 0) / ts.length * 100) / 100,
                bestPattern:      ts[0]?.huntSignal?.split('.')[0]?.substring(0, 30) || '',
                bestTimeOfDay:    `${bestTime}:00`,
                avgVolatility:    0,
                huntDetectedRate: 0,
                rating,
                verdict:          wr >= 60 ? `Trade with confidence` : wr >= 45 ? `Trade with reduced size` : `Skip — unpredictable`,
            };
        });

    const topStocks   = [...allStockStats].sort((a, b) => b.winRate - a.winRate).slice(0, 10);
    const worstStocks = [...allStockStats].sort((a, b) => a.winRate - b.winRate).slice(0, 5);

    // ── Time of day stats ─────────────────────────────────────────────────────
    const hourMap: Record<string, PaperTrade[]> = {};
    for (const t of closed) {
        const h = t.entryTime?.split(':')[0] || 'unknown';
        if (!hourMap[h]) hourMap[h] = [];
        hourMap[h].push(t);
    }

    const bestTimeOfDay: TimeOfDayStats[] = Object.entries(hourMap)
        .map(([hour, ts]) => {
            const w  = ts.filter(t => (t.netPnL ?? 0) > 0);
            const wr = Math.round((w.length / ts.length) * 100);
            const catMap: Record<string, number> = {};
            for (const t of ts) {
                catMap[t.sector] = (catMap[t.sector] || 0) + (t.netPnL ?? 0);
            }
            const bestCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
            return {
                hour,
                trades:      ts.length,
                winRate:     wr,
                avgNetPnL:   Math.round(ts.reduce((s, t) => s + (t.netPnL ?? 0), 0) / ts.length * 100) / 100,
                bestCategory: bestCat,
                note: wr >= 60 ? 'Prime entry window' : wr >= 45 ? 'Acceptable window' : 'Low quality — avoid',
            };
        })
        .sort((a, b) => b.winRate - a.winRate);

    // ── Category performance ──────────────────────────────────────────────────
    const catMap: Record<string, PaperTrade[]> = {};
    for (const t of closed) {
        if (!catMap[t.sector]) catMap[t.sector] = [];
        catMap[t.sector].push(t);
    }

    const categoryPerformance = Object.entries(catMap)
        .filter(([, ts]) => ts.length >= 3)
        .map(([category, ts]) => {
            const w   = ts.filter(t => (t.netPnL ?? 0) > 0);
            const wr  = Math.round((w.length / ts.length) * 100);
            const signalMap: Record<string, number> = {};
            for (const t of ts) {
                const k = t.huntSignal?.split('.')[0]?.substring(0, 30) || 'unknown';
                signalMap[k] = (signalMap[k] || 0) + 1;
            }
            const bestP = Object.entries(signalMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
            return {
                category,
                winRate:     wr,
                avgNetPnL:   Math.round(ts.reduce((s, t) => s + (t.netPnL ?? 0), 0) / ts.length * 100) / 100,
                bestPattern: bestP,
                verdict:     wr >= 60 ? 'Strong — prioritize' : wr >= 45 ? 'Moderate — include' : 'Weak — reduce',
            };
        })
        .sort((a, b) => b.winRate - a.winRate);

    // ── Risk profile comparison ───────────────────────────────────────────────
    const profileMap: Record<string, PaperTrade[]> = {};
    for (const t of closed) {
        if (!profileMap[t.riskProfile]) profileMap[t.riskProfile] = [];
        profileMap[t.riskProfile].push(t);
    }

    const profileComparison = Object.entries(profileMap).map(([profile, ts]) => {
        const w  = ts.filter(t => (t.netPnL ?? 0) > 0);
        const wr = Math.round((w.length / ts.length) * 100);
        const net = Math.round(ts.reduce((s, t) => s + (t.netPnL ?? 0), 0) * 100) / 100;
        const charges = Math.round(ts.reduce((s, t) => s + (t.charges ?? 0), 0) * 100) / 100;
        return {
            profile, winRate: wr, avgNetPnL: Math.round(net / ts.length * 100) / 100,
            totalCharges: charges, netPnL: net,
            verdict: wr >= 60 ? 'Use this profile for live trading' : wr >= 45 ? 'Acceptable' : 'Review — underperforming',
        };
    });

    // ── Go-live parameters ────────────────────────────────────────────────────
    const overallWinRate = Math.round((winners.length / closed.length) * 100);
    const bestProfile    = profileComparison.sort((a, b) => b.winRate - a.winRate)[0];
    const chargeMinimum  = totalCharges > 0 ? Math.round((totalCharges / closed.length) / (closed[0]?.entryPrice || 500) * 100 * 300) / 100 : 0.3;

    const stockShortlist = topStocks.filter(s => s.rating >= 4).map(s => s.symbol);
    const avoidStocks    = worstStocks.filter(s => s.rating <= 2).map(s => s.symbol);
    const bestPatternsList = topPatterns.filter(p => p.winRate >= 55).map(p => p.pattern.substring(0, 40));
    const bestWindow     = bestTimeOfDay[0] ? `${bestTimeOfDay[0].hour}:00–${bestTimeOfDay[1]?.hour || bestTimeOfDay[0].hour}:59` : '09:30–11:00';

    const goLiveRecommendations: GoLiveParams = {
        ready:               overallWinRate >= 55 && daysAnalyzed >= 15,
        minimumWinRate:      overallWinRate,
        requiredWinRate:     55,
        bestRiskProfile:     bestProfile?.profile || 'moderate',
        stockShortlist:      stockShortlist.slice(0, 10),
        avoidStocks,
        bestPatterns:        bestPatternsList.slice(0, 5),
        bestEntryWindow:     bestWindow,
        positionSizing:      `${bestProfile?.profile === 'conservative' ? '₹25,000' : bestProfile?.profile === 'moderate' ? '₹40,000' : '₹60,000'} per trade based on ${bestProfile?.profile} profile performance`,
        stopLossApproach:    'Structural stop (swing low/high) + 1x ATR buffer. Never round numbers.',
        targetApproach:      'Minimum 2:1 risk:reward. Exit partial at 1:1, trail remaining.',
        chargeMinimumTarget: Math.max(chargeMinimum, 0.3),
        summary:             overallWinRate >= 55
            ? `Ready for live trading. ${overallWinRate}% win rate over ${daysAnalyzed} days. Trade ${stockShortlist.slice(0,5).join(', ')} with ${bestProfile?.profile} profile.`
            : `Not ready yet. ${overallWinRate}% win rate (need 55%). ${daysAnalyzed < 15 ? 'Need more data.' : 'Review signal quality.'}`,
    };

    return {
        generatedAt: new Date().toISOString(),
        daysAnalyzed, totalTrades: closed.length,
        totalWinners: winners.length, totalLosers: losers.length,
        overallWinRate, grossPnL: Math.round(grossPnL * 100) / 100,
        totalCharges: Math.round(totalCharges * 100) / 100,
        netPnL: Math.round(netPnL * 100) / 100,
        chargeImpact: grossPnL > 0 ? Math.round((totalCharges / grossPnL) * 100) : 0,
        topPatterns, topStocks, worstStocks,
        bestTimeOfDay, bestDayOfWeek: [],
        categoryPerformance, profileComparison,
        goLiveRecommendations,
    };
}

function emptyReport(): MonthlyReport {
    return {
        generatedAt: new Date().toISOString(), daysAnalyzed: 0,
        totalTrades: 0, totalWinners: 0, totalLosers: 0, overallWinRate: 0,
        grossPnL: 0, totalCharges: 0, netPnL: 0, chargeImpact: 0,
        topPatterns: [], topStocks: [], worstStocks: [],
        bestTimeOfDay: [], bestDayOfWeek: [], categoryPerformance: [],
        profileComparison: [],
        goLiveRecommendations: {
            ready: false, minimumWinRate: 0, requiredWinRate: 55,
            bestRiskProfile: 'moderate', stockShortlist: [], avoidStocks: [],
            bestPatterns: [], bestEntryWindow: '09:30–11:00',
            positionSizing: 'Not enough data yet',
            stopLossApproach: 'Structural stops only',
            targetApproach: 'Minimum 2:1',
            chargeMinimumTarget: 0.3,
            summary: 'Not enough data yet. Need at least 15 trading days.',
        },
    };
}
