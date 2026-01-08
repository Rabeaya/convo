# Convo Web App - Modern React/Next.js Version

This is the modernized version of the Convo web application, migrated from AngularJS to React/TypeScript using Next.js 15+ (App Router).

## Location

This application is now **independent** and located at:
```
/Users/sanaullahirfan/convo/modern-app
```

It is **separate** from the original AngularJS codebase located at:
```
/Users/sanaullahirfan/convo/web_app
```

## Quick Start

1. **Navigate to the directory:**
   ```bash
   cd /Users/sanaullahirfan/convo/modern-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Ensure `.env.local` exists with:
     ```
     NEXT_PUBLIC_SERVICES_HOST=app14.convodev.net
     SERVICES_HOST=app14.convodev.net
     # Optional (file-service sharding; Angular commonly uses 10):
     NEXT_PUBLIC_AWS_FILE_DIR_NUM_SUBDOMAINS=10
     ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

## Features Implemented

- ✅ Authentication & Login
- ✅ Main Header Panel
- ✅ Left Sidebar with Groups Integration
- ✅ Feed Items Display
- ✅ Comments Panel
- ✅ Groups API Integration
- ✅ Relevancies API Integration

## Project Structure

```
modern-app/
├── app/                    # Next.js App Router pages
│   ├── api/               # API proxy routes
│   ├── home/              # Home page with layout
│   ├── login/             # Login page
│   └── feed/              # Feed page
├── components/             # React components
│   ├── layout/            # Layout components (Header, Sidebar)
│   └── feed/              # Feed components
├── lib/                    # Library code
│   ├── api/               # API services
│   ├── hooks/             # React Query hooks
│   ├── stores/            # Zustand stores
│   └── contexts/          # React contexts
└── public/                 # Static assets
```

## Technology Stack

- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript (Strict Mode)
- **State Management:** 
  - TanStack Query (React Query) for server state
  - Zustand for client state
- **Styling:** Inline styles + CSS modules (matching AngularJS UI exactly)

## API Integration

The app uses Next.js API routes to proxy requests to the backend:
- `/api/v1/login` - Authentication
- `/api/v1/groups` - Groups list
- `/api/v1/relevancies` - Group relevancies
- `/api/v1/feed-proxy/...` - Feed endpoints

## Development Notes

- The app is completely independent from the AngularJS codebase
- All API calls are proxied through Next.js API routes
- UI matches the AngularJS version pixel-perfect
- Uses the same backend services as the AngularJS app
