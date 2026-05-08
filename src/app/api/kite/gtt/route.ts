import { NextRequest, NextResponse } from 'next/server';
import {
    getGTTs, createSingleGTT, createOCOGTT, deleteGTT, modifyGTT, getGTT,
    hasKiteCredentials,
} from '@/lib/api/kite-connect';

function notAuth() {
    return NextResponse.json({ error: 'Kite not authenticated' }, { status: 401 });
}

// GET /api/kite/gtt — list all GTTs
export async function GET() {
    if (!hasKiteCredentials()) return notAuth();
    try {
        const gtts = await getGTTs();
        return NextResponse.json({ gtts });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/kite/gtt — create GTT
// body: { type: 'single'|'oco', symbol, lastPrice, triggerPrice, orderPrice, quantity, transactionType, product? }
//    or { type: 'oco', symbol, lastPrice, stopLossPrice, targetPrice, quantity, product? }
export async function POST(req: NextRequest) {
    if (!hasKiteCredentials()) return notAuth();
    try {
        const body = await req.json();
        const { type, symbol, lastPrice, quantity, product } = body;

        if (!symbol || !lastPrice || !quantity) {
            return NextResponse.json({ error: 'symbol, lastPrice, quantity required' }, { status: 400 });
        }

        let result;
        if (type === 'oco') {
            const { stopLossPrice, targetPrice } = body;
            if (!stopLossPrice || !targetPrice) {
                return NextResponse.json({ error: 'stopLossPrice and targetPrice required for OCO' }, { status: 400 });
            }
            result = await createOCOGTT({ symbol, lastPrice, stopLossPrice, targetPrice, quantity, product });
        } else {
            const { triggerPrice, orderPrice, transactionType } = body;
            if (!triggerPrice || !orderPrice || !transactionType) {
                return NextResponse.json({ error: 'triggerPrice, orderPrice, transactionType required' }, { status: 400 });
            }
            result = await createSingleGTT({ symbol, lastPrice, triggerPrice, orderPrice, quantity, transactionType, product });
        }

        return NextResponse.json({ success: true, trigger_id: result.trigger_id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE /api/kite/gtt?id=12345
export async function DELETE(req: NextRequest) {
    if (!hasKiteCredentials()) return notAuth();
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    try {
        const result = await deleteGTT(id);
        return NextResponse.json({ success: true, trigger_id: result.trigger_id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH /api/kite/gtt — modify GTT
export async function PATCH(req: NextRequest) {
    if (!hasKiteCredentials()) return notAuth();
    try {
        const body = await req.json();
        const { id, lastPrice, ...rest } = body;
        if (!id || !lastPrice) return NextResponse.json({ error: 'id and lastPrice required' }, { status: 400 });

        const currentGTT = await getGTT(id);
        const result = await modifyGTT(id, { ...rest, lastPrice, currentGTT });
        return NextResponse.json({ success: true, trigger_id: result.trigger_id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
