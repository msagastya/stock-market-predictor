// Trading Tips Database
import { TradingTip } from '@/types';

export const tradingTips: TradingTip[] = [
    // RSI Tips
    {
        id: 'rsi-overbought',
        title: 'RSI Overbought - Exercise Caution',
        content: 'RSI above 70 suggests the asset may be overbought. However, strong trends can remain overbought for extended periods. Wait for confirmation (price reversal, volume decline) before selling. Consider using trailing stop-losses to protect profits.',
        category: 'risk',
        applicableWhen: ['rsi > 70', 'price > bb_upper']
    },
    {
        id: 'rsi-oversold',
        title: 'RSI Oversold - Potential Bounce',
        content: 'RSI below 30 suggests the asset may be oversold and due for a bounce. In strong downtrends, RSI can stay oversold longer than expected. Look for bullish candlestick patterns or volume confirmation before buying.',
        category: 'strategy',
        applicableWhen: ['rsi < 30']
    },

    // MACD Tips
    {
        id: 'macd-bullish-cross',
        title: 'MACD Bullish Crossover',
        content: 'MACD line crossing above the signal line is a bullish signal. This works best when crossing above zero. Combine with price action confirmation (higher highs) and increasing volume for stronger signals.',
        category: 'strategy',
        applicableWhen: ['macd-bullish']
    },
    {
        id: 'macd-bearish-cross',
        title: 'MACD Bearish Crossover',
        content: 'MACD line crossing below the signal line suggests potential downside. This is more reliable when crossing below zero. Consider reducing position size or setting tighter stop-losses.',
        category: 'risk',
        applicableWhen: ['macd-bearish']
    },

    // Volume Tips
    {
        id: 'volume-spike',
        title: 'High Volume Alert',
        content: 'Abnormally high volume (2x+ average) often precedes significant price moves. If price breaks resistance on high volume, it confirms strong buying pressure. If price breaks support on high volume, expect further downside. Always wait for price confirmation.',
        category: 'volume',
        applicableWhen: ['volume-spike']
    },
    {
        id: 'volume-price-divergence',
        title: 'Price-Volume Divergence Warning',
        content: 'When price rises but volume declines, the trend is weakening. Similarly, price falling on low volume suggests selling pressure is exhausted. This divergence often signals trend reversals. Be prepared to adjust your position.',
        category: 'risk',
        applicableWhen: ['price-volume-divergence']
    },

    // Pattern Tips
    {
        id: 'engulfing-pattern',
        title: 'Engulfing Pattern Detected',
        content: 'Engulfing patterns are strong reversal signals. Bullish engulfing after a downtrend suggests upward reversal. Bearish engulfing after an uptrend warns of potential decline. Confirm with next candle before taking action.',
        category: 'pattern',
        applicableWhen: ['engulfing-pattern']
    },
    {
        id: 'doji-pattern',
        title: 'Doji - Market Indecision',
        content: 'Doji candles indicate indecision between buyers and sellers. After a strong trend, they often signal potential reversals. The next candle direction usually confirms the trend. Reduce position size until direction clarifies.',
        category: 'pattern',
        applicableWhen: ['doji']
    },
    {
        id: 'star-pattern',
        title: 'Morning/Evening Star Pattern',
        content: 'Star patterns (Morning/Evening) are powerful 3-candle reversal signals. Morning Star suggests bullish reversal from downtrend. Evening Star warns of bearish reversal from uptrend. High confidence pattern - consider taking action.',
        category: 'pattern',
        applicableWhen: ['star-pattern']
    },

    // General Trading Tips
    {
        id: 'trailing-stop',
        title: 'Use Trailing Stop-Loss',
        content: 'In trending markets, use trailing stop-losses to protect profits while letting winners run. Common approach: trail stop below recent swing lows (uptrend) or above swing highs (downtrend). This locks in gains while giving room for trend continuation.',
        category: 'risk',
        applicableWhen: ['strong-trend']
    },
    {
        id: 'position-sizing',
        title: 'Smart Position Sizing',
        content: 'Never risk more than 1-2% of your capital on a single trade. When confidence is low or signals are mixed, reduce position size. When multiple indicators align with high confidence, you can increase (but stay within risk limits).',
        category: 'risk',
        applicableWhen: ['always']
    },
    {
        id: 'trend-is-friend',
        title: 'Trade With the Trend',
        content: 'The trend is your friend - trading with the trend has higher success rates. In uptrends (price above MA50, MA200), look for buying opportunities on pullbacks. In downtrends, wait for clearer signals before buying. Counter-trend trading is riskier.',
        category: 'strategy',
        applicableWhen: ['trend-analysis']
    },
    {
        id: 'wait-confirmation',
        title: 'Wait for Confirmation',
        content: 'Single signals can be false. Wait for multiple confirmations: candlestick pattern + indicator signal + volume confirmation = higher probability trade. Patience beats impulsive trading.',
        category: 'strategy',
        applicableWhen: ['mixed-signals']
    },
    {
        id: 'support-resistance',
        title: 'Respect Support & Resistance',
        content: 'Price tends to bounce off support (previous lows) and reverse at resistance (previous highs). When support breaks, it often becomes new resistance, and vice versa. Use these levels for entry/exit planning.',
        category: 'strategy',
        applicableWhen: ['price-levels']
    },
    {
        id: 'bollinger-bands',
        title: 'Bollinger Bands Strategy',
        content: 'Price tends to bounce between Bollinger Bands. When price touches lower band in uptrend, it\'s often a buying opportunity. When price touches upper band in downtrend, consider selling. Band squeezes (narrow bands) often precede large price moves.',
        category: 'strategy',
        applicableWhen: ['bollinger-extreme']
    },
    {
        id: 'risk-reward',
        title: 'Maintain Risk-Reward Ratio',
        content: 'Always aim for at least 1:2 risk-reward ratio (risk ₹1 to potentially gain ₹2). If your stop-loss is 5% below entry, target should be at least 10% above entry. Good risk-reward ratios let you be profitable even with 50% win rate.',
        category: 'risk',
        applicableWhen: ['trade-planning']
    },
    {
        id: 'market-conditions',
        title: 'Adapt to Market Conditions',
        content: 'Indicators behave differently in trending vs ranging markets. In trends, use trend-following indicators (MA, MACD). In range-bound markets, use oscillators (RSI, Stochastic). Identify the market condition first.',
        category: 'general',
        applicableWhen: ['always']
    },
    {
        id: 'news-events',
        title: 'Be Aware of News & Events',
        content: 'Technical analysis doesn\'t account for breaking news or earnings reports. Major news can override technical signals. Before major events (earnings, economic data), consider reducing position size or taking profits.',
        category: 'risk',
        applicableWhen: ['always']
    },
    {
        id: 'emotional-discipline',
        title: 'Maintain Emotional Discipline',
        content: 'Fear and greed are the enemies of good trading. Stick to your plan: set stop-losses and profit targets before entering, then execute without emotion. Don\'t chase runaway trends or panic sell on small dips. Let your strategy work.',
        category: 'general',
        applicableWhen: ['always']
    },
    {
        id: 'education-disclaimer',
        title: 'Educational Purpose Only',
        content: '⚠️ IMPORTANT: This analysis is for educational purposes only and NOT financial advice. Always do your own research, consult with qualified financial advisors, and never invest more than you can afford to lose. Past performance doesn\'t guarantee future results.',
        category: 'general',
        applicableWhen: ['always']
    }
];

