/**
 * Users API Service
 * 
 * Handles user-related API calls
 * Migrated from AngularJS Users service
 */

import type { ApiResponse } from './client';
import type { User } from './auth';

export interface UsersResponse {
  users_data?: User[];
  users?: Record<string, User>;
  account_data_revision_number?: number;
}

export interface UserListItem {
  id: string;
  label: string;
  formattedlabel: string;
  labelisemail?: boolean;
  labelisphone?: boolean;
  type?: 'USER' | 'GROUP' | 'CONTACT';
  imgUrl?: string;
  classes?: string;
  isGuestUser?: boolean;
  status?: string;
  rank?: number;
}

export class UsersService {
  /**
   * Get users list
   * Matches AngularJS Users.getUsers() -> serverComm.getx('users')
   * Returns array of users (matches AngularJS usersArray)
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

  /**
   * Get publishable users (for @mentions)
   * Matches AngularJS Users.getPublishableUsers()
   */
  async getPublishableUsers(): Promise<User[]> {
    const response = await this.getUsers();
    if (response.data.users_data) {
      // Filter publishable users (matches AngularJS logic)
      return response.data.users_data.filter((user: any) => user.publishable && user.status !== 'INVITED');
    }
    return [];
  }

  /**
   * Get searchable users
   * Matches AngularJS Users.getSearchableUsers()
   */
  async getSearchableUsers(): Promise<User[]> {
    const response = await this.getUsers();
    if (response.data.users_data) {
      // Filter searchable users (matches AngularJS logic)
      return response.data.users_data.filter((user: any) => user.searchable);
    }
    return [];
  }
}

export const usersService = new UsersService();

/**
 * Helper function to get user profile image URL
 * Matches AngularJS userImgUrl filter exactly
 * Uses config.AWS_FILE_DIR_BASE pattern: "https://{servicesHost}/api/v1/files/"
 */
export function getUserProfileImageUrl(
  userId: string | undefined,
  profileImageType: number | string | undefined,
  profileImageVersion: number | string | undefined,
  size: string = '48x48',
  servicesHost?: string,
  userSerialNo?: number
): string {
  const PROFILE_IMAGE_TYPE_SYSTEM = 2;
  const PROFILE_IMAGE_TYPE_CUSTOM = 1;
  const PROFILE_IMAGE_TYPE_DEFAULT = 0;

  // AngularJS receives these as ints from Users service and as strings from Feed service.
  // It compares with loose equality; normalize to match behavior.
  const typeNum = profileImageType === undefined || profileImageType === null ? NaN : Number(profileImageType);
  const versionNum = profileImageVersion === undefined || profileImageVersion === null ? NaN : Number(profileImageVersion);

  // Get servicesHost from window or use default (matches AngularJS config.AWS_FILE_DIR_BASE)
  const host = servicesHost || 
    (typeof window !== 'undefined' ? (window as any).servicesHost : undefined) || 
    'app14.convodev.net';
  
  // Base URL matches AngularJS: config.AWS_FILE_DIR_BASE = "https://{servicesHost}/api/v1/files/"
  let baseUrl = `https://${host}/api/v1/files/`;
  
  // For load balancing (matches AngularJS getLoadBalancedAwsFileDirBase)
  // Note: AngularJS uses this for userSerialNo, but we'll use baseUrl for now
  // if (userSerialNo !== undefined) {
  //   baseUrl = config.getLoadBalancedAwsFileDirBase(userSerialNo);
  // }

  // Handle profile image type (matches AngularJS userImgUrl filter exactly)
  if (userId && (typeNum === PROFILE_IMAGE_TYPE_SYSTEM || String(profileImageType) === '2')) {
    return baseUrl + `user-images/system-user/thumbnails/system-user-thumbnail-${size}.png`;
  }
  
  // Default user image if no userId, or profileImageType is 0, or profileImageVersion is 0
  // Note: AngularJS checks profileImageVersion == 0 (loose equality, so string "0" also matches)
  if (!userId || 
      typeNum === PROFILE_IMAGE_TYPE_DEFAULT || 
      String(profileImageType) === '0' ||
      !profileImageVersion || 
      versionNum === 0 ||
      String(profileImageVersion) === '0') {
    return baseUrl + `user-images/default-user/thumbnails/default-user-thumbnail-${size}.png`;
  }
  
  if (typeNum === PROFILE_IMAGE_TYPE_CUSTOM || String(profileImageType) === '1') {
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

