/**
 * Master watchlist — 50 stocks across 9 categories
 * Covers every market condition: stable, volatile, trending, reversing,
 * large/mid cap, commodities, and key sectors.
 */

export type Category =
    | 'large_cap_stable'    // Nifty 50, low beta, consistent
    | 'large_cap_volatile'  // Nifty 50, high beta, moves fast
    | 'mid_cap'             // Nifty Midcap 150, higher risk/reward
    | 'banking'             // Always hunted, high F&O OI
    | 'it'                  // Moves on global cues, USD/INR
    | 'pharma'              // Defensive, FDA event driven
    | 'auto'                // Economic cycle proxy
    | 'metals'              // China + commodity linked
    | 'commodity_proxy'     // Gold/Silver ETFs, Oil proxies

export type TrendBias = 'uptrend' | 'downtrend' | 'sideways' | 'unknown';
export type VolatilityProfile = 'low' | 'medium' | 'high' | 'extreme';

export interface WatchStock {
    symbol: string;           // Yahoo Finance format (RELIANCE.NS)
    nseSymbol: string;        // Pure NSE symbol
    name: string;
    category: Category;
    marketCap: 'large' | 'mid' | 'small';
    volatility: VolatilityProfile;
    beta: number;             // vs Nifty 50
    avgDailyRange: number;    // typical daily range in %
    fnoStock: boolean;        // has F&O = institutional interest + hunt target
    notes: string;            // why this stock is in the list
}

