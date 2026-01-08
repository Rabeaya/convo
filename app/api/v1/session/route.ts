import { NextRequest, NextResponse } from 'next/server';
import { resolveServicesHostString } from '@/lib/config/services-host';

/**
 * Session proxy
 *
 * IMPORTANT:
 * - We must NOT call `https://{servicesHost}/app/login/?is_ajax=1` directly from the browser,
 *   because our auth cookies are stored for localhost (rewritten in `/api/v1/login`) and would not be sent cross-host.
 * - This proxy forwards localhost cookies upstream, so refresh/reload can rehydrate auth state.
 */
export async function GET(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });
    const url = `https://${servicesHost}/app/login/?is_ajax=1`;

    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
        'User-Agent': request.headers.get('user-agent') || '',
        Accept: 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { error: responseText.substring(0, 2000) };
    }

    const headers = new Headers();
    headers.set('x-upstream-host', servicesHost);
    headers.set('x-upstream-url', url);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data?.error || data?.message || 'Session check failed',
          details: data,
        },
        { status: response.status, headers }
      );
    }

    // The upstream returns the same shape as other app endpoints (often `{ data: ... }`).
    return NextResponse.json(data, { status: response.status, headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to process session check request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


