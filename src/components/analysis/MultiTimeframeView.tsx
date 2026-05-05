'use client';

import { useState, useEffect } from 'react';
import { Timeframe, MultiTimeframeAnalysis } from '@/lib/analysis/multi-timeframe';

interface TimeframeSelectorProps {
    symbol: string;
    onTimeframeChange: (timeframe: Timeframe) => void;
}

export default function MultiTimeframeView({ symbol }: { symbol: string }) {
    const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1D');
    const [analysis, setAnalysis] = useState<MultiTimeframeAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const timeframes: Timeframe[] = ['1D', '1W', '2W', '1M', '2M', '3M', '6M', '1Y', '2Y', '5Y'];

    const loadAnalysis = async () => {
        setIsLoading(true);
        // In production, fetch real data for all timeframes
        // For now, using placeholder
        setTimeout(() => {
            setIsLoading(false);
        }, 1000);
    };

    useEffect(() => {
        loadAnalysis();
    }, [symbol]);

    const getTrendColor = (trend: string) => {
        if (trend === 'bullish') return 'text-green-600 dark:text-green-400';
        if (trend === 'bearish') return 'text-red-600 dark:text-red-400';
        return 'text-yellow-600 dark:text-yellow-400';
    };

    const getTrendIcon = (trend: string) => {
        if (trend === 'bullish') return '📈';
        if (trend === 'bearish') return '📉';
        return '➡️';
    };

    return (
        <div className="glass card">
            <div className="card-header">
                <h3 className="card-title">📊 Multi-Timeframe Analysis</h3>
                <p className="card-description">Analyze trends across all timeframes</p>
            </div>
            <div className="card-content">
                {/* Timeframe Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {timeframes.map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setSelectedTimeframe(tf)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedTimeframe === tf
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Overall Consensus (Sample) */}
                <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20">
                    <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Overall Trend</div>
                        <div className="text-3xl font-bold mb-2">
                            <span className="text-green-600">📈 BULLISH</span>
                        </div>
                        <div className="text-sm">
                            Strength: <span className="font-bold">8/10</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Strong bullish consensus across 7 out of 10 timeframes
                        </p>
                    </div>
                </div>

                {/* Timeframe Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {timeframes.map((tf) => (
                        <div
                            key={tf}
                            className="p-4 rounded-lg border border-border hover:border-primary transition-all cursor-pointer"
                        >
                            <div className="text-center">
                                <div className="text-xs text-muted-foreground mb-1">{tf}</div>
                                <div className="text-2xl mb-1">
                                    {getTrendIcon(Math.random() > 0.5 ? 'bullish' : 'bearish')}
                                </div>
                                <div className={`text-sm font-semibold ${getTrendColor(Math.random() > 0.5 ? 'bullish' : 'bearish')}`}>
                                    {Math.random() > 0.5 ? 'Bull' : 'Bear'}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {(Math.random() * 10).toFixed(0)}/10
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Selected Timeframe Detail */}
                <div className="mt-6 p-4 rounded-lg bg-accent">
                    <h4 className="font-semibold mb-3">{selectedTimeframe} Analysis</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Trend:</span>
                            <span className="ml-2 font-semibold">Bullish</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Strength:</span>
                            <span className="ml-2 font-semibold">8/10</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Price Change:</span>
                            <span className="ml-2 font-semibold text-green-600">+12.5%</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Recommendation:</span>
                            <span className="ml-2 font-semibold">Buy</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
