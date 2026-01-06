import { NextRequest, NextResponse } from 'next/server';

const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';

/**
 * GET /api/v1/users
 * 
 * Fetches users list from backend
 * Matches AngularJS Users.getUsers() -> serverComm.getx('users')
 */
export async function GET(request: NextRequest) {
  try {
    const backendUrl = `https://${SERVICES_HOST}/api/v1/users`;

    // Forward cookies for authentication
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Next.js',
        Cookie: cookieHeader,
      },
      credentials: 'include',
    });

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Non-JSON response from backend users API:', {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.substring(0, 500),
      });
      return NextResponse.json(
        { error: 'Invalid response from backend', message: responseText.substring(0, 500) },
        { status: response.status }
      );
    }

    if (!response.ok) {
      console.error('Backend users API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
      });
    }

    // Forward Set-Cookie headers if present
    const headers = new Headers();
    if (response.headers.get('set-cookie')) {
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          headers.append('Set-Cookie', value);
        }
      });
    }

    return NextResponse.json(data, {
      status: response.status,
      headers,
    });
  } catch (error: any) {
    console.error('Error proxying users API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', message: error.message },
      { status: 500 }
    );
  }
}
