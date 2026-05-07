import { NextRequest, NextResponse } from 'next/server';
import { cachedFetch } from '@/lib/api/cache-manager';
import { getYahooBatchQuotes, isYahooRateLimitError } from '@/lib/api/yahoo-finance';
import { getFallbackBatchQuotes } from '@/lib/api/fallback-market-data';
import { getNSEQuote } from '@/lib/api/nse-india';
import { getBSEQuote } from '@/lib/api/bse-india';

const ENABLE_SYNTHETIC_QUOTES = process.env.ENABLE_SYNTHETIC_QUOTES !== 'false';
const ENABLE_YAHOO_QUOTES = process.env.ENABLE_YAHOO_QUOTES !== 'false';
const ENABLE_NSE_QUOTES = process.env.ENABLE_NSE_QUOTES !== 'false';
const ENABLE_BSE_QUOTES = process.env.ENABLE_BSE_QUOTES !== 'false';

function isIndianSymbol(symbol: string) {
    return symbol.endsWith('.NS') || symbol.endsWith('.BO')
        || symbol === '^NSEI' || symbol === '^BSESN' || symbol === '^NSEBANK'
        || symbol.includes('NIFTY');
}

function isBSESymbol(symbol: string) {
    return symbol.endsWith('.BO');
}

/** Fetch a single quote trying NSE → BSE → Yahoo in order */
async function fetchSingleQuote(symbol: string): Promise<any | null> {
    const isIndian = isIndianSymbol(symbol);

    // NSE for Indian .NS stocks
    if (isIndian && !isBSESymbol(symbol) && ENABLE_NSE_QUOTES) {
        try {
            const q = await getNSEQuote(symbol);
            if (q && q.price > 0) {
                return {
                    symbol: q.symbol,
                    name: q.name,
                    price: q.price,
                    change: q.change,
                    changePercent: q.changePercent,
                    currency: 'INR',
                    source: 'nse',
                    open: q.open,
                    dayHigh: q.high,
                    dayLow: q.low,
                    previousClose: q.prevClose,
                    volume: q.volume,
                    fiftyTwoWeekHigh: q.yearHigh,
                    fiftyTwoWeekLow: q.yearLow,
                };
            }
        } catch { /* fall through */ }
    }

    // BSE for .BO symbols
    if (isBSESymbol(symbol) && ENABLE_BSE_QUOTES) {
        try {
            const q = await getBSEQuote(symbol);
            if (q && q.price > 0) {
                return {
                    symbol: q.symbol,
                    name: q.name,
                    price: q.price,
                    change: q.change,
                    changePercent: q.changePercent,
                    currency: 'INR',
                    source: 'bse',
                    previousClose: q.prevClose,
                    volume: q.volume,
                    fiftyTwoWeekHigh: q.yearHigh,
                    fiftyTwoWeekLow: q.yearLow,
                };
            }
        } catch { /* fall through */ }
    }

    return null; // Let batch Yahoo handle it
}

export async function GET(request: NextRequest) {
    const symbolsParam = request.nextUrl.searchParams.get('symbols');
    if (!symbolsParam) {
        return NextResponse.json({ error: 'symbols is required' }, { status: 400 });
    }

    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (symbols.length === 0) {
        return NextResponse.json({ error: 'At least one symbol is required' }, { status: 400 });
    }

    try {
        const cacheKey = `quotes-v2-${symbols.sort().join(',')}`;
        const quotes = await cachedFetch(cacheKey, async () => {
            // Try per-symbol NSE/BSE for Indian symbols
            const results: any[] = [];
            const needYahoo: string[] = [];

            await Promise.all(symbols.map(async (sym) => {
                if (isIndianSymbol(sym)) {
                    const q = await fetchSingleQuote(sym);
                    if (q) { results.push(q); return; }
                }
                needYahoo.push(sym);
            }));

            // Batch Yahoo for remaining symbols (or all if NSE/BSE failed)
            if (needYahoo.length > 0 && ENABLE_YAHOO_QUOTES) {
                try {
                    const yahooQuotes = await getYahooBatchQuotes(needYahoo);
                    results.push(...yahooQuotes.map(q => ({ ...q, source: 'yahoo' })));
                } catch (err) {
                    if (isYahooRateLimitError(err) && ENABLE_SYNTHETIC_QUOTES) {
                        const fallback = getFallbackBatchQuotes(needYahoo);
                        results.push(...fallback.map(q => ({ ...q, source: 'synthetic' })));
                    } else if (ENABLE_SYNTHETIC_QUOTES) {
                        const fallback = getFallbackBatchQuotes(needYahoo);
                        results.push(...fallback.map(q => ({ ...q, source: 'synthetic' })));
                    }
                    // else skip
                }
            } else if (needYahoo.length > 0 && ENABLE_SYNTHETIC_QUOTES) {
                const fallback = getFallbackBatchQuotes(needYahoo);
                results.push(...fallback.map(q => ({ ...q, source: 'synthetic' })));
            }

            return results;
        }, 2);

        return NextResponse.json({ quotes });
    } catch (error) {
        console.error('Quotes route error:', error);
        return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
    }
}
