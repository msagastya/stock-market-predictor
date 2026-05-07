// NSE India API — Free, Official Exchange Data
// NSE requires a browser-like session (cookies from homepage) for API calls.

const NSE_BASE = 'https://www.nseindia.com';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── Session management ───────────────────────────────────────────────────────

let cookieJar = '';
let cookieExpiry = 0;
let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
    if (refreshPromise) return refreshPromise; // deduplicate concurrent calls
    refreshPromise = (async () => {
        try {
            const res = await fetch(NSE_BASE + '/', {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            });
            const raw = res.headers.get('set-cookie') || '';
            cookieJar = raw.split(',').map(c => c.split(';')[0].trim()).join('; ');
            cookieExpiry = Date.now() + 4 * 60 * 1000; // refresh every 4 min
        } catch {
            // Session refresh failed — existing cookie may still work
        } finally {
            refreshPromise = null;
        }
    })();
    return refreshPromise;
}

/** Pre-warm the NSE session — call once before parallel API requests */
export async function initNSESession(): Promise<void> {
    if (Date.now() > cookieExpiry) await refreshSession();
}

async function nseHeaders(): Promise<Record<string, string>> {
    if (Date.now() > cookieExpiry) await refreshSession();
    return {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': NSE_BASE + '/',
        'Cookie': cookieJar,
    };
}

async function nseGet(path: string): Promise<any> {
    const headers = await nseHeaders();
    const res = await fetch(NSE_BASE + path, { headers });
    if (!res.ok) throw new Error(`NSE ${path} → HTTP ${res.status}`);
    return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface NSEQuote {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    open: number;
    high: number;
    low: number;
    prevClose: number;
    volume: number;
    totalBuyQty: number;
    totalSellQty: number;
    yearHigh: number;
    yearLow: number;
}

export async function getNSEQuote(symbol: string): Promise<NSEQuote | null> {
    try {
        const clean = symbol.replace(/\.(NS|BO)$/, '').toUpperCase();
        const data = await nseGet(`/api/quote-equity?symbol=${encodeURIComponent(clean)}`);
        const p = data.priceInfo;
        if (!p) return null;
        return {
            symbol: clean + '.NS',
            name: data.info?.companyName || clean,
            price: p.lastPrice ?? 0,
            change: p.change ?? 0,
            changePercent: p.pChange ?? 0,
            open: p.open ?? 0,
            high: p.intraDayHighLow?.max ?? 0,
            low: p.intraDayHighLow?.min ?? 0,
            prevClose: p.previousClose ?? 0,
            volume: data.marketDeptOrderBook?.tradeInfo?.totalTradedVolume ?? 0,
            totalBuyQty: data.marketDeptOrderBook?.totalBuyQuantity ?? 0,
            totalSellQty: data.marketDeptOrderBook?.totalSellQuantity ?? 0,
            yearHigh: data.priceInfo?.weekHighLow?.max ?? 0,
            yearLow: data.priceInfo?.weekHighLow?.min ?? 0,
        };
    } catch {
        return null;
    }
}

export interface NSEIndex {
    name: string;
    value: number;
    change: number;
    changePercent: number;
    open: number;
    high: number;
    low: number;
    prevClose: number;
    yearHigh: number;
    yearLow: number;
    advances: number;
    declines: number;
}

export async function getNSEAllIndices(): Promise<NSEIndex[]> {
    try {
        const data = await nseGet('/api/allIndices');
        return (data.data || []).map((d: any): NSEIndex => ({
            name: d.index || d.indexSymbol,
            value: d.last ?? 0,
            change: d.change ?? 0,
            changePercent: d.percentChange ?? 0,
            open: d.open ?? 0,
            high: d.high ?? 0,
            low: d.low ?? 0,
            prevClose: d.previousClose ?? 0,
            yearHigh: d['52wkHigh'] ?? 0,
            yearLow: d['52wkLow'] ?? 0,
            advances: d.advances ?? 0,
            declines: d.declines ?? 0,
        }));
    } catch {
        return [];
    }
}

function extractNSEMovers(data: any, index: string): any[] {
    const bucket = data[index] || data.NIFTY || {};
    // NSE wraps in {data: [...]} or returns array directly
    return Array.isArray(bucket) ? bucket : (bucket.data || []);
}

export async function getNSETopGainers(index = 'NIFTY'): Promise<NSEQuote[]> {
    try {
        const data = await nseGet('/api/live-analysis-variations?index=gainers');
        return extractNSEMovers(data, index).slice(0, 15).map((d: any) => ({
            symbol: d.symbol + '.NS',
            name: d.symbol,
            price: d.ltp ?? d.lastPrice ?? 0,
            change: d.net_price ?? d.change ?? 0,
            changePercent: d.perChange ?? d.pChange ?? 0,
            open: d.open_price ?? 0,
            high: d.high_price ?? 0,
            low: d.low_price ?? 0,
            prevClose: d.prev_price ?? 0,
            volume: d.trade_quantity ?? 0,
            totalBuyQty: 0, totalSellQty: 0, yearHigh: 0, yearLow: 0,
        }));
    } catch {
        return [];
    }
}

export async function getNSETopLosers(index = 'NIFTY'): Promise<NSEQuote[]> {
    try {
        const data = await nseGet('/api/live-analysis-variations?index=loosers'); // NSE typo: double-o
        return extractNSEMovers(data, index).slice(0, 15).map((d: any) => ({
            symbol: d.symbol + '.NS',
            name: d.symbol,
            price: d.ltp ?? d.lastPrice ?? 0,
            change: d.net_price ?? d.change ?? 0,
            changePercent: d.perChange ?? d.pChange ?? 0,
            open: d.open_price ?? 0,
            high: d.high_price ?? 0,
            low: d.low_price ?? 0,
            prevClose: d.prev_price ?? 0,
            volume: d.trade_quantity ?? 0,
            totalBuyQty: 0, totalSellQty: 0, yearHigh: 0, yearLow: 0,
        }));
    } catch {
        return [];
    }
}

export async function searchNSEStocks(query: string): Promise<Array<{ symbol: string; name: string; type: string }>> {
    try {
        const data = await nseGet(`/api/search/autocomplete?q=${encodeURIComponent(query)}`);
        return (data.symbols || []).map((d: any) => ({
            symbol: d.symbol + (d.resultType?.toLowerCase().includes('equity') ? '.NS' : ''),
            name: d.symbol_info || d.symbol,
            type: d.resultType || 'equity',
        }));
    } catch {
        return [];
    }
}

/** Nifty 50 constituent list with weights */
export async function getNifty50Holdings(): Promise<Array<{ symbol: string; weight: number }>> {
    try {
        const data = await nseGet('/api/equity-stockIndices?index=NIFTY%2050');
        return (data.data || []).map((d: any) => ({
            symbol: d.symbol + '.NS',
            weight: d.perChange365d ?? 0,
        }));
    } catch {
        return [];
    }
}

/**
 * Fetch full constituent data for any NSE index.
 * Returns the raw NSE row objects (rich data: price, change, 30d%, 365d%, nearWKH, nearWKL, volume, ffmc, meta).
 * Available indices: 'NIFTY 50', 'NIFTY 500', 'NIFTY BANK', 'SECURITIES IN F&O', etc.
 */
export async function fetchNSEIndexData(indexName: string): Promise<any[]> {
    try {
        const encoded = encodeURIComponent(indexName);
        const data = await nseGet(`/api/equity-stockIndices?index=${encoded}`);
        return data.data || [];
    } catch {
        return [];
    }
}
