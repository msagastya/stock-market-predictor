// Zerodha Kite Connect v3 — personal account integration
import crypto from 'crypto';
import { cachedFetch } from './cache-manager';
import { firestoreGet } from '@/lib/firebase-store';
import { Stock } from '@/types';

const KITE_BASE = 'https://api.kite.trade';
const KITE_LOGIN = 'https://kite.zerodha.com/connect/login';

export const KITE_API_KEY = process.env.KITE_API_KEY || '';
const KITE_API_SECRET = process.env.KITE_API_SECRET || '';

// Reads token from process.env first, then Firestore (for Vercel serverless)
export async function getAccessTokenAsync(): Promise<string> {
    if (process.env.KITE_ACCESS_TOKEN) return process.env.KITE_ACCESS_TOKEN;
    try {
        const doc = await firestoreGet('config', 'kite');
        const token = doc?.access_token || '';
        if (token) process.env.KITE_ACCESS_TOKEN = token; // cache in process for this instance
        return token;
    } catch {
        return '';
    }
}

export function getAccessToken(): string {
    return process.env.KITE_ACCESS_TOKEN || '';
}

export function hasKiteCredentials(): boolean {
    return Boolean(KITE_API_KEY && getAccessToken());
}

export async function hasKiteCredentialsAsync(): Promise<boolean> {
    return Boolean(KITE_API_KEY && await getAccessTokenAsync());
}

