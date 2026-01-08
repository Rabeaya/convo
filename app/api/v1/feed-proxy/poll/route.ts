import { NextRequest, NextResponse } from 'next/server';

const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
const FEED_SERVICES_VERSION = '202201200010'; // Feed services version

/**
 * Proxy route for feed/poll endpoint
 * This avoids CORS issues by proxying through Next.js server
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Construct the backend URL
    // Feed services use a different URL pattern: /index_services_{VERSION}/scrybe/feed/poll
    const backendUrl = `https://${SERVICES_HOST}/index_services_${FEED_SERVICES_VERSION}/scrybe/feed/poll`;

    console.log(`[Feed Proxy] Proxying poll request to: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Accept': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Next.js Feed Proxy',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Feed Proxy] Error (poll):`, response.status, errorText.substring(0, 200));
      
      // Try to parse error as JSON
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 500) };
      }
      
      return NextResponse.json(
        { 
          error: errorData.error || `Failed to poll feed`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[Feed Proxy] Success (poll): Received ${data?.feed_items?.length || 0} items`);

    // Forward Set-Cookie headers if present
    const headers = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        headers.append('Set-Cookie', value);
      }
    });

    return NextResponse.json(data, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error(`[Feed Proxy] Exception (poll):`, error);
    return NextResponse.json(
      { 
        error: `Failed to process feed poll request`,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

