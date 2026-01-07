import { NextRequest, NextResponse } from 'next/server';

const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
const API_VERSION = 'v1';

export async function GET(request: NextRequest) {
  try {
    const url = `https://${SERVICES_HOST}/api/${API_VERSION}/users`;
    
    // Forward cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Users API] Error:`, response.status, errorText.substring(0, 200));
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 500) };
      }
      
      return NextResponse.json(
        { 
          error: errorData.error || `Failed to fetch users`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[Users API] Success: Received users data`);

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
    console.error(`[Users API] Exception:`, error);
    return NextResponse.json(
      { 
        error: `Failed to process users request`,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

