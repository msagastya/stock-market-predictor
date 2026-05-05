// Volume Analysis Module
import { OHLCV, VolumeAnalysis } from '@/types';

/**
 * Analyze volume patterns and generate trading insights
 */
export function analyzeVolume(ohlcv: OHLCV[], avgVolumePeriod: number = 20): VolumeAnalysis {
    if (ohlcv.length < 2) {
        return {
            isAbnormal: false,
            spike: 1,
            interpretation: 'Insufficient data for volume analysis',
            signal: 0
        };
    }

    const currentCandle = ohlcv[ohlcv.length - 1];
    const previousCandle = ohlcv[ohlcv.length - 2];

    // Calculate average volume
    const volumeSlice = ohlcv.slice(-Math.min(avgVolumePeriod, ohlcv.length));
    const avgVolume = volumeSlice.reduce((sum, candle) => sum + candle.volume, 0) / volumeSlice.length;

    const currentVolume = currentCandle.volume;
    const volumeSpike = currentVolume / avgVolume;

    // Price change
    const priceChange = currentCandle.close - previousCandle.close;
    const priceUp = priceChange > 0;
    const priceDown = priceChange < 0;

    // Volume change
    const volumeUp = currentVolume > avgVolume;
    const volumeDown = currentVolume < avgVolume;

    let interpretation = '';
    let signal = 0;
    let isAbnormal = false;

    // Abnormal volume detection (2x+ average)
    if (volumeSpike >= 2) {
        isAbnormal = true;
    }

    // Price-Volume Analysis
    if (priceUp && volumeUp) {
        interpretation = `Price rising with increasing volume (${volumeSpike.toFixed(1)}x avg) → Strong bullish trend confirmation. Buying pressure is high.`;
        signal = volumeSpike >= 2 ? 2 : 1;
    } else if (priceUp && volumeDown) {
        interpretation = `Price rising but volume declining (${volumeSpike.toFixed(1)}x avg) → Trend may be weakening. Caution advised.`;
        signal = -1;
    } else if (priceDown && volumeUp) {
        interpretation = `Price falling with increasing volume (${volumeSpike.toFixed(1)}x avg) → Strong bearish pressure. Selling momentum building.`;
        signal = volumeSpike >= 2 ? -2 : -1;
    } else if (priceDown && volumeDown) {
        interpretation = `Price falling but volume low (${volumeSpike.toFixed(1)}x avg) → Selling pressure may be exhausted. Watch for reversal.`;
        signal = 0;
    } else {
        // Price flat
        if (volumeUp) {
            interpretation = `Price consolidating with high volume (${volumeSpike.toFixed(1)}x avg) → Potential breakout brewing. Watch for direction.`;
            signal = 0;
        } else {
            interpretation = `Low volume consolidation (${volumeSpike.toFixed(1)}x avg) → Market indecision. Wait for clear signal.`;
            signal = 0;
        }
    }

    // Additional insights for extreme spikes
    if (volumeSpike >= 3) {
        interpretation += ` ⚠️ EXTREME volume spike (${volumeSpike.toFixed(1)}x) detected - major market event or news.`;
        isAbnormal = true;
    }

    return {
        isAbnormal,
        spike: volumeSpike,
        interpretation,
        signal
    };
}

/**
 * Get volume insights for multiple periods
 */
export function getVolumeInsights(ohlcv: OHLCV[]): string[] {
    const insights: string[] = [];

    if (ohlcv.length < 10) {
        return ['Not enough data for comprehensive volume analysis'];
    }

    // Recent volume trend (last 5 days vs previous 20 days)
    const recent5 = ohlcv.slice(-5);
    const previous20 = ohlcv.slice(-25, -5);

    if (previous20.length > 0) {
        const recent5Avg = recent5.reduce((sum, c) => sum + c.volume, 0) / recent5.length;
        const previous20Avg = previous20.reduce((sum, c) => sum + c.volume, 0) / previous20.length;

        const volumeTrend = recent5Avg / previous20Avg;

        if (volumeTrend > 1.5) {
            insights.push(`📈 Volume trending UP significantly (${((volumeTrend - 1) * 100).toFixed(0)}% increase) - heightened market interest`);
        } else if (volumeTrend < 0.7) {
            insights.push(`📉 Volume trending DOWN (${((1 - volumeTrend) * 100).toFixed(0)}% decrease) - declining market interest`);
        } else {
            insights.push(`➡️ Volume stable - consistent market participation`);
        }
    }

    // Check for volume climax (highest volume in recent period)
    const last20Volumes = ohlcv.slice(-20).map(c => c.volume);
    const maxVolume = Math.max(...last20Volumes);
    const currentVolume = ohlcv[ohlcv.length - 1].volume;

    if (currentVolume === maxVolume && currentVolume > 0) {
        insights.push(`🔔 Today's volume is highest in last 20 days - potential trend climax or reversal point`);
    }

    return insights;
}
