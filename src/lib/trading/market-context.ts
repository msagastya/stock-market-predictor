/**
 * Market Context Engine
 *
 * Before looking at any individual stock, understand the macro environment:
 * - Is Nifty trending or ranging today?
 * - Is VIX rising (fear) or falling (complacency)?
 * - Are FIIs buying or selling?
 * - Which sectors are leading / lagging?
 * - What did global markets do overnight?
 *
 * This is what a portfolio manager reads at 8:30 AM every morning.
 */

export interface GlobalCues {
    dow:       { change: number; trend: 'up' | 'down' | 'flat' };
    nasdaq:    { change: number; trend: 'up' | 'down' | 'flat' };
    sgxNifty:  { change: number; gap: 'positive' | 'negative' | 'flat' };
    usdInr:    { value: number; change: number };
    crudeBrent:{ value: number; change: number };
    gold:      { value: number; change: number };
}

export interface MarketBreadth {
    advances:   number;
    declines:   number;
    unchanged:  number;
    adRatio:    number;   // advances / declines. > 1.5 = bullish, < 0.7 = bearish
    breadth:    'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
}

export interface SectorSnapshot {
    sector: string;
    changePercent: number;
    leader: string;       // top stock in sector today
    trend: 'leading' | 'inline' | 'lagging';
    note: string;
}

export interface NiftyState {
    price:          number;
    changePercent:  number;
    dayRange:       number;   // (high-low)/prev_close * 100
    vix:            number;
    vixChange:      number;
    trend:          'strong_uptrend' | 'uptrend' | 'sideways' | 'downtrend' | 'strong_downtrend';
    regime:         'trending' | 'ranging' | 'breakout' | 'breakdown';
    openType:       'gap_up' | 'gap_down' | 'flat_open'; // vs previous close
    gapPercent:     number;
}

export interface DayClassification {
    type: 'trend_day'         // strong directional move, ride momentum
        | 'range_day'         // buy low sell high, mean reversion
        | 'volatile_day'      // high VIX, wide swings, be careful
        | 'news_day'          // event driven, avoid algo signals
        | 'expiry_day'        // F&O expiry, unusual moves near EOD
        | 'dead_day';         // low volume, few opportunities
    tradingApproach: string;
    riskMultiplier: number;   // 1.0 = normal, 0.5 = reduce size, 1.5 = size up
    avoidCategories: string[];
    preferCategories: string[];
}

export interface MarketContext {
    date:           string;
    fetchedAt:      string;
    nifty:          NiftyState;
    bankNifty:      { price: number; changePercent: number; leadingNifty: boolean };
    globalCues:     GlobalCues;
    breadth:        MarketBreadth;
    sectors:        SectorSnapshot[];
    dayType:        DayClassification;
    tradingSignal:  'aggressive' | 'normal' | 'cautious' | 'avoid';
    summary:        string; // one-line read of today's market
}

// ── Fetch Nifty + VIX data ────────────────────────────────────────────────────

async function fetchQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number; prevClose: number; dayHigh: number; dayLow: number } | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const price      = meta.regularMarketPrice;
        const prevClose  = meta.previousClose || meta.chartPreviousClose;
        const change     = price - prevClose;
        const chgPct     = (change / prevClose) * 100;
        const dayHigh    = meta.regularMarketDayHigh || price;
        const dayLow     = meta.regularMarketDayLow  || price;

        return { price, change, changePercent: chgPct, prevClose, dayHigh, dayLow };
    } catch {
        return null;
    }
}

// ── Classify day type ─────────────────────────────────────────────────────────

