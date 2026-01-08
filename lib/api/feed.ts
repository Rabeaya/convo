import { ApiResponse, type ApiError } from './client';
import type { User } from './auth';

export interface FeedItem {
  feed_id: string;
  app_instance_id: number;
  resource_id: string;
  resource_type: string;
  created_by: string;
  updated_by: string;
  created_date: string;
  last_modified_date: string;
  last_shared_timestamp: string;
  details: string;
  search_fragment?: string;
  data: any;
  hierarchy: Array<{ title: string; searched_title?: string }>;
  sharing_info: Array<{
    published_to: string;
    type: 'USER' | 'GROUP';
  }>;
  conversations_count: number;
  conversations?: Comment[];
  like_info: {
    liked_by: string | null;
    liked_by_me: boolean;
    likes_count: number;
    sub_res_like_count: number;
    like_timestamp: number;
  };
  starred: number;
  muted: number;
  deleted: string;
  action?: string;
  show_post_contents: number;
  hasFiles: string;
  attachment_count: number;
  viewData?: any;
  _hide?: boolean;
  _actions?: any;
}

export interface Comment {
  uid: string;
  citem_uid: string;
  app_instance_id: number;
  resource_id: string;
  from_user: string;
  comment_text: string;
  summary?: string;
  comment_text_less?: string;
  comment_text_less_snippet?: string;
  has_more_text?: boolean;
  has_more_text_snippet?: boolean;
  creation_timestamp: number;
  update_timestamp: number;
  update_kind: number;
  like_info: {
    liked_by: string | null;
    liked_by_me: boolean;
    likes_count: number;
    like_timestamp: number;
  };
  files?: any[];
  links?: any[];
  resource_link?: any;
  is_posting?: boolean;
  posting_failed?: boolean;
  thread_root_comment_id?: string;
}

export interface FeedFilter {
  description?: string;
  filters?: Array<{
    description: string;
    value: any[];
  }>;
  numberOfFilters?: number;
}

export interface FeedFetchRequest {
  authToken: string;
  userID: string;
  accountID: string;
  fromIndex: number;
  itemsCount: number;
  summaryParams?: any;
  sortBy: number;
  feedIDsWithTimestamp?: any;
  filter?: FeedFilter | null;
  isSearch?: boolean;
  includeChats?: boolean;
  includeDrafts?: boolean;
  applyHighlight?: boolean;
  postDisplayOption?: string;
  switchToAdminMode?: number;
}

export interface FeedFetchResponse {
  feed_items: FeedItem[];
  users: Record<string, User>;
  groups: Record<string, any>;
  pinned_items?: any[];
  account_revision_number?: number;
  account_user_revision_number?: number;
  account_contacts_revision_number?: number;
}

export interface FeedPollRequest {
  authToken: string;
  userID: string;
  accountID: string;
  filter?: FeedFilter | null;
  includeChats?: boolean;
  includeDrafts?: boolean;
  applyHighlight?: boolean;
  mark_notifications?: number;
  client?: string;
  postDisplayOption?: string;
  lastFeedPollTimestamp?: string;
  custom_filters?: any;
}

export interface FeedPollResponse {
  feed_items?: FeedItem[];
  filter_feed_items?: FeedItem[];
  feed_items_hidden_groups?: any[];
  users?: Record<string, User>;
  groups?: Record<string, any>;
  pinned_items?: any[];
  custom_filters?: any[];
  // Angular feedService.pollFeed sets/reads this field
  last_feed_poll_timestamp?: string;
  account_revision_number?: number;
  account_user_revision_number?: number;
  account_contacts_revision_number?: number;
}

class FeedService {
  /**
   * Fetch feed items
   * Uses Next.js API proxy to avoid CORS issues
   */
  async fetchFeed(request: FeedFetchRequest): Promise<ApiResponse<FeedFetchResponse>> {
    try {
      const response = await fetch('/api/v1/feed-proxy/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
      const error: ApiError = {
          message: errorData.error || 'Failed to fetch feed',
        code: 'FEED_FETCH_ERROR',
        status: response.status,
      };
      throw error;
    }

    const data = await response.json();
      
      // Ensure the response has the expected structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid feed response format');
      }

    return {
        data: data as FeedFetchResponse,
      status: response.status,
    };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        // Network error or CORS issue
        throw {
          message: 'Network error: Unable to connect to feed service. Please check your connection.',
          code: 'FEED_NETWORK_ERROR',
          status: 0,
        } as ApiError;
      }
      throw error;
    }
  }

  /**
   * Poll feed for new items
   * Uses Next.js API proxy to avoid CORS issues
   */
  async pollFeed(request: FeedPollRequest): Promise<ApiResponse<FeedPollResponse>> {
    try {
      const response = await fetch('/api/v1/feed-proxy/poll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
      const error: ApiError = {
          message: errorData.error || 'Failed to poll feed',
        code: 'FEED_POLL_ERROR',
        status: response.status,
      };
      throw error;
    }

    const data = await response.json();
      
      // Ensure the response has the expected structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid feed poll response format');
      }

    return {
        data: data as FeedPollResponse,
      status: response.status,
    };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        // Network error or CORS issue
        throw {
          message: 'Network error: Unable to connect to feed service. Please check your connection.',
          code: 'FEED_NETWORK_ERROR',
          status: 0,
        } as ApiError;
      }
      throw error;
    }
  }
}

export const feedService = new FeedService();

/**
 * Like Service
 * Handles like/unlike functionality for feed items and comments
 */
export class LikeService {
  /**
   * Like or unlike a feed item (resource)
   */
  async likeResource(
    feedId: string,
    resourceId: string,
    appInstanceId: number,
    action: 'like' | 'unlike',
    title: string,
    type: string
  ): Promise<ApiResponse<any>> {
    const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
    const API_VERSION = 'v1';

    const requestData = {
      feed_id: feedId,
      resource_id: resourceId,
      app_instance_id: appInstanceId,
      action: action,
      path_id: resourceId,
      path_names: `["${title}"]`,
      path_types: `["${type}"]`,
    };

    try {
      const response = await fetch(`/api/v1/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} resource: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Like or unlike a comment (conversation)
   */
  async likeConversation(
    conversationUid: string,
    resourceId: string,
    appInstanceId: number,
    action: 'like' | 'unlike'
  ): Promise<ApiResponse<any>> {
    const requestData = {
      conversation_id: conversationUid,
      action: action,
    };

    try {
      const response = await fetch(`/api/v1/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} conversation: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data,
        status: response.status,
      };
    } catch (error) {
      throw error;
    }
  }
}

export const likeService = new LikeService();

