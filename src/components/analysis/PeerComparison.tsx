'use client';

import { useEffect, useMemo, useState } from 'react';

interface PeerComparisonProps {
    symbol: string;
    currentPE: number;
    currentMarketCap: number;
    sector?: string;
}

interface PeerData {
    symbol: string;
    name: string;
    price: number;
    peRatio: number;
    marketCap: number;
    change: number;
}

export default function PeerComparison({ symbol, currentPE, currentMarketCap, sector }: PeerComparisonProps) {
    const [peers, setPeers] = useState<PeerData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const peerMap = useMemo<{ [key: string]: string[] }>(() => ({
        'AAPL': ['MSFT', 'GOOGL', 'META', 'AMZN'],
        'TSLA': ['GM', 'F', 'RIVN', 'LCID'],
        'MSFT': ['AAPL', 'GOOGL', 'AMZN', 'META'],
        'RELIANCE.NS': ['TCS.NS', 'INFY.NS', 'HINDUNILVR.NS', 'HDFCBANK.NS'],
        'TCS.NS': ['INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS'],
        'HDFCBANK.NS': ['ICICIBANK.NS', 'AXISBANK.NS', 'KOTAKBANK.NS', 'SBIN.NS']
    }), []);

    useEffect(() => {
        const fetchPeers = async () => {
            const baseSPymbol = symbol.replace('.NS', '').replace('.BO', '');
            const peerSymbols = peerMap[symbol] || peerMap[baseSPymbol] || [];

            if (peerSymbols.length === 0) return;

            setIsLoading(true);
            try {
                // Fetch peer data (simplified - in production you'd call real API)
                const peerData: PeerData[] = peerSymbols.map((sym, idx) => ({
                    symbol: sym,
                    name: sym.replace('.NS', '').replace('.BO', ''),
                    price: 100 + Math.random() * 500,
                    peRatio: 15 + Math.random() * 20,
                    marketCap: currentMarketCap * (0.5 + Math.random()),
                    change: (Math.random() - 0.5) * 10
                }));

                setPeers(peerData);
            } catch (error) {
                console.error('Error fetching peers:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPeers();
    }, [symbol, currentMarketCap, peerMap]);

    if (peers.length === 0 && !isLoading) {
        return (
            <div className="glass card">
                <div className="card-header">
                    <h3 className="card-title">🔄 Peer Comparison</h3>
                </div>
                <div className="card-content">
                    <p className="text-center text-muted-foreground py-8">
                        No peer data available for {symbol}
                    </p>
                </div>
            </div>
        );
    }

    const avgPE = peers.reduce((sum, p) => sum + p.peRatio, 0) / peers.length;
    const peComparison = currentPE < avgPE ? '🟢 Below Average' : currentPE > avgPE * 1.2 ? '🔴 Above Average' : '🟡 Near Average';

    return (
        <div className="glass card">
            <div className="card-header">
                <h3 className="card-title">🔄 Peer Comparison</h3>
                <p className="card-description">Compare with similar companies</p>
            </div>
            <div className="card-content">
                {isLoading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                    </div>
                ) : (
                    <>
                        <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-muted-foreground">Your P/E</div>
                                    <div className="font-bold">{currentPE.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Peer Avg P/E</div>
                                    <div className="font-bold">{avgPE.toFixed(2)}</div>
                                </div>
                            </div>
                            <div className="mt-2 text-center text-sm font-medium">
                                {peComparison}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {peers.map((peer) => (
                                <div
                                    key={peer.symbol}
                                    className="flex justify-between items-center p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="font-semibold">{peer.symbol}</div>
                                        <div className="text-xs text-muted-foreground">P/E: {peer.peRatio.toFixed(2)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium">${peer.price.toFixed(2)}</div>
                                        <div className={`text-xs ${peer.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {peer.change >= 0 ? '+' : ''}{peer.change.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