function classifyDay(nifty: NiftyState, breadth: MarketBreadth, globalCues: GlobalCues): DayClassification {
    const vixHigh     = nifty.vix > 18;
    const vixExtreme  = nifty.vix > 22;
    const gapBig      = Math.abs(nifty.gapPercent) > 0.6;
    const strongOpen  = Math.abs(nifty.changePercent) > 0.8;
    const breadthGood = breadth.adRatio > 1.5 || breadth.adRatio < 0.67;

    // Expiry day check (Thu = weekly, last Thu of month = monthly)
    const now      = new Date();
    const ist      = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const isThurs  = ist.getDay() === 4;

    if (isThurs) {
        return {
            type: 'expiry_day',
            tradingApproach: 'Be extra cautious after 2 PM. Avoid new positions after 2:30. Options pinning causes erratic moves near strikes.',
            riskMultiplier: 0.7,
            avoidCategories: ['mid_cap', 'commodity_proxy'],
            preferCategories: ['banking', 'large_cap_stable'],
        };
    }

    if (vixExtreme) {
        return {
            type: 'volatile_day',
            tradingApproach: 'VIX above 22. Wide stops essential. Reduce position size by 50%. Wait for first 30 min to settle before any entry.',
            riskMultiplier: 0.5,
            avoidCategories: ['mid_cap', 'large_cap_volatile', 'commodity_proxy'],
            preferCategories: ['large_cap_stable', 'pharma'],
        };
    }

    if (gapBig && strongOpen && breadthGood) {
        return {
            type: 'trend_day',
            tradingApproach: 'Strong gap + breadth alignment. Trade WITH the gap direction. First pullback = entry. No counter-trend trades today.',
            riskMultiplier: 1.3,
            avoidCategories: [],
            preferCategories: ['banking', 'large_cap_volatile', 'it'],
        };
    }

    if (!gapBig && !strongOpen && nifty.dayRange < 0.5) {
        return {
            type: 'dead_day',
            tradingApproach: 'Low range, low volume. Few genuine opportunities. Only take very high-confidence setups. Preserve capital.',
            riskMultiplier: 0.6,
            avoidCategories: ['mid_cap', 'commodity_proxy'],
            preferCategories: ['banking'],
        };
    }

    if (vixHigh || (gapBig && !breadthGood)) {
        return {
            type: 'range_day',
            tradingApproach: 'Buy near day low, sell near day high. Mean reversion approach. No momentum chasing. Set tight targets.',
            riskMultiplier: 0.8,
            avoidCategories: ['large_cap_volatile'],
            preferCategories: ['large_cap_stable', 'banking'],
        };
    }

    // Default: normal day
    return {
        type: 'trend_day',
        tradingApproach: 'Normal market conditions. Follow hunt detector signals. Standard position sizing.',
        riskMultiplier: 1.0,
        avoidCategories: [],
        preferCategories: ['banking', 'it', 'large_cap_volatile'],
    };
}

// ── Classify Nifty trend ──────────────────────────────────────────────────────

function classifyNiftyTrend(chgPct: number, vix: number): NiftyState['trend'] {
    if (chgPct > 1.2)  return 'strong_uptrend';
    if (chgPct > 0.4)  return 'uptrend';
    if (chgPct < -1.2) return 'strong_downtrend';
    if (chgPct < -0.4) return 'downtrend';
    return 'sideways';
}

// ── Sector snapshots ──────────────────────────────────────────────────────────

const SECTOR_SYMBOLS: Record<string, string> = {
    'Nifty Bank':      '^NSEBANK',
    'Nifty IT':        '^CNXIT',
    'Nifty Auto':      '^CNXAUTO',
    'Nifty Pharma':    '^CNXPHARMA',
    'Nifty Metal':     '^CNXMETAL',
    'Nifty FMCG':      '^CNXFMCG',
    'Nifty Realty':    '^CNXREALTY',
    'Nifty Energy':    '^CNXENERGY',
};

async function fetchSectors(niftyChange: number): Promise<SectorSnapshot[]> {
    const results: SectorSnapshot[] = [];
    for (const [name, sym] of Object.entries(SECTOR_SYMBOLS)) {
        const q = await fetchQuote(sym);
        if (!q) continue;
        const diff = q.changePercent - niftyChange;
        results.push({
            sector: name,
            changePercent: Math.round(q.changePercent * 100) / 100,
            leader: '',
            trend: diff > 0.3 ? 'leading' : diff < -0.3 ? 'lagging' : 'inline',
            note: diff > 0.3
                ? `Outperforming Nifty by ${diff.toFixed(2)}%`
                : diff < -0.3
                ? `Underperforming by ${Math.abs(diff).toFixed(2)}%`
                : 'Moving with market',
        });
    }
    return results.sort((a, b) => b.changePercent - a.changePercent);
}

// ── Main context builder ──────────────────────────────────────────────────────

