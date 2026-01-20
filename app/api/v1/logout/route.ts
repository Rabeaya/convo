/**
 * Next.js API Route: Logout Proxy
 * 
 * Handles logout by calling the backend logout endpoint and redirecting to Next.js login page
 * This ensures the session cookie is cleared and we redirect to our app, not the backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveServicesHostString } from '@/lib/config/services-host';

export async function GET(request: NextRequest) {
  try {
    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });
    
    // Get the Next.js login URL from query params or use default
    const searchParams = request.nextUrl.searchParams;
    const redirectTo = searchParams.get('redirect') || '/login';
    
    // Build backend logout URL (matches AngularJS: config.LOGOUT_URL = config.LOGIN_URL + '?logout=1')
    const backendLogoutUrl = `https://${servicesHost}/app/login/?logout=1`;
    
    console.log('[Logout API] Calling backend logout:', backendLogoutUrl);
    console.log('[Logout API] Will redirect to:', redirectTo);
    
    // Call backend logout endpoint to clear session cookie
    // We use fetch with credentials to ensure cookies are sent
    try {
      const response = await fetch(backendLogoutUrl, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('cookie') || '',
          'User-Agent': request.headers.get('user-agent') || 'Next.js',
        },
        credentials: 'include',
        redirect: 'manual', // Don't follow redirects, we'll handle it ourselves
      });
      
      // Log the response for debugging
      console.log('[Logout API] Backend logout response status:', response.status);
    } catch (e) {
      // Ignore errors - we'll redirect anyway
      console.warn('[Logout API] Backend logout call failed (this is OK):', e);
    }
    
    // Redirect to Next.js login page
    // Use absolute URL if redirectTo is relative
    const redirectUrl = redirectTo.startsWith('http') 
      ? redirectTo 
      : `${request.nextUrl.origin}${redirectTo}`;
    
    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error('[Logout API] Error:', error);
    // Even on error, redirect to login page
    const redirectUrl = request.nextUrl.origin + '/login';
    return NextResponse.redirect(redirectUrl);
  }
}

