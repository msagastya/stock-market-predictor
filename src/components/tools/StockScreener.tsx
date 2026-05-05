'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Stock } from '@/types';
import { useLocalStorage } from '@/lib/utils/useLocalStorage';

interface ScreenerCriteria {
    minPrice: number;
    maxPrice: number;
    minPE: number;
    maxPE: number;
    minMarketCap: number;
    minVolume: number;
}

interface SavedFilter {
    id: string;
    name: string;
    query: string;
    criteria: ScreenerCriteria;
}

const DEFAULT_CRITERIA: ScreenerCriteria = {
    minPrice: 0,
    maxPrice: 100000,
    minPE: 0,
    maxPE: 50,
    minMarketCap: 0,
    minVolume: 0,
};

const PRESET_SCREENS: SavedFilter[] = [
    {
        id: 'preset-largecap',
        name: 'India Large Cap',
        query: 'nifty 50',
        criteria: { minPrice: 0, maxPrice: 100000, minPE: 0, maxPE: 25, minMarketCap: 1000000000, minVolume: 1000000 },
    },
    {
        id: 'preset-ustech',
        name: 'US Tech',
        query: 'nasdaq technology',
        criteria: { minPrice: 50, maxPrice: 100000, minPE: 20, maxPE: 50, minMarketCap: 5000000000, minVolume: 2000000 },
    },
    {
        id: 'preset-banks',
        name: 'Private Banks',
        query: 'hdfc icici axis bank',
        criteria: { minPrice: 0, maxPrice: 100000, minPE: 0, maxPE: 30, minMarketCap: 0, minVolume: 500000 },
    },
    {
        id: 'preset-bluechip',
        name: 'Blue Chips',
        query: 'apple microsoft alphabet',
        criteria: { minPrice: 0, maxPrice: 100000, minPE: 0, maxPE: 50, minMarketCap: 2000000000, minVolume: 0 },
    },
];

export default function StockScreener() {
    const router = useRouter();
    const [criteria, setCriteria] = useState<ScreenerCriteria>(DEFAULT_CRITERIA);
    const [results, setResults] = useState<Stock[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [query, setQuery] = useState('large cap india');
    const [savedFilters, setSavedFilters] = useLocalStorage<SavedFilter[]>('screener-saved-filters', []);
    const [saveFilterName, setSaveFilterName] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);

    const applyFilter = (filter: SavedFilter) => {
        setCriteria(filter.criteria);
        setQuery(filter.query);
    };

    const saveCurrentFilter = () => {
        const name = saveFilterName.trim();
        if (!name) return;
        const filter: SavedFilter = {
            id: Date.now().toString(),
            name,
            query,
            criteria,
        };
        setSavedFilters([...savedFilters, filter]);
        setSaveFilterName('');
        setShowSaveInput(false);
    };

    const deleteSavedFilter = (id: string) => {
        setSavedFilters(savedFilters.filter((f) => f.id !== id));
    };

    const runScreen = async () => {
        setIsSearching(true);
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            setResults((data.results || []).slice(0, 8));
        } catch {
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const allScreens = [...PRESET_SCREENS, ...savedFilters];

    return (
        <div className="glass card">
            <div className="card-header">
                <h3 className="card-title">Stock Screener</h3>
                <p className="card-description">Use quick discovery presets, then jump into research for any result</p>
            </div>
            <div className="card-content">
                {/* Presets + saved filters */}
                <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">Screens</span>
                        <button
                            onClick={() => setShowSaveInput(!showSaveInput)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            {showSaveInput ? 'Cancel' : '+ Save current'}
                        </button>
                    </div>

                    {showSaveInput && (
                        <div className="mb-3 flex gap-2">
                            <input
                                type="text"
                                value={saveFilterName}
                                onChange={(e) => setSaveFilterName(e.target.value)}
                                placeholder="Filter name…"
                                className="input flex-1 text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && saveCurrentFilter()}
                            />
                            <button onClick={saveCurrentFilter} className="btn btn-primary text-xs px-3">
                                Save
                            </button>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {allScreens.map((screen) => (
                            <div key={screen.id} className="flex items-center gap-1">
                                <button
                                    onClick={() => applyFilter(screen)}
                                    className="btn btn-secondary px-3 py-1 text-xs"
                                >
                                    {screen.name}
                                </button>
                                {!screen.id.startsWith('preset-') && (
                                    <button
                                        onClick={() => deleteSavedFilter(screen.id)}
                                        className="text-xs text-slate-500 hover:text-red-400"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Discovery query */}
                <div className="mb-4">
                    <label className="text-xs text-muted-foreground">Discovery Query</label>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g. nifty banks, semiconductor, cloud software"
                        className="input w-full text-sm"
                    />
                </div>

                {/* Criteria */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground">Min Price</label>
                        <input type="number" value={criteria.minPrice} onChange={(e) => setCriteria({ ...criteria, minPrice: Number(e.target.value) })} className="input w-full text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Max Price</label>
                        <input type="number" value={criteria.maxPrice} onChange={(e) => setCriteria({ ...criteria, maxPrice: Number(e.target.value) })} className="input w-full text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Min P/E</label>
                        <input type="number" value={criteria.minPE} onChange={(e) => setCriteria({ ...criteria, minPE: Number(e.target.value) })} className="input w-full text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">Max P/E</label>
                        <input type="number" value={criteria.maxPE} onChange={(e) => setCriteria({ ...criteria, maxPE: Number(e.target.value) })} className="input w-full text-sm" />
                    </div>
                </div>

                <button onClick={runScreen} disabled={isSearching} className="btn btn-primary w-full">
                    {isSearching ? 'Screening…' : 'Run Discovery'}
                </button>

                {/* Results */}
                {results.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <div className="text-sm font-medium">Results ({results.length})</div>
                        {results.map((stock) => (
                            <button
                                key={stock.symbol}
                                onClick={() => router.push(`/research/${encodeURIComponent(stock.symbol)}?name=${encodeURIComponent(stock.name)}`)}
                                className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold">{stock.symbol}</div>
                                        <div className="text-xs text-muted-foreground">{stock.name}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium">₹{stock.price.toFixed(2)}</div>
                                        <div className={`text-xs ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
