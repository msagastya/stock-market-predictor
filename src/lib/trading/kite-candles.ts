/**
 * Kite Historical Data — replaces Yahoo Finance for intraday candles.
 * Uses Zerodha's official API: real NSE data, no delays, no dirty ticks.
 *
 * Instrument tokens are cached in memory for the session so we don't
 * hammer the instruments dump endpoint on every tick.
 */

import { Candle } from './hunt-detector';
import { KITE_API_KEY, getAccessTokenAsync } from '@/lib/api/kite-connect';

const KITE_BASE = 'https://api.kite.trade';

// ── In-memory token cache (survives within one Vercel function instance) ───────
const tokenCache: Record<string, number> = {};

// ── Instrument token map — NSE symbols → Kite instrument_token ────────────────
// Pre-seeded for our 250-stock universe so we don't need to parse the full CSV
// on every candle request. Tokens are stable and rarely change.
const KNOWN_TOKENS: Record<string, number> = {
    // Nifty / Indices
    'NIFTY 50': 256265, 'NIFTY BANK': 260105, 'INDIA VIX': 264969,

    // Large Cap
    'HDFCBANK': 341249, 'TCS': 2953217, 'RELIANCE': 738561, 'INFY': 408065,
    'HINDUNILVR': 356865, 'ICICIBANK': 1270529, 'KOTAKBANK': 492033,
    'SBIN': 779521, 'AXISBANK': 1510401, 'BAJFINANCE': 4268801,
    'LT': 2939649, 'WIPRO': 969473, 'HCLTECH': 1850625, 'ASIANPAINT': 60417,
    'MARUTI': 2815745, 'NESTLEIND': 4598529, 'TATAMOTORS': 884737,
    'ADANIENT': 25, 'DLF': 3771393, 'ULTRACEMCO': 2952193,

    // Banking
    'BANKBARODA': 1195009, 'CANBK': 2763265, 'PNB': 2730497,
    'UNIONBANK': 2585345, 'IDFCFIRSTB': 3538177,

    // IT
    'TECHM': 3465729, 'LTIM': 17818626, 'PERSISTENT': 4701441, 'MPHASIS': 4642049,

    // Pharma
    'SUNPHARMA': 857857, 'DRREDDY': 225537, 'CIPLA': 177665, 'DIVISLAB': 2800641,

    // Auto
    'BAJAJ-AUTO': 4267265, 'EICHERMOT': 232961, 'M&M': 519937,
    'HEROMOTOCO': 345089, 'TVSMOTOR': 2170625,

    // Metals
    'TATASTEEL': 895745, 'JSWSTEEL': 3001089, 'HINDALCO': 348929,
    'COALINDIA': 5215745, 'SAIL': 758529, 'VEDL': 784129,

    // Oil & Energy
    'ONGC': 633601, 'IOC': 415745, 'BPCL': 134657, 'MRPL': 548609,
    'PETRONET': 3100929, 'GAIL': 1207553,

    // FMCG
    'BRITANNIA': 140033, 'DABUR': 197633, 'GODREJCP': 2585601,
    'MARICO': 1041153, 'TATACONSUM': 878593,

    // Mid-cap
    'ZOMATO': 2083073, 'PAYTM': 5496065, 'POLICYBZR': 4701953,
    'DIXON': 3410433, 'IRFC': 4925697, 'CDSL': 3876097,
    'KALYANKJIL': 371009, 'SUZLON': 837633, 'ASHOKLEY': 54273,
    'BHARTIARTL': 2714625, 'MCX': 5582849, 'LAURUSLABS': 4923905,
    'TORNTPHARM': 900609, 'MUTHOOTFIN': 3876609, 'CHOLAFIN': 175361,

    // Commodity proxy
    'GOLDBEES': 19592706, 'SILVERBEES': 16793858,
    'UPL': 2889473, 'PIIND': 3848193,

    // More common stocks
    'ICICIPRULI': 3677697, 'SBILIFE': 5582337, 'HDFCLIFE': 4995329,
    'BAJAJFINSV': 4268545, 'GRASIM': 315393, 'ADANIPORTS': 3861249,
    'NTPC': 2977281, 'POWERGRID': 3834113, 'JSWENERGY': 3397121,
    'TATAPOWER': 877057, 'INDUSINDBK': 1346049, 'FEDERALBNK': 261889,
    'BANDHANBNK': 2714881, 'RBLBANK': 4708097, 'YESBANK': 3050497,
    'ZYDUSLIFE': 2029825, 'AUROPHARMA': 61441, 'BIOCON': 2911489,
    'PVRINOX': 1893377, 'IRCTC': 3484417, 'DMART': 3465985,
    'NAUKRI': 3430401, 'INDIAMART': 3463169, 'JUSTDIAL': 1927681,
};

