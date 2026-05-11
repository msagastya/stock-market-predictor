/**
 * Paper Trading Engine
 *
 * Runs 3 simultaneous risk profiles on the same signals.
 * Every trade is fake — no real orders placed.
 * All charges calculated accurately so the P&L reflects reality.
 */

import { WATCHLIST, WatchStock, Sector } from './watchlist';
export { WATCHLIST } from './watchlist';
export type { WatchStock, Sector } from './watchlist';
import { detectHunt, findSwingLevels, calculateATR, getMarketPhase, Candle } from './hunt-detector';
import { calculateCharges, isTradeWorthTaking } from './charge-calculator';

// ── Risk profiles ──────────────────────────────────────────────────────────────

export interface RiskProfile {
    id: 'conservative' | 'moderate' | 'aggressive';
    capital: number;          // capital allocated per trade
    stopPercent: number;      // stop loss % from entry
    targetMultiple: number;   // risk:reward (2 = 1:2)
    maxTradesPerDay: number;
    holdForDelivery: boolean; // can hold overnight if signal strong
}

export const RISK_PROFILES: RiskProfile[] = [
    { id: 'conservative', capital: 25000, stopPercent: 0.5,  targetMultiple: 2, maxTradesPerDay: 2, holdForDelivery: false },
    { id: 'moderate',     capital: 40000, stopPercent: 0.8,  targetMultiple: 2.5, maxTradesPerDay: 3, holdForDelivery: true  },
    { id: 'aggressive',   capital: 60000, stopPercent: 1.2,  targetMultiple: 3,   maxTradesPerDay: 4, holdForDelivery: true  },
];

// ── Paper trade record ─────────────────────────────────────────────────────────

export type TradeStatus = 'open' | 'hit_target' | 'hit_stop' | 'manual_exit' | 'eod_exit' | 'avoided_charges';
export type TradeDirection = 'long' | 'short';

export interface PaperTrade {
    id: string;
    date: string;              // YYYY-MM-DD
    symbol: string;
    sector: Sector;
    riskProfile: RiskProfile['id'];
    direction: TradeDirection;
    entryPrice: number;
    entryTime: string;         // IST HH:MM
    stopPrice: number;
    targetPrice: number;
    quantity: number;
    exitPrice: number | null;
    exitTime: string | null;
    exitReason: TradeStatus;
    grossPnL: number | null;
    charges: number | null;
    netPnL: number | null;
    netPnLPercent: number | null;
    holdType: 'intraday' | 'delivery';
    huntSignal: string;        // reason from hunt detector
    confidence: string;
    patternObservation: string; // what to learn from this trade
}

// ── Sector scan result ─────────────────────────────────────────────────────────

export interface SectorStrength {
    sector: Sector;
    avgGapPercent: number;     // how much sector gapped from yesterday
    leadingStocks: string[];
    laggingStocks: string[];
    trend: 'bullish' | 'bearish' | 'neutral';
    huntSuspected: boolean;    // sector being pushed before real move
}

// ── Session snapshot ───────────────────────────────────────────────────────────

export interface SessionSnapshot {
    date: string;
    phase: string;
    time: string;
    sectorStrengths: SectorStrength[];
    signalsDetected: number;
    tradesEntered: PaperTrade[];
    openPositions: PaperTrade[];
    exitedPositions: PaperTrade[];
    dailySummary: DailySummary | null;
}

export interface DailySummary {
    date: string;
    totalTrades: number;
    winners: number;
    losers: number;
    avoided: number;           // trades skipped because charges > target
    grossPnL: number;
    totalCharges: number;
    netPnL: number;
    winRate: number;
    bestTrade: PaperTrade | null;
    worstTrade: PaperTrade | null;
    bestSector: Sector | null;
    bestTimeOfDay: string | null;
    patternsSeen: string[];
    recommendations: string[]; // what to do tomorrow
}

// ── Candle fetcher (Yahoo Finance) ────────────────────────────────────────────

export async function fetchCandles(symbol: string, interval: '5m' | '15m' | '1d' = '15m', days = 5): Promise<Candle[]> {
    try {
        const range = interval === '1d' ? '60d' : `${days}d`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) return [];

        const timestamps = result.timestamp || [];
        const q = result.indicators?.quote?.[0] || {};
        const candles: Candle[] = [];

        for (let i = 0; i < timestamps.length; i++) {
            if (!q.open?.[i] || !q.close?.[i]) continue;
            candles.push({
                time:   timestamps[i] * 1000,
                open:   q.open[i],
                high:   q.high[i],
                low:    q.low[i],
                close:  q.close[i],
                volume: q.volume?.[i] || 0,
            });
        }
        return candles;
    } catch {
        return [];
    }
}

