/**
 * Curated watchlist of liquid NSE stocks — high F&O participation,
 * regularly hunted, sector leaders. Paper trading tracks these daily.
 */

export interface WatchStock {
    symbol: string;         // Yahoo Finance format
    nseSymbol: string;      // Pure NSE symbol
    name: string;
    sector: Sector;
    lotSize: number;        // F&O lot size (proxy for institutional interest)
    avgDailyVolume: number; // approx shares/day
}

export type Sector = 'banking' | 'it' | 'auto' | 'pharma' | 'fmcg' | 'energy' | 'metals' | 'realty';

export const WATCHLIST: WatchStock[] = [
    // Banking — most hunted sector
    { symbol: 'HDFCBANK.NS',   nseSymbol: 'HDFCBANK',   name: 'HDFC Bank',         sector: 'banking', lotSize: 550,  avgDailyVolume: 15000000 },
    { symbol: 'ICICIBANK.NS',  nseSymbol: 'ICICIBANK',  name: 'ICICI Bank',         sector: 'banking', lotSize: 700,  avgDailyVolume: 18000000 },
    { symbol: 'SBIN.NS',       nseSymbol: 'SBIN',       name: 'State Bank',         sector: 'banking', lotSize: 1500, avgDailyVolume: 25000000 },
    { symbol: 'AXISBANK.NS',   nseSymbol: 'AXISBANK',   name: 'Axis Bank',          sector: 'banking', lotSize: 1200, avgDailyVolume: 12000000 },
    { symbol: 'KOTAKBANK.NS',  nseSymbol: 'KOTAKBANK',  name: 'Kotak Bank',         sector: 'banking', lotSize: 400,  avgDailyVolume: 6000000  },
    { symbol: 'BAJFINANCE.NS', nseSymbol: 'BAJFINANCE', name: 'Bajaj Finance',      sector: 'banking', lotSize: 125,  avgDailyVolume: 3500000  },

    // IT — moves on global cues
    { symbol: 'TCS.NS',        nseSymbol: 'TCS',        name: 'TCS',                sector: 'it',   lotSize: 150,  avgDailyVolume: 4000000  },
    { symbol: 'INFY.NS',       nseSymbol: 'INFY',       name: 'Infosys',            sector: 'it',   lotSize: 400,  avgDailyVolume: 8000000  },
    { symbol: 'WIPRO.NS',      nseSymbol: 'WIPRO',      name: 'Wipro',              sector: 'it',   lotSize: 1500, avgDailyVolume: 6000000  },
    { symbol: 'HCLTECH.NS',    nseSymbol: 'HCLTECH',    name: 'HCL Tech',           sector: 'it',   lotSize: 350,  avgDailyVolume: 5000000  },
    { symbol: 'TECHM.NS',      nseSymbol: 'TECHM',      name: 'Tech Mahindra',      sector: 'it',   lotSize: 600,  avgDailyVolume: 4000000  },

    // Auto — domestic economy proxy
    { symbol: 'TATAMOTORS.NS', nseSymbol: 'TATAMOTORS', name: 'Tata Motors',        sector: 'auto', lotSize: 1400, avgDailyVolume: 20000000 },
    { symbol: 'MARUTI.NS',     nseSymbol: 'MARUTI',     name: 'Maruti Suzuki',      sector: 'auto', lotSize: 100,  avgDailyVolume: 1200000  },
    { symbol: 'BAJAJ-AUTO.NS', nseSymbol: 'BAJAJ-AUTO', name: 'Bajaj Auto',         sector: 'auto', lotSize: 250,  avgDailyVolume: 1000000  },

    // Pharma
    { symbol: 'SUNPHARMA.NS',  nseSymbol: 'SUNPHARMA',  name: 'Sun Pharma',         sector: 'pharma', lotSize: 700,  avgDailyVolume: 5000000  },
    { symbol: 'DRREDDY.NS',    nseSymbol: 'DRREDDY',    name: 'Dr Reddy\'s',        sector: 'pharma', lotSize: 125,  avgDailyVolume: 1500000  },
    { symbol: 'CIPLA.NS',      nseSymbol: 'CIPLA',      name: 'Cipla',              sector: 'pharma', lotSize: 650,  avgDailyVolume: 3000000  },

    // FMCG — defensive
    { symbol: 'HINDUNILVR.NS', nseSymbol: 'HINDUNILVR', name: 'HUL',                sector: 'fmcg', lotSize: 300,  avgDailyVolume: 2500000  },
    { symbol: 'ITC.NS',        nseSymbol: 'ITC',        name: 'ITC',                sector: 'fmcg', lotSize: 3200, avgDailyVolume: 20000000 },

    // Energy & heavy
    { symbol: 'RELIANCE.NS',   nseSymbol: 'RELIANCE',   name: 'Reliance',           sector: 'energy', lotSize: 250,  avgDailyVolume: 8000000  },
    { symbol: 'ONGC.NS',       nseSymbol: 'ONGC',       name: 'ONGC',               sector: 'energy', lotSize: 1925, avgDailyVolume: 15000000 },

    // Metals
    { symbol: 'TATASTEEL.NS',  nseSymbol: 'TATASTEEL',  name: 'Tata Steel',         sector: 'metals', lotSize: 5500, avgDailyVolume: 35000000 },
    { symbol: 'JSWSTEEL.NS',   nseSymbol: 'JSWSTEEL',   name: 'JSW Steel',          sector: 'metals', lotSize: 600,  avgDailyVolume: 5000000  },

    // Realty — high beta, frequently hunted
    { symbol: 'DLF.NS',        nseSymbol: 'DLF',        name: 'DLF',                sector: 'realty', lotSize: 1650, avgDailyVolume: 10000000 },
    { symbol: 'GODREJPROP.NS', nseSymbol: 'GODREJPROP', name: 'Godrej Properties',  sector: 'realty', lotSize: 350,  avgDailyVolume: 1500000  },
];

export const SECTORS: Sector[] = ['banking', 'it', 'auto', 'pharma', 'fmcg', 'energy', 'metals', 'realty'];

export function getStocksBySector(sector: Sector): WatchStock[] {
    return WATCHLIST.filter(s => s.sector === sector);
}
