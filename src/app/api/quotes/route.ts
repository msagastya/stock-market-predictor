import { NextRequest, NextResponse } from 'next/server';
import { cachedFetch } from '@/lib/api/cache-manager';
import { getYahooBatchQuotes, isYahooRateLimitError } from '@/lib/api/yahoo-finance';
import { getFallbackBatchQuotes } from '@/lib/api/fallback-market-data';

const ENABLE_SYNTHETIC_QUOTES = process.env.ENABLE_SYNTHETIC_QUOTES === 'true';
const ENABLE_YAHOO_QUOTES = process.env.ENABLE_YAHOO_QUOTES === 'true';

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
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
        return NextResponse.json({ error: 'symbols is required' }, { status: 400 });
    }

    const symbols = symbolsParam
        .split(',')
        .map((symbol) => symbol.trim())
        .filter(Boolean);

    if (symbols.length === 0) {
        return NextResponse.json({ error: 'At least one symbol is required' }, { status: 400 });
    }

    const containsIndianSymbols = symbols.some(isIndianSymbol);

    if (containsIndianSymbols && !ENABLE_YAHOO_QUOTES && ENABLE_SYNTHETIC_QUOTES) {
        return NextResponse.json({
            quotes: getFallbackBatchQuotes(symbols),
            warning: 'No live quote provider is configured for these Indian symbols. Showing synthetic fallback quotes.',
        });
    }

    if (containsIndianSymbols && !ENABLE_YAHOO_QUOTES && !ENABLE_SYNTHETIC_QUOTES) {
        return NextResponse.json({
            quotes: [],
            error: 'No live Indian quote provider is configured. Yahoo quotes are disabled and synthetic quotes are disabled.',
            code: 'LIVE_QUOTES_UNAVAILABLE',
        }, { status: 503 });
    }

    try {
        const cacheKey = `quotes-${symbols.sort().join(',')}`;
        const quotes = await cachedFetch(cacheKey, async () => getYahooBatchQuotes(symbols), 2);
        return NextResponse.json({ quotes });
    } catch (error) {
        console.error('Error fetching quotes:', error);
        if (isYahooRateLimitError(error) && ENABLE_SYNTHETIC_QUOTES) {
            return NextResponse.json({
                quotes: getFallbackBatchQuotes(symbols),
                warning: 'Yahoo Finance rate limited the quote request. Showing fallback market data.',
            });
        }

        if (isYahooRateLimitError(error)) {
            return NextResponse.json({
                quotes: [],
                error: 'Live quotes are currently rate limited upstream. Synthetic quote fallback is disabled.',
                code: 'UPSTREAM_RATE_LIMITED',
            }, { status: 503 });
        }

        return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
    }
}
