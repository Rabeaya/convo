/**
 * Authentication API Service
 * 
 * Handles all authentication-related API calls
 * Migrated from AngularJS authentication services
 */

import type { ApiResponse } from './client';

export interface LoginRequest {
  email: string;
  pass: string;
  version?: string;
  ct?: string; // client type: 'w2' for web
  timezoneOffset?: number;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: User;
  account_id: string;
  user_accounts: Account[];
  network_settings: NetworkSettings;
  file_storage_info: FileStorageInfo;
  time: {
    timestamp: number;
  };
  xmpp_session_token: string;
  jwtAuthToken: string;
  is_account_blocked: number;
  is_administration_mode: boolean;
  web_worker_enabled: boolean;
  [key: string]: unknown;
}

export interface User {
  userId?: string;
  user_id?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email: string;
  phone?: string;
  profile_picture?: string;
  [key: string]: unknown;
}

export interface Account {
  account_id: string;
  account_name: string;
  account_key: string;
  [key: string]: unknown;
}

export interface NetworkSettings {
  is_custom_theme_enabled: number;
  is_chat_enabled: number;
  [key: string]: unknown;
}

export interface FileStorageInfo {
  [key: string]: unknown;
}

export interface SessionCheckResponse {
  isSignedIn: boolean;
  signInResponseData?: LoginResponse;
}

class AuthService {
  /**
   * Login user with email and password
   * 
   * @param credentials Login credentials
   * @returns Promise with login response data
   */
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    // Get login URL from config (should be set from window.com_convo or config)
    const loginUrl = this.getLoginUrl();
    
    // Get servicesHost to send to the API route
    const servicesHost = typeof window !== 'undefined' 
      ? (window as { servicesHost?: string }).servicesHost 
      : undefined;
    
    // The backend expects the data in the request body, not nested in 'data'
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Send servicesHost in header so API route can use it
        ...(servicesHost && { 'x-services-host': servicesHost }),
      },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({
        ...credentials,
        // Also include servicesHost in body as fallback
        ...(servicesHost && { servicesHost }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Login failed';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      
      throw {
        message: errorMessage,
        status: response.status,
      };
    }

    const data = await response.json();
    
    // Handle both { data: {...} } and direct response formats
    return {
      data: data.data || data,
      status: response.status,
    };
  }

  /**
   * Check if user is already signed in
   * 
   * @returns Promise with session check response
   */
  async checkSession(): Promise<ApiResponse<SessionCheckResponse>> {
    // Use the app login URL for session check (not API endpoint)
    const appLoginUrl = this.getAppLoginUrl();
    const response = await fetch(`${appLoginUrl}?is_ajax=1`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          data: { isSignedIn: false },
          status: response.status,
        };
      }
      throw {
        message: 'Session check failed',
        status: response.status,
      };
    }

    const data = await response.json();
    
    return {
      data: {
        isSignedIn: true,
        signInResponseData: data.data || data,
      },
      status: response.status,
    };
  }

  /**
   * Get app login URL (for session checks)
   */
  private getAppLoginUrl(): string {
    if (typeof window !== 'undefined') {
      const win = window as { servicesHost?: string; com_convo?: { config?: { LOGIN_URL?: string } } };
      
      if (win.servicesHost) {
        return `https://${win.servicesHost}/app/login/`;
      }
      
      if (win.com_convo?.config?.LOGIN_URL) {
        return win.com_convo.config.LOGIN_URL;
      }
    }
    
    return '/app/login/';
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    const logoutUrl = this.getLogoutUrl();
    const response = await fetch(logoutUrl, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.warn('Logout request failed:', response.status);
    }
  }

  /**
   * Get login URL from config
   * This should match the AngularJS config.LOGIN_URL
   * Uses Next.js API route as proxy to backend
   */
  private getLoginUrl(): string {
    // In Next.js, we'll use the API route which will proxy to the backend
    // This allows us to handle CORS and cookie forwarding properly
    if (typeof window !== 'undefined') {
      // Check for servicesHost in window (set by PHP)
      const win = window as { servicesHost?: string; com_convo?: { config?: { LOGIN_URL?: string } } };
      
      // If servicesHost is available, we can use it directly or via proxy
      if (win.servicesHost) {
        // Use Next.js API route as proxy (it will forward to the backend)
        // The API route will read servicesHost from headers or env
        return '/api/v1/login';
      }
      
      // Check for config in window.com_convo
      if (win.com_convo?.config?.LOGIN_URL) {
        // Use the API route proxy
        return '/api/v1/login';
      }
    }
    
    // Fallback - use Next.js API route (which will proxy to backend)
    return '/api/v1/login';
  }

  /**
   * Get logout URL from config
   */
  private getLogoutUrl(): string {
    return `${this.getAppLoginUrl()}?logout=1`;
  }
}

export const authService = new AuthService();