// ── Position sizing ────────────────────────────────────────────────────────────

function calcQuantity(capital: number, price: number, stopPercent: number): number {
    // Risk amount = capital × stopPercent%
    // Quantity = riskAmount / (price × stopPercent%)
    const riskAmount = capital * (stopPercent / 100);
    const riskPerShare = price * (stopPercent / 100);
    return Math.max(1, Math.floor(riskAmount / riskPerShare));
}

// ── Core analysis for one stock ────────────────────────────────────────────────

export async function analyzeStock(stock: WatchStock, profile: RiskProfile, now: Date): Promise<PaperTrade | null> {
    const candles = await fetchCandles(stock.symbol, '15m', 5);
    if (candles.length < 10) return null;

    const levels  = findSwingLevels(candles, 3);
    const atr     = calculateATR(candles);
    const hunt    = detectHunt(candles, levels);
    const last    = candles[candles.length - 1];
    const phase   = getMarketPhase(now);

    // Only enter during entry or trend window
    if (phase.phase !== 'entry_window' && phase.phase !== 'trend_window') return null;

    // Only enter on high/medium confidence signals
    if (!hunt.detected || hunt.confidence === 'low') return null;
    if (hunt.recommendation === 'wait' || hunt.recommendation === 'avoid') return null;

    const direction: TradeDirection = hunt.type === 'long_hunt' ? 'long' : 'short';
    const entryPrice = last.close;
    const stopPrice  = hunt.structuralStop || (direction === 'long'
        ? entryPrice * (1 - profile.stopPercent / 100)
        : entryPrice * (1 + profile.stopPercent / 100));

    const actualStopPercent = Math.abs(entryPrice - stopPrice) / entryPrice * 100;
    const targetPercent     = actualStopPercent * profile.targetMultiple;
    const targetPrice       = direction === 'long'
        ? entryPrice * (1 + targetPercent / 100)
        : entryPrice * (1 - targetPercent / 100);

    const quantity = calcQuantity(profile.capital, entryPrice, actualStopPercent);

    // Check if trade is worth taking after charges
    const worthCheck = isTradeWorthTaking({
        entryPrice,
        targetPercent,
        quantity,
        type: 'intraday',
    });

    if (!worthCheck.worth) {
        // Log as avoided — this is data too
        return buildTrade({
            stock, profile, direction, entryPrice, stopPrice, targetPrice,
            quantity, now, hunt, exitReason: 'avoided_charges',
            patternObservation: `Skipped: ${worthCheck.reason}`,
            holdType: 'intraday',
        });
    }

    return buildTrade({
        stock, profile, direction, entryPrice, stopPrice, targetPrice,
        quantity, now, hunt, exitReason: 'open',
        patternObservation: '',
        holdType: 'intraday',
    });
}

function buildTrade(p: {
    stock: WatchStock; profile: RiskProfile; direction: TradeDirection;
    entryPrice: number; stopPrice: number; targetPrice: number;
    quantity: number; now: Date; hunt: any; exitReason: TradeStatus;
    patternObservation: string; holdType: 'intraday' | 'delivery';
}): PaperTrade {
    const ist = new Date(p.now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const timeStr = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}`;
    const dateStr = ist.toISOString().split('T')[0];

    return {
        id: `${p.stock.nseSymbol}-${p.profile.id}-${Date.now()}`,
        date: dateStr,
        symbol: p.stock.nseSymbol,
        sector: p.stock.sector,
        riskProfile: p.profile.id,
        direction: p.direction,
        entryPrice: p.entryPrice,
        entryTime: timeStr,
        stopPrice: p.stopPrice,
        targetPrice: p.targetPrice,
        quantity: p.quantity,
        exitPrice: p.exitReason === 'avoided_charges' ? null : null,
        exitTime: null,
        exitReason: p.exitReason,
        grossPnL: null,
        charges: null,
        netPnL: null,
        netPnLPercent: null,
        holdType: p.holdType,
        huntSignal: p.hunt.reason,
        confidence: p.hunt.confidence,
        patternObservation: p.patternObservation,
    };
}

/** Simulate exit for open paper trades based on current price */
export function simulateExit(trade: PaperTrade, currentCandles: Candle[], now: Date, isEOD = false): PaperTrade {
    if (trade.exitReason !== 'open') return trade;

    const last = currentCandles[currentCandles.length - 1];
    const phase = getMarketPhase(now);
    let exitPrice: number | null = null;
    let exitReason: TradeStatus = 'open';

    if (trade.direction === 'long') {
        if (last.low <= trade.stopPrice) {
            exitPrice  = trade.stopPrice;
            exitReason = 'hit_stop';
        } else if (last.high >= trade.targetPrice) {
            exitPrice  = trade.targetPrice;
            exitReason = 'hit_target';
        }
    } else {
        if (last.high >= trade.stopPrice) {
            exitPrice  = trade.stopPrice;
            exitReason = 'hit_stop';
        } else if (last.low <= trade.targetPrice) {
            exitPrice  = trade.targetPrice;
            exitReason = 'hit_target';
        }
    }

    // EOD exit for intraday
    if (!exitPrice && (isEOD || phase.phase === 'exit_window') && trade.holdType === 'intraday') {
        exitPrice  = last.close;
        exitReason = 'eod_exit';
    }

    if (!exitPrice) return trade; // still open

    const buyP  = trade.direction === 'long' ? trade.entryPrice : exitPrice;
    const sellP = trade.direction === 'long' ? exitPrice : trade.entryPrice;
    const c     = calculateCharges({ buyPrice: buyP, sellPrice: sellP, quantity: trade.quantity, type: trade.holdType });

    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const timeStr = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}`;

    const observation = exitReason === 'hit_target'
        ? `✓ Target hit at ${timeStr}. ${trade.huntSignal}`
        : exitReason === 'hit_stop'
        ? `✗ Stop hit at ${timeStr}. Review: was hunt real or continuation?`
        : `→ EOD exit. Net ${c.effectivePnLPercent > 0 ? '+' : ''}${c.effectivePnLPercent}%`;

    return {
        ...trade,
        exitPrice,
        exitTime: timeStr,
        exitReason,
        grossPnL:       c.netPnL + c.total, // gross before charges
        charges:        c.total,
        netPnL:         c.netPnL,
        netPnLPercent:  c.effectivePnLPercent,
        patternObservation: observation,
    };
}

