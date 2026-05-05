// Advanced technical indicators beyond basic SMA/EMA/RSI
import { OHLCV } from '@/types';

/**
 * Double Exponential Moving Average (DEMA)
 * More responsive than EMA
 */
export function calculateDEMA(prices: number[], period: number): number {
    if (prices.length < period * 2) return 0;

    const ema1 = calculateEMAArray(prices, period);
    const ema2 = calculateEMAArray(ema1, period);

    return 2 * ema1[ema1.length - 1] - ema2[ema2.length - 1];
}

/**
 * Triple Exponential Moving Average (TEMA)
 * Even more responsive than DEMA
 */
export function calculateTEMA(prices: number[], period: number): number {
    if (prices.length < period * 3) return 0;

    const ema1 = calculateEMAArray(prices, period);
    const ema2 = calculateEMAArray(ema1, period);
    const ema3 = calculateEMAArray(ema2, period);

    const current1 = ema1[ema1.length - 1];
    const current2 = ema2[ema2.length - 1];
    const current3 = ema3[ema3.length - 1];

    return 3 * current1 - 3 * current2 + current3;
}

function calculateEMAArray(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray: number[] = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
        emaArray.push(prices[i] * k + emaArray[i - 1] * (1 - k));
    }

    return emaArray;
}

/**
 * Stochastic Oscillator (%K and %D)
 */
export function calculateStochastic(ohlcv: OHLCV[], period: number = 14): { k: number; d: number } {
    if (ohlcv.length < period) return { k: 50, d: 50 };

    const slice = ohlcv.slice(-period);
    const currentClose = ohlcv[ohlcv.length - 1].close;

    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));

    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // Calculate %D (3-period SMA of %K) - simplified
    const d = k; // In full implementation, would average last 3 %K values

    return { k, d };
}

/**
 * Average Directional Index (ADX)
 * Measures trend strength
 */
export function calculateADX(ohlcv: OHLCV[], period: number = 14): number {
    if (ohlcv.length < period + 1) return 0;

    let plusDMSum = 0;
    let minusDMSum = 0;
    let trSum = 0;

    for (let i = 1; i < period + 1; i++) {
        const high = ohlcv[i].high;
        const low = ohlcv[i].low;
        const prevHigh = ohlcv[i - 1].high;
        const prevLow = ohlcv[i - 1].low;
        const prevClose = ohlcv[i - 1].close;

        const plusDM = high - prevHigh > 0 ? Math.max(high - prevHigh, 0) : 0;
        const minusDM = prevLow - low > 0 ? Math.max(prevLow - low, 0) : 0;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );

        plusDMSum += plusDM;
        minusDMSum += minusDM;
        trSum += tr;
    }

    const plusDI = (plusDMSum / trSum) * 100;
    const minusDI = (minusDMSum / trSum) * 100;

    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

    return dx; // Simplified - full ADX needs smoothing
}

/**
 * Commodity Channel Index (CCI)
 */
export function calculateCCI(ohlcv: OHLCV[], period: number = 20): number {
    if (ohlcv.length < period) return 0;

    const slice = ohlcv.slice(-period);
    const typicalPrices = slice.map(c => (c.high + c.low + c.close) / 3);
    const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

    const currentTP = (ohlcv[ohlcv.length - 1].high + ohlcv[ohlcv.length - 1].low + ohlcv[ohlcv.length - 1].close) / 3;

    return (currentTP - sma) / (0.015 * meanDeviation);
}

/**
 * Williams %R
 */
export function calculateWilliamsR(ohlcv: OHLCV[], period: number = 14): number {
    if (ohlcv.length < period) return -50;

    const slice = ohlcv.slice(-period);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));
    const close = ohlcv[ohlcv.length - 1].close;

    return ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
}

/**
 * On-Balance Volume (OBV)
 */
export function calculateOBV(ohlcv: OHLCV[]): number {
    if (ohlcv.length < 2) return 0;

    let obv = 0;
    for (let i = 1; i < ohlcv.length; i++) {
        if (ohlcv[i].close > ohlcv[i - 1].close) {
            obv += ohlcv[i].volume;
        } else if (ohlcv[i].close < ohlcv[i - 1].close) {
            obv -= ohlcv[i].volume;
        }
    }

    return obv;
}

/**
 * Money Flow Index (MFI)
 * Volume-weighted RSI
 */
export function calculateMFI(ohlcv: OHLCV[], period: number = 14): number {
    if (ohlcv.length < period + 1) return 50;

    const typicalPrices = ohlcv.map(c => (c.high + c.low + c.close) / 3);
    const moneyFlows = ohlcv.map((c, i) => typicalPrices[i] * c.volume);

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = ohlcv.length - period; i < ohlcv.length; i++) {
        if (typicalPrices[i] > typicalPrices[i - 1]) {
            positiveFlow += moneyFlows[i];
        } else {
            negativeFlow += moneyFlows[i];
        }
    }

    const moneyRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyRatio));
}
