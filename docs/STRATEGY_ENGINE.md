# Strategy Engine Documentation

## Overview

The Stock Market Analyzer uses a sophisticated multi-factor analysis engine that combines technical indicators, candlestick patterns, and volume analysis to generate actionable trading recommendations.

## Indicator Algorithms

### 1. Simple Moving Average (SMA)

**Formula:**
```
SMA(n) = (P1 + P2 + ... + Pn) / n
```

Where:
- `n` = period (e.g., 20, 50, 200 days)
- `P` = price (typically closing price)

**Usage:**
- Trend identification
- Support/resistance levels
- Golden Cross (SMA50 > SMA200) = bullish
- Death Cross (SMA50 < SMA200) = bearish

### 2. Exponential Moving Average (EMA)

**Formula:**
```
EMA(today) = (Price(today) × multiplier) + (EMA(yesterday) × (1 - multiplier))
multiplier = 2 / (period + 1)
```

**Usage:**
- Faster response to price changes than SMA
- MACD calculation
- Short-term trend detection

### 3. Relative Strength Index (RSI)

**Formula:**
```
RS = Average Gain / Average Loss (over n periods, typically 14)
RSI = 100 - (100 / (1 + RS))
```

**Interpretation:**
- RSI > 70: Overbought (potential reversal down)
- RSI < 30: Oversold (potential reversal up)
- RSI 50: Neutral

**Trading Signals:**
- Buy when RSI crosses above 30 from below
- Sell when RSI crosses below 70 from above
- Divergence: Price makes new high but RSI doesn't = bearish

### 4. MACD (Moving Average Convergence Divergence)

**Formula:**
```
MACD Line = EMA(12) - EMA(26)
Signal Line = EMA(9) of MACD Line
Histogram = MACD Line - Signal Line
```

**Interpretation:**
- MACD > 0: Bullish momentum
- MACD < 0: Bearish momentum
- Histogram > 0: Increasing bullish momentum
- Histogram < 0: Increasing bearish momentum

**Trading Signals:**
- Bullish crossover: MACD crosses above signal line
- Bearish crossover: MACD crosses below signal line
- Zero crossover: MACD crosses above/below zero line

### 5. Bollinger Bands

**Formula:**
```
Middle Band = SMA(20)
Upper Band = SMA(20) + (2 × Standard Deviation)
Lower Band = SMA(20) - (2 × Standard Deviation)
```

**Interpretation:**
- Price at upper band: Potentially overbought
- Price at lower band: Potentially oversold
- Band squeeze (narrow): Low volatility, potential breakout
- Band expansion: High volatility

**Trading Signals:**
- Buy when price touches lower band in uptrend
- Sell when price touches upper band in downtrend
- Breakout above upper band = strong bullish momentum

## Candlestick Pattern Detection

### Single-Candle Patterns

#### 1. Hammer (Bullish Reversal)
- **Conditions:**
  - Small body (< 30% of range)
  - Long lower shadow (> 2x body size)
  - Little/no upper shadow (< 30% of body)
- **Signal Strength:** +2
- **Confidence:** High if body < 20% of range

#### 2. Shooting Star (Bearish Reversal)
- **Conditions:**
  - Small body near the low
  - Long upper shadow (> 2x body)
  - Little/no lower shadow
- **Signal Strength:** -2
- **Confidence:** High

#### 3. Doji (Indecision)
- **Conditions:**
  - Very small body (< 10% of total range)
- **Variants:**
  - Dragonfly (long lower shadow): Bullish (+1)
  - Gravestone (long upper shadow): Bearish (-1)
  - Standard: Neutral (0)

### Two-Candle Patterns

#### 4. Bullish Engulfing
- **Conditions:**
  - Previous candle: bearish
  - Current candle: bullish
  - Current body completely engulfs previous body
- **Signal Strength:** +3
- **Confidence:** High

#### 5. Bearish Engulfing
- **Conditions:**
  - Previous candle: bullish
  - Current candle: bearish
  - Current body completely engulfs previous body
- **Signal Strength:** -3
- **Confidence:** High

### Three-Candle Patterns

#### 6. Morning Star (Bullish Reversal)
- **Conditions:**
  - First: Long bearish candle
  - Second: Small body (star)
  - Third: Long bullish candle closing above first candle's midpoint
