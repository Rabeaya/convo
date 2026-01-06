import { NextRequest, NextResponse } from 'next/server';

const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupIDs } = body;

    if (!groupIDs) {
      return NextResponse.json(
        { error: 'groupIDs is required' },
        { status: 400 }
      );
    }

    // Relevancies endpoint uses analytics path (same domain)
    // The endpoint is "analytics/relevancies" which gets routed to analytics/api/relevancies
    const url = `https://${SERVICES_HOST}/analytics/api/relevancies`;
    
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Get auth data from request body or headers
    const authToken = body.authToken || request.headers.get('x-auth-token') || '';
    const userID = body.userID || request.headers.get('x-user-id') || '';
    const accountID = body.accountID || request.headers.get('x-account-id') || '';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
      body: JSON.stringify({
        authToken,
        userID,
        accountID,
        groupIDs,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Relevancies API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch relevancies: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const text = await response.text();
      console.error('Failed to parse relevancies response:', text);
      return NextResponse.json(
        { error: 'Invalid response from relevancies API' },
        { status: 500 }
      );
    }

    // Forward set-cookie headers if present
    const setCookieHeaders = response.headers.getSetCookie();
    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        nextResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return nextResponse;
  } catch (error: any) {
    console.error('Relevancies API error:', error);
    return NextResponse.json(
      { error: `Failed to fetch relevancies: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

