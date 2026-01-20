import { NextRequest, NextResponse } from 'next/server';
import { resolveServicesHostString } from '@/lib/config/services-host';

/**
 * Proxy route for session check (Angular parity).
 *
 * Angular loads the app on the same domain as the backend, so `/app/login/?is_ajax=1`
 * can be called without CORS and uses cookies automatically.
 *
 * In the Next.js dev/proxy setup, we must proxy this through Next.js so reloads don't
 * bounce to /login even though the user still has a valid session cookie.
 *
 * IMPORTANT:
 * - Do NOT call `https://{servicesHost}/app/login/?is_ajax=1` directly from the browser.
 * - This proxy forwards localhost cookies upstream, so refresh/reload can rehydrate auth state.
 */
export async function GET(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });
    const backendUrl = `https://${servicesHost}/app/login/?is_ajax=1`;

    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        'User-Agent': request.headers.get('user-agent') || 'Next.js Session Proxy',
      },
      credentials: 'include',
      cache: 'no-store',
    });

    const headers = new Headers();
    headers.set('x-upstream-host', servicesHost);
    headers.set('x-upstream-url', backendUrl);

    if (!response.ok) {
      // Backend returns 401 when not signed in (or sometimes HTML).
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ isSignedIn: false }, { status: 200, headers });
      }
      const errorText = await response.text();
      return NextResponse.json({ isSignedIn: false, error: errorText.substring(0, 500) }, { status: 200, headers });
    }

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // If it's not JSON, treat as not signed in (prevents redirect loops on HTML).
      return NextResponse.json({ isSignedIn: false }, { status: 200, headers });
    }

    // Backend may return {data: LoginResponse} or direct LoginResponse.
    const signInResponseData = json?.data || json;

    const host = request.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    const nextResponse = NextResponse.json({ isSignedIn: true, signInResponseData }, { status: 200, headers });

    // Forward/rewrite Set-Cookie like the login proxy so local dev keeps session cookies.
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      setCookies.forEach((cookie) => {
        let rewritten = cookie;
        if (isLocalhost) {
          rewritten = rewritten.replace(/;\s*Domain=[^;]+/i, '');
          rewritten = rewritten.replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
          rewritten = rewritten.replace(/;\s*Secure/gi, '');
        }
        nextResponse.headers.append('Set-Cookie', rewritten);
      });
    }

    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      {
        isSignedIn: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 }
    );
  }
}
