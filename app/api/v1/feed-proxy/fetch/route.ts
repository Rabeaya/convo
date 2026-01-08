import { NextRequest, NextResponse } from 'next/server';

const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
const FEED_SERVICES_VERSION = '202201200010'; // Feed services version

/**
 * Proxy route for feed/fetch endpoint
 * This avoids CORS issues by proxying through Next.js server
 */
export async function GET() {
  return NextResponse.json({ message: 'Feed fetch endpoint is ready. Use POST to fetch feed.' });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Construct the backend URL
    // Feed services use a different URL pattern: /index_services_{VERSION}/scrybe/feed/fetch
    const backendUrl = `https://${SERVICES_HOST}/index_services_${FEED_SERVICES_VERSION}/scrybe/feed/fetch`;

    console.log(`[Feed Proxy] Proxying fetch request to: ${backendUrl}`);
    console.log(`[Feed Proxy] Request body keys:`, Object.keys(body || {}));
    console.log(`[Feed Proxy] Request payload (sanitized):`, {
      authToken: body.authToken ? `${body.authToken.substring(0, 10)}...` : 'missing',
      userID: body.userID,
      accountID: body.accountID,
      fromIndex: body.fromIndex,
      itemsCount: body.itemsCount,
      sortBy: body.sortBy,
      filter: body.filter,
      isSearch: body.isSearch,
      includeChats: body.includeChats,
      includeDrafts: body.includeDrafts,
      applyHighlight: body.applyHighlight,
      postDisplayOption: body.postDisplayOption,
      switchToAdminMode: body.switchToAdminMode,
    });

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Accept': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'Next.js Feed Proxy',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Feed Proxy] Error (fetch):`, response.status);
      console.error(`[Feed Proxy] Backend URL was: ${backendUrl}`);
      console.error(`[Feed Proxy] Response preview:`, errorText.substring(0, 500));
      
      // If we get HTML, it's likely a 404 from the backend
      if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html>')) {
        return NextResponse.json(
          { 
            error: `Backend returned 404. Check if the endpoint URL is correct: ${backendUrl}`,
            status: response.status,
            backendUrl,
          },
          { status: 404 }
        );
      }
      
      // Try to parse error as JSON
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText.substring(0, 500) };
      }
      
      return NextResponse.json(
        { 
          error: errorData.error || `Failed to fetch feed`,
          details: errorData,
          backendUrl,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`[Feed Proxy] Success (fetch): Received ${data?.feed_items?.length || 0} items`);

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
    console.error(`[Feed Proxy] Exception (fetch):`, error);
    return NextResponse.json(
      { 
        error: `Failed to process feed fetch request`,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

