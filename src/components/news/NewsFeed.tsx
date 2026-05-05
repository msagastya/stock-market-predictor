'use client';

import { useEffect, useState } from 'react';
import { NewsHeadline } from '@/types';

export default function NewsFeed({ symbol }: { symbol: string }) {
    const [news, setNews] = useState<NewsHeadline[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        if (!shouldLoad) {
            return;
        }

        let cancelled = false;

        const fetchNews = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch news');
                }

                if (!cancelled) {
                    setNews(data.news || []);
                }
            } catch (fetchError) {
                if (!cancelled) {
                    setNews([]);
                    setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch news');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchNews();

        return () => {
            cancelled = true;
        };
    }, [symbol, shouldLoad]);

    const getTimeAgo = (dateString: string) => {
        const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <div className="glass card">
            <div className="card-header">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="card-title">📰 Latest News</h3>
                        <p className="card-description">Market updates for {symbol}</p>
                    </div>
                    {!shouldLoad ? (
                        <button onClick={() => setShouldLoad(true)} className="btn btn-secondary">
                            Load News
                        </button>
                    ) : null}
                </div>
            </div>
            <div className="card-content">
                {!shouldLoad ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        News is loaded on demand to keep the live data requests under control.
                    </div>
                ) : isLoading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                    </div>
                ) : error ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">{error}</div>
                ) : news.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No recent headlines found for {symbol}</div>
                ) : (
                    <div className="space-y-3">
                        {news.map((item, idx) => (
                            <a
                                key={item.uuid || idx}
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg border-l-4 border-blue-500 bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/40"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">📰</span>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{item.publisher}</span>
                                            <span>{getTimeAgo(item.publishedAt)}</span>
                                        </div>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
