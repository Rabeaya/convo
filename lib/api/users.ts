import type { ApiError, ApiResponse } from './client';
import type { User } from './auth';

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

/**
 * Helper function to get user profile image URL
 * Matches AngularJS userImgUrl filter
 */
export function getUserProfileImageUrl(
  userId: string | undefined,
  profileImageType: number | any,
  profileImageVersion: number | any,
  size: string = '48',
  servicesHost?: string
): string {
  const PROFILE_IMAGE_TYPE_SYSTEM = 2;
  const PROFILE_IMAGE_TYPE_CUSTOM = 1;
  const PROFILE_IMAGE_TYPE_DEFAULT = 0;

  const host =
    servicesHost ||
    (typeof window !== 'undefined' ? (window as any).servicesHost : undefined) ||
    process.env.NEXT_PUBLIC_SERVICES_HOST ||
    'app5.app06.convodev.net';

  const baseUrl = host ? `https://${host}` : '';
  const sizeToken = String(size || '48');
  const normalizedSize = sizeToken.includes('x') ? sizeToken.split('x')[0] : sizeToken;

  const typeNum = Number(profileImageType);
  // Loose check is intentional: backend sometimes sends "0" as a string.
  const versionIsZero = profileImageVersion == 0;

  if (userId && typeNum === PROFILE_IMAGE_TYPE_SYSTEM) {
    return `${baseUrl}/user-images/system-user/thumbnails/system-user-thumbnail-${normalizedSize}.png`;
  }
  
  // Default user image if no userId, or profileImageType is 0, or profileImageVersion is 0
  if (!userId || typeNum === PROFILE_IMAGE_TYPE_DEFAULT || profileImageVersion == null || versionIsZero) {
    return `${baseUrl}/user-images/default-user/thumbnails/default-user-thumbnail-${normalizedSize}.png`;
  }
  
  if (typeNum === PROFILE_IMAGE_TYPE_CUSTOM) {
    return `${baseUrl}/user-images/${userId}/thumbnails/${userId}-thumbnail-${normalizedSize}-${profileImageVersion}.jpg`;
  }

  // Fallback to default
  return `${baseUrl}/user-images/default-user/thumbnails/default-user-thumbnail-${normalizedSize}.png`;
}

/**
 * Helper function to get user initials from name
 */
export function getUserInitials(user: User | UsersApiUser | null | undefined): string {
  if (!user) return '. .';
  
  let name = '';
  if ((user as any).name) {
    name = (user as any).name;
  } else if ((user as any).first_name || (user as any).firstName || (user as any).last_name || (user as any).lastName) {
    name = ((user as any).first_name || (user as any).firstName || '') + ' ' + ((user as any).last_name || (user as any).lastName || '');
  } else if ((user as any).email) {
    name = (user as any).email;
  }
  
  if (!name || name.trim().length < 2) {
    return '. .';
  }
  
  // Extract initials
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] || '').toUpperCase() + (parts[parts.length - 1][0] || '').toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Helper function to get color from string (for avatar background)
 * Simple hash-based color generation
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  const saturation = 65 + (hash % 20); // 65-85%
  const lightness = 45 + (hash % 15); // 45-60%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

