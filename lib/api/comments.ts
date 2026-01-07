/**
 * Comments API Service
 * 
 * Strict 1:1 migration from AngularJS commentsService.js
 * Matches exact API endpoints, payloads, and response handling
 */

import { ApiResponse, type ApiError } from './client';

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
  summary?: string;
  creation_timestamp: number;
  update_timestamp: number;
  update_kind: number; // 0 = created, 1 = edited, 2 = deleted, 3 = replied
  like_info: {
    liked_by: string | null;
    liked_by_me: boolean;
    likes_count: number;
    like_timestamp: number;
  };
  files?: Array<{
    file_id: string;
    name: string;
    type: string;
    thumbnail_name?: string;
    original_name?: string;
    file_format?: string;
    width?: number;
    height?: number;
    size?: number;
    storage_version?: number;
    origional_file?: any[];
    preLocalData?: string;
    isDefaultThumbnail?: boolean;
  }>;
  links?: Array<{
    source: string;
    url_to_resolve?: string;
    user_dismissed_resolved_url?: boolean;
    linkInfo?: any;
  }>;
  resource_link?: {
    resource_path: {
      hierarchy: Array<{
        uid: string;
        type: string;
        title?: string;
      }>;
    };
    collaboration_info?: {
      replied_to_comment_id?: string;
      replied_to_user_id?: string;
      parent_resource_index: number;
      snippet_data?: any;
      on_comment_attachment?: boolean;
    };
  };
  is_posting?: boolean;
  posting_failed?: boolean;
  thread_root_comment_id?: string;
  _unread?: boolean;
  is_editing?: boolean;
}

export interface CommentsData {
  comments: Comment[];
  total_comments: number;
}

export interface GetCommentsRequest {
  authToken: string;
  userID: string;
  accountID: string;
  feed_id?: string | null;
  resource_id: string;
  path_id: string;
  app_instance_id: number;
  offset?: number;
  limit?: number;
  all?: boolean;
}

export interface GetCommentsResponse {
  discussions_counts: Record<string, number>;
  comments: Comment[];
  users?: Record<string, any>;
  groups?: Record<string, any>;
}

export interface EditCommentRequest {
  method: 'updateComment';
  conversation_uid: string;
  citem_uid: string;
  comment_text: string;
  resource_id: string;
  app_instance_id: number;
  collaboration_info: {
    snippet_data?: any;
    parent_resource_index: number;
    replied_to_comment_id?: string;
    replied_to_user_id?: string;
    on_comment_attachment?: boolean;
  };
  files?: Array<{
    name: string;
    size: number;
    type: string;
    file_name_id?: string;
    file_id?: string;
  }>;
  url_to_resolve?: string;
  user_dismissed_resolved_url?: boolean;
}

export interface DeleteCommentRequest {
  method: 'deleteComment';
  conversation_uid: string;
  resource_id: string;
  app_instance_id: number;
}

export interface PostCommentRequest {
  method: 'addComment';
  comment_text: string;
  feed_id?: string | null;
  resource_id: string;
  resource_type?: string;
  conversation_uid: string;
  citem_uid?: string;
  app_instance_id: number;
  resource_link?: {
    resource_path?: any;
    collaboration_info?: {
      snippet_data?: any;
      replied_to_comment_id?: string;
      replied_to_user_id?: string;
      parent_resource_index?: number;
      on_comment_attachment?: any;
    } | null;
  } | {
    collaboration_info: null;
  };
  files?: Array<{
    name: string;
    size: number;
    type: string;
    file_name_id?: string;
    file_id?: string;
  }>;
  url_to_resolve?: string;
  user_dismissed_resolved_url?: boolean;
}

