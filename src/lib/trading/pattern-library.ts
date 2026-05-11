/**
 * Pattern Library
 *
 * Beyond stop hunts — every meaningful intraday pattern
 * a portfolio manager watches for.
 */

import { Candle, calculateATR } from './hunt-detector';

export type PatternType =
    | 'stop_hunt_long'          // wick below support, recover — buy
    | 'stop_hunt_short'         // wick above resistance, reject — sell
    | 'opening_range_breakout'  // break of first 15-min range
    | 'first_candle_reversal'   // strong first candle reversal
    | 'trend_continuation'      // pullback in strong trend
    | 'vwap_reclaim'            // price falls below VWAP, reclaims it
    | 'volume_dry_up'           // volume shrinking = consolidation before move
    | 'momentum_exhaustion'     // big candle + volume spike = trend ending
    | 'inside_bar_breakout'     // tight consolidation breaks
    | 'sector_rotation_entry';  // lagging sector starts catching up

export interface PatternSignal {
    type: PatternType;
    detected: boolean;
    direction: 'long' | 'short' | 'neutral';
    strength: 1 | 2 | 3 | 4 | 5;  // 5 = strongest
    entryZone: { low: number; high: number };
    stopZone:  { price: number; reason: string };
    targetZone:{ price: number; riskReward: number };
    description: string;
    timeframe: '5m' | '15m' | '1h';
    validUntil: string; // IST time after which signal expires
}

// ── VWAP Calculator ───────────────────────────────────────────────────────────

export function calculateVWAP(candles: Candle[]): number[] {
    let cumTPV = 0; // cumulative typical price × volume
    let cumVol = 0;
    return candles.map(c => {
        const tp = (c.high + c.low + c.close) / 3;
        cumTPV += tp * c.volume;
        cumVol += c.volume;
        return cumVol > 0 ? cumTPV / cumVol : tp;
    });
}

// ── RSI Calculator ────────────────────────────────────────────────────────────

