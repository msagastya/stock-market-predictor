import { NextResponse } from 'next/server';
import { isKiteConfigured, hasKiteCredentialsAsync, getLoginURL, getKiteProfile, getAccessTokenAsync } from '@/lib/api/kite-connect';

export const dynamic = 'force-dynamic';

export async function GET() {
    const configured = isKiteConfigured();

    if (!configured) {
        return NextResponse.json({
            status: 'not_configured',
            message: 'KITE_API_KEY and KITE_API_SECRET not set in environment variables',
        });
    }

    const authenticated = await hasKiteCredentialsAsync();

    if (!authenticated) {
        return NextResponse.json({
            status: 'not_authenticated',
            loginUrl: getLoginURL(),
            message: 'Click loginUrl to authenticate with Zerodha',
        });
    }

    // Set token in process.env for this request
    const token = await getAccessTokenAsync();
    process.env.KITE_ACCESS_TOKEN = token;

    try {
        const profile = await getKiteProfile();
        return NextResponse.json({
            status: 'connected',
            user: {
                id: profile.user_id,
                name: profile.user_name,
                email: profile.email,
                broker: profile.broker,
            },
        });
    } catch (e: any) {
        return NextResponse.json({
            status: 'token_expired',
            loginUrl: getLoginURL(),
            message: 'Access token expired — re-login required',
            error: e.message,
        });
    }
}
