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
    const upstreamUrl = new URL(`https://${servicesHost}/api/${API_VERSION}/stdhashtags`);

    // Forward query params exactly
    request.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value);
    });

    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
      credentials: 'include',
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    const nextResponse = NextResponse.json(data, { status: response.status });
    nextResponse.headers.set('x-upstream-host', servicesHost);
    nextResponse.headers.set('x-upstream-url', upstreamUrl.toString());
    return nextResponse;
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed stdhashtags GET: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHost(request);
    const upstreamUrl = `https://${servicesHost}/api/${API_VERSION}/stdhashtags`;
    const cookieHeader = request.headers.get('cookie') || '';
    const body = await request.json().catch(() => ({}));

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    const nextResponse = NextResponse.json(data, { status: response.status });
    nextResponse.headers.set('x-upstream-host', servicesHost);
    nextResponse.headers.set('x-upstream-url', upstreamUrl);
    return nextResponse;
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed stdhashtags POST: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}


