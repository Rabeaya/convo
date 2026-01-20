import { NextRequest } from 'next/server';
import { resolveServicesHostString } from '@/lib/config/services-host';

/**
 * Files Proxy
 *
 * Why:
 * - Angular runs on the same origin as the backend, so file thumbnails load with session cookies.
 * - Our Next.js app runs on localhost, so direct `https://{servicesHost}/api/v1/files/...` requests
 *   won't include the backend session cookie.
 *
 * This route proxies file requests to the upstream Convo host and forwards cookies.
 *
 * Upstream base (Angular config.js):
 * - AWS_FILE_DIR_BASE = `https://{servicesHost}/api/v1/files/`
 */

async function proxyFile(req: NextRequest, pathParts: string[]) {
  const servicesHost = resolveServicesHostString({ headers: req.headers, allowWindow: false });
  const upstream = new URL(`https://${servicesHost}/api/v1/files/${pathParts.join('/')}`);
  // Preserve query string (?a=a etc)
  upstream.search = req.nextUrl.search;

  // Forward relevant headers (especially cookies + range)
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const range = req.headers.get('range');
  if (range) headers.set('range', range);
  const accept = req.headers.get('accept');
  if (accept) headers.set('accept', accept);
  const userAgent = req.headers.get('user-agent');
  if (userAgent) headers.set('user-agent', userAgent);
  const referer = req.headers.get('referer');
  if (referer) headers.set('referer', referer);

  const upstreamRes = await fetch(upstream.toString(), {
    method: req.method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  });

  // Copy through safe headers so the browser renders images/video thumbs correctly
  const outHeaders = new Headers();
  const passHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'cache-control',
    'etag',
    'last-modified',
    'content-disposition',
  ];
  for (const h of passHeaders) {
    const v = upstreamRes.headers.get(h);
    if (v) outHeaders.set(h, v);
  }

  // Always allow our app to render this resource
  outHeaders.set('x-proxied-by', 'convo-next-files-proxy');

  if (req.method === 'HEAD') {
    return new Response(null, { status: upstreamRes.status, headers: outHeaders });
  }

  // Stream through (better for larger files and avoids buffering)
  return new Response(upstreamRes.body, { status: upstreamRes.status, headers: outHeaders });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyFile(req, path);
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxyFile(req, path);
}


