import { CompanyCalendar, CompanyProfile, OHLCV, QuoteSnapshot, Stock, StockFundamentals, YahooFinanceQuote } from '@/types';

type FallbackSymbol = {
  symbol: string;
  name: string;
  currency: 'INR' | 'USD';
  price: number;
  changePercent: number;
  exchange: string;
  sector?: string;
  industry?: string;
};

const FALLBACK_SYMBOLS: FallbackSymbol[] = [
  { symbol: '^NSEI', name: 'Nifty 50', currency: 'INR', price: 22485, changePercent: 0.82, exchange: 'NSE Index' },
  { symbol: '^NSEBANK', name: 'Nifty Bank', currency: 'INR', price: 48260, changePercent: 1.04, exchange: 'NSE Index' },
  { symbol: '^BSESN', name: 'Sensex', currency: 'INR', price: 73940, changePercent: 0.76, exchange: 'BSE Index' },
  { symbol: 'NIFTY_FIN_SERVICE.NS', name: 'Nifty Financial Services', currency: 'INR', price: 21890, changePercent: 0.68, exchange: 'NSE' },
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', currency: 'INR', price: 2948, changePercent: 1.15, exchange: 'NSE', sector: 'Energy', industry: 'Oil & Gas Refining' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services', currency: 'INR', price: 3925, changePercent: 0.62, exchange: 'NSE', sector: 'Technology', industry: 'IT Services' },
  { symbol: 'INFY.NS', name: 'Infosys', currency: 'INR', price: 1648, changePercent: -0.34, exchange: 'NSE', sector: 'Technology', industry: 'IT Services' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', currency: 'INR', price: 1582, changePercent: 0.55, exchange: 'NSE', sector: 'Financial Services', industry: 'Banks' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', currency: 'INR', price: 1098, changePercent: 0.91, exchange: 'NSE', sector: 'Financial Services', industry: 'Banks' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', currency: 'INR', price: 782, changePercent: 1.46, exchange: 'NSE', sector: 'Financial Services', industry: 'Banks' },
  { symbol: '^GSPC', name: 'S&P 500', currency: 'USD', price: 5230, changePercent: 0.41, exchange: 'INDEX' },
  { symbol: '^DJI', name: 'Dow Jones Industrial Average', currency: 'USD', price: 39860, changePercent: 0.27, exchange: 'INDEX' },
  { symbol: '^IXIC', name: 'Nasdaq Composite', currency: 'USD', price: 16480, changePercent: 0.58, exchange: 'INDEX' },
  { symbol: '^FTSE', name: 'FTSE 100', currency: 'USD', price: 7940, changePercent: 0.22, exchange: 'INDEX' },
  { symbol: '^N225', name: 'Nikkei 225', currency: 'USD', price: 40120, changePercent: -0.19, exchange: 'INDEX' },
  { symbol: '^HSI', name: 'Hang Seng', currency: 'USD', price: 16880, changePercent: -0.44, exchange: 'INDEX' },
];

function hashCode(input: string) {
  return input.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function getDefinition(symbol: string): FallbackSymbol {
  return FALLBACK_SYMBOLS.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase()) || {
    symbol,
    name: symbol,
    currency: symbol.endsWith('.NS') || symbol.includes('NSE') ? 'INR' : 'USD',
    price: symbol.endsWith('.NS') ? 1000 : 100,
    changePercent: 0.35,
    exchange: symbol.endsWith('.NS') ? 'NSE' : 'SIM',
  };
}

export function searchFallbackStocks(query: string): Stock[] {
  const normalized = query.trim().toUpperCase();

  return FALLBACK_SYMBOLS
    .filter((item) => item.symbol.toUpperCase().includes(normalized) || item.name.toUpperCase().includes(normalized))
    .slice(0, 8)
    .map((item) => ({
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchange,
      price: item.price,
      change: (item.price * item.changePercent) / 100,
      changePercent: item.changePercent,
      assetType: item.symbol.startsWith('^') ? 'index' : 'stock',
      provider: 'fallback',
    }));
}

export function getFallbackBatchQuotes(symbols: string[]): QuoteSnapshot[] {
  return symbols.map((symbol) => {
    const item = getDefinition(symbol);
    return {
      symbol: item.symbol,
      name: item.name,
      price: item.price,
      change: (item.price * item.changePercent) / 100,
      changePercent: item.changePercent,
      currency: item.currency,
      marketState: 'CLOSED',
      region: item.currency === 'INR' ? 'India' : 'Global',
    };
  });
}

