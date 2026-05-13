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
import { getMarketPhase, Candle } from './hunt-detector';
import { calculateCharges } from './charge-calculator';
import { fetchCandles as fetchKiteCandles, applySlippage } from './kite-candles';
import { analyzeSignal } from './signal-engine';

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
    { id: 'conservative', capital: 25000, stopPercent: 1.0,  targetMultiple: 2,   maxTradesPerDay: 3, holdForDelivery: false },
    { id: 'moderate',     capital: 40000, stopPercent: 1.5,  targetMultiple: 2.5, maxTradesPerDay: 4, holdForDelivery: true  },
    { id: 'aggressive',   capital: 60000, stopPercent: 2.0,  targetMultiple: 3,   maxTradesPerDay: 5, holdForDelivery: true  },
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

// ── Candle fetcher — Kite first, Yahoo fallback ───────────────────────────────
export async function fetchCandles(symbol: string, interval: '5m' | '15m' | '1d' = '15m', days = 5): Promise<Candle[]> {
    // Derive NSE symbol from Yahoo symbol for Kite lookup
    const nseSymbol = symbol.replace(/\.(NS|BO)$/, '').replace('^', '');
    return fetchKiteCandles(symbol, nseSymbol, interval, days);
}

// ── Core analysis — delegates to unified signal engine ────────────────────────
export async function analyzeStock(stock: WatchStock, profile: RiskProfile, now: Date): Promise<PaperTrade | null> {
    const signal = await analyzeSignal(stock, profile, now);
    if (!signal) return null;

    const hunt = { reason: signal.signalDetail, confidence: signal.confidence };

    if (!signal.worthTaking) {
        return buildTrade({
            stock, profile,
            direction: signal.direction,
            entryPrice: signal.entryPrice,
            stopPrice: signal.stopPrice,
            targetPrice: signal.targetPrice,
            quantity: signal.quantity,
            now, hunt,
            exitReason: 'avoided_charges',
            patternObservation: `Skipped: ${signal.skipReason}`,
            holdType: 'intraday',
            signalType: signal.signalType,
        });
    }

    return buildTrade({
        stock, profile,
        direction: signal.direction,
        entryPrice: signal.entryPrice,
        stopPrice: signal.stopPrice,
        targetPrice: signal.targetPrice,
        quantity: signal.quantity,
        now, hunt,
        exitReason: 'open',
        patternObservation: '',
        holdType: 'intraday',
        signalType: signal.signalType,
    });
}

function buildTrade(p: {
    stock: WatchStock; profile: RiskProfile; direction: TradeDirection;
    entryPrice: number; stopPrice: number; targetPrice: number;
    quantity: number; now: Date; hunt: any; exitReason: TradeStatus;
    patternObservation: string; holdType: 'intraday' | 'delivery';
    signalType?: string;
}): PaperTrade {
    const ist = new Date(p.now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const timeStr = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}`;
    const dateStr = ist.toISOString().split('T')[0];

    return {
        id: `${p.stock.nseSymbol}-${p.profile.id}-${Date.now()}`,
        date: dateStr,
        symbol: p.stock.nseSymbol,
        sector: p.stock.category,
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

    // Apply slippage to exit fill
    exitPrice = applySlippage(exitPrice, trade.direction === 'long' ? 'sell' : 'buy');

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
