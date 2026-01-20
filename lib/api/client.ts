/**
 * Shared API Client
 * 
 * This is the base API client that will be used by both AngularJS and React apps.
 * All API calls should go through this client to ensure consistency.
 */

import { resolveServicesHostString } from '@/lib/config/services-host';

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  private getServicesHostHeader(): Record<string, string> {
    // Used by our Next.js API proxy routes to know which Convo host to call.
    // Default is set to the dev host requested by the user.
    const servicesHost = resolveServicesHostString({ allowWindow: true });

    return servicesHost ? { 'x-services-host': String(servicesHost) } : {};
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean>
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint, params);
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...this.getServicesHostHeader(),
      },
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...this.getServicesHostHeader(),
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...this.getServicesHostHeader(),
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(
    endpoint: string
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...this.getServicesHostHeader(),
      },
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Build URL with query parameters
   */
  private buildURL(
    endpoint: string,
    params?: Record<string, string | number | boolean>
  ): string {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SERVICES_HOST
          ? `https://${process.env.NEXT_PUBLIC_SERVICES_HOST}`
          : 'http://localhost';

    const url = new URL(`${this.baseURL}${endpoint}`, origin);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json();

    if (!response.ok) {
      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname + window.location.search;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
      
      throw {
        message: data.message || 'An error occurred',
        code: data.code,
        status: response.status,
        redirectToLogin: data.redirectToLogin || response.status === 401,
      } as ApiError;
    }

    return {
      data: data.data || data,
      status: response.status,
      message: data.message,
    };
  }
}

// Create singleton instance
// Base URL will be set from config
export const apiClient = new ApiClient();