export const WATCHLIST: WatchStock[] = [

    // ── LARGE CAP STABLE (low beta, institutional favorites) ──────────────────
    {
        symbol: 'HDFCBANK.NS', nseSymbol: 'HDFCBANK', name: 'HDFC Bank',
        category: 'large_cap_stable', marketCap: 'large', volatility: 'medium',
        beta: 0.9, avgDailyRange: 1.2, fnoStock: true,
        notes: 'Most liquid banking stock. Clean trends. Hunted daily near key levels.',
    },
    {
        symbol: 'TCS.NS', nseSymbol: 'TCS', name: 'Tata Consultancy Services',
        category: 'large_cap_stable', marketCap: 'large', volatility: 'low',
        beta: 0.7, avgDailyRange: 0.9, fnoStock: true,
        notes: 'Most stable IT large cap. Tracks USD/INR and Nasdaq overnight.',
    },
    {
        symbol: 'HINDUNILVR.NS', nseSymbol: 'HINDUNILVR', name: 'Hindustan Unilever',
        category: 'large_cap_stable', marketCap: 'large', volatility: 'low',
        beta: 0.5, avgDailyRange: 0.8, fnoStock: true,
        notes: 'Defensive. Outperforms in market downturns. Good for sector rotation signal.',
    },
    {
        symbol: 'NESTLEIND.NS', nseSymbol: 'NESTLEIND', name: 'Nestle India',
        category: 'large_cap_stable', marketCap: 'large', volatility: 'low',
        beta: 0.4, avgDailyRange: 0.7, fnoStock: false,
        notes: 'Ultra-stable FMCG. Useful as market sentiment gauge.',
    },
    {
        symbol: 'ASIANPAINT.NS', nseSymbol: 'ASIANPAINT', name: 'Asian Paints',
        category: 'large_cap_stable', marketCap: 'large', volatility: 'low',
        beta: 0.6, avgDailyRange: 0.9, fnoStock: true,
        notes: 'Premium consumer stock. Tracks urban consumption cycle.',
    },

    // ── LARGE CAP VOLATILE (high beta, moves 2-3x Nifty) ─────────────────────
    {
        symbol: 'TATAMOTORS.NS', nseSymbol: 'TATAMOTORS', name: 'Tata Motors',
        category: 'large_cap_volatile', marketCap: 'large', volatility: 'high',
        beta: 1.8, avgDailyRange: 3.2, fnoStock: true,
        notes: 'JLR driven. High daily range. Classic hunt target on support levels.',
    },
    {
        symbol: 'ADANIENT.NS', nseSymbol: 'ADANIENT', name: 'Adani Enterprises',
        category: 'large_cap_volatile', marketCap: 'large', volatility: 'extreme',
        beta: 2.1, avgDailyRange: 4.5, fnoStock: true,
        notes: 'Highest volatility Nifty 50 stock. Operators very active. High risk/reward.',
    },
    {
        symbol: 'BAJFINANCE.NS', nseSymbol: 'BAJFINANCE', name: 'Bajaj Finance',
        category: 'large_cap_volatile', marketCap: 'large', volatility: 'high',
        beta: 1.6, avgDailyRange: 2.8, fnoStock: true,
        notes: 'NBFC bellwether. Moves sharply on credit/RBI news. Regularly hunted.',
    },
    {
        symbol: 'RELIANCE.NS', nseSymbol: 'RELIANCE', name: 'Reliance Industries',
        category: 'large_cap_volatile', marketCap: 'large', volatility: 'medium',
        beta: 1.1, avgDailyRange: 1.5, fnoStock: true,
        notes: 'Heaviest Nifty weight. Moves market. Key level breaks = sector signal.',
    },
    {
        symbol: 'LT.NS', nseSymbol: 'LT', name: 'Larsen & Toubro',
        category: 'large_cap_volatile', marketCap: 'large', volatility: 'medium',
        beta: 1.3, avgDailyRange: 1.8, fnoStock: true,
        notes: 'Capex/infra proxy. Moves on govt order announcements.',
    },

    // ── BANKING (most hunted sector in NSE) ───────────────────────────────────
    {
        symbol: 'ICICIBANK.NS', nseSymbol: 'ICICIBANK', name: 'ICICI Bank',
        category: 'banking', marketCap: 'large', volatility: 'medium',
        beta: 1.2, avgDailyRange: 1.6, fnoStock: true,
        notes: 'Second most liquid. Leads banking sector moves.',
    },
    {
        symbol: 'SBIN.NS', nseSymbol: 'SBIN', name: 'State Bank of India',
        category: 'banking', marketCap: 'large', volatility: 'high',
        beta: 1.4, avgDailyRange: 2.1, fnoStock: true,
        notes: 'PSU bank bellwether. High retail participation = frequent hunts.',
    },
    {
        symbol: 'AXISBANK.NS', nseSymbol: 'AXISBANK', name: 'Axis Bank',
        category: 'banking', marketCap: 'large', volatility: 'high',
        beta: 1.5, avgDailyRange: 2.0, fnoStock: true,
        notes: 'Private bank. Moves with credit cycle. Good intraday range.',
    },
    {
        symbol: 'KOTAKBANK.NS', nseSymbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank',
        category: 'banking', marketCap: 'large', volatility: 'medium',
        beta: 1.0, avgDailyRange: 1.4, fnoStock: true,
        notes: 'Premium valuation bank. Slower mover but clean patterns.',
    },
    {
        symbol: 'BANKBARODA.NS', nseSymbol: 'BANKBARODA', name: 'Bank of Baroda',
        category: 'banking', marketCap: 'large', volatility: 'high',
        beta: 1.6, avgDailyRange: 2.5, fnoStock: true,
        notes: 'PSU bank. Lower price = more retail = more hunt activity.',
    },

    // ── IT SECTOR ─────────────────────────────────────────────────────────────
    {
        symbol: 'INFY.NS', nseSymbol: 'INFY', name: 'Infosys',
        category: 'it', marketCap: 'large', volatility: 'medium',
        beta: 0.8, avgDailyRange: 1.3, fnoStock: true,
        notes: 'Quarterly results volatility. Tracks Nasdaq and USD strength.',
    },
    {
        symbol: 'WIPRO.NS', nseSymbol: 'WIPRO', name: 'Wipro',
        category: 'it', marketCap: 'large', volatility: 'medium',
        beta: 0.9, avgDailyRange: 1.5, fnoStock: true,
        notes: 'Mid-range IT. Lags TCS/Infy but follows same sector trend.',
    },
    {
        symbol: 'HCLTECH.NS', nseSymbol: 'HCLTECH', name: 'HCL Technologies',
        category: 'it', marketCap: 'large', volatility: 'medium',
        beta: 0.85, avgDailyRange: 1.4, fnoStock: true,
        notes: 'Product + services mix. Sometimes diverges from pure IT pack.',
    },
    {
        symbol: 'TECHM.NS', nseSymbol: 'TECHM', name: 'Tech Mahindra',
        category: 'it', marketCap: 'large', volatility: 'high',
        beta: 1.1, avgDailyRange: 2.0, fnoStock: true,
        notes: 'Telecom + IT. Higher beta than peers. More intraday opportunity.',
    },
    {
        symbol: 'LTIM.NS', nseSymbol: 'LTIM', name: 'LTIMindtree',
        category: 'it', marketCap: 'mid', volatility: 'high',
        beta: 1.2, avgDailyRange: 2.2, fnoStock: true,
        notes: 'Mid-cap IT. Higher volatility. Good for momentum plays.',
    },

    // ── PHARMA ────────────────────────────────────────────────────────────────
    {
        symbol: 'SUNPHARMA.NS', nseSymbol: 'SUNPHARMA', name: 'Sun Pharmaceutical',
        category: 'pharma', marketCap: 'large', volatility: 'medium',
        beta: 0.7, avgDailyRange: 1.5, fnoStock: true,
        notes: 'Largest pharma. Defensive + US generics exposure. FDA event risk.',
    },
    {
        symbol: 'DRREDDY.NS', nseSymbol: 'DRREDDY', name: "Dr Reddy's Laboratories",
        category: 'pharma', marketCap: 'large', volatility: 'medium',
        beta: 0.65, avgDailyRange: 1.4, fnoStock: true,
        notes: 'US/EU generics. Clean uptrend historically. Defensive in corrections.',
    },
    {
        symbol: 'CIPLA.NS', nseSymbol: 'CIPLA', name: 'Cipla',
        category: 'pharma', marketCap: 'large', volatility: 'medium',
        beta: 0.6, avgDailyRange: 1.3, fnoStock: true,
        notes: 'Domestic + export mix. Lower US-risk than peers.',
    },
    {
        symbol: 'DIVISLAB.NS', nseSymbol: 'DIVISLAB', name: "Divi's Laboratories",
        category: 'pharma', marketCap: 'large', volatility: 'high',
        beta: 0.75, avgDailyRange: 1.8, fnoStock: true,
        notes: 'API manufacturer. Moves on raw material costs and global demand.',
    },

    // ── AUTO ──────────────────────────────────────────────────────────────────
    {
        symbol: 'MARUTI.NS', nseSymbol: 'MARUTI', name: 'Maruti Suzuki',
        category: 'auto', marketCap: 'large', volatility: 'medium',
        beta: 0.9, avgDailyRange: 1.5, fnoStock: true,
        notes: 'Domestic passenger vehicle leader. Tracks monthly sales data.',
    },
    {
        symbol: 'BAJAJ-AUTO.NS', nseSymbol: 'BAJAJ-AUTO', name: 'Bajaj Auto',
        category: 'auto', marketCap: 'large', volatility: 'medium',
        beta: 0.85, avgDailyRange: 1.4, fnoStock: true,
        notes: 'Two-wheeler + EV play. Steady dividend history = institutional holding.',
    },
    {
        symbol: 'EICHERMOT.NS', nseSymbol: 'EICHERMOT', name: 'Eicher Motors',
        category: 'auto', marketCap: 'large', volatility: 'high',
        beta: 1.1, avgDailyRange: 2.0, fnoStock: true,
        notes: 'Royal Enfield parent. Premium segment. Strong retail following.',
    },
    {
        symbol: 'M&M.NS', nseSymbol: 'M&M', name: 'Mahindra & Mahindra',
        category: 'auto', marketCap: 'large', volatility: 'high',
        beta: 1.2, avgDailyRange: 2.2, fnoStock: true,
        notes: 'SUV + tractor + EV. Multiple business drivers. High momentum phases.',
    },

    // ── METALS (China-linked, commodity cycle) ────────────────────────────────
    {
        symbol: 'TATASTEEL.NS', nseSymbol: 'TATASTEEL', name: 'Tata Steel',
        category: 'metals', marketCap: 'large', volatility: 'high',
        beta: 1.7, avgDailyRange: 3.0, fnoStock: true,
        notes: 'Most volatile Nifty 50 metal. Tracks iron ore prices and China PMI.',
    },
    {
        symbol: 'JSWSTEEL.NS', nseSymbol: 'JSWSTEEL', name: 'JSW Steel',
        category: 'metals', marketCap: 'large', volatility: 'high',
        beta: 1.6, avgDailyRange: 2.8, fnoStock: true,
        notes: 'Domestic steel bellwether. Moves with capex cycle.',
    },
    {
        symbol: 'HINDALCO.NS', nseSymbol: 'HINDALCO', name: 'Hindalco Industries',
        category: 'metals', marketCap: 'large', volatility: 'high',
        beta: 1.5, avgDailyRange: 2.5, fnoStock: true,
        notes: 'Aluminium + copper. Novelis (US) exposure adds global angle.',
    },
    {
        symbol: 'COALINDIA.NS', nseSymbol: 'COALINDIA', name: 'Coal India',
        category: 'metals', marketCap: 'large', volatility: 'medium',
        beta: 0.8, avgDailyRange: 1.5, fnoStock: true,
        notes: 'PSU. High dividend yield = institutional anchoring. Slower moves.',
    },

    // ── MID CAP (higher risk/reward, less institutional coverage) ─────────────
    {
        symbol: 'PERSISTENT.NS', nseSymbol: 'PERSISTENT', name: 'Persistent Systems',
        category: 'mid_cap', marketCap: 'mid', volatility: 'high',
        beta: 1.3, avgDailyRange: 2.8, fnoStock: true,
        notes: 'Mid-IT. Faster grower than large IT. High momentum potential.',
    },
    {
        symbol: 'POLICYBZR.NS', nseSymbol: 'POLICYBZR', name: 'PB Fintech (PolicyBazaar)',
        category: 'mid_cap', marketCap: 'mid', volatility: 'extreme',
        beta: 1.9, avgDailyRange: 4.0, fnoStock: true,
        notes: 'New-age fintech. High retail interest. Wild swings = high opportunity.',
    },
    {
        symbol: 'ZOMATO.NS', nseSymbol: 'ZOMATO', name: 'Zomato',
        category: 'mid_cap', marketCap: 'large', volatility: 'extreme',
        beta: 1.8, avgDailyRange: 3.8, fnoStock: true,
        notes: 'Consumer internet. Huge retail following. Classic pump-dump patterns.',
    },
    {
        symbol: 'PAYTM.NS', nseSymbol: 'PAYTM', name: 'One97 Communications',
        category: 'mid_cap', marketCap: 'mid', volatility: 'extreme',
        beta: 2.2, avgDailyRange: 5.0, fnoStock: false,
        notes: 'High retail speculation. Distressed then recovery. Pattern study stock.',
    },
    {
        symbol: 'DIXON.NS', nseSymbol: 'DIXON', name: 'Dixon Technologies',
        category: 'mid_cap', marketCap: 'mid', volatility: 'high',
        beta: 1.5, avgDailyRange: 3.2, fnoStock: true,
        notes: 'PLI electronics manufacturer. Strong growth story. Momentum stock.',
    },
    {
        symbol: 'IRFC.NS', nseSymbol: 'IRFC', name: 'Indian Railway Finance Corp',
        category: 'mid_cap', marketCap: 'large', volatility: 'high',
        beta: 1.4, avgDailyRange: 2.5, fnoStock: true,
        notes: 'PSU infrastructure. High retail ownership. Budget-sensitive.',
    },
    {
        symbol: 'CDSL.NS', nseSymbol: 'CDSL', name: 'Central Depository Services',
        category: 'mid_cap', marketCap: 'mid', volatility: 'high',
        beta: 1.3, avgDailyRange: 2.8, fnoStock: true,
        notes: 'Benefits from demat account growth. Tracks overall market activity.',
    },
    {
        symbol: 'KALYANKJIL.NS', nseSymbol: 'KALYANKJIL', name: 'Kalyan Jewellers',
        category: 'mid_cap', marketCap: 'mid', volatility: 'high',
        beta: 1.1, avgDailyRange: 2.5, fnoStock: false,
        notes: 'Jewellery retail. Tracks gold prices + wedding season.',
    },

    // ── COMMODITY PROXY (gold, silver, oil via NSE instruments) ──────────────
    {
        symbol: 'GOLDBEES.NS', nseSymbol: 'GOLDBEES', name: 'Nippon Gold ETF',
        category: 'commodity_proxy', marketCap: 'large', volatility: 'low',
        beta: -0.2, avgDailyRange: 0.6, fnoStock: false,
        notes: 'Gold ETF. Inverse to equities. Critical for hedge/risk-off signal.',
    },
    {
        symbol: 'SILVERBEES.NS', nseSymbol: 'SILVERBEES', name: 'Mirae Silver ETF',
        category: 'commodity_proxy', marketCap: 'large', volatility: 'medium',
        beta: -0.1, avgDailyRange: 1.0, fnoStock: false,
        notes: 'Silver ETF. More volatile than gold. Industrial + precious metal mix.',
    },
    {
        symbol: 'ONGC.NS', nseSymbol: 'ONGC', name: 'ONGC',
        category: 'commodity_proxy', marketCap: 'large', volatility: 'high',
        beta: 0.9, avgDailyRange: 1.8, fnoStock: true,
        notes: 'Crude oil proxy. Tracks Brent crude. PSU = political risk overlay.',
    },
    {
        symbol: 'IOC.NS', nseSymbol: 'IOC', name: 'Indian Oil Corporation',
        category: 'commodity_proxy', marketCap: 'large', volatility: 'high',
        beta: 0.85, avgDailyRange: 2.0, fnoStock: true,
        notes: 'Downstream oil. Refining margin proxy. High retail, frequently hunted.',
    },
    {
        symbol: 'BPCL.NS', nseSymbol: 'BPCL', name: 'Bharat Petroleum',
        category: 'commodity_proxy', marketCap: 'large', volatility: 'high',
        beta: 0.9, avgDailyRange: 2.1, fnoStock: true,
        notes: 'Oil refiner + retailer. Disinvestment overhang. High event risk.',
    },
    {
        symbol: 'UPL.NS', nseSymbol: 'UPL', name: 'UPL Limited',
        category: 'commodity_proxy', marketCap: 'large', volatility: 'extreme',
        beta: 1.7, avgDailyRange: 3.5, fnoStock: true,
        notes: 'Agrochemical = monsoon + commodity proxy. High debt = high volatility.',
    },

    // ── REALTY + INFRA (high beta, budget sensitive) ──────────────────────────
    {
        symbol: 'DLF.NS', nseSymbol: 'DLF', name: 'DLF',
        category: 'large_cap_volatile', marketCap: 'large', volatility: 'high',
        beta: 1.6, avgDailyRange: 2.8, fnoStock: true,
        notes: 'Real estate bellwether. Tracks property cycle. Huge retail following.',
    },
    {
        symbol: 'NTPC.NS', nseSymbol: 'NTPC', name: 'NTPC',
        category: 'large_cap_stable', marketCap: 'large', volatility: 'low',
        beta: 0.7, avgDailyRange: 1.2, fnoStock: true,
        notes: 'Power PSU. Stable dividend. Tracks energy policy.',
    },
    {
        symbol: 'ITC.NS', nseSymbol: 'ITC', name: 'ITC',
        category: 'large_cap_stable', marketCap: 'large', volatility: 'low',
        beta: 0.6, avgDailyRange: 1.0, fnoStock: true,
        notes: 'FMCG + cigarettes. High dividend yield. Budget-sensitive (excise duty).',
    },
];

// ── Helper functions ───────────────────────────────────────────────────────────

export type Sector = Category;

export function getByCategory(category: Category): WatchStock[] {
    return WATCHLIST.filter(s => s.category === category);
}

export function getByVolatility(v: VolatilityProfile): WatchStock[] {
    return WATCHLIST.filter(s => s.volatility === v);
}

export function getByMarketCap(cap: 'large' | 'mid' | 'small'): WatchStock[] {
    return WATCHLIST.filter(s => s.marketCap === cap);
}

export function getFnoStocks(): WatchStock[] {
    return WATCHLIST.filter(s => s.fnoStock);
}

export const CATEGORIES: Category[] = [
    'large_cap_stable', 'large_cap_volatile', 'mid_cap',
    'banking', 'it', 'pharma', 'auto', 'metals', 'commodity_proxy',
];
