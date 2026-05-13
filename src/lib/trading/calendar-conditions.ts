/**
 * Calendar Conditions
 *
 * Tags any trading date with every relevant condition that could affect market behaviour.
 * Used by the backtest engine to learn WHAT CONDITIONS produce wins, not which stocks.
 *
 * Conditions tracked:
 * - NSE expiry (weekly Thursday, monthly last-Thursday, day before/after)
 * - Indian market holidays and adjacency
 * - Festival calendar (Diwali, Holi, Ganesh, etc.)
 * - Budget & RBI policy dates
 * - Earnings season months
 * - Seasonal sectors
 * - Market structure (start/end of month, quarter)
 */

export interface DayConditions {
    date:             string;       // YYYY-MM-DD
    dow:              string;       // Mon..Fri
    dowNum:           number;       // 1=Mon..5=Fri
    // Expiry
    isWeeklyExpiry:   boolean;      // every Thursday
    isMonthlyExpiry:  boolean;      // last Thursday of month
    isPreExpiry:      boolean;      // Wednesday before expiry
    isPostExpiry:     boolean;      // Friday after expiry
    // Month structure
    isMonthStart:     boolean;      // first 3 trading days of month
    isMonthEnd:       boolean;      // last 3 trading days of month
    isQuarterStart:   boolean;      // first month of quarter (Jan,Apr,Jul,Oct)
    isQuarterEnd:     boolean;      // last month of quarter (Mar,Jun,Sep,Dec)
    // Festival adjacency
    isFestivalWeek:   boolean;
    festivalName:     string;
    isPreFestival:    boolean;      // 1-2 days before festival
    isPostFestival:   boolean;      // 1-2 days after festival
    // Special events
    isBudgetDay:      boolean;
    isRBIDay:         boolean;
    isResultsSeason:  boolean;      // Apr-May, Jul-Aug, Oct-Nov, Jan-Feb (quarterly results)
    // Seasonal sector context
    seasonalSectors:  string[];     // which sectors typically active this month
    // Summary tags (used as condition keys in backtest)
    tags:             string[];
}

// ── Indian festival / holiday calendar (2023–2026) ───────────────────────────
// Format: YYYY-MM-DD

const FESTIVALS: Record<string, string> = {
    // Diwali (Laxmi Puja) — market usually rallies 1 week before
    '2023-11-12': 'Diwali',
    '2024-11-01': 'Diwali',
    '2025-10-20': 'Diwali',
    '2026-11-08': 'Diwali',
    // Holi — often volatile, low liquidity week before
    '2023-03-08': 'Holi',
    '2024-03-25': 'Holi',
    '2025-03-14': 'Holi',
    '2026-03-04': 'Holi',
    // Ganesh Chaturthi
    '2023-09-19': 'Ganesh_Chaturthi',
    '2024-09-07': 'Ganesh_Chaturthi',
    '2025-08-27': 'Ganesh_Chaturthi',
    '2026-09-15': 'Ganesh_Chaturthi',
    // Dussehra
    '2023-10-24': 'Dussehra',
    '2024-10-12': 'Dussehra',
    '2025-10-02': 'Dussehra',
    '2026-10-20': 'Dussehra',
    // Ram Navami
    '2024-04-17': 'Ram_Navami',
    '2025-04-06': 'Ram_Navami',
    '2026-03-26': 'Ram_Navami',
    // Id-ul-Fitr (Eid)
    '2023-04-22': 'Eid',
    '2024-04-11': 'Eid',
    '2025-03-31': 'Eid',
    '2026-03-20': 'Eid',
    // Christmas/year end
    '2023-12-25': 'Christmas',
    '2024-12-25': 'Christmas',
    '2025-12-25': 'Christmas',
    '2026-12-25': 'Christmas',
    // Republic Day (market closed)
    '2024-01-26': 'Republic_Day',
    '2025-01-26': 'Republic_Day',
    '2026-01-26': 'Republic_Day',
    // Independence Day
    '2024-08-15': 'Independence_Day',
    '2025-08-15': 'Independence_Day',
    '2026-08-15': 'Independence_Day',
};

