import type { ApiError, ApiResponse } from './client';
import type { User } from './auth';
import { resolveServicesHostString } from '@/lib/config/services-host';

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
  size: string = '48x48',
  servicesHost?: string,
  forUnAuthorizedOrigin?: boolean,
  userSerialNo?: number
): string {
  const PROFILE_IMAGE_TYPE_SYSTEM = 2;
  const PROFILE_IMAGE_TYPE_CUSTOM = 1;
  const PROFILE_IMAGE_TYPE_DEFAULT = 0;

  const host =
    servicesHost ||
    (typeof window !== 'undefined' ? (window as any).servicesHost : undefined) ||
    resolveServicesHostString({ allowWindow: true });

  // Angular (config.js.tpl) defaults to:
  // - AWS_FILE_DIR_BASE: https://fs1.{host}/api/v1/files/
  // - AWS_FILE_DIR_BASE_FOR_NO_AUTH: https://{host}/api/v1/files/
  // - For custom user images, it can shard via getLoadBalancedAwsFileDirBase(userSerialNo)
  const baseUrl = host ? getFilesBaseUrl(host, !!forUnAuthorizedOrigin, userSerialNo) : '';
  const sizeToken = String(size || '48x48');
  // Angular UserProfileImage constants use "48x48" (not "48").
  // Some callers may pass "48"; normalize that to "48x48" for parity.
  const normalizedSize = sizeToken.includes('x') ? sizeToken : `${sizeToken}x${sizeToken}`;
  const normalizedUserId = normalizeUserIdForUserImages(userId);

  const typeNum = Number(profileImageType);
  // Loose check is intentional: backend sometimes sends "0" as a string.
  const versionIsZero = profileImageVersion == 0;

  if (normalizedUserId && typeNum === PROFILE_IMAGE_TYPE_SYSTEM) {
    return `${baseUrl}user-images/system-user/thumbnails/system-user-thumbnail-${normalizedSize}.png`;
  }
  
  // Default user image if no userId, or profileImageType is 0, or profileImageVersion is 0
  if (!normalizedUserId || typeNum === PROFILE_IMAGE_TYPE_DEFAULT || profileImageVersion == null || versionIsZero) {
    return `${baseUrl}user-images/default-user/thumbnails/default-user-thumbnail-${normalizedSize}.png`;
  }
  
  if (typeNum === PROFILE_IMAGE_TYPE_CUSTOM) {
    // Angular userImgUrlFilter uses the userId "as-is" (often "usr-...") for both directory and filename.
    // It also shards the host using userSerialNo when available.
    const customBaseUrl = host ? getFilesBaseUrl(host, !!forUnAuthorizedOrigin, userSerialNo) : baseUrl;
    return `${customBaseUrl}user-images/${normalizedUserId}/thumbnails/${normalizedUserId}-thumbnail-${normalizedSize}-${profileImageVersion}.jpg`;
  }

  // Fallback to default
  return `${baseUrl}user-images/default-user/thumbnails/default-user-thumbnail-${normalizedSize}.png`;
}

function normalizeUserIdForUserImages(userId: string | undefined): string | undefined {
  if (!userId) return undefined;
  const raw = String(userId).trim();
  if (!raw) return undefined;
  return raw;
}

function getFilesBaseUrl(host: string, forUnAuthorizedOrigin: boolean, fileSerialNo?: number): string {
  const apiVersion = 'v1';

  if (forUnAuthorizedOrigin) {
    return `https://${host}/api/${apiVersion}/files/`;
  }

  const num =
    Number(process.env.NEXT_PUBLIC_AWS_FILE_DIR_NUM_SUBDOMAINS) ||
    // Matches typical non-dev config in Angular `config.js.tpl`
    10;

  // Angular: Math.abs((serial % num) - num) => yields 1..num, in reverse order.
  const shard =
    typeof fileSerialNo === 'number' && Number.isFinite(fileSerialNo)
      ? Math.abs((fileSerialNo % num) - num) || 1
      : 1;

  return `https://fs${shard}.${host}/api/${apiVersion}/files/`;
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

