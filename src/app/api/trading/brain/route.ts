/**
 * Trading Brain — Groq-powered market analysis
 * Called by GitHub Actions at 7:00 AM IST (1:30 AM UTC) every weekday.
 * Also callable on-demand for EOD review.
 *
 * Uses llama-3.1-8b-instant on Groq (free tier, 6000 req/day).
 * Falls back to rule-based analysis if GROQ_API_KEY is not set.
 */

import { NextResponse } from 'next/server';
import { firestoreSet, firestoreGet } from '@/lib/firebase-store';

export const dynamic   = 'force-dynamic';
export const maxDuration = 60;

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.1-8b-instant';

interface GroqMessage { role: 'system' | 'user' | 'assistant'; content: string; }

async function askGroq(prompt: string): Promise<string> {
    const key = process.env.GROQ_API_KEY;
    if (!key) return '';

    const messages: GroqMessage[] = [
        { role: 'system', content: 'You are a concise Indian stock market analyst. Respond only in the exact format requested. No extra text.' },
        { role: 'user',   content: prompt },
    ];

    const res = await fetch(GROQ_API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body:    JSON.stringify({ model: MODEL, messages, max_tokens: 300, temperature: 0.3 }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}

function extract(key: string, text: string, fallback = ''): string {
    for (const line of text.split('\n')) {
        if (line.toUpperCase().startsWith(key.toUpperCase() + ':')) {
            return line.split(':', 2)[1].trim();
        }
    }
    return fallback;
}

// ── Morning analysis ──────────────────────────────────────────────────────────

async function morningAnalysis(marketData: Record<string, any>, today: string) {
    const niftyChange = marketData.niftyChange ?? 0;
    const niftyPrice  = marketData.niftyPrice  ?? 0;
    const gainers     = (marketData.gainers ?? []).slice(0, 5)
        .map((g: any) => `${g.symbol} +${g.changePercent?.toFixed(1)}%`).join(', ');
    const losers      = (marketData.losers  ?? []).slice(0, 5)
        .map((l: any) => `${l.symbol} ${l.changePercent?.toFixed(1)}%`).join(', ');

    const prompt = `Indian market morning analysis for ${today}.

Nifty 50: ${niftyPrice} (${niftyChange > 0 ? '+' : ''}${niftyChange?.toFixed(2)}%)
Top gainers: ${gainers || 'N/A'}
Top losers:  ${losers  || 'N/A'}

Analyze and respond in this EXACT format (no extra lines):
DAY_BIAS: bullish / bearish / neutral
SECTOR_FOCUS: Banking, IT  (comma separated, 2-3 sectors)
KEY_RISK: one sentence
TRADING_PLAN: one clear sentence
SIGNAL_BIAS: long / short / both`;

    const raw = await askGroq(prompt);

    const dayBias    = extract('DAY_BIAS',      raw, niftyChange > 0.5 ? 'bullish' : niftyChange < -0.5 ? 'bearish' : 'neutral').toLowerCase();
    const sectors    = extract('SECTOR_FOCUS',  raw, 'Banking, IT').split(',').map(s => s.trim());
    const keyRisk    = extract('KEY_RISK',       raw, 'Watch global cues');
    const plan       = extract('TRADING_PLAN',  raw, 'Trade momentum with confirmation');
    const signalBias = extract('SIGNAL_BIAS',   raw, 'both').toLowerCase();

    return {
        dayBias:    ['bullish','bearish','neutral'].includes(dayBias) ? dayBias : 'neutral',
        sectors,
        keyRisk,
        plan,
        signalBias: ['long','short','both'].includes(signalBias) ? signalBias : 'both',
        raw:        raw.slice(0, 500),
        brain:      raw ? 'groq' : 'rule',
    };
}

// ── EOD review ────────────────────────────────────────────────────────────────

async function eodReview(trades: any[], summary: Record<string, any>, morning: Record<string, any>, today: string) {
    const tradeLines = trades
        .filter(t => !['open','avoided_charges'].includes(t.exitReason))
        .slice(0, 10)
        .map(t => `${t.symbol} ${t.direction?.toUpperCase()} entry=${t.entryPrice} exit=${t.exitPrice} reason=${t.exitReason} pnl=${t.netPnL}`)
        .join('\n') || 'No completed trades';

    const prompt = `EOD review for Indian stock market on ${today}.

Morning prediction:
- Day bias: ${morning.dayBias ?? 'unknown'}
- Plan: ${morning.tradingPlan ?? 'N/A'}

Actual results:
- Trades: ${summary.totalTrades} | Winners: ${summary.winners} | Losers: ${summary.losers} | Win%: ${summary.winRate}%
- Net PnL: ₹${summary.netPnL}

Trade details:
${tradeLines}

Respond in this EXACT format:
PREDICTION_ACCURACY: correct / wrong / partial
WHAT_WORKED: one sentence (or "nothing" if loss day)
WHAT_FAILED: one sentence
KEY_PATTERN: one observation
TOMORROW_FOCUS: one actionable sentence
BIAS_SCORE: +1 / 0 / -1`;

    const raw = await askGroq(prompt);

    return {
        predictionAccuracy: extract('PREDICTION_ACCURACY', raw, 'partial'),
        whatWorked:   extract('WHAT_WORKED',   raw, ''),
        whatFailed:   extract('WHAT_FAILED',   raw, ''),
        keyPattern:   extract('KEY_PATTERN',   raw, ''),
        tomorrowFocus: extract('TOMORROW_FOCUS', raw, ''),
        biasScore:    parseInt(extract('BIAS_SCORE', raw, '0').replace('+','')) || 0,
        raw:          raw.slice(0, 500),
        brain:        raw ? 'groq' : 'rule',
    };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const secret = req.headers.get('x-trading-secret');
    if (secret !== process.env.TRADING_SECRET) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    let body: Record<string, any> = {};
    try { body = await req.json(); } catch {}

    const mode = body.mode ?? 'morning';

    if (mode === 'morning') {
        const marketData = body.marketData ?? {};

        try {
            const analysis = await morningAnalysis(marketData, today);

            // Merge into existing morning_scan doc (or create)
            const existing = await firestoreGet('morning_scan', today) ?? {};
            await firestoreSet('morning_scan', today, {
                ...existing,
                date:          today,
                dayBias:       analysis.dayBias,
                signalBias:    analysis.signalBias,
                sectorFocus:   JSON.stringify(analysis.sectors),
                keyRisk:       analysis.keyRisk,
                tradingPlan:   analysis.plan,
                brainRaw:      analysis.raw,
                brainSource:   analysis.brain,
                brainUpdatedAt: new Date().toISOString(),
            });

            return NextResponse.json({ ok: true, mode: 'morning', today, ...analysis });
        } catch (e: any) {
            return NextResponse.json({ error: e.message }, { status: 500 });
        }
    }

    if (mode === 'eod') {
        const trades  = body.trades  ?? [];
        const summary = body.summary ?? {};

        // Load morning scan for context
        const morning = await firestoreGet('morning_scan', today) ?? {};

        try {
            const review = await eodReview(trades, summary, morning, today);

            // Save EOD memory
            const memKey = `eod_${today}`;
            await firestoreSet('trading_memory', memKey, {
                date:               today,
                brain:              review.brain,
                dayBias:            morning.dayBias    ?? 'neutral',
                signalBias:         morning.signalBias ?? 'both',
                morningPlan:        morning.tradingPlan ?? '',
                dayPnl:             summary.netPnL    ?? 0,
                trades:             summary.totalTrades ?? 0,
                winRate:            summary.winRate    ?? 0,
                predictionAccuracy: review.predictionAccuracy,
                whatWorked:         review.whatWorked,
                whatFailed:         review.whatFailed,
                keyPattern:         review.keyPattern,
                tomorrowFocus:      review.tomorrowFocus,
                biasScore:          String(review.biasScore),
                createdAt:          new Date().toISOString(),
            });

            return NextResponse.json({ ok: true, mode: 'eod', today, ...review });
        } catch (e: any) {
            return NextResponse.json({ error: e.message }, { status: 500 });
        }
    }

    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
}

export async function GET() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    try {
        const scan = await firestoreGet('morning_scan', today);
        const mem  = await firestoreGet('trading_memory', `eod_${today}`);
        return NextResponse.json({
            today,
            morning: scan ?? null,
            eod:     mem  ?? null,
            groqConfigured: !!process.env.GROQ_API_KEY,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
