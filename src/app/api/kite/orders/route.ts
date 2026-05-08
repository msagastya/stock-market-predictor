import { NextRequest, NextResponse } from 'next/server';
import { getOrders, getTrades, placeOrder, cancelOrder, hasKiteCredentials } from '@/lib/api/kite-connect';

function notAuth() {
    return NextResponse.json({ error: 'Kite not authenticated' }, { status: 401 });
}

// GET /api/kite/orders?type=orders|trades
export async function GET(req: NextRequest) {
    if (!hasKiteCredentials()) return notAuth();
    const type = req.nextUrl.searchParams.get('type') || 'orders';
    try {
        const data = type === 'trades' ? await getTrades() : await getOrders();
        return NextResponse.json({ data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/kite/orders — place order
export async function POST(req: NextRequest) {
    if (!hasKiteCredentials()) return notAuth();
    try {
        const body = await req.json();
        const result = await placeOrder(body);
        return NextResponse.json({ success: true, order_id: result.order_id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE /api/kite/orders?order_id=xxx
export async function DELETE(req: NextRequest) {
    if (!hasKiteCredentials()) return notAuth();
    const orderId = req.nextUrl.searchParams.get('order_id');
    if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    try {
        const result = await cancelOrder(orderId);
        return NextResponse.json({ success: true, order_id: result.order_id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
