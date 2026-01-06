/**
 * React Hook for API calls with TanStack Query
 * 
 * This hook wraps API calls with React Query for caching and state management
 */

import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, ApiResponse, ApiError } from '../api/client';

/**
 * Hook for GET requests
 */
export function useApiQuery<T = unknown>(
  key: string[],
  endpoint: string,
  params?: Record<string, string | number | boolean>,
  options?: Omit<UseQueryOptions<ApiResponse<T>, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<ApiResponse<T>, ApiError>({
    queryKey: key,
    queryFn: () => apiClient.get<T>(endpoint, params),
    ...options,
  });
}

/**
 * Hook for POST requests
 */
export function useApiMutation<T = unknown, V = unknown>(
  endpoint: string,
  options?: Omit<UseMutationOptions<ApiResponse<T>, ApiError, V>, 'mutationFn'>
) {
  return useMutation<ApiResponse<T>, ApiError, V>({
    mutationFn: (data: V) => apiClient.post<T>(endpoint, data),
    ...options,
  });
}

/**
 * Hook for PUT requests
 */
export function useApiPut<T = unknown, V = unknown>(
  endpoint: string,
  options?: Omit<UseMutationOptions<ApiResponse<T>, ApiError, V>, 'mutationFn'>
) {
  return useMutation<ApiResponse<T>, ApiError, V>({
    mutationFn: (data: V) => apiClient.put<T>(endpoint, data),
    ...options,
  });
}

/**
 * Hook for DELETE requests
 */
export function useApiDelete<T = unknown>(
  endpoint: string,
  options?: Omit<UseMutationOptions<ApiResponse<T>, ApiError, void>, 'mutationFn'>
) {
  return useMutation<ApiResponse<T>, ApiError, void>({
    mutationFn: () => apiClient.delete<T>(endpoint),
    ...options,
  });
}

