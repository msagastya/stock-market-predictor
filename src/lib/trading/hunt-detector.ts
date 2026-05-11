/**
 * Stop hunt / liquidity sweep detector
 *
 * Hunters push price below a key level to collect stop-loss orders,
 * then reverse. The signature: wick below support + volume spike + fast recovery.
 */

export interface Candle {
    time: number; // unix timestamp
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface SwingLevel {
    price: number;
    type: 'support' | 'resistance';
    strength: number; // 1-5, how many times it's been tested
    lastTestedAt: number;
}

export interface HuntSignal {
    detected: boolean;
    type: 'long_hunt' | 'short_hunt' | null; // long_hunt = stop hunt below support (go long after)
    huntLow: number | null;      // price where hunt happened
    huntHigh: number | null;
    recoveryConfirmed: boolean;
    volumeSpike: boolean;        // volume > 2x average on hunt candle
    recommendation: 'enter_long' | 'enter_short' | 'wait' | 'avoid';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    structuralStop: number | null;  // where to place stop (just beyond hunt extreme)
    atrBuffer: number;
}

export interface MarketPhase {
    phase: 'hunt_window' | 'entry_window' | 'trend_window' | 'exit_window' | 'closed';
    istHour: number;
    istMinute: number;
}

/** Get current market phase based on IST time */
export function getMarketPhase(now: Date = new Date()): MarketPhase {
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const h = ist.getHours();
    const m = ist.getMinutes();
    const mins = h * 60 + m;

    if (mins < 555 || mins >= 930)             return { phase: 'closed',       istHour: h, istMinute: m };
    if (mins >= 555 && mins < 570)             return { phase: 'hunt_window',  istHour: h, istMinute: m }; // 9:15-9:30
    if (mins >= 570 && mins < 615)             return { phase: 'entry_window', istHour: h, istMinute: m }; // 9:30-10:15
    if (mins >= 615 && mins < 885)             return { phase: 'trend_window', istHour: h, istMinute: m }; // 10:15-2:45
    return                                            { phase: 'exit_window',  istHour: h, istMinute: m }; // 2:45-3:30
}

/** Calculate ATR (Average True Range) from candles */
export function calculateATR(candles: Candle[], period = 14): number {
    if (candles.length < 2) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low  - candles[i - 1].close),
        );
        trs.push(tr);
    }
    const relevant = trs.slice(-period);
    return relevant.reduce((a, b) => a + b, 0) / relevant.length;
}

/** Find swing highs and lows from candle series */
export function findSwingLevels(candles: Candle[], lookback = 5): SwingLevel[] {
    const levels: SwingLevel[] = [];
    for (let i = lookback; i < candles.length - lookback; i++) {
        const window = candles.slice(i - lookback, i + lookback + 1);
        const curr = candles[i];

        // Swing low
        if (curr.low === Math.min(...window.map(c => c.low))) {
            const existing = levels.find(l => l.type === 'support' && Math.abs(l.price - curr.low) / curr.low < 0.003);
            if (existing) {
                existing.strength = Math.min(existing.strength + 1, 5);
                existing.lastTestedAt = curr.time;
            } else {
                levels.push({ price: curr.low, type: 'support', strength: 1, lastTestedAt: curr.time });
            }
        }

        // Swing high
        if (curr.high === Math.max(...window.map(c => c.high))) {
            const existing = levels.find(l => l.type === 'resistance' && Math.abs(l.price - curr.high) / curr.high < 0.003);
            if (existing) {
                existing.strength = Math.min(existing.strength + 1, 5);
                existing.lastTestedAt = curr.time;
            } else {
                levels.push({ price: curr.high, type: 'resistance', strength: 1, lastTestedAt: curr.time });
            }
        }
    }
    return levels.sort((a, b) => b.strength - a.strength);
}

