// Support and Resistance Level Detection
import { OHLCV } from '@/types';

export interface SupportResistanceLevel {
    price: number;
    type: 'support' | 'resistance';
    strength: number; // 1-10
    touches: number;
}

/**
 * Calculate Support and Resistance Levels
 */
export function calculateSupportResistance(ohlcv: OHLCV[]): SupportResistanceLevel[] {
    if (ohlcv.length < 20) return [];

    const levels: SupportResistanceLevel[] = [];
    const pivotPoints = findPivotPoints(ohlcv);

    // Group similar price levels
    const tolerance = calculatePriceTolerance(ohlcv);
    const groupedLevels = groupSimilarLevels(pivotPoints, tolerance);

    // Calculate strength based on touches and volume
    groupedLevels.forEach(level => {
        const strength = calculateLevelStrength(level, ohlcv);
        if (strength >= 3) { // Only include significant levels
            levels.push({
                price: level.price,
                type: level.type,
                strength,
                touches: level.touches
            });
        }
    });

    return levels.sort((a, b) => b.strength - a.strength).slice(0, 10);
}

interface PivotPoint {
    price: number;
    type: 'support' | 'resistance';
    index: number;
}

function findPivotPoints(ohlcv: OHLCV[]): PivotPoint[] {
    const pivots: PivotPoint[] = [];
    const lookback = 5;

    for (let i = lookback; i < ohlcv.length - lookback; i++) {
        const current = ohlcv[i];
        const leftHigh = Math.max(...ohlcv.slice(i - lookback, i).map(c => c.high));
        const rightHigh = Math.max(...ohlcv.slice(i + 1, i + lookback + 1).map(c => c.high));
        const leftLow = Math.min(...ohlcv.slice(i - lookback, i).map(c => c.low));
        const rightLow = Math.min(...ohlcv.slice(i + 1, i + lookback + 1).map(c => c.low));

        // Resistance: Local high
        if (current.high > leftHigh && current.high > rightHigh) {
            pivots.push({
                price: current.high,
                type: 'resistance',
                index: i
            });
        }

        // Support: Local low
        if (current.low < leftLow && current.low < rightLow) {
            pivots.push({
                price: current.low,
                type: 'support',
                index: i
            });
        }
    }

    return pivots;
}

function calculatePriceTolerance(ohlcv: OHLCV[]): number {
    const avgPrice = ohlcv.reduce((sum, c) => sum + c.close, 0) / ohlcv.length;
    return avgPrice * 0.02; // 2% tolerance
}

function groupSimilarLevels(pivots: PivotPoint[], tolerance: number) {
    const grouped: Array<{ price: number; type: 'support' | 'resistance'; touches: number; indices: number[] }> = [];

    pivots.forEach(pivot => {
        const existing = grouped.find(g =>
            Math.abs(g.price - pivot.price) < tolerance && g.type === pivot.type
        );

        if (existing) {
            existing.touches++;
            existing.indices.push(pivot.index);
            existing.price = (existing.price * (existing.touches - 1) + pivot.price) / existing.touches;
        } else {
            grouped.push({
                price: pivot.price,
                type: pivot.type,
                touches: 1,
                indices: [pivot.index]
            });
        }
    });

    return grouped;
}

function calculateLevelStrength(level: any, ohlcv: OHLCV[]): number {
    let strength = level.touches; // Base strength from number of touches

    // Bonus for recent touches
    const recentTouches = level.indices.filter((idx: number) => idx > ohlcv.length - 20).length;
    strength += recentTouches;

    // Bonus for volume at level
    const avgVolume = ohlcv.reduce((sum, c) => sum + c.volume, 0) / ohlcv.length;
    level.indices.forEach((idx: number) => {
        if (ohlcv[idx].volume > avgVolume * 1.5) {
            strength += 1;
        }
    });

    return Math.min(strength, 10);
}

/**
 * Get current support and resistance for display
 */
export function getCurrentSupportResistance(ohlcv: OHLCV[], currentPrice: number) {
    const levels = calculateSupportResistance(ohlcv);

    const supports = levels.filter(l => l.type === 'support' && l.price < currentPrice)
        .sort((a, b) => b.price - a.price);

    const resistances = levels.filter(l => l.type === 'resistance' && l.price > currentPrice)
        .sort((a, b) => a.price - b.price);

    return {
        nearestSupport: supports[0],
        nearestResistance: resistances[0],
        allSupports: supports.slice(0, 3),
        allResistances: resistances.slice(0, 3)
    };
}
