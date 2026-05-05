import { AutomatedAnalysis, OHLCV, Recommendation, TechnicalIndicators } from '@/types';
import { SupportResistanceLevel, getCurrentSupportResistance } from './support-resistance';

function classifyRegime(indicators: TechnicalIndicators, priceChangePercent: number, supportResistance: SupportResistanceLevel[]): AutomatedAnalysis['marketRegime'] {
  const strongTrend = indicators.adx >= 25 && Math.abs(priceChangePercent) >= 4;
  const highVolatility = indicators.atr > 0 && indicators.atr / Math.max(1, supportResistance[0]?.price || 1) > 0.04;
  const denseLevels = supportResistance.length >= 6;

  if (highVolatility) {
    return 'volatile';
  }

  if (strongTrend) {
    return 'trending';
  }

  if (denseLevels) {
    return 'range-bound';
  }

  return 'breakout-watch';
}

function buildScorecard(indicators: TechnicalIndicators, recommendation: Recommendation, priceChangePercent: number) {
  return [
    {
      label: 'Trend',
      value: indicators.trend.mediumTerm,
      tone: indicators.trend.mediumTerm === 'bullish' ? 'positive' : indicators.trend.mediumTerm === 'bearish' ? 'negative' : 'neutral',
    },
    {
      label: 'Momentum',
      value: `${indicators.momentum.oneMonth >= 0 ? '+' : ''}${indicators.momentum.oneMonth.toFixed(1)}%`,
      tone: indicators.momentum.oneMonth > 0 ? 'positive' : indicators.momentum.oneMonth < 0 ? 'negative' : 'neutral',
    },
    {
      label: 'Strength',
      value: `ADX ${indicators.adx.toFixed(1)}`,
      tone: indicators.adx >= 25 ? 'positive' : 'neutral',
    },
    {
      label: 'Bias',
      value: recommendation.rating,
      tone: recommendation.score > 0 ? 'positive' : recommendation.score < 0 ? 'negative' : 'neutral',
    },
    {
      label: 'Session',
      value: `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
      tone: priceChangePercent > 0 ? 'positive' : priceChangePercent < 0 ? 'negative' : 'neutral',
    },
  ] as AutomatedAnalysis['scorecard'];
}

function getDirectionalTarget(currentPrice: number, levels: SupportResistanceLevel[], direction: 'up' | 'down') {
  const candidates = levels
    .filter((level) => direction === 'up' ? level.type === 'resistance' && level.price > currentPrice : level.type === 'support' && level.price < currentPrice)
    .sort((a, b) => direction === 'up' ? a.price - b.price : b.price - a.price);

  return candidates[0]?.price;
}

export function generateAutomatedAnalysis(
  ohlcv: OHLCV[],
  indicators: TechnicalIndicators,
  recommendation: Recommendation,
  supportResistance: SupportResistanceLevel[],
  currency: string
): AutomatedAnalysis {
  const currentPrice = ohlcv[ohlcv.length - 1]?.close || 0;
  const openingPrice = ohlcv[0]?.close || currentPrice || 1;
  const priceChangePercent = openingPrice ? ((currentPrice - openingPrice) / openingPrice) * 100 : 0;
  const nearestLevels = getCurrentSupportResistance(ohlcv, currentPrice);
  const regime = classifyRegime(indicators, priceChangePercent, supportResistance);
  const priceSymbol = currency === 'INR' ? '₹' : '$';
  const nearestSupport = nearestLevels.nearestSupport?.price;
  const nearestResistance = nearestLevels.nearestResistance?.price;

  const bullishStop = nearestSupport ? `${priceSymbol}${nearestSupport.toFixed(2)}` : 'Recent swing low';
  const bullishTarget = nearestResistance ? `${priceSymbol}${nearestResistance.toFixed(2)}` : `${priceSymbol}${(currentPrice + indicators.atr * 2).toFixed(2)}`;
  const bearishStop = nearestResistance ? `${priceSymbol}${nearestResistance.toFixed(2)}` : 'Recent swing high';
  const bearishTarget = nearestSupport ? `${priceSymbol}${nearestSupport.toFixed(2)}` : `${priceSymbol}${Math.max(0, currentPrice - indicators.atr * 2).toFixed(2)}`;

  const trendSummary = `Short term is ${indicators.trend.shortTerm}, medium term is ${indicators.trend.mediumTerm}, and long term is ${indicators.trend.longTerm}. ADX at ${indicators.adx.toFixed(1)} suggests ${indicators.adx >= 25 ? 'trend participation' : 'limited trend strength'}.`;
  const momentumSummary = `RSI ${indicators.rsi.toFixed(1)}, Stochastic ${indicators.stochastic.k.toFixed(1)}, MFI ${indicators.mfi.toFixed(1)}, and 1M momentum ${indicators.momentum.oneMonth.toFixed(1)}% point to ${recommendation.score > 0 ? 'buyers controlling momentum' : recommendation.score < 0 ? 'sellers controlling momentum' : 'mixed momentum conditions'}.`;
  const levelSummary = nearestSupport && nearestResistance
    ? `Nearest support is near ${priceSymbol}${nearestSupport.toFixed(2)} and nearest resistance is near ${priceSymbol}${nearestResistance.toFixed(2)}. Price is ${currentPrice > nearestResistance ? 'attempting a breakout' : currentPrice < nearestSupport ? 'slipping below support' : 'still trading between key levels'}.`
    : 'Support and resistance zones are still developing, so recent swing structure matters more than static levels.';
  const riskSummary = `ATR is ${indicators.atr.toFixed(2)}, volume is running at ${indicators.volume.ratio.toFixed(2)}x normal, and the current regime is ${regime}. Position sizing should respect higher volatility when ATR expands or when price approaches major levels.`;

  const bullishTargetLevel = getDirectionalTarget(currentPrice, supportResistance, 'up');
  const bearishTargetLevel = getDirectionalTarget(currentPrice, supportResistance, 'down');
  const bullishRR = nearestSupport && bullishTargetLevel
    ? ((bullishTargetLevel - currentPrice) / Math.max(0.01, currentPrice - nearestSupport)).toFixed(2)
    : '1.50';
  const bearishRR = nearestResistance && bearishTargetLevel
    ? ((currentPrice - bearishTargetLevel) / Math.max(0.01, nearestResistance - currentPrice)).toFixed(2)
    : '1.40';

  const setups: AutomatedAnalysis['setups'] = [
    {
      title: 'Trend Continuation',
      bias: recommendation.score >= 0 ? 'bullish' : 'neutral',
      confidence: recommendation.score >= 2 && indicators.adx >= 20 ? 'high' : recommendation.score >= 1 ? 'medium' : 'low',
      entry: `Sustained move above ${priceSymbol}${(nearestResistance || currentPrice).toFixed(2)}`,
      stopLoss: bullishStop,
      target: bullishTargetLevel ? `${priceSymbol}${bullishTargetLevel.toFixed(2)}` : bullishTarget,
      riskReward: `${bullishRR}:1`,
      rationale: 'Use when price is above short-term averages, MACD is positive, and volume supports the move.',
    },
    {
      title: 'Pullback Into Support',
      bias: indicators.trend.mediumTerm === 'bullish' ? 'bullish' : 'neutral',
      confidence: indicators.trend.mediumTerm === 'bullish' && indicators.rsi > 45 ? 'medium' : 'low',
      entry: nearestSupport ? `Buy reaction near ${priceSymbol}${nearestSupport.toFixed(2)}` : 'Buy higher low near support cluster',
      stopLoss: nearestSupport ? `${priceSymbol}${Math.max(0, nearestSupport - indicators.atr).toFixed(2)}` : 'Below swing low',
      target: nearestResistance ? `${priceSymbol}${nearestResistance.toFixed(2)}` : bullishTarget,
      riskReward: '1.80:1',
      rationale: 'Prefer when the broader trend stays positive but price retraces into demand with muted downside momentum.',
    },
    {
      title: 'Breakdown / Failed Bounce',
      bias: recommendation.score <= 0 ? 'bearish' : 'neutral',
      confidence: recommendation.score <= -2 || indicators.rsi < 45 ? 'medium' : 'low',
      entry: nearestSupport ? `Sell close below ${priceSymbol}${nearestSupport.toFixed(2)}` : 'Sell failed retest of support',
      stopLoss: bearishStop,
      target: bearishTargetLevel ? `${priceSymbol}${bearishTargetLevel.toFixed(2)}` : bearishTarget,
      riskReward: `${bearishRR}:1`,
      rationale: 'Use when price loses support, MACD weakens, and rallies fail below resistance.',
    },
  ];

  const strategicSummary =
    recommendation.score >= 2
      ? 'Momentum and structure are aligned. The primary focus should be breakout continuation and disciplined pullback entries.'
      : recommendation.score <= -2
        ? 'Weak structure and bearish pressure dominate. Defensive positioning and failed-bounce shorts deserve more attention than aggressive dip buying.'
        : 'The market is not giving a clean directional edge yet. Favor level-based trades, smaller size, and confirmation before entry.';

  return {
    marketRegime: regime,
    trendSummary,
    momentumSummary,
    levelSummary,
    riskSummary,
    strategicSummary,
    scorecard: buildScorecard(indicators, recommendation, priceChangePercent),
    setups,
  };
}
