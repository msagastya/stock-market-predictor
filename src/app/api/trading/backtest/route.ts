/**
 * Backtest Engine — up to 3 years of historical simulation
 *
 * Efficient design:
 * - Fetches all candles once per stock (single Yahoo call per stock)
 * - Processes everything in memory — no per-candle API calls
 * - Saves aggregated stats to Firestore, not individual trades
 *   (per-day summary, per-stock performance, per-signal-type stats)
 *
 * POST ?period=6m|1y|3y   — run backtest
 * GET  ?period=6m|1y|3y   — fetch saved results
 */

import { NextRequest, NextResponse } from 'next/server';
import { WATCHLIST, WatchStock, RISK_PROFILES } from '@/lib/trading/paper-engine';
import { calculateCharges, isTradeWorthTaking } from '@/lib/trading/charge-calculator';
import { applySlippage } from '@/lib/trading/kite-candles';
import { Candle, calculateATR, findSwingLevels, detectHunt } from '@/lib/trading/hunt-detector';
import { runAllPatterns } from '@/lib/trading/pattern-library';
import { getDayConditions, conditionLabel } from '@/lib/trading/calendar-conditions';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300;

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

// ── Yahoo Finance ──────────────────────────────────────────────────────────────

async function fetchCandles(symbol: string, range: string): Promise<Candle[]> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}&includePrePost=false`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) return [];
        const timestamps = result.timestamp || [];
        const q = result.indicators?.quote?.[0] || {};
        return timestamps.map((t: number, i: number) => ({
            time:   t * 1000,
            open:   q.open?.[i]   || 0,
            high:   q.high?.[i]   || 0,
            low:    q.low?.[i]    || 0,
            close:  q.close?.[i]  || 0,
            volume: q.volume?.[i] || 0,
        })).filter((c: Candle) => c.open > 0 && c.close > 0);
    } catch { return []; }
}

// ── Signal generation ──────────────────────────────────────────────────────────

type SignalType = 'gap' | 'hunt' | 'pattern' | 'momentum' | 'none';

interface Signal {
    type:       SignalType;
    direction:  'long' | 'short';
    confidence: 'high' | 'medium' | 'low';
    detail:     string;
    entryPrice: number;
    stopPrice:  number;
    targetPrice: number;
}

function generateSignal(
    contextCandles: Candle[], // last 15 daily candles for pattern context
    profile: { stopPercent: number; targetMultiple: number },
): Signal | null {
    if (contextCandles.length < 10) return null;

    const last    = contextCandles[contextCandles.length - 1];
    const prev    = contextCandles[contextCandles.length - 2];
    const levels  = findSwingLevels(contextCandles, 3);
    const hunt    = detectHunt(contextCandles, levels);
    const patterns = runAllPatterns(contextCandles);

    let type:       SignalType = 'none';
    let direction:  'long' | 'short' | null = null;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let detail      = '';
    let stopPrice   = 0;
    let targetPrice = 0;

    // 1. Gap signal — open vs prev close
    const gapPct = prev.close > 0 ? (last.open - prev.close) / prev.close * 100 : 0;
    if (Math.abs(gapPct) >= 1.5) {
        type       = 'gap';
        direction  = gapPct < 0 ? 'short' : 'long';
        detail     = `Gap ${gapPct > 0 ? 'up' : 'down'} ${Math.abs(gapPct).toFixed(1)}%`;
        confidence = Math.abs(gapPct) >= 2.5 ? 'high' : 'medium';
        stopPrice  = direction === 'long' ? last.low * 0.998 : last.high * 1.002;
    }

    // 2. Hunt signal
    if (type === 'none' && hunt.detected && hunt.confidence !== 'low') {
        type       = 'hunt';
        direction  = hunt.type === 'long_hunt' ? 'long' : 'short';
        confidence = hunt.confidence as 'high' | 'medium';
        detail     = hunt.reason;
        stopPrice  = hunt.structuralStop || last.close * (1 - (direction === 'long' ? 1 : -1) * profile.stopPercent / 100);
    }

    // 3. Pattern signal
    if (type === 'none' && patterns.length > 0) {
        const best = patterns[0];
        if (best.strength >= 3 && best.direction !== 'neutral') {
            type       = 'pattern';
            direction  = best.direction as 'long' | 'short';
            detail     = best.description;
            confidence = best.strength >= 4 ? 'high' : 'medium';
            stopPrice  = best.stopZone.price || last.close * (1 - profile.stopPercent / 100);
            targetPrice = best.targetZone.price;
        }
    }

    // 4. Momentum fallback — 5-day move >= 2%
    if (type === 'none' && contextCandles.length >= 6) {
        const prev5 = contextCandles[contextCandles.length - 6];
        const move  = prev5.close > 0 ? (last.close - prev5.close) / prev5.close * 100 : 0;
        if (Math.abs(move) >= 2.0) {
            type       = 'momentum';
            direction  = move > 0 ? 'long' : 'short';
            detail     = `Momentum ${move > 0 ? '+' : ''}${move.toFixed(1)}% over 5 days`;
            confidence = Math.abs(move) >= 3.5 ? 'high' : 'medium';
            stopPrice  = direction === 'long'
                ? last.close * (1 - profile.stopPercent / 100)
                : last.close * (1 + profile.stopPercent / 100);
        }
    }

    if (!direction) return null;

    const entryPrice  = applySlippage(last.close, direction === 'long' ? 'buy' : 'sell');
    const stopPct     = Math.abs(entryPrice - stopPrice) / entryPrice * 100 || profile.stopPercent;

    if (!targetPrice) {
        const tgtPct = stopPct * profile.targetMultiple;
        targetPrice  = direction === 'long'
            ? entryPrice * (1 + tgtPct / 100)
            : entryPrice * (1 - tgtPct / 100);
    }

    const tgtPct = Math.abs(entryPrice - targetPrice) / entryPrice * 100;
    if (tgtPct / stopPct < 1.5) return null;

    return { type, direction, confidence, detail, entryPrice, stopPrice, targetPrice };
}

// ── Exit simulation ────────────────────────────────────────────────────────────

interface ExitResult {
    exitPrice:  number;
    exitReason: 'hit_target' | 'hit_stop' | 'eod_exit';
    netPnL:     number;
    charges:    number;
    pnlPct:     number;
}

function simulateExit(signal: Signal, quantity: number, dayCandle: Candle): ExitResult {
    let exitPrice  = dayCandle.close;
    let exitReason: ExitResult['exitReason'] = 'eod_exit';

    if (signal.direction === 'long') {
        if (dayCandle.low  <= signal.stopPrice)   { exitPrice = signal.stopPrice;  exitReason = 'hit_stop'; }
        if (dayCandle.high >= signal.targetPrice) { exitPrice = signal.targetPrice; exitReason = 'hit_target'; }
    } else {
        if (dayCandle.high >= signal.stopPrice)   { exitPrice = signal.stopPrice;  exitReason = 'hit_stop'; }
        if (dayCandle.low  <= signal.targetPrice) { exitPrice = signal.targetPrice; exitReason = 'hit_target'; }
    }

    exitPrice = applySlippage(exitPrice, signal.direction === 'long' ? 'sell' : 'buy');
    const buyP  = signal.direction === 'long' ? signal.entryPrice : exitPrice;
    const sellP = signal.direction === 'long' ? exitPrice : signal.entryPrice;
    const c     = calculateCharges({ buyPrice: buyP, sellPrice: sellP, quantity, type: 'intraday' });

    return { exitPrice, exitReason, netPnL: c.netPnL, charges: c.total, pnlPct: c.effectivePnLPercent };
}

// ── Trading day helpers ────────────────────────────────────────────────────────

function isWeekday(date: Date): boolean {
    const d = date.getDay();
    return d !== 0 && d !== 6;
}

function dateStr(ts: number): string {
    return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ── Auth ───────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
    return req.headers.get('x-trading-secret') === process.env.TRADING_SECRET;
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const period = new URL(req.url).searchParams.get('period') || '6m';
    const doc    = await fsGet('backtest', `summary_${period}`);
    if (!doc) return NextResponse.json({ message: `No backtest for ${period} yet.` });
    return NextResponse.json({
        ...doc,
        stockStats:  doc.stockStats  ? JSON.parse(doc.stockStats)  : [],
        signalStats: doc.signalStats ? JSON.parse(doc.signalStats) : [],
        monthStats:  doc.monthStats  ? JSON.parse(doc.monthStats)  : [],
        worstDays:   doc.worstDays   ? JSON.parse(doc.worstDays)   : [],
        bestDays:    doc.bestDays    ? JSON.parse(doc.bestDays)     : [],
    });
}

// ── POST — run ─────────────────────────────────────────────────────────────────
// Supports chunked execution for long periods:
//   POST ?period=3y&chunk=1   — months 1-3 (oldest)
//   POST ?period=3y&chunk=2   — months 4-6
//   ...up to chunk=12 for 3y (36 months in groups of 3)
//   POST ?period=3y&chunk=merge — merge all chunks into final summary

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '6m';
    const chunk  = searchParams.get('chunk');  // null | '1'..'12' | 'merge'

    // If chunk=merge, combine all saved chunk docs into a final summary
    if (chunk === 'merge') {
        return mergechunks(period);
    }

    const yahooRange = period === '3y' ? '3y' : period === '1y' ? '1y' : '6mo';

    // ── Step 1: Fetch all candles for all stocks (parallel batches of 8) ──────
    const stocks = WATCHLIST as WatchStock[];
    const allCandles: Record<string, Candle[]> = {};

    const BATCH = 8;
    for (let i = 0; i < stocks.length; i += BATCH) {
        const batch = stocks.slice(i, i + BATCH);
        await Promise.all(batch.map(async (stock) => {
            const candles = await fetchCandles(stock.symbol, yahooRange);
            if (candles.length >= 20) allCandles[stock.nseSymbol] = candles;
        }));
    }

    // ── Step 2: Build trading day list from candle timestamps ─────────────────
    const allDates = new Set<string>();
    for (const candles of Object.values(allCandles)) {
        for (const c of candles) allDates.add(dateStr(c.time));
    }
    let tradingDays = Array.from(allDates).sort();

    // If chunk param provided, slice the day list into groups of ~3 months
    if (chunk && chunk !== 'merge') {
        const chunkIdx  = parseInt(chunk, 10) - 1; // 0-based
        const chunkSize = period === '3y' ? Math.ceil(tradingDays.length / 12)
                        : period === '1y' ? Math.ceil(tradingDays.length / 4)
                        : tradingDays.length; // 6m: no chunking needed
        const start = chunkIdx * chunkSize;
        tradingDays = tradingDays.slice(start, start + chunkSize);
        if (tradingDays.length === 0) {
            return NextResponse.json({ message: `Chunk ${chunk} is empty — all chunks done. Run ?chunk=merge` });
        }
    }

    // ── Step 3: Simulate all trades in memory ─────────────────────────────────

    // Aggregation buckets
    const stockStats:     Record<string, { trades: number; wins: number; losses: number; pnl: number; signals: Record<string, number> }> = {};
    const signalStats:    Record<string, { trades: number; wins: number; losses: number; pnl: number }> = {};
    const monthStats:     Record<string, { trades: number; wins: number; losses: number; pnl: number }> = {};
    const dayStats:       Record<string, { trades: number; wins: number; losses: number; pnl: number }> = {};
    // Condition patterns — the key insight: WHAT CONDITIONS produce wins
    const conditionStats: Record<string, { trades: number; wins: number; losses: number; pnl: number; label: string }> = {};

    function trackCondition(key: string, label: string, isWin: boolean, pnl: number) {
        if (!conditionStats[key]) conditionStats[key] = { trades: 0, wins: 0, losses: 0, pnl: 0, label };
        conditionStats[key].trades++;
        conditionStats[key].pnl += pnl;
        if (isWin) conditionStats[key].wins++; else conditionStats[key].losses++;
    }

    let totalTrades = 0, totalWins = 0, totalLosses = 0, totalPnL = 0;

    for (const date of tradingDays) {
        const dayProfileCounts: Record<string, number> = {};

        // Market-wide context for this day (use first available stock as proxy)
        const anyCandles = Object.values(allCandles)[0] || [];
        const mktIdx = anyCandles.findIndex(c => dateStr(c.time) === date);
        const mktDay = mktIdx >= 1 ? anyCandles[mktIdx] : null;
        const mktPrev = mktIdx >= 1 ? anyCandles[mktIdx - 1] : null;
        const mktGapPct = mktDay && mktPrev ? (mktDay.open - mktPrev.close) / mktPrev.close * 100 : 0;
        const mktDayMove = mktDay ? (mktDay.close - mktDay.open) / mktDay.open * 100 : 0;
        const mktRegime = Math.abs(mktGapPct) >= 1.5
            ? (mktGapPct > 0 ? 'gap_up_day' : 'gap_down_day')
            : Math.abs(mktDayMove) >= 1.0
            ? (mktDayMove > 0 ? 'trending_up' : 'trending_down')
            : 'choppy';

        // Full calendar conditions for this date
        const cal = getDayConditions(date);

        for (const stock of stocks) {
            const candles = allCandles[stock.nseSymbol];
            if (!candles) continue;

            // Find index for this date
            const idx = candles.findIndex(c => dateStr(c.time) === date);
            if (idx < 12) continue;

            const context   = candles.slice(idx - 12, idx);     // 12 candles before = context
            const dayCandle = candles[idx];                      // this day = execution + exit

            for (const profile of RISK_PROFILES) {
                const profileKey = profile.id;
                if ((dayProfileCounts[profileKey] || 0) >= profile.maxTradesPerDay) continue;

                const signal = generateSignal(context, profile);
                if (!signal) continue;

                // Position size
                const riskAmt      = profile.capital * (profile.stopPercent / 100);
                const stopDist     = Math.abs(signal.entryPrice - signal.stopPrice);
                const quantity     = Math.max(1, Math.floor(riskAmt / (stopDist || 1)));

                const exit = simulateExit(signal, quantity, dayCandle);

                // Aggregate
                const month = date.slice(0, 7);
                const isWin = exit.netPnL > 0;

                // ── Track all condition patterns ──────────────────────────────
                // Market regime
                trackCondition(`regime_${mktRegime}`, `Market regime: ${mktRegime}`, isWin, exit.netPnL);
                // Signal × regime (most important: what signal works in what market)
                trackCondition(`${signal.type}_on_${mktRegime}`, `${signal.type} signal on ${mktRegime}`, isWin, exit.netPnL);
                // Direction × regime (short on gap_down? long on trending_up?)
                trackCondition(`${signal.direction}_on_${mktRegime}`, `${signal.direction} on ${mktRegime}`, isWin, exit.netPnL);
                // Signal type alone
                trackCondition(`signal_${signal.type}`, `Signal: ${signal.type}`, isWin, exit.netPnL);
                // Direction alone
                trackCondition(`dir_${signal.direction}`, `Direction: ${signal.direction}`, isWin, exit.netPnL);
                // Confidence
                trackCondition(`conf_${signal.confidence}`, `Confidence: ${signal.confidence}`, isWin, exit.netPnL);

                // Calendar conditions — all tags from the calendar module
                for (const tag of cal.tags) {
                    trackCondition(tag, conditionLabel(tag), isWin, exit.netPnL);
                    // Signal × calendar tag (e.g. "gap signal on weekly_expiry")
                    trackCondition(`${signal.type}_${tag}`, `${signal.type} on ${conditionLabel(tag)}`, isWin, exit.netPnL);
                    // Direction × calendar tag (e.g. "short on pre_festival_Diwali")
                    trackCondition(`${signal.direction}_${tag}`, `${signal.direction} on ${conditionLabel(tag)}`, isWin, exit.netPnL);
                }

                if (!stockStats[stock.nseSymbol]) stockStats[stock.nseSymbol] = { trades: 0, wins: 0, losses: 0, pnl: 0, signals: {} };
                if (!signalStats[signal.type])    signalStats[signal.type]    = { trades: 0, wins: 0, losses: 0, pnl: 0 };
                if (!monthStats[month])           monthStats[month]           = { trades: 0, wins: 0, losses: 0, pnl: 0 };
                if (!dayStats[date])              dayStats[date]              = { trades: 0, wins: 0, losses: 0, pnl: 0 };

                const inc = (obj: any, win: boolean, pnl: number) => {
                    obj.trades++; obj.pnl += pnl;
                    if (win) obj.wins++; else obj.losses++;
                };

                inc(stockStats[stock.nseSymbol], isWin, exit.netPnL);
                inc(signalStats[signal.type],    isWin, exit.netPnL);
                inc(monthStats[month],           isWin, exit.netPnL);
                inc(dayStats[date],              isWin, exit.netPnL);
                stockStats[stock.nseSymbol].signals[signal.type] = (stockStats[stock.nseSymbol].signals[signal.type] || 0) + 1;

                dayProfileCounts[profileKey] = (dayProfileCounts[profileKey] || 0) + 1;
                totalTrades++; totalPnL += exit.netPnL;
                if (isWin) totalWins++; else totalLosses++;
            }
        }
    }

    // ── Step 4: Prepare ranked outputs ───────────────────────────────────────

    const stockList = Object.entries(stockStats).map(([symbol, s]) => ({
        symbol,
        trades:  s.trades,
        wins:    s.wins,
        losses:  s.losses,
        winRate: Math.round(s.wins / s.trades * 100),
        pnl:     Math.round(s.pnl),
        bestSignal: Object.entries(s.signals).sort((a,b) => b[1]-a[1])[0]?.[0] || 'none',
    })).sort((a, b) => b.pnl - a.pnl);

    const signalList = Object.entries(signalStats).map(([type, s]) => ({
        type,
        trades:  s.trades,
        wins:    s.wins,
        losses:  s.losses,
        winRate: Math.round(s.wins / s.trades * 100),
        pnl:     Math.round(s.pnl),
        avgPnl:  Math.round(s.pnl / s.trades),
    })).sort((a, b) => b.pnl - a.pnl);

    const monthList = Object.entries(monthStats).map(([month, s]) => ({
        month,
        trades:  s.trades,
        wins:    s.wins,
        losses:  s.losses,
        winRate: Math.round(s.wins / s.trades * 100),
        pnl:     Math.round(s.pnl),
    })).sort((a, b) => a.month.localeCompare(b.month));

    const sortedDays  = Object.entries(dayStats).sort((a, b) => b[1].pnl - a[1].pnl);
    const bestDays    = sortedDays.slice(0, 10).map(([date, s]) => ({ date, ...s, pnl: Math.round(s.pnl) }));
    const worstDays   = sortedDays.slice(-10).reverse().map(([date, s]) => ({ date, ...s, pnl: Math.round(s.pnl) }));

    // ── Step 5: Save to Firestore ─────────────────────────────────────────────

    const docId = chunk ? `chunk_${period}_${chunk}` : `summary_${period}`;

    // Condition patterns ranked by win rate (min 10 trades)
    const conditionList = Object.entries(conditionStats)
        .filter(([, s]) => s.trades >= 10)
        .map(([key, s]) => ({
            key,
            label:   s.label,
            trades:  s.trades,
            wins:    s.wins,
            losses:  s.losses,
            winRate: Math.round(s.wins / s.trades * 100),
            pnl:     Math.round(s.pnl),
            avgPnl:  Math.round(s.pnl / s.trades),
        }))
        .sort((a, b) => b.winRate - a.winRate);

    const summary = {
        period,
        chunk:          chunk || 'full',
        runAt:          new Date().toISOString(),
        tradingDays:    tradingDays.length,
        stocksUsed:     Object.keys(allCandles).length,
        totalTrades,
        totalWins,
        totalLosses,
        winRate:        totalTrades > 0 ? Math.round(totalWins / totalTrades * 100) : 0,
        totalPnL:       Math.round(totalPnL),
        avgDailyPnL:    tradingDays.length > 0 ? Math.round(totalPnL / tradingDays.length) : 0,
        stockStats:     JSON.stringify(stockList),
        signalStats:    JSON.stringify(signalList),
        monthStats:     JSON.stringify(monthList),
        bestDays:       JSON.stringify(bestDays),
        worstDays:      JSON.stringify(worstDays),
        conditionStats: JSON.stringify(conditionList),
    };

    await fsSave('backtest', docId, summary);

    // If no chunk (full run for 6m), also save as summary
    if (!chunk) {
        await fsSave('backtest', `summary_${period}`, summary);
    }

    return NextResponse.json({
        period,
        chunk:          chunk || 'full',
        tradingDays:    tradingDays.length,
        stocksUsed:     Object.keys(allCandles).length,
        totalTrades,
        totalWins,
        totalLosses,
        winRate:        summary.winRate,
        totalPnL:       summary.totalPnL,
        avgDailyPnL:    summary.avgDailyPnL,
        topStocks:      stockList.slice(0, 10),
        signalStats:    signalList,
        monthStats:     monthList,
        bestDays,
        worstDays,
        topConditions:  conditionList.slice(0, 15),
        worstConditions: conditionList.slice(-10).reverse(),
        message: chunk ? `Chunk ${chunk} saved. Run next chunk or ?chunk=merge when all done.` : 'Full backtest complete.',
    });
}

// ── Merge all chunks into final summary ───────────────────────────────────────

async function mergechunks(period: string): Promise<NextResponse> {
    const maxChunks = period === '3y' ? 12 : period === '1y' ? 4 : 1;
    const chunks: any[] = [];

    for (let i = 1; i <= maxChunks; i++) {
        const doc = await fsGet('backtest', `chunk_${period}_${i}`);
        if (doc) chunks.push(doc);
    }

    if (chunks.length === 0) {
        return NextResponse.json({ error: 'No chunks found. Run chunks first.' }, { status: 400 });
    }

    // Merge stock stats
    const stockMap: Record<string, any> = {};
    const signalMap: Record<string, any> = {};
    const monthMap: Record<string, any> = {};
    const allBest: any[] = [];
    const allWorst: any[] = [];

    let totalTrades = 0, totalWins = 0, totalLosses = 0, totalPnL = 0, totalDays = 0;

    for (const c of chunks) {
        totalTrades  += Number(c.totalTrades)  || 0;
        totalWins    += Number(c.totalWins)    || 0;
        totalLosses  += Number(c.totalLosses)  || 0;
        totalPnL     += Number(c.totalPnL)     || 0;
        totalDays    += Number(c.tradingDays)  || 0;

        const merge = (map: Record<string, any>, list: any[]) => {
            for (const item of list) {
                const key = item.symbol || item.type || item.month;
                if (!map[key]) map[key] = { ...item };
                else {
                    map[key].trades  = (map[key].trades  || 0) + (item.trades  || 0);
                    map[key].wins    = (map[key].wins    || 0) + (item.wins    || 0);
                    map[key].losses  = (map[key].losses  || 0) + (item.losses  || 0);
                    map[key].pnl     = (map[key].pnl     || 0) + (item.pnl     || 0);
                }
            }
        };

        try { merge(stockMap,  JSON.parse(String(c.stockStats  || '[]'))); } catch {}
        try { merge(signalMap, JSON.parse(String(c.signalStats || '[]'))); } catch {}
        try { merge(monthMap,  JSON.parse(String(c.monthStats  || '[]'))); } catch {}
        try { allBest.push(...JSON.parse(String(c.bestDays   || '[]'))); } catch {}
        try { allWorst.push(...JSON.parse(String(c.worstDays  || '[]'))); } catch {}
    }

    const finalize = (map: Record<string, any>) =>
        Object.values(map).map((s: any) => ({
            ...s,
            winRate: s.trades > 0 ? Math.round(s.wins / s.trades * 100) : 0,
            pnl: Math.round(s.pnl),
        }));

    const stockList  = finalize(stockMap).sort((a: any, b: any) => b.pnl - a.pnl);
    const signalList = finalize(signalMap).sort((a: any, b: any) => b.pnl - a.pnl);
    const monthList  = finalize(monthMap).sort((a: any, b: any) => String(a.month).localeCompare(String(b.month)));
    const bestDays   = allBest.sort((a: any, b: any) => b.pnl - a.pnl).slice(0, 10);
    const worstDays  = allWorst.sort((a: any, b: any) => a.pnl - b.pnl).slice(0, 10);

    const merged = {
        period,
        chunk:       'merged',
        runAt:       new Date().toISOString(),
        chunksUsed:  chunks.length,
        tradingDays: totalDays,
        totalTrades,
        totalWins,
        totalLosses,
        winRate:     totalTrades > 0 ? Math.round(totalWins / totalTrades * 100) : 0,
        totalPnL:    Math.round(totalPnL),
        avgDailyPnL: totalDays > 0 ? Math.round(totalPnL / totalDays) : 0,
        stockStats:  JSON.stringify(stockList),
        signalStats: JSON.stringify(signalList),
        monthStats:  JSON.stringify(monthList),
        bestDays:    JSON.stringify(bestDays),
        worstDays:   JSON.stringify(worstDays),
    };

    await fsSave('backtest', `summary_${period}`, merged);

    return NextResponse.json({
        message:     `Merged ${chunks.length} chunks into summary_${period}`,
        period,
        tradingDays: totalDays,
        totalTrades,
        winRate:     merged.winRate,
        totalPnL:    merged.totalPnL,
        topStocks:   stockList.slice(0, 10),
        signalStats: signalList,
        monthStats:  monthList,
    });
}
