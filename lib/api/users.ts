import type { ApiError, ApiResponse } from './client';

export interface UsersApiUser {
  user_id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone_no?: string;
  show_email?: number | boolean;
  show_phone?: number | boolean;
  sign_up_identity?: number;
  status?: string;
  rank?: number;
  publishable?: boolean;
  searchable?: boolean;
  [key: string]: unknown;
}

export interface UsersApiResponse {
  accessible_users?: UsersApiUser[];
  user?: UsersApiUser;
  account_data_revision_number?: number;
  [key: string]: unknown;
}

class UsersService {
  async getUsers(): Promise<ApiResponse<UsersApiResponse>> {
    const response = await fetch('/api/v1/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      let errorText = 'Failed to fetch users';
      try {
        const errorData = await response.json();
        errorText = (errorData as any).error || (errorData as any).message || errorText;
      } catch {
        try {
          errorText = await response.text();
        } catch {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }
      }

      const error: ApiError = {
        message: errorText,
        code: 'USERS_FETCH_ERROR',
        status: response.status,
      };
      throw error;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      const error: ApiError = {
        message: 'Invalid JSON response from users API',
        code: 'USERS_PARSE_ERROR',
        status: response.status,
      };
      throw error;
    }

    // AngularJS ServerComm.getx returns response.data already. Our proxy may return { data: ... } or direct object.
    const unwrapped = (data as any)?.data ? (data as any).data : data;

    return {
      data: unwrapped as UsersApiResponse,
      status: response.status,
    };
  }
}

export const usersService = new UsersService();


