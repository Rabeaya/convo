import type { ApiResponse } from './client';

export type LikeDetailsResourceRequest = {
  path_id: string;
  resource_id: string;
  app_instance_id: number;
  include_sub_resources?: number | null;
};

export type LikeDetailsConversationRequest = {
  conversation_uid: string;
};

export type ViewsNotAcknowledgedRequest = {
  path_id: string;
  resource_id: string;
  app_instance_id: number;
  include_sub_resources?: number | null;
};

/**
 * Likes API (Angular parity)
 * - Uses `/api/v1/likes` (method: getLikeDetails) for "People who like this" + viewed-by mode.
 * - Uses `/api/v1/views` (method: getUsersNotAcknowledgedPostYet) for ack-post "Not Viewed by".
 */
export const likesApi = {
  async getLikeDetailsForResource(req: LikeDetailsResourceRequest): Promise<ApiResponse<any>> {
    const res = await fetch('/api/v1/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ method: 'getLikeDetails', ...req }),
    });
    const data = await res.json();
    return { data, status: res.status };
  },

  async getLikeDetailsForConversation(req: LikeDetailsConversationRequest): Promise<ApiResponse<any>> {
    const res = await fetch('/api/v1/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ method: 'getLikeDetails', ...req }),
    });
    const data = await res.json();
    return { data, status: res.status };
  },

  async getUsersNotAcknowledged(req: ViewsNotAcknowledgedRequest): Promise<ApiResponse<any>> {
    const res = await fetch('/api/v1/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ method: 'getUsersNotAcknowledgedPostYet', ...req }),
    });
    const data = await res.json();
    return { data, status: res.status };
  },
};


