import { ApiResponse, type ApiError } from './client';

export interface GroupDirectoryItem {
  group_id: string;
  id?: string; // May be present after processing
  type?: string;
  access: 'PUBLIC' | 'PRIVATE' | 'SECRET';
  created_by?: string;
  created_by_name?: string;
  creation_date?: string;
  title: string;
  description?: string;
  members_can_invite?: number;
  members_can_leave?: number;
  join_requests_count?: number;
  revision?: number;
  group_status?: string;
  user_status?: string;
  user_role?: string;
  user_settings?: any;
  members_count?: number;
  _hint_this_user_action?: 'joined' | 'join' | 'pending' | 'request_to_join' | 'invite_members';
  _hint_this_user_is_in_group?: number;
  _hint_this_user_manages_group?: number;
  _hint_this_user_can_leave?: number;
  hide_from_feed?: number;
  notification_settings?: {
    mobile?: boolean;
    email?: boolean;
  };
  showSpinner?: boolean;
  [key: string]: any;
}

export interface GroupJoinRequest {
  group_id: string;
  user_id: string;
  user_name?: string;
  request_id?: string;
  [key: string]: any;
}

export interface GroupsDirectoryResponse {
  type: number;
  revisionNo?: number;
  data: {
    groups: GroupDirectoryItem[];
    group_join_requests?: GroupJoinRequest[];
  };
}

class GroupsDirectoryService {
  async getGroupsDirectory(accountDataRevisionNo?: number): Promise<ApiResponse<GroupsDirectoryResponse>> {
    const reqData: any = {
      method: 'getGroupsDirectory',
    };
    
    if (accountDataRevisionNo !== undefined) {
      reqData.account_data_revision_no = accountDataRevisionNo;
    }
    
    const response = await fetch('/api/v1/groups/directory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(reqData),
    });

    if (!response.ok) {
      let errorText = 'Failed to fetch groups directory';
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
        code: 'GROUPS_DIRECTORY_FETCH_ERROR',
        status: response.status,
      };
      throw error;
    }

    const data = await response.json();
    
    // Process response to match AngularJS structure
    // AngularJS does: response = response.data; then uses response.data.groups
    let processedData: GroupsDirectoryResponse;
    
    if (data.data) {
      processedData = data;
    } else if (data.type !== undefined) {
      processedData = data;
    } else {
      // Fallback structure
      processedData = {
        type: 1,
        data: {
          groups: Array.isArray(data) ? data : data.groups || [],
          group_join_requests: data.group_join_requests || [],
        },
      };
    }
    
    // Ensure all groups have id field (AngularJS uses group_id, but some code expects id)
    if (processedData.data && processedData.data.groups) {
      processedData.data.groups = processedData.data.groups.map(group => ({
        ...group,
        id: group.id || group.group_id,
      }));
    }

    return {
      data: processedData,
      status: response.status,
    };
  }
}

export const groupsDirectoryService = new GroupsDirectoryService();


