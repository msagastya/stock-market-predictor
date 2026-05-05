// Multi-Timeframe Analysis
import { OHLCV, TechnicalIndicators, Recommendation } from '@/types';
import { calculateAllIndicators } from './technical-indicators';
import { detectCandlestickPatterns } from './candlestick-detector';
import { analyzeVolume } from './volume-analyzer';
import { generateRecommendation } from './signal-scorer';

export type Timeframe = '1D' | '1W' | '2W' | '1M' | '2M' | '3M' | '6M' | '1Y' | '2Y' | '5Y';

export interface TimeframeAnalysis {
    timeframe: Timeframe;
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number; // 1-10
    recommendation: Recommendation;
    indicators: TechnicalIndicators;
    priceChange: number;
    priceChangePercent: number;
}

export interface MultiTimeframeAnalysis {
    symbol: string;
    timeframes: TimeframeAnalysis[];
    overallTrend: 'bullish' | 'bearish' | 'neutral';
    overallStrength: number;
    consensus: string;
}

/**
 * Analyze stock across multiple timeframes
 */
export function analyzeMultipleTimeframes(
    symbol: string,
    allData: { [key in Timeframe]?: OHLCV[] }
): MultiTimeframeAnalysis {
    const timeframes: TimeframeAnalysis[] = [];

    Object.entries(allData).forEach(([tf, data]) => {
        if (data && data.length > 0) {
            const analysis = analyzeTimeframe(tf as Timeframe, data);
            timeframes.push(analysis);
        }
    });

    // Calculate overall consensus
    const overallTrend = calculateOverallTrend(timeframes);
    const overallStrength = calculateOverallStrength(timeframes);
    const consensus = generateConsensus(timeframes);

    return {
        symbol,
        timeframes,
        overallTrend,
        overallStrength,
        consensus
    };
}

function analyzeTimeframe(timeframe: Timeframe, data: OHLCV[]): TimeframeAnalysis {
    const indicators = calculateAllIndicators(data);
    const patterns = detectCandlestickPatterns(data);
    const volumeAnalysis = analyzeVolume(data);
    const recommendation = generateRecommendation(data, indicators, patterns, volumeAnalysis);

    const currentPrice = data[data.length - 1].close;
    const startPrice = data[0].close;
    const priceChange = currentPrice - startPrice;
    const priceChangePercent = (priceChange / startPrice) * 100;

    const trend = determineTrend(indicators, priceChangePercent);
    const strength = calculateTrendStrength(indicators, priceChangePercent);

    return {
        timeframe,
        trend,
        strength,
        recommendation,
        indicators,
        priceChange,
        priceChangePercent
    };
}

function determineTrend(indicators: TechnicalIndicators, priceChangePercent: number): 'bullish' | 'bearish' | 'neutral' {
    let score = 0;

    // Price trend
    if (priceChangePercent > 5) score += 2;
    else if (priceChangePercent > 2) score += 1;
    else if (priceChangePercent < -5) score -= 2;
    else if (priceChangePercent < -2) score -= 1;

    // Moving averages
    if (indicators.ema12 > indicators.ema26) score += 1;
    else score -= 1;

    // RSI
    if (indicators.rsi > 60) score += 1;
    else if (indicators.rsi < 40) score -= 1;

    // MACD
    if (indicators.macd.histogram > 0) score += 1;
    else score -= 1;

    if (score > 2) return 'bullish';
    if (score < -2) return 'bearish';
    return 'neutral';
}

function calculateTrendStrength(indicators: TechnicalIndicators, priceChangePercent: number): number {
    let strength = 5; // Base

    // Strong price movement
    strength += Math.min(Math.abs(priceChangePercent) / 5, 2);

    // Volume confirmation
    if (indicators.volume.ratio > 1.5) strength += 1;

    // RSI extremes
    if (indicators.rsi > 70 || indicators.rsi < 30) strength += 1;

    // MACD strength
    if (Math.abs(indicators.macd.histogram) > 1) strength += 1;

    return Math.min(Math.round(strength), 10);
}

function calculateOverallTrend(timeframes: TimeframeAnalysis[]): 'bullish' | 'bearish' | 'neutral' {
    const scores = { bullish: 0, bearish: 0, neutral: 0 };

    // Weight longer timeframes more heavily
    const weights: { [key in Timeframe]?: number } = {
        '1D': 1, '1W': 2, '2W': 2, '1M': 3, '2M': 3, '3M': 4, '6M': 5, '1Y': 6, '2Y': 7, '5Y': 8
    };

    timeframes.forEach(tf => {
        const weight = weights[tf.timeframe] || 1;
        scores[tf.trend] += weight;
    });

    if (scores.bullish > scores.bearish && scores.bullish > scores.neutral) return 'bullish';
    if (scores.bearish > scores.bullish && scores.bearish > scores.neutral) return 'bearish';
    return 'neutral';
}

function calculateOverallStrength(timeframes: TimeframeAnalysis[]): number {
    const avgStrength = timeframes.reduce((sum, tf) => sum + tf.strength, 0) / timeframes.length;
    return Math.round(avgStrength);
}

function generateConsensus(timeframes: TimeframeAnalysis[]): string {
    const bullishCount = timeframes.filter(tf => tf.trend === 'bullish').length;
    const bearishCount = timeframes.filter(tf => tf.trend === 'bearish').length;
    const total = timeframes.length;

    if (bullishCount / total > 0.7) return 'Strong bullish consensus across all timeframes';
    if (bearishCount / total > 0.7) return 'Strong bearish consensus across all timeframes';
    if (bullishCount > bearishCount) return 'Majority bullish with some divergence';
    if (bearishCount > bullishCount) return 'Majority bearish with some divergence';
    return 'Mixed signals - no clear consensus';
}
