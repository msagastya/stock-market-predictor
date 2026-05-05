# Sole Truth

This document is the source of truth for what this project is, what it is not, and how work will proceed from here.

## Baseline

The current repository is not a near-finished product. It is an early foundation.

Working assumption:
- Current repo completion against the intended product vision: `5/100`
- Remaining work to reach the intended product vision: `95/100`

This framing overrides any earlier assumption that the project is mostly complete.

## What Exists Today

The repository currently provides:
- A Next.js 14 + TypeScript app shell
- A main dashboard page
- Yahoo Finance-based stock search, quote, and historical data fetching
- A charting layer using `lightweight-charts`
- Technical indicators and recommendation scoring logic
- Local watchlist and portfolio widgets using browser storage

These are foundations, not the finished product.

## What Is Not Finished

The current repository does not yet provide a full investor platform.

Gaps include:
- No complete product architecture
- No durable backend or database-backed user model
- No real portfolio intelligence
- No real alerts engine
- No real discovery/screener engine
- No proper research workspace
- No real AI copilot
- No fully trustworthy news and peer intelligence layer
- No production-grade QA, observability, or hardening

Some visible sections are currently placeholder or limited:
- AI insights are rule-based summaries, not a real AI workflow
- Peer comparison contains hardcoded demo behavior
- News is placeholder/demo content in the current main experience
- Portfolio does not behave like a live tracked portfolio system
- Mutual fund support is only partial relative to the intended scope

## Product Vision

This project is not just a stock dashboard.

Target product:
- An investor operating system

The final product should let a user:
- Discover opportunities
- Research a stock deeply
- Compare it with peers and sector context
- Track a portfolio and risk exposure
- Receive meaningful alerts
- Understand what changed and why
- Build conviction before acting

## Product Pillars

The target platform has six core pillars:

### 1. Market Terminal
- Live market dashboard
- Stocks, indices, ETFs, mutual funds as in-scope assets depending on rollout
- Watchlists and market snapshots

### 2. Research Workspace
- Deep stock detail pages
- Financials, valuation, quality, peers, news, risks, AI-assisted summaries

### 3. Portfolio Brain
- Holdings, transactions, P&L, allocation, exposure, diversification, drawdown, suggestions

### 4. Discovery Engine
- Screeners, themes, strategy-based discovery, sector and factor exploration

### 5. Alerts Platform
- Price, technical, news, portfolio, and event-driven alerts

### 6. AI Copilot
- Explainable AI workflows grounded in structured data

## Delivery Principles

All future work should follow these rules:

- No fake sections should remain in shipped experiences unless clearly labeled as placeholders
- Real data beats decorative UI
- Explainable intelligence beats vague AI text
- Architecture must be modular before feature count grows
- Each visible product area should map to a real backend/data strategy
- Product depth matters more than adding surface-level widgets
- We build toward a durable platform, not a demo

## Scope Assumptions To Lock Early

These must be treated as top-level product decisions:
- India-first, global-first, or hybrid market focus
- Asset scope for v1: stocks only, or stocks + mutual funds + ETFs
- Investor-first or active-trader-first positioning
- What AI is allowed to do in v1
- What requires authentication in v1
- Free vs premium boundary

If these are not locked, implementation drift is likely.

## Execution Roadmap

The roadmap below is the ordered plan for taking the project from 5/100 to a serious product.

### Phase 0: Product Definition
Goal:
- Lock product direction before heavy implementation

Deliverables:
- Target user definition
- Product scope
- MVP, V1, and V2 boundaries
- Monetization boundary if relevant
- Design direction
- Formal PRD

Status:
- Pending

### Phase 1: Architecture Reset
Goal:
- Convert the current prototype into a maintainable platform base

Work:
- Break up the monolithic main page
- Define feature/module boundaries
- Centralize data adapter strategy
- Tighten type usage
- Configure linting and coding standards
- Introduce better state/data loading boundaries
- Add proper error and loading architecture

Target module structure:
- `src/features/market`
- `src/features/research`
- `src/features/portfolio`
- `src/features/discovery`
- `src/features/alerts`
- `src/features/ai`
- `src/server`
- `src/shared`

Status:
- Pending

### Phase 2: Real Data Backbone
Goal:
- Replace demo assumptions with durable real data flows

