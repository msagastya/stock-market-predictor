// Yahoo Finance API Service (using yahoo-finance2 for better reliability)
import yahooFinance from 'yahoo-finance2';
import { CompanyCalendar, CompanyProfile, NewsHeadline, OHLCV, PeerComparisonItem, QuoteSnapshot, Stock, YahooFinanceQuote } from '@/types';

class YahooUpstreamError extends Error {
    kind: 'rate_limit' | 'network' | 'upstream';

    constructor(message: string, kind: 'rate_limit' | 'network' | 'upstream') {
        super(message);
        this.kind = kind;
    }
}

function toYahooUpstreamError(error: unknown): YahooUpstreamError {
    const message = error instanceof Error ? error.message : String(error);
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('too many requests') || normalizedMessage.includes('invalid json response body')) {
        return new YahooUpstreamError('Yahoo Finance rate limited the request.', 'rate_limit');
    }

    if (normalizedMessage.includes('enotfound') || normalizedMessage.includes('fetcherror')) {
        return new YahooUpstreamError('Yahoo Finance is temporarily unreachable.', 'network');
    }

    return new YahooUpstreamError(message || 'Yahoo Finance request failed.', 'upstream');
}

export function isYahooRateLimitError(error: unknown): boolean {
    return error instanceof YahooUpstreamError && error.kind === 'rate_limit';
}


/**
 * Search for stocks on Yahoo Finance
 */
export async function searchYahooStocks(query: string): Promise<Stock[]> {
    try {
        const result = await yahooFinance.search(query) as any;

        const stocks: Stock[] = (result.quotes || [])
            .filter((quote: any) => quote.isYahooFinance) // Filter out non-standard results
            .map((quote: any) => ({
                symbol: quote.symbol,
                name: quote.longname || quote.shortname || quote.symbol,
                exchange: quote.exchDisp || 'Unknown',
                price: 0, // Search result doesn't always have price
                change: 0,
                changePercent: 0,
                assetType: quote.quoteType?.toLowerCase().includes('index') ? 'index' : 'stock',
                provider: 'yahoo',
            }));

        return stocks;
    } catch (error) {
        console.error('Yahoo Finance search error:', error);
        return [];
    }
}

/**
 * Get quote data for a symbol
 */
export async function getYahooQuote(symbol: string): Promise<YahooFinanceQuote | null> {
    try {
        const quote = await yahooFinance.quote(symbol) as any;

        if (!quote) {
            return null;
        }

        return {
            symbol: quote.symbol,
            name: quote.shortName || quote.longName || quote.symbol,
            regularMarketPrice: quote.regularMarketPrice || 0,
            regularMarketChange: quote.regularMarketChange || 0,
            regularMarketChangePercent: quote.regularMarketChangePercent || 0,
            marketCap: quote.marketCap || 0,
            trailingPE: quote.trailingPE || 0,
            epsTrailingTwelveMonths: quote.epsTrailingTwelveMonths || 0,
            beta: quote.beta || 0,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
            averageDailyVolume10Day: quote.averageDailyVolume10Day || 0,
            dividendYield: quote.dividendYield || 0,
            profitMargins: quote.profitMargins || 0,
            debtToEquity: quote.debtToEquity || 0,
            returnOnEquity: quote.returnOnEquity || 0,
            currency: quote.currency || 'USD',
            sector: quote.sector || undefined,
            industry: quote.industry || undefined
        };
    } catch (error) {
        console.error('Yahoo Finance quote error:', error);
        throw toYahooUpstreamError(error);
    }
}

export async function getYahooBatchQuotes(symbols: string[]): Promise<QuoteSnapshot[]> {
    if (symbols.length === 0) {
        return [];
    }

    try {
        const quotes = await yahooFinance.quote(symbols, { return: 'array' }) as any[];

        return quotes.map((quote) => ({
            symbol: quote.symbol,
            name: quote.shortName || quote.longName || quote.symbol,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            currency: quote.currency || 'USD',
            marketState: quote.marketState || undefined,
        }));
    } catch (error) {
        console.error('Yahoo Finance batch quote error:', error);
        throw toYahooUpstreamError(error);
    }
}

