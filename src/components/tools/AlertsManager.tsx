'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@/lib/utils/useLocalStorage';

interface PriceAlert {
    id: string;
    symbol: string;
    type: 'above' | 'below';
    price: number;
    enabled: boolean;
    triggered: boolean;
}

const POLL_INTERVAL_MS = 30_000;

function fireNotification(alert: PriceAlert, currentPrice: number) {
    const direction = alert.type === 'above' ? 'broke above' : 'fell below';
    const body = `${alert.symbol} ${direction} ₹${alert.price.toFixed(2)} — now at ₹${currentPrice.toFixed(2)}`;

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Price Alert: ${alert.symbol}`, { body, icon: '/favicon.ico' });
    }
}

export default function AlertsManager() {
    const [alerts, setAlerts] = useLocalStorage<PriceAlert[]>('price-alerts', []);
    const [showForm, setShowForm] = useState(false);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [newAlert, setNewAlert] = useState({ symbol: '', type: 'above' as 'above' | 'below', price: 0 });

    // Keep a ref so the interval closure always sees the latest alerts
    const alertsRef = useRef(alerts);
    useEffect(() => { alertsRef.current = alerts; }, [alerts]);

    const addAlert = () => {
        if (!newAlert.symbol || newAlert.price <= 0) return;

        const alert: PriceAlert = {
            id: Date.now().toString(),
            symbol: newAlert.symbol.toUpperCase().trim(),
            type: newAlert.type,
            price: newAlert.price,
            enabled: true,
            triggered: false,
        };

        setAlerts([...alerts, alert]);
        setNewAlert({ symbol: '', type: 'above', price: 0 });
        setShowForm(false);

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    const toggleAlert = (id: string) =>
        setAlerts(alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled, triggered: false } : a)));

    const deleteAlert = (id: string) => setAlerts(alerts.filter((a) => a.id !== id));

    const resetAlert = (id: string) =>
        setAlerts(alerts.map((a) => (a.id === id ? { ...a, triggered: false } : a)));

    // ── Polling loop ──────────────────────────────────────────────────────────
    useEffect(() => {
        const checkPrices = async () => {
            const active = alertsRef.current.filter((a) => a.enabled && !a.triggered);
            if (active.length === 0) return;

            const symbolSet: Record<string, boolean> = {};
            active.forEach((a) => { symbolSet[a.symbol] = true; });
            const symbols = Object.keys(symbolSet);

            try {
                const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`);
                if (!res.ok) return;
                const data = await res.json();
                const quotes: { symbol: string; regularMarketPrice: number }[] = data.quotes || [];

                const priceMap: Record<string, number> = {};
                for (const q of quotes) priceMap[q.symbol] = q.regularMarketPrice;
                setLivePrices(priceMap);
                setLastChecked(new Date());

                setAlerts(alertsRef.current.map((alert) => {
                        if (!alert.enabled || alert.triggered) return alert;
                        const price = priceMap[alert.symbol];
                        if (price == null) return alert;

                        const hit =
                            (alert.type === 'above' && price >= alert.price) ||
                            (alert.type === 'below' && price <= alert.price);

                        if (hit) {
                            fireNotification(alert, price);
                            return { ...alert, triggered: true };
                        }
                        return alert;
                }));
            } catch {
                // network error — silent, will retry next interval
            }
        };

        checkPrices(); // immediate first check
        const id = setInterval(checkPrices, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const activeCount = alerts.filter((a) => a.enabled && !a.triggered).length;

    return (
        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-white/10 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Trigger Desk</div>
                        <h3 className="mt-2 text-2xl font-semibold text-white">Price Alerts</h3>
                        {lastChecked && (
                            <p className="mt-1 text-xs text-slate-500">
                                {activeCount} active · last checked {lastChecked.toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="btn btn-primary px-3 py-1 text-sm"
                    >
                        {showForm ? '✕' : '+ New Alert'}
                    </button>
                </div>
            </div>

            <div className="p-6">
                {showForm && (
                    <div className="mb-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                        <input
                            type="text"
                            value={newAlert.symbol}
                            onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value })}
                            placeholder="Symbol (e.g. RELIANCE.NS)"
                            className="input w-full"
                        />
                        <select
                            value={newAlert.type}
                            onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value as 'above' | 'below' })}
                            className="input w-full"
                        >
                            <option value="above">Price Goes Above</option>
                            <option value="below">Price Falls Below</option>
                        </select>
                        <input
                            type="number"
                            value={newAlert.price || ''}
                            onChange={(e) => setNewAlert({ ...newAlert, price: Number(e.target.value) })}
                            placeholder="Target Price"
                            className="input w-full"
                            step="0.01"
                        />
                        <button onClick={addAlert} className="btn btn-primary w-full">
                            Create Alert
                        </button>
                    </div>
                )}

                {alerts.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                        <p>No alerts set</p>
                        <p className="mt-2 text-sm">Get notified when prices hit your targets</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((alert) => {
                            const live = livePrices[alert.symbol];
                            const distance = live != null
                                ? ((live - alert.price) / alert.price) * 100
                                : null;

                            return (
                                <div
                                    key={alert.id}
                                    className={`rounded-2xl border p-4 transition-all ${
                                        alert.triggered
                                            ? 'border-green-500/30 bg-green-500/10'
                                            : alert.enabled
                                            ? 'border-blue-500/20 bg-white/5'
                                            : 'border-white/10 bg-white/5 opacity-50'
                                    }`}
                                >
                                    <div className="mb-2 flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-semibold text-white">{alert.symbol}</div>
                                            <div className="text-sm text-slate-400">
                                                {alert.type === 'above' ? 'Break above' : 'Break below'}{' '}
                                                ₹{alert.price.toFixed(2)}
                                            </div>
                                            {live != null && (
                                                <div className="mt-1 text-xs text-slate-500">
                                                    Live: ₹{live.toFixed(2)}
                                                    {distance != null && (
                                                        <span className={`ml-2 ${Math.abs(distance) < 1 ? 'text-yellow-400' : 'text-slate-500'}`}>
                                                            ({distance > 0 ? '+' : ''}{distance.toFixed(2)}% away)
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => toggleAlert(alert.id)}
                                                className={`rounded-full px-3 py-1 text-sm ${
                                                    alert.enabled ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
                                                }`}
                                            >
                                                {alert.enabled ? 'ON' : 'OFF'}
                                            </button>
                                            {alert.triggered && (
                                                <button
                                                    onClick={() => resetAlert(alert.id)}
                                                    className="rounded-full bg-slate-700 px-3 py-1 text-sm text-slate-300"
                                                >
                                                    Reset
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteAlert(alert.id)}
                                                className="text-red-500 hover:text-red-400"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                    {alert.triggered && (
                                        <div className="text-xs font-medium text-green-400">
                                            Target hit — alert triggered
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
