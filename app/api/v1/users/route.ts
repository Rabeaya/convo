import { NextRequest, NextResponse } from 'next/server';

const API_VERSION = 'v1';

function resolveServicesHost(request: NextRequest): string {
  return (
    request.headers.get('x-services-host') ||
    process.env.NEXT_PUBLIC_SERVICES_HOST ||
    process.env.SERVICES_HOST ||
    'app5.app06.convodev.net'
  );
}

export async function GET(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHost(request);
    const url = `https://${servicesHost}/api/${API_VERSION}/users`;

    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Users API] Error:', response.status, errorText.substring(0, 500));

      let errorData: any;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 2000) };
      }

      const setCookieHeaders = response.headers.getSetCookie();
      const headers = new Headers();
      headers.set('x-upstream-host', servicesHost);
      setCookieHeaders.forEach((cookie) => headers.append('Set-Cookie', cookie));

      return NextResponse.json(
        {
          error: errorData?.error || errorData?.message || 'Failed to fetch users',
          details: errorData,
        },
        { status: response.status, headers }
      );
    }

    const responseText = await response.text();
    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      console.error('[Users API] Failed to parse JSON:', responseText.substring(0, 500));
      return NextResponse.json({ error: 'Invalid response from users API' }, { status: 500 });
    }

    const setCookieHeaders = response.headers.getSetCookie();
    const headers = new Headers();
    headers.set('x-upstream-host', servicesHost);
    setCookieHeaders.forEach((cookie) => headers.append('Set-Cookie', cookie));

    return NextResponse.json(data, { status: response.status, headers });
  } catch (error: any) {
    console.error('[Users API] Exception:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
