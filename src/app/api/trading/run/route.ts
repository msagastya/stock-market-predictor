/**
 * Master Trading Executor
 *
 * Single endpoint orchestrating the full pipeline:
 *   POST ?mode=morning_scan  — score watchlist + AI briefing
 *   POST ?mode=tick          — update positions + scan new entries with AI validation
 *   POST ?mode=eod           — generate AI daily report
 *   GET                      — current trading status (no auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { WATCHLIST, WatchStock, buildDailySummary, simulateExit, RISK_PROFILES, PaperTrade } from '@/lib/trading/paper-engine';
import { analyzeSignal } from '@/lib/trading/signal-engine';
import { runMorningScan } from '@/lib/trading/morning-scanner';
import { validateSignal, generateDailyReport, generateMorningBriefing } from '@/lib/trading/ai-analyst';
import { fetchCandles } from '@/lib/trading/kite-candles';
import { getMarketPhase } from '@/lib/trading/hunt-detector';

// ── Firestore helpers ──────────────────────────────────────────────────────────

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function fsGet(collection: string, docId: string) {
    const res = await fetch(`${FS_BASE}/${collection}/${docId}`, {
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const doc = await res.json();
    if (!doc.fields) return null;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(doc.fields as Record<string, any>)) {
        out[k] = v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? v.arrayValue ?? null;
    }
    return out;
}

async function fsSave(collection: string, docId: string, data: Record<string, any>) {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'boolean')      fields[k] = { booleanValue: v };
        else if (typeof v === 'number')  fields[k] = { doubleValue: v };
        else if (v === null || v === undefined) fields[k] = { nullValue: null };
        else                             fields[k] = { stringValue: String(v) };
    }
    await fetch(`${FS_BASE}/${collection}/${docId}?updateMask.fieldPaths=${Object.keys(data).join('&updateMask.fieldPaths=')}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    });
}

async function fsListTrades(date: string): Promise<PaperTrade[]> {
    const res = await fetch(`${FS_BASE}/paper_trading?pageSize=200`, {
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.documents) return [];
    const trades: PaperTrade[] = [];
    for (const doc of json.documents) {
        if (!doc.fields) continue;
        const t: any = {};
        for (const [k, v] of Object.entries(doc.fields as Record<string, any>)) {
            t[k] = v.stringValue ?? v.integerValue ?? v.doubleValue ?? v.booleanValue ?? null;
        }
        if (t.date === date) trades.push(t as PaperTrade);
    }
    return trades;
}

async function fsSaveTrade(trade: PaperTrade) {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(trade)) {
        if (v === null || v === undefined) fields[k] = { nullValue: null };
        else if (typeof v === 'boolean')   fields[k] = { booleanValue: v };
        else if (typeof v === 'number')    fields[k] = { doubleValue: v };
        else                               fields[k] = { stringValue: String(v) };
    }
    await fetch(`${FS_BASE}/paper_trading/${trade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    });
}

// ── Auth ───────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
    const secret = req.headers.get('x-trading-secret');
    return secret === process.env.TRADING_SECRET;
}

// ── GET — status ───────────────────────────────────────────────────────────────

export async function GET() {
    const now = new Date();
    const phase = getMarketPhase(now);
    const date = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toISOString().split('T')[0];

    const trades = await fsListTrades(date);
    const open = trades.filter(t => t.exitReason === 'open');
    const closed = trades.filter(t => t.exitReason !== 'open' && t.exitReason !== 'avoided_charges' && t.netPnL !== null);
    const netPnL = closed.reduce((s, t) => s + (t.netPnL ?? 0), 0);

    return NextResponse.json({
        date,
        phase: phase.phase,
        openPositions: open.length,
        closedTrades: closed.length,
        netPnL: Math.round(netPnL * 100) / 100,
    });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'tick';

    const now = new Date();
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const date = ist.toISOString().split('T')[0];

    // ── Mode: morning_scan ──────────────────────────────────────────────────────
    if (mode === 'morning_scan') {
        try {
            const scan = await runMorningScan();

            // Generate AI morning briefing
            let briefing = null;
            try {
                briefing = await generateMorningBriefing({
                dayBias: scan.dayBias,
                sectorPriority: scan.sectorPriority,
                alerts: scan.alerts,
                tradingPlan: scan.tradingPlan,
                watchlist: scan.todayWatchlist,
                globalSnapshot: scan.globalSnapshot,
            });
            } catch { /* briefing optional */ }

            // Save scan + briefing to Firestore
            await fsSave('morning_scan', date, {
                date,
                dayBias: scan.dayBias,
                tradingPlan: scan.tradingPlan,
                alerts: scan.alerts.join(' | '),
                sectorPriority: scan.sectorPriority.join(','),
                watchlist: JSON.stringify(scan.todayWatchlist),
                ...(briefing ? {
                    aiSentiment: briefing.sentiment,
                    aiOpportunities: briefing.topOpportunities.join(' | '),
                    aiRisks: briefing.risksToWatch.join(' | '),
                    aiTradingPlan: briefing.tradingPlan,
                } : {}),
            });

            return NextResponse.json({
                success: true,
                mode: 'morning_scan',
                date,
                stocksScored: scan.todayWatchlist.length,
                dayBias: scan.dayBias,
                briefing,
            });
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 });
        }
    }

    // ── Mode: eod ───────────────────────────────────────────────────────────────
    if (mode === 'eod') {
        try {
            const trades = await fsListTrades(date);
            const summary = buildDailySummary(trades, date);

            const scanDoc = await fsGet('morning_scan', date);
            const marketContext = {
                dayBias: scanDoc?.dayBias || 'neutral',
                tradingPlan: scanDoc?.tradingPlan || '',
                alerts: scanDoc?.alerts ? String(scanDoc.alerts).split(' | ') : [],
            };

            let aiReport = null;
            try {
                aiReport = await generateDailyReport(summary, trades, marketContext);
                await fsSave('morning_scan', `ai_report_${date}`, {
                    date,
                    headline: aiReport.headline,
                    whatWorked: aiReport.whatWorked,
                    whatFailed: aiReport.whatFailed,
                    keyLesson: aiReport.keyLesson,
                    tomorrowFocus: aiReport.tomorrowFocus,
                    adjustments: aiReport.adjustments.join(' | '),
                });
            } catch { /* report optional */ }

            return NextResponse.json({
                success: true,
                mode: 'eod',
                summary,
                aiReport,
            });
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 });
        }
    }

    // ── Mode: tick (default) ────────────────────────────────────────────────────
    try {
        const phase = getMarketPhase(now);

        // Skip immediately if market is closed — don't waste Kite quota
        if (phase.phase === 'closed' || phase.phase === 'hunt_window') {
            return NextResponse.json({ skipped: true, reason: 'Market closed', phase: phase.phase });
        }

        // Load today's watchlist from morning scan, fallback to hardcoded
        let watchlist: WatchStock[] = WATCHLIST as WatchStock[];
        const scanDoc = await fsGet('morning_scan', date);
        if (scanDoc?.watchlist) {
            try {
                const scored = JSON.parse(scanDoc.watchlist);
                watchlist = scored.map((s: any) => ({
                    symbol: s.symbol,
                    nseSymbol: s.nseSymbol,
                    category: s.category,
                })) as WatchStock[];
            } catch { /* use fallback */ }
        }

        // Build market context for AI validation
        const marketContext = {
            dayBias: scanDoc?.dayBias || 'neutral',
            niftyTrend: 'sideways',
            sectorPriority: scanDoc?.sectorPriority ? String(scanDoc.sectorPriority).split(',') : [],
            alerts: scanDoc?.alerts ? String(scanDoc.alerts).split(' | ') : [],
        };

        // Load existing trades for this session
        const existingTrades = await fsListTrades(date);
        const openTrades = existingTrades.filter(t => t.exitReason === 'open');
        const recentClosed = existingTrades
            .filter(t => t.exitReason !== 'open' && t.exitReason !== 'avoided_charges' && t.netPnL !== null)
            .slice(-10);

        // Update open positions in parallel
        const updatedTrades: PaperTrade[] = [];
        await Promise.all(openTrades.map(async (trade) => {
            const candles = await fetchCandles(trade.symbol, trade.symbol, '5m', 1);
            if (candles.length === 0) return;
            const updated = simulateExit(trade, candles, now, phase.phase === 'exit_window');
            if (updated.exitReason !== 'open') {
                await fsSaveTrade(updated);
                updatedTrades.push(updated);
            }
        }));

        // Scan for new entries — only during entry/trend windows
        const newTrades: PaperTrade[] = [];
        if (phase.phase === 'entry_window' || phase.phase === 'trend_window') {
            const profileCounts: Record<string, number> = {};
            for (const t of existingTrades.filter(t => t.exitReason !== 'avoided_charges')) {
                profileCounts[t.riskProfile] = (profileCounts[t.riskProfile] || 0) + 1;
            }

            // Scan top 20 stocks in parallel (5 at a time to avoid Kite rate limits)
            const candidates = watchlist.slice(0, 20);
            const BATCH = 5;
            for (let i = 0; i < candidates.length; i += BATCH) {
                const batch = candidates.slice(i, i + BATCH);
                await Promise.all(batch.map(async (stock) => {
                    for (const profile of RISK_PROFILES) {
                        if ((profileCounts[profile.id] || 0) >= profile.maxTradesPerDay) continue;
                        const alreadyOpen = openTrades.some(t => t.symbol === stock.nseSymbol && t.riskProfile === profile.id);
                        if (alreadyOpen) continue;

                        const signal = await analyzeSignal(stock, profile, now);
                        if (!signal || !signal.worthTaking) continue;

                        let aiDecision = null;
                        try { aiDecision = await validateSignal(signal, recentClosed, marketContext); } catch { /* fallback */ }
                        if (aiDecision && !aiDecision.approved) continue;

                        const trade: PaperTrade = {
                            id: `${stock.nseSymbol}-${profile.id}-${Date.now()}`,
                            date,
                            symbol: stock.nseSymbol,
                            sector: stock.category,
                            riskProfile: profile.id,
                            direction: signal.direction,
                            entryPrice: signal.entryPrice,
                            entryTime: signal.timeOfDay,
                            stopPrice: aiDecision?.adjustedStop || signal.stopPrice,
                            targetPrice: aiDecision?.adjustedTarget || signal.targetPrice,
                            quantity: signal.quantity,
                            exitPrice: null,
                            exitTime: null,
                            exitReason: 'open',
                            grossPnL: null,
                            charges: null,
                            netPnL: null,
                            netPnLPercent: null,
                            holdType: 'intraday',
                            huntSignal: signal.signalDetail,
                            confidence: aiDecision?.confidence || signal.confidence,
                            patternObservation: aiDecision?.reasoning || '',
                        };

                        await fsSaveTrade(trade);
                        newTrades.push(trade);
                        profileCounts[profile.id] = (profileCounts[profile.id] || 0) + 1;
                    }
                }));
            }
        }

        return NextResponse.json({
            success: true,
            mode: 'tick',
            date,
            phase: phase.phase,
            time: `${String(phase.istHour).padStart(2,'0')}:${String(phase.istMinute).padStart(2,'0')}`,
            updatedPositions: updatedTrades.length,
            newEntries: newTrades.length,
            newTrades: newTrades.map(t => ({
                symbol: t.symbol,
                profile: t.riskProfile,
                direction: t.direction,
                entry: t.entryPrice,
                stop: t.stopPrice,
                target: t.targetPrice,
                confidence: t.confidence,
                reasoning: t.patternObservation,
            })),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
