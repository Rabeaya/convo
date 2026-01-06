# Login API Route

This Next.js API route proxies login requests to the backend API.

## Configuration

The route needs to know where the backend is located. You can configure this in several ways:

### Option 1: Environment Variable (Recommended)

Create a `.env.local` file in the `modern-app` directory:

```bash
NEXT_PUBLIC_SERVICES_HOST=app14.convodev.net
```

Or set the full backend URL:

```bash
BACKEND_URL=https://app14.convodev.net
```

### Option 2: servicesHost in Window

If `window.servicesHost` is set (e.g., by the PHP backend), the API route will use it automatically.

### Option 3: Request Header

The frontend can send `x-services-host` header with the request.

## How It Works

1. Frontend calls `/api/v1/login` (Next.js API route)
2. API route determines the backend URL from:
   - `NEXT_PUBLIC_SERVICES_HOST` environment variable
   - `window.servicesHost` (if available)
   - Request header `x-services-host`
   - Fallback to same domain
3. API route proxies the request to `https://{servicesHost}/api/v1/login`
4. Response is forwarded back to the frontend

## Testing

To test locally, make sure:
1. You have the backend running or accessible
2. Set `NEXT_PUBLIC_SERVICES_HOST` in `.env.local` to your backend host
3. The backend should be accessible from your Next.js server

