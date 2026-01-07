'use client';

/**
 * Root Page
 * 
 * Redirects to login if not authenticated, otherwise to feed (home experience)
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { ApiResponse } from '@/lib/api/client';
import type { SessionCheckResponse } from '@/lib/api/auth';

export default function RootPage() {
  const router = useRouter();
  const { data: sessionData, isLoading } = useSession();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loginData = useAuthStore((state) => state.loginData);

  useEffect(() => {
    if (!isLoading) {
      // Type assertion for sessionData
      const sessionResponse = sessionData as ApiResponse<SessionCheckResponse> | undefined;
      const isSignedIn = sessionResponse?.data?.isSignedIn || isAuthenticated || !!loginData;
      if (isSignedIn) {
        router.replace('/feed');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, sessionData, isAuthenticated, loginData, router]);

  // Show loading state
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#e2e5ea',
      fontFamily: "'Source Sans Pro', sans-serif",
    }}>
      <div style={{
        fontSize: '14px',
        color: '#272b2c',
      }}>
        Loading...
      </div>
    </div>
  );
}
