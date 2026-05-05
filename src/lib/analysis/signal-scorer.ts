// Signal Scoring and Recommendation Engine
import { OHLCV, TechnicalIndicators, CandlestickPattern, VolumeAnalysis, Recommendation, TradingSignal } from '@/types';

/**
 * Generate trading signal from RSI
 */
function getRSISignal(rsi: number): TradingSignal {
    if (rsi >= 70) {
        return {
            indicator: 'RSI',
            signal: -2,
            confidence: rsi >= 80 ? 'high' : 'medium',
            reason: `RSI overbought at ${rsi.toFixed(1)} (>70) - potential reversal or pullback`
        };
    } else if (rsi <= 30) {
        return {
            indicator: 'RSI',
            signal: 2,
            confidence: rsi <= 20 ? 'high' : 'medium',
            reason: `RSI oversold at ${rsi.toFixed(1)} (<30) - potential bounce or reversal`
        };
    } else if (rsi > 50 && rsi < 70) {
        return {
            indicator: 'RSI',
            signal: 1,
            confidence: 'low',
            reason: `RSI at ${rsi.toFixed(1)} showing bullish momentum`
        };
    } else if (rsi < 50 && rsi > 30) {
        return {
            indicator: 'RSI',
            signal: -1,
            confidence: 'low',
            reason: `RSI at ${rsi.toFixed(1)} showing bearish momentum`
        };
    }

    return {
        indicator: 'RSI',
        signal: 0,
        confidence: 'low',
        reason: `RSI neutral at ${rsi.toFixed(1)}`
    };
}

/**
 * Generate trading signal from MACD
 */
function getMACDSignal(macd: { macd: number; signal: number; histogram: number }): TradingSignal {
    const { macd: macdLine, signal: signalLine, histogram } = macd;

    // MACD crossover signals
    if (histogram > 0 && macdLine > signalLine) {
        return {
            indicator: 'MACD',
            signal: histogram > 0.5 ? 2 : 1,
            confidence: Math.abs(histogram) > 0.5 ? 'high' : 'medium',
            reason: `MACD bullish crossover (histogram: ${histogram.toFixed(2)})`
        };
    } else if (histogram < 0 && macdLine < signalLine) {
        return {
            indicator: 'MACD',
            signal: histogram < -0.5 ? -2 : -1,
            confidence: Math.abs(histogram) > 0.5 ? 'high' : 'medium',
            reason: `MACD bearish crossover (histogram: ${histogram.toFixed(2)})`
        };
    }

    return {
        indicator: 'MACD',
        signal: 0,
        confidence: 'low',
        reason: 'MACD neutral - no clear crossover'
    };
}

/**
 * Generate trading signal from Moving Averages
 */
function getMASignal(currentPrice: number, indicators: TechnicalIndicators): TradingSignal {
    const { sma20, sma50, sma200 } = indicators;
    let signal = 0;
    const reasons: string[] = [];

    // Price vs SMA20
    if (currentPrice > sma20) {
        signal += 1;
        reasons.push('Price above SMA20');
    } else {
        signal -= 1;
        reasons.push('Price below SMA20');
    }

    // Price vs SMA50
    if (sma50 > 0) {
        if (currentPrice > sma50) {
            signal += 1;
            reasons.push('Price above SMA50');
        } else {
            signal -= 1;
            reasons.push('Price below SMA50');
        }
    }

    // Golden Cross / Death Cross (SMA50 vs SMA200)
    if (sma50 > 0 && sma200 > 0) {
        if (sma50 > sma200) {
            signal += 1;
            reasons.push('SMA50 > SMA200 (Golden Cross territory)');
        } else {
            signal -= 1;
            reasons.push('SMA50 < SMA200 (Death Cross territory)');
        }
    }

    // Normalize signal
    const normalizedSignal = Math.max(-2, Math.min(2, signal));

    return {
        indicator: 'Moving Averages',
        signal: normalizedSignal,
        confidence: Math.abs(normalizedSignal) >= 2 ? 'high' : 'medium',
        reason: reasons.join(', ')
    };
}

/**
 * Generate trading signal from Bollinger Bands
 */
