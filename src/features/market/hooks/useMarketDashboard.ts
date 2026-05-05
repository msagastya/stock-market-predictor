'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AutomatedAnalysis, CompanyCalendar, CompanyProfile, Recommendation, StockFundamentals, TechnicalIndicators, OHLCV } from '@/types';
import { calculateAllIndicators } from '@/lib/analysis/technical-indicators';
import { detectCandlestickPatterns } from '@/lib/analysis/candlestick-detector';
import { analyzeVolume, getVolumeInsights } from '@/lib/analysis/volume-analyzer';
import { generateRecommendation } from '@/lib/analysis/signal-scorer';
import { getRelevantTips } from '@/lib/analysis/tips-database';
import { calculateSupportResistance, SupportResistanceLevel } from '@/lib/analysis/support-resistance';
import { generateAutomatedAnalysis } from '@/lib/analysis/automated-analysis';
import { ChartOverlays, ChartType } from '@/components/charts/StockChart';
import { SelectedStock } from '@/features/market/types';

const DEFAULT_STOCK: SelectedStock = { symbol: '^NSEI', name: 'Nifty 50' };

const DEFAULT_OVERLAYS: ChartOverlays = {
  sma20: false,
  sma50: false,
  sma200: false,
  ema20: false,
  bollingerBands: false,
};

