'use client';

/**
 * Home Page
 * 
 * Main application home page after login
 * This is the feed/center panel content
 */

import { useAuthStore } from '@/lib/stores/auth-store';
import { useSession } from '@/lib/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ApiResponse } from '@/lib/api/client';
import type { SessionCheckResponse } from '@/lib/api/auth';
import FeedPage from '@/app/feed/page';

export default function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loginData = useAuthStore((state) => state.loginData);
  const { data: sessionData, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If not authenticated and session check fails, redirect to login
    if (!isLoading && (!isAuthenticated && !loginData && !(sessionData as ApiResponse<SessionCheckResponse> | undefined)?.data?.isSignedIn)) {
      router.push('/login');
    }
  }, [isAuthenticated, loginData, sessionData, isLoading, router]);

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div className="text-center">
          <div style={{ fontSize: '14px', color: '#272b2c' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !loginData) {
    return null; // Will redirect
  }

  return <FeedPage />;
}
