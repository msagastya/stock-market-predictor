import { NextRequest, NextResponse } from 'next/server';
import { getYahooHistoricalData, getYahooQuote, getYahooResearchContext, isYahooRateLimitError, mapTimeframeToYahooPeriod } from '@/lib/api/yahoo-finance';
import { cachedFetch } from '@/lib/api/cache-manager';
import { buildSyntheticFundHistory, getFallbackStockPayload } from '@/lib/api/fallback-market-data';
import { getMutualFundByCode } from '@/lib/api/amfi-india';

const ENABLE_YAHOO_RESEARCH = process.env.ENABLE_YAHOO_RESEARCH === 'true';
const ENABLE_SYNTHETIC_ANALYSIS = process.env.ENABLE_SYNTHETIC_ANALYSIS === 'true';

function isIndianSymbol(symbol: string) {
    return symbol.endsWith('.NS')
        || symbol.endsWith('.BO')
        || symbol === '^NSEI'
        || symbol === '^BSESN'
        || symbol === '^NSEBANK'
        || symbol.includes('NIFTY');
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const period = searchParams.get('period') || '1y';

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    if (isIndianSymbol(symbol) && !ENABLE_YAHOO_RESEARCH && ENABLE_SYNTHETIC_ANALYSIS) {
        return NextResponse.json(getFallbackStockPayload(symbol, period));
    }

    if (isIndianSymbol(symbol) && !ENABLE_YAHOO_RESEARCH && !ENABLE_SYNTHETIC_ANALYSIS) {
        return NextResponse.json({
            error: 'Live Indian market analysis is unavailable because no production-grade data source is configured. Enable a real provider or explicitly opt into synthetic fallback.',
            code: 'LIVE_DATA_UNAVAILABLE',
        }, { status: 503 });
    }

    if (/^\d{4,}$/.test(symbol)) {
        const fund = await cachedFetch(`amfi-fund-${symbol}`, async () => getMutualFundByCode(symbol), 60);

        if (!fund) {
            return NextResponse.json({ error: 'Mutual fund not found' }, { status: 404 });
        }

        const historical = buildSyntheticFundHistory(fund.nav, period === '5y' ? 520 : period === '1y' ? 260 : 120);
        const quote = {
            regularMarketPrice: fund.nav,
            regularMarketChange: 0,
            regularMarketChangePercent: 0,
        };

        return NextResponse.json({
            quote,
            historical,
            symbol,
            currency: 'INR',
            profile: {
                sector: 'Mutual Fund',
                industry: fund.category,
                country: 'India',
                longBusinessSummary: `${fund.name} data is sourced from AMFI. Historical candles are synthetic placeholders until a full NAV history source is connected.`,
            },
            calendar: null,
            fundamentals: {
                marketCap: 0,
                peRatio: 0,
                eps: 0,
                beta: 0,
                fiftyTwoWeekHigh: Math.max(...historical.map((item) => item.high)),
                fiftyTwoWeekLow: Math.min(...historical.map((item) => item.low)),
                avgVolume: 0,
                dividendYield: 0,
                profitMargin: 0,
                debtToEquity: 0,
                roe: 0,
            },
            dataSource: 'amfi',
            warning: 'Mutual fund quote is live from AMFI. Historical candles are synthetic until NAV history support is added.',
        });
    }

    try {
        // Determine correct interval for the period
        const { period: yahooPeriod, interval } = mapTimeframeToYahooPeriod(period.toUpperCase());

        // Use cachedFetch to prevent rate limiting
        // Cache for 5 minutes
        const cacheKey = `stock-data-${symbol}-${yahooPeriod}`;

        const data = await cachedFetch(cacheKey, async () => {
            // Fetch both quote and historical data
            const [quote, historical, researchContext] = await Promise.all([
                getYahooQuote(symbol),
                getYahooHistoricalData(symbol, yahooPeriod as any, interval as any),
                getYahooResearchContext(symbol)
            ]);

            if (!quote || historical.length === 0) {
                return null;
            }

            // Detect if it's an Indian stock
            const isIndianStock = symbol.endsWith('.NS') || symbol.endsWith('.BO') || symbol === '^NSEI' || symbol === '^BSESN';
            const currency = isIndianStock ? 'INR' : (quote.currency || 'USD');

            return {
                quote,
                historical,
                symbol,
                currency,
                profile: researchContext.profile,
                calendar: researchContext.calendar,
                fundamentals: {
                    // All properties are defined in YahooQuote interface (src/types/index.ts)
                    marketCap: quote.marketCap || 0,
                    peRatio: quote.trailingPE || 0,
                    eps: quote.epsTrailingTwelveMonths || 0,
                    beta: quote.beta || 0,
                    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
                    fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
                    avgVolume: quote.averageDailyVolume10Day || 0,
                    dividendYield: quote.dividendYield ? quote.dividendYield * 100 : 0,
                    profitMargin: quote.profitMargins ? quote.profitMargins * 100 : 0,
                    debtToEquity: quote.debtToEquity || 0,
                    roe: quote.returnOnEquity ? quote.returnOnEquity * 100 : 0
                }
            };
        }, 5); // 5 minutes cache TTL

        if (!data) {
            return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching stock data:', error);
        if (isYahooRateLimitError(error) && ENABLE_SYNTHETIC_ANALYSIS) {
            const fallback = getFallbackStockPayload(symbol, period);
            return NextResponse.json(
                fallback,
                { status: 200 }
            );
        }

        if (isYahooRateLimitError(error)) {
            return NextResponse.json({
                error: 'Live market data is being rate limited upstream. No synthetic analysis is being shown.',
                code: 'UPSTREAM_RATE_LIMITED',
            }, { status: 503 });
        }

        return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
    }
}
