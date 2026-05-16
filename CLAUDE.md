# Stock Market Predictor — Claude Context

## Purpose
NSE India paper trading system with AI-powered signal detection, backtesting, and autonomous execution. Runs fully server-side on Vercel + GitHub Actions. No real money — paper only until proven profitable.

## Tech Stack
- **Framework**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **Hosting**: Vercel (hobby tier, free) — manual deploy via `vercel --prod --yes`
- **Database**: Firebase Firestore (REST API only, no SDK — all string values)
- **Data**: Yahoo Finance (`yahoo-finance2`), NSE India scraping, Kite Connect (Zerodha broker)
- **AI Brain**: Groq API (`llama-3.1-8b-instant`, free tier) via `/api/trading/brain`
- **Local AI**: Hermes CLI (Ollama llama3.1:8b) — fallback when Mac is on
- **CI/CD**: GitHub Actions (repo: `msagastya/stock-market-predictor`)
- **Env**: `GROQ_API_KEY`, `TRADING_SECRET`, `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `VERCEL_APP_URL` in GitHub Secrets + Vercel

## Commands
```bash
npm run dev          # local dev at http://localhost:1803
npm run build        # type-check + build
vercel --prod --yes  # deploy (auto-deploy is BROKEN — always use CLI)
git push             # pushes to github.com/msagastya/stock-market-predictor
```

## Folder Structure
```
src/
  app/
    page.tsx                    # Market dashboard (home)
    alerts/, screener/, watchlist/, portfolio/, zerodha/, paper-trading/
    api/
      trading/
        run/route.ts            # Main tick endpoint (?mode=tick|morning_scan|eod)
        brain/route.ts          # Groq AI brain (morning analysis + EOD review)
        paper/route.ts          # Read paper trade history from Firestore
        backtest/route.ts       # Chunked backtest (?period=6m|1y|3y&chunk=N|merge)
        morning-scan/route.ts   # Morning scan read/write
        intraday-exit/route.ts  # Force-exit all open positions
      market/overview/, quotes/, stock/
      kite/                     # Zerodha Kite Connect integration
  lib/
    trading/
      signal-engine.ts          # SOLE TRUTH for signals — used by paper + live
      paper-engine.ts           # 3 risk profiles: conservative/moderate/aggressive
      hunt-detector.ts          # Stop-hunt / liquidity sweep detection
      pattern-library.ts        # ORB, VWAP reclaim, momentum exhaustion, etc.
      calendar-conditions.ts    # NSE expiry, festivals, budget, RBI, seasonal sectors
      autonomous-engine.ts      # Live Kite order placement (future use)
      watchlist.ts              # 50 stocks across 9 categories
      charge-calculator.ts      # STT, brokerage, SEBI fees — accurate P&L
      ai-analyst.ts             # Rule-based signal validator (no API key needed)
      morning-scanner.ts        # Pre-market stock scoring
    firebase-store.ts           # Firestore REST (ALL values must be strings)
    api/
      yahoo-finance.ts, nse-india.ts, kite-connect.ts, cache-manager.ts
  features/market/              # Market dashboard components + hooks
agents/
  morning-brain.py              # Local Hermes morning analysis (runs on Mac)
  signal-brain.py               # On-demand signal validator (local only)
  eod-brain.py                  # Local EOD learning (runs on Mac)
.github/workflows/
  paper-trading.yml             # MAIN workflow — brain+scan at 7AM, ticks 9-15:30, EOD
  run-backtest.yml              # Manual chunked backtest trigger
  trading-cron.yml              # DISABLED (superseded by paper-trading.yml)
```

## Key Architectural Decisions
- **Firestore is the bridge**: Local Hermes writes analysis → Firestore → Vercel reads it during ticks
- **All Firestore values are strings**: `firestoreSet` only accepts `Record<string, string>` — cast numbers with `String()`
- **Signal engine is single source of truth**: `signal-engine.ts` used by both paper and live — never duplicate signal logic
- **3 risk profiles run in parallel**: Every signal evaluated by conservative (₹25K), moderate (₹40K), aggressive (₹60K) simultaneously
- **Vercel auto-deploy is broken**: Must run `vercel --prod --yes` manually after every push
- **Backtests are chunked**: 6m=1 chunk, 1y=4 chunks, 3y=12 chunks — call `?chunk=merge` after all chunks save
- **Brain hierarchy**: Groq (server, free) → local Hermes (Mac only) → rule-based fallback (ai-analyst.ts)
- **Calendar conditions**: Every trade tagged with expiry/festival/seasonal context for pattern learning

## GitHub Actions Schedule (IST)
| Time | Job | What it does |
|------|-----|--------------|
| 7:00 AM | `morning_scan` | Groq brain analyzes market → sets day_bias in Firestore → morning scan scores stocks |
| 9:10 AM | `session_1` | Tick loop 9:10–11:15, fires every ~2 min |
| 11:15 AM | `session_2` | Tick loop 11:15–13:15 |
| 1:15 PM | `session_3` | Tick loop 13:15–15:35, then EOD close + Groq EOD review |

## Firestore Collections
| Collection | Key | Contents |
|---|---|---|
| `morning_scan` | `YYYY-MM-DD` | day_bias, signal_bias, trading_plan, brain source |
| `paper_trades` | `YYYY-MM-DD` | all trades for the day (stringified JSON array) |
| `trading_memory` | `eod_YYYY-MM-DD` | EOD review: what_worked, key_pattern, bias_score |
| `backtest` | `summary_6m` / `chunk_3y_1` | backtest results + condition stats |

## Current Roadmap Phase
**Phase 2 — Learning & Validation** (in progress)
- [x] Paper trading engine with 3 risk profiles
- [x] Signal engine: hunt detection, ORB, VWAP, pattern library
- [x] Charge calculator (accurate P&L)
- [x] Calendar conditions (expiry, festivals, seasonal sectors)
- [x] Groq brain: server-side AI morning analysis + EOD review
- [x] Backtesting with condition-pattern tracking
- [ ] Backtest results UI (conditionStats, monthly P&L, top patterns)
- [ ] Wire signal-brain validation into live tick (replace auto-approve)
- [ ] Phase 3: Live trading via Kite when paper shows >55% win rate over 60 days
