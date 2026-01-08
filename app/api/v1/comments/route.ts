/**
 * API Proxy Route: comments
 * 
 * Proxies requests to backend comments endpoint
 * Handles both updateComment and deleteComment methods
 * Matches AngularJS serverComm.post('comments', reqData)
 */

import { NextRequest, NextResponse } from 'next/server';

import { resolveServicesHostString } from '@/lib/config/services-host';

const API_VERSION = 'v1';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const servicesHost = resolveServicesHostString({ headers: request.headers, allowWindow: false });
    const backendUrl = `https://${servicesHost}/api/${API_VERSION}/comments`;

    // Log request for debugging
    console.log('Comments API Proxy - Request:', {
      url: backendUrl,
      method: body.method,
      resource_id: body.resource_id,
      app_instance_id: body.app_instance_id,
      has_comment_text: !!body.comment_text,
      comment_text_length: body.comment_text?.length,
      has_resource_link: !!body.resource_link,
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
      console.error('Non-JSON response from backend comments API:', {
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
      console.error('Backend comments API error:', {
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
    console.error('Error proxying comments:', error);
    return NextResponse.json(
      { error: 'Failed to process comment request', message: error.message },
      { status: 500 }
    );
  }
}

