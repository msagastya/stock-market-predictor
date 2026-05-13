/**
 * Unified Signal Engine
 *
 * Single source of truth for trade signals — used by BOTH paper trading
 * and live trading. The only difference between paper and live is the
 * broker implementation that receives the signal.
 *
 * Replaces the split logic in paper-engine.ts and autonomous-engine.ts.
 */

import { Candle, detectHunt, findSwingLevels, calculateATR, getMarketPhase } from './hunt-detector';
import { runAllPatterns, PatternSignal } from './pattern-library';
import { calculateCharges, isTradeWorthTaking } from './charge-calculator';
import { fetchCandles, applySlippage } from './kite-candles';
import { WatchStock } from './watchlist';
import { RiskProfile } from './paper-engine';

// ── Signal result ──────────────────────────────────────────────────────────────

export type SignalType = 'hunt' | 'orb' | 'vwap_reclaim' | 'momentum_exhaustion' | 'volume_dry_up' | 'inside_bar' | 'trend_continuation';

export interface TradeSignal {
    symbol:          string;
    nseSymbol:       string;
    direction:       'long' | 'short';
    entryPrice:      number;          // with slippage applied
    rawEntryPrice:   number;          // before slippage
    stopPrice:       number;
    targetPrice:     number;
    quantity:        number;
    stopPercent:     number;
    targetPercent:   number;
    riskReward:      number;
    signalType:      SignalType;
    signalDetail:    string;
    confidence:      'high' | 'medium' | 'low';
    worthTaking:     boolean;
    skipReason:      string;
    candles15m:      Candle[];
    candles5m:       Candle[];
    // Context logged for monthly analysis
    vixLevel:        number;
    niftyTrend:      'up' | 'down' | 'sideways';
    timeOfDay:       string;          // HH:MM IST
    marketPhase:     string;
}

// ── Nifty trend helper ─────────────────────────────────────────────────────────

async function getNiftyTrend(): Promise<'up' | 'down' | 'sideways'> {
    try {
        const candles = await fetchCandles('^NSEI', 'NIFTY 50', '15m', 2);
        if (candles.length < 5) return 'sideways';
        const atr = calculateATR(candles);
        const last = candles[candles.length - 1];
        const prev5 = candles[Math.max(0, candles.length - 5)];
        const move = last.close - prev5.close;
        if (move > atr * 0.8)  return 'up';
        if (move < -atr * 0.8) return 'down';
        return 'sideways';
    } catch {
        return 'sideways';
    }
}

// ── Core signal analysis ───────────────────────────────────────────────────────

