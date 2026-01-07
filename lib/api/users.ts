/**
 * Users API Service
 * 
 * Handles user-related API calls
 * Migrated from AngularJS Users service
 */

import type { ApiResponse } from './client';
import type { User } from './auth';

export interface UsersResponse {
  users: Record<string, User>;
}

export class UsersService {
  /**
   * Get users list
   * Note: Users are typically included in feed response, but this can be used for standalone fetching
   */
  async getUsers(): Promise<ApiResponse<UsersResponse>> {
    try {
      const response = await fetch('/api/v1/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        throw {
          message: errorData.error || 'Failed to fetch users',
          code: 'USERS_FETCH_ERROR',
          status: response.status,
        };
      }

      const data = await response.json();
      return {
        data: data as UsersResponse,
        status: response.status,
      };
    } catch (error) {
      throw error;
    }
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
  size: string = '48x48',
  servicesHost: string =
    typeof window !== 'undefined'
      ? (window as any).servicesHost || 'app14.convodev.net'
      : 'app14.convodev.net'
): string {
  const PROFILE_IMAGE_TYPE_SYSTEM = 2;
  const PROFILE_IMAGE_TYPE_CUSTOM = 1;
  const PROFILE_IMAGE_TYPE_DEFAULT = 0;

  const host = servicesHost || 'app14.convodev.net';
  const baseUrl = `https://${host}/api/v1/files/`;

  const typeNum = Number(profileImageType);
  // Loose check is intentional: backend sometimes sends "0" as a string.
  const versionIsZero = profileImageVersion == 0;

  if (userId && typeNum === PROFILE_IMAGE_TYPE_SYSTEM) {
    return baseUrl + `user-images/system-user/thumbnails/system-user-thumbnail-${size}.png`;
  }
  
  // Default user image if no userId, or profileImageType is 0, or profileImageVersion is 0
  if (!userId || typeNum === PROFILE_IMAGE_TYPE_DEFAULT || profileImageVersion == null || versionIsZero) {
    return baseUrl + `user-images/default-user/thumbnails/default-user-thumbnail-${size}.png`;
  }
  
  if (typeNum === PROFILE_IMAGE_TYPE_CUSTOM) {
    return baseUrl + `user-images/${userId}/thumbnails/${userId}-thumbnail-${size}-${profileImageVersion}.jpg`;
  }

  // Fallback to default
  return baseUrl + `user-images/default-user/thumbnails/default-user-thumbnail-${size}.png`;
}

/**
 * Helper function to get user initials from name
 */
export function getUserInitials(user: User | null | undefined): string {
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
  const saturation = 60 + (hash % 20); // 60-80%
  const lightness = 50 + (hash % 15); // 50-65%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

