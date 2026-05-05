import React, { useEffect, useState } from 'react';
import { PeerComparisonItem } from '@/types';
import { formatCurrency, formatLargeNumber } from '@/lib/utils/format';

interface StockComparisonProps {
    currentSymbol: string;
    currentSector?: string;
}

export const StockComparison: React.FC<StockComparisonProps> = ({ currentSymbol }) => {
    const [peers, setPeers] = useState<PeerComparisonItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        if (!shouldLoad) {
            return;
        }

        let cancelled = false;

        const fetchPeers = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/peers?symbol=${encodeURIComponent(currentSymbol)}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch peers');
                }

                if (!cancelled) {
                    setPeers(data.peers || []);
                }
            } catch (fetchError) {
                if (!cancelled) {
                    setPeers([]);
                    setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch peers');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void fetchPeers();

        return () => {
            cancelled = true;
        };
    }, [currentSymbol, shouldLoad]);

    return (
        <>
            <div className="mb-10 flex items-center justify-between gap-4">
                <h3 className="text-3xl font-bold text-white">Peer Comparison</h3>
                {!shouldLoad ? (
                    <button onClick={() => setShouldLoad(true)} className="btn btn-secondary">
                        Load Peers
                    </button>
                ) : null}
            </div>
            {!shouldLoad ? (
                <div className="py-8 text-sm text-gray-400">
                    Peer comparison is available on demand to reduce Yahoo Finance throttling.
                </div>
            ) : null}
            {shouldLoad && isLoading ? (
                <div className="py-8 text-center text-gray-400">Loading peers...</div>
            ) : shouldLoad && error ? (
                <div className="py-8 text-center text-sm text-gray-400">{error}</div>
            ) : shouldLoad && peers.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No comparable symbols available for {currentSymbol}</div>
            ) : shouldLoad ? (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-gray-800 text-sm text-gray-400">
                                <th className="py-4 font-semibold">Name</th>
                                <th className="py-4 text-right font-semibold">Price</th>
                                <th className="py-4 text-right font-semibold">Change</th>
                                <th className="py-4 text-right font-semibold">P/E</th>
                                <th className="py-4 text-right font-semibold">Mkt Cap</th>
                            </tr>
                        </thead>
                        <tbody>
                            {peers.map((peer) => {
                                const symbolPrefix = peer.currency === 'INR' ? '₹' : '$';

                                return (
                                    <tr key={peer.symbol} className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30">
                                        <td className="py-5">
                                            <div className="text-lg font-semibold text-white">{peer.name}</div>
                                            <div className="text-sm text-gray-500">{peer.symbol}</div>
                                        </td>
                                        <td className="py-5 text-right font-mono text-lg text-white">
                                            {formatCurrency(peer.price, symbolPrefix)}
                                        </td>
                                        <td className={`py-5 text-right font-mono text-lg ${peer.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {peer.change > 0 ? '+' : ''}
                                            {peer.change.toFixed(2)} ({peer.changePercent.toFixed(2)}%)
                                        </td>
                                        <td className="py-5 text-right font-mono text-lg text-gray-300">
                                            {peer.peRatio !== null ? peer.peRatio.toFixed(2) : 'N/A'}
                                        </td>
                                        <td className="py-5 text-right text-base text-gray-300">
                                            {peer.marketCap !== null ? formatLargeNumber(peer.marketCap, symbolPrefix) : 'N/A'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </>
    );
};
