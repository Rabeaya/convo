/**
 * Items API Service
 * 
 * Handles feed item operations: star, mute, delete, etc.
 * Migrated from AngularJS itemService.js
 * Exact 1:1 match with AngularJS API endpoints and payloads
 */

import { ApiResponse, type ApiError } from './client';

export class ItemsService {
  // Angular constants (itemService.js)
  static canEdit = 7;
  static canComment = 3;
  static canView = 1;

  /**
   * Star a post
   * Matches AngularJS itemService.starPost
   */
  async starPost(appInstanceId: number, resourceId: string): Promise<ApiResponse<any>> {
    const requestData = {
      method: 'star',
      app_instance_id: appInstanceId,
      resource_id: resourceId,
    };

    try {
      const response = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to star post: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : 'Failed to star post',
        code: 'STAR_POST_ERROR',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * Unstar a post
   * Matches AngularJS itemService.unStarPost
   */
  async unStarPost(appInstanceId: number, resourceId: string): Promise<ApiResponse<any>> {
    const requestData = {
      method: 'unstar',
      app_instance_id: appInstanceId,
      resource_id: resourceId,
    };

    try {
      const response = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to unstar post: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : 'Failed to unstar post',
        code: 'UNSTAR_POST_ERROR',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * Mute notifications for a post
   * Matches AngularJS itemService.mutePost
   */
  async mutePost(appInstanceId: number, resourceId: string): Promise<ApiResponse<any>> {
    const requestData = {
      method: 'mute',
      app_instance_id: appInstanceId,
      resource_id: resourceId,
    };

    try {
      const response = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to mute post: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : 'Failed to mute post',
        code: 'MUTE_POST_ERROR',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * Unmute notifications for a post
   * Matches AngularJS itemService.unmutePost
   */
  async unmutePost(appInstanceId: number, resourceId: string): Promise<ApiResponse<any>> {
    const requestData = {
      method: 'unmute',
      app_instance_id: appInstanceId,
      resource_id: resourceId,
    };

    try {
      const response = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to unmute post: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : 'Failed to unmute post',
        code: 'UNMUTE_POST_ERROR',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * Move post to trash
   * Matches AngularJS itemService.moveToTrash
   */
  async moveToTrash(
    appInstanceId: number, 
    resourceId: string,
    authToken?: string,
    userID?: string,
    accountID?: string
  ): Promise<ApiResponse<any>> {
    const requestData: any = {
      method: 'moveToTrash',
      app_instance_id: appInstanceId,
      resource_id: resourceId,
    };

    // Include auth fields if provided (matches AngularJS serverComm.post pattern)
    if (authToken) requestData.authToken = authToken;
    if (userID) requestData.userID = userID;
    if (accountID) requestData.accountID = accountID;

    try {
      const response = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        throw new Error(`Failed to move post to trash: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : 'Failed to move post to trash',
        code: 'MOVE_TO_TRASH_ERROR',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * Delete post permanently
   * Matches AngularJS itemService.deletePermanently
   */
  async deletePermanently(
    appInstanceId: number, 
    resourceId: string,
    authToken?: string,
    userID?: string,
    accountID?: string
  ): Promise<ApiResponse<any>> {
    const requestData: any = {
      method: 'deletePermanently',
      app_instance_id: appInstanceId,
      resource_id: resourceId,
    };

    // Include auth fields if provided (matches AngularJS serverComm.post pattern)
    if (authToken) requestData.authToken = authToken;
    if (userID) requestData.userID = userID;
    if (accountID) requestData.accountID = accountID;

    try {
      const response = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        throw new Error(`Failed to delete post permanently: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : 'Failed to delete post permanently',
        code: 'DELETE_PERMANENTLY_ERROR',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * Restore post from trash
   * Matches AngularJS itemService.restorePost
   */
  async restorePost(appInstanceId: number, resourceId: string): Promise<ApiResponse<any>> {
    const requestData = {
      method: 'restore',
      app_instance_id: appInstanceId,
      resource_id: resourceId,
    };

    try {
      const response = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to restore post: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : 'Failed to restore post',
        code: 'RESTORE_POST_ERROR',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * Update tags for a post
   * Matches AngularJS itemService.updateTags
   */
  async updateTags(
    feedId: string | null,
    tags: string | string[],
    appInstanceId: number,
    resourceId: string
  ): Promise<ApiResponse<any>> {
    const tagsStr = Array.isArray(tags) ? tags.join(',') : String(tags ?? '');
    const requestData: any = {
      method: 'updateTags',
      tags: tagsStr,
    };
    if (feedId) {
      requestData.feed_id = feedId;
    } else {
      requestData.app_instance_id = appInstanceId;
      requestData.resource_id = resourceId;
    }

    const response = await fetch('/api/v1/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestData),
    });
    const data = await response.json();
    return { data, status: response.status };
  }

  /**
   * Update sharing info for a post
   * Matches AngularJS itemService.updateSharingInfo
   */
  async updateSharingInfo(feedId: string | null, sharingInfo: any[], appInstanceId: number, resourceId: string): Promise<ApiResponse<any>> {
    const requestData: any = {
      method: 'updateSharingInfo',
      sharing_info: sharingInfo,
    };
    if (feedId) {
      requestData.feed_id = feedId;
    } else {
      requestData.app_instance_id = appInstanceId;
      requestData.resource_id = resourceId;
    }

    const response = await fetch('/api/v1/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestData),
    });
    const data = await response.json();
    return { data, status: response.status };
  }

  /**
   * Change permissions for a post
   * Matches AngularJS itemService.changePermissions
   * @param permissionValue - Permission value (canEdit=7, canComment=3, canView=1)
   * @param appInstanceId - App instance ID
   * @param resourceId - Resource ID
   * @param enableSharing - Enable sharing flag (optional, defaults to undefined to preserve current value)
   */
  async changePermissions(
    permissionValue: number,
    appInstanceId: number,
    resourceId: string,
    enableSharing?: boolean | undefined,
    authToken?: string,
    userID?: string,
    accountID?: string
  ): Promise<ApiResponse<any>> {
    const requestData: any = {
      method: 'changePermissions',
      app_instance_id: appInstanceId,
      resource_id: resourceId,
      permissions: permissionValue,
    };
    
    // Add auth fields if provided (required by backend)
    if (authToken) {
      requestData.authToken = authToken;
    }
    if (userID) {
      requestData.userID = userID;
    }
    if (accountID) {
      requestData.accountID = accountID;
    }
    
    // Only include enable_sharing if explicitly provided (matches Angular behavior)
    if (enableSharing !== undefined) {
      requestData.enable_sharing = enableSharing;
    }

    console.log('changePermissions API call:', {
      ...requestData,
      authToken: requestData.authToken ? `${requestData.authToken.substring(0, 10)}...` : 'missing',
    });

    const response = await fetch('/api/v1/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('changePermissions API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
        requestData: {
          ...requestData,
          authToken: requestData.authToken ? `${requestData.authToken.substring(0, 10)}...` : 'missing',
        },
      });
      throw new Error(`Failed to change permissions: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('changePermissions API success:', { status: response.status, data });
    return { data, status: response.status };
  }
}

export const itemsService = new ItemsService();