export class CommentsService {
  /**
   * Get comments for a resource
   * Matches AngularJS getComments_newApi signature exactly
   * 
   * @param feedId - Can be null
   * @param resourceId - Resource ID
   * @param appInstanceId - App instance ID
   * @param fetchFromServerIfNotAvailableLocally - If true, fetch from server
   * @param offset - Starting index (0-based)
   * @param limit - Number of comments to fetch (null = all)
   */
  async getComments_newApi(
    feedId: string | null,
    resourceId: string,
    appInstanceId: number,
    fetchFromServerIfNotAvailableLocally: boolean,
    offset: number = 0,
    limit: number | null = null,
    authToken?: string,
    userId?: string,
    accountId?: string
  ): Promise<ApiResponse<CommentsData>> {
    if (!authToken || !userId || !accountId) {
      throw new Error('Authentication required');
    }

    const noLimit = limit === undefined || limit === null;

    // Build request data matching AngularJS exactly
    const requestData: any = {
      authToken: authToken,
      userID: userId,
      accountID: accountId,
      resource_id: resourceId,
      path_id: resourceId,
      app_instance_id: appInstanceId,
    };

    // Include feed_id only if it's not null/undefined
    if (feedId !== null && feedId !== undefined) {
      requestData.feed_id = feedId;
    }

    // Set all, offset, or limit based on AngularJS logic
    if (offset === 0 && noLimit) {
      requestData.all = true;
    } else {
      if (offset !== undefined && offset !== null) {
        requestData.offset = offset;
      }
      if (limit !== undefined && limit !== null) {
        requestData.limit = limit;
      }
    }

    try {
      const response = await fetch('/api/v1/conversations/fetchDiscussions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      const responseText = await response.text();
      let res: GetCommentsResponse;
      
      try {
        res = JSON.parse(responseText);
      } catch (e) {
        console.error('Non-JSON response from fetchDiscussions:', responseText.substring(0, 500));
        throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        console.error('FetchDiscussions API error:', {
          status: response.status,
          statusText: response.statusText,
          data: res,
          requestData: requestData,
        });
        throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText} - ${(res as any).error || (res as any).message || JSON.stringify(res)}`);
      }

      // Transform response to match AngularJS structure
      const commentsData: CommentsData = {
        comments: res.comments || [],
        total_comments: res.discussions_counts?.[resourceId] || res.comments?.length || 0,
      };

      return {
        data: commentsData,
        status: response.status,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a single comment (AngularJS: Comments.getComment)
   * - First tries server fetch (via fetchDiscussions) and then searches returned list.
   */
  async getComment(
    feedId: string | null,
    resourceId: string,
    appInstanceId: number,
    commentId: string,
    authToken: string,
    userId: string,
    accountId: string
  ): Promise<ApiResponse<Comment | null>> {
    const res = await this.getComments_newApi(feedId, resourceId, appInstanceId, true, 0, null, authToken, userId, accountId);
    const found = (res.data.comments || []).find((c) => c.uid == commentId) || null;
    return { data: found, status: res.status };
  }

  /**
   * Edit a comment
   * Matches AngularJS editComment signature exactly
   */
  async editComment(
    conversationUID: string,
    citem_uid: string,
    commentText: string,
    resourceId: string,
    appInstanceId: number,
    attachContext: boolean,
    snippetData: any | null,
    onCommentAttachment: boolean | null,
    attachedFiles: { serverData: any[]; data: any[] } | null,
    link: any | null,
    commentData: Comment
  ): Promise<ApiResponse<any>> {

    const collaboration_info: EditCommentRequest['collaboration_info'] = {
      parent_resource_index: 0,
    };

    // Preserve replied_to information if it exists
    if (commentData.resource_link?.collaboration_info?.replied_to_comment_id) {
      collaboration_info.replied_to_comment_id =
        commentData.resource_link.collaboration_info.replied_to_comment_id;
    }
    if (commentData.resource_link?.collaboration_info?.replied_to_user_id) {
      collaboration_info.replied_to_user_id =
        commentData.resource_link.collaboration_info.replied_to_user_id;
    }

    if (onCommentAttachment) {
      collaboration_info.on_comment_attachment = true;
    }

    if (attachContext && snippetData) {
      collaboration_info.snippet_data = snippetData;
    }

    const requestData: EditCommentRequest = {
      method: 'updateComment',
      conversation_uid: conversationUID,
      citem_uid: citem_uid,
      comment_text: commentText,
      resource_id: resourceId,
      app_instance_id: appInstanceId,
      collaboration_info,
    };

    if (attachedFiles?.serverData?.length) {
      requestData.files = attachedFiles.serverData;
    }

    if (link?.url_to_resolve) {
      requestData.url_to_resolve = link.url_to_resolve;
    }

    if (link?.user_dismissed_resolved_url) {
      requestData.user_dismissed_resolved_url = true;
    }

    try {
      const response = await fetch('/api/v1/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to edit comment: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data.data || data,
        status: response.status,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a comment
   * Matches AngularJS deleteComment signature exactly
   */
  async deleteComment(
    conversationUID: string,
    resourceId: string,
    appInstanceId: number
  ): Promise<ApiResponse<any>> {
    const requestData: DeleteCommentRequest = {
      method: 'deleteComment',
      conversation_uid: conversationUID,
      resource_id: resourceId,
      app_instance_id: appInstanceId,
    };

    try {
      const response = await fetch('/api/v1/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete comment: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data.data || data,
        status: response.status,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Post a new comment
   * Matches AngularJS postComment signature exactly
   */
  async postComment(
    commentText: string,
    feedId: string | null,
    resourceId: string,
    resourceType: string,
    appInstanceId: number,
    attachContext: boolean,
    snippetData: any | null,
    onCommentAttachment: boolean | null,
    attachedFiles: { serverData: any[]; data: any[] } | null,
    link: any | null,
    authToken: string,
    userId: string,
    accountId: string,
    hierarchy?: Array<{ uid?: string; type?: string; title?: string; created_by?: string; version?: string }>,
    collaborationInfo?: { replied_to_comment_id?: string; replied_to_user_id?: string; parent_resource_index?: number } | null,
    replyEventData?: { citem_uid: string; from_user: string } | null,
    conversationUID?: string
  ): Promise<ApiResponse<any>> {
    // Generate conversation UID if not provided (matches AngularJS: utils.generateUniqueId)
    const convUid = conversationUID || this.generateUniqueId();

    // Simple comment (no snippet) - matches AngularJS else branch exactly
    // Construct resource_path from hierarchy if available
    // AngularJS always includes resource_path even when collaboration_info is null
    let resourcePath: any = null;
    if (hierarchy && hierarchy.length > 0) {
      // Build resource_path matching AngularJS structure
      const firstHierarchyItem = hierarchy[0];
      resourcePath = {
        app_instance: {
          uid: appInstanceId,
          title: firstHierarchyItem.title || '',
          type: "APPINSTANCE",
          data: '',
          created_by: firstHierarchyItem.created_by || '',
          version: '-1',
        },
        hierarchy: hierarchy.map((item: any) => ({
          uid: item.uid || resourceId,
          type: item.type || resourceType || '',
          title: item.title || '',
          version: item.version || '-1',
          data: null,
          created_by: item.created_by || '',
        })),
      };
    } else {
      // If no hierarchy, create minimal structure
      resourcePath = {
        app_instance: {
          uid: appInstanceId,
          type: "APPINSTANCE",
        },
        hierarchy: [{
          uid: resourceId,
          type: resourceType || '',
        }],
      };
    }

    const requestData: PostCommentRequest = {
      method: 'addComment',
      comment_text: commentText,
      feed_id: feedId || undefined,
      resource_id: resourceId,
      resource_type: resourceType || undefined,
      conversation_uid: convUid,
      // AngularJS sets citem_uid = conversationUID for addComment
      citem_uid: convUid,
      app_instance_id: appInstanceId,
      resource_link: {
        resource_path: resourcePath,
        // AngularJS sets collaboration_info to { parent_resource_index: 0 } when null
        collaboration_info: {
          parent_resource_index: 0,
        },
      },
    };

    // If snippetData exists, update resource_link structure (Angular: includes resource_path AND collaboration_info.snippet_data)
    if (snippetData) {
      requestData.resource_link = {
        collaboration_info: {
          snippet_data: snippetData.snippetData || snippetData,
          parent_resource_index: 0,
        },
        resource_path: resourcePath,
      };

      if (onCommentAttachment) {
        requestData.resource_link.collaboration_info!.on_comment_attachment = true;
      }
    }

    // Add replied_to info (matches AngularJS commentsService.postComment collaborationInfo handling)
    if (collaborationInfo && requestData.resource_link && requestData.resource_link.collaboration_info) {
      if (collaborationInfo.replied_to_comment_id) {
        requestData.resource_link.collaboration_info.replied_to_comment_id = collaborationInfo.replied_to_comment_id;
      }
      if (collaborationInfo.replied_to_user_id) {
        requestData.resource_link.collaboration_info.replied_to_user_id = collaborationInfo.replied_to_user_id;
      }
      if (typeof collaborationInfo.parent_resource_index === 'number') {
        requestData.resource_link.collaboration_info.parent_resource_index = collaborationInfo.parent_resource_index;
      }
    }

    // Reply button behavior: replyEventData overrides collaboration_info ONLY in non-snippet branch (matches AngularJS)
    // For snippet replies, Angular uses collaborationInfo (not replyEventData) so we preserve snippet_data.
    if (replyEventData && requestData.resource_link && !snippetData) {
      requestData.resource_link.collaboration_info = {
        parent_resource_index: 0,
        replied_to_comment_id: replyEventData.citem_uid,
        replied_to_user_id: replyEventData.from_user,
      };
    }

    // Add files if provided
    if (attachedFiles && attachedFiles.serverData && attachedFiles.serverData.length > 0) {
      requestData.files = attachedFiles.serverData.map((file: any) => ({
        name: file.name || file.file_name,
        size: file.size,
        type: file.type || file.file_type,
        file_name_id: file.file_name_id,
        file_id: file.file_id,
      }));
    }

    // Add link if provided
    if (link) {
      requestData.url_to_resolve = link.url_to_resolve;
      requestData.user_dismissed_resolved_url = link.user_dismissed_resolved_url;
    }

    try {
      const response = await fetch('/api/v1/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      });

      const responseText = await response.text();
      let data;
      
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        // If response is not JSON, log it for debugging
        console.error('Non-JSON response from comments API:', responseText);
        throw new Error(`Failed to post comment: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        console.error('Comments API error response:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          requestData: requestData,
        });
        throw new Error(`Failed to post comment: ${response.status} ${response.statusText} - ${data.error || data.message || JSON.stringify(data)}`);
      }

      return {
        data: data.data || data,
        status: response.status,
      };
    } catch (error) {
      console.error('Error posting comment:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID (matches AngularJS utils.generateUniqueId)
   */
  private generateUniqueId(): string {
    return 'cnv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

export const commentsService = new CommentsService();