/** Build daily summary from all trades on a date */
export function buildDailySummary(trades: PaperTrade[], date: string): DailySummary {
    const closed = trades.filter(t => t.exitReason !== 'open' && t.exitReason !== 'avoided_charges' && t.netPnL !== null);
    const avoided = trades.filter(t => t.exitReason === 'avoided_charges');
    const winners = closed.filter(t => (t.netPnL ?? 0) > 0);
    const losers  = closed.filter(t => (t.netPnL ?? 0) <= 0);

    const totalCharges = closed.reduce((s, t) => s + (t.charges ?? 0), 0);
    const grossPnL     = closed.reduce((s, t) => s + ((t.grossPnL ?? 0)), 0);
    const netPnL       = closed.reduce((s, t) => s + (t.netPnL ?? 0), 0);

    // Best sector by net P&L
    const sectorPnL: Record<string, number> = {};
    for (const t of closed) {
        sectorPnL[t.sector] = (sectorPnL[t.sector] || 0) + (t.netPnL ?? 0);
    }
    const bestSector = (Object.entries(sectorPnL).sort((a, b) => b[1] - a[1])[0]?.[0] as Sector) || null;

    // Best time of day
    const timePnL: Record<string, number> = {};
    for (const t of closed) {
        const hour = t.entryTime?.split(':')[0] || 'unknown';
        timePnL[hour] = (timePnL[hour] || 0) + (t.netPnL ?? 0);
    }
    const bestTimeOfDay = Object.entries(timePnL).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const patterns = Array.from(new Set(closed.map(t => t.patternObservation).filter(Boolean)));

    const recommendations: string[] = [];
    if (winners.length > losers.length) recommendations.push('Strategy working — same setup tomorrow');
    if (totalCharges > Math.abs(netPnL) * 0.3) recommendations.push('Charges eating >30% — raise minimum target');
    if (bestSector) recommendations.push(`${bestSector} sector strongest today — watch tomorrow open`);
    if (bestTimeOfDay) recommendations.push(`Best entries at ${bestTimeOfDay}:xx — focus there tomorrow`);
    if (avoided.length > 2) recommendations.push(`${avoided.length} trades skipped for charges — adjust sizing up`);

    return {
        date,
        totalTrades: closed.length,
        winners: winners.length,
        losers: losers.length,
        avoided: avoided.length,
        grossPnL: Math.round(grossPnL * 100) / 100,
        totalCharges: Math.round(totalCharges * 100) / 100,
        netPnL: Math.round(netPnL * 100) / 100,
        winRate: closed.length > 0 ? Math.round((winners.length / closed.length) * 100) : 0,
        bestTrade: winners.sort((a, b) => (b.netPnL ?? 0) - (a.netPnL ?? 0))[0] || null,
        worstTrade: losers.sort((a, b) => (a.netPnL ?? 0) - (b.netPnL ?? 0))[0] || null,
        bestSector,
        bestTimeOfDay: bestTimeOfDay ? `${bestTimeOfDay}:00` : null,
        patternsSeen: patterns,
        recommendations,
    };
}
