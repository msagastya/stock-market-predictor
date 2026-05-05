// Core data types for the Stock Market Analyzer

export interface OHLCV {
  time: string | number; // Unix timestamp (seconds) for intraday, date string (YYYY-MM-DD) for daily+
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooFinanceQuote {
  symbol: string;
  name: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  marketCap?: number;
  trailingPE?: number;
  epsTrailingTwelveMonths?: number;
  beta?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageDailyVolume10Day?: number;
  dividendYield?: number;
  profitMargins?: number;
  debtToEquity?: number;
  returnOnEquity?: number;
  currency?: string;
  sector?: string;
  industry?: string;
}
export interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  assetType?: 'stock' | 'index' | 'mutualfund';
  provider?: 'yahoo' | 'nse' | 'bse' | 'amfi' | 'kite' | 'fallback';
}

export interface MutualFund {
  symbol: string;
  name: string;
  nav: number;
  category: string;
  aum: number;
  expense_ratio: number;
}

export interface CandlestickPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: 'low' | 'medium' | 'high';
  signal: number; // -3 to +3
  description: string;
  index: number; // Position in the data array
}

export interface TechnicalIndicators {
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  atr: number;
  rsi: number;
  stochastic: {
    k: number;
    d: number;
  };
  adx: number;
  cci: number;
  williamsR: number;
  obv: number;
  mfi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  volume: {
    current: number;
    average: number;
    ratio: number; // current / average
  };
  trend: {
    shortTerm: 'bullish' | 'bearish' | 'neutral';
    mediumTerm: 'bullish' | 'bearish' | 'neutral';
    longTerm: 'bullish' | 'bearish' | 'neutral';
  };
  momentum: {
    oneMonth: number;
    threeMonth: number;
  };
}

export interface VolumeAnalysis {
  isAbnormal: boolean;
  spike: number; // Multiple of average (e.g., 2x, 3x)
  interpretation: string;
  signal: number; // -3 to +3
}

export interface TradingSignal {
  indicator: string;
  signal: number; // -3 to +3
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}

export interface Recommendation {
  rating: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  score: number; // -3 to +3
  confidence: 'low' | 'medium' | 'high';
  signals: TradingSignal[];
  reasoning: string[];
  patterns: CandlestickPattern[];
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  type: 'stock' | 'mutualfund' | 'index';
  addedAt: string;
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'mutualfund';
  quantity: number;
  buyPrice: number;
  buyDate: string;
  currentPrice?: number;
}

export interface TradingTip {
  id: string;
  title: string;
  content: string;
  category: 'risk' | 'strategy' | 'pattern' | 'volume' | 'general';
  applicableWhen: string[]; // Conditions when this tip is relevant
}

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

export interface ChartData {
  ohlcv: OHLCV[];
  indicators: TechnicalIndicators[];
  patterns: CandlestickPattern[];
  volume: VolumeAnalysis[];
}

export interface StockFundamentals {
  marketCap: number;
  peRatio: number;
  eps: number;
  beta: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  avgVolume: number;
  dividendYield: number;
  profitMargin: number;
  debtToEquity: number;
  roe: number;
}

export interface CompanyProfile {
  sector?: string;
  industry?: string;
  website?: string;
  country?: string;
  fullTimeEmployees?: number;
  longBusinessSummary?: string;
}

export interface CompanyCalendar {
  earningsDates: string[];
  exDividendDate?: string;
  dividendDate?: string;
}

export interface NewsHeadline {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
  relatedTickers: string[];
  thumbnailUrl?: string;
}

export interface PeerComparisonItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  peRatio: number | null;
  marketCap: number | null;
  currency: string;
  sector?: string;
  industry?: string;
}

export interface QuoteSnapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState?: string;
  region?: string;
}

export interface StrategySetup {
  title: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: 'low' | 'medium' | 'high';
  entry: string;
  stopLoss: string;
  target: string;
  riskReward: string;
  rationale: string;
}

export interface AutomatedAnalysis {
  marketRegime: 'trending' | 'range-bound' | 'breakout-watch' | 'volatile';
  trendSummary: string;
  momentumSummary: string;
  levelSummary: string;
  riskSummary: string;
  strategicSummary: string;
  scorecard: Array<{
    label: string;
    value: string;
    tone: 'positive' | 'negative' | 'neutral';
  }>;
  setups: StrategySetup[];
}
