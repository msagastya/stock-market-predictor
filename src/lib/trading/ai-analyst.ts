/**
 * AI Analyst — Claude as the trading brain.
 *
 * Claude reviews every signal before execution, writes daily commentary,
 * and learns from past trade patterns. Uses claude-haiku (fastest + cheapest)
 * for signal decisions, claude-sonnet for daily deep analysis.
 */

import Anthropic from '@anthropic-ai/sdk';
import { TradeSignal } from './signal-engine';
import { DailySummary, PaperTrade } from './paper-engine';

function getClient(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── Signal Validation — go / no-go decision ────────────────────────────────────

export interface AISignalDecision {
    approved:    boolean;
    confidence:  'high' | 'medium' | 'low';
    reasoning:   string;
    adjustedStop?: number;
    adjustedTarget?: number;
    riskNote:    string;
}

export async function validateSignal(
    signal: TradeSignal,
    recentTrades: PaperTrade[],
    marketContext: { dayBias: string; niftyTrend: string; sectorPriority: string[]; alerts: string[] },
): Promise<AISignalDecision> {
    const client = getClient();
    if (!client) {
        const approved = signal.confidence !== 'low' && signal.riskReward >= 1.8 && signal.worthTaking;
        return {
            approved,
            confidence: signal.confidence,
            reasoning:  approved ? 'Auto-approved: signal meets base criteria' : 'Auto-rejected: signal below threshold',
            riskNote:   'AI not configured — rule-based fallback',
        };
    }

    try {
        const recentWins  = recentTrades.filter(t => (t.netPnL ?? 0) > 0).length;
        const recentLosses = recentTrades.filter(t => (t.netPnL ?? 0) < 0).length;
        const recentWinRate = recentTrades.length > 0 ? Math.round(recentWins / recentTrades.length * 100) : 0;

        const prompt = `You are a strict intraday trading risk manager for NSE India. Evaluate this trade signal.

MARKET CONTEXT:
- Day bias: ${marketContext.dayBias}
- Nifty trend: ${marketContext.niftyTrend}
- Priority sectors: ${marketContext.sectorPriority.join(', ')}
- Alerts: ${marketContext.alerts.join(' | ') || 'none'}

SIGNAL:
- Stock: ${signal.nseSymbol}
- Direction: ${signal.direction.toUpperCase()}
- Signal type: ${signal.signalType}
- Confidence: ${signal.confidence}
- Entry: ₹${signal.entryPrice.toFixed(2)} (raw: ₹${signal.rawEntryPrice.toFixed(2)}, slippage included)
- Stop: ₹${signal.stopPrice.toFixed(2)} (${signal.stopPercent.toFixed(2)}% risk)
- Target: ₹${signal.targetPrice.toFixed(2)} (${signal.targetPercent.toFixed(2)}% gain)
- Risk:Reward: ${signal.riskReward.toFixed(2)}
- Qty: ${signal.quantity}
- Signal detail: ${signal.signalDetail}
- Market phase: ${signal.marketPhase}
- Time: ${signal.timeOfDay} IST

RECENT PERFORMANCE (last ${recentTrades.length} trades):
- Win rate: ${recentWinRate}%
- Wins: ${recentWins}, Losses: ${recentLosses}
${recentLosses >= 3 ? '⚠ WARNING: 3+ recent losses — consider reducing size or skipping' : ''}

RULES YOU MUST ENFORCE:
1. Never approve a trade against the day bias unless confidence is HIGH and RR > 2.5
2. Never approve if stop is < 0.3% (too tight, will get stopped on noise)
3. Never approve if RR < 1.5
4. Reduce approved quantity by 50% if recent win rate < 40%
5. Approve with HIGH confidence only if signal aligns with day bias AND sector priority

Respond in this exact JSON format:
{
  "approved": true/false,
  "confidence": "high/medium/low",
  "reasoning": "one clear sentence why approved or rejected",
  "riskNote": "one sentence on what to watch for"
}`;

        const msg = await client!.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 256,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = (msg.content[0] as any).text.trim();
        const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');

        return {
            approved:   json.approved ?? false,
            confidence: json.confidence ?? 'low',
            reasoning:  json.reasoning ?? 'No reasoning provided',
            riskNote:   json.riskNote  ?? '',
        };
    } catch {
        // If Claude fails, fall back to rule-based decision
        const approved = signal.confidence !== 'low' && signal.riskReward >= 1.8 && signal.worthTaking;
        return {
            approved,
            confidence: signal.confidence,
            reasoning:  approved ? 'Auto-approved: signal meets base criteria' : 'Auto-rejected: signal below threshold',
            riskNote:   'AI analysis unavailable — used rule-based fallback',
        };
    }
}

// ── Daily Commentary — what happened today and why ────────────────────────────

export interface DailyAIReport {
    headline:        string;
    whatWorked:      string;
    whatFailed:      string;
    keyLesson:       string;
    tomorrowFocus:   string;
    adjustments:     string[];
}

export async function generateDailyReport(
    summary: DailySummary,
    trades: PaperTrade[],
    marketContext: { dayBias: string; tradingPlan: string; alerts: string[] },
): Promise<DailyAIReport> {
    const client = getClient();
    if (!client) {
        return {
            headline:      `${summary.winRate}% win rate | Net ₹${summary.netPnL}`,
            whatWorked:    summary.winners > 0 ? `${summary.winners} winning trades` : 'Nothing today',
            whatFailed:    summary.losers  > 0 ? `${summary.losers} losing trades` : 'No losses',
            keyLesson:     summary.recommendations[0] || 'Keep tracking',
            tomorrowFocus: summary.bestSector ? `Watch ${summary.bestSector} sector` : 'Follow the bias',
            adjustments:   summary.recommendations,
        };
    }

    try {
        const closed = trades.filter(t => t.exitReason !== 'open' && t.exitReason !== 'avoided_charges');
        const tradeDetails = closed.map(t =>
            `${t.symbol} (${t.riskProfile}) ${t.direction} | entry ${t.entryTime} | ${t.exitReason} | net ₹${t.netPnL?.toFixed(0)} | signal: ${t.huntSignal}`
        ).join('\n');

        const prompt = `You are a senior portfolio manager reviewing today's paper trading session on NSE India.

TODAY'S PLAN:
- Bias: ${marketContext.dayBias}
- Plan: ${marketContext.tradingPlan}
- Alerts: ${marketContext.alerts.join(', ') || 'none'}

RESULTS:
- Total trades: ${summary.totalTrades}
- Winners: ${summary.winners}, Losers: ${summary.losers}
- Win rate: ${summary.winRate}%
- Gross P&L: ₹${summary.grossPnL}
- Charges: ₹${summary.totalCharges}
- Net P&L: ₹${summary.netPnL}
- Best sector: ${summary.bestSector || 'none'}
- Best time: ${summary.bestTimeOfDay || 'none'}
- Trades avoided (charges): ${summary.avoided}

INDIVIDUAL TRADES:
${tradeDetails || 'No closed trades today'}

Write a concise trading journal entry. Respond in this exact JSON format:
{
  "headline": "one punchy sentence summarizing the day",
  "whatWorked": "what signals/patterns/timing worked today",
  "whatFailed": "what didn't work and likely why",
  "keyLesson": "the single most important thing to remember from today",
  "tomorrowFocus": "specific thing to watch for tomorrow based on today",
  "adjustments": ["adjustment 1", "adjustment 2"]
}`;

        const msg = await client!.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = (msg.content[0] as any).text.trim();
        const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');

        return {
            headline:      json.headline      || 'Day complete',
            whatWorked:    json.whatWorked    || '—',
            whatFailed:    json.whatFailed    || '—',
            keyLesson:     json.keyLesson     || '—',
            tomorrowFocus: json.tomorrowFocus || '—',
            adjustments:   json.adjustments   || [],
        };
    } catch {
        return {
            headline:      `${summary.winRate}% win rate | Net ₹${summary.netPnL}`,
            whatWorked:    summary.winners > 0 ? `${summary.winners} winning trades` : 'Nothing today',
            whatFailed:    summary.losers  > 0 ? `${summary.losers} losing trades` : 'No losses',
            keyLesson:     summary.recommendations[0] || 'Keep tracking',
            tomorrowFocus: summary.bestSector ? `Watch ${summary.bestSector} sector` : 'Follow the bias',
            adjustments:   summary.recommendations,
        };
    }
}

// ── Pre-market briefing — what to expect today ─────────────────────────────────

export interface MorningBriefing {
    sentiment:     string;
    topOpportunities: string[];
    risksToWatch:  string[];
    tradingPlan:   string;
    sectors:       { name: string; bias: 'buy' | 'sell' | 'watch'; reason: string }[];
}

export async function generateMorningBriefing(
    scan: { dayBias: string; sectorPriority: string[]; alerts: string[]; tradingPlan: string; watchlist: any[]; globalSnapshot: any },
): Promise<MorningBriefing> {
    const client = getClient();
    if (!client) {
        return {
            sentiment:        scan.tradingPlan,
            topOpportunities: scan.sectorPriority.map(s => `Watch ${s}`),
            risksToWatch:     scan.alerts,
            tradingPlan:      scan.tradingPlan,
            sectors:          [],
        };
    }

    try {
        const top10 = scan.watchlist.slice(0, 10).map(s =>
            `${s.nseSymbol} (score ${s.score}, gap ${s.gapPercent > 0 ? '+' : ''}${s.gapPercent?.toFixed(2)}%, ${s.sectorBias})`
        ).join(', ');

        const global = scan.globalSnapshot || {};
        const prompt = `You are a senior NSE India trader. Generate a morning briefing for today.

GLOBAL SNAPSHOT:
- US Markets (Dow/S&P/Nasdaq): ${global.dowChange > 0 ? '+' : ''}${global.dowChange?.toFixed(2)}% / ${global.spChange > 0 ? '+' : ''}${global.spChange?.toFixed(2)}% / ${global.nasdaqChange > 0 ? '+' : ''}${global.nasdaqChange?.toFixed(2)}%
- Nikkei: ${global.nikkeiChange > 0 ? '+' : ''}${global.nikkeiChange?.toFixed(2)}%
- Gold: ${global.goldChange > 0 ? '+' : ''}${global.goldChange?.toFixed(2)}%
- Crude: ${global.crudeChange > 0 ? '+' : ''}${global.crudeChange?.toFixed(2)}%
- USD/INR: ${global.usdInrChange > 0 ? '+' : ''}${global.usdInrChange?.toFixed(2)}%
- GIFT Nifty implied gap: ${global.giftNiftyGap > 0 ? '+' : ''}${global.giftNiftyGap?.toFixed(2)}%

TODAY'S BIAS: ${scan.dayBias}
PRIORITY SECTORS: ${scan.sectorPriority.join(', ')}
ALERTS: ${scan.alerts.join(' | ') || 'none'}
TOP 10 STOCKS: ${top10}

Respond in this exact JSON:
{
  "sentiment": "one sentence market mood for today",
  "topOpportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "risksToWatch": ["risk 1", "risk 2"],
  "tradingPlan": "2-3 sentence actionable plan for today",
  "sectors": [
    {"name": "Banking", "bias": "buy/sell/watch", "reason": "why"}
  ]
}`;

        const msg = await client!.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = (msg.content[0] as any).text.trim();
        const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');

        return {
            sentiment:        json.sentiment        || scan.dayBias,
            topOpportunities: json.topOpportunities || [],
            risksToWatch:     json.risksToWatch     || [],
            tradingPlan:      json.tradingPlan      || scan.tradingPlan,
            sectors:          json.sectors          || [],
        };
    } catch {
        return {
            sentiment:        scan.tradingPlan,
            topOpportunities: scan.sectorPriority.map(s => `Watch ${s}`),
            risksToWatch:     scan.alerts,
            tradingPlan:      scan.tradingPlan,
            sectors:          [],
        };
    }
}