export async function getYahooNews(query: string, newsCount: number = 8): Promise<NewsHeadline[]> {
    try {
        const result = await yahooFinance.search(query, {
            quotesCount: 0,
            newsCount,
            enableFuzzyQuery: true,
        }) as any;

        return (result.news || []).map((item: any) => ({
            uuid: item.uuid,
            title: item.title,
            publisher: item.publisher,
            link: item.link,
            publishedAt: new Date(item.providerPublishTime).toISOString(),
            relatedTickers: item.relatedTickers || [],
            thumbnailUrl: item.thumbnail?.resolutions?.[0]?.url,
        }));
    } catch (error) {
        console.error('Yahoo Finance news error:', error);
        throw toYahooUpstreamError(error);
    }
}

export async function getYahooPeers(symbol: string): Promise<PeerComparisonItem[]> {
    try {
        const [summary, recommendations] = await Promise.all([
            yahooFinance.quoteSummary(symbol, {
                modules: ['assetProfile']
            }) as any,
            yahooFinance.recommendationsBySymbol(symbol) as any,
        ]);

        const recommendedSymbols = (recommendations?.recommendedSymbols || [])
            .map((item: any) => item.symbol)
            .filter((item: string) => item && item !== symbol)
            .slice(0, 6);

        let peerSymbols = recommendedSymbols;

        if (peerSymbols.length === 0) {
            const sector = summary?.assetProfile?.sector;
            const companyQuery = summary?.assetProfile?.industry || sector || symbol;
            const fallbackSearch = await yahooFinance.search(companyQuery, {
                quotesCount: 10,
                newsCount: 0,
                enableFuzzyQuery: true,
            }) as any;

            peerSymbols = (fallbackSearch.quotes || [])
                .filter((quote: any) => quote.isYahooFinance && quote.symbol !== symbol)
                .map((quote: any) => quote.symbol)
                .slice(0, 6);
        }

        if (peerSymbols.length === 0) {
            return [];
        }

        const quotes = await yahooFinance.quote(peerSymbols, { return: 'array' }) as any[];

        return quotes.map((quote: any) => ({
            symbol: quote.symbol,
            name: quote.shortName || quote.longName || quote.symbol,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            peRatio: quote.trailingPE ?? null,
            marketCap: quote.marketCap ?? null,
            currency: quote.currency || 'USD',
            sector: quote.sector || summary?.assetProfile?.sector || undefined,
            industry: quote.industry || summary?.assetProfile?.industry || undefined,
        }));
    } catch (error) {
        console.error('Yahoo Finance peer error:', error);
        throw toYahooUpstreamError(error);
    }
}

export async function getYahooResearchContext(symbol: string): Promise<{
    profile: CompanyProfile | null;
    calendar: CompanyCalendar | null;
}> {
    try {
        const summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['assetProfile', 'calendarEvents']
        }) as any;

        const assetProfile = summary?.assetProfile;
        const calendarEvents = summary?.calendarEvents;

        return {
            profile: assetProfile ? {
                sector: assetProfile.sector || undefined,
                industry: assetProfile.industry || undefined,
                website: assetProfile.website || undefined,
                country: assetProfile.country || undefined,
                fullTimeEmployees: assetProfile.fullTimeEmployees || undefined,
                longBusinessSummary: assetProfile.longBusinessSummary || undefined,
            } : null,
            calendar: calendarEvents ? {
                earningsDates: (calendarEvents.earnings?.earningsDate || []).map((date: Date) => new Date(date).toISOString()),
                exDividendDate: calendarEvents.exDividendDate ? new Date(calendarEvents.exDividendDate).toISOString() : undefined,
                dividendDate: calendarEvents.dividendDate ? new Date(calendarEvents.dividendDate).toISOString() : undefined,
            } : null,
        };
    } catch (error) {
        console.error('Yahoo Finance research context error:', error);
        throw toYahooUpstreamError(error);
    }
}

export async function getYahooTrendingQuotes(region: string = 'IN', count: number = 5): Promise<QuoteSnapshot[]> {
    try {
        const trending = await yahooFinance.trendingSymbols(region, { count }) as any;
        const symbols = (trending?.quotes || []).map((item: any) => item.symbol).filter(Boolean);
        return getYahooBatchQuotes(symbols.slice(0, count));
    } catch (error) {
        console.error('Yahoo Finance trending symbols error:', error);
        throw toYahooUpstreamError(error);
    }
}

