import { NextRequest, NextResponse } from 'next/server';

const API_VERSION = 'v1';

function resolveServicesHost(request: NextRequest): string {
  return (
    request.headers.get('x-services-host') ||
    process.env.NEXT_PUBLIC_SERVICES_HOST ||
    process.env.SERVICES_HOST ||
    'app3.app06.convodev.net'
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
      console.error('Users API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch users: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      console.error('Failed to parse users response:', text);
      return NextResponse.json({ error: 'Invalid response from users API' }, { status: 500 });
    }

    const setCookieHeaders = response.headers.getSetCookie();
    const nextResponse = NextResponse.json(data, { status: response.status });

    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        nextResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return nextResponse;
  } catch (error: any) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: `Failed to fetch users: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}


