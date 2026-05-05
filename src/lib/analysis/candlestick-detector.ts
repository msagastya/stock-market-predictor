// Candlestick Pattern Detection
import { OHLCV, CandlestickPattern } from '@/types';

/**
 * Helper: Calculate candle body size
 */
function getBodySize(candle: OHLCV): number {
    return Math.abs(candle.close - candle.open);
}

/**
 * Helper: Calculate candle range (high - low)
 */
function getRange(candle: OHLCV): number {
    return candle.high - candle.low;
}

/**
 * Helper: Check if candle is bullish
 */
function isBullish(candle: OHLCV): boolean {
    return candle.close > candle.open;
}

/**
 * Helper: Check if candle is bearish
 */
function isBearish(candle: OHLCV): boolean {
    return candle.close < candle.open;
}

/**
 * Helper: Get upper shadow size
 */
function getUpperShadow(candle: OHLCV): number {
    return candle.high - Math.max(candle.open, candle.close);
}

/**
 * Helper: Get lower shadow size
 */
function getLowerShadow(candle: OHLCV): number {
    return Math.min(candle.open, candle.close) - candle.low;
}

/**
 * Detect Hammer pattern (bullish reversal)
 */
function detectHammer(candle: OHLCV): CandlestickPattern | null {
    const body = getBodySize(candle);
    const range = getRange(candle);
    const lowerShadow = getLowerShadow(candle);
    const upperShadow = getUpperShadow(candle);

    // Hammer: small body, long lower shadow (2x+ body), small upper shadow
    if (lowerShadow > body * 2 && upperShadow < body * 0.3 && body < range * 0.3) {
        return {
            name: 'Hammer',
            type: 'bullish',
            confidence: body < range * 0.2 ? 'high' : 'medium',
            signal: 2,
            description: 'Bullish reversal pattern with long lower shadow',
            index: 0
        };
    }
    return null;
}

/**
 * Detect Inverted Hammer pattern (bullish reversal)
 */
function detectInvertedHammer(candle: OHLCV): CandlestickPattern | null {
    const body = getBodySize(candle);
    const range = getRange(candle);
    const lowerShadow = getLowerShadow(candle);
    const upperShadow = getUpperShadow(candle);

    // Inverted Hammer: small body, long upper shadow (2x+ body), small lower shadow
    if (upperShadow > body * 2 && lowerShadow < body * 0.3 && body < range * 0.3) {
        return {
            name: 'Inverted Hammer',
            type: 'bullish',
            confidence: 'medium',
            signal: 1,
            description: 'Potential bullish reversal with long upper shadow',
            index: 0
        };
    }
    return null;
}

/**
 * Detect Shooting Star pattern (bearish reversal)
 */
function detectShootingStar(candle: OHLCV): CandlestickPattern | null {
    const body = getBodySize(candle);
    const range = getRange(candle);
    const lowerShadow = getLowerShadow(candle);
    const upperShadow = getUpperShadow(candle);

    // Shooting Star: small body near low, long upper shadow
    if (upperShadow > body * 2 && lowerShadow < body * 0.3 && body < range * 0.3) {
        return {
            name: 'Shooting Star',
            type: 'bearish',
            confidence: 'high',
            signal: -2,
            description: 'Bearish reversal pattern with long upper shadow',
            index: 0
        };
    }
    return null;
}

/**
 * Detect Hanging Man pattern (bearish reversal)
 */
function detectHangingMan(candle: OHLCV): CandlestickPattern | null {
    const body = getBodySize(candle);
    const range = getRange(candle);
    const lowerShadow = getLowerShadow(candle);
    const upperShadow = getUpperShadow(candle);

    // Hanging Man: small body, long lower shadow (appears in uptrend)
    if (lowerShadow > body * 2 && upperShadow < body * 0.3 && body < range * 0.3) {
        return {
            name: 'Hanging Man',
            type: 'bearish',
            confidence: 'medium',
            signal: -1,
            description: 'Potential bearish reversal in uptrend',
            index: 0
        };
    }
    return null;
}

/**
 * Detect Doji pattern (indecision)
 */
function detectDoji(candle: OHLCV): CandlestickPattern | null {
    const body = getBodySize(candle);
    const range = getRange(candle);

    // Doji: very small body compared to range
    if (body < range * 0.1) {
        const lowerShadow = getLowerShadow(candle);
        const upperShadow = getUpperShadow(candle);

        // Dragonfly Doji: long lower shadow, no upper shadow
        if (lowerShadow > range * 0.6 && upperShadow < range * 0.1) {
            return {
                name: 'Dragonfly Doji',
                type: 'bullish',
                confidence: 'medium',
                signal: 1,
                description: 'Bullish reversal signal with long lower shadow',
                index: 0
            };
        }

        // Gravestone Doji: long upper shadow, no lower shadow
        if (upperShadow > range * 0.6 && lowerShadow < range * 0.1) {
            return {
                name: 'Gravestone Doji',
                type: 'bearish',
                confidence: 'medium',
                signal: -1,
                description: 'Bearish reversal signal with long upper shadow',
                index: 0
            };
        }

        // Standard Doji
        return {
            name: 'Doji',
            type: 'neutral',
            confidence: 'low',
            signal: 0,
            description: 'Indecision in the market, potential trend reversal',
            index: 0
        };
    }
    return null;
}

