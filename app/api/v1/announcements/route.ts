import { NextRequest, NextResponse } from 'next/server';

const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';

/**
 * Proxy route for announcements API
 * Handles What's New related API calls
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Construct the backend URL
    // The announcements endpoint uses the REST API pattern
    const url = `https://${SERVICES_HOST}/api/${API_VERSION}/announcements`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await response.json();

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
    console.error('Error proxying announcements request:', error);
    return NextResponse.json(
      { error: 'Failed to process announcements request' },
      { status: 500 }
    );
  }
}