export async function getYahooDailyGainers(count: number = 5): Promise<QuoteSnapshot[]> {
    try {
        const result = await yahooFinance.dailyGainers({ count }) as any;
        return (result?.quotes || []).slice(0, count).map((quote: any) => ({
            symbol: quote.symbol,
            name: quote.shortName || quote.longName || quote.symbol,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            currency: quote.currency || 'USD',
            marketState: quote.marketState || undefined,
        }));
    } catch (error) {
        console.error('Yahoo Finance daily gainers error:', error);
        throw toYahooUpstreamError(error);
    }
}


function calculateStartDate(period: string): Date {
    const now = new Date();
    const date = new Date(now);

    switch (period) {
        case '1d':
            // Look back 3 days to ensure we get the last trading session even on Mondays/Weekends
            date.setDate(now.getDate() - 3);
            break;
        case '5d':
            // Look back 8 days to cover weekends within the 5 trading days
            date.setDate(now.getDate() - 8);
            break;
        case '1mo':
            date.setDate(now.getDate() - 35); // Buffer for 1 month
            break;
        case '3mo':
            date.setDate(now.getDate() - 95); // Buffer
            break;
        case '6mo':
            date.setDate(now.getDate() - 185);
            break;
        case '1y':
            date.setFullYear(now.getFullYear() - 1);
            date.setDate(date.getDate() - 5); // Small buffer
            break;
        case '5y':
            date.setFullYear(now.getFullYear() - 5);
            date.setDate(date.getDate() - 10);
            break;
        case 'max':
            date.setFullYear(now.getFullYear() - 20);
            break;
        default:
            date.setFullYear(now.getFullYear() - 1);
    }
    return date;
}

/**
 * Get historical OHLCV data
 */
export async function getYahooHistoricalData(
    symbol: string,
    period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max' = '1y',
    interval: '1d' | '1wk' | '1mo' | '5m' | '15m' | '30m' | '60m' | '1h' = '1d'
): Promise<OHLCV[]> {
    try {
        const startDate = calculateStartDate(period);

        // yahoo-finance2 chart API requires period1 (start date)
        const result = await yahooFinance.chart(symbol, {
            period1: startDate,
            interval: interval as any
        }) as any;

        if (!result || !result.quotes || result.quotes.length === 0) {
            return [];
        }

        // Determine if we need Unix timestamps (for intraday) or date strings (for daily+)
        const intradayIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'];
        const useUnixTime = intradayIntervals.includes(interval);

        // Use Map to deduplicate by timestamp (keeps last occurrence)
        const timeMap = new Map<string | number, OHLCV>();

        for (const quote of result.quotes) {
            // Skip if any required value is null
            if (
                !quote.date ||
                quote.open === null ||
                quote.high === null ||
                quote.low === null ||
                quote.close === null ||
                quote.volume === null
            ) {
                continue;
            }

            // Convert timestamp based on interval type
            const timestamp = useUnixTime
                ? Math.floor(new Date(quote.date).getTime() / 1000) // Unix timestamp in seconds
                : new Date(quote.date).toISOString().split('T')[0]; // Date string YYYY-MM-DD

            // Store in map (automatically deduplicates)
            timeMap.set(timestamp, {
                time: timestamp as any, // Will be either number or string
                open: quote.open,
                high: quote.high,
                low: quote.low,
                close: quote.close,
                volume: quote.volume
            });
        }

        // Convert map to array and sort by time ascending
        const ohlcv = Array.from(timeMap.values()).sort((a, b) => {
            if (typeof a.time === 'number' && typeof b.time === 'number') {
                return a.time - b.time;
            }
            return String(a.time).localeCompare(String(b.time));
        });

        return ohlcv;
    } catch (error) {
        console.error('Yahoo Finance historical data error:', error);
        throw toYahooUpstreamError(error);
    }
}

/**
 * Map user timeframe to Yahoo Finance period
 */
export function mapTimeframeToYahooPeriod(timeframe: string): { period: string; interval: string } {
    switch (timeframe) {
        case '1D':
            return { period: '1d', interval: '5m' }; // 5m is better for 1d chart
        case '1W':
            return { period: '5d', interval: '15m' };
        case '1M':
            return { period: '1mo', interval: '1d' };
        case '3M':
            return { period: '3mo', interval: '1d' };
        case '6M':
            return { period: '6mo', interval: '1d' };
        case '1Y':
            return { period: '1y', interval: '1d' };
        case '5Y':
            return { period: '5y', interval: '1wk' };
        case 'MAX':
            return { period: 'max', interval: '1mo' };
        default:
            return { period: '1y', interval: '1d' };
    }
}
