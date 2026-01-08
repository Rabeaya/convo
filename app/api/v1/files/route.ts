import { NextRequest, NextResponse } from 'next/server';

const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
const API_VERSION = 'v1';

export async function POST(request: NextRequest) {
  try {
    const url = `https://${SERVICES_HOST}/api/${API_VERSION}/files`;

    const cookieHeader = request.headers.get('cookie') || '';
    const body = await request.text();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      credentials: 'include',
      body,
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { error: responseText.substring(0, 2000) };
    }

    const headers = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        headers.append('Set-Cookie', value);
      }
    });

    if (!response.ok) {
      console.error(`[Files API] Error:`, response.status, JSON.stringify(data)?.slice(0, 500));
      return NextResponse.json(
        {
          error: data?.error || data?.message || 'Failed to process files request',
          details: data,
        },
        { status: response.status, headers }
      );
    }

    return NextResponse.json(data, { status: response.status, headers });
  } catch (error) {
    console.error(`[Files API] Exception:`, error);
    return NextResponse.json(
      {
        error: 'Failed to process files request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


