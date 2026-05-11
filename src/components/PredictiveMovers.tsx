'use client';

import { useEffect, useState } from 'react';

interface ScoredStock {
    symbol: string;
    name: string;
    price: number;
    changePercent: number;
    score: number;
    confidence: 'high' | 'medium' | 'low';
    signals: string[];
    perChange30d: number;
    perChange365d: number;
    belowYearHigh: number;
    aboveYearLow: number;
    sector: string;
}

interface PredictiveData {
    bullish: ScoredStock[];
    bearish: ScoredStock[];
    meta: { universe: number; timestamp: string };
}

const CONF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
    high:   { bg: 'var(--green-dim)',  color: 'var(--green)',  border: 'rgba(52,211,153,0.2)' },
    medium: { bg: 'var(--amber-dim)',  color: 'var(--amber)',  border: 'rgba(251,191,36,0.2)' },
    low:    { bg: 'var(--surface2)',   color: 'var(--text2)',  border: 'var(--border2)' },
};

function ScoreBar({ score, max = 120, up }: { score: number; max?: number; up: boolean }) {
    const pct = Math.min((score / max) * 100, 100);
    return (
        <div style={{ width: '100%', height: 2, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
            <div
                style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: up ? 'var(--green)' : 'var(--red)',
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                }}
            />
        </div>
    );
}

function StockCard({ stock, side }: { stock: ScoredStock; side: 'bull' | 'bear' }) {
    const isBull = side === 'bull';
    const conf = CONF_STYLE[stock.confidence] || CONF_STYLE.low;
    const chg = stock.changePercent ?? 0;

    return (
        <div
            style={{
                background: 'var(--surface)',
                border: `1px solid var(--border)`,
                borderRadius: 10,
                padding: '14px 16px',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                cursor: 'default',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = isBull ? 'rgba(52,211,153,0.2)' : 'rgba(251,113,133,0.2)';
                (e.currentTarget as HTMLElement).style.boxShadow = isBull ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text)', fontSize: 13 }}>
                            {stock.symbol.replace('.NS', '')}
                        </span>
                        <span
                            style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontWeight: 500,
                                background: conf.bg,
                                color: conf.color,
                                border: `1px solid ${conf.border}`,
                                letterSpacing: '0.04em',
                            }}
                        >
                            {stock.confidence}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stock.name}
                    </div>
                    {stock.sector && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{stock.sector}</div>
                    )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>
                        ₹{stock.price.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: chg >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'DM Mono, monospace' }}>
                        {chg >= 0 ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Score bar */}
            <div style={{ marginBottom: 10 }}>
                <ScoreBar score={stock.score} up={isBull} />
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                {[
                    { label: '30d', value: `${(stock.perChange30d ?? 0) >= 0 ? '+' : ''}${(stock.perChange30d ?? 0).toFixed(1)}%`, pos: (stock.perChange30d ?? 0) >= 0 },
                    { label: '1Y',  value: `${(stock.perChange365d ?? 0) >= 0 ? '+' : ''}${(stock.perChange365d ?? 0).toFixed(0)}%`, pos: (stock.perChange365d ?? 0) >= 0 },
                    { label: 'vs 52wH', value: `−${(stock.belowYearHigh ?? 0).toFixed(1)}%`, pos: false },
                ].map(({ label, value, pos }) => (
                    <div
                        key={label}
                        style={{
                            background: 'var(--surface2)',
                            borderRadius: 6,
                            padding: '5px 8px',
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: pos ? 'var(--green)' : 'var(--red)', fontFamily: 'DM Mono, monospace' }}>
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Signals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {stock.signals.slice(0, 3).map((sig, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ color: isBull ? 'var(--green)' : 'var(--red)', fontSize: 10, marginTop: 1, flexShrink: 0 }}>›</span>
                        <span style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>{sig}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function PredictiveMovers() {
    const [data, setData] = useState<PredictiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    async function load() {
        try {
            setLoading(true);
            const r = await fetch('/api/market/predictive-movers');
            if (!r.ok) throw new Error('Failed to fetch');
            const d = await r.json();
            setData(d);
            setLastUpdate(new Date().toLocaleTimeString('en-IN'));
            setError(null);
        } catch {
            setError('Failed to load predictive movers');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        const id = setInterval(load, 5 * 60 * 1000);
        return () => clearInterval(id);
    }, []);

    if (loading && !data) {
        return (
            <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--accent)' }}>⚡</div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'Bricolage Grotesque, DM Sans, sans-serif' }}>Predictive Movers</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Analysing momentum signals…</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: 160, borderRadius: 10 }} />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ padding: 20 }}>
                <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{error}</p>
                <button onClick={load} className="btn btn-secondary btn-sm">Retry</button>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="card" style={{ padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>⚡</div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'Bricolage Grotesque, DM Sans, sans-serif', letterSpacing: '-0.02em' }}>
                            Predictive Movers
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {data.meta.universe} NSE stocks scored · {lastUpdate}
                        </div>
                    </div>
                </div>
                <button
                    onClick={load}
                    className="btn btn-ghost btn-sm"
                    style={{ flexShrink: 0 }}
                    disabled={loading}
                >
                    {loading ? '…' : '↻ Refresh'}
                </button>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Bullish */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>▲ Bullish</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>predicted upside</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {data.bullish.map(s => <StockCard key={s.symbol} stock={s} side="bull" />)}
                        {data.bullish.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>No strong bullish setups found</p>}
                    </div>
                </div>

                {/* Bearish */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>▼ Bearish</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>predicted downside</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {data.bearish.map(s => <StockCard key={s.symbol} stock={s} side="bear" />)}
                        {data.bearish.length === 0 && <p style={{ fontSize: 12, color: 'var(--text3)' }}>No strong bearish setups found</p>}
                    </div>
                </div>
            </div>

            <p style={{ fontSize: 10, color: 'var(--text4)', marginTop: 14, textAlign: 'center', letterSpacing: '0.02em' }}>
                Scoring: 30d/1Y momentum · 52w range proximity · volume · session pattern · Not financial advice
            </p>
        </div>
    );
}
