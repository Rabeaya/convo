'use client';

/**
 * Feed Layout
 * 
 * Layout wrapper for the feed page including header and left sidebar
 */

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BaseLayout from '@/components/layout/BaseLayout';
import './feed.css';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSession } from '@/lib/hooks/use-auth';
import type { ApiResponse } from '@/lib/api/client';
import type { SessionCheckResponse } from '@/lib/api/auth';

interface FeedLayoutProps {
  children: React.ReactNode;
}

export default function FeedLayout({ children }: FeedLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loginData = useAuthStore((state) => state.loginData);
  const { data: sessionData, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;
    const sessionResponse = sessionData as ApiResponse<SessionCheckResponse> | undefined;
    const isSignedIn = sessionResponse?.data?.isSignedIn || isAuthenticated || !!loginData;
    if (!isSignedIn) {
      const qs = searchParams?.toString();
      const fullPath = `${pathname}${qs ? `?${qs}` : ''}`;
      router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`);
    }
  }, [isLoading, sessionData, isAuthenticated, loginData, router, pathname, searchParams]);

  return (
    <BaseLayout variant="with-sidebar">
      {children}
    </BaseLayout>
  );
}

