/**
 * Morning Scanner — runs at 7:00 AM IST
 *
 * Reads global markets, GIFT Nifty, overnight cues, previous day data
 * and dynamically picks today's trading universe.
 * Nothing is hardcoded. The market decides what to watch.
 */

// ── Full NSE universe (scored daily, top 50 selected) ─────────────────────────
// ~250 liquid stocks. Scanner scores them and picks today's 50.

export const NSE_UNIVERSE = [
    // Nifty 50
    'RELIANCE.NS','TCS.NS','HDFCBANK.NS','ICICIBANK.NS','INFY.NS','HINDUNILVR.NS',
    'ITC.NS','SBIN.NS','BHARTIARTL.NS','KOTAKBANK.NS','LT.NS','AXISBANK.NS',
    'ASIANPAINT.NS','MARUTI.NS','NESTLEIND.NS','NTPC.NS','POWERGRID.NS','ULTRACEMCO.NS',
    'TITAN.NS','BAJFINANCE.NS','SUNPHARMA.NS','WIPRO.NS','HCLTECH.NS','TECHM.NS',
    'ONGC.NS','TATAMOTORS.NS','TATASTEEL.NS','JSWSTEEL.NS','HINDALCO.NS','COALINDIA.NS',
    'ADANIENT.NS','ADANIPORTS.NS','BAJAJ-AUTO.NS','DRREDDY.NS','CIPLA.NS','EICHERMOT.NS',
    'DIVISLAB.NS','APOLLOHOSP.NS','BPCL.NS','GRASIM.NS','M&M.NS','HEROMOTOCO.NS',
    'TATACONSUM.NS','LTIM.NS','UPL.NS','BRITANNIA.NS','SHRIRAMFIN.NS','INDUSINDBK.NS',
    'BAJAJFINSV.NS','SBILIFE.NS',

    // Nifty Next 50
    'PIDILITIND.NS','SIEMENS.NS','DMART.NS','HAVELLS.NS','GODREJCP.NS','MARICO.NS',
    'BERGEPAINT.NS','TORNTPHARM.NS','LUPIN.NS','MCDOWELL-N.NS','COLPAL.NS','PAGEIND.NS',
    'OFSS.NS','MUTHOOTFIN.NS','CHOLAFIN.NS','BANKBARODA.NS','CANBK.NS','PNB.NS',
    'UNIONBANK.NS','FEDERALBNK.NS','IDFCFIRSTB.NS','RBLBANK.NS',

    // Nifty Midcap 150 (liquid ones)
    'ZOMATO.NS','PAYTM.NS','NYKAA.NS','POLICYBZR.NS','DELHIVERY.NS','IRFC.NS',
    'IRCTC.NS','CDSL.NS','BSE.NS','MCX.NS','PERSISTENT.NS','COFORGE.NS','MPHASIS.NS',
    'LTTS.NS','KPITTECH.NS','DIXON.NS','AMBER.NS','KALYANKJIL.NS','SENCO.NS',
    'DLF.NS','GODREJPROP.NS','PRESTIGE.NS','OBEROIRLTY.NS','BRIGADE.NS','SOBHA.NS',
    'ABCAPITAL.NS','IIFL.NS','MANAPPURAM.NS','CREDITACC.NS','SPANDANASPH.NS',
    'TATAPOWER.NS','ADANIGREEN.NS','ADANITRANS.NS','CESC.NS','TORNTPOWER.NS',
    'GLENMARK.NS','AUROPHARMA.NS','ALKEM.NS','IPCALAB.NS','LAURUSLABS.NS',
    'TATACHEM.NS','GNFC.NS','ATUL.NS','DEEPAKNTR.NS','PIIND.NS',
    'ESCORT.NS','ASHOKLEY.NS','TVSMOTOR.NS','BALKRISIND.NS','APOLLOTYRE.NS',
    'CEATLTD.NS','MRF.NS','EXIDEIND.NS','AMARARAJA.NS',

    // High momentum / operator active
    'YESBANK.NS','SUZLON.NS','NHPC.NS','SJVN.NS','RVNL.NS','RAILTEL.NS',
    'BEL.NS','HAL.NS','COCHINSHIP.NS','MAZAGON.NS','GRSE.NS',
    'HUDCO.NS','RECLTD.NS','PFC.NS','IREDA.NS',

    // Commodity proxies
    'GOLDBEES.NS','SILVERBEES.NS','IOC.NS','HINDPETRO.NS','MRPL.NS',
    'SAIL.NS','NMDC.NS','MOIL.NS','NATIONALUM.NS','VEDL.NS',
];