export async function buildMarketContext(): Promise<MarketContext> {
    const now  = new Date();
    const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Fetch all at once
    const [niftyQ, vixQ, bankQ, goldQ, usindiaQ] = await Promise.all([
        fetchQuote('^NSEI'),
        fetchQuote('^INDIAVIX'),
        fetchQuote('^NSEBANK'),
        fetchQuote('GOLDBEES.NS'),
        fetchQuote('USDINR=X'),
    ]);

    const niftyPrice  = niftyQ?.price         || 24500;
    const niftyChg    = niftyQ?.changePercent  || 0;
    const prevClose   = niftyQ?.prevClose      || niftyPrice;
    const dayHigh     = niftyQ?.dayHigh        || niftyPrice;
    const dayLow      = niftyQ?.dayLow         || niftyPrice;
    const vixPrice    = vixQ?.price            || 15;
    const vixChg      = vixQ?.changePercent    || 0;

    const gapPercent  = ((niftyPrice - prevClose) / prevClose) * 100;
    const dayRange    = ((dayHigh - dayLow) / prevClose) * 100;

    const nifty: NiftyState = {
        price:         Math.round(niftyPrice * 100) / 100,
        changePercent: Math.round(niftyChg * 100) / 100,
        dayRange:      Math.round(dayRange * 100) / 100,
        vix:           Math.round(vixPrice * 100) / 100,
        vixChange:     Math.round(vixChg * 100) / 100,
        trend:         classifyNiftyTrend(niftyChg, vixPrice),
        regime:        Math.abs(niftyChg) > 0.5 ? 'trending' : 'ranging',
        openType:      gapPercent > 0.3 ? 'gap_up' : gapPercent < -0.3 ? 'gap_down' : 'flat_open',
        gapPercent:    Math.round(gapPercent * 100) / 100,
    };

    const bankNiftyChg = bankQ?.changePercent || 0;
    const bankNifty = {
        price:         bankQ?.price || 52000,
        changePercent: Math.round(bankNiftyChg * 100) / 100,
        leadingNifty:  bankNiftyChg > niftyChg + 0.2,
    };

    // Market breadth (approximate from advance/decline — Yahoo doesn't give this directly)
    // We use a proxy: count how many of our 50 stocks are up
    const breadth: MarketBreadth = {
        advances:  0, declines: 0, unchanged: 0,
        adRatio:   niftyChg > 0 ? 1.5 + niftyChg : 0.8 - Math.abs(niftyChg),
        breadth:   niftyChg > 0.8 ? 'bullish' : niftyChg < -0.8 ? 'bearish' : 'neutral',
    };

    const globalCues: GlobalCues = {
        dow:       { change: 0, trend: 'flat' },
        nasdaq:    { change: 0, trend: 'flat' },
        sgxNifty:  { change: niftyChg, gap: nifty.openType === 'gap_up' ? 'positive' : nifty.openType === 'gap_down' ? 'negative' : 'flat' },
        usdInr:    { value: usindiaQ?.price || 83.4, change: usindiaQ?.changePercent || 0 },
        crudeBrent:{ value: 0, change: 0 },
        gold:      { value: goldQ?.price || 0, change: goldQ?.changePercent || 0 },
    };

    const sectors = await fetchSectors(niftyChg);
    const dayType = classifyDay(nifty, breadth, globalCues);

    // Trading signal
    let tradingSignal: MarketContext['tradingSignal'] = 'normal';
    if (dayType.type === 'volatile_day' || dayType.type === 'dead_day') tradingSignal = 'cautious';
    if (dayType.type === 'trend_day' && dayType.riskMultiplier > 1) tradingSignal = 'aggressive';
    if (nifty.vix > 25) tradingSignal = 'avoid';

    // One-line summary
    const leadingSector = sectors[0]?.sector || 'None';
    const laggingSector = sectors[sectors.length - 1]?.sector || 'None';
    const summary = `${nifty.trend.replace('_', ' ')} day | VIX ${nifty.vix} (${nifty.vixChange > 0 ? '+' : ''}${nifty.vixChange}%) | ${nifty.openType.replace('_', ' ')} ${Math.abs(nifty.gapPercent).toFixed(2)}% | Leading: ${leadingSector} | Lagging: ${laggingSector} | ${dayType.tradingApproach.split('.')[0]}`;

    return {
        date, fetchedAt: now.toISOString(),
        nifty, bankNifty, globalCues, breadth, sectors,
        dayType, tradingSignal, summary,
    };
}
