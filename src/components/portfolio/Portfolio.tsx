'use client';

import { useEffect, useMemo, useState } from 'react';
import { PortfolioPosition, QuoteSnapshot, Stock } from '@/types';
import { useLocalStorage } from '@/lib/utils/useLocalStorage';
import { debounce, formatCurrency, formatPercent } from '@/lib/utils/format';

export default function Portfolio() {
    const [portfolio, setPortfolio] = useLocalStorage<PortfolioPosition[]>('portfolio', []);
    const [showAddForm, setShowAddForm] = useState(false);
    const [quotes, setQuotes] = useState<Record<string, QuoteSnapshot>>({});
    const [shouldLoadQuotes, setShouldLoadQuotes] = useState(false);
    const [quotesWarning, setQuotesWarning] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<Stock[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [formData, setFormData] = useState({
        symbol: '',
        name: '',
        quantity: '',
        buyPrice: '',
        buyDate: new Date().toISOString().split('T')[0]
    });

    const symbols = useMemo(() => portfolio.map((position) => position.symbol), [portfolio]);
    const searchSymbols = useMemo(
        () =>
            debounce(async (query: string) => {
                if (query.trim().length < 2) {
                    setSearchResults([]);
                    setShowSearchResults(false);
                    return;
                }

                setIsSearching(true);
                try {
                    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    setSearchResults(data.results || []);
                    setShowSearchResults(true);
                } catch (error) {
                    console.error('Portfolio symbol search error:', error);
                    setSearchResults([]);
                    setShowSearchResults(true);
                } finally {
                    setIsSearching(false);
                }
            }, 250),
        []
    );

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
                    console.error('Portfolio quotes error:', error);
                    setQuotesWarning(error instanceof Error ? error.message : 'Quotes are unavailable.');
                    setQuotes({});
                }
            }
        };

        void fetchQuotes();

        return () => {
            cancelled = true;
        };
    }, [symbols, shouldLoadQuotes]);

    const addPosition = () => {
        if (!formData.symbol || !formData.quantity || !formData.buyPrice) return;

        const position: PortfolioPosition = {
            id: Date.now().toString(),
            symbol: formData.symbol.toUpperCase(),
            name: formData.name || formData.symbol,
            type: 'stock',
            quantity: parseFloat(formData.quantity),
            buyPrice: parseFloat(formData.buyPrice),
            buyDate: formData.buyDate
        };

        setPortfolio([...portfolio, position]);
        setFormData({
            symbol: '',
            name: '',
            quantity: '',
            buyPrice: '',
            buyDate: new Date().toISOString().split('T')[0]
        });
        setSearchResults([]);
        setShowSearchResults(false);
        setShowAddForm(false);
        setShouldLoadQuotes(true);
    };

    const handleSymbolChange = (value: string) => {
        setFormData((previousValue) => ({
            ...previousValue,
            symbol: value,
            name: previousValue.name && previousValue.name === previousValue.symbol ? value : previousValue.name,
        }));
        searchSymbols(value);
    };

    const handleSelectSearchResult = (stock: Stock) => {
        setFormData((previousValue) => ({
            ...previousValue,
            symbol: stock.symbol,
            name: stock.name,
        }));
        setSearchResults([]);
        setShowSearchResults(false);
    };

    const removePosition = (id: string) => {
        setPortfolio(portfolio.filter(pos => pos.id !== id));
    };

    const positionsWithQuotes = portfolio.map((position) => {
        const liveQuote = quotes[position.symbol];
        const currentPrice = liveQuote?.price || position.currentPrice || position.buyPrice;
        const currencySymbol = liveQuote?.currency === 'INR' ? '₹' : '$';

        return {
            ...position,
            currentPrice,
            currencySymbol,
            liveQuote,
        };
    });

    const currencies = Array.from(new Set(positionsWithQuotes.map((position) => position.currencySymbol)));
    const isMixedCurrency = currencies.length > 1;
    const summaryCurrency = currencies[0] || '$';

    const totalInvested = positionsWithQuotes.reduce((sum, pos) => sum + (pos.quantity * pos.buyPrice), 0);
    const totalCurrent = positionsWithQuotes.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);
    const totalPnL = totalCurrent - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return (
        <div className="rounded-[28px] border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="border-b border-white/10 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Portfolio Manager</div>
                        <h3 className="mt-2 text-2xl font-semibold text-white">Holdings</h3>
                        <p className="mt-2 text-sm text-slate-400">Add positions with search-backed symbol entry and review mark-to-market P&amp;L.</p>
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn btn-primary text-sm px-3 py-1"
                    >
                        {showAddForm ? '✕' : '+ Add Position'}
                    </button>
                </div>
            </div>
            <div className="p-6 pt-6">
                {showAddForm && (
                    <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                        <div className="relative">
                            <input
                                type="text"
                                value={formData.symbol}
                                onChange={(e) => handleSymbolChange(e.target.value)}
                                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                                placeholder="Symbol (e.g., RELIANCE.NS, TCS.NS, ^NSEI)"
                                className="input w-full pr-10"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {isSearching ? '...' : 'Search'}
                            </div>

                            {showSearchResults && searchResults.length > 0 ? (
                                <div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
                                    {searchResults.map((stock, idx) => (
                                        <button
                                            key={`${stock.symbol}-${idx}`}
                                            type="button"
                                            onClick={() => handleSelectSearchResult(stock)}
                                            className="w-full border-b border-white/10 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/5"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold">{stock.symbol}</div>
                                                    <div className="text-sm text-muted-foreground">{stock.name}</div>
                                                </div>
                                                <div className="text-right text-xs text-muted-foreground">
                                                    <div>{stock.exchange}</div>
                                                    <div>{stock.provider || 'search'}</div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Name (optional)"
                            className="input w-full"
                        />
                        <input
                            type="number"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            placeholder="Quantity"
                            className="input w-full"
                            step="0.01"
                        />
                        <input
                            type="number"
                            value={formData.buyPrice}
                            onChange={(e) => setFormData({ ...formData, buyPrice: e.target.value })}
                            placeholder="Buy Price"
                            className="input w-full"
                            step="0.01"
                        />
                        <input
                            type="date"
                            value={formData.buyDate}
                            onChange={(e) => setFormData({ ...formData, buyDate: e.target.value })}
                            className="input w-full"
                        />
                        <button onClick={addPosition} className="btn btn-primary w-full">
                            Add Position
                        </button>
                    </div>
                )}

                {portfolio.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-slate-900 p-5">
                        {!shouldLoadQuotes ? (
                            <button onClick={() => setShouldLoadQuotes(true)} className="btn btn-secondary mb-4 w-full">
                                Load Portfolio Quotes
                            </button>
                        ) : null}
                        {quotesWarning ? (
                            <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                {quotesWarning}
                            </div>
                        ) : null}
                        <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3">
                            <div>
                                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Invested</div>
                                <div className="mt-2 text-xl font-semibold text-white">{isMixedCurrency ? 'Mixed' : formatCurrency(totalInvested, summaryCurrency)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Current Value</div>
                                <div className="mt-2 text-xl font-semibold text-white">{isMixedCurrency ? 'Mixed' : formatCurrency(totalCurrent, summaryCurrency)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Total P&amp;L</div>
                                <div className={`mt-2 text-xl font-semibold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {isMixedCurrency ? 'Mixed' : formatCurrency(totalPnL, summaryCurrency)} ({formatPercent(totalPnLPercent)})
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {portfolio.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>Your portfolio is empty</p>
                        <p className="text-sm mt-2">Add positions to track your investments</p>
                    </div>
                ) : (
                        <div className="space-y-3">
                            {positionsWithQuotes.map((pos) => {
                            const pnl = (pos.currentPrice - pos.buyPrice) * pos.quantity;
                            const pnlPercent = ((pos.currentPrice - pos.buyPrice) / pos.buyPrice) * 100;

                            return (
                                <div
                                    key={pos.id}
                                    className="group rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-semibold text-white">{pos.symbol}</div>
                                            <div className="text-xs text-slate-400">
                                                {pos.quantity} shares @ {formatCurrency(pos.buyPrice, pos.currencySymbol)}
                                            </div>
                                            {shouldLoadQuotes && pos.liveQuote ? (
                                                <div className="mt-1 text-xs text-slate-500">
                                                    Live: {formatCurrency(pos.currentPrice, pos.currencySymbol)} ({formatPercent(pos.liveQuote.changePercent)})
                                                </div>
                                            ) : null}
                                        </div>
                                        <button
                                            onClick={() => removePosition(pos.id)}
                                            className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 transition-opacity"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">P&amp;L</span>
                                        <span className={pnl >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                            {formatCurrency(pnl, pos.currencySymbol)} ({formatPercent(pnlPercent)})
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
