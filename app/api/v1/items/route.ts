import { NextRequest, NextResponse } from 'next/server';

import { resolveServicesHostString } from '@/lib/config/services-host';

/**
 * Items API Proxy Route
 * 
 * Proxies requests to backend items service
 * Matches AngularJS itemService API endpoints
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });

    // Use the same backend URL pattern as other services
    const backendUrl = `https://${servicesHost}/index_services_202201200010/scrybe/items`;

    // Log request for debugging
    console.log('Items API Proxy - Request:', {
      url: backendUrl,
      method: body.method,
      app_instance_id: body.app_instance_id,
      resource_id: body.resource_id,
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
      console.error('Non-JSON response from backend items API:', {
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
      console.error('Backend items API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
        requestBody: body,
      });
    }

    // Forward Set-Cookie headers if present
    const headers = new Headers();
    if (response.headers.get('set-cookie')) {
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          headers.append('Set-Cookie', value);
        }
      });
    }

    return NextResponse.json(data, {
      status: response.status,
      headers,
    });
  } catch (error: any) {
    console.error('Error proxying items API:', error);
    return NextResponse.json(
      { error: 'Failed to process items request', message: error.message },
      { status: 500 }
    );
  }
}

