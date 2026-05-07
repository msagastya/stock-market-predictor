// BSE India API — Free, Official Exchange Data

const BSE_API = 'https://api.bseindia.com/BseIndiaAPI/api';
const BSE_MARKET = 'https://api.bseindia.com/MarketDataAPI/api';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.bseindia.com/',
    'Origin': 'https://www.bseindia.com',
};

// NSE symbol → BSE scrip code mapping (common large-caps only)
// For unknown symbols, BSE search API is used
const NSE_TO_BSE: Record<string, string> = {
    'RELIANCE': '500325', 'TCS': '532540', 'HDFCBANK': '500180', 'INFY': '500209',
    'ICICIBANK': '532174', 'HINDUNILVR': '500696', 'SBIN': '500112', 'BHARTIARTL': '532454',
    'KOTAKBANK': '500247', 'ITC': '500875', 'LT': '500510', 'AXISBANK': '532215',
    'ASIANPAINT': '500820', 'MARUTI': '532500', 'BAJFINANCE': '500034', 'WIPRO': '507685',
    'NESTLEIND': '500790', 'ULTRACEMCO': '532538', 'TITAN': '500114', 'POWERGRID': '532898',
    'NTPC': '532555', 'SUNPHARMA': '524715', 'TATAMOTORS': '500570', 'ADANIENT': '512599',
    'BAJAJFINSV': '532978', 'TECHM': '532755', 'HCLTECH': '532281', 'ONGC': '500312',
    'COALINDIA': '533278', 'DRREDDY': '500124', 'CIPLA': '500087', 'DIVISLAB': '532488',
    'TATASTEEL': '500470', 'HINDALCO': '500440', 'GRASIM': '500300', 'EICHERMOT': '505200',
    'HEROMOTOCO': '500182', 'BPCL': '500547', 'BRITANNIA': '500825', 'APOLLOHOSP': '508869',
    'TATACONSUM': '500800', 'SBILIFE': '540719', 'HDFCLIFE': '540777', 'UPL': '512070',
    'SHREECEM': '500387', 'JSWSTEEL': '500228', 'ADANIPORTS': '532921', 'INDUSINDBK': '532187',
};

async function bseGet(url: string): Promise<any> {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`BSE HTTP ${res.status}`);
    return res.json();
}

export interface BSEQuote {
    symbol: string;
    scripCode: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    open: number;
    high: number;
    low: number;
    prevClose: number;
    volume: number;
    yearHigh: number;
    yearLow: number;
}

async function lookupBSECode(nseTicker: string): Promise<string | null> {
    // Check hardcoded map first
    if (NSE_TO_BSE[nseTicker]) return NSE_TO_BSE[nseTicker];
    // Fall back to BSE search
    try {
        const data = await bseGet(`${BSE_API}/fetchbsesuggestionsdata/w?Type=C&text=${encodeURIComponent(nseTicker)}&IPOType=0`);
        const results = Array.isArray(data) ? data : (data.Table || []);
        const match = results.find((r: any) => r.short_name?.toUpperCase() === nseTicker || r.scrip_cd);
        return match?.scrip_cd?.toString() || null;
    } catch {
        return null;
    }
}

export async function getBSEQuote(symbol: string): Promise<BSEQuote | null> {
    try {
        const nseTicker = symbol.replace(/\.(NS|BO)$/, '').toUpperCase();
        let scripCode = await lookupBSECode(nseTicker);
        if (!scripCode) return null;

        const data = await bseGet(`${BSE_API}/getScripHeaderData/w?Debtflag=&scripcode=${scripCode}&seriesid=`);
        if (!data || data.Status === 'Failure') return null;

        return {
            symbol: nseTicker + '.BO',
            scripCode,
            name: data.CmpName || nseTicker,
            price: parseFloat(data.CurrRate) || 0,
            change: parseFloat(data.CurrRate) - parseFloat(data.PrevClose) || 0,
            changePercent: parseFloat(data.PercChange) || 0,
            open: parseFloat(data.Open) || 0,
            high: parseFloat(data.High52) || 0,  // Using 52w high as proxy; intraday not always available
            low: parseFloat(data.Low52) || 0,
            prevClose: parseFloat(data.PrevClose) || 0,
            volume: parseInt(data.TotalTradedQty) || 0,
            yearHigh: parseFloat(data.High52) || 0,
            yearLow: parseFloat(data.Low52) || 0,
        };
    } catch {
        return null;
    }
}

export interface BSEIndex {
    name: string;
    value: number;
    change: number;
    changePercent: number;
}

export async function getBSESensex(): Promise<BSEIndex | null> {
    try {
        const data = await bseGet(`${BSE_MARKET}/GetSensexData/w`);
        if (!data?.Table?.[0]) return null;
        const d = data.Table[0];
        return {
            name: 'S&P BSE SENSEX',
            value: parseFloat(d.Index_Value) || 0,
            change: parseFloat(d.Change) || 0,
            changePercent: parseFloat(d.Pct_change) || 0,
        };
    } catch {
        return null;
    }
}

export async function getBSETopGainers(): Promise<BSEQuote[]> {
    try {
        const data = await bseGet(`${BSE_API}/TopGainerLoser/w?type=gainer&GroupName=A`);
        const rows = Array.isArray(data) ? data : (data.Table || []);
        return rows.slice(0, 15).map((d: any) => ({
            symbol: (d.scrip_name || d.short_name || '') + '.BO',
            scripCode: d.scrip_cd?.toString() || '',
            name: d.scrip_name || '',
            price: parseFloat(d.current_rate) || 0,
            change: parseFloat(d.chg) || 0,
            changePercent: parseFloat(d.perchg) || 0,
            open: 0, high: 0, low: 0, prevClose: 0, volume: 0, yearHigh: 0, yearLow: 0,
        }));
    } catch {
        return [];
    }
}

export async function getBSETopLosers(): Promise<BSEQuote[]> {
    try {
        const data = await bseGet(`${BSE_API}/TopGainerLoser/w?type=loser&GroupName=A`);
        const rows = Array.isArray(data) ? data : (data.Table || []);
        return rows.slice(0, 15).map((d: any) => ({
            symbol: (d.scrip_name || d.short_name || '') + '.BO',
            scripCode: d.scrip_cd?.toString() || '',
            name: d.scrip_name || '',
            price: parseFloat(d.current_rate) || 0,
            change: parseFloat(d.chg) || 0,
            changePercent: parseFloat(d.perchg) || 0,
            open: 0, high: 0, low: 0, prevClose: 0, volume: 0, yearHigh: 0, yearLow: 0,
        }));
    } catch {
        return [];
    }
}
