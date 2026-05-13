'use client';

import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Trade {
    id: string; symbol: string; sector: string; riskProfile: string;
    direction: string; entryPrice: number; entryTime: string;
    stopPrice: number; targetPrice: number; quantity: number;
    exitPrice: number | null; exitTime: string | null; exitReason: string;
    grossPnL: number | null; charges: number | null; netPnL: number | null;
    netPnLPercent: number | null; holdType: string;
    huntSignal: string; confidence: string; patternObservation: string; date: string;
}

interface ScoredStock {
    symbol: string; nseSymbol: string; score: number; reasons: string[];
    category: string; prevClose: number; gapPercent: number; sectorBias: string;
    volatility?: number; momentum?: number;
}

interface MorningScan {
    date: string; dayBias: string; sectorPriority: string[];
    watchlist: ScoredStock[]; alerts: string[]; tradingPlan: string;
    keyLevels: { nifty: number; bankNifty: number; vix: number };
    aiSentiment?: string; aiOpportunities?: string[]; aiRisks?: string[];
}

interface Summary {
    date: string; totalTrades: number; winners: number; losers: number; avoided: number;
    grossPnL: number; totalCharges: number; netPnL: number; winRate: number;
    bestSector: string | null; bestTimeOfDay: string | null;
    patternsSeen: string[]; recommendations: string[];
}

const PROFILE_COLOR: Record<string, string> = {
    conservative: 'var(--accent)',
    moderate:     'var(--amber)',
    aggressive:   'var(--red)',
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    open:            { label: 'OPEN',    color: 'var(--accent)' },
    hit_target:      { label: 'TARGET ✓', color: 'var(--green)' },
    hit_stop:        { label: 'STOP ✗',  color: 'var(--red)' },
    eod_exit:        { label: 'EOD →',   color: 'var(--text2)' },
    avoided_charges: { label: 'SKIPPED', color: 'var(--text3)' },
    manual_exit:     { label: 'EXIT',    color: 'var(--amber)' },
};