function getBollingerSignal(currentPrice: number, bb: { upper: number; middle: number; lower: number }): TradingSignal {
    const range = bb.upper - bb.lower;
    const position = (currentPrice - bb.lower) / range;

    if (position > 0.9) {
        return {
            indicator: 'Bollinger Bands',
            signal: -1,
            confidence: 'medium',
            reason: `Price near upper band (${(position * 100).toFixed(0)}%) - potentially overbought`
        };
    } else if (position < 0.1) {
        return {
            indicator: 'Bollinger Bands',
            signal: 1,
            confidence: 'medium',
            reason: `Price near lower band (${(position * 100).toFixed(0)}%) - potentially oversold`
        };
    } else if (position > 0.5) {
        return {
            indicator: 'Bollinger Bands',
            signal: 0,
            confidence: 'low',
            reason: 'Price in upper half of Bollinger Bands'
        };
    } else {
        return {
            indicator: 'Bollinger Bands',
            signal: 0,
            confidence: 'low',
            reason: 'Price in lower half of Bollinger Bands'
        };
    }
}

/**
 * Combine all signals and generate final recommendation
 */
export function generateRecommendation(
    ohlcv: OHLCV[],
    indicators: TechnicalIndicators,
    patterns: CandlestickPattern[],
    volumeAnalysis: VolumeAnalysis
): Recommendation {
    const currentPrice = ohlcv[ohlcv.length - 1].close;

    // Collect all signals
    const signals: TradingSignal[] = [];

    // Technical indicators
    signals.push(getRSISignal(indicators.rsi));
    signals.push(getMACDSignal(indicators.macd));
    signals.push(getMASignal(currentPrice, indicators));
    signals.push(getBollingerSignal(currentPrice, indicators.bollingerBands));

    // Volume signal
    if (volumeAnalysis.signal !== 0) {
        signals.push({
            indicator: 'Volume',
            signal: volumeAnalysis.signal,
            confidence: volumeAnalysis.isAbnormal ? 'high' : 'medium',
            reason: volumeAnalysis.interpretation
        });
    }

    // Candlestick pattern signals
    patterns.forEach(pattern => {
        if (pattern.signal !== 0) {
            signals.push({
                indicator: `Pattern: ${pattern.name}`,
                signal: pattern.signal,
                confidence: pattern.confidence,
                reason: pattern.description
            });
        }
    });

    // Calculate weighted score
    let totalScore = 0;
    let totalWeight = 0;

    signals.forEach(signal => {
        const weight = signal.confidence === 'high' ? 1.5 : signal.confidence === 'medium' ? 1.0 : 0.5;
        totalScore += signal.signal * weight;
        totalWeight += weight;
    });

    const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Normalize to -3 to +3 scale
    const normalizedScore = Math.max(-3, Math.min(3, Math.round(averageScore)));

    // Determine rating
    let rating: Recommendation['rating'];
    if (normalizedScore >= 2) rating = 'Strong Buy';
    else if (normalizedScore === 1) rating = 'Buy';
    else if (normalizedScore === -1) rating = 'Sell';
    else if (normalizedScore <= -2) rating = 'Strong Sell';
    else rating = 'Neutral';

    // Determine confidence
    const agreementRatio = signals.filter(s => Math.sign(s.signal) === Math.sign(normalizedScore)).length / Math.max(1, signals.length);
    let confidence: 'low' | 'medium' | 'high';

    if (agreementRatio >= 0.75) confidence = 'high';
    else if (agreementRatio >= 0.5) confidence = 'medium';
    else confidence = 'low';

    // Generate reasoning
    const reasoning: string[] = [];

    // Group signals by direction
    const bullishSignals = signals.filter(s => s.signal > 0);
    const bearishSignals = signals.filter(s => s.signal < 0);

    if (bullishSignals.length > 0) {
        reasoning.push(`**Bullish factors (${bullishSignals.length}):** ${bullishSignals.map(s => s.indicator).join(', ')}`);
    }

    if (bearishSignals.length > 0) {
        reasoning.push(`**Bearish factors (${bearishSignals.length}):** ${bearishSignals.map(s => s.indicator).join(', ')}`);
    }

    // Add key insights
    if (rating === 'Strong Buy' || rating === 'Buy') {
        reasoning.push('✅ Multiple indicators suggest upward momentum');
    } else if (rating === 'Strong Sell' || rating === 'Sell') {
        reasoning.push('⚠️ Multiple indicators suggest downward pressure');
    } else {
        reasoning.push('➡️ Mixed signals - exercise caution and wait for clearer direction');
    }

    // Add confidence note
    reasoning.push(`📊 Signal confidence: ${confidence.toUpperCase()} (${(agreementRatio * 100).toFixed(0)}% agreement)`);

    return {
        rating,
        score: normalizedScore,
        confidence,
        signals,
        reasoning,
        patterns
    };
}
