// Technical Indicators Calculator
import { OHLCV, TechnicalIndicators } from '@/types';
import { calculateADX, calculateCCI, calculateMFI, calculateOBV, calculateStochastic, calculateWilliamsR } from './advanced-indicators';

/**
 * Simple Moving Average
 */
export function calculateSMA(data: number[], period: number): number {
    if (data.length < period) return 0;
    const slice = data.slice(-period);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / period;
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(data: number[], period: number): number {
    if (data.length < period) return 0;

    const multiplier = 2 / (period + 1);
    let ema = calculateSMA(data.slice(0, period), period);

    for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

    const avgGain = calculateSMA(gains, period);
    const avgLoss = calculateSMA(losses, period);

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(prices: number[]): {
    macd: number;
    signal: number;
    histogram: number;
} {
    if (prices.length < 26) {
        return { macd: 0, signal: 0, histogram: 0 };
    }

    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // Calculate signal line (9-period EMA of MACD)
    const macdHistory: number[] = [];
    for (let i = 26; i <= prices.length; i++) {
        const slice = prices.slice(0, i);
        const e12 = calculateEMA(slice, 12);
        const e26 = calculateEMA(slice, 26);
        macdHistory.push(e12 - e26);
    }

    const signal = calculateEMA(macdHistory, 9);
    const histogram = macd - signal;

    return { macd, signal, histogram };
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
    upper: number;
    middle: number;
    lower: number;
} {
    if (prices.length < period) {
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        return { upper: avg, middle: avg, lower: avg };
    }

    const slice = prices.slice(-period);
    const middle = calculateSMA(slice, period);

    // Calculate standard deviation
    const squaredDiffs = slice.map(price => Math.pow(price - middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upper = middle + (standardDeviation * stdDev);
    const lower = middle - (standardDeviation * stdDev);

    return { upper, middle, lower };
}

export function calculateATR(ohlcv: OHLCV[], period: number = 14): number {
    if (ohlcv.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < ohlcv.length; i++) {
        const current = ohlcv[i];
        const previousClose = ohlcv[i - 1].close;
        trueRanges.push(
            Math.max(
                current.high - current.low,
                Math.abs(current.high - previousClose),
                Math.abs(current.low - previousClose)
            )
        );
    }

    return calculateSMA(trueRanges, Math.min(period, trueRanges.length));
}

function calculateMomentum(prices: number[], lookback: number): number {
    if (prices.length <= lookback) return 0;
    const base = prices[prices.length - 1 - lookback];

    if (base === 0) return 0;

    return ((prices[prices.length - 1] - base) / base) * 100;
}

function determineTrend(currentPrice: number, reference: number): 'bullish' | 'bearish' | 'neutral' {
    if (!reference) return 'neutral';
    if (currentPrice > reference * 1.01) return 'bullish';
    if (currentPrice < reference * 0.99) return 'bearish';
    return 'neutral';
}

/**
 * Calculate all technical indicators for given OHLCV data
 */
export function calculateAllIndicators(ohlcv: OHLCV[]): TechnicalIndicators {
    const closePrices = ohlcv.map(d => d.close);
    const volumes = ohlcv.map(d => d.volume);
    const currentPrice = closePrices[closePrices.length - 1] || 0;

    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    const sma200 = calculateSMA(closePrices, 200);

    const ema12 = calculateEMA(closePrices, 12);
    const ema26 = calculateEMA(closePrices, 26);
    const atr = calculateATR(ohlcv, 14);

    const rsi = calculateRSI(closePrices, 14);
    const stochastic = calculateStochastic(ohlcv, 14);
    const adx = calculateADX(ohlcv, 14);
    const cci = calculateCCI(ohlcv, 20);
    const williamsR = calculateWilliamsR(ohlcv, 14);
    const obv = calculateOBV(ohlcv);
    const mfi = calculateMFI(ohlcv, 14);
    const macd = calculateMACD(closePrices);
    const bollingerBands = calculateBollingerBands(closePrices, 20, 2);

    const currentVolume = volumes[volumes.length - 1];
    const averageVolume = calculateSMA(volumes, 20);
    const volumeRatio = currentVolume / averageVolume;

    return {
        sma20,
        sma50,
        sma200,
        ema12,
        ema26,
        atr,
        rsi,
        stochastic,
        adx,
        cci,
        williamsR,
        obv,
        mfi,
        macd,
        bollingerBands,
        volume: {
            current: currentVolume,
            average: averageVolume,
            ratio: volumeRatio
        },
        trend: {
            shortTerm: determineTrend(currentPrice, sma20),
            mediumTerm: determineTrend(currentPrice, sma50),
            longTerm: determineTrend(currentPrice, sma200),
        },
        momentum: {
            oneMonth: calculateMomentum(closePrices, Math.min(21, Math.max(1, closePrices.length - 1))),
            threeMonth: calculateMomentum(closePrices, Math.min(63, Math.max(1, closePrices.length - 1))),
        },
    };
}

/**
 * Calculate indicator values for all data points (for charting)
 */
export function calculateIndicatorSeries(ohlcv: OHLCV[]): {
    sma20: (number | null)[];
    sma50: (number | null)[];
    ema12: (number | null)[];
    ema26: (number | null)[];
    bbUpper: (number | null)[];
    bbMiddle: (number | null)[];
    bbLower: (number | null)[];
    rsi: (number | null)[];
} {
    const closePrices = ohlcv.map(d => d.close);
    const sma20: (number | null)[] = [];
    const sma50: (number | null)[] = [];
    const ema12: (number | null)[] = [];
    const ema26: (number | null)[] = [];
    const bbUpper: (number | null)[] = [];
    const bbMiddle: (number | null)[] = [];
    const bbLower: (number | null)[] = [];
    const rsi: (number | null)[] = [];

    for (let i = 0; i < closePrices.length; i++) {
        const slice = closePrices.slice(0, i + 1);

        // SMA
        sma20.push(i >= 19 ? calculateSMA(slice, 20) : null);
        sma50.push(i >= 49 ? calculateSMA(slice, 50) : null);

        // EMA
        ema12.push(i >= 11 ? calculateEMA(slice, 12) : null);
        ema26.push(i >= 25 ? calculateEMA(slice, 26) : null);

        // Bollinger Bands
        if (i >= 19) {
            const bb = calculateBollingerBands(slice, 20, 2);
            bbUpper.push(bb.upper);
            bbMiddle.push(bb.middle);
            bbLower.push(bb.lower);
        } else {
            bbUpper.push(null);
            bbMiddle.push(null);
            bbLower.push(null);
        }

        // RSI
        rsi.push(i >= 14 ? calculateRSI(slice, 14) : null);
    }

    return { sma20, sma50, ema12, ema26, bbUpper, bbMiddle, bbLower, rsi };
}