// NSE market holidays (exchange closed) 2024–2026
const MARKET_HOLIDAYS = new Set([
    '2024-01-22','2024-01-26','2024-03-25','2024-03-29','2024-04-11',
    '2024-04-14','2024-04-17','2024-04-21','2024-05-23','2024-06-17',
    '2024-07-17','2024-08-15','2024-10-02','2024-10-12','2024-11-01',
    '2024-11-15','2024-11-20','2024-12-25',
    '2025-01-26','2025-02-26','2025-03-14','2025-03-31','2025-04-06',
    '2025-04-10','2025-04-14','2025-04-18','2025-05-01','2025-08-15',
    '2025-08-27','2025-10-02','2025-10-02','2025-10-20','2025-10-21',
    '2025-11-05','2025-12-25',
    '2026-01-26','2026-03-04','2026-03-20','2026-03-26','2026-04-02',
    '2026-04-03','2026-04-14','2026-05-01','2026-08-15','2026-11-08',
    '2026-12-25',
]);

// Budget dates (usually Feb 1, or if holiday then Feb 2)
const BUDGET_DATES = new Set(['2024-02-01','2025-02-01','2026-02-01']);

// RBI MPC meeting dates (approximate — 6 per year, every ~2 months)
const RBI_DATES = new Set([
    '2024-02-08','2024-04-05','2024-06-07','2024-08-08','2024-10-09','2024-12-06',
    '2025-02-07','2025-04-09','2025-06-06','2025-08-06','2025-10-08','2025-12-05',
    '2026-02-06','2026-04-07','2026-06-05','2026-08-07','2026-10-07','2026-12-04',
]);

// Seasonal sector map: month → sectors that outperform
const SEASONAL_SECTORS: Record<number, string[]> = {
    1:  ['IT', 'Banking'],           // Budget prep, Q3 results
    2:  ['FMCG', 'Auto'],            // Budget month
    3:  ['Pharma', 'IT'],            // Year-end, tax planning
    4:  ['Banking', 'Auto'],         // New fiscal year, Q4 results
    5:  ['IT', 'Pharma'],            // Q4 results season
    6:  ['FMCG', 'Pharma'],          // Pre-monsoon
    7:  ['Auto', 'Cement'],          // Q1 results, monsoon infra
    8:  ['FMCG', 'Auto'],            // Monsoon boost
    9:  ['Realty', 'Banking'],       // Festive season starts
    10: ['Auto', 'FMCG', 'Realty'], // Navratri, Dhanteras buying
    11: ['Jewellery', 'FMCG'],      // Diwali, wedding season
    12: ['IT', 'Banking'],           // Year-end positioning
};

// ── Core function ─────────────────────────────────────────────────────────────

