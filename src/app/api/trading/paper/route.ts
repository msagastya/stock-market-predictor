import { NextRequest, NextResponse } from 'next/server';
import { WATCHLIST, RISK_PROFILES, analyzeStock, simulateExit, buildDailySummary, fetchCandles, PaperTrade } from '@/lib/trading/paper-engine';
import { getMarketPhase } from '@/lib/trading/hunt-detector';
import { firestoreGet, firestoreSet } from '@/lib/firebase-store';
import { ScoredStock } from '@/lib/trading/morning-scanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function todayIST(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ── GET — fetch paper trading data ────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const date = searchParams.get('date') || todayIST();
    const type = searchParams.get('type') || 'trades'; // trades | summary | history

    try {
        if (type === 'summary') {
            const doc = await firestoreGet('paper_trading', `summary_${date}`);
            return NextResponse.json(doc || { message: 'No summary yet for ' + date });
        }

        if (type === 'history') {
            // Last 20 daily summaries
            const summaries = [];
            const today = new Date();
            for (let i = 0; i < 20; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                const doc = await firestoreGet('paper_trading', `summary_${dateStr}`);
                if (doc) summaries.push(doc);
            }
            return NextResponse.json({ summaries });
        }

        // Default: trades for date
        const doc = await firestoreGet('paper_trading', `trades_${date}`);
        const trades: PaperTrade[] = doc ? JSON.parse(doc.trades || '[]') : [];
        return NextResponse.json({ date, trades, count: trades.length });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// ── POST — run paper trading session tick ─────────────────────────────────────
export async function POST(req: NextRequest) {
    // Auth check
    const secret = req.headers.get('x-trading-secret');
    if (secret !== process.env.TRADING_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now   = new Date();
    const phase = getMarketPhase(now);
    const date  = todayIST();

    if (phase.phase as string === 'closed') {
        return NextResponse.json({ skipped: true, reason: 'Market closed', phase: phase.phase });
    }

    // Load today's dynamic watchlist from morning scan (fallback to hardcoded)
    let todayWatchlist = WATCHLIST;
    try {
        const scanDoc = await firestoreGet('morning_scan', date);
        if (scanDoc?.watchlist) {
            const scored: ScoredStock[] = JSON.parse(scanDoc.watchlist);
            todayWatchlist = scored.map(s => ({ symbol: s.symbol, nseSymbol: s.nseSymbol, category: s.category as any })) as any;
        }
    } catch { /* fallback to hardcoded */ }

    // Load today's open trades
    const existingDoc = await firestoreGet('paper_trading', `trades_${date}`);
    let trades: PaperTrade[] = existingDoc ? JSON.parse(existingDoc.trades || '[]') : [];

    const log: string[] = [];
    const isEOD = phase.phase === 'exit_window';

    // ── Update open positions ───────────────────────────────────────────────
    const openTrades = trades.filter(t => t.exitReason === 'open');
    if (openTrades.length > 0) {
        const updated: PaperTrade[] = [];
        for (const trade of openTrades) {
            try {
                const sym = todayWatchlist.find((w: { nseSymbol: string }) => w.nseSymbol === trade.symbol);
                if (!sym) { updated.push(trade); continue; }
                const candles = await fetchCandles(sym.symbol, '15m', 2);
                if (candles.length === 0) { updated.push(trade); continue; }
                const exited = simulateExit(trade, candles, now, isEOD);
                updated.push(exited);
                if (exited.exitReason !== 'open') {
                    log.push(`EXIT ${exited.symbol} (${exited.riskProfile}): ${exited.exitReason} @ ₹${exited.exitPrice} | Net ₹${exited.netPnL}`);
                }
            } catch {
                updated.push(trade);
            }
        }
        trades = [...trades.filter(t => t.exitReason !== 'open'), ...updated];
    }

    // ── Scan for new entries (only during entry/trend window) ───────────────
    if (phase.phase === 'entry_window' || phase.phase === 'trend_window') {
        // Count open trades per profile
        const openByProfile: Record<string, number> = { conservative: 0, moderate: 0, aggressive: 0 };
        for (const t of trades.filter(t => t.exitReason === 'open')) {
            openByProfile[t.riskProfile] = (openByProfile[t.riskProfile] || 0) + 1;
        }

        // Scan each stock
        for (const stock of todayWatchlist) {
            for (const profile of RISK_PROFILES) {
                // Skip if profile at max trades
                const todayTrades = trades.filter(t => t.riskProfile === profile.id && t.date === date);
                if (todayTrades.filter(t => t.exitReason !== 'avoided_charges').length >= profile.maxTradesPerDay) continue;
                if (openByProfile[profile.id] >= 2) continue; // max 2 open at once per profile

                try {
                    const signal = await analyzeStock(stock, profile, now);
                    if (signal && (signal.exitReason === 'open' || signal.exitReason === 'avoided_charges')) {
                        // Don't duplicate — same symbol+profile already open today
                        const alreadyOpen = trades.some(t =>
                            t.symbol === signal.symbol &&
                            t.riskProfile === signal.riskProfile &&
                            t.exitReason === 'open'
                        );
                        if (!alreadyOpen) {
                            trades.push(signal);
                            if (signal.exitReason === 'open') {
                                log.push(`ENTER ${signal.symbol} (${signal.riskProfile}): ${signal.direction} @ ₹${signal.entryPrice} | Stop ₹${signal.stopPrice.toFixed(2)} | Target ₹${signal.targetPrice.toFixed(2)} | ${signal.confidence} confidence`);
                            } else {
                                log.push(`SKIP ${signal.symbol} (${signal.riskProfile}): charges too high`);
                            }
                        }
                    }
                } catch {
                    // Skip this stock silently
                }
            }
        }
    }

    // ── EOD summary ────────────────────────────────────────────────────────
    let summary = null;
    if (isEOD || phase.phase === 'closed') {
        summary = buildDailySummary(trades, date);
        await firestoreSet('paper_trading', `summary_${date}`, {
            ...summary,
            bestTrade: JSON.stringify(summary.bestTrade),
            worstTrade: JSON.stringify(summary.worstTrade),
            patternsSeen: JSON.stringify(summary.patternsSeen),
            recommendations: JSON.stringify(summary.recommendations),
        } as any);
    }

    // Save trades
    await firestoreSet('paper_trading', `trades_${date}`, {
        date,
        trades: JSON.stringify(trades),
        updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
        phase: phase.phase,
        time: `${String(phase.istHour).padStart(2,'0')}:${String(phase.istMinute).padStart(2,'0')} IST`,
        date,
        openTrades: trades.filter(t => t.exitReason === 'open').length,
        totalTodayTrades: trades.length,
        log,
        summary,
    });
}