- **Signal Strength:** +3
- **Confidence:** High

#### 7. Evening Star (Bearish Reversal)
- **Conditions:**
  - First: Long bullish candle
  - Second: Small body (star)
  - Third: Long bearish candle closing below first candle's midpoint
- **Signal Strength:** -3
- **Confidence:** High

## Volume Analysis

### Volume Spike Detection
```
Volume Spike = Current Volume / Average Volume (20 periods)
```

**Thresholds:**
- > 2x: Abnormal volume
- > 3x: Extreme volume (major event)

### Price-Volume Correlation

| Price Action | Volume | Interpretation | Signal |
|-------------|--------|----------------|--------|
| Rising | Increasing | Strong bullish trend | +2 |
| Rising | Decreasing | Weakening trend | -1 |
| Falling | Increasing | Strong bearish pressure | -2 |
| Falling | Decreasing | Selling exhaustion | 0 |

## Signal Scoring System

### Weighting

Each signal is assigned a weight based on confidence:
```
High confidence:   1.5x
Medium confidence: 1.0x
Low confidence:    0.5x
```

### Aggregation
```
Weighted Score = Σ(Signal × Confidence Weight) / Σ(Confidence Weights)
```

### Normalization

Final score is normalized to -3 to +3 scale:
- **+3 to +2**: Strong Buy
- **+1**: Buy
- **0**: Neutral
- **-1**: Sell
- **-2 to -3**: Strong Sell

### Confidence Calculation

```
Agreement Ratio = (Signals agreeing with final direction) / (Total signals)

High confidence:   ≥ 75% agreement
Medium confidence: 50-74% agreement
Low confidence:    < 50% agreement
```

## Recommendation Generation

### Step 1: Collect Signals
- RSI signal (-2 to +2)
- MACD signal (-2 to +2)
- Moving Average signal (-2 to +2)
- Bollinger Bands signal (-1 to +1)
- Volume signal (-2 to +2)
- Candlestick patterns (-3 to +3)

### Step 2: Apply Weights
Each signal is multiplied by its confidence weight

### Step 3: Calculate Score
```
Average Score = Total Weighted Score / Total Weight
Final Score = Round(clamp(Average Score, -3, 3))
```

### Step 4: Generate Reasoning
- List bullish factors
- List bearish factors
- Explain key insights
- State confidence level

## Example Calculation

**Given:**
- RSI = 28 (oversold) → Signal: +2, Confidence: Medium
- MACD histogram = -0.3 (bearish) → Signal: -1, Confidence: Medium
- Price above SMA20 → Signal: +1, Confidence: Low
- Volume spike 2.5x → Signal: +2, Confidence: High
- Bullish Engulfing pattern → Signal: +3, Confidence: High

**Calculation:**
```
Weighted scores:
RSI:     +2 × 1.0 = +2.0
MACD:    -1 × 1.0 = -1.0
MA:      +1 × 0.5 = +0.5
Volume:  +2 × 1.5 = +3.0
Pattern: +3 × 1.5 = +4.5

Total: +9.0
Total Weight: 5.5

Average: 9.0 / 5.5 = 1.64
Final Score: Round(1.64) = +2 (Strong Buy)

Agreement: 4/5 signals bullish = 80% (High confidence)
```

**Result:** Strong Buy with High Confidence

## Backtesting Methodology

(Future implementation)

- Test on historical data
- Calculate win rate
- Measure risk-adjusted returns
- Optimize parameters

## Limitations

1. **Lagging Indicators**: Most indicators use historical data
2. **Market Conditions**: Strategies work better in trending vs ranging markets
3. **News Events**: Technical analysis doesn't account for fundamental news
4. **False Signals**: No indicator is 100% accurate
5. **Overfitting Risk**: Historical optimization may not predict future

## Best Practices

1. **Combine Multiple Signals**: Never rely on a single indicator
2. **Confirm with Volume**: Volume validates price movements
3. **Use Stop Losses**: Always protect capital
4. **Risk Management**: Never risk more than 1-2% per trade
5. **Wait for Confirmation**: Don't act on preliminary signals

---

*This engine is designed for education and should not be used as the sole basis for trading decisions.*
