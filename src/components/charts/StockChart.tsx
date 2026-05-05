'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, HistogramSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import { OHLCV, TechnicalIndicators } from '@/types';
import { SupportResistanceLevel } from '@/lib/analysis/support-resistance';

export type ChartType = 'candlestick' | 'line' | 'area';

export interface ChartOverlays {
    sma20: boolean;
    sma50: boolean;
    sma200: boolean;
    ema20: boolean;
    bollingerBands: boolean;
}

interface StockChartProps {
    data: OHLCV[];
    indicators?: TechnicalIndicators | null;
    supportResistance?: SupportResistanceLevel[];
    isDarkMode?: boolean;
    chartType?: ChartType;
    overlays?: ChartOverlays;
    showFibonacci?: boolean;
}

export default function StockChart({
    data,
    indicators,
    supportResistance,
    isDarkMode = true,
    chartType = 'candlestick',
    overlays = { sma20: false, sma50: false, sma200: false, ema20: false, bollingerBands: false },
    showFibonacci = false
}: StockChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Sort data
        const sortedData = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        // Map data
        const chartData = sortedData.map(item => ({
            time: item.time as Time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            value: item.close // For line/area charts
        }));

        const volumeData = sortedData.map(item => ({
            time: item.time as Time,
            value: item.volume,
            color: item.close >= item.open ? '#26a69a' : '#ef5350',
        }));

        // Create Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: isDarkMode ? '#030712' : '#ffffff' },
                textColor: isDarkMode ? '#d1d5db' : '#374151',
            },
            grid: {
                vertLines: { color: isDarkMode ? '#1f2937' : '#e5e7eb' },
                horzLines: { color: isDarkMode ? '#1f2937' : '#e5e7eb' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        chartRef.current = chart;

        // Main Series
        let mainSeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area">;

        if (chartType === 'line') {
            mainSeries = chart.addSeries(LineSeries, { color: '#2962FF' });
            mainSeries.setData(chartData);
        } else if (chartType === 'area') {
            mainSeries = chart.addSeries(AreaSeries, {
                lineColor: '#2962FF',
                topColor: '#2962FF',
                bottomColor: 'rgba(41, 98, 255, 0.28)'
            });
            mainSeries.setData(chartData);
        } else {
            mainSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
            });
            mainSeries.setData(chartData);
        }

        // Volume Series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: '', // Overlay
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeries.setData(volumeData);

        // Overlays
        if (overlays.sma20) addLineSeries(chart, calculateSMA(sortedData, 20), '#2196F3', 1);
        if (overlays.sma50) addLineSeries(chart, calculateSMA(sortedData, 50), '#FF9800', 1);
        if (overlays.sma200) addLineSeries(chart, calculateSMA(sortedData, 200), '#F44336', 2);
        if (overlays.ema20) addLineSeries(chart, calculateEMA(sortedData, 20), '#9C27B0', 1);

        if (overlays.bollingerBands) {
            const bands = calculateBollingerBands(sortedData, 20, 2);
            addLineSeries(chart, bands.upper, 'rgba(76, 175, 80, 0.5)', 1);
            addLineSeries(chart, bands.lower, 'rgba(76, 175, 80, 0.5)', 1);
            // Note: Lightweight charts doesn't support filled areas between lines natively easily without plugins, 
            // so we just draw the lines for now.
        }

        // Fibonacci Retracements
        if (showFibonacci && sortedData.length > 0) {
            const high = Math.max(...sortedData.map(d => d.high));
            const low = Math.min(...sortedData.map(d => d.low));
            const diff = high - low;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

            levels.forEach(level => {
                const price = high - (diff * level);
                mainSeries.createPriceLine({
                    price: price,
                    color: 'rgba(33, 150, 243, 0.5)',
                    lineWidth: 1,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: `Fib ${(level * 100).toFixed(1)}%`,
                });
            });
        }

        // Support & Resistance
        if (supportResistance) {
            supportResistance.forEach(level => {
                mainSeries.createPriceLine({
                    price: level.price,
                    color: level.type === 'support' ? '#22c55e' : '#ef4444',
                    lineWidth: 2,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: `${level.type === 'support' ? 'Sup' : 'Res'}`,
                });
            });
        }

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, isDarkMode, supportResistance, chartType, overlays, showFibonacci]);

    return (
        <div className="w-full relative">
            <div ref={chartContainerRef} className="w-full rounded-lg overflow-hidden" />
        </div>
    );
}

// Helpers
import { LineWidth } from 'lightweight-charts';

// ...

function addLineSeries(chart: IChartApi, data: any[], color: string, lineWidth: number = 1) {
    const lineSeries = chart.addSeries(LineSeries, { color, lineWidth: lineWidth as LineWidth });
    lineSeries.setData(data);
}

function calculateSMA(data: OHLCV[], period: number) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((acc, val) => acc + val.close, 0);
        result.push({ time: data[i].time as Time, value: sum / period });
    }
    return result;
}

function calculateEMA(data: OHLCV[], period: number) {
    const result = [];
    const k = 2 / (period + 1);
    let ema = data[0].close;

    for (let i = 0; i < data.length; i++) {
        ema = (data[i].close * k) + (ema * (1 - k));
        if (i >= period - 1) {
            result.push({ time: data[i].time as Time, value: ema });
        }
    }
    return result;
}

function calculateBollingerBands(data: OHLCV[], period: number, multiplier: number) {
    const upper = [];
    const lower = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((acc, val) => acc + val.close, 0);
        const sma = sum / period;
        const squaredDiffs = slice.map(val => Math.pow(val.close - sma, 2));
        const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
        const stdDev = Math.sqrt(variance);

        upper.push({ time: data[i].time as Time, value: sma + (stdDev * multiplier) });
        lower.push({ time: data[i].time as Time, value: sma - (stdDev * multiplier) });
    }
    return { upper, lower };
}
