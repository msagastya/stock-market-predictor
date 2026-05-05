# Stock & Mutual Fund Analyzer

## Source Of Truth

The authoritative project vision and execution roadmap now lives in [`docs/SOLE_TRUTH.md`](./docs/SOLE_TRUTH.md).

Use that document as the default reference for:
- project scope
- completion baseline
- roadmap order
- implementation priorities

A production-ready web application for analyzing stocks and mutual funds with advanced technical analysis, candlestick pattern detection, and AI-powered trading recommendations.

## ✨ Features

### 🎯 Core Analysis
- **Technical Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands
- **Candlestick Patterns**: 10+ patterns including Hammer, Doji, Engulfing, Morning/Evening Star
- **Volume Analysis**: Price-volume correlation, spike detection, trend confirmation
- **Signal Scoring**: Weighted recommendation system (Strong Buy to Strong Sell)
- **Trading Tips**: 20+ contextual educational tips based on market conditions

### 📊 Data Sources (100% FREE)
- **Yahoo Finance**: Global stocks, historical data, real-time quotes
- **NSE India**: Indian stocks and indices (official exchange data)
- **AMFI India**: Official mutual fund NAV data

### 💻 UI/UX
- **Responsive Design**: Mobile-first, works on all devices
- **Dark/Light Mode**: Complete theme support
- **Professional Dashboard**: Trading-grade interface
- **Real-time Updates**: Live analysis and recommendations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Clone or navigate to the project
cd stock-market-analyzer

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## 🏗️ Project Structure

```
stock-market-analyzer/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── page.tsx         # Main application
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── lib/
│   │   ├── analysis/        # Analysis engine
│   │   │   ├── technical-indicators.ts
│   │   │   ├── candlestick-detector.ts
│   │   │   ├── volume-analyzer.ts
│   │   │   ├── signal-scorer.ts
│   │   │   └── tips-database.ts
│   │   ├── api/             # Data services
│   │   │   ├── yahoo-finance.ts
│   │   │   ├── nse-india.ts
│   │   │   ├── amfi-india.ts
│   │   │   └── cache-manager.ts
│   │   └── utils/           # Utilities
│   └── types/               # TypeScript definitions
└── docs/                    # Documentation
```

## 📖 Documentation

- [Strategy Engine](./docs/STRATEGY_ENGINE.md) - Technical analysis algorithms
- [Data Sources](./docs/DATA_SOURCES.md) - API integration details
- [Extending](./docs/EXTENDING.md) - How to add features

## 🔧 Configuration

No API keys required! The application uses completely free public data sources.

Optional environment variables:

```env
# .env.local (optional)
ENABLE_GLOBAL_STOCKS=true
ENABLE_INDIAN_STOCKS=true

# Optional professional search/market provider
# Kite Connect instruments dump is used only when both values are present.
KITE_API_KEY=your_kite_api_key
KITE_ACCESS_TOKEN=your_kite_access_token

# Yahoo is disabled by default for India-first search/research because
# the public endpoint is unstable and rate-limits aggressively.
ENABLE_YAHOO_SEARCH=false
ENABLE_YAHOO_RESEARCH=false
ENABLE_YAHOO_QUOTES=false

# Professional mode:
# keep these false if you do not want synthetic/fake market data shown.
ENABLE_SYNTHETIC_ANALYSIS=false
ENABLE_SYNTHETIC_QUOTES=false
```

## 📈 Analysis Engine

### Technical Indicators
- **SMA (20, 50, 200)**: Trend identification
- **EMA (12, 26)**: Faster trend detection
- **RSI (14)**: Overbought/oversold conditions
- **MACD**: Momentum and trend strength
- **Bollinger Bands**: Volatility and price levels

### Candlestick Patterns
- Bullish: Hammer, Inverted Hammer, Bullish Engulfing, Morning Star
- Bearish: Shooting Star, Hanging Man, Bearish Engulfing, Evening Star
- Neutral: Doji variations

### Signal Scoring
Combines all indicators with weighted confidence:
- High confidence signals = 1.5x weight
- Medium confidence = 1.0x weight
- Low confidence = 0.5x weight

Final rating: **Strong Buy** (+3) to **Strong Sell** (-3)

## 🎓 Trading Tips

The app provides contextual educational tips based on:
- RSI overbought/oversold conditions
- MACD crossovers
- Volume spikes
- Detected candlestick patterns
- Trend strength

**Important**: All tips are educational only, not financial advice.

## ⚠️ Disclaimer

This application is for **educational purposes only** and is **NOT financial advice**.

- Always conduct your own research
- Consult qualified financial advisors
- Never invest more than you can afford to lose
- Past performance doesn't guarantee future results
- Trading involves substantial risk

## 🛠️ Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Lightweight Charts (planned)
- **Data**: Yahoo Finance, NSE India, AMFI India

## 📱 Features Roadmap

Current demo includes core analysis. Full features:
- [ ] Interactive charts with TradingView integration
- [ ] Watchlist management
- [ ] Portfolio tracking with P&L
- [ ] Historical backtesting
- [ ] Alerts and notifications
- [ ] Export reports (PDF)

## 📄 License

MIT License - Free to use and modify

## 🤝 Contributing

This is an educational project. Feel free to fork and extend!

## 📞 Support

For issues or questions, please refer to the documentation in the `/docs` folder.

---

**Built with ❤️ for traders and investors**

*Remember: Trade responsibly, manage risk, and never stop learning!*
