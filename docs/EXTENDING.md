# Extending the Stock Market Analyzer

This guide shows you how to extend and customize the analyzer with new features, markets, and indicators.

## Adding New Technical Indicators

### Step 1: Implement the Indicator

Create a new function in `src/lib/analysis/technical-indicators.ts`:

```typescript
/**
 * Stochastic Oscillator
 */
export function calculateStochastic(
  ohlcv: OHLCV[],
  period: number = 14
): { k: number; d: number } {
  if (ohlcv.length < period) return { k: 50, d: 50 };
  
  const slice = ohlcv.slice(-period);
  const currentClose = ohlcv[ohlcv.length - 1].close;
  
  const highestHigh = Math.max(...slice.map(c => c.high));
  const lowestLow = Math.min(...slice.map(c => c.low));
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  
  // Calculate %D (3-period SMA of %K) - simplified here
  const d = k; // Would need multiple K values for proper D
  
  return { k, d };
}
```

### Step 2: Add to Type Definitions

Update `src/types/index.ts`:

```typescript
export interface TechnicalIndicators {
  // ... existing fields
  stochastic?: {
    k: number;
    d: number;
  };
}
```

### Step 3: Include in Calculations

Update `calculateAllIndicators()` to include your new indicator.

### Step 4: Create Trading Signal

In `src/lib/analysis/signal-scorer.ts`:

```typescript
function getStochasticSignal(stochastic: { k: number; d: number }): TradingSignal {
  if (stochastic.k > 80) {
    return {
      indicator: 'Stochastic',
      signal: -1,
      confidence: 'medium',
      reason: 'Overbought on Stochastic'
    };
  } else if (stochastic.k < 20) {
    return {
      indicator: 'Stochastic',
      signal: 1,
      confidence: 'medium',
      reason: 'Oversold on Stochastic'
    };
  }
  return { indicator: 'Stochastic', signal: 0, confidence: 'low', reason: 'Neutral' };
}
```

### Step 5: Add to UI

Display the indicator in your component:

```typescript
<div className="p-4 rounded-lg bg-blue-100">
  <div className="text-xs text-muted-foreground">Stochastic %K</div>
  <div className="text-2xl font-bold">{indicators.stochastic?.k.toFixed(1)}</div>
</div>
```

## Adding New Candlestick Patterns

### Example: Three White Soldiers

In `src/lib/analysis/candlestick-detector.ts`:

```typescript
function detectThreeWhiteSoldiers(
  first: OHLCV,
  second: OHLCV,
  third: OHLCV
): CandlestickPattern | null {
  // All three candles must be bullish
  if (!isBullish(first) || !isBullish(second) || !isBullish(third)) {
    return null;
  }
  
  // Each close higher than previous
  if (second.close <= first.close || third.close <= second.close) {
    return null;
  }
  
  // Each open within previous candle's body
  if (second.open < first.open || third.open < second.open) {
    return null;
  }
  
  return {
    name: 'Three White Soldiers',
    type: 'bullish',
    confidence: 'high',
    signal: 3,
    description: 'Strong bullish continuation pattern',
    index: 2
  };
}
```

Add to detection logic in `detectCandlestickPatterns()`.

## Adding New Markets

### Cryptocurrency Support

```typescript
// src/lib/api/coingecko.ts

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export async function getCryptoPrice(coinId: string): Promise<number> {
  const url = `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=inr`;
  const response = await fetch(url);
  const data = await response.json();
  return data[coinId]?.inr || 0;
}

export async function getCryptoOHLCV(
  coinId: string,
  days: number = 365
): Promise<OHLCV[]> {
  const url = `${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=inr&days=${days}`;
  const response = await fetch(url);
  const data = await response.json();
  
  return data.map((item: number[]) => ({
    time: new Date(item[0]).toISOString().split('T')[0],
    open: item[1],
    high: item[2],
    low: item[3],
    close: item[4],
    volume: 0 // CoinGecko OHLC doesn't include volume in this endpoint
  }));
}
```

### Forex Support

```typescript
// src/lib/api/forex.ts

const EXCHANGERATE_API = 'https://api.exchangerate-api.com/v4/latest';

export async function getForexRate(base: string, target: string): Promise<number> {
  const url = `${EXCHANGERATE_API}/${base}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.rates[target] || 0;
}
```

## Custom Trading Strategies

### Example: Mean Reversion Strategy

```typescript
// src/lib/strategies/mean-reversion.ts

