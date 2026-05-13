/**
 * Backtest Engine — 30 days of historical simulation
 *
 * Replays the signal engine against real historical candles for each
 * trading day. Every simulated trade is saved to Firestore exactly like
 * a live trade so the learning layer has real data to work with.
 *
 * POST ?days=30   — run full backtest
 * GET             — fetch backtest summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { WATCHLIST, WatchStock, RISK_PROFILES, PaperTrade } from '@/lib/trading/paper-engine';
import { calculateCharges } from '@/lib/trading/charge-calculator';
import { applySlippage } from '@/lib/trading/kite-candles';
import { Candle, calculateATR, findSwingLevels, detectHunt, getMarketPhase } from '@/lib/trading/hunt-detector';
import { runAllPatterns } from '@/lib/trading/pattern-library';
import { isTradeWorthTaking } from '@/lib/trading/charge-calculator';

export const dynamic   = 'force-dynamic';
export const maxDuration = 300; // 5 min — needs time for 30 days

// ── Firestore ──────────────────────────────────────────────────────────────────

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID || 'stock-market-predictor-ace63'}/databases/(default)/documents`;
const FS_KEY  = process.env.FIREBASE_API_KEY || '';

async function fsSave(collection: string, docId: string, data: Record<string, any>) {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
        if (v === null || v === undefined) fields[k] = { nullValue: null };
        else if (typeof v === 'boolean')   fields[k] = { booleanValue: v };
        else if (typeof v === 'number')    fields[k] = { doubleValue: v };
        else                               fields[k] = { stringValue: String(v) };
    }
    await fetch(`${FS_BASE}/${collection}/${docId}?key=${FS_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    });
}

async function fsGet(collection: string, docId: string) {
    const res = await fetch(`${FS_BASE}/${collection}/${docId}?key=${FS_KEY}`);
    if (!res.ok) return null;
    const doc = await res.json();
    if (!doc.fields) return null;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(doc.fields as Record<string, any>)) {
        out[k] = v.stringValue ?? v.doubleValue ?? v.integerValue ?? v.booleanValue ?? null;
    }
    return out;
}

// ── Yahoo Finance historical candles ───────────────────────────────────────────

async function fetchDailyCandles(symbol: string, days: number): Promise<Candle[]> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days + 10}d&includePrePost=false`;
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
    } catch { return []; }
}

// ── Signal generation from historical candles (no live fetch) ──────────────────

interface BacktestSignal {
    direction: 'long' | 'short';
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    signalDetail: string;
    confidence: 'high' | 'medium' | 'low';
}

function generateSignalFromCandles(
    candles: Candle[],
    profile: { stopPercent: number; targetMultiple: number },
    dayCandles: Candle[], // full day candles for context
): BacktestSignal | null {
    if (candles.length < 10) return null;

    const last     = candles[candles.length - 1];
    const levels   = findSwingLevels(candles, 3);
    const atr      = calculateATR(candles);
    const hunt     = detectHunt(candles, levels);
    const patterns = runAllPatterns(candles);

    let direction: 'long' | 'short' | null = null;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let signalDetail = '';
    let stopPrice  = 0;
    let targetPrice = 0;

    // Gap signal
    const prevClose   = candles[candles.length - 6]?.close || last.open;
    const gapPct      = (last.open - prevClose) / prevClose * 100;
    const candleRange = (last.high - last.low) / last.open * 100;
    const candleBody  = Math.abs(last.close - last.open) / last.open * 100;

    if (Math.abs(gapPct) >= 1.5) {
        direction    = gapPct < 0 ? 'short' : 'long';
        signalDetail = `Gap ${gapPct > 0 ? 'up' : 'down'} ${Math.abs(gapPct).toFixed(1)}%`;
        confidence   = Math.abs(gapPct) >= 2.5 ? 'high' : 'medium';
        stopPrice    = direction === 'long' ? last.low * 0.998 : last.high * 1.002;
    }

    // Hunt
    if (!direction && hunt.detected) {
        direction    = hunt.type === 'long_hunt' ? 'long' : 'short';
        confidence   = hunt.confidence as any;
        signalDetail = hunt.reason;
        stopPrice    = hunt.structuralStop || last.close * (1 - (direction === 'long' ? 1 : -1) * profile.stopPercent / 100);
    }

    // Pattern
    if (!direction && patterns.length > 0 && patterns[0].strength >= 2 && patterns[0].direction !== 'neutral') {
        const best   = patterns[0];
        direction    = best.direction as 'long' | 'short';
        signalDetail = best.description;
        confidence   = best.strength >= 4 ? 'high' : best.strength === 3 ? 'medium' : 'low';
        stopPrice    = best.stopZone.price || last.close * (1 - profile.stopPercent / 100);
        targetPrice  = best.targetZone.price;
    }

    // Momentum fallback
    if (!direction && candles.length >= 5) {
        const prev5 = candles[candles.length - 5];
        const move  = (last.close - prev5.close) / prev5.close * 100;
        if (Math.abs(move) >= 1.5) {
            direction    = move > 0 ? 'long' : 'short';
            signalDetail = `Momentum ${move > 0 ? '+' : ''}${move.toFixed(1)}%`;
            confidence   = Math.abs(move) >= 2.5 ? 'high' : 'medium';
            stopPrice    = direction === 'long'
                ? last.close * (1 - profile.stopPercent / 100)
                : last.close * (1 + profile.stopPercent / 100);
        }
    }

    if (!direction) return null;

    const entryPrice = applySlippage(last.close, direction === 'long' ? 'buy' : 'sell');
    const stopPct    = Math.abs(entryPrice - stopPrice) / entryPrice * 100;
    if (!targetPrice) {
        const tgtPct = stopPct * profile.targetMultiple;
        targetPrice  = direction === 'long'
            ? entryPrice * (1 + tgtPct / 100)
            : entryPrice * (1 - tgtPct / 100);
    }
    const tgtPct  = Math.abs(entryPrice - targetPrice) / entryPrice * 100;
    const rr      = tgtPct / (stopPct || 1);
    if (rr < 1.5) return null;

    return { direction, entryPrice, stopPrice, targetPrice, signalDetail, confidence };
}

// ── Simulate exit against day candles ─────────────────────────────────────────

function simulateExitHistory(
    signal: BacktestSignal,
    quantity: number,
    dayCandles: Candle[], // intraday candles after entry
    holdType: 'intraday' | 'delivery',
): { exitPrice: number; exitReason: string; grossPnL: number; charges: number; netPnL: number; netPnLPercent: number } {
    let exitPrice  = 0;
    let exitReason = 'eod_exit';

    for (const c of dayCandles) {
        if (signal.direction === 'long') {
            if (c.low  <= signal.stopPrice)   { exitPrice = signal.stopPrice;  exitReason = 'hit_stop';   break; }
            if (c.high >= signal.targetPrice) { exitPrice = signal.targetPrice; exitReason = 'hit_target'; break; }
        } else {
            if (c.high >= signal.stopPrice)   { exitPrice = signal.stopPrice;  exitReason = 'hit_stop';   break; }
            if (c.low  <= signal.targetPrice) { exitPrice = signal.targetPrice; exitReason = 'hit_target'; break; }
        }
    }

    if (!exitPrice) exitPrice = dayCandles[dayCandles.length - 1]?.close || signal.entryPrice;
    exitPrice = applySlippage(exitPrice, signal.direction === 'long' ? 'sell' : 'buy');

    const buyP  = signal.direction === 'long' ? signal.entryPrice : exitPrice;
    const sellP = signal.direction === 'long' ? exitPrice : signal.entryPrice;
    const c     = calculateCharges({ buyPrice: buyP, sellPrice: sellP, quantity, type: holdType });

    return {
        exitPrice,
        exitReason,
        grossPnL:      c.netPnL + c.total,
        charges:       c.total,
        netPnL:        c.netPnL,
        netPnLPercent: c.effectivePnLPercent,
    };
}

// ── Trading day calendar ────────────────────────────────────────────────────────

function getTradingDays(numDays: number): string[] {
    const days: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let cursor = new Date(today);
    cursor.setDate(cursor.getDate() - 1); // start from yesterday

    while (days.length < numDays) {
        if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
            days.push(cursor.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
        }
        cursor.setDate(cursor.getDate() - 1);
    }
    return days;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
    return req.headers.get('x-trading-secret') === process.env.TRADING_SECRET;
}

// ── GET — summary ──────────────────────────────────────────────────────────────

export async function GET() {
    const doc = await fsGet('backtest', 'summary');
    if (!doc) return NextResponse.json({ message: 'No backtest run yet. POST to start.' });
    return NextResponse.json(doc);
}

// ── POST — run backtest ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const numDays = Math.min(parseInt(searchParams.get('days') || '30'), 30);

    const tradingDays = getTradingDays(numDays);
    const stocks      = WATCHLIST as WatchStock[];

    // Fetch 60d daily candles for all stocks upfront (batch of 10)
    const allCandles: Record<string, Candle[]> = {};
    const BATCH = 10;
    for (let i = 0; i < stocks.length; i += BATCH) {
        const batch = stocks.slice(i, i + BATCH);
        await Promise.all(batch.map(async (stock) => {
            const candles = await fetchDailyCandles(stock.symbol, 65);
            if (candles.length >= 20) allCandles[stock.nseSymbol] = candles;
        }));
    }

    // Stats
    let totalTrades = 0, totalWins = 0, totalLosses = 0, totalNetPnL = 0;
    const dayResults: Record<string, { trades: number; wins: number; losses: number; netPnL: number }> = {};

    // Simulate each trading day
    for (const date of tradingDays) {
        const dateMs    = new Date(date + 'T00:00:00+05:30').getTime();
        const dayTrades: PaperTrade[] = [];

        for (const stock of stocks) {
            const candles = allCandles[stock.nseSymbol];
            if (!candles || candles.length < 15) continue;

            // Find candle index for this date
            const dayIdx = candles.findIndex(c => {
                const d = new Date(c.time).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                return d === date;
            });
            if (dayIdx < 10) continue;

            // Use candles up to + including this day's open as context
            const contextCandles = candles.slice(dayIdx - 10, dayIdx + 1);
            const dayCandle      = candles[dayIdx];

            for (const profile of RISK_PROFILES) {
                // Max trades per profile per day
                const profileTrades = dayTrades.filter(t => t.riskProfile === profile.id);
                if (profileTrades.length >= profile.maxTradesPerDay) continue;

                // Already traded this stock+profile today
                if (dayTrades.some(t => t.symbol === stock.nseSymbol && t.riskProfile === profile.id)) continue;

                const signal = generateSignalFromCandles(contextCandles, profile, [dayCandle]);
                if (!signal) continue;

                // Position size
                const riskAmt     = profile.capital * (profile.stopPercent / 100);
                const riskPerShare = signal.entryPrice * (Math.abs(signal.entryPrice - signal.stopPrice) / signal.entryPrice);
                const quantity    = Math.max(1, Math.floor(riskAmt / (riskPerShare || 1)));

                // Worth taking after charges?
                const tgtPct  = Math.abs(signal.entryPrice - signal.targetPrice) / signal.entryPrice * 100;
                const worth   = isTradeWorthTaking({ entryPrice: signal.entryPrice, targetPercent: tgtPct, quantity, type: 'intraday' });

                // Simulate exit using the day candle (high/low tells us if stop/target was hit)
                const exit = simulateExitHistory(signal, quantity, [dayCandle], 'intraday');

                const trade: PaperTrade = {
                    id:                `${stock.nseSymbol}-${profile.id}-bt-${date}`,
                    date,
                    symbol:            stock.nseSymbol,
                    sector:            stock.category,
                    riskProfile:       profile.id,
                    direction:         signal.direction,
                    entryPrice:        signal.entryPrice,
                    entryTime:         '09:30',
                    stopPrice:         signal.stopPrice,
                    targetPrice:       signal.targetPrice,
                    quantity,
                    exitPrice:         exit.exitPrice,
                    exitTime:          '15:20',
                    exitReason:        exit.exitReason as any,
                    grossPnL:          exit.grossPnL,
                    charges:           exit.charges,
                    netPnL:            exit.netPnL,
                    netPnLPercent:     exit.netPnLPercent,
                    holdType:          'intraday',
                    huntSignal:        signal.signalDetail,
                    confidence:        signal.confidence,
                    patternObservation: worth.worth ? '' : `Skipped: ${worth.reason}`,
                };

                dayTrades.push(trade);

                // Save to Firestore
                await fsSave('paper_trading', trade.id, trade as any);

                totalTrades++;
                if ((exit.netPnL || 0) > 0) totalWins++;
                else totalLosses++;
                totalNetPnL += exit.netPnL || 0;
            }
        }

        dayResults[date] = {
            trades: dayTrades.length,
            wins:   dayTrades.filter(t => (t.netPnL || 0) > 0).length,
            losses: dayTrades.filter(t => (t.netPnL || 0) <= 0).length,
            netPnL: Math.round(dayTrades.reduce((s, t) => s + (t.netPnL || 0), 0) * 100) / 100,
        };
    }

    // Save summary
    const summary = {
        runAt:       new Date().toISOString(),
        days:        numDays,
        totalTrades,
        totalWins,
        totalLosses,
        winRate:     totalTrades > 0 ? Math.round(totalWins / totalTrades * 100) : 0,
        totalNetPnL: Math.round(totalNetPnL * 100) / 100,
        dayResults:  JSON.stringify(dayResults),
    };
    await fsSave('backtest', 'summary', summary);

    return NextResponse.json({
        success: true,
        days: numDays,
        stocksUsed: Object.keys(allCandles).length,
        totalTrades,
        totalWins,
        totalLosses,
        winRate: summary.winRate,
        totalNetPnL: summary.totalNetPnL,
        dayResults,
    });
}