export function getDayConditions(dateStr: string): DayConditions {
    const d    = new Date(dateStr + 'T00:00:00+05:30');
    const dow  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    const dowN = d.getDay(); // 0=Sun..6=Sat, 4=Thu

    const day   = d.getDate();
    const month = d.getMonth() + 1; // 1-12
    const year  = d.getFullYear();

    // ── Expiry logic ──────────────────────────────────────────────────────────
    const isThursday       = dowN === 4;
    const isWeeklyExpiry   = isThursday && !MARKET_HOLIDAYS.has(dateStr);
    // Last Thursday of month = monthly expiry
    const nextWeek = new Date(d.getTime() + 7 * 86400000);
    const isMonthlyExpiry  = isWeeklyExpiry && nextWeek.getMonth() !== d.getMonth();
    const isPreExpiry      = dowN === 3 && !MARKET_HOLIDAYS.has(dateStr); // Wednesday
    const isPostExpiry     = dowN === 5 && !MARKET_HOLIDAYS.has(dateStr); // Friday

    // ── Month structure ───────────────────────────────────────────────────────
    const isMonthStart = day <= 3;
    const isMonthEnd   = day >= 27;
    const isQuarterStart = [1, 4, 7, 10].includes(month) && day <= 5;
    const isQuarterEnd   = [3, 6, 9, 12].includes(month) && day >= 25;

    // ── Festival adjacency ────────────────────────────────────────────────────
    let isFestivalWeek = false, festivalName = '', isPreFestival = false, isPostFestival = false;
    for (const [fDate, fName] of Object.entries(FESTIVALS)) {
        const fd   = new Date(fDate + 'T00:00:00+05:30');
        const diff = Math.round((d.getTime() - fd.getTime()) / 86400000);
        if (diff >= -7 && diff <= 7) { isFestivalWeek = true; festivalName = fName; }
        if (diff >= -2 && diff < 0)  { isPreFestival  = true; festivalName = fName; }
        if (diff > 0  && diff <= 2)  { isPostFestival = true; festivalName = fName; }
    }

    // ── Special event days ────────────────────────────────────────────────────
    const isBudgetDay     = BUDGET_DATES.has(dateStr);
    const isRBIDay        = RBI_DATES.has(dateStr);
    // Results season: Apr-May, Jul-Aug, Oct-Nov, Jan-Feb
    const isResultsSeason = [1, 2, 4, 5, 7, 8, 10, 11].includes(month);

    // ── Seasonal sectors ─────────────────────────────────────────────────────
    const seasonalSectors = SEASONAL_SECTORS[month] || [];

    // ── Build tags list ───────────────────────────────────────────────────────
    const tags: string[] = [`dow_${dow}`];
    if (isWeeklyExpiry)   tags.push('weekly_expiry');
    if (isMonthlyExpiry)  tags.push('monthly_expiry');
    if (isPreExpiry)      tags.push('pre_expiry');
    if (isPostExpiry)     tags.push('post_expiry');
    if (isMonthStart)     tags.push('month_start');
    if (isMonthEnd)       tags.push('month_end');
    if (isQuarterStart)   tags.push('quarter_start');
    if (isQuarterEnd)     tags.push('quarter_end');
    if (isFestivalWeek)   tags.push(`festival_week_${festivalName}`);
    if (isPreFestival)    tags.push(`pre_festival_${festivalName}`);
    if (isPostFestival)   tags.push(`post_festival_${festivalName}`);
    if (isBudgetDay)      tags.push('budget_day');
    if (isRBIDay)         tags.push('rbi_day');
    if (isResultsSeason)  tags.push('results_season');
    for (const s of seasonalSectors) tags.push(`seasonal_${s}`);

    return {
        date: dateStr, dow, dowNum: dowN,
        isWeeklyExpiry, isMonthlyExpiry, isPreExpiry, isPostExpiry,
        isMonthStart, isMonthEnd, isQuarterStart, isQuarterEnd,
        isFestivalWeek, festivalName, isPreFestival, isPostFestival,
        isBudgetDay, isRBIDay, isResultsSeason,
        seasonalSectors, tags,
    };
}

// Human-readable label for a tag
export function conditionLabel(tag: string): string {
    const map: Record<string, string> = {
        dow_Mon: 'Monday',   dow_Tue: 'Tuesday',  dow_Wed: 'Wednesday',
        dow_Thu: 'Thursday', dow_Fri: 'Friday',
        weekly_expiry:  'Weekly expiry (Thu)',
        monthly_expiry: 'Monthly expiry (last Thu)',
        pre_expiry:     'Day before expiry (Wed)',
        post_expiry:    'Day after expiry (Fri)',
        month_start:    'Month start (days 1-3)',
        month_end:      'Month end (days 27+)',
        quarter_start:  'Quarter start',
        quarter_end:    'Quarter end',
        budget_day:     'Budget day',
        rbi_day:        'RBI policy day',
        results_season: 'Quarterly results season',
    };
    if (map[tag]) return map[tag];
    if (tag.startsWith('festival_week_'))  return `Festival week: ${tag.replace('festival_week_','').replace('_',' ')}`;
    if (tag.startsWith('pre_festival_'))   return `Pre-festival: ${tag.replace('pre_festival_','').replace('_',' ')}`;
    if (tag.startsWith('post_festival_'))  return `Post-festival: ${tag.replace('post_festival_','').replace('_',' ')}`;
    if (tag.startsWith('seasonal_'))       return `Seasonal sector: ${tag.replace('seasonal_','')}`;
    return tag;
}
