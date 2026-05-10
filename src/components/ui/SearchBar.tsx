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
        () => debounce(async (searchQuery: string) => {
            if (searchQuery.trim().length < 2) { setResults([]); setShowResults(false); return; }
            setIsSearching(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();
                setResults(data.results || []);
                setShowResults(true);
            } catch { setResults([]); setShowResults(true); }
            finally { setIsSearching(false); }
        }, 300), []
    );

    const handleSelect = (stock: Stock) => {
        setQuery(''); setResults([]); setShowResults(false);
        onSelectStock(stock.symbol, stock.name);
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); searchStocks(e.target.value); }}
                    onFocus={() => results.length > 0 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 150)}
                    placeholder="Search stocks, indices, mutual funds..."
                    style={{
                        width: '100%',
                        padding: '8px 36px 8px 12px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border2)',
                        borderRadius: 6,
                        color: 'var(--text)',
                        fontSize: 13,
                        fontFamily: 'DM Sans, sans-serif',
                        outline: 'none',
                    }}
                    onFocusCapture={e => (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'}
                    onBlurCapture={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border2)'}
                />
                <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 12 }}>
                    {isSearching
                        ? <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        : '⌕'
                    }
                </div>
            </div>

            {showResults && results.length > 0 && (
                <div style={{
                    position: 'absolute',
                    zIndex: 100,
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    borderRadius: 8,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    maxHeight: 360,
                    overflowY: 'auto',
                }}>
                    {results.map((stock, idx) => (
                        <button
                            key={idx}
                            onMouseDown={() => handleSelect(stock)}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none',
                                cursor: 'pointer',
                                fontFamily: 'DM Sans, sans-serif',
                                textAlign: 'left',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{stock.symbol}</div>
                                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{stock.name}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{stock.exchange}</div>
                                {stock.assetType && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{stock.assetType}</div>}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {showResults && !isSearching && query.trim().length >= 2 && results.length === 0 && (
                <div style={{
                    position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0, marginTop: 4,
                    background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8,
                    padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--text2)',
                }}>
                    No results for &ldquo;{query}&rdquo;
                </div>
            )}
        </div>
    );
}
