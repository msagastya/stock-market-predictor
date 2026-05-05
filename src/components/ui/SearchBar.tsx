'use client';

import { useMemo, useState } from 'react';
import { Stock } from '@/types';
import { debounce } from '@/lib/utils/format';

interface SearchBarProps {
    onSelectStock: (symbol: string, name: string) => void;
}

export default function SearchBar({ onSelectStock }: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Stock[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const searchStocks = useMemo(
        () =>
            debounce(async (searchQuery: string) => {
                if (searchQuery.trim().length < 2) {
                    setResults([]);
                    setShowResults(false);
                    return;
                }

                setIsSearching(true);
                try {
                    const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
                    const data = await response.json();
                    setResults(data.results || []);
                    setShowResults(true);
                } catch (error) {
                    console.error('Search error:', error);
                    setResults([]);
                    setShowResults(true);
                } finally {
                    setIsSearching(false);
                }
            }, 300),
        []
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        searchStocks(value);
    };

    const handleSelectStock = (stock: Stock) => {
        setQuery('');
        setResults([]);
        setShowResults(false);
        onSelectStock(stock.symbol, stock.name);
    };

    return (
        <div className="relative w-full max-w-2xl">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                    placeholder="Search NSE, BSE, AMFI, Yahoo, or Kite-backed symbols..."
                    className="input w-full pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isSearching ? (
                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                    ) : (
                        <span className="text-muted-foreground">🔍</span>
                    )}
                </div>
            </div>

            {showResults && results.length > 0 && (
                <div className="absolute z-50 w-full mt-2 glass-strong rounded-lg shadow-2xl max-h-96 overflow-y-auto">
                    {results.map((stock, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSelectStock(stock)}
                            className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0 first:rounded-t-lg last:rounded-b-lg"
                        >
                            <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-semibold">{stock.symbol}</div>
                                        <div className="text-sm text-muted-foreground truncate">{stock.name}</div>
                                    </div>
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground">{stock.exchange}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                        {stock.provider || 'live'} {stock.assetType ? `• ${stock.assetType}` : ''}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {showResults && !isSearching && query.trim().length >= 2 && results.length === 0 && (
                <div className="absolute z-50 w-full mt-2 glass-strong rounded-lg shadow-2xl p-4 text-center text-muted-foreground">
                    No results found for &quot;{query}&quot;
                </div>
            )}
        </div>
    );
}