Work:
- Quote and history adapters
- Fundamentals and profile data
- News integration
- Peer and sector mapping
- Earnings and calendar data
- Mutual fund data pipeline if in scope
- Caching and revalidation rules
- Fallback behavior and reliability strategy

Status:
- Pending

### Phase 3: Dashboard 2.0
Goal:
- Build a true market terminal homepage

Features:
- Major indices
- Top gainers and losers
- Sector heatmap
- Trending symbols
- Watchlist snapshots
- Market breadth summary
- Earnings and events snapshot
- Quick portfolio and alert context

Status:
- Pending

### Phase 4: Research Workspace
Goal:
- Build the core stock research experience

Features:
- Price and chart
- Multi-timeframe trend view
- Financial and valuation blocks
- Peer comparison
- News and sentiment
- Risks and opportunities
- Sector context
- Bull case / bear case / neutral case
- Entry zone and invalidation logic

Status:
- Pending

### Phase 5: Portfolio Brain
Goal:
- Move from local widgets to a real portfolio system

Features:
- Holdings and transaction model
- Realized and unrealized P&L
- XIRR/CAGR where appropriate
- Allocation breakdowns
- Sector and market-cap exposure
- Concentration risk
- Drawdown tracking
- Notes and thesis tracking
- Rebalance suggestions

Status:
- Pending

### Phase 6: Discovery Engine
Goal:
- Help users find ideas, not only inspect symbols

Features:
- Screener builder
- Saved screens
- Strategy presets
- Momentum, value, quality, breakout, dividend, and sector screens
- Mutual fund ranking if in scope

Status:
- Pending

### Phase 7: Alerts Platform
Goal:
- Make the app useful outside active browsing sessions

Features:
- Price alerts
- Support/resistance alerts
- Technical trigger alerts
- Volume alerts
- Earnings reminders
- News and sentiment alerts
- Portfolio risk alerts

Status:
- Pending

### Phase 8: AI Copilot
Goal:
- Build a grounded and explainable intelligence layer

Capabilities:
- Company summary
- Price-move explanation
- Bull and bear case generation
- Peer comparison explanation
- Entry-point analysis
- Risk highlighting
- Portfolio commentary

Rule:
- AI outputs must be grounded in real structured data where possible

Status:
- Pending

### Phase 9: Accounts And Persistence
Goal:
- Turn the app into a durable personal workspace

Features:
- Authentication
- Cloud-synced watchlists
- Cloud-synced portfolios
- Saved screens
- Saved alerts
- User notes
- Preferences and personalization

Status:
- Pending

### Phase 10: Premium UX And Brand
Goal:
- Make the product iconic rather than generic

Principles:
- Strong visual identity
- Precise data density
- Distinct typography
- Intentional color system
- High-quality motion
- Memorable homepage and research experience

Status:
- Pending

### Phase 11: QA, Trust, And Launch Readiness
Goal:
- Make the product safe to ship and scale

Work:
- Test critical calculations
- Validate data-source fallbacks
- Handle market-open/closed states cleanly
- Responsive QA
- Performance work
- Logging and observability
- Release and deployment readiness

Status:
- Pending

## Milestone Ladder

Use this scale to understand progress:

- `5/100`: current repository baseline
- `20/100`: architecture cleaned, linting set up, fake sections identified and removed/replaced
- `35/100`: real dashboard + real stock research core
- `50/100`: portfolio system and persistence foundation
- `65/100`: discovery and alerts
- `80/100`: AI copilot and strong personalization
- `95/100`: polished, tested, deployable, credible product

## Working Method

We will work one point at a time, in order, without losing context.

Default operating rule:
- This document is the authoritative plan unless explicitly revised

For implementation:
- Each phase should produce concrete code, not only notes
- Each major area should get its own implementation document/checklist if complexity grows
- New work should reference this roadmap directly
- If scope changes, update this document first

## Immediate Next Step

Start with:
- Phase 1: Architecture Reset

Why:
- The current repo must be made structurally sound before large feature growth
- Replacing placeholders and adding new systems on top of the current monolithic page would create avoidable rework

Phase 1 first milestone:
- Establish code-quality baseline
- Create feature-oriented structure
- Prepare the repo for real data and feature growth