export function calculateRSI(candles: Candle[], period = 14): number {
    if (candles.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// ── Average Volume ────────────────────────────────────────────────────────────

function avgVolume(candles: Candle[], period = 20): number {
    const slice = candles.slice(-period);
    return slice.reduce((s, c) => s + c.volume, 0) / slice.length;
}

// ── Opening Range Breakout ────────────────────────────────────────────────────

export function detectORB(candles: Candle[]): PatternSignal | null {
    // First 15-min candle (or first 2 × 5-min candles) defines the range
    if (candles.length < 3) return null;

    const orbHigh = candles[0].high;
    const orbLow  = candles[0].low;
    const last    = candles[candles.length - 1];
    const atr     = calculateATR(candles);

    if (last.close > orbHigh * 1.001) {
        return {
            type: 'opening_range_breakout',
            detected: true, direction: 'long', strength: 3,
            entryZone: { low: orbHigh, high: orbHigh * 1.003 },
            stopZone:  { price: orbLow, reason: 'Below opening range low' },
            targetZone:{ price: orbHigh + (orbHigh - orbLow) * 2, riskReward: 2 },
            description: `ORB breakout above ${orbHigh.toFixed(2)}. Range was ${(((orbHigh - orbLow) / orbLow) * 100).toFixed(2)}%`,
            timeframe: '15m', validUntil: '12:00',
        };
    }

    if (last.close < orbLow * 0.999) {
        return {
            type: 'opening_range_breakout',
            detected: true, direction: 'short', strength: 3,
            entryZone: { low: orbLow * 0.997, high: orbLow },
            stopZone:  { price: orbHigh, reason: 'Above opening range high' },
            targetZone:{ price: orbLow - (orbHigh - orbLow) * 2, riskReward: 2 },
            description: `ORB breakdown below ${orbLow.toFixed(2)}. Range was ${(((orbHigh - orbLow) / orbLow) * 100).toFixed(2)}%`,
            timeframe: '15m', validUntil: '12:00',
        };
    }

    return null;
}

// ── VWAP Reclaim ──────────────────────────────────────────────────────────────

export function detectVWAPReclaim(candles: Candle[]): PatternSignal | null {
    if (candles.length < 5) return null;
    const vwaps = calculateVWAP(candles);
    const last  = candles[candles.length - 1];
    const prev  = candles[candles.length - 2];
    const lastVWAP = vwaps[vwaps.length - 1];
    const prevVWAP = vwaps[vwaps.length - 2];

    // Was below VWAP, now above = reclaim
    if (prev.close < prevVWAP && last.close > lastVWAP) {
        const atr = calculateATR(candles);
        return {
            type: 'vwap_reclaim',
            detected: true, direction: 'long', strength: 3,
            entryZone: { low: lastVWAP, high: lastVWAP * 1.003 },
            stopZone:  { price: lastVWAP - atr * 0.5, reason: 'Back below VWAP' },
            targetZone:{ price: last.close + atr * 2, riskReward: 2 },
            description: `Price reclaimed VWAP (${lastVWAP.toFixed(2)}) after trading below it`,
            timeframe: '15m', validUntil: '14:30',
        };
    }

    // Was above VWAP, now below = rejection
    if (prev.close > prevVWAP && last.close < lastVWAP) {
        const atr = calculateATR(candles);
        return {
            type: 'vwap_reclaim',
            detected: true, direction: 'short', strength: 3,
            entryZone: { low: lastVWAP * 0.997, high: lastVWAP },
            stopZone:  { price: lastVWAP + atr * 0.5, reason: 'Back above VWAP' },
            targetZone:{ price: last.close - atr * 2, riskReward: 2 },
            description: `Price lost VWAP (${lastVWAP.toFixed(2)}) — bearish VWAP rejection`,
            timeframe: '15m', validUntil: '14:30',
        };
    }

    return null;
}

// ── Momentum Exhaustion ───────────────────────────────────────────────────────

export function detectMomentumExhaustion(candles: Candle[]): PatternSignal | null {
    if (candles.length < 3) return null;
    const last   = candles[candles.length - 1];
    const prev   = candles[candles.length - 2];
    const atr    = calculateATR(candles);
    const avgVol = avgVolume(candles, 20);
    const rsi    = calculateRSI(candles);

    const bigBullCandle  = last.close > last.open && (last.close - last.open) > atr * 1.5;
    const bigBearCandle  = last.close < last.open && (last.open - last.close) > atr * 1.5;
    const volumeSpike    = last.volume > avgVol * 2.5;
    const rsiOverbought  = rsi > 72;
    const rsiOversold    = rsi < 28;

    if (bigBullCandle && volumeSpike && rsiOverbought) {
        return {
            type: 'momentum_exhaustion', detected: true,
            direction: 'short', strength: 4,
            entryZone: { low: last.close - atr * 0.3, high: last.close + atr * 0.2 },
            stopZone:  { price: last.high + atr * 0.3, reason: 'Above exhaustion candle high' },
            targetZone:{ price: last.close - atr * 2, riskReward: 2.5 },
            description: `Climax buy candle: ${((last.close - last.open) / atr).toFixed(1)}× ATR move with ${(last.volume / avgVol).toFixed(1)}× volume. RSI ${rsi.toFixed(0)}. Reversal likely.`,
            timeframe: '15m', validUntil: '15:00',
        };
    }

    if (bigBearCandle && volumeSpike && rsiOversold) {
        return {
            type: 'momentum_exhaustion', detected: true,
            direction: 'long', strength: 4,
            entryZone: { low: last.close - atr * 0.2, high: last.close + atr * 0.3 },
            stopZone:  { price: last.low - atr * 0.3, reason: 'Below exhaustion candle low' },
            targetZone:{ price: last.close + atr * 2, riskReward: 2.5 },
            description: `Climax sell candle: ${((last.open - last.close) / atr).toFixed(1)}× ATR drop with ${(last.volume / avgVol).toFixed(1)}× volume. RSI ${rsi.toFixed(0)}. Bounce likely.`,
            timeframe: '15m', validUntil: '15:00',
        };
    }

    return null;
}

// ── Volume Dry Up (consolidation before move) ─────────────────────────────────

export function detectVolumeDryUp(candles: Candle[]): PatternSignal | null {
    if (candles.length < 8) return null;
    const last    = candles[candles.length - 1];
    const recent  = candles.slice(-4);
    const avgVol  = avgVolume(candles, 20);
    const atr     = calculateATR(candles);

    const lastAvgVol  = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
    const rangeShrink = recent.every(c => (c.high - c.low) < atr * 0.6);
    const lowVolume   = lastAvgVol < avgVol * 0.5;

    if (rangeShrink && lowVolume) {
        // Determine direction from recent trend
        const recentClose = candles.slice(-10, -4);
        const trendUp = recentClose[recentClose.length - 1]?.close > recentClose[0]?.close;

        return {
            type: 'volume_dry_up', detected: true,
            direction: trendUp ? 'long' : 'short', strength: 3,
            entryZone: { low: last.low, high: last.high },
            stopZone:  { price: trendUp ? last.low - atr * 0.5 : last.high + atr * 0.5, reason: 'Break of consolidation range' },
            targetZone:{ price: trendUp ? last.close + atr * 2.5 : last.close - atr * 2.5, riskReward: 3 },
            description: `Volume dried up to ${(lastAvgVol / avgVol * 100).toFixed(0)}% of average. Range compressed. Breakout building — wait for volume to return.`,
            timeframe: '15m', validUntil: '15:00',
        };
    }

    return null;
}

// ── Inside Bar Breakout ───────────────────────────────────────────────────────

export function detectInsideBar(candles: Candle[]): PatternSignal | null {
    if (candles.length < 3) return null;
    const last   = candles[candles.length - 1];
    const mother = candles[candles.length - 2];
    const atr    = calculateATR(candles);

    const isInsideBar = last.high <= mother.high && last.low >= mother.low;
    if (!isInsideBar) return null;

    return {
        type: 'inside_bar_breakout', detected: true,
        direction: 'neutral', strength: 3,
        entryZone: { low: mother.low, high: mother.high },
        stopZone:  { price: 0, reason: 'Opposite side of mother bar' },
        targetZone:{ price: 0, riskReward: 2 },
        description: `Inside bar formed. Mother bar: ${mother.low.toFixed(2)}–${mother.high.toFixed(2)}. Breakout above ${mother.high.toFixed(2)} = long. Below ${mother.low.toFixed(2)} = short.`,
        timeframe: '15m', validUntil: '14:00',
    };
}

// ── Trend Continuation (pullback in trend) ────────────────────────────────────

export function detectTrendContinuation(candles: Candle[]): PatternSignal | null {
    if (candles.length < 12) return null;

    const atr    = calculateATR(candles);
    const rsi    = calculateRSI(candles);
    const vwaps  = calculateVWAP(candles);
    const last   = candles[candles.length - 1];
    const lastVWAP = vwaps[vwaps.length - 1];

    // Check if we're in uptrend: 10-candle high > 10-candle low by at least 2x ATR
    const slice10  = candles.slice(-10);
    const tenHigh  = Math.max(...slice10.map(c => c.high));
    const tenLow   = Math.min(...slice10.map(c => c.low));
    const trend    = (tenHigh - tenLow) > atr * 2;

    if (!trend) return null;

    const inUptrend  = slice10[slice10.length - 1].close > slice10[0].close + atr;
    const inDntrend  = slice10[slice10.length - 1].close < slice10[0].close - atr;

    // Pullback = RSI pulled back from high but price above VWAP
    if (inUptrend && rsi > 45 && rsi < 60 && last.close > lastVWAP) {
        return {
            type: 'trend_continuation', detected: true,
            direction: 'long', strength: 4,
            entryZone: { low: lastVWAP, high: last.close + atr * 0.3 },
            stopZone:  { price: lastVWAP - atr * 0.5, reason: 'Loss of VWAP in uptrend' },
            targetZone:{ price: tenHigh + atr, riskReward: 2.5 },
            description: `Uptrend continuation. RSI pulled back to ${rsi.toFixed(0)} (healthy). Price above VWAP. Buy the dip.`,
            timeframe: '15m', validUntil: '14:30',
        };
    }

    if (inDntrend && rsi > 40 && rsi < 55 && last.close < lastVWAP) {
        return {
            type: 'trend_continuation', detected: true,
            direction: 'short', strength: 4,
            entryZone: { low: last.close - atr * 0.3, high: lastVWAP },
            stopZone:  { price: lastVWAP + atr * 0.5, reason: 'Reclaim of VWAP in downtrend' },
            targetZone:{ price: tenLow - atr, riskReward: 2.5 },
            description: `Downtrend continuation. RSI bounced to ${rsi.toFixed(0)} (dead cat). Price below VWAP. Short the rally.`,
            timeframe: '15m', validUntil: '14:30',
        };
    }

    return null;
}

// ── Run all patterns on a candle series ───────────────────────────────────────

export function runAllPatterns(candles: Candle[]): PatternSignal[] {
    const detected: PatternSignal[] = [];
    const checks = [detectORB, detectVWAPReclaim, detectMomentumExhaustion, detectVolumeDryUp, detectInsideBar, detectTrendContinuation];
    for (const check of checks) {
        try {
            const signal = check(candles);
            if (signal?.detected) detected.push(signal);
        } catch { /* skip */ }
    }
    return detected.sort((a, b) => b.strength - a.strength);
}