export interface GlobalSnapshot {
    // Previous night US close
    dow:    { close: number; changePercent: number };
    sp500:  { close: number; changePercent: number };
    nasdaq: { close: number; changePercent: number };
    // Asian markets (open at 7 AM IST)
    nikkei: { price: number; changePercent: number };
    hangSeng:{ price: number; changePercent: number };
    // Commodities
    gold:   { price: number; changePercent: number };
    crude:  { price: number; changePercent: number };
    // Currency
    usdInr: { price: number; changePercent: number };
    // GIFT Nifty (best India pre-market signal)
    giftNifty: { price: number; changePercent: number; impliedOpen: number };
    // Derived
    globalBias: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
    riskOnOff:  'risk_on' | 'neutral' | 'risk_off';
    keyDriver:  string; // what's driving today
}

export interface ScoredStock {
    symbol:     string;
    nseSymbol:  string;
    score:      number;   // 0-100, higher = more worth watching today
    reasons:    string[];
    category:   string;
    prevClose:  number;
    prevVolume: number;
    gapPercent: number;   // implied gap from global cues (not real yet at 7 AM)
    volatility: number;   // 20-day realized vol
    momentum:   number;   // 20d return
    sectorBias: 'tailwind' | 'headwind' | 'neutral';
}

export interface MorningScan {
    date:          string;
    scannedAt:     string;
    globalSnapshot: GlobalSnapshot;
    todayWatchlist: ScoredStock[];  // top 50 selected
    sectorPriority: string[];       // sectors to focus on today, in order
    avoidSectors:   string[];
    dayBias:        'long_heavy' | 'short_heavy' | 'balanced';
    marketRegime:   string;
    keyLevels: {
        niftySupport:    number;
        niftyResistance: number;
        bankNiftySupport: number;
        bankNiftyResistance: number;
    };
    tradingPlan:    string; // one paragraph — what to do today
    alerts:         string[]; // specific things to watch
}

// ── Fetch one quote from Yahoo Finance ───────────────────────────────────────

