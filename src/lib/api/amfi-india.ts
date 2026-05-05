// AMFI India - Official Mutual Fund NAV Data (100% Free)
import { MutualFund } from '@/types';

const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';

export interface AMFIFundData {
    schemeCode: string;
    schemeName: string;
    nav: number;
    date: string;
    category: string;
    fundHouse: string;
}

/**
 * Parse AMFI NAV text file
 * Format: Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
 */
function parseAMFIData(text: string): AMFIFundData[] {
    const lines = text.split('\n');
    const funds: AMFIFundData[] = [];
    let currentFundHouse = '';
    let currentCategory = '';

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Fund house line (no semicolons)
        if (!trimmed.includes(';') && trimmed.length > 0) {
            currentFundHouse = trimmed;
            continue;
        }

        // Category line (starts with scheme type)
        if (trimmed.includes('Scheme') && !trimmed.includes('Scheme Code')) {
            currentCategory = trimmed.split('(')[0].trim();
            continue;
        }

        // Data line
        const parts = trimmed.split(';');
        if (parts.length >= 5) {
            const schemeCode = parts[0].trim();
            const schemeName = parts[3].trim();
            const navStr = parts[4].trim();
            const dateStr = parts[parts.length - 1].trim();

            // Skip header rows or invalid data
            if (schemeCode === 'Scheme Code' || navStr === 'N.A.' || !navStr) continue;

            const nav = parseFloat(navStr);

            if (!isNaN(nav) && nav > 0) {
                funds.push({
                    schemeCode,
                    schemeName,
                    nav,
                    date: dateStr,
                    category: currentCategory || 'Other',
                    fundHouse: currentFundHouse
                });
            }
        }
    }

    return funds;
}

/**
 * Fetch all mutual funds data from AMFI
 */
export async function fetchAMFIData(): Promise<AMFIFundData[]> {
    try {
        const response = await fetch(AMFI_NAV_URL);
        const text = await response.text();
        return parseAMFIData(text);
    } catch (error) {
        console.error('AMFI fetch error:', error);
        return [];
    }
}

/**
 * Search mutual funds
 */
export async function searchMutualFunds(query: string, limit: number = 20): Promise<MutualFund[]> {
    try {
        const allFunds = await fetchAMFIData();
        const lowerQuery = query.toLowerCase();

        const filtered = allFunds
            .filter(fund =>
                fund.schemeName.toLowerCase().includes(lowerQuery) ||
                fund.fundHouse.toLowerCase().includes(lowerQuery) ||
                fund.schemeCode.includes(query)
            )
            .slice(0, limit);

        return filtered.map(fund => ({
            symbol: fund.schemeCode,
            name: fund.schemeName,
            nav: fund.nav,
            category: fund.category,
            aum: 0, // AMFI doesn't provide AUM in NAV file
            expense_ratio: 0 // AMFI doesn't provide expense ratio in NAV file
        }));
    } catch (error) {
        console.error('Mutual fund search error:', error);
        return [];
    }
}

/**
 * Get mutual fund by scheme code
 */
export async function getMutualFundByCode(schemeCode: string): Promise<MutualFund | null> {
    try {
        const allFunds = await fetchAMFIData();
        const fund = allFunds.find(f => f.schemeCode === schemeCode);

        if (!fund) return null;

        return {
            symbol: fund.schemeCode,
            name: fund.schemeName,
            nav: fund.nav,
            category: fund.category,
            aum: 0,
            expense_ratio: 0
        };
    } catch (error) {
        console.error('Mutual fund fetch error:', error);
        return null;
    }
}

/**
 * Get mutual funds by category
 */
export async function getMutualFundsByCategory(category: string, limit: number = 20): Promise<MutualFund[]> {
    try {
        const allFunds = await fetchAMFIData();

        const filtered = allFunds
            .filter(fund => fund.category.toLowerCase().includes(category.toLowerCase()))
            .slice(0, limit);

        return filtered.map(fund => ({
            symbol: fund.schemeCode,
            name: fund.schemeName,
            nav: fund.nav,
            category: fund.category,
            aum: 0,
            expense_ratio: 0
        }));
    } catch (error) {
        console.error('Category fetch error:', error);
        return [];
    }
}

/**
 * Get top performing funds by NAV change (requires historical tracking)
 * This is a placeholder - you'd need to implement historical NAV tracking
 */
export async function getTopPerformingFunds(limit: number = 10): Promise<MutualFund[]> {
    try {
        const allFunds = await fetchAMFIData();

        // For now, return top funds by NAV value (not ideal, but functional)
        const sorted = allFunds
            .sort((a, b) => b.nav - a.nav)
            .slice(0, limit);

        return sorted.map(fund => ({
            symbol: fund.schemeCode,
            name: fund.schemeName,
            nav: fund.nav,
            category: fund.category,
            aum: 0,
            expense_ratio: 0
        }));
    } catch (error) {
        console.error('Top funds error:', error);
        return [];
    }
}
