import { NextRequest, NextResponse } from 'next/server';

const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
const API_VERSION = 'v1';

export async function GET(request: NextRequest) {
  try {
    // Groups endpoint uses regular API path, not feed services
    const url = `https://${SERVICES_HOST}/api/${API_VERSION}/groups`;
    
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
      console.error('Groups API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch groups: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    let data;
    try {
      const rawResponse = await response.json();
      
      // Log the FULL response structure for debugging
      console.log('Groups API Route - Full Raw Response:', JSON.stringify(rawResponse, null, 2));
      console.log('Groups API Route - Response Keys:', Object.keys(rawResponse));
      console.log('Groups API Route - Response Type:', typeof rawResponse);
      console.log('Groups API Route - Is Array?', Array.isArray(rawResponse));
      
      // Check all properties for arrays or nested structures
      for (const key of Object.keys(rawResponse)) {
        const value = rawResponse[key];
        console.log(`Groups API Route - Key "${key}":`, {
          type: typeof value,
          isArray: Array.isArray(value),
          length: Array.isArray(value) ? value.length : 'N/A',
          hasData: value && typeof value === 'object' && 'data' in value,
          hasGroups: value && typeof value === 'object' && 'groups' in value,
        });
        if (Array.isArray(value) && value.length > 0) {
          console.log(`Groups API Route - First item in "${key}":`, value[0]);
        }
        if (value && typeof value === 'object' && 'data' in value) {
          console.log(`Groups API Route - "${key}.data" keys:`, Object.keys(value.data));
        }
        if (value && typeof value === 'object' && 'groups' in value) {
          console.log(`Groups API Route - "${key}.groups" is array:`, Array.isArray(value.groups));
          console.log(`Groups API Route - "${key}.groups" length:`, value.groups?.length);
        }
      }
      
      // Handle response structure - AngularJS does: response = response.data; then uses response.groups
      // So the backend returns: { data: { groups: [...], account_data_revision_number: ... } }
      // The Next.js API route should return the unwrapped version
      
      // Try multiple paths to find groups
      if (rawResponse.data && rawResponse.data.groups) {
        // Standard: { data: { groups: [...], account_data_revision_number: ... } }
        data = rawResponse.data;
        console.log('Groups API Route - Found groups in response.data.groups');
      } else if (rawResponse.data && Array.isArray(rawResponse.data)) {
        // data is directly an array
        data = { groups: rawResponse.data, account_data_revision_number: rawResponse.account_data_revision_number || 0 };
        console.log('Groups API Route - response.data is array, wrapped it');
      } else if (rawResponse.groups) {
        // Already unwrapped: { groups: [...], account_data_revision_number: ... }
        data = rawResponse;
        console.log('Groups API Route - Found groups in response.groups');
      } else if (rawResponse.data) {
        // Has data but no groups yet - check if data has groups
        if (rawResponse.data.groups) {
          data = rawResponse.data;
          console.log('Groups API Route - Found groups in response.data (nested)');
        } else {
          data = rawResponse.data;
          console.log('Groups API Route - Using response.data (no groups found)');
        }
      } else {
        // Fallback: use rawResponse
        data = rawResponse;
        console.log('Groups API Route - Using raw response (fallback)');
      }
      
      // Log the final data structure
      console.log('Groups API Route - Final Data Structure:', {
        hasGroups: !!data.groups,
        groupsType: Array.isArray(data.groups) ? 'array' : typeof data.groups,
        groupsLength: Array.isArray(data.groups) ? data.groups.length : 'N/A',
        keys: Object.keys(data),
      });
      
      // Log sample group structure
      if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
        console.log('Groups API Route - Sample Group Structure:', data.groups[0]);
        console.log('Groups API Route - Sample Group Keys:', Object.keys(data.groups[0]));
        console.log('Groups API Route - Sample Group Title:', data.groups[0].title);
      } else {
        console.error('Groups API Route - NO GROUPS FOUND in final data!');
        console.error('Groups API Route - Data structure:', JSON.stringify(data, null, 2));
      }
    } catch (parseError) {
      const text = await response.text();
      console.error('Failed to parse groups response:', text);
      return NextResponse.json(
        { error: 'Invalid response from groups API' },
        { status: 500 }
      );
    }

    // Forward set-cookie headers if present
    const setCookieHeaders = response.headers.getSetCookie();
    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookie) => {
        nextResponse.headers.append('Set-Cookie', cookie);
      });
    }

    return nextResponse;
  } catch (error: any) {
    console.error('Groups API error:', error);
    return NextResponse.json(
      { error: `Failed to fetch groups: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

