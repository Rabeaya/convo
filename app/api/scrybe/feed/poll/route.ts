import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy: /api/scrybe/feed/poll  ->  Feed services (/index_services_{version}/scrybe/feed/poll)
 *
 * Angular maps `serverComm.postx('feed/poll', ...)` to:
 *   config.FEED_REST_URL + 'feed/poll'
 * where FEED_REST_URL is typically:
 *   https://{servicesHost}/fserver/index_services_{FEED_SERVICES_VERSION}/scrybe/
 *
 * For this migration task, we proxy to the explicit path requested by the user:
 *   https://app06.convodev.net/index_services_2022101206/scrybe/feed/poll
 *
 * Some environments use the '/fserver/' prefix, so we attempt both.
 */

const DEFAULT_FEED_SERVICES_HOST = 'app06.convodev.net';
const FEED_SERVICES_VERSION = '2022101206';

function resolveFeedServicesHost(request: NextRequest): string {
  return (
    request.headers.get('x-feed-services-host') ||
    process.env.NEXT_PUBLIC_FEED_SERVICES_HOST ||
    DEFAULT_FEED_SERVICES_HOST
  );
}

function buildCandidateUrls(host: string): string[] {
  return [
    `https://${host}/index_services_${FEED_SERVICES_VERSION}/scrybe/feed/poll`,
    `https://${host}/fserver/index_services_${FEED_SERVICES_VERSION}/scrybe/feed/poll`,
  ];
}

async function proxy(cookieHeader: string, bodyText: string, url: string) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    credentials: 'include',
    body: bodyText || undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    const host = resolveFeedServicesHost(request);
    const urls = buildCandidateUrls(host);
    const cookieHeader = request.headers.get('cookie') || '';
    const bodyText = await request.text();

    let response: Response | null = null;
    let usedUpstreamUrl: string | null = null;
    let lastErrorText = '';

    for (const url of urls) {
      // eslint-disable-next-line no-await-in-loop
      const res = await proxy(cookieHeader, bodyText, url);
      if (res.ok) {
        response = res;
        usedUpstreamUrl = url;
        break;
      }

      // If the server doesn't recognize one routing style, try the other.
      if (res.status === 404 || res.status === 405) {
        // eslint-disable-next-line no-await-in-loop
        lastErrorText = await res.text();
        continue;
      }

      // Non-routing error (e.g., 401/500) => return immediately.
      const errorText = await res.text();
      return NextResponse.json(
        { error: `Failed to poll feed: ${res.status} ${errorText}` },
        { status: res.status }
      );
    }

    if (!response) {
      return NextResponse.json(
        { error: `Failed to poll feed: upstream not found. ${lastErrorText}` },
        { status: 502 }
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      return NextResponse.json({ error: `Invalid JSON from feed poll: ${text}` }, { status: 502 });
    }

    const nextResponse = NextResponse.json(data, { status: response.status });
    nextResponse.headers.set('x-upstream-host', host);
    nextResponse.headers.set('x-upstream-feed-services-version', FEED_SERVICES_VERSION);
    if (usedUpstreamUrl) nextResponse.headers.set('x-upstream-url', usedUpstreamUrl);
    return nextResponse;
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to poll feed: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}


