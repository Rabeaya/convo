import { NextRequest, NextResponse } from 'next/server';

/**
 * Groups Directory API Route
 * 
 * Proxy endpoint for /api/v1/groups directory functionality
 * Matches AngularJS groupsService.getGroupsDirectory() behavior
 */

const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
const API_VERSION = 'v1';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get cookies from the request
    const cookies = request.headers.get('cookie') || '';
    
    // Build request data matching AngularJS format
    const reqData: any = {
      method: 'getGroupsDirectory',
    };
    
    // Include account_data_revision_no if provided
    if (body.account_data_revision_no !== undefined) {
      reqData.account_data_revision_no = body.account_data_revision_no;
    }
    
    console.log('Groups Directory Request:', reqData);
    
    // Forward to backend
    const url = `https://${SERVICES_HOST}/api/${API_VERSION}/groups`;
    const backendResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
      body: JSON.stringify(reqData),
      credentials: 'include',
    });
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Groups Directory Error:', backendResponse.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: backendResponse.status }
      );
    }
    
    const data = await backendResponse.json();
    console.log('Groups Directory Response:', data);
    
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Groups Directory API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