function todayIST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export default function PaperTradingPage() {
    const [trades, setTrades]       = useState<Trade[]>([]);
    const [summary, setSummary]     = useState<Summary | null>(null);
    const [history, setHistory]     = useState<Summary[]>([]);
    const [scan, setScan]           = useState<MorningScan | null>(null);
    const [tab, setTab]             = useState<'today' | 'watchlist' | 'history'>('today');
    const [loading, setLoading]     = useState(true);
    const [lastRefresh, setLastRefresh] = useState('');
    const [expandedStock, setExpandedStock] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        try {
            const [tradesRes, summaryRes, historyRes, scanRes] = await Promise.all([
                fetch(`/api/trading/paper?date=${todayIST()}&type=trades`),
                fetch(`/api/trading/paper?date=${todayIST()}&type=summary`),
                fetch(`/api/trading/paper?type=history`),
                fetch(`/api/trading/morning-scan`),
            ]);
            const t = await tradesRes.json();
            const s = await summaryRes.json();
            const h = await historyRes.json();
            const sc = await scanRes.json();
            setTrades(t.trades || []);
            setSummary(s.date ? s : null);
            setHistory(h.summaries || []);
            setScan(sc.date ? sc : null);
            setLastRefresh(new Date().toLocaleTimeString('en-IN'));
        } catch { /* silent */ }
        finally { setLoading(false); }
    }

    useEffect(() => {
        load();
        const id = setInterval(load, 3 * 60 * 1000); // refresh every 3 min
        return () => clearInterval(id);
    }, []);

    const openTrades   = trades.filter(t => t.exitReason === 'open');
    const closedTrades = trades.filter(t => t.exitReason !== 'open' && t.exitReason !== 'avoided_charges');
    const skipped      = trades.filter(t => t.exitReason === 'avoided_charges');
    const netToday     = closedTrades.reduce((s, t) => s + (t.netPnL ?? 0), 0);
    const chargesTotal = closedTrades.reduce((s, t) => s + (t.charges ?? 0), 0);

    return (
        <ErrorBoundary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Paper Trading</div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Bricolage Grotesque, sans-serif', letterSpacing: '-0.03em', color: 'var(--text)' }}>
                        Pattern Builder
                    </h1>
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                        Fake trades, real charges, real patterns — {todayIST()} · Refreshed {lastRefresh}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={load} className="btn btn-secondary btn-sm" disabled={loading}>
                        {loading ? '…' : '↻ Refresh'}
                    </button>
                </div>
            </div>

            {/* Live stats strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                    { label: 'Open Positions', value: openTrades.length, color: 'var(--accent)' },
                    { label: 'Closed Today',   value: closedTrades.length, color: 'var(--text)' },
                    { label: 'Net P&L Today',  value: `${netToday >= 0 ? '+' : ''}₹${netToday.toFixed(0)}`, color: netToday >= 0 ? 'var(--green)' : 'var(--red)' },
                    { label: 'Charges Paid',   value: `₹${chargesTotal.toFixed(0)}`, color: 'var(--amber)' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                        <div className="stat-label">{s.label}</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 600, color: s.color, marginTop: 4 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Morning scan strip */}
            {scan && (
                <div className="card" style={{ padding: '14px 18px', borderLeft: '3px solid var(--accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Today&apos;s Bias</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700,
                                color: scan.dayBias.includes('bullish') || scan.dayBias === 'long_heavy' ? 'var(--green)' : scan.dayBias.includes('bearish') || scan.dayBias === 'short_heavy' ? 'var(--red)' : 'var(--amber)' }}>
                                {scan.dayBias.replace(/_/g, ' ').toUpperCase()}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {scan.sectorPriority.map(s => (
                                <span key={s} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--accent)22', color: 'var(--accent)', border: '1px solid var(--accent)44' }}>{s}</span>
                            ))}
                        </div>
                    </div>
                    {scan.tradingPlan && (
                        <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>{scan.tradingPlan}</div>
                    )}
                    {scan.alerts?.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                            {scan.alerts.map((a, i) => (
                                <span key={i} style={{ fontSize: 10, color: 'var(--amber)', background: 'var(--amber)11', border: '1px solid var(--amber)33', padding: '2px 8px', borderRadius: 4 }}>⚠ {a}</span>
                            ))}
                        </div>
                    )}
                    {(scan.aiOpportunities?.length || scan.aiRisks?.length) ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                            {scan.aiOpportunities?.length ? (
                                <div>
                                    <div style={{ fontSize: 9, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Opportunities</div>
                                    {scan.aiOpportunities.map((o, i) => <div key={i} style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>› {o}</div>)}
                                </div>
                            ) : null}
                            {scan.aiRisks?.length ? (
                                <div>
                                    <div style={{ fontSize: 9, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Risks</div>
                                    {scan.aiRisks.map((r, i) => <div key={i} style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>› {r}</div>)}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}

            {/* Tabs */}
            <div className="tab-group" style={{ width: 'fit-content' }}>
                <button className={`tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>Today</button>
                <button className={`tab ${tab === 'watchlist' ? 'active' : ''}`} onClick={() => setTab('watchlist')}>
                    Today&apos;s 50 {scan ? `(${scan.dayBias.replace(/_/g,' ')})` : ''}
                </button>
                <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History ({history.length} days)</button>
            </div>

            {tab === 'today' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Open positions */}
                    {openTrades.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                ● Live Positions ({openTrades.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {openTrades.map(t => <TradeRow key={t.id} trade={t} />)}
                            </div>
                        </div>
                    )}

                    {/* Closed today */}
                    {closedTrades.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                Closed ({closedTrades.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {closedTrades.map(t => <TradeRow key={t.id} trade={t} />)}
                            </div>
                        </div>
                    )}

                    {/* Skipped */}
                    {skipped.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                Skipped — charges too high ({skipped.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {skipped.map(t => (
                                    <div key={t.id} style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
                                        {t.symbol} ({t.riskProfile}) — {t.patternObservation}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* EOD Summary if available */}
                    {summary && <SummaryCard summary={summary} />}

                    {!loading && trades.length === 0 && (
                        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>No paper trades today yet</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                                Engine runs every minute from 9:10 AM IST.<br/>
                                First entries appear after 9:30 AM when the hunt window clears.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === 'watchlist' && (
                <div>
                    {!scan ? (
                        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Morning scan not run yet. Runs automatically at 7 AM IST on trading days.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {scan.watchlist.map((s, i) => {
                                const isOpen = expandedStock === s.nseSymbol;
                                const scoreColor = s.score >= 80 ? '#34d399' : s.score >= 60 ? '#fbbf24' : '#94a3b8';
                                const biasColor = s.sectorBias === 'tailwind' ? '#34d399' : s.sectorBias === 'headwind' ? '#fb7185' : '#94a3b8';
                                const biasLabel = s.sectorBias === 'tailwind' ? '↑ Tailwind' : s.sectorBias === 'headwind' ? '↓ Headwind' : '→ Neutral';
                                const gapColor = s.gapPercent > 0 ? '#34d399' : s.gapPercent < 0 ? '#fb7185' : '#94a3b8';

                                return (
                                    <div key={s.nseSymbol} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                                        {/* Row — always visible */}
                                        <div
                                            onClick={() => setExpandedStock(isOpen ? null : s.nseSymbol)}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '32px 80px 1fr 60px 70px 70px 70px 28px',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: '12px 16px',
                                                background: isOpen ? 'var(--surface2)' : 'var(--surface)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#64748b', textAlign: 'right' }}>{i + 1}</div>
                                            <div>
                                                <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{s.nseSymbol}</div>
                                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, textTransform: 'capitalize' }}>{s.category}</div>
                                            </div>
                                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.reasons?.[0] || ''}</div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, fontWeight: 700, color: scoreColor }}>{s.score}</div>
                                                <div style={{ fontSize: 9, color: '#64748b' }}>score</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: gapColor }}>
                                                    {s.gapPercent > 0 ? '+' : ''}{s.gapPercent.toFixed(2)}%
                                                </div>
                                                <div style={{ fontSize: 9, color: '#64748b' }}>gap</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: (s.momentum ?? 0) >= 0 ? '#34d399' : '#fb7185' }}>
                                                    {s.momentum != null ? `${s.momentum >= 0 ? '+' : ''}${s.momentum.toFixed(1)}%` : '—'}
                                                </div>
                                                <div style={{ fontSize: 9, color: '#64748b' }}>momentum</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: biasColor }}>{biasLabel}</div>
                                                <div style={{ fontSize: 9, color: '#64748b' }}>cue</div>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>{isOpen ? '▲' : '▼'}</div>
                                        </div>

                                        {/* Expanded detail panel */}
                                        {isOpen && (
                                            <div style={{ padding: '14px 16px 16px', background: '#0f172a', borderTop: '1px solid var(--border)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                                                    {[
                                                        { label: 'Score', value: `${s.score} / 100`, color: scoreColor },
                                                        { label: 'Prev Close', value: s.prevClose ? `₹${s.prevClose.toFixed(2)}` : '—', color: '#f1f5f9' },
                                                        { label: 'Implied Gap', value: `${s.gapPercent > 0 ? '+' : ''}${s.gapPercent.toFixed(2)}%`, color: gapColor },
                                                        { label: 'Sector Bias', value: biasLabel, color: biasColor },
                                                        { label: 'Category', value: s.category, color: '#94a3b8' },
                                                        { label: 'Volatility', value: s.volatility ? `${(s.volatility * 100).toFixed(1)}%` : '—', color: '#94a3b8' },
                                                    ].map(item => (
                                                        <div key={item.label} style={{ background: '#1e293b', borderRadius: 6, padding: '8px 12px' }}>
                                                            <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{item.label}</div>
                                                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: item.color }}>{item.value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                                    Why this stock was picked
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                    {(s.reasons || []).map((r, ri) => (
                                                        <div key={ri} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                            <span style={{ color: '#6366f1', fontSize: 12, flexShrink: 0, marginTop: 1 }}>›</span>
                                                            <span style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>{r}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {tab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {history.length === 0 && (
                        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>No history yet. Check back after the first trading day.</div>
                        </div>
                    )}
                    {history.map(s => <SummaryCard key={s.date} summary={s} compact />)}
                </div>
            )}

        </div>
        </ErrorBoundary>
    );
}

function TradeRow({ trade: t }: { trade: Trade }) {
    const status = STATUS_LABEL[t.exitReason] || { label: t.exitReason, color: 'var(--text2)' };
    const profileColor = PROFILE_COLOR[t.riskProfile] || 'var(--text2)';
    const pnlColor = (t.netPnL ?? 0) > 0 ? 'var(--green)' : (t.netPnL ?? 0) < 0 ? 'var(--red)' : 'var(--text2)';

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr 120px 120px 120px auto',
            gap: 12,
            alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
        }}>
            {/* Symbol + direction */}
            <div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{t.symbol}</div>
                <div style={{ fontSize: 10, color: t.direction === 'long' ? 'var(--green)' : 'var(--red)', fontWeight: 500, marginTop: 1 }}>
                    {t.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                </div>
            </div>

            {/* Signal */}
            <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>{t.huntSignal}</div>

            {/* Entry */}
            <div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Entry {t.entryTime}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>₹{t.entryPrice?.toFixed(2)}</div>
            </div>

            {/* Stop / Target */}
            <div>
                <div style={{ fontSize: 10, color: 'var(--red)' }}>SL ₹{t.stopPrice?.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: 'var(--green)' }}>TGT ₹{t.targetPrice?.toFixed(2)}</div>
            </div>

            {/* P&L */}
            <div>
                {t.netPnL !== null ? (
                    <>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: pnlColor }}>
                            {t.netPnL >= 0 ? '+' : ''}₹{t.netPnL.toFixed(0)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>after ₹{t.charges?.toFixed(0)} charges</div>
                    </>
                ) : (
                    <div style={{ color: 'var(--text3)' }}>—</div>
                )}
            </div>

            {/* Status + profile */}
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: status.color }}>{status.label}</div>
                <div style={{ fontSize: 9, color: profileColor, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.riskProfile}</div>
            </div>
        </div>
    );
}

function SummaryCard({ summary: s, compact = false }: { summary: Summary; compact?: boolean }) {
    const netColor = s.netPnL >= 0 ? 'var(--green)' : 'var(--red)';

    return (
        <div className="card" style={{ padding: compact ? '14px 16px' : '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 8 : 16 }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text2)' }}>{s.date}</div>
                <div style={{ display: 'flex', gap: 16, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
                    <span style={{ color: 'var(--text2)' }}>{s.totalTrades}T · {s.winners}W/{s.losers}L · {s.winRate}%</span>
                    <span style={{ color: netColor, fontWeight: 600 }}>{s.netPnL >= 0 ? '+' : ''}₹{s.netPnL}</span>
                </div>
            </div>

            {!compact && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                        {[
                            { label: 'Gross P&L', value: `₹${s.grossPnL}`, color: s.grossPnL >= 0 ? 'var(--green)' : 'var(--red)' },
                            { label: 'Charges',   value: `₹${s.totalCharges}`, color: 'var(--amber)' },
                            { label: 'Net P&L',   value: `${s.netPnL >= 0 ? '+' : ''}₹${s.netPnL}`, color: netColor },
                        ].map(item => (
                            <div key={item.label} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '10px 12px' }}>
                                <div className="stat-label">{item.label}</div>
                                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 600, color: item.color, marginTop: 4 }}>{item.value}</div>
                            </div>
                        ))}
                    </div>

                    {s.recommendations?.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Engine Learnings</div>
                            {s.recommendations.map((r, i) => (
                                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                    <span style={{ color: 'var(--accent)', fontSize: 10 }}>›</span>
                                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>{r}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
