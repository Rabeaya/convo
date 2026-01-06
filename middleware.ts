import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Simplified Middleware
 * 
 * In Next.js 15+, middleware is being phased out in favor of other patterns.
 * This simplified version just allows all routes through and lets client-side
 * code handle authentication and redirects.
 */

export function middleware(_request: NextRequest) {
  // Allow all routes - client-side code will handle authentication
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