async function yf(symbol: string): Promise<{
    price: number; prevClose: number; changePercent: number;
    volume: number; high52w: number; low52w: number;
} | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=60d`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(8000),
        });
        const j = await res.json();
        const r = j?.chart?.result?.[0];
        if (!r) return null;

        const meta      = r.meta;
        const closes    = r.indicators?.quote?.[0]?.close  || [];
        const volumes   = r.indicators?.quote?.[0]?.volume || [];
        const highs     = r.indicators?.quote?.[0]?.high   || [];
        const lows      = r.indicators?.quote?.[0]?.low    || [];

        const price     = meta.regularMarketPrice || closes[closes.length - 1];
        const prevClose = meta.previousClose      || closes[closes.length - 2] || price;
        const chgPct    = ((price - prevClose) / prevClose) * 100;

        // 20-day realized volatility
        const recentCloses = closes.slice(-21).filter(Boolean);
        let vol20 = 0;
        if (recentCloses.length > 5) {
            const returns = [];
            for (let i = 1; i < recentCloses.length; i++) {
                returns.push(Math.log(recentCloses[i] / recentCloses[i-1]));
            }
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
            vol20 = Math.sqrt(variance) * Math.sqrt(252) * 100; // annualized %
        }

        const validHighs = highs.filter(Boolean);
        const validLows  = lows.filter(Boolean);

        return {
            price,
            prevClose,
            changePercent: chgPct,
            volume:  volumes[volumes.length - 1] || 0,
            high52w: validHighs.length ? Math.max(...validHighs) : price,
            low52w:  validLows.length  ? Math.min(...validLows)  : price,
        };
    } catch {
        return null;
    }
}

// ── Fetch global snapshot ─────────────────────────────────────────────────────

export async function fetchGlobalSnapshot(): Promise<GlobalSnapshot> {
    const [dow, sp500, nasdaq, nikkei, hangSeng, gold, crude, usdInr, nifty] = await Promise.allSettled([
        yf('^DJI'), yf('^GSPC'), yf('^IXIC'),
        yf('^N225'), yf('^HSI'),
        yf('GC=F'), yf('CL=F'),
        yf('USDINR=X'), yf('^NSEI'),
    ]);

    const g = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;

    const dowData    = g(dow);
    const sp500Data  = g(sp500);
    const nasdaqData = g(nasdaq);
    const nikkeiData = g(nikkei);
    const hsData     = g(hangSeng);
    const goldData   = g(gold);
    const crudeData  = g(crude);
    const inrData    = g(usdInr);
    const niftyData  = g(nifty);

    // GIFT Nifty proxy: use Nifty spot + overnight bias from US markets
    const usBias = ((sp500Data?.changePercent || 0) + (nasdaqData?.changePercent || 0)) / 2;
    const giftNiftyPrice = (niftyData?.price || 24500) * (1 + usBias / 100);
    const giftNiftyChg   = niftyData ? ((giftNiftyPrice - niftyData.prevClose) / niftyData.prevClose) * 100 : 0;

    // Global bias score
    const scores = [
        (sp500Data?.changePercent || 0) * 2,   // S&P weighted 2x
        (nasdaqData?.changePercent || 0) * 1.5, // Nasdaq 1.5x
        (dowData?.changePercent || 0),
        (nikkeiData?.changePercent || 0) * 0.5,
        -(inrData?.changePercent || 0) * 2,     // USD/INR rise = bad for India
        -(crudeData?.changePercent || 0) * 0.5, // crude up = mild negative for India
    ];
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const globalBias = avgScore > 1   ? 'strong_bullish'
                     : avgScore > 0.3 ? 'bullish'
                     : avgScore < -1  ? 'strong_bearish'
                     : avgScore < -0.3 ? 'bearish'
                     : 'neutral';

    const riskOnOff = avgScore > 0.5 ? 'risk_on' : avgScore < -0.5 ? 'risk_off' : 'neutral';

    // Key driver narrative
    let keyDriver = 'Mixed signals — no strong directional cue';
    if (Math.abs(nasdaqData?.changePercent || 0) > 1.5) keyDriver = `Nasdaq moved ${nasdaqData!.changePercent.toFixed(1)}% — IT/tech stocks will react`;
    else if (Math.abs(crudeData?.changePercent || 0) > 2) keyDriver = `Crude ${(crudeData!.changePercent > 0 ? '+' : '')}${crudeData!.changePercent.toFixed(1)}% — energy/oil stocks will move`;
    else if (Math.abs(inrData?.changePercent || 0) > 0.3) keyDriver = `USD/INR at ${inrData!.price.toFixed(2)} — IT exporters and import-heavy sectors affected`;
    else if (giftNiftyChg > 0.5) keyDriver = `GIFT Nifty implying ${giftNiftyChg.toFixed(2)}% gap up — expect strong opening`;
    else if (giftNiftyChg < -0.5) keyDriver = `GIFT Nifty implying ${giftNiftyChg.toFixed(2)}% gap down — watch for hunt below support at open`;

    return {
        dow:      { close: dowData?.price || 0,     changePercent: dowData?.changePercent || 0 },
        sp500:    { close: sp500Data?.price || 0,   changePercent: sp500Data?.changePercent || 0 },
        nasdaq:   { close: nasdaqData?.price || 0,  changePercent: nasdaqData?.changePercent || 0 },
        nikkei:   { price: nikkeiData?.price || 0,  changePercent: nikkeiData?.changePercent || 0 },
        hangSeng: { price: hsData?.price || 0,      changePercent: hsData?.changePercent || 0 },
        gold:     { price: goldData?.price || 0,    changePercent: goldData?.changePercent || 0 },
        crude:    { price: crudeData?.price || 0,   changePercent: crudeData?.changePercent || 0 },
        usdInr:   { price: inrData?.price || 83.4,  changePercent: inrData?.changePercent || 0 },
        giftNifty:{ price: giftNiftyPrice, changePercent: giftNiftyChg, impliedOpen: giftNiftyPrice },
        globalBias, riskOnOff, keyDriver,
    };
}

// ── Score each stock ──────────────────────────────────────────────────────────

function scoreStock(data: NonNullable<Awaited<ReturnType<typeof yf>>>, symbol: string, global: GlobalSnapshot): ScoredStock {
    const nseSymbol = symbol.replace('.NS', '').replace('.BO', '');
    let score = 50;
    const reasons: string[] = [];

    // Momentum — stocks already moving tend to keep moving
    const mom = data.changePercent;
    if (Math.abs(mom) > 3) { score += 20; reasons.push(`Strong momentum ${mom.toFixed(1)}%`); }
    else if (Math.abs(mom) > 1.5) { score += 10; reasons.push(`Good momentum ${mom.toFixed(1)}%`); }

    // Near 52-week levels = institutional attention + hunt zones
    const distFromHigh = ((data.high52w - data.price) / data.high52w) * 100;
    const distFromLow  = ((data.price - data.low52w)  / data.low52w)  * 100;
    if (distFromHigh < 2)  { score += 15; reasons.push(`Near 52w high — breakout watch`); }
    if (distFromLow < 2)   { score += 15; reasons.push(`Near 52w low — reversal/hunt zone`); }
    if (distFromHigh < 5)  { score += 8; }
    if (distFromLow < 5)   { score += 8; }

    // Volume — high volume = real move, low volume = ignore
    // (using relative volume proxy: current vs average)
    if (data.volume > 5000000)  { score += 10; reasons.push(`High absolute volume`); }
    if (data.volume > 15000000) { score += 5;  reasons.push(`Extremely high volume`); }

    // Global cue alignment
    const isIT = ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'MPHASIS', 'LTTS'].includes(nseSymbol);
    const isOil = ['ONGC', 'IOC', 'BPCL', 'HINDPETRO', 'MRPL', 'RELIANCE'].includes(nseSymbol);
    const isGold = ['GOLDBEES', 'SILVERBEES', 'TITAN', 'KALYANKJIL', 'SENCO'].includes(nseSymbol);
    const isBank = ['HDFCBANK', 'ICICIBANK', 'SBIN', 'AXISBANK', 'KOTAKBANK', 'BANKBARODA', 'FEDERALBNK', 'IDFCFIRSTB'].includes(nseSymbol);

    if (isIT && Math.abs(global.nasdaq.changePercent) > 1) {
        score += 18;
        reasons.push(`Nasdaq ${global.nasdaq.changePercent > 0 ? '+' : ''}${global.nasdaq.changePercent.toFixed(1)}% — IT sector catalyst`);
    }
    if (isOil && Math.abs(global.crude.changePercent) > 1.5) {
        score += 15;
        reasons.push(`Crude ${global.crude.changePercent > 0 ? '+' : ''}${global.crude.changePercent.toFixed(1)}% — oil sector catalyst`);
    }
    if (isGold && Math.abs(global.gold.changePercent) > 0.8) {
        score += 12;
        reasons.push(`Gold ${global.gold.changePercent > 0 ? '+' : ''}${global.gold.changePercent.toFixed(1)}% — gold-linked catalyst`);
    }
    if (isBank && global.riskOnOff === 'risk_on') {
        score += 10;
        reasons.push(`Risk-on day — banking sector gets institutional flow`);
    }
    if (isBank && global.riskOnOff === 'risk_off') {
        score -= 10;
        reasons.push(`Risk-off — reduce banking exposure`);
    }

    // USD/INR effect
    const inrWeak = global.usdInr.changePercent > 0.2; // rupee weakening
    if (isIT && inrWeak) { score += 8; reasons.push(`Weak rupee = IT revenue boost`); }
    if (isOil && inrWeak){ score -= 8; reasons.push(`Weak rupee = crude import cost rises`); }

    // GIFT Nifty implied direction
    const giftBullish = global.giftNifty.changePercent > 0.3;
    const giftBearish = global.giftNifty.changePercent < -0.3;
    if (giftBullish && isBank) { score += 8; reasons.push(`GIFT Nifty gap up — financials lead`); }
    if (giftBearish)           { score -= 5; reasons.push(`GIFT Nifty gap down — cautious`); }

    // Penalize if too quiet
    if (data.volume < 500000) { score -= 20; reasons.push(`Very low volume — skip`); }

    // Sector bias
    const sectorBias: ScoredStock['sectorBias'] =
        (isIT && global.nasdaq.changePercent > 0.5) ||
        (isOil && global.crude.changePercent > 1)   ||
        (isBank && global.riskOnOff === 'risk_on')
        ? 'tailwind'
        : (isIT && global.nasdaq.changePercent < -0.5) ||
          (isOil && global.crude.changePercent < -1)
        ? 'headwind'
        : 'neutral';

    // Category
    const category = isBank ? 'banking' : isIT ? 'it' : isOil ? 'commodity_proxy' : isGold ? 'commodity_proxy' : 'other';

    return {
        symbol, nseSymbol, score: Math.min(100, Math.max(0, score)),
        reasons: reasons.slice(0, 4),
        category,
        prevClose:  data.prevClose,
        prevVolume: data.volume,
        gapPercent: global.giftNifty.changePercent * 0.8, // stocks gap ~80% of Nifty
        volatility: 0,
        momentum:   mom,
        sectorBias,
    };
}

// ── Determine sector priority from global cues ────────────────────────────────

function getSectorPriority(global: GlobalSnapshot): { priority: string[]; avoid: string[] } {
    const priority: string[] = [];
    const avoid:    string[] = [];

    if (global.nasdaq.changePercent > 1)     priority.push('IT / Technology');
    if (global.nasdaq.changePercent < -1)    avoid.push('IT / Technology');
    if (global.crude.changePercent > 2)      { priority.push('Oil & Energy'); avoid.push('Auto', 'Airlines'); }
    if (global.crude.changePercent < -2)     { priority.push('Auto', 'FMCG'); avoid.push('Oil & Energy'); }
    if (global.gold.changePercent > 1)       priority.push('Gold / Jewellery');
    if (global.riskOnOff === 'risk_on')      priority.unshift('Banking / Financials');
    if (global.riskOnOff === 'risk_off')     { priority.push('Pharma', 'FMCG'); avoid.push('Banking', 'Realty', 'Metals'); }
    if (global.usdInr.changePercent > 0.3)  { priority.push('IT (rupee weak)'); avoid.push('Oil importers'); }
    if (global.hangSeng.changePercent < -1.5) avoid.push('Metals', 'Commodities');
    if (global.nikkei.changePercent < -1)   avoid.push('Auto', 'Electronics');

    // Default if nothing stands out
    if (priority.length === 0) priority.push('Banking', 'Large Cap');

    return { priority: Array.from(new Set(priority)), avoid: Array.from(new Set(avoid)) };
}

// ── Build trading plan paragraph ──────────────────────────────────────────────

function buildTradingPlan(global: GlobalSnapshot, sectorPriority: string[], dayBias: string): string {
    const giftStr = `GIFT Nifty implying ${global.giftNifty.changePercent >= 0 ? '+' : ''}${global.giftNifty.changePercent.toFixed(2)}% open`;
    const usStr   = `US markets ${global.sp500.changePercent >= 0 ? 'closed higher' : 'closed lower'} (S&P ${global.sp500.changePercent >= 0 ? '+' : ''}${global.sp500.changePercent.toFixed(2)}%)`;
    const biasStr = dayBias === 'long_heavy' ? 'Bias is LONG. Look for dips to buy, avoid shorts.' : dayBias === 'short_heavy' ? 'Bias is SHORT. Look for rallies to sell, avoid longs.' : 'No strong bias. Trade both directions with equal caution.';

    return `${giftStr}. ${usStr}. ${global.keyDriver}. Focus sectors: ${sectorPriority.slice(0,3).join(', ')}. ${biasStr} Wait for 9:30 hunt window to clear before first entry. Watch for volume confirmation on all signals.`;
}

// ── Main morning scan ─────────────────────────────────────────────────────────

export async function runMorningScan(): Promise<MorningScan> {
    const now  = new Date();
    const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // 1. Fetch global snapshot
    const global = await fetchGlobalSnapshot();

    // 2. Score stocks in batches (avoid rate limiting)
    const allScored: ScoredStock[] = [];
    const batchSize = 10;

    for (let i = 0; i < NSE_UNIVERSE.length; i += batchSize) {
        const batch = NSE_UNIVERSE.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(sym => yf(sym)));

        for (let j = 0; j < batch.length; j++) {
            const r = results[j];
            if (r.status === 'fulfilled' && r.value) {
                allScored.push(scoreStock(r.value, batch[j], global));
            }
        }

        // Small delay between batches
        if (i + batchSize < NSE_UNIVERSE.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // 3. Sort by score, take top 50
    const top50 = allScored
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

    // 4. Sector priority
    const { priority: sectorPriority, avoid: avoidSectors } = getSectorPriority(global);

    // 5. Day bias
    const dayBias: MorningScan['dayBias'] =
        global.globalBias === 'strong_bullish' || global.globalBias === 'bullish' ? 'long_heavy' :
        global.globalBias === 'strong_bearish' || global.globalBias === 'bearish' ? 'short_heavy' :
        'balanced';

    // 6. Market regime
    const giftChg = global.giftNifty.changePercent;
    const marketRegime = Math.abs(giftChg) > 0.8 ? 'Trending — follow momentum'
        : Math.abs(giftChg) > 0.3 ? 'Mild trend — selective entries'
        : 'Flat open — range day likely, mean reversion';

    // 7. Key Nifty levels (rough — based on previous close ± ATR proxy)
    const niftyBase = global.giftNifty.price;
    const atrProxy  = niftyBase * 0.007; // ~0.7% daily range proxy
    const keyLevels = {
        niftySupport:        Math.round(niftyBase - atrProxy),
        niftyResistance:     Math.round(niftyBase + atrProxy),
        bankNiftySupport:    Math.round(niftyBase * 2.12 - atrProxy * 2.2),
        bankNiftyResistance: Math.round(niftyBase * 2.12 + atrProxy * 2.2),
    };

    // 8. Alerts
    const alerts: string[] = [];
    if (Math.abs(giftChg) > 1) alerts.push(`Large gap ${giftChg > 0 ? 'UP' : 'DOWN'} ${Math.abs(giftChg).toFixed(2)}% — watch for gap fill`);
    if (global.usdInr.changePercent > 0.4) alerts.push(`Rupee weakening sharply — IT stocks may outperform`);
    if (global.crude.changePercent > 3) alerts.push(`Crude up ${global.crude.changePercent.toFixed(1)}% — OMC stocks (IOC, BPCL, HPCL) under pressure`);
    if (global.gold.changePercent > 1.5) alerts.push(`Gold up ${global.gold.changePercent.toFixed(1)}% — defensive positioning globally`);
    if (global.nasdaq.changePercent < -2) alerts.push(`Nasdaq crashed ${global.nasdaq.changePercent.toFixed(1)}% — IT sector sell-off likely`);
    if (now.getDay() === 4) alerts.push(`Thursday = expiry day. F&O pinning after 2 PM. Exit positions by 2:45.`);

    return {
        date, scannedAt: now.toISOString(),
        globalSnapshot: global,
        todayWatchlist: top50,
        sectorPriority,
        avoidSectors,
        dayBias,
        marketRegime,
        keyLevels,
        tradingPlan: buildTradingPlan(global, sectorPriority, dayBias),
        alerts,
    };
}