export function isKiteConfigured(): boolean {
    return Boolean(KITE_API_KEY && KITE_API_SECRET);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function getLoginURL(): string {
    return `${KITE_LOGIN}?v=3&api_key=${KITE_API_KEY}`;
}

export function generateChecksum(requestToken: string): string {
    return crypto
        .createHash('sha256')
        .update(KITE_API_KEY + requestToken + KITE_API_SECRET)
        .digest('hex');
}

export async function generateSession(requestToken: string): Promise<{
    access_token: string;
    user_id: string;
    user_name: string;
    email: string;
}> {
    const checksum = generateChecksum(requestToken);
    const body = new URLSearchParams({
        api_key: KITE_API_KEY,
        request_token: requestToken,
        checksum,
    });

    const res = await fetch(`${KITE_BASE}/session/token`, {
        method: 'POST',
        headers: { 'X-Kite-Version': '3', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'Session generation failed');
    return data.data;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function kiteHeaders(contentType = 'application/x-www-form-urlencoded'): Record<string, string> {
    return {
        'Authorization': `token ${KITE_API_KEY}:${getAccessToken()}`,
        'X-Kite-Version': '3',
        'Content-Type': contentType,
    };
}

async function kiteGet(path: string): Promise<any> {
    const res = await fetch(`${KITE_BASE}${path}`, { headers: kiteHeaders() });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || `Kite error: ${path}`);
    return data.data;
}

async function kitePost(path: string, body: URLSearchParams | string): Promise<any> {
    const res = await fetch(`${KITE_BASE}${path}`, {
        method: 'POST',
        headers: kiteHeaders(),
        body: body.toString(),
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || `Kite error: ${path}`);
    return data.data;
}

async function kiteDelete(path: string): Promise<any> {
    const res = await fetch(`${KITE_BASE}${path}`, {
        method: 'DELETE',
        headers: kiteHeaders(),
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || `Kite error: ${path}`);
    return data.data;
}

async function kitePut(path: string, body: string): Promise<any> {
    const res = await fetch(`${KITE_BASE}${path}`, {
        method: 'PUT',
        headers: kiteHeaders('application/json'),
        body,
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || `Kite error: ${path}`);
    return data.data;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function getKiteProfile() {
    return kiteGet('/user/profile');
}

export async function getKiteMargins() {
    return kiteGet('/user/margins/equity');
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

/**
 * Fetch full quote for up to 500 instruments.
 * symbols: ['NSE:INFY', 'NSE:TCS'] or Yahoo-style ['INFY.NS', 'TCS.NS']
 */
export async function getKiteQuotes(symbols: string[]): Promise<Record<string, any>> {
    const kiteSymbols = symbols.map(toKiteSymbol);
    const params = kiteSymbols.map(s => `i=${encodeURIComponent(s)}`).join('&');
    return kiteGet(`/quote?${params}`);
}

export async function getKiteLTP(symbols: string[]): Promise<Record<string, { instrument_token: number; last_price: number }>> {
    const kiteSymbols = symbols.map(toKiteSymbol);
    const params = kiteSymbols.map(s => `i=${encodeURIComponent(s)}`).join('&');
    return kiteGet(`/quote/ltp?${params}`);
}

export async function getKiteOHLC(symbols: string[]): Promise<Record<string, any>> {
    const kiteSymbols = symbols.map(toKiteSymbol);
    const params = kiteSymbols.map(s => `i=${encodeURIComponent(s)}`).join('&');
    return kiteGet(`/quote/ohlc?${params}`);
}

/** Convert Yahoo-style symbol to Kite format */
export function toKiteSymbol(symbol: string): string {
    if (symbol.includes(':')) return symbol; // already Kite format
    if (symbol.endsWith('.BO')) return `BSE:${symbol.replace('.BO', '')}`;
    if (symbol.endsWith('.NS')) return `NSE:${symbol.replace('.NS', '')}`;
    if (symbol.startsWith('^')) {
        const map: Record<string, string> = {
            '^NSEI': 'NSE:NIFTY 50',
            '^BSESN': 'BSE:SENSEX',
            '^NSEBANK': 'NSE:NIFTY BANK',
        };
        return map[symbol] || `NSE:${symbol.replace('^', '')}`;
    }
    return `NSE:${symbol}`;
}

// ─── GTT (Good Till Triggered) ────────────────────────────────────────────────

export type GTTType = 'single' | 'two-leg';
export type GTTStatus = 'active' | 'triggered' | 'disabled' | 'expired' | 'cancelled' | 'rejected' | 'deleted';

export interface GTTOrder {
    exchange: string;
    tradingsymbol: string;
    transaction_type: 'BUY' | 'SELL';
    quantity: number;
    order_type: 'LIMIT';
    product: 'CNC' | 'NRML' | 'MIS';
    price: number;
}

export interface GTTCondition {
    exchange: string;
    tradingsymbol: string;
    trigger_values: number[];  // [price] for single, [sl_price, target_price] for two-leg
    last_price: number;
}

export interface GTT {
    id: number;
    type: GTTType;
    status: GTTStatus;
    condition: GTTCondition;
    orders: GTTOrder[];
    created_at: string;
    updated_at: string;
    expires_at: string;
}

/** List all active (and recently triggered) GTTs */
export async function getGTTs(): Promise<GTT[]> {
    return kiteGet('/gtt/triggers');
}

/** Get a single GTT by ID */
export async function getGTT(id: number): Promise<GTT> {
    return kiteGet(`/gtt/triggers/${id}`);
}

/**
 * Create a single GTT — fires one order when price hits triggerPrice.
 * Use for simple price alerts that auto-execute.
 */
export async function createSingleGTT(params: {
    symbol: string;         // Yahoo-style: RELIANCE.NS
    exchange?: string;
    triggerPrice: number;
    orderPrice: number;
    quantity: number;
    transactionType: 'BUY' | 'SELL';
    product?: 'CNC' | 'NRML' | 'MIS';
    lastPrice: number;
}): Promise<{ trigger_id: number }> {
    const { symbol, triggerPrice, orderPrice, quantity, transactionType, lastPrice } = params;
    const exchange = params.exchange || (symbol.endsWith('.BO') ? 'BSE' : 'NSE');
    const tradingsymbol = symbol.replace(/\.(NS|BO)$/, '');
    const product = params.product || 'CNC';

    const body = JSON.stringify({
        type: 'single',
        condition: { exchange, tradingsymbol, trigger_values: [triggerPrice], last_price: lastPrice },
        orders: [{ exchange, tradingsymbol, transaction_type: transactionType, quantity, order_type: 'LIMIT', product, price: orderPrice }],
    });

    const res = await fetch(`${KITE_BASE}/gtt/triggers`, {
        method: 'POST',
        headers: kiteHeaders('application/json'),
        body,
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'GTT creation failed');
    return data.data;
}

/**
 * Create a two-leg GTT (OCO — One Cancels Other).
 * Fires SELL at target price OR stop-loss price, whichever hits first.
 * Ideal for: already holding a stock, set both take-profit and stop-loss in one go.
 */
export async function createOCOGTT(params: {
    symbol: string;
    exchange?: string;
    stopLossPrice: number;
    targetPrice: number;
    quantity: number;
    product?: 'CNC' | 'NRML' | 'MIS';
    lastPrice: number;
}): Promise<{ trigger_id: number }> {
    const { symbol, stopLossPrice, targetPrice, quantity, lastPrice } = params;
    const exchange = params.exchange || (symbol.endsWith('.BO') ? 'BSE' : 'NSE');
    const tradingsymbol = symbol.replace(/\.(NS|BO)$/, '');
    const product = params.product || 'CNC';

    const body = JSON.stringify({
        type: 'two-leg',
        condition: {
            exchange, tradingsymbol,
            trigger_values: [stopLossPrice, targetPrice],
            last_price: lastPrice,
        },
        orders: [
            { exchange, tradingsymbol, transaction_type: 'SELL', quantity, order_type: 'LIMIT', product, price: stopLossPrice },
            { exchange, tradingsymbol, transaction_type: 'SELL', quantity, order_type: 'LIMIT', product, price: targetPrice },
        ],
    });

    const res = await fetch(`${KITE_BASE}/gtt/triggers`, {
        method: 'POST',
        headers: kiteHeaders('application/json'),
        body,
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message || 'OCO GTT creation failed');
    return data.data;
}

/** Delete a GTT */
export async function deleteGTT(id: number): Promise<{ trigger_id: number }> {
    return kiteDelete(`/gtt/triggers/${id}`);
}

/** Modify an existing GTT */
export async function modifyGTT(id: number, params: {
    triggerPrice?: number;
    stopLossPrice?: number;
    targetPrice?: number;
    orderPrice?: number;
    quantity?: number;
    lastPrice: number;
    currentGTT: GTT;
}): Promise<{ trigger_id: number }> {
    const gtt = params.currentGTT;
    const condition = { ...gtt.condition, last_price: params.lastPrice };

    if (gtt.type === 'single' && params.triggerPrice) {
        condition.trigger_values = [params.triggerPrice];
    } else if (gtt.type === 'two-leg' && params.stopLossPrice && params.targetPrice) {
        condition.trigger_values = [params.stopLossPrice, params.targetPrice];
    }

    const orders = gtt.orders.map((o, i) => ({
        ...o,
        price: gtt.type === 'two-leg'
            ? (i === 0 ? (params.stopLossPrice || o.price) : (params.targetPrice || o.price))
            : (params.orderPrice || o.price),
        quantity: params.quantity || o.quantity,
    }));

    return kitePut(`/gtt/triggers/${id}`, JSON.stringify({ type: gtt.type, condition, orders }));
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(): Promise<any[]> {
    return kiteGet('/orders');
}

export async function getTrades(): Promise<any[]> {
    return kiteGet('/trades');
}

export async function placeOrder(params: {
    symbol: string;
    exchange?: string;
    transactionType: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    quantity: number;
    price?: number;
    triggerPrice?: number;
    product?: 'CNC' | 'NRML' | 'MIS';
    validity?: 'DAY' | 'IOC';
    tag?: string;
}): Promise<{ order_id: string }> {
    const exchange = params.exchange || (params.symbol.endsWith('.BO') ? 'BSE' : 'NSE');
    const tradingsymbol = params.symbol.replace(/\.(NS|BO)$/, '');

    const body = new URLSearchParams({
        tradingsymbol,
        exchange,
        transaction_type: params.transactionType,
        order_type: params.orderType,
        quantity: String(params.quantity),
        product: params.product || 'CNC',
        validity: params.validity || 'DAY',
    });

    if (params.price) body.set('price', String(params.price));
    if (params.triggerPrice) body.set('trigger_price', String(params.triggerPrice));
    if (params.tag) body.set('tag', params.tag);

    return kitePost('/orders/regular', body);
}

export async function cancelOrder(orderId: string): Promise<{ order_id: string }> {
    return kiteDelete(`/orders/regular/${orderId}`);
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface KiteHolding {
    tradingsymbol: string;
    exchange: string;
    instrument_token: number;
    quantity: number;
    average_price: number;
    last_price: number;
    pnl: number;
    day_change: number;
    day_change_percentage: number;
    product: string;
    t1_quantity: number;
    close_price: number;
}

export async function getHoldings(): Promise<KiteHolding[]> {
    return kiteGet('/portfolio/holdings');
}

export async function getPositions(): Promise<{ net: any[]; day: any[] }> {
    return kiteGet('/portfolio/positions');
}

// ─── Instruments (for search) ─────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQuotes = !inQuotes; continue; }
        if (c === ',' && !inQuotes) { result.push(current); current = ''; continue; }
        current += c;
    }
    result.push(current);
    return result;
}

export async function searchKiteInstruments(query: string, limit = 10): Promise<Stock[]> {
    if (!hasKiteCredentials() || query.trim().length < 2) return [];

    try {
        const csv = await cachedFetch('kite-instruments-dump', async () => {
            const res = await fetch('https://api.kite.trade/instruments', {
                headers: kiteHeaders(),
            });
            if (!res.ok) throw new Error(`Kite instruments ${res.status}`);
            return res.text();
        }, 60);

        const normalized = query.trim().toUpperCase();
        const matches: Stock[] = [];

        for (const line of csv.split('\n').slice(1)) {
            if (!line.trim()) continue;
            const cols = parseCsvLine(line);
            const tradingsymbol = cols[2] || '';
            const name = cols[3] || tradingsymbol;
            const exchange = cols[11] || '';
            const segment = cols[10] || '';

            if (!['NSE', 'BSE', 'NFO', 'BFO'].includes(exchange)) continue;
            if (!`${tradingsymbol} ${name} ${exchange}`.toUpperCase().includes(normalized)) continue;

            matches.push({
                symbol: exchange === 'BSE' ? `${tradingsymbol}.BO` : `${tradingsymbol}.NS`,
                name: name || tradingsymbol,
                exchange,
                price: 0, change: 0, changePercent: 0,
                assetType: segment.includes('INDICES') ? 'index' : 'stock',
                provider: 'kite',
            });

            if (matches.length >= limit) break;
        }

        return matches;
    } catch {
        return [];
    }
}
