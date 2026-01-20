import { NextRequest, NextResponse } from 'next/server';
import { resolveServicesHostString } from '@/lib/config/services-host';

const API_VERSION = 'v1';

function resolveServicesHost(request: NextRequest): string {
  // Allow client to specify which backend host to use.
  // Falls back to env, then to the default requested by the user.
  return resolveServicesHostString({ headers: request.headers, allowWindow: false });
}

export async function GET(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHost(request);
    const url = `https://${servicesHost}/api/${API_VERSION}/settings`;
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
      console.error('Settings API error:', response.status, errorText);
      
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Unauthorized', redirectToLogin: true },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to fetch settings: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      console.error('Failed to parse settings response:', text);
      return NextResponse.json({ error: 'Invalid response from settings API' }, { status: 500 });
    }

    const setCookieHeaders = response.headers.getSetCookie();
    const nextResponse = NextResponse.json(data, { status: response.status });
    nextResponse.headers.set('x-upstream-host', servicesHost);

    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        nextResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return nextResponse;
  } catch (error: any) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: `Failed to fetch settings: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHost(request);
    const url = `https://${servicesHost}/api/${API_VERSION}/settings`;
    const cookieHeader = request.headers.get('cookie') || '';
    const body = await request.json();

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
      console.error('Settings API error:', response.status, errorText);
      
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Unauthorized', redirectToLogin: true },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to save settings: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      console.error('Failed to parse settings response:', text);
      return NextResponse.json({ error: 'Invalid response from settings API' }, { status: 500 });
    }

    const setCookieHeaders = response.headers.getSetCookie();
    const nextResponse = NextResponse.json(data, { status: response.status });
    nextResponse.headers.set('x-upstream-host', servicesHost);

    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        nextResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return nextResponse;
  } catch (error: any) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: `Failed to save settings: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}