function generateHistory(symbol: string, days = 260): OHLCV[] {
  const definition = getDefinition(symbol);
  const base = definition.price;
  const seed = hashCode(symbol);
  const trendBias = definition.changePercent >= 0 ? 1 : -1;
  const today = new Date();
  const items: OHLCV[] = [];
  let price = base * (1 - definition.changePercent / 100 * 0.7);

  for (let index = days; index >= 0; index--) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const wave = Math.sin((seed + index) / 9) * base * 0.008;
    const drift = trendBias * (days - index) * base * 0.00035;
    const close = Math.max(1, price + wave + drift);
    const open = close * (1 + Math.sin((seed + index) / 5) * 0.003);
    const high = Math.max(open, close) * 1.008;
    const low = Math.min(open, close) * 0.992;
    const volume = Math.round(800000 + (Math.cos((seed + index) / 6) + 1.2) * 450000);

    items.push({
      time: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return items;
}

export function getFallbackStockPayload(symbol: string, period: string) {
  const definition = getDefinition(symbol);
  const historical = generateHistory(symbol, period === '5y' ? 520 : period === '1y' ? 260 : period === '3m' ? 90 : 40);
  const latest = historical[historical.length - 1];
  const prev = historical[historical.length - 2] || latest;
  const regularMarketPrice = latest.close;
  const regularMarketChange = Number((latest.close - prev.close).toFixed(2));
  const regularMarketChangePercent = Number((((latest.close - prev.close) / prev.close) * 100).toFixed(2));

  const quote: YahooFinanceQuote = {
    symbol: definition.symbol,
    name: definition.name,
    regularMarketPrice,
    regularMarketChange,
    regularMarketChangePercent,
    marketCap: definition.currency === 'INR' ? 1_250_000_000_000 : 250_000_000_000,
    trailingPE: 24.8,
    epsTrailingTwelveMonths: 92.4,
    beta: 0.96,
    fiftyTwoWeekHigh: Math.max(...historical.map((item) => item.high)),
    fiftyTwoWeekLow: Math.min(...historical.map((item) => item.low)),
    averageDailyVolume10Day: Math.round(historical.slice(-10).reduce((sum, item) => sum + item.volume, 0) / 10),
    dividendYield: 0.012,
    profitMargins: 0.18,
    debtToEquity: 0.42,
    returnOnEquity: 0.16,
    currency: definition.currency,
    sector: definition.sector,
    industry: definition.industry,
  };

  const fundamentals: StockFundamentals = {
    marketCap: quote.marketCap || 0,
    peRatio: quote.trailingPE || 0,
    eps: quote.epsTrailingTwelveMonths || 0,
    beta: quote.beta || 0,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
    avgVolume: quote.averageDailyVolume10Day || 0,
    dividendYield: (quote.dividendYield || 0) * 100,
    profitMargin: (quote.profitMargins || 0) * 100,
    debtToEquity: quote.debtToEquity || 0,
    roe: (quote.returnOnEquity || 0) * 100,
  };

  const profile: CompanyProfile | null = definition.sector ? {
    sector: definition.sector,
    industry: definition.industry,
    country: definition.currency === 'INR' ? 'India' : 'United States',
    website: 'https://example.com',
    longBusinessSummary: `${definition.name} is being shown with bundled fallback market data because the live Yahoo Finance endpoint is rate limited right now.`,
  } : null;

  const calendar: CompanyCalendar | null = {
    earningsDates: [new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()],
  };

  return {
    quote,
    historical,
    symbol: definition.symbol,
    currency: definition.currency,
    profile,
    calendar,
    fundamentals,
    dataSource: 'fallback',
    warning: 'Live Yahoo Finance data is rate limited. Showing bundled fallback sample data.',
  };
}

export function buildSyntheticFundHistory(nav: number, days = 180): OHLCV[] {
  const today = new Date();
  const items: OHLCV[] = [];
  let price = nav * 0.94;

  for (let index = days; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const drift = (days - index) * nav * 0.00025;
    const oscillation = Math.sin(index / 11) * nav * 0.0025;
    const close = Math.max(0.1, price + drift + oscillation);
    const open = close * 0.999;
    const high = close * 1.002;
    const low = close * 0.998;

    items.push({
      time: date.toISOString().split('T')[0],
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: 100000,
    });

    price = close;
  }

  return items;
}