export function useMarketDashboard(options?: {
  initialStock?: SelectedStock;
  autoLoad?: boolean;
}) {
  const initialStock = useMemo(
    () => options?.initialStock || DEFAULT_STOCK,
    [options?.initialStock]
  );
  const autoLoad = options?.autoLoad ?? false;

  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [automatedAnalysis, setAutomatedAnalysis] = useState<AutomatedAnalysis | null>(null);
  const [supportResistance, setSupportResistance] = useState<SupportResistanceLevel[]>([]);
  const [volumeInsights, setVolumeInsights] = useState<string[]>([]);
  const [selectedStock, setSelectedStock] = useState<SelectedStock>(initialStock);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [fundamentals, setFundamentals] = useState<StockFundamentals | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [calendar, setCalendar] = useState<CompanyCalendar | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [overlays, setOverlays] = useState<ChartOverlays>(DEFAULT_OVERLAYS);
  const [showFibonacci, setShowFibonacci] = useState(false);
  const [timeframe, setTimeframe] = useState('1y');
  const [activeTab, setActiveTab] = useState<'analysis' | 'fundamentals' | 'news'>('analysis');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dataWarning, setDataWarning] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchStockData = useCallback(async (symbol: string, period: string = '1y') => {
    setIsLoading(true);
    setErrorMessage(null);
    setDataWarning(null);

    try {
      const response = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}`);
      const data = await response.json();

      if (!response.ok || data.error || !data.historical || data.historical.length === 0) {
        setOhlcvData([]);
        setFundamentals(null);
        setProfile(null);
        setCalendar(null);
        setIndicators(null);
        setRecommendation(null);
        setAutomatedAnalysis(null);
        setSupportResistance([]);
        setVolumeInsights([]);
        setCurrentPrice(0);
        setPriceChange(0);
        setPriceChangePercent(0);
        setErrorMessage(data.error || 'No market data was returned for this symbol.');
        setDataWarning(null);
        setHasLoadedOnce(true);
        return;
      }

      setOhlcvData(data.historical);
      setCurrentPrice(data.quote.regularMarketPrice);
      setPriceChange(data.quote.regularMarketChange);
      setPriceChangePercent(data.quote.regularMarketChangePercent);
      setFundamentals(data.fundamentals);
      setProfile(data.profile || null);
      setCalendar(data.calendar || null);
      setCurrency(data.currency === 'USD' ? 'USD' : 'INR');
      setLastUpdated(new Date());
      setDataWarning(data.warning || null);
      setHasLoadedOnce(true);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      setOhlcvData([]);
      setFundamentals(null);
      setProfile(null);
      setCalendar(null);
      setIndicators(null);
      setRecommendation(null);
      setAutomatedAnalysis(null);
      setSupportResistance([]);
      setVolumeInsights([]);
      setCurrentPrice(0);
      setPriceChange(0);
      setPriceChangePercent(0);
      setErrorMessage('Failed to fetch stock data.');
      setDataWarning(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedStock(initialStock);
    setOhlcvData([]);
    setIndicators(null);
    setRecommendation(null);
    setAutomatedAnalysis(null);
    setSupportResistance([]);
    setVolumeInsights([]);
    setFundamentals(null);
    setProfile(null);
    setCalendar(null);
    setCurrentPrice(0);
    setPriceChange(0);
    setPriceChangePercent(0);
    setLastUpdated(null);
    setErrorMessage(null);
    setDataWarning(null);
    setHasLoadedOnce(false);
    setTimeframe('1y');
    setActiveTab('analysis');
  }, [initialStock]);

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    fetchStockData(initialStock.symbol);
  }, [autoLoad, fetchStockData, initialStock.symbol]);

  useEffect(() => {
    if (ohlcvData.length === 0) {
      return;
    }

    const calculatedIndicators = calculateAllIndicators(ohlcvData);
    const patterns = detectCandlestickPatterns(ohlcvData);
    const volumeAnalysis = analyzeVolume(ohlcvData);
    const recommendationResult = generateRecommendation(ohlcvData, calculatedIndicators, patterns, volumeAnalysis);
    const supportResistanceLevels = calculateSupportResistance(ohlcvData);

    setIndicators(calculatedIndicators);
    setRecommendation(recommendationResult);
    setVolumeInsights(getVolumeInsights(ohlcvData));
    setSupportResistance(supportResistanceLevels);
    setAutomatedAnalysis(generateAutomatedAnalysis(ohlcvData, calculatedIndicators, recommendationResult, supportResistanceLevels, currency));
  }, [currency, ohlcvData]);

  const relevantTips = useMemo(() => {
    if (!recommendation) {
      return [];
    }

    return getRelevantTips({
      rsi: indicators?.rsi,
      macdSignal: (indicators?.macd?.histogram ?? 0) > 0 ? 'bullish' : 'bearish',
      volumeSpike: (indicators?.volume?.ratio ?? 0) > 2,
      patterns: recommendation.patterns.map((pattern) => pattern.name),
      trendStrength: Math.abs(recommendation.score) >= 2 ? 'strong' : 'weak',
      signalClarity: recommendation.confidence === 'high' ? 'clear' : 'mixed',
    });
  }, [indicators, recommendation]);

  const handleSelectStock = (symbol: string, name: string) => {
    setSelectedStock({ symbol, name });
    setTimeframe('1y');
    fetchStockData(symbol, '1y');
  };

  // Auto-refresh price every 30s (quote only, not full chart reload)
  useEffect(() => {
    if (!hasLoadedOnce) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(selectedStock.symbol)}`);
        if (!res.ok) return;
        const data = await res.json();
        const q = (data.quotes || [])[0];
        if (!q) return;
        setCurrentPrice(q.regularMarketPrice);
        setPriceChange(q.regularMarketChange);
        setPriceChangePercent(q.regularMarketChangePercent);
        setLastUpdated(new Date());
      } catch {
        // silent — stale price is acceptable
      }
    }, 30_000);

    return () => clearInterval(id);
  }, [hasLoadedOnce, selectedStock.symbol]);

  const handleTimeframeChange = (nextTimeframe: string) => {
    setTimeframe(nextTimeframe);
    fetchStockData(selectedStock.symbol, nextTimeframe);
  };

  const toggleTheme = () => {
    setIsDarkMode((previousValue) => {
      const nextValue = !previousValue;
      document.documentElement.classList.toggle('dark', nextValue);
      return nextValue;
    });
  };

  return {
    state: {
      ohlcvData,
      indicators,
      recommendation,
      automatedAnalysis,
      supportResistance,
      volumeInsights,
      selectedStock,
      isLoading,
      currentPrice,
      priceChange,
      priceChangePercent,
      fundamentals,
      profile,
      calendar,
      currency,
      lastUpdated,
      chartType,
      overlays,
      showFibonacci,
      timeframe,
      activeTab,
      isDarkMode,
      relevantTips,
      errorMessage,
      dataWarning,
      hasLoadedOnce,
    },
    actions: {
      handleSelectStock,
      handleTimeframeChange,
      toggleTheme,
      setChartType,
      setOverlays,
      setShowFibonacci,
      setActiveTab,
    },
  };
}