/**
 * Detect Bullish Engulfing pattern (2-candle)
 */
function detectBullishEngulfing(prev: OHLCV, curr: OHLCV): CandlestickPattern | null {
    // Previous candle is bearish, current is bullish
    // Current candle's body completely engulfs previous candle's body
    if (isBearish(prev) && isBullish(curr)) {
        if (curr.open < prev.close && curr.close > prev.open) {
            return {
                name: 'Bullish Engulfing',
                type: 'bullish',
                confidence: 'high',
                signal: 3,
                description: 'Strong bullish reversal signal',
                index: 1
            };
        }
    }
    return null;
}

/**
 * Detect Bearish Engulfing pattern (2-candle)
 */
function detectBearishEngulfing(prev: OHLCV, curr: OHLCV): CandlestickPattern | null {
    // Previous candle is bullish, current is bearish
    // Current candle's body completely engulfs previous candle's body
    if (isBullish(prev) && isBearish(curr)) {
        if (curr.open > prev.close && curr.close < prev.open) {
            return {
                name: 'Bearish Engulfing',
                type: 'bearish',
                confidence: 'high',
                signal: -3,
                description: 'Strong bearish reversal signal',
                index: 1
            };
        }
    }
    return null;
}

/**
 * Detect Morning Star pattern (3-candle bullish reversal)
 */
function detectMorningStar(first: OHLCV, second: OHLCV, third: OHLCV): CandlestickPattern | null {
    // First: long bearish candle
    // Second: small body (star)
    // Third: long bullish candle
    const firstBody = getBodySize(first);
    const secondBody = getBodySize(second);
    const thirdBody = getBodySize(third);

    if (isBearish(first) && isBullish(third)) {
        // Second candle has small body
        if (secondBody < firstBody * 0.3 && thirdBody > firstBody * 0.5) {
            // Third candle closes above midpoint of first candle
            const firstMidpoint = (first.open + first.close) / 2;
            if (third.close > firstMidpoint) {
                return {
                    name: 'Morning Star',
                    type: 'bullish',
                    confidence: 'high',
                    signal: 3,
                    description: 'Strong bullish reversal pattern (3-candle)',
                    index: 2
                };
            }
        }
    }
    return null;
}

/**
 * Detect Evening Star pattern (3-candle bearish reversal)
 */
function detectEveningStar(first: OHLCV, second: OHLCV, third: OHLCV): CandlestickPattern | null {
    // First: long bullish candle
    // Second: small body (star)
    // Third: long bearish candle
    const firstBody = getBodySize(first);
    const secondBody = getBodySize(second);
    const thirdBody = getBodySize(third);

    if (isBullish(first) && isBearish(third)) {
        // Second candle has small body
        if (secondBody < firstBody * 0.3 && thirdBody > firstBody * 0.5) {
            // Third candle closes below midpoint of first candle
            const firstMidpoint = (first.open + first.close) / 2;
            if (third.close < firstMidpoint) {
                return {
                    name: 'Evening Star',
                    type: 'bearish',
                    confidence: 'high',
                    signal: -3,
                    description: 'Strong bearish reversal pattern (3-candle)',
                    index: 2
                };
            }
        }
    }
    return null;
}

/**
 * Detect all candlestick patterns in the given data
 */
export function detectCandlestickPatterns(ohlcv: OHLCV[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];

    if (ohlcv.length === 0) return patterns;

    // Single candle patterns (check last candle)
    const lastCandle = ohlcv[ohlcv.length - 1];
    const singlePatterns = [
        detectHammer(lastCandle),
        detectInvertedHammer(lastCandle),
        detectShootingStar(lastCandle),
        detectHangingMan(lastCandle),
        detectDoji(lastCandle)
    ];

    singlePatterns.forEach(pattern => {
        if (pattern) {
            pattern.index = ohlcv.length - 1;
            patterns.push(pattern);
        }
    });

    // Two candle patterns
    if (ohlcv.length >= 2) {
        const prev = ohlcv[ohlcv.length - 2];
        const curr = ohlcv[ohlcv.length - 1];

        const twoPatterns = [
            detectBullishEngulfing(prev, curr),
            detectBearishEngulfing(prev, curr)
        ];

        twoPatterns.forEach(pattern => {
            if (pattern) {
                pattern.index = ohlcv.length - 1;
                patterns.push(pattern);
            }
        });
    }

    // Three candle patterns
    if (ohlcv.length >= 3) {
        const first = ohlcv[ohlcv.length - 3];
        const second = ohlcv[ohlcv.length - 2];
        const third = ohlcv[ohlcv.length - 1];

        const threePatterns = [
            detectMorningStar(first, second, third),
            detectEveningStar(first, second, third)
        ];

        threePatterns.forEach(pattern => {
            if (pattern) {
                pattern.index = ohlcv.length - 1;
                patterns.push(pattern);
            }
        });
    }

    return patterns;
}
