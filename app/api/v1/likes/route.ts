import { NextRequest, NextResponse } from 'next/server';
import { resolveServicesHostString } from '@/lib/config/services-host';

const API_VERSION = 'v1';

/**
 * Proxy route for Angular `Likes.getLikesDetailWithUsersInfo` / `Likes.getLikeInfo` calls.
 * Upstream: `POST https://{servicesHost}/api/v1/likes`
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });
    const cookieHeader = request.headers.get('cookie') || '';

    const backendUrl = `https://${servicesHost}/api/${API_VERSION}/likes`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        Accept: 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Next.js Likes Proxy',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 500) };
      }
      return NextResponse.json(
        { error: errorData.error || 'Failed to process likes request', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process likes request', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


