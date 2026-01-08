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

export async function POST(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHost(request);
    const url = `https://${servicesHost}/api/${API_VERSION}/user`;
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

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to call user: ${response.status} ${text}` },
        { status: response.status }
      );
    }

    const nextResponse = NextResponse.json(data, { status: response.status });
    nextResponse.headers.set('x-upstream-host', servicesHost);
    return nextResponse;
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to call user: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}