async function kiteHistHeaders(): Promise<Record<string, string>> {
    const token = await getAccessTokenAsync();
    return {
        'Authorization': `token ${KITE_API_KEY}:${token}`,
        'X-Kite-Version': '3',
    };
}

/** Resolve NSE symbol → instrument_token, with CSV fallback */
async function resolveToken(nseSymbol: string): Promise<number | null> {
    if (tokenCache[nseSymbol]) return tokenCache[nseSymbol];
    if (KNOWN_TOKENS[nseSymbol]) {
        tokenCache[nseSymbol] = KNOWN_TOKENS[nseSymbol];
        return KNOWN_TOKENS[nseSymbol];
    }

    // Fallback: search instruments CSV
    try {
        const headers = await kiteHistHeaders();
        const res = await fetch(`${KITE_BASE}/instruments/NSE`, { headers });
        if (!res.ok) return null;
        const csv = await res.text();
        for (const line of csv.split('\n').slice(1)) {
            const cols = line.split(',');
            if (cols[2]?.trim() === nseSymbol && cols[10]?.trim() === 'NSE-EQ') {
                const tok = parseInt(cols[0]);
                if (tok) { tokenCache[nseSymbol] = tok; return tok; }
            }
        }
    } catch { /* fall through */ }
    return null;
}

/** Fetch historical candles from Kite — primary data source */
export async function fetchKiteCandles(
    nseSymbol: string,
    interval: '5minute' | '15minute' | 'day' = '15minute',
    days = 5,
): Promise<Candle[]> {
    const token = await resolveToken(nseSymbol);
    if (!token) return [];

    try {
        const to   = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - days);

        const fmt = (d: Date) => d.toISOString().split('T')[0];
        const url = `${KITE_BASE}/instruments/historical/${token}/${interval}?from=${fmt(from)}+09:00:00&to=${fmt(to)}+23:59:59&oi=0`;

        const headers = await kiteHistHeaders();
        const res = await fetch(url, { headers });
        if (!res.ok) return [];

        const json = await res.json();
        if (json.status !== 'success') return [];

        return (json.data?.candles || []).map((c: any[]) => ({
            time:   new Date(c[0]).getTime(),
            open:   c[1],
            high:   c[2],
            low:    c[3],
            close:  c[4],
            volume: c[5],
        }));
    } catch {
        return [];
    }
}

/** Fetch candles — tries Kite first, falls back to Yahoo Finance */
export async function fetchCandles(
    yahooSymbol: string,
    nseSymbol: string,
    interval: '5m' | '15m' | '1d' = '15m',
    days = 5,
): Promise<Candle[]> {
    const kiteInterval = interval === '5m' ? '5minute' : interval === '1d' ? 'day' : '15minute';

    // Try Kite first (real NSE data)
    const kiteCandles = await fetchKiteCandles(nseSymbol, kiteInterval, days);
    if (kiteCandles.length >= 5) return kiteCandles;

    // Fallback to Yahoo Finance
    return fetchYahooCandles(yahooSymbol, interval, days);
}

/** Yahoo Finance fallback */
async function fetchYahooCandles(symbol: string, interval: '5m' | '15m' | '1d', days: number): Promise<Candle[]> {
    try {
        const range = interval === '1d' ? '60d' : `${days}d`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) return [];

        const timestamps = result.timestamp || [];
        const q = result.indicators?.quote?.[0] || {};
        const candles: Candle[] = [];

        for (let i = 0; i < timestamps.length; i++) {
            if (!q.open?.[i] || !q.close?.[i]) continue;
            candles.push({
                time:   timestamps[i] * 1000,
                open:   q.open[i],
                high:   q.high[i],
                low:    q.low[i],
                close:  q.close[i],
                volume: q.volume?.[i] || 0,
            });
        }
        return candles;
    } catch {
        return [];
    }
}

/** Add realistic slippage to a fill price (0.05–0.1% depending on liquidity) */
export function applySlippage(price: number, direction: 'buy' | 'sell', slippagePct = 0.07): number {
    const factor = direction === 'buy'
        ? 1 + slippagePct / 100   // buy: pay slightly more
        : 1 - slippagePct / 100;  // sell: receive slightly less
    return Math.round(price * factor * 100) / 100;
}
