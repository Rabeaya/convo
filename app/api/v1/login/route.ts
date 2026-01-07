/**
 * Next.js API Route: Login Proxy
 * 
 * Proxies login requests to the backend API
 * This allows the React app to call /api/v1/login which will forward to the actual backend
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get servicesHost from environment variable or request body
    // The frontend should send servicesHost in the request if available
    const servicesHost = 
      process.env.NEXT_PUBLIC_SERVICES_HOST || 
      process.env.SERVICES_HOST ||
      body.servicesHost ||
      request.headers.get('x-services-host');
    
    // Construct the login URL
    let loginUrl: string;
    
    if (servicesHost) {
      loginUrl = `https://${servicesHost}/api/v1/login`;
    } else {
      // Fallback: try to determine from environment
      // For development, you can set NEXT_PUBLIC_SERVICES_HOST in .env.local
      // Example: NEXT_PUBLIC_SERVICES_HOST=app14.convodev.net
      const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
      
      if (backendUrl) {
        loginUrl = `${backendUrl}/api/v1/login`;
      } else {
        // Last resort: try to use the same domain (if backend is on same server)
        const host = request.headers.get('host');
        const protocol = request.headers.get('x-forwarded-proto') || 
                        (host?.includes('localhost') ? 'http' : 'https');
        loginUrl = `${protocol}://${host}/api/v1/login`;
      }
    }
    
    console.log('Proxying login request to:', loginUrl);
    
    // Forward the request to the backend
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies from the original request
        'Cookie': request.headers.get('cookie') || '',
        // Forward user agent
        'User-Agent': request.headers.get('user-agent') || '',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    
    const responseText = await response.text();
    let data: unknown;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // If response is not JSON, return as text
      return NextResponse.json(
        { message: responseText, error: 'INVALID_RESPONSE' },
        { status: response.status }
      );
    }
    
    // Forward the response with cookies.
    // Important for local dev: cookies from https://app*.convodev.net often include Domain and Secure/SameSite=None,
    // which browsers will reject on http://localhost. We rewrite them so they can be stored for localhost,
    // then our other /api/v1/* proxy routes will forward them back upstream.

    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    const nextResponse = NextResponse.json(data, { status: response.status });

    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      setCookies.forEach((cookie) => {
        let rewritten = cookie;

        if (isLocalhost) {
          // Remove Domain so cookie becomes host-only (localhost).
          rewritten = rewritten.replace(/;\s*Domain=[^;]+/i, '');
          // Browsers reject SameSite=None without Secure; for localhost over http, downgrade to Lax and drop Secure.
          rewritten = rewritten.replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
          rewritten = rewritten.replace(/;\s*Secure/gi, '');
        }

        nextResponse.headers.append('Set-Cookie', rewritten);
      });
    }

    return nextResponse;
  } catch (error: any) {
    console.error('Login proxy error:', error);
    return NextResponse.json(
      { 
        message: error.message || 'Login request failed',
        error: 'PROXY_ERROR'
      },
      { status: 500 }
    );
  }
}

