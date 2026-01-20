import { NextRequest, NextResponse } from 'next/server';
import { resolveServicesHostString } from '@/lib/config/services-host';

const API_VERSION = 'v1';

function resolveServicesHost(request: NextRequest): string {
  return resolveServicesHostString({ headers: request.headers, allowWindow: false });
}

function getSetCookieHeaders(response: Response): string[] {
  // Next.js/undici may expose getSetCookie(), but TS often types Headers without it.
  const hdrs = response.headers as any;
  if (hdrs && typeof hdrs.getSetCookie === 'function') {
    return hdrs.getSetCookie() as string[];
  }

  const raw = response.headers.get('set-cookie');
  if (!raw) return [];

  // Best-effort split for combined Set-Cookie header values.
  // Safe for common `Expires=Wed, 21 Oct ...` because the comma is not followed by a cookie `name=`.
  return raw.split(/,(?=[^;]+?=)/g).map((s) => s.trim()).filter(Boolean);
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

      const setCookieHeaders = getSetCookieHeaders(response);
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

    const setCookieHeaders = getSetCookieHeaders(response);
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

/**
 * POST handler for users API
 * Matches AngularJS serverComm.postx('users', {method: 'getAllUsersDetailsAccessibleToUserInAccount'})
 */
export async function POST(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHost(request);
    const url = `https://${servicesHost}/api/${API_VERSION}/users`;

    const cookieHeader = request.headers.get('cookie') || '';
    
    // Get request body (contains method parameter)
    const body = await request.json();
    
    console.log('[Users API POST] Method:', body.method);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Users API POST] Error:', response.status, errorText.substring(0, 500));

      let errorData: any;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 2000) };
      }

      const setCookieHeaders = getSetCookieHeaders(response);
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
      console.error('[Users API POST] Failed to parse JSON:', responseText.substring(0, 500));
      return NextResponse.json({ error: 'Invalid response from users API' }, { status: 500 });
    }

    console.log('[Users API POST] Success, users count:', Object.keys(data?.data?.accessible_users || {}).length);

    const setCookieHeaders = getSetCookieHeaders(response);
    const headers = new Headers();
    headers.set('x-upstream-host', servicesHost);
    setCookieHeaders.forEach((cookie) => headers.append('Set-Cookie', cookie));

    return NextResponse.json(data, { status: response.status, headers });
  } catch (error: any) {
    console.error('[Users API POST] Exception:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}