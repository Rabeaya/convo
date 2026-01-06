/**
 * Authentication Hooks
 * 
 * React hooks for authentication functionality
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, LoginRequest, LoginResponse, SessionCheckResponse } from '../api/auth';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth-store';
import type { ApiResponse } from '../api/client';
import { useEffect } from 'react';

/**
 * Hook to check if user is signed in
 */
export function useSession() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const query = useQuery<ApiResponse<SessionCheckResponse>, Error>({
    queryKey: ['session'],
    queryFn: async () => {
      const response = await authService.checkSession();
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Handle success/error with useEffect (React Query v5 doesn't support onSuccess/onError)
  useEffect(() => {
    if (query.data) {
      const response = query.data;
      if (response.data.isSignedIn && response.data.signInResponseData) {
        setAuth(response.data.signInResponseData);
        // For AngularJS compatibility
        if (typeof window !== 'undefined') {
          (window as any).com_convo = (window as any).com_convo || {};
          (window as any).com_convo.sessionData = {
            isSignedIn: true,
            signInResponseData: response.data.signInResponseData,
          };
          document.body.dispatchEvent(new CustomEvent('loginDataRecieved'));
        }
      } else {
        clearAuth();
        if (typeof window !== 'undefined') {
          (window as any).com_convo = (window as any).com_convo || {};
          (window as any).com_convo.sessionData = {
            isSignedIn: false,
            signInResponseData: null,
          };
        }
      }
    }
  }, [query.data, setAuth, clearAuth]);

  useEffect(() => {
    if (query.isError) {
      clearAuth();
      if (typeof window !== 'undefined') {
        (window as any).com_convo = (window as any).com_convo || {};
        (window as any).com_convo.sessionData = {
          isSignedIn: false,
          signInResponseData: null,
        };
      }
    }
  }, [query.isError, clearAuth]);

  return query;
}

/**
 * Hook for user login
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation<ApiResponse<LoginResponse>, Error, LoginRequest>({
    mutationFn: (credentials: LoginRequest) => authService.login(credentials),
    onSuccess: (response) => {
      // Update Zustand store
      setAuth(response.data);

      // Update session cache
      queryClient.setQueryData(['session'], {
        data: {
          isSignedIn: true,
          signInResponseData: response.data,
        },
        status: response.status,
      } as ApiResponse<SessionCheckResponse>);

      // Store in window for compatibility with AngularJS app
      if (typeof window !== 'undefined') {
        const win = window as { com_convo?: { sessionData?: { isSignedIn?: boolean; signInResponseData?: LoginResponse } } };
        if (!win.com_convo) {
          win.com_convo = {};
        }
        win.com_convo.sessionData = {
          isSignedIn: true,
          signInResponseData: response.data,
        };
      }

      // Get redirect URL from query params or use default
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirect') || '/home';

      // Redirect based on account status (matching AngularJS behavior)
      if (response.data.is_account_blocked === 1) {
        router.push(`/v1/${response.data.account_id}/apps/19/17/0#title=Upgrade`);
      } else if (response.data.network_settings?.is_chat_enabled === 0) {
        // Handle chat disabled case
        router.push(redirectTo);
      } else {
        router.push(redirectTo);
      }
    },
    onError: (error: any) => {
      console.error('Login failed:', error);
      // Error is handled in the component
    },
  });
}

/**
 * Hook for user logout
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation<void, Error>({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      // Clear Zustand store
      clearAuth();

      // Clear session cache
      queryClient.setQueryData(['session'], {
        data: { isSignedIn: false },
        status: 200,
      } as ApiResponse<SessionCheckResponse>);

      // Clear window data
      if (typeof window !== 'undefined') {
        (window as { com_convo?: { sessionData?: { isSignedIn?: boolean } } }).com_convo = {
          sessionData: {
            isSignedIn: false,
          },
        };
      }

      // Redirect to login
      router.push('/login');
    },
  });
}
