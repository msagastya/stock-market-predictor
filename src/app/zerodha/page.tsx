'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KiteStatus {
    status: 'not_configured' | 'not_authenticated' | 'connected' | 'token_expired';
    user?: { id: string; name: string; email: string; broker: string };
    loginUrl?: string;
    message?: string;
}

interface GTT {
    id: number;
    type: 'single' | 'two-leg';
    status: string;
    condition: { exchange: string; tradingsymbol: string; trigger_values: number[]; last_price: number };
    orders: Array<{ transaction_type: string; quantity: number; price: number; product: string }>;
    created_at: string;
    expires_at: string;
}

interface Holding {
    tradingsymbol: string;
    exchange: string;
    quantity: number;
    average_price: number;
    last_price: number;
    pnl: number;
    day_change_percentage: number;
    product: string;
}

interface Order {
    order_id: string;
    tradingsymbol: string;
    exchange: string;
    transaction_type: string;
    order_type: string;
    quantity: number;
    price: number;
    average_price: number;
    status: string;
    order_timestamp: string;
    product: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        active: 'bg-emerald-500/20 text-emerald-300',
        triggered: 'bg-blue-500/20 text-blue-300',
        expired: 'bg-slate-500/20 text-slate-400',
        cancelled: 'bg-slate-500/20 text-slate-400',
        deleted: 'bg-rose-500/20 text-rose-300',
        COMPLETE: 'bg-emerald-500/20 text-emerald-300',
        OPEN: 'bg-blue-500/20 text-blue-300',
        CANCELLED: 'bg-slate-500/20 text-slate-400',
        REJECTED: 'bg-rose-500/20 text-rose-300',
    };
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] || 'bg-white/10 text-slate-300'}`}>
            {status}
        </span>
    );
}

function GTTCard({ gtt, onDelete }: { gtt: GTT; onDelete: (id: number) => void }) {
    const isOCO = gtt.type === 'two-leg';
    const sym = gtt.condition.tradingsymbol;
    const exch = gtt.condition.exchange;
    const triggers = gtt.condition.trigger_values;

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{sym}</span>
                        <span className="text-xs text-slate-400">{exch}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${isOCO ? 'bg-violet-500/20 text-violet-300' : 'bg-amber-500/20 text-amber-300'}`}>
                            {isOCO ? 'OCO' : 'Single'}
                        </span>
                        <StatusBadge status={gtt.status} />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                        LTP: ₹{gtt.condition.last_price} · Created: {new Date(gtt.created_at).toLocaleDateString('en-IN')}
                    </div>
                </div>
                {gtt.status === 'active' && (
                    <button
                        onClick={() => onDelete(gtt.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                    >
                        Delete
                    </button>
                )}
            </div>

            <div className="space-y-1.5">
                {triggers.map((t, i) => {
                    const order = gtt.orders[i];
                    if (!order) return null;
                    const isSell = order.transaction_type === 'SELL';
                    return (
                        <div key={i} className="flex items-center gap-3 text-xs">
                            <span className={`w-1.5 h-1.5 rounded-full ${isSell ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                            <span className="text-slate-400">
                                {order.transaction_type} {order.quantity} @ ₹{order.price}
                            </span>
                            <span className="text-slate-500">when price hits ₹{t}</span>
                            <span className="text-slate-600">{order.product}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Create GTT Form ──────────────────────────────────────────────────────────

function CreateGTTForm({ onCreated }: { onCreated: () => void }) {
    const [type, setType] = useState<'single' | 'oco'>('single');
    const [form, setForm] = useState({
        symbol: '', lastPrice: '', triggerPrice: '', orderPrice: '',
        stopLossPrice: '', targetPrice: '', quantity: '1',
        transactionType: 'BUY', product: 'CNC',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const body: any = {
                type,
                symbol: form.symbol.includes('.') ? form.symbol : form.symbol + '.NS',
                lastPrice: Number(form.lastPrice),
                quantity: Number(form.quantity),
                product: form.product,
            };
            if (type === 'single') {
                body.triggerPrice = Number(form.triggerPrice);
                body.orderPrice = Number(form.orderPrice);
                body.transactionType = form.transactionType;
            } else {
                body.stopLossPrice = Number(form.stopLossPrice);
                body.targetPrice = Number(form.targetPrice);
            }
            const r = await fetch('/api/kite/gtt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const d = await r.json();
            if (d.error) throw new Error(d.error);
            onCreated();
            setForm({ symbol: '', lastPrice: '', triggerPrice: '', orderPrice: '', stopLossPrice: '', targetPrice: '', quantity: '1', transactionType: 'BUY', product: 'CNC' });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500/50";
    const labelCls = "block text-xs text-slate-400 mb-1";

    return (
        <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Create GTT Trigger</h3>

            <div className="flex gap-2 mb-4">
                {(['single', 'oco'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setType(t)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${type === t ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                        {t === 'single' ? 'Single Trigger' : 'OCO (SL + Target)'}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label className={labelCls}>Symbol (e.g. RELIANCE.NS)</label>
                    <input className={inputCls} placeholder="RELIANCE.NS" value={form.symbol} onChange={e => set('symbol', e.target.value)} required />
                </div>
                <div>
                    <label className={labelCls}>Current Market Price (LTP)</label>
                    <input className={inputCls} type="number" step="0.05" placeholder="1435" value={form.lastPrice} onChange={e => set('lastPrice', e.target.value)} required />
                </div>
                <div>
                    <label className={labelCls}>Quantity</label>
                    <input className={inputCls} type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} required />
                </div>
                <div>
                    <label className={labelCls}>Product</label>
                    <select className={inputCls} value={form.product} onChange={e => set('product', e.target.value)}>
                        <option value="CNC">CNC (Delivery)</option>
                        <option value="NRML">NRML (F&O)</option>
                        <option value="MIS">MIS (Intraday)</option>
                    </select>
                </div>
            </div>

            {type === 'single' ? (
                <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                        <label className={labelCls}>Transaction</label>
                        <select className={inputCls} value={form.transactionType} onChange={e => set('transactionType', e.target.value)}>
                            <option value="BUY">BUY</option>
                            <option value="SELL">SELL</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Trigger Price ₹</label>
                        <input className={inputCls} type="number" step="0.05" placeholder="1500" value={form.triggerPrice} onChange={e => set('triggerPrice', e.target.value)} required />
                    </div>
                    <div>
                        <label className={labelCls}>Order Price ₹</label>
                        <input className={inputCls} type="number" step="0.05" placeholder="1502" value={form.orderPrice} onChange={e => set('orderPrice', e.target.value)} required />
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className={labelCls}>Stop Loss Price ₹</label>
                        <input className={inputCls} type="number" step="0.05" placeholder="1380" value={form.stopLossPrice} onChange={e => set('stopLossPrice', e.target.value)} required />
                    </div>
                    <div>
                        <label className={labelCls}>Target Price ₹</label>
                        <input className={inputCls} type="number" step="0.05" placeholder="1600" value={form.targetPrice} onChange={e => set('targetPrice', e.target.value)} required />
                    </div>
                </div>
            )}

            {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

            <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 text-white rounded-lg text-sm font-medium transition-colors">
                {loading ? 'Creating…' : 'Create Trigger'}
            </button>
        </form>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ZerodhaPageInner() {
    const searchParams = useSearchParams();
    const [kiteStatus, setKiteStatus] = useState<KiteStatus | null>(null);
    const [gtts, setGTTs] = useState<GTT[]>([]);
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [margins, setMargins] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'gtts' | 'holdings' | 'orders'>('gtts');
    const [loading, setLoading] = useState(true);

    const successMsg = searchParams.get('success') ? `Connected as ${searchParams.get('user')}` : null;
    const errorMsg = searchParams.get('error');

    const loadStatus = useCallback(async () => {
        const r = await fetch('/api/kite/status');
        const d = await r.json();
        setKiteStatus(d);
        return d;
    }, []);

    const loadGTTs = useCallback(async () => {
        const r = await fetch('/api/kite/gtt');
        const d = await r.json();
        if (d.gtts) setGTTs(d.gtts);
    }, []);

    const loadPortfolio = useCallback(async () => {
        const r = await fetch('/api/kite/portfolio');
        const d = await r.json();
        if (d.holdings) setHoldings(d.holdings);
        if (d.margins) setMargins(d.margins);
    }, []);

    const loadOrders = useCallback(async () => {
        const r = await fetch('/api/kite/orders');
        const d = await r.json();
        if (d.data) setOrders(d.data);
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const status = await loadStatus();
            if (status.status === 'connected') {
                await Promise.allSettled([loadGTTs(), loadPortfolio(), loadOrders()]);
            }
            setLoading(false);
        })();
    }, [loadStatus, loadGTTs, loadPortfolio, loadOrders]); // eslint-disable-line react-hooks/exhaustive-deps

    async function deleteGTT(id: number) {
        if (!confirm(`Delete GTT #${id}?`)) return;
        await fetch(`/api/kite/gtt?id=${id}`, { method: 'DELETE' });
        await loadGTTs();
    }

    const isConnected = kiteStatus?.status === 'connected';
    const needsLogin = kiteStatus?.status === 'not_authenticated' || kiteStatus?.status === 'token_expired';
    const notConfigured = kiteStatus?.status === 'not_configured';

    const totalPnL = holdings.reduce((s, h) => s + h.pnl, 0);
    const activeGTTs = gtts.filter(g => g.status === 'active').length;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Zerodha</h1>
                    <p className="text-slate-400 text-sm mt-1">GTT triggers, holdings, and orders via Kite Connect</p>
                </div>
                {isConnected && kiteStatus.user && (
                    <div className="text-right">
                        <div className="text-white font-medium">{kiteStatus.user.name}</div>
                        <div className="text-xs text-slate-400">{kiteStatus.user.id} · {kiteStatus.user.broker}</div>
                    </div>
                )}
            </div>

            {/* Banners */}
            {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-300 text-sm">
                    ✓ {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-sm">
                    ✗ {decodeURIComponent(errorMsg)}
                </div>
            )}

            {/* Not configured */}
            {notConfigured && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 text-center">
                    <div className="text-amber-300 font-semibold mb-2">API Keys Not Set</div>
                    <p className="text-slate-400 text-sm mb-4">
                        Run this command in your terminal to add your Kite API keys:
                    </p>
                    <code className="block bg-black/40 rounded-lg p-3 text-emerald-300 text-sm font-mono text-left mb-4">
                        {`echo "KITE_API_KEY=your_api_key\\nKITE_API_SECRET=your_api_secret" >> .env.local`}
                    </code>
                    <p className="text-slate-500 text-xs">
                        Get your keys from <a href="https://kite.trade/connect" target="_blank" className="text-violet-400 underline">kite.trade/connect</a> → Create App → set redirect URL to <strong>http://localhost:1803/api/kite/callback</strong>
                    </p>
                </div>
            )}

            {/* Needs login */}
            {needsLogin && kiteStatus?.loginUrl && (
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-6 text-center">
                    <div className="text-violet-300 font-semibold mb-2">
                        {kiteStatus.status === 'token_expired' ? 'Session Expired — Re-Login Required' : 'Connect Your Zerodha Account'}
                    </div>
                    <p className="text-slate-400 text-sm mb-4">
                        Token expires daily at 6 AM. Click below to login with Zerodha.
                    </p>
                    <a href={kiteStatus.loginUrl}
                        className="inline-block px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors">
                        Login with Zerodha
                    </a>
                </div>
            )}

            {/* Connected — dashboard */}
            {isConnected && (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="text-slate-400 text-xs mb-1">Active GTTs</div>
                            <div className="text-2xl font-bold text-white">{activeGTTs}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="text-slate-400 text-xs mb-1">Holdings P&L</div>
                            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalPnL >= 0 ? '+' : ''}₹{Math.abs(totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <div className="text-slate-400 text-xs mb-1">Available Cash</div>
                            <div className="text-2xl font-bold text-white">
                                {margins?.equity?.available?.cash != null
                                    ? `₹${margins.equity.available.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                    : '—'}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
                        {(['gtts', 'holdings', 'orders'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                                {tab === 'gtts' ? `GTT Triggers (${activeGTTs})` : tab === 'holdings' ? `Holdings (${holdings.length})` : `Orders (${orders.length})`}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'gtts' && (
                        <div className="grid lg:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <h3 className="text-white font-medium text-sm">Active Triggers</h3>
                                {gtts.length === 0 && <p className="text-slate-500 text-sm">No GTTs yet. Create one →</p>}
                                {gtts.map(g => <GTTCard key={g.id} gtt={g} onDelete={deleteGTT} />)}
                            </div>
                            <CreateGTTForm onCreated={loadGTTs} />
                        </div>
                    )}

                    {activeTab === 'holdings' && (
                        <div className="space-y-2">
                            {holdings.length === 0 && <p className="text-slate-500 text-sm">No holdings found.</p>}
                            {holdings.map(h => (
                                <div key={h.tradingsymbol} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:border-white/20 transition-all">
                                    <div>
                                        <span className="font-semibold text-white">{h.tradingsymbol}</span>
                                        <span className="text-xs text-slate-400 ml-2">{h.exchange} · {h.product} · {h.quantity} shares</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-white">₹{h.last_price}</div>
                                        <div className="text-xs">
                                            <span className={h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                {h.pnl >= 0 ? '+' : ''}₹{h.pnl.toFixed(0)}
                                            </span>
                                            <span className={`ml-2 ${h.day_change_percentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                ({h.day_change_percentage >= 0 ? '+' : ''}{h.day_change_percentage.toFixed(2)}% today)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="space-y-2">
                            {orders.length === 0 && <p className="text-slate-500 text-sm">No orders today.</p>}
                            {orders.map(o => (
                                <div key={o.order_id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                    <div>
                                        <span className={`font-semibold ${o.transaction_type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {o.transaction_type}
                                        </span>
                                        <span className="text-white ml-2">{o.tradingsymbol}</span>
                                        <span className="text-xs text-slate-400 ml-2">{o.quantity} @ ₹{o.price || o.average_price} · {o.order_type} · {o.product}</span>
                                    </div>
                                    <div className="text-right" style={{ minWidth: 120 }}>
                                        <StatusBadge status={o.status} />
                                        <div className="text-xs text-slate-500 mt-1" style={{ whiteSpace: 'nowrap' }}>
                                            {o.order_timestamp
                                                ? new Date(o.order_timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
                                                : ''}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {loading && !kiteStatus && (
                <div className="text-slate-500 text-sm">Loading…</div>
            )}
        </div>
    );
}

export default function ZerodhaPage() {
    return (
        <Suspense fallback={<div className="p-8 text-slate-400">Loading…</div>}>
            <ZerodhaPageInner />
        </Suspense>
    );
}
