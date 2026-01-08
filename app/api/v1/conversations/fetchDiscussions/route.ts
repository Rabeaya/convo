/**
 * API Proxy Route: conversations/fetchDiscussions
 * 
 * Proxies requests to backend conversations/fetchDiscussions endpoint
 * Matches AngularJS serverComm.postx('conversations/fetchDiscussions', requestData)
 */

import { NextRequest, NextResponse } from 'next/server';

import { resolveServicesHostString } from '@/lib/config/services-host';

const FEED_SERVICES_VERSION = '202201200010'; // Feed services version

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });

    // Use the correct URL pattern: /index_services_{VERSION}/scrybe/conversations/fetchDiscussions
    const backendUrl = `https://${servicesHost}/index_services_${FEED_SERVICES_VERSION}/scrybe/conversations/fetchDiscussions`;

    // Log request for debugging
    console.log('FetchDiscussions API Proxy - Request:', {
      url: backendUrl,
      resource_id: body.resource_id,
      app_instance_id: body.app_instance_id,
      feed_id: body.feed_id,
      offset: body.offset,
      limit: body.limit,
      all: body.all,
      has_authToken: !!body.authToken,
      has_userID: !!body.userID,
      has_accountID: !!body.accountID,
    });

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Next.js',
        Cookie: request.headers.get('cookie') || '',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // If response is not JSON, return it as error
      console.error('Non-JSON response from backend fetchDiscussions API:', {
        status: response.status,
        statusText: response.statusText,
        responseText: responseText.substring(0, 500), // First 500 chars
      });
      return NextResponse.json(
        { error: 'Invalid response from backend', message: responseText.substring(0, 500) },
        { status: response.status }
      );
    }

    // Log error responses for debugging
    if (!response.ok) {
      console.error('Backend fetchDiscussions API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
        requestBody: body,
      });
    }

    // Forward Set-Cookie headers if present
    const headers = new Headers();
    if (response.headers.get('set-cookie')) {
      headers.set('set-cookie', response.headers.get('set-cookie')!);
    }

    return NextResponse.json(data, {
      status: response.status,
      headers,
    });
  } catch (error: any) {
    console.error('Error proxying conversations/fetchDiscussions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discussions', message: error.message },
      { status: 500 }
    );
  }
}

