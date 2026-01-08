import { NextRequest, NextResponse } from 'next/server';
import { resolveServicesHostString } from '@/lib/config/services-host';

const API_VERSION = 'v1';

/**
 * Proxy route for like/unlike endpoint
 * Handles both resource likes and conversation (comment) likes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });
    
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Construct the backend URL
    const backendUrl = `https://${servicesHost}/api/${API_VERSION}/like`;

    console.log(`[Like Proxy] Proxying request to: ${backendUrl}`);
    console.log(`[Like Proxy] Action:`, body.action);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Accept': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Next.js Like Proxy',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Like Proxy] Error:`, response.status, errorText.substring(0, 200));
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 500) };
      }
      
      return NextResponse.json(
        { 
          error: errorData.error || `Failed to ${body.action} resource`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[Like Proxy] Success:`, body.action);

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
    console.error(`[Like Proxy] Exception:`, error);
    return NextResponse.json(
      { 
        error: `Failed to process like request`,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

