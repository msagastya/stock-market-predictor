import { MutualFund, Stock } from '@/types';
import { searchMutualFunds } from './amfi-india';
import { searchFallbackStocks } from './fallback-market-data';
import { searchKiteInstruments } from './kite-connect';
import { searchNSEStocks } from './nse-india';
import { searchYahooStocks } from './yahoo-finance';

const ENABLE_YAHOO_SEARCH = process.env.ENABLE_YAHOO_SEARCH === 'true';

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function scoreResult(item: Stock, query: string) {
  const normalizedQuery = query.trim().toUpperCase();
  const symbol = normalizeSymbol(item.symbol);
  const name = item.name.toUpperCase();

  let score = 0;
  if (symbol === normalizedQuery || symbol === `${normalizedQuery}.NS` || symbol === `${normalizedQuery}.BO`) score += 120;
  if (symbol.startsWith(normalizedQuery)) score += 80;
  if (name.startsWith(normalizedQuery)) score += 50;
  if (name.includes(normalizedQuery)) score += 30;
  if (item.provider === 'nse') score += 15;
  if (item.provider === 'kite') score += 12;
  if (item.assetType === 'stock') score += 10;
  if (item.assetType === 'index') score += 6;
  if (item.assetType === 'mutualfund') score -= 5;

  return score;
}

function dedupeResults(items: Stock[]) {
  const map = new Map<string, Stock>();

  for (const item of items) {
    const key = `${normalizeSymbol(item.symbol)}:${item.assetType || 'stock'}`;
    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }

    const existing = map.get(key)!;
    const preferred = (existing.provider === 'fallback' && item.provider !== 'fallback') ? item : existing;
    map.set(key, preferred);
  }

  return Array.from(map.values());
}

function mapFundsToSearchResults(funds: MutualFund[]): Stock[] {
  return funds.map((fund) => ({
    symbol: fund.symbol,
    name: fund.name,
    exchange: 'AMFI',
    price: fund.nav,
    change: 0,
    changePercent: 0,
    assetType: 'mutualfund',
    provider: 'amfi',
  }));
}

export async function searchMarketInstruments(query: string): Promise<Stock[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return searchFallbackStocks(trimmed).slice(0, 8);
  }

  const [kiteResults, nseResults, yahooResults, fallbackResults, fundResults] = await Promise.allSettled([
    searchKiteInstruments(trimmed, 10),
    searchNSEStocks(trimmed),
    ENABLE_YAHOO_SEARCH ? searchYahooStocks(trimmed) : Promise.resolve([]),
    Promise.resolve(searchFallbackStocks(trimmed)),
    trimmed.length >= 3 ? searchMutualFunds(trimmed, 6) : Promise.resolve([]),
  ]);

  const merged = dedupeResults([
    ...(kiteResults.status === 'fulfilled' ? kiteResults.value : []),
    ...(nseResults.status === 'fulfilled' ? nseResults.value : []),
    ...(yahooResults.status === 'fulfilled' ? yahooResults.value : []),
    ...(fallbackResults.status === 'fulfilled' ? fallbackResults.value : []),
    ...(fundResults.status === 'fulfilled' ? mapFundsToSearchResults(fundResults.value) : []),
  ] as Stock[]);

  return merged
    .sort((a, b) => scoreResult(b, trimmed) - scoreResult(a, trimmed))
    .slice(0, 12);
}
