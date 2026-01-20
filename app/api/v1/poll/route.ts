import { NextRequest, NextResponse } from 'next/server';

import { resolveServicesHostString } from '@/lib/config/services-host';

/**
 * Proxy route for poll creation
 * Angular uses serverComm.post('poll', data) which maps to /api/v1/poll
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });
    
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Construct the backend URL
    const url = `https://${servicesHost}/api/v1/poll`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Accept': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Next.js Poll Proxy',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Poll Proxy] Error:`, response.status, errorText.substring(0, 200));
      
      // Try to parse error as JSON
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 500) };
      }
      
      return NextResponse.json(
        { 
          error: errorData.error || `Failed to create poll`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[Poll Proxy] Success: Poll created`);

    // Forward Set-Cookie headers if present
    const headers = new Headers();
    const setCookieHeaders = response.headers.getSetCookie();
    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        headers.append('Set-Cookie', cookie);
      });
    }

    return NextResponse.json(data, { headers });
  } catch (error: any) {
    console.error('[Poll Proxy] Error:', error);
    return NextResponse.json(
      { error: `Failed to create poll: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}


