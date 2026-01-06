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
  account_revision_number?: number;
  account_user_revision_number?: number;
  account_contacts_revision_number?: number;
}

class FeedService {
  private getFeedBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const servicesHost = (window as any).servicesHost || 'app14.convodev.net';
      // FEED_SERVICES_VERSION: In dev/staging it's "2022092701", in production it's "20150918"
      // We'll check the environment or use a default. For now, use the staging version as it's more recent
      // This should ideally come from a config file or environment variable
      const feedServicesVersion = '2022092701'; // Default to staging version, can be overridden
      return `https://${servicesHost}/index_services_${feedServicesVersion}/scrybe/`;
    }
    return '';
  }

  async fetchFeed(request: FeedFetchRequest): Promise<ApiResponse<FeedFetchResponse>> {
    const url = this.getFeedBaseUrl();
    if (!url) {
      throw new Error('Feed base URL not available');
    }

    const response = await fetch(`${url}feed/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error: ApiError = {
        message: errorText || 'Failed to fetch feed',
        code: 'FEED_FETCH_ERROR',
        status: response.status,
      };
      throw error;
    }

    const data = await response.json();
    return {
      data,
      status: response.status,
    };
  }

  async pollFeed(request: FeedPollRequest): Promise<ApiResponse<FeedPollResponse>> {
    const url = this.getFeedBaseUrl();
    if (!url) {
      throw new Error('Feed base URL not available');
    }

    const response = await fetch(`${url}feed/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error: ApiError = {
        message: errorText || 'Failed to poll feed',
        code: 'FEED_POLL_ERROR',
        status: response.status,
      };
      throw error;
    }

    const data = await response.json();
    return {
      data,
      status: response.status,
    };
  }
}

export const feedService = new FeedService();

