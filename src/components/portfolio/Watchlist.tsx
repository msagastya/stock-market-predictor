'use client';

import { useEffect, useMemo, useState } from 'react';
import { QuoteSnapshot, WatchlistItem } from '@/types';
import { useLocalStorage } from '@/lib/utils/useLocalStorage';
import { formatCurrency, formatPercent } from '@/lib/utils/format';

interface WatchlistProps {
    onSelectStock: (symbol: string, name: string) => void;
}

export default function Watchlist({ onSelectStock }: WatchlistProps) {
    const [watchlist, setWatchlist] = useLocalStorage<WatchlistItem[]>('watchlist', [
        { symbol: '^NSEI', name: 'Nifty 50', type: 'index', addedAt: new Date().toISOString() },
        { symbol: '^BSESN', name: 'Sensex', type: 'index', addedAt: new Date().toISOString() },
        { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'stock', addedAt: new Date().toISOString() },
    ]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSymbol, setNewSymbol] = useState('');
    const [newName, setNewName] = useState('');
    const [quotes, setQuotes] = useState<Record<string, QuoteSnapshot>>({});
    const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
    const [shouldLoadQuotes, setShouldLoadQuotes] = useState(false);
    const [quotesWarning, setQuotesWarning] = useState<string | null>(null);

    const symbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist]);

    useEffect(() => {
        if (!shouldLoadQuotes) {
            return;
        }

        let cancelled = false;

        const fetchQuotes = async () => {
            if (symbols.length === 0) {
                setQuotes({});
                return;
            }

            setIsLoadingQuotes(true);

            try {
                const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch quotes');
                }

                if (!cancelled) {
                    setQuotesWarning(data.warning || null);
                    const nextQuotes = Object.fromEntries(
                        (data.quotes || []).map((quote: QuoteSnapshot) => [quote.symbol, quote])
                    );
                    setQuotes(nextQuotes);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Watchlist quotes error:', error);
                    setQuotesWarning(error instanceof Error ? error.message : 'Quotes are unavailable.');
                    setQuotes({});
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingQuotes(false);
                }
            }
        };

        void fetchQuotes();

        return () => {
            cancelled = true;
        };
    }, [symbols, shouldLoadQuotes]);

    const addToWatchlist = () => {
        if (!newSymbol.trim()) return;

        const item: WatchlistItem = {
            symbol: newSymbol.toUpperCase(),
            name: newName || newSymbol,
            type: 'stock',
            addedAt: new Date().toISOString()
        };

        setWatchlist([...watchlist, item]);
        setNewSymbol('');
        setNewName('');
        setShowAddForm(false);
    };

    const removeFromWatchlist = (symbol: string) => {
        setWatchlist(watchlist.filter(item => item.symbol !== symbol));
    };

    return (
        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-white/10 p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Monitor</div>
                        <h3 className="mt-2 text-2xl font-semibold text-white">Watchlist</h3>
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn btn-primary text-sm px-3 py-1"
                    >
                        {showAddForm ? '✕' : '+ Add'}
                    </button>
                </div>
            </div>
            <div className="p-6 pt-6">
                {showAddForm && (
                    <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                        <input
                            type="text"
                            value={newSymbol}
                            onChange={(e) => setNewSymbol(e.target.value)}
                            placeholder="Symbol (e.g., AAPL)"
                            className="input w-full mb-2"
                        />
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Name (optional)"
                            className="input w-full mb-2"
                        />
                        <button onClick={addToWatchlist} className="btn btn-primary w-full">
                            Add to Watchlist
                        </button>
                    </div>
                )}

                {watchlist.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>Your watchlist is empty</p>
                        <p className="text-sm mt-2">Add stocks to track them easily</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {!shouldLoadQuotes ? (
                            <button onClick={() => setShouldLoadQuotes(true)} className="btn btn-secondary w-full">
                                Load Watchlist Quotes
                            </button>
                        ) : null}
                        {quotesWarning ? (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                {quotesWarning}
                            </div>
                        ) : null}
                        {watchlist.map((item) => (
                            <div key={item.symbol} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                                <button
                                    onClick={() => onSelectStock(item.symbol, item.name)}
                                    className="flex-1 text-left"
                                >
                                    <div className="font-semibold text-white">{item.symbol}</div>
                                    <div className="text-sm text-slate-400">{item.name}</div>
                                    {shouldLoadQuotes && quotes[item.symbol] ? (
                                        <div className="mt-2 flex items-center gap-2 text-xs">
                                            <span className="font-mono text-foreground">
                                                {formatCurrency(quotes[item.symbol].price, quotes[item.symbol].currency === 'INR' ? '₹' : '$')}
                                            </span>
                                            <span className={quotes[item.symbol].change >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                {formatPercent(quotes[item.symbol].changePercent)}
                                            </span>
                                        </div>
                                    ) : shouldLoadQuotes && isLoadingQuotes ? (
                                        <div className="mt-2 text-xs text-muted-foreground">Loading quote...</div>
                                    ) : null}
                                </button>
                                <button
                                    onClick={() => removeFromWatchlist(item.symbol)}
                                    className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 transition-opacity ml-2"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
