# Data Sources Documentation

## Overview

This application uses 100% free public data sources - **no API keys or subscriptions required**. All data is fetched directly from official sources or public APIs.

## 1. Yahoo Finance

**Purpose:** Global stock market data

**Endpoints:**
- Search: `https://query1.finance.yahoo.com/v1/finance/search`
- Quote: `https://query1.finance.yahoo.com/v7/finance/quote`
- Historical: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`

**Data Available:**
- Real-time/delayed stock quotes
- Historical OHLCV data (Open, High, Low, Close, Volume)
- Company fundamentals (P/E ratio, market cap, etc.)
- Symbol search and autocomplete

**Rate Limits:** None (public API)

**Authentication:** Not required

**Example Usage:**
```typescript
// Get historical data for Apple stock
const url = `https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1y`;
const response = await fetch(url);
const data = await response.json();
```

**Supported Markets:**
- US: NASDAQ, NYSE (e.g., AAPL, MSFT, GOOGL)
- India: NSE/BSE with `.NS` or `.BO` suffix (e.g., RELIANCE.NS)
- Global: Most major exchanges

## 2. NSE India (National Stock Exchange)

**Purpose:** Official Indian stock market data

**Base URL:** `https://www.nseindia.com`

**Key Endpoints:**
- Quote: `/api/quote-equity?symbol={symbol}`
- Search: `/api/search/autocomplete?q={query}`
- Indices: `/api/allIndices`
- Top Gainers: `/api/live-analysis-variations?index=gainers`
- Top Losers: `/api/live-analysis-variations?index=losers`

**Data Available:**
- Live stock quotes (NSE listed companies)
- Index data (NIFTY 50, BANK NIFTY, etc.)
- Corporate actions
- Market movers (gainers/losers)

**Rate Limits:** None (public website data)

**Authentication:** Not required (but requires proper headers)

**Important Headers:**
```javascript
{
  'User-Agent': 'Mozilla/5.0...',
  'Accept': 'application/json'
}
```

**Example Companies:**
- RELIANCE (Reliance Industries)
- TCS (Tata Consultancy Services)
- INFY (Infosys)
- HDFCBANK (HDFC Bank)

**Note:** For historical data, we use Yahoo Finance with `.NS` suffix (e.g., `RELIANCE.NS`)

## 3. AMFI India (Association of Mutual Funds in India)

**Purpose:** Official mutual fund NAV data

**Data URL:** `https://www.amfiindia.com/spages/NAVAll.txt`

**Data Format:** Plain text file with semicolon-separated values

**Update Frequency:** Daily (business days)

**Data Available:**
- Latest NAV (Net Asset Value) for all mutual funds
- Scheme code and name
- Fund house (AMC) name
- Fund category
- Date of NAV

**File Format:**
```
Scheme Code;ISIN;Scheme Name;Net Asset Value;Date
```

**Example Entry:**
```
101206;;Aditya Birla Sun Life Arbitrage Fund - Regular - Growth;10.5432;25-Nov-2024
```

**Parsing Strategy:**
1. Download full NAV file
2. Parse fund house and category headers
3. Extract scheme data
4. Cache for 24 hours

**Fund Categories:**
- Equity Schemes
- Debt Schemes
- Hybrid Schemes
- Solution Oriented Schemes
- Other Schemes

## Data Caching Strategy

To minimize redundant requests and improve performance:

### Client-Side Caching
```typescript
const cache = new Map<string, CacheEntry>();

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // milliseconds
}
```

### Cache TTL (Time To Live)
- Stock quotes: 1 minute
- Historical data: 1 hour
- Mutual fund NAV: 24 hours (updates daily)
- Search results: 5 minutes

### Cache Keys
```
yahoo-quote:{symbol}
yahoo-historical:{symbol}:{period}
nse-quote:{symbol}
amfi-nav:{schemeCode}
```

## Error Handling

### Network Errors
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Network error');
  return await response.json();
} catch (error) {
  console.error('API error:', error);
  return fallbackData; // Return cached or mock data
}
```

### CORS Issues
If running from browser:
- Use Next.js API routes as proxy
- Server-side fetching avoids CORS

### Rate Limiting
While free APIs don't have explicit limits:
- Implement exponential backoff
- Cache aggressively
- Batch requests when possible

## Data Quality

### Yahoo Finance
- ✅ High quality, reliable
- ✅ Real-time for major markets
- ⚠️ Delayed data for some exchanges (15-20 min)

### NSE India
- ✅ Official exchange data
- ✅ Real-time during market hours
- ⚠️ May block excessive scraping

### AMFI
- ✅ Official regulatory data
- ✅ 100% accurate NAV
- ⚠️ Updates once per day (EOD)

## Future Enhancements

### Additional Free Sources
1. **BSE India** - Bombay Stock Exchange data
2. **Cryptocurrency** - CoinGecko API (free tier)
3. **Forex** - ExchangeRate-API (free tier)
4. **Economic Indicators** - FRED API (free with key)

### Historical NAV Tracking
For mutual funds, implement:
- Daily NAV storage (local/database)
- Performance calculations (returns over time)
- Comparison across schemes

## Best Practices

1. **Respect Sources:** Don't abuse free APIs
2. **Cache Wisely:** Reduce unnecessary requests
3. **Handle Failures:** Always have fallback data
4. **User Experience:** Show loading states, not errors
5. **Legal Compliance:** Review terms of service

## Troubleshooting

### Yahoo Finance Not Working
- Check symbol format (e.g., `AAPL` not `aapl`)
- Verify endpoint URL
- Check network connectivity

### NSE India Access Blocked
- Verify User-Agent header
- Don't make excessive requests
- Use Yahoo Finance as fallback (`.NS` suffix)

### AMFI File Parse Error
- Check file encoding (UTF-8)
- Verify line endings
- Handle malformed lines gracefully

## Compliance & Legal

- All sources are publicly available
- No authentication/API keys = no TOS violations
- Data is for personal/educational use
- Do not redistribute scraped data commercially

---

**Summary: This application is 100% free to run with no recurring costs or API subscriptions.**