import { OHLCV, TechnicalIndicators } from '@/types';

export function meanReversionSignal(
  ohlcv: OHLCV[],
  indicators: TechnicalIndicators
): { signal: number; reason: string } {
  const currentPrice = ohlcv[ohlcv.length - 1].close;
  const { bollingerBands, rsi } = indicators;
  
  // Buy when price near lower BB and RSI oversold
  if (currentPrice < bollingerBands.lower * 1.02 && rsi < 35) {
    return {
      signal: 2,
      reason: 'Mean reversion buy: Price at lower BB with oversold RSI'
    };
  }
  
  // Sell when price near upper BB and RSI overbought
  if (currentPrice > bollingerBands.upper * 0.98 && rsi > 65) {
    return {
      signal: -2,
      reason: 'Mean reversion sell: Price at upper BB with overbought RSI'
    };
  }
  
  return { signal: 0, reason: 'No mean reversion signal' };
}
```

Integrate this into your main signal scorer.

## Portfolio Features

### Track Multiple Positions

```typescript
// src/lib/portfolio/portfolio-manager.ts

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  buyPrice: number;
  buyDate: string;
  currentPrice?: number;
}

export class PortfolioManager {
  private positions: Position[] = [];
  
  addPosition(symbol: string, quantity: number, buyPrice: number): void {
    const position: Position = {
      id: Date.now().toString(),
      symbol,
      quantity,
      buyPrice,
      buyDate: new Date().toISOString()
    };
    this.positions.push(position);
    this.save();
  }
  
  calculatePnL(position: Position): number {
    if (!position.currentPrice) return 0;
    return (position.currentPrice - position.buyPrice) * position.quantity;
  }
  
  getTotalValue(): number {
    return this.positions.reduce((total, pos) => {
      return total + (pos.currentPrice || pos.buyPrice) * pos.quantity;
    }, 0);
  }
  
  private save(): void {
    localStorage.setItem('portfolio', JSON.stringify(this.positions));
  }
}
```

## Alerts & Notifications

### Price Alert System

```typescript
// src/lib/alerts/alert-manager.ts

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  triggered: boolean;
}

export class AlertManager {
  private alerts: PriceAlert[] = [];
  
  addAlert(symbol: string, targetPrice: number, condition: 'above' | 'below'): void {
    const alert: PriceAlert = {
      id: Date.now().toString(),
      symbol,
      targetPrice,
      condition,
      triggered: false
    };
    this.alerts.push(alert);
    this.save();
  }
  
  checkAlerts(symbol: string, currentPrice: number): PriceAlert[] {
    const triggered: PriceAlert[] = [];
    
    this.alerts.forEach(alert => {
      if (alert.symbol === symbol && !alert.triggered) {
        const shouldTrigger = alert.condition === 'above'
          ? currentPrice >= alert.targetPrice
          : currentPrice <= alert.targetPrice;
        
        if (shouldTrigger) {
          alert.triggered = true;
          triggered.push(alert);
        }
      }
    });
    
    this.save();
    return triggered;
  }
  
  private save(): void {
    localStorage.setItem('alerts', JSON.stringify(this.alerts));
  }
}
```

### Browser Notifications

```typescript
// Request permission
if ('Notification' in window) {
  Notification.requestPermission();
}

