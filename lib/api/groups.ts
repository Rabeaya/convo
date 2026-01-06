import { ApiResponse, type ApiError } from './client';

export interface Group {
  id: string;
  title?: string; // May be missing in initial response
  access: 'PUBLIC' | 'PRIVATE' | 'SECRET';
  isListable?: boolean;
  isMember?: boolean;
  isOwner?: boolean;
  isPublishable?: boolean;
  isSearchable?: boolean;
  isHidden?: boolean;
  is_admin?: boolean;
  membersCanInvite?: number;
  revision?: number;
  this_user_can_leave?: boolean;
  type?: string;
  created_by?: string | null;
  pinned_at?: number | null;
  unreadCount?: number;
  rank?: number; // relevancy rank
  // Additional fields that might be in response
  [key: string]: any;
}

export interface GroupsResponse {
  groups: Group[];
  account_data_revision_number: number;
}

class GroupsService {
  async getGroups(): Promise<ApiResponse<GroupsResponse>> {
    // Use Next.js API route as proxy
    const response = await fetch('/api/v1/groups', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      let errorText = 'Failed to fetch groups';
      try {
        const errorData = await response.json();
        errorText = errorData.error || errorData.message || errorText;
      } catch {
        try {
          errorText = await response.text();
        } catch {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
        }
      }
      
      const error: ApiError = {
        message: errorText,
        code: 'GROUPS_FETCH_ERROR',
        status: response.status,
      };
      throw error;
    }

    let data;
    try {
      const rawData = await response.json();
      
      // Debug logging
      if (typeof window !== 'undefined') {
        console.log('Groups Service - Raw Response:', rawData);
        console.log('Groups Service - Raw Response Keys:', Object.keys(rawData));
        console.log('Groups Service - Raw Response Type:', typeof rawData);
        console.log('Groups Service - Is Array?', Array.isArray(rawData));
      }
      
      // Handle different response structures
      // AngularJS does: response = response.data; then uses response.groups
      // So the backend returns: { data: { groups: [...], account_data_revision_number: ... } }
      // The Next.js API route might return it as-is or unwrapped
      
      // First, check if rawData itself is an array (unlikely but possible)
      if (Array.isArray(rawData)) {
        data = { groups: rawData, account_data_revision_number: 0 };
        if (typeof window !== 'undefined') {
          console.log('Groups Service - Raw data is array, wrapped it');
        }
      } else if (rawData.data) {
        // Backend wrapped in data property
        if (rawData.data.groups) {
          // Standard structure: { data: { groups: [...], account_data_revision_number: ... } }
          data = rawData.data;
          if (typeof window !== 'undefined') {
            console.log('Groups Service - Unwrapped from data.groups');
          }
        } else if (Array.isArray(rawData.data)) {
          // data is directly an array
          data = { groups: rawData.data, account_data_revision_number: rawData.account_data_revision_number || 0 };
          if (typeof window !== 'undefined') {
            console.log('Groups Service - data property is array');
          }
        } else {
          // data exists but no groups - use data as is
          data = rawData.data;
          if (typeof window !== 'undefined') {
            console.log('Groups Service - Using data property (no groups found)');
          }
        }
      } else if (rawData.groups) {
        // Already unwrapped: { groups: [...], account_data_revision_number: ... }
        data = rawData;
        if (typeof window !== 'undefined') {
          console.log('Groups Service - Using raw response (has groups property)');
        }
      } else {
        // Fallback: use rawData and try to find groups in any property
        data = rawData;
        if (typeof window !== 'undefined') {
          console.log('Groups Service - Using raw response (fallback)');
          // Try to find groups in any property
          for (const key of Object.keys(rawData)) {
            const value = rawData[key];
            if (Array.isArray(value)) {
              console.log(`Groups Service - Found array in key "${key}" with ${value.length} items`);
              // If we find an array and don't have groups yet, check if it looks like groups
              if (!data.groups && value.length > 0 && value[0] && typeof value[0] === 'object' && 'id' in value[0]) {
                console.log(`Groups Service - Array in "${key}" looks like groups, using it`);
                data = { groups: value, account_data_revision_number: rawData.account_data_revision_number || 0 };
              }
            } else if (value && typeof value === 'object' && 'groups' in value) {
              console.log(`Groups Service - Found groups in key "${key}"`);
              data = value;
            }
          }
        }
      }
      
      // Debug logging
      if (typeof window !== 'undefined') {
        console.log('Groups Service - Processed Data:', data);
        console.log('Groups Service - Processed Data Keys:', Object.keys(data));
        console.log('Groups Service - Groups Array:', data.groups);
        console.log('Groups Service - Groups Count:', data.groups?.length);
        console.log('Groups Service - Groups Is Array?', Array.isArray(data.groups));
        if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
          console.log('Groups Service - First Group:', data.groups[0]);
          console.log('Groups Service - First Group Keys:', Object.keys(data.groups[0]));
          console.log('Groups Service - First Group Title:', data.groups[0].title);
        } else {
          console.error('Groups Service - NO GROUPS FOUND!');
          console.error('Groups Service - Data structure:', JSON.stringify(data, null, 2));
        }
      }
    } catch (parseError) {
      const error: ApiError = {
        message: 'Invalid JSON response from groups API',
        code: 'GROUPS_PARSE_ERROR',
        status: response.status,
      };
      throw error;
    }

    return {
      data,
      status: response.status,
    };
  }
}

export const groupsService = new GroupsService();

