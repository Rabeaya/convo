import { NextRequest, NextResponse } from 'next/server';

import { resolveServicesHostString } from '@/lib/config/services-host';

const API_VERSION = 'v1';

function getUpstreamUrl(request: NextRequest) {
  const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });
  return {
    servicesHost,
    url: `https://${servicesHost}/api/${API_VERSION}/notes`,
  };
}

export async function PUT(request: NextRequest) {
  try {
    const { servicesHost, url } = getUpstreamUrl(request);
    const cookieHeader = request.headers.get('cookie') || '';
    const body = await request.text();

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: cookieHeader,
        'User-Agent': request.headers.get('user-agent') || 'Next.js',
      },
      credentials: 'include',
      body,
    });

    const responseText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { error: responseText.substring(0, 2000) };
    }

    const nextResponse = NextResponse.json(data, { status: response.status });
    nextResponse.headers.set('x-upstream-host', servicesHost);

    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => nextResponse.headers.append('Set-Cookie', cookie));
    }

    return nextResponse;
  } catch (error) {
    console.error('[Notes API] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to process notes request', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


