// NSE India API Service (100% Free, Official Exchange Data)
import { OHLCV, Stock } from '@/types';

const NSE_BASE_URL = 'https://www.nseindia.com';

// NSE requires specific headers to prevent blocking
const NSE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
};

/**
 * Get NSE stock quote
 */
export async function getNSEQuote(symbol: string): Promise<Stock | null> {
    try {
        // NSE symbols should have no suffix for equity
        const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');

        const url = `${NSE_BASE_URL}/api/quote-equity?symbol=${encodeURIComponent(cleanSymbol)}`;
        const response = await fetch(url, { headers: NSE_HEADERS });
        const data = await response.json();

        if (!data.priceInfo) {
            return null;
        }

        const { priceInfo, info } = data;

        return {
            symbol: cleanSymbol + '.NS',
            name: info.companyName || cleanSymbol,
            exchange: 'NSE',
            price: priceInfo.lastPrice || 0,
            change: priceInfo.change || 0,
            changePercent: priceInfo.pChange || 0
        };
    } catch (error) {
        console.error('NSE quote error:', error);
        return null;
    }
}

/**
 * Search NSE stocks
 */
export async function searchNSEStocks(query: string): Promise<Stock[]> {
    try {
        const url = `${NSE_BASE_URL}/api/search/autocomplete?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, { headers: NSE_HEADERS });
        const data = await response.json();

        const stocks: Stock[] = (data.symbols || []).map((item: any) => ({
            symbol: item.symbol + '.NS',
            name: item.symbol_info || item.symbol,
            exchange: 'NSE',
            price: 0,
            change: 0,
            changePercent: 0,
            assetType: item.resultType?.toLowerCase().includes('index') ? 'index' : 'stock',
            provider: 'nse',
        }));

        return stocks;
    } catch (error) {
        console.error('NSE search error:', error);
        return [];
    }
}

/**
 * Get historical data from NSE
 * Note: NSE doesn't provide easy historical API, so we'll use a fallback approach
 * In production, you might want to cache this data or use Yahoo Finance for Indian stocks
 */
export async function getNSEHistoricalData(symbol: string, days: number = 365): Promise<OHLCV[]> {
    try {
        // For NSE stocks, we can use Yahoo Finance with .NS suffix
        const yahooSymbol = symbol.endsWith('.NS') ? symbol : symbol + '.NS';

        // Import Yahoo Finance function
        const { getYahooHistoricalData } = await import('./yahoo-finance');

        return await getYahooHistoricalData(yahooSymbol, '1y', '1d');
    } catch (error) {
        console.error('NSE historical data error:', error);
        return [];
    }
}

/**
 * Get NIFTY 50 index data
 */
export async function getNiftyIndexData(): Promise<{ value: number; change: number; changePercent: number } | null> {
    try {
        const url = `${NSE_BASE_URL}/api/allIndices`;
        const response = await fetch(url, { headers: NSE_HEADERS });
        const data = await response.json();

        const nifty50 = (data.data || []).find((index: any) => index.index === 'NIFTY 50');

        if (!nifty50) return null;

        return {
            value: nifty50.last || 0,
            change: nifty50.change || 0,
            changePercent: nifty50.percentChange || 0
        };
    } catch (error) {
        console.error('Nifty index error:', error);
        return null;
    }
}

/**
 * Get top gainers from NSE
 */
export async function getNSETopGainers(): Promise<Stock[]> {
    try {
        const url = `${NSE_BASE_URL}/api/live-analysis-variations?index=gainers`;
        const response = await fetch(url, { headers: NSE_HEADERS });
        const data = await response.json();

        const stocks: Stock[] = (data.NIFTY || []).slice(0, 10).map((item: any) => ({
            symbol: item.symbol + '.NS',
            name: item.symbol,
            exchange: 'NSE',
            price: item.lastPrice || 0,
            change: item.change || 0,
            changePercent: item.pChange || 0
        }));

        return stocks;
    } catch (error) {
        console.error('NSE top gainers error:', error);
        return [];
    }
}

/**
 * Get top losers from NSE
 */
export async function getNSETopLosers(): Promise<Stock[]> {
    try {
        const url = `${NSE_BASE_URL}/api/live-analysis-variations?index=losers`;
        const response = await fetch(url, { headers: NSE_HEADERS });
        const data = await response.json();

        const stocks: Stock[] = (data.NIFTY || []).slice(0, 10).map((item: any) => ({
            symbol: item.symbol + '.NS',
            name: item.symbol,
            exchange: 'NSE',
            price: item.lastPrice || 0,
            change: item.change || 0,
            changePercent: item.pChange || 0
        }));

        return stocks;
    } catch (error) {
        console.error('NSE top losers error:', error);
        return [];
    }
}