// Send notification
function sendNotification(title: string, body: string): void {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon.png'
    });
  }
}
```

## Backtesting Engine

### Simple Backtest Framework

```typescript
// src/lib/backtesting/backtest.ts

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
}

export function runBacktest(
  ohlcv: OHLCV[],
  strategy: (data: OHLCV[], index: number) => 'buy' | 'sell' | 'hold',
  initialCapital: number = 10000
): BacktestResult {
  let capital = initialCapital;
  let position: { shares: number; entryPrice: number } | null = null;
  let trades = { total: 0, wins: 0, losses: 0 };
  let maxCapital = initialCapital;
  let maxDrawdown = 0;
  
  for (let i = 50; i < ohlcv.length; i++) {
    const signal = strategy(ohlcv, i);
    const price = ohlcv[i].close;
    
    if (signal === 'buy' && !position) {
      // Enter position
      const shares = Math.floor(capital / price);
      position = { shares, entryPrice: price };
      capital -= shares * price;
    } else if (signal === 'sell' && position) {
      // Exit position
      capital += position.shares * price;
      trades.total++;
      
      if (price > position.entryPrice) {
        trades.wins++;
      } else {
        trades.losses++;
      }
      
      position = null;
      
      // Track drawdown
      if (capital > maxCapital) maxCapital = capital;
      const drawdown = (maxCapital - capital) / maxCapital;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }
  
  // Close any open position
  if (position) {
    capital += position.shares * ohlcv[ohlcv.length - 1].close;
  }
  
  return {
    totalTrades: trades.total,
    winningTrades: trades.wins,
    losingTrades: trades.losses,
    winRate: trades.wins / trades.total,
    totalReturn: ((capital - initialCapital) / initialCapital) * 100,
    maxDrawdown: maxDrawdown * 100
  };
}
```

## Export & Reporting

### PDF Report Generation

```bash
npm install jspdf
```

```typescript
import jsPDF from 'jspdf';

export function generatePDFReport(
  symbol: string,
  recommendation: Recommendation,
  indicators: TechnicalIndicators
): void {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text(`Analysis Report: ${symbol}`, 20, 20);
  
  doc.setFontSize(12);
  doc.text(`Recommendation: ${recommendation.rating}`, 20, 40);
  doc.text(`Confidence: ${recommendation.confidence}`, 20, 50);
  doc.text(`RSI: ${indicators.rsi.toFixed(2)}`, 20, 60);
  
  doc.save(`${symbol}-analysis.pdf`);
}
```

## Performance Optimization

### Web Workers for Heavy Calculations

```typescript
// src/workers/analysis.worker.ts

self.onmessage = (e: MessageEvent) => {
  const { ohlcv } = e.data;
  
  // Perform heavy calculations
  const indicators = calculateAllIndicators(ohlcv);
  const patterns = detectCandlestickPatterns(ohlcv);
  
  self.postMessage({ indicators, patterns });
};

// Usage
const worker = new Worker(new URL('./workers/analysis.worker.ts', import.meta.url));

worker.postMessage({ ohlcv: data });
worker.onmessage = (e) => {
  const { indicators, patterns } = e.data;
  setIndicators(indicators);
};
```

## Testing

### Unit Tests for Indicators

```typescript
// __tests__/indicators.test.ts

import { calculateSMA, calculateRSI } from '@/lib/analysis/technical-indicators';

describe('Technical Indicators', () => {
  test('SMA calculation', () => {
    const prices = [10, 11, 12, 13, 14];
    const sma = calculateSMA(prices, 5);
    expect(sma).toBe(12); // (10+11+12+13+14)/5 = 12
  });
  
  test('RSI overbought', () => {
    const prices = Array(20).fill(0).map((_, i) => 100 + i * 2);
    const rsi = calculateRSI(prices, 14);
    expect(rsi).toBeGreaterThan(70);
  });
});
```

---

**The architecture is designed to be modular and extensible. Start small, test thoroughly, and build incrementally!**
