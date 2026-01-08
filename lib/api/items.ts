/**
 * Items API Service
 * 
 * Handles feed item operations: star, mute, delete, etc.
 * Migrated from AngularJS itemService.js
 * Exact 1:1 match with AngularJS API endpoints and payloads
 */

import { ApiResponse, type ApiError } from './client';

export class ItemsService {
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
  async moveToTrash(appInstanceId: number, resourceId: string): Promise<ApiResponse<any>> {
    const requestData = {
      method: 'moveToTrash',
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
        throw new Error(`Failed to move post to trash: ${response.statusText}`);
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
  async deletePermanently(appInstanceId: number, resourceId: string): Promise<ApiResponse<any>> {
    const requestData = {
      method: 'deletePermanently',
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
        throw new Error(`Failed to delete post permanently: ${response.statusText}`);
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
}

export const itemsService = new ItemsService();