/** Average volume of recent candles */
function avgVolume(candles: Candle[], last = 20): number {
    const recent = candles.slice(-last);
    return recent.reduce((s, c) => s + c.volume, 0) / recent.length;
}

/**
 * Core hunt detector — analyzes last N candles for stop hunt signatures
 */
export function detectHunt(candles: Candle[], levels: SwingLevel[]): HuntSignal {
    if (candles.length < 5) {
        return noSignal('Not enough candles');
    }

    const last  = candles[candles.length - 1];
    const prev  = candles[candles.length - 2];
    const atr   = calculateATR(candles);
    const avgVol = avgVolume(candles, 20);

    // ── Long hunt (below support — go long after recovery) ──────────────────
    const nearSupport = levels
        .filter(l => l.type === 'support' && l.strength >= 2)
        .find(l => Math.abs(last.low - l.price) / l.price < 0.006);

    if (nearSupport) {
        const pierced    = last.low < nearSupport.price;                  // wick went below
        const recovered  = last.close > nearSupport.price;                // but closed back above
        const volumeSpike = last.volume > avgVol * 1.8;                   // volume confirming hunt
        const wickRatio   = (last.close - last.low) / (last.high - last.low + 0.001); // long lower wick

        if (pierced && recovered && wickRatio > 0.5) {
            const confidence = (volumeSpike ? 1 : 0) + (nearSupport.strength >= 3 ? 1 : 0) + (wickRatio > 0.7 ? 1 : 0);
            return {
                detected: true,
                type: 'long_hunt',
                huntLow: last.low,
                huntHigh: null,
                recoveryConfirmed: recovered,
                volumeSpike,
                recommendation: confidence >= 2 ? 'enter_long' : 'wait',
                confidence: confidence >= 2 ? 'high' : confidence === 1 ? 'medium' : 'low',
                reason: `Wick swept ${nearSupport.price.toFixed(2)} support (str:${nearSupport.strength}), closed above. Wick ratio ${(wickRatio * 100).toFixed(0)}%${volumeSpike ? ', volume spike' : ''}`,
                structuralStop: last.low - (atr * 0.5),
                atrBuffer: atr,
            };
        }
    }

    // ── Short hunt (above resistance — go short after rejection) ────────────
    const nearResistance = levels
        .filter(l => l.type === 'resistance' && l.strength >= 2)
        .find(l => Math.abs(last.high - l.price) / l.price < 0.006);

    if (nearResistance) {
        const pierced    = last.high > nearResistance.price;
        const recovered  = last.close < nearResistance.price;
        const volumeSpike = last.volume > avgVol * 1.8;
        const wickRatio   = (last.high - last.close) / (last.high - last.low + 0.001);

        if (pierced && recovered && wickRatio > 0.5) {
            const confidence = (volumeSpike ? 1 : 0) + (nearResistance.strength >= 3 ? 1 : 0) + (wickRatio > 0.7 ? 1 : 0);
            return {
                detected: true,
                type: 'short_hunt',
                huntLow: null,
                huntHigh: last.high,
                recoveryConfirmed: recovered,
                volumeSpike,
                recommendation: confidence >= 2 ? 'enter_short' : 'wait',
                confidence: confidence >= 2 ? 'high' : confidence === 1 ? 'medium' : 'low',
                reason: `Wick swept ${nearResistance.price.toFixed(2)} resistance (str:${nearResistance.strength}), rejected. Wick ratio ${(wickRatio * 100).toFixed(0)}%${volumeSpike ? ', volume spike' : ''}`,
                structuralStop: last.high + (atr * 0.5),
                atrBuffer: atr,
            };
        }
    }

    return noSignal('No hunt pattern detected');
}

function noSignal(reason: string): HuntSignal {
    return {
        detected: false, type: null, huntLow: null, huntHigh: null,
        recoveryConfirmed: false, volumeSpike: false,
        recommendation: 'wait', confidence: 'low', reason,
        structuralStop: null, atrBuffer: 0,
    };
}
