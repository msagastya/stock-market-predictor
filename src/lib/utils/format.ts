// Utility functions
export function formatCurrency(value: number, currency: string = '₹'): string {
    if (!Number.isFinite(value)) {
        return `${currency}0.00`;
    }

    if (value >= 10000000) {
        return `${currency}${(value / 10000000).toFixed(2)}Cr`;
    } else if (value >= 100000) {
        return `${currency}${(value / 100000).toFixed(2)}L`;
    } else if (value >= 1000) {
        return `${currency}${(value / 1000).toFixed(2)}K`;
    }
    return `${currency}${value.toFixed(2)}`;
}

export function formatLargeNumber(value: number, currencySymbol: string = ''): string {
    if (!Number.isFinite(value)) {
        return `${currencySymbol}0`;
    }

    const absoluteValue = Math.abs(value);

    if (absoluteValue >= 1_000_000_000_000) {
        return `${currencySymbol}${(value / 1_000_000_000_000).toFixed(2)}T`;
    }
    if (absoluteValue >= 1_000_000_000) {
        return `${currencySymbol}${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (absoluteValue >= 1_000_000) {
        return `${currencySymbol}${(value / 1_000_000).toFixed(2)}M`;
    }
    if (absoluteValue >= 1_000) {
        return `${currencySymbol}${(value / 1_000).toFixed(2)}K`;
    }

    return `${currencySymbol}${value.toFixed(0)}`;
}

export function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-IN').format(value);
}

export function formatPercent(value: number, decimals: number = 2): string {
    if (!Number.isFinite(value)) return '0.00%';
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export function getColorForChange(value: number): string {
    if (value > 0) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
}

export function getBgColorForChange(value: number): string {
    if (value > 0) return 'bg-green-100 dark:bg-green-900/20';
    if (value < 0) return 'bg-red-100 dark:bg-red-900/20';
    return 'bg-gray-100 dark:bg-gray-900/20';
}

export function getRecommendationColor(rating: string): string {
    switch (rating) {
        case 'Strong Buy':
            return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
        case 'Buy':
            return 'text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/20';
        case 'Neutral':
            return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
        case 'Sell':
            return 'text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20';
        case 'Strong Sell':
            return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
        default:
            return 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
}

export function getConfidenceColor(confidence: string): string {
    switch (confidence) {
        case 'high':
            return 'text-blue-700 dark:text-blue-400';
        case 'medium':
            return 'text-yellow-700 dark:text-yellow-400';
        case 'low':
            return 'text-gray-700 dark:text-gray-400';
        default:
            return 'text-gray-700 dark:text-gray-400';
    }
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function classNames(...classes: (string | boolean | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
}