/**
 * Get relevant tips based on current market conditions
 */
export function getRelevantTips(conditions: {
    rsi?: number;
    macdSignal?: 'bullish' | 'bearish' | 'neutral';
    volumeSpike?: boolean;
    patterns?: string[];
    trendStrength?: 'strong' | 'weak' | 'neutral';
    signalClarity?: 'clear' | 'mixed';
}): TradingTip[] {
    const relevantTips: TradingTip[] = [];

    // RSI-based tips
    if (conditions.rsi) {
        if (conditions.rsi > 70) {
            relevantTips.push(tradingTips.find(t => t.id === 'rsi-overbought')!);
        } else if (conditions.rsi < 30) {
            relevantTips.push(tradingTips.find(t => t.id === 'rsi-oversold')!);
        }
    }

    // MACD-based tips
    if (conditions.macdSignal === 'bullish') {
        relevantTips.push(tradingTips.find(t => t.id === 'macd-bullish-cross')!);
    } else if (conditions.macdSignal === 'bearish') {
        relevantTips.push(tradingTips.find(t => t.id === 'macd-bearish-cross')!);
    }

    // Volume-based tips
    if (conditions.volumeSpike) {
        relevantTips.push(tradingTips.find(t => t.id === 'volume-spike')!);
    }

    // Pattern-based tips
    if (conditions.patterns && conditions.patterns.length > 0) {
        if (conditions.patterns.some(p => p.includes('Engulfing'))) {
            relevantTips.push(tradingTips.find(t => t.id === 'engulfing-pattern')!);
        }
        if (conditions.patterns.some(p => p.includes('Doji'))) {
            relevantTips.push(tradingTips.find(t => t.id === 'doji-pattern')!);
        }
        if (conditions.patterns.some(p => p.includes('Star'))) {
            relevantTips.push(tradingTips.find(t => t.id === 'star-pattern')!);
        }
    }

    // Trend-based tips
    if (conditions.trendStrength === 'strong') {
        relevantTips.push(tradingTips.find(t => t.id === 'trailing-stop')!);
        relevantTips.push(tradingTips.find(t => t.id === 'trend-is-friend')!);
    }

    // General tips
    if (conditions.signalClarity === 'mixed') {
        relevantTips.push(tradingTips.find(t => t.id === 'wait-confirmation')!);
        relevantTips.push(tradingTips.find(t => t.id === 'position-sizing')!);
    }

    // Always include risk management and disclaimer
    relevantTips.push(tradingTips.find(t => t.id === 'risk-reward')!);
    relevantTips.push(tradingTips.find(t => t.id === 'education-disclaimer')!);

    // Remove duplicates and filter out undefined
    return Array.from(new Set(relevantTips)).filter(Boolean);
}

/**
 * Get tips by category
 */
export function getTipsByCategory(category: TradingTip['category']): TradingTip[] {
    return tradingTips.filter(t => t.category === category);
}

/**
 * Get random tip
 */
export function getRandomTip(): TradingTip {
    return tradingTips[Math.floor(Math.random() * tradingTips.length)];
}