export async function analyzeSignal(
    stock: WatchStock,
    profile: RiskProfile,
    now: Date,
    niftyTrend?: 'up' | 'down' | 'sideways',
): Promise<TradeSignal | null> {
    const phase = getMarketPhase(now);

    // Only enter during entry or trend window
    if (phase.phase !== 'entry_window' && phase.phase !== 'trend_window') return null;

    // Don't trade first 5 minutes (9:15–9:20) — pure noise
    if (phase.istHour === 9 && phase.istMinute < 20) return null;

    // Fetch both 15m and 5m candles (Kite first, Yahoo fallback)
    const [candles15m, candles5m] = await Promise.all([
        fetchCandles(stock.symbol, stock.nseSymbol, '15m', 5),
        fetchCandles(stock.symbol, stock.nseSymbol, '5m',  2),
    ]);

    if (candles15m.length < 10) return null;

    const levels  = findSwingLevels(candles15m, 3);
    const atr     = calculateATR(candles15m);
    const hunt    = detectHunt(candles15m, levels);
    const patterns = runAllPatterns(candles15m);
    const last    = candles15m[candles15m.length - 1];

    // Resolve trend if not passed in
    const trend = niftyTrend || await getNiftyTrend();

    // ── Pick the best signal ──────────────────────────────────────────────────

    let signalType: SignalType | null = null;
    let direction: 'long' | 'short' | null = null;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let signalDetail = '';
    let stopPrice = 0;
    let targetPrice = 0;

    // Gap play — highest priority on big gap days
    // If stock gapped >1.5% at open, trade the gap direction (continuation) or fade it (reversal)
    const firstCandle  = candles15m[candles15m.length - (phase.istHour === 9 ? 1 : Math.min(candles15m.length - 1, 4))];
    const prevDayClose = candles15m[candles15m.length - 5]?.close || last.close;
    const gapPct       = (last.open - prevDayClose) / prevDayClose * 100;
    const candleBody   = Math.abs(last.close - last.open) / last.open * 100;
    const candleRange  = (last.high - last.low) / last.open * 100;

    if (Math.abs(gapPct) >= 1.5) {
        // First 30 min: trade gap direction (continuation)
        if (phase.istHour === 9 && phase.istMinute <= 45) {
            direction    = gapPct < 0 ? 'short' : 'long';
            signalType   = 'trend_continuation';
            signalDetail = `Gap ${gapPct > 0 ? 'up' : 'down'} ${Math.abs(gapPct).toFixed(1)}% — riding gap direction`;
            confidence   = Math.abs(gapPct) >= 2.5 ? 'high' : 'medium';
            stopPrice    = direction === 'long'
                ? last.low * 0.998
                : last.high * 1.002;
        }
        // After 30 min: fade the gap if candle shows reversal (small body, long wick back toward prev close)
        else if (candleRange >= 1.0 && candleBody < candleRange * 0.4) {
            direction    = gapPct < 0 ? 'long' : 'short'; // fade direction
            signalType   = 'momentum_exhaustion';
            signalDetail = `Gap fade — ${Math.abs(gapPct).toFixed(1)}% gap showing exhaustion, reverting`;
            confidence   = 'medium';
            stopPrice    = direction === 'long'
                ? last.low * 0.998
                : last.high * 1.002;
        }
    }

    // Hunt signal
    if (!signalType && hunt.detected) {
        direction    = hunt.type === 'long_hunt' ? 'long' : 'short';
        confidence   = hunt.confidence as 'high' | 'medium' | 'low';
        signalType   = 'hunt';
        signalDetail = hunt.reason;
        stopPrice    = hunt.structuralStop || (direction === 'long'
            ? last.close * (1 - profile.stopPercent / 100)
            : last.close * (1 + profile.stopPercent / 100));
    }

    // Pattern signals
    if (!signalType && patterns.length > 0) {
        const best = patterns[0];
        if (best.strength >= 2 && best.direction !== 'neutral') {
            direction    = best.direction as 'long' | 'short';
            signalType   = best.type as SignalType;
            signalDetail = best.description;
            confidence   = best.strength >= 4 ? 'high' : best.strength === 3 ? 'medium' : 'low';
            stopPrice    = best.stopZone.price || last.close * (1 - profile.stopPercent / 100);
            targetPrice  = best.targetZone.price;
        }
    }

    // Momentum fallback — 1.5% move over last 5 candles
    if (!signalType && candles15m.length >= 5) {
        const prev5 = candles15m[candles15m.length - 5];
        const move  = (last.close - prev5.close) / prev5.close * 100;
        if (Math.abs(move) >= 1.5) {
            direction    = move > 0 ? 'long' : 'short';
            signalType   = 'trend_continuation';
            signalDetail = `${move > 0 ? 'Bullish' : 'Bearish'} momentum ${Math.abs(move).toFixed(2)}% over 5 candles`;
            confidence   = Math.abs(move) >= 2.5 ? 'high' : 'medium';
            stopPrice    = direction === 'long'
                ? last.close * (1 - profile.stopPercent / 100)
                : last.close * (1 + profile.stopPercent / 100);
        }
    }

    if (!signalType || !direction) return null;

    // Trend filter — don't fight Nifty unless high confidence
    if (trend === 'up'   && direction === 'short' && confidence !== 'high') return null;
    if (trend === 'down' && direction === 'long'  && confidence !== 'high') return null;

    // ── Price levels ──────────────────────────────────────────────────────────
    const rawEntryPrice = last.close;
    const entryPrice    = applySlippage(rawEntryPrice, direction === 'long' ? 'buy' : 'sell');

    const actualStopPct = Math.abs(entryPrice - stopPrice) / entryPrice * 100;

    if (!targetPrice) {
        const targetPct = actualStopPct * profile.targetMultiple;
        targetPrice = direction === 'long'
            ? entryPrice * (1 + targetPct / 100)
            : entryPrice * (1 - targetPct / 100);
    }

    const targetPct = Math.abs(entryPrice - targetPrice) / entryPrice * 100;
    const riskReward = targetPct / (actualStopPct || 1);

    // Minimum RR of 1.5
    if (riskReward < 1.5) return null;

    // ── Position sizing ───────────────────────────────────────────────────────
    const riskAmt = profile.capital * (profile.stopPercent / 100);
    const riskPerShare = entryPrice * (actualStopPct / 100);
    const quantity = Math.max(1, Math.floor(riskAmt / riskPerShare));

    // ── Worth taking after charges? ───────────────────────────────────────────
    const worthCheck = isTradeWorthTaking({ entryPrice, targetPercent: targetPct, quantity, type: 'intraday' });

    // ── Time string ───────────────────────────────────────────────────────────
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const timeStr = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}`;

    return {
        symbol:        stock.symbol,
        nseSymbol:     stock.nseSymbol,
        direction,
        entryPrice,
        rawEntryPrice,
        stopPrice,
        targetPrice,
        quantity,
        stopPercent:   actualStopPct,
        targetPercent: targetPct,
        riskReward,
        signalType,
        signalDetail,
        confidence,
        worthTaking:   worthCheck.worth,
        skipReason:    worthCheck.worth ? '' : (worthCheck.reason || ''),
        candles15m,
        candles5m,
        vixLevel:      0, // populated by caller if available
        niftyTrend:    trend,
        timeOfDay:     timeStr,
        marketPhase:   phase.phase,
    };
}

// ── Exit simulation with slippage ─────────────────────────────────────────────

export interface ExitResult {
    exitPrice:    number;
    exitReason:   'hit_target' | 'hit_stop' | 'eod_exit' | 'open';
    grossPnL:     number;
    charges:      number;
    netPnL:       number;
    netPnLPct:    number;
    observation:  string;
}

export function simulateExitFromCandle(
    trade: { entryPrice: number; stopPrice: number; targetPrice: number; direction: 'long' | 'short'; quantity: number; holdType: 'intraday' | 'delivery'; entryTime: string },
    candle: Candle,
    now: Date,
    isEOD = false,
): ExitResult | null {
    const phase = getMarketPhase(now);
    let exitPrice: number | null = null;
    let exitReason: ExitResult['exitReason'] = 'open';

    if (trade.direction === 'long') {
        if (candle.low  <= trade.stopPrice)   { exitPrice = trade.stopPrice;  exitReason = 'hit_stop'; }
        else if (candle.high >= trade.targetPrice) { exitPrice = trade.targetPrice; exitReason = 'hit_target'; }
    } else {
        if (candle.high >= trade.stopPrice)   { exitPrice = trade.stopPrice;  exitReason = 'hit_stop'; }
        else if (candle.low  <= trade.targetPrice) { exitPrice = trade.targetPrice; exitReason = 'hit_target'; }
    }

    if (!exitPrice && (isEOD || phase.phase === 'exit_window') && trade.holdType === 'intraday') {
        exitPrice = candle.close;
        exitReason = 'eod_exit';
    }

    if (!exitPrice || exitReason === 'open') return null;

    // Apply slippage to exit
    exitPrice = applySlippage(exitPrice, trade.direction === 'long' ? 'sell' : 'buy');

    const buyP  = trade.direction === 'long' ? trade.entryPrice : exitPrice;
    const sellP = trade.direction === 'long' ? exitPrice : trade.entryPrice;
    const c     = calculateCharges({ buyPrice: buyP, sellPrice: sellP, quantity: trade.quantity, type: trade.holdType });

    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const t = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}`;

    const observation =
        exitReason === 'hit_target' ? `✓ Target hit at ${t}.` :
        exitReason === 'hit_stop'   ? `✗ Stop hit at ${t}. Review: was hunt real?` :
        `→ EOD exit at ${t}. Net ${c.effectivePnLPercent > 0 ? '+' : ''}${c.effectivePnLPercent}%`;

    return {
        exitPrice,
        exitReason,
        grossPnL: c.netPnL + c.total,
        charges:  c.total,
        netPnL:   c.netPnL,
        netPnLPct: c.effectivePnLPercent,
        observation,
    };
}
