'use client';

/**
 * Comment Item Component
 * 
 * Displays a single comment with threading support
 * Migrated from AngularJS cnv-comment directive
 * Exact 1:1 match with AngularJS implementation
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Comment } from '@/lib/api/feed';
import { User } from '@/lib/api/auth';
import { useFeedContext } from '@/lib/contexts/FeedContext';
import UserProfileImage from '@/components/common/UserProfileImage';
import LikeButton from './LikeButton';
import CommentDropdown from './CommentDropdown';
import CommentEditor from './CommentEditor';
import { likeService } from '@/lib/api/feed';
import { commentsService } from '@/lib/api/comments';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatDateAgo } from '@/lib/utils/dateFormat';
import CommentFileAttachments from './CommentFileAttachments';
import { promptModal } from '@/lib/utils/modal';
import { getFileExtension, getSmallFileIconClassByType } from '@/lib/utils/file-icons';
import CommentOnThisTooltip from '@/components/common/CommentOnThisTooltip';
import { clearNativeSelection, getSelectionDataWithin } from '@/lib/utils/text-selection';
import { limitHtmlText } from '@/lib/utils/html-truncate';

function ViewAllCommentsGap({ onClick }: { onClick: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 1000); // Angular: removes ng-hide after ~1000ms
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div
      className={`show-all-cont animate-bottom-up ${visible ? '' : 'ng-hide'}`}
      onClick={onClick}
    >
      View all comments
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  resourceId: string;
  appInstanceId: number;
  onReplyClick?: (commentId: string, fromUser: string) => void;
  onViewThread?: (collaborationInfo: any, currentCommentId: string, thread_root_comment_id?: string) => void;
  onHideThread?: (commentId?: string) => void;
  threadPlayback?: {
    active: boolean;
    currentlyPlayingSnippetForComment: string | null;
    isSourcePointer: boolean;
    isRepliedPointer: boolean;
    isThreadBPad: boolean;
    isThreadTPad: boolean;
    showViewAllButton: boolean;
  };
  isHiddenByThreadPlayback?: boolean;
  onRetryFailedPost?: (comment: Comment) => void;
  onDiscardFailedPost?: (commentId: string) => void;
  onCreateSnippetReply?: (
    snippetWrapper: any,
    collaborationInfo: { replied_to_comment_id?: string; replied_to_user_id?: string; parent_resource_index?: number }
  ) => void;
  // Mirrors Angular: clicking a non-comment snippet calls Feed:selectText
  onPostSnippetPlayback?: (snippetData: any, commentId: string) => void;
  onCommentUpdated?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string, opts?: { hardRemove?: boolean }) => void;
  relatedPermissions?: {
    canComment: boolean;
  };
}

// Helper function to get user name from users map
function getUserName(users: Record<string, User>, userId: string): string {
  const user = users[userId];
  if (!user) return 'Unknown';
  const name = (user as any).name || 
               ((user as any).first_name || (user as any).firstName || '') + ' ' + 
               ((user as any).last_name || (user as any).lastName || '').trim();
  return name.trim() || userId;
}

// Helper function to format date - matches AngularJS dateAgo filter
// Shows "replied" if update_kind === 3 and update_timestamp === creation_timestamp
// Shows "edited" if update_timestamp > creation_timestamp
// Otherwise shows relative time like "18h" or absolute date like "Sep 16, 2024"

export default function CommentItem({ 
  comment, 
  resourceId, 
  appInstanceId, 
  onReplyClick,
  onViewThread,
  onHideThread,
  threadPlayback,
  isHiddenByThreadPlayback = false,
  onRetryFailedPost,
  onDiscardFailedPost,
  onCreateSnippetReply,
  onPostSnippetPlayback,
  onCommentUpdated,
  onCommentDeleted,
  relatedPermissions = { canComment: true }
}: CommentItemProps) {
  const { users } = useFeedContext();
  const { user, loginData, account } = useAuthStore();
  const [localComment, setLocalComment] = useState(comment);
  const [isEditing, setIsEditing] = useState(false);
  const [showMore, setShowMore] = useState(false); // mirrors AngularJS $scope.showMore
  const commentInnerRef = useRef<HTMLDivElement>(null);
  const [selTooltip, setSelTooltip] = useState<{ portalTarget: HTMLElement; top: number; left: number; beginIndex: number; endIndex: number; text: string } | null>(null);

  // Keep localComment in sync with incoming prop updates (poll/load-more/edit/like merges).
  // Angular mutates a single object in its store; in React we mirror that by adopting newer/more-complete updates.
  useEffect(() => {
    setLocalComment((prev) => {
      if (!prev || prev.uid !== comment.uid) return comment;

      const prevUpdate = Number((prev as any).update_timestamp ?? (prev as any).creation_timestamp ?? 0);
      const nextUpdate = Number((comment as any).update_timestamp ?? (comment as any).creation_timestamp ?? 0);

      // If server says deleted, always adopt
      if ((comment as any).update_kind === 2) return { ...prev, ...comment };

      // Prefer newer updates
      if (Number.isFinite(nextUpdate) && Number.isFinite(prevUpdate) && nextUpdate > prevUpdate) {
        return { ...prev, ...comment };
      }

      // Otherwise merge without losing richer fields (common when feed item conversations are partial).
      const prevText = String((prev as any).comment_text || '');
      const nextText = String((comment as any).comment_text || '');

      const merged: any = { ...prev, ...comment };

      if (nextText.length < prevText.length) {
        merged.comment_text = prev.comment_text;
      }
      if (!merged.summary && (prev as any).summary) merged.summary = (prev as any).summary;
      if (!merged.comment_text_less && (prev as any).comment_text_less) merged.comment_text_less = (prev as any).comment_text_less;
      if (!merged.comment_text_less_snippet && (prev as any).comment_text_less_snippet) merged.comment_text_less_snippet = (prev as any).comment_text_less_snippet;
      if (merged.has_more_text == null && (prev as any).has_more_text != null) merged.has_more_text = (prev as any).has_more_text;
      if (merged.has_more_text_snippet == null && (prev as any).has_more_text_snippet != null) merged.has_more_text_snippet = (prev as any).has_more_text_snippet;

      // Preserve any local-only preview fields on files (preLocalData) when server omits them
      if (Array.isArray((prev as any).files) && Array.isArray((comment as any).files)) {
        const prevFiles: any[] = (prev as any).files;
        const nextFiles: any[] = (comment as any).files;
        merged.files = nextFiles.map((f, idx) => {
          const pf = prevFiles[idx];
          if (pf?.preLocalData && !f?.preLocalData) return { ...f, preLocalData: pf.preLocalData };
          return f;
        });
      }

      // Clear optimistic posting flags once server data arrives
      if ((prev as any).is_posting && !(comment as any).is_posting) {
        merged.is_posting = false;
        merged.posting_failed = false;
      }

      return merged;
    });
  }, [comment]);

  // Reposition selection tooltip on scroll (Angular keeps it visible and moves it)
  useEffect(() => {
    if (!selTooltip) return;
    const onScroll = () => {
      const root = commentInnerRef.current;
      const inner = root?.querySelector('.comment-inner') as HTMLElement | null;
      if (!inner) return;
      const data = getSelectionDataWithin(inner);
      if (!data) return;
      setSelTooltip((prev) =>
        prev
          ? {
              ...prev,
              top: data.rect.top + window.scrollY - 40,
              left: data.rect.left + window.scrollX + data.rect.width / 2,
            }
          : prev
      );
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousewheel', onScroll as any, { passive: true } as any);
    return () => {
      window.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('mousewheel', onScroll as any);
    };
  }, [selTooltip]);
  
  const currentUserId = (user as any)?.user_id || (user as any)?.userId;
  const isCurrentUser = currentUserId === localComment.from_user;
  // NOTE: Even if user is admin, Angular feed comments panel removes deleted comments by default in normal view.
  // Keep this for dropdown permissions only.
  const isAdminMode =
    (user as any)?.isAdminMode?.() ||
    (user as any)?.admin_mode === 1 ||
    (user as any)?.adminMode === 1 ||
    false;
  const hasOrigin = !!(localComment as any).origin;
  
  const isDeleted = localComment.update_kind === 2;
  // Angular default behavior: deleted comments are not shown in the comments panel.
  if (isDeleted) {
    return null;
  }
  const hasThread = !!localComment.resource_link?.collaboration_info?.replied_to_user_id && !!localComment.thread_root_comment_id;
  const creationTsNum = Number((localComment as any).creation_timestamp);
  const updateTsNum = Number((localComment as any).update_timestamp);
  const isEdited =
    Number.isFinite(updateTsNum) && Number.isFinite(creationTsNum)
      ? updateTsNum > creationTsNum
      : String((localComment as any).update_timestamp) > String((localComment as any).creation_timestamp);
  const isReplied =
    localComment.update_kind === 3 &&
    (Number.isFinite(updateTsNum) && Number.isFinite(creationTsNum)
      ? updateTsNum === creationTsNum
      : String((localComment as any).update_timestamp) === String((localComment as any).creation_timestamp));
  const isThreadPlaybackActive = !!threadPlayback?.active;
  // AngularJS toggles Hide thread based on per-comment flag set when replied-comment-pointer is applied.
  const isCurrentlyPlayingCommentSnippet = isThreadPlaybackActive && !!threadPlayback?.isRepliedPointer;

  // Angular sets $scope.showMore = true on Comments:highlightText
  useEffect(() => {
    if (threadPlayback?.active && threadPlayback.currentlyPlayingSnippetForComment === localComment.uid) {
      setShowMore(true);
    }
  }, [threadPlayback?.active, threadPlayback?.currentlyPlayingSnippetForComment, localComment.uid]);
  
  // Format timestamp - matches AngularJS dateAgo filter
  // Some optimistic/server comments can have missing or string timestamps; guard like Angular (which always shows something).
  const rawTs: any = (localComment as any).update_timestamp ?? (localComment as any).creation_timestamp;
  const tsNum = Number(rawTs);
  const timestampText = formatDateAgo(Number.isFinite(tsNum) ? tsNum : Date.now());

  // Comment truncation logic mirrors AngularJS:
  // - prefer `summary` if present
  // - else use `comment_text_less` (or snippet variant) when `has_more_text` is true
  const lessHtml = useMemo(() => {
    if (localComment.summary) return localComment.summary;
    // snippet variant if present
    const hasSnippet = !!localComment.resource_link?.collaboration_info?.snippet_data;

    // Angular outer gate: only uses *_less fields if has_more_text is true
    if (localComment.has_more_text) {
      if (hasSnippet) {
        if (localComment.comment_text_less_snippet) return localComment.comment_text_less_snippet;
        // Fallback: Angular initNewComment computes this via limitHtmlText(130) for snippet-comments
        const res = limitHtmlText(localComment.comment_text || '', 130, true) as any;
        return res?.htmlStr || localComment.comment_text || '';
      }
      if (localComment.comment_text_less) return localComment.comment_text_less;
      // Fallback: Angular initNewComment computes this via limitHtmlText(300)
      const res = limitHtmlText(localComment.comment_text || '', 300, true) as any;
      return res?.htmlStr || localComment.comment_text || '';
    }

    return localComment.comment_text || '';
  }, [localComment]);

  const fullHtml = useMemo(() => localComment.comment_text || '', [localComment]);

  // IMPORTANT: Memoize innerHTML objects so React does NOT re-apply innerHTML on state updates
  // (otherwise it wipes the DOM-injected highlight spans used for snippet playback).
  const stripTruncatePlaceholders = useCallback((html: string) => {
    return String(html || '').replace(/<span[^>]*class="[^"]*truncate-placeholder[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
  }, []);

  const lessHtmlWithToggle = useMemo(() => {
    const base = stripTruncatePlaceholders(lessHtml);
    if (!base) return base;
    if (!(
      !!localComment.summary ||
      !!localComment.has_more_text ||
      (!!localComment.resource_link?.collaboration_info?.snippet_data && !!localComment.has_more_text_snippet)
    )) return base;

    // Angular cnvComment.js: appends to the root `.comment-inner` (not inside <p>),
    // which makes "... more" appear on its own line after the last paragraph.
    const toggle = localComment.summary
      ? `<span>...</span><span class="truncate-placeholder hover_underline">more</span>`
      : `<span class="truncate-placeholder hover_underline">more</span>`;

    return `${base}${toggle}`;
  }, [lessHtml, localComment, stripTruncatePlaceholders]);

  const fullHtmlWithToggle = useMemo(() => {
    const base = stripTruncatePlaceholders(fullHtml);
    if (!base) return base;
    if (!(
      !!localComment.summary ||
      !!localComment.has_more_text ||
      (!!localComment.resource_link?.collaboration_info?.snippet_data && !!localComment.has_more_text_snippet)
    )) return base;

    const toggle = `<span class="truncate-placeholder hover_underline">less</span>`;
    // Same as Angular: appended after full HTML so "less" naturally drops to its own line.
    return `${base}${toggle}`;
  }, [fullHtml, localComment, stripTruncatePlaceholders]);

  const lessInnerHtml = useMemo(() => ({ __html: lessHtmlWithToggle }), [lessHtmlWithToggle]);
  const fullInnerHtml = useMemo(() => ({ __html: fullHtmlWithToggle }), [fullHtmlWithToggle]);
  const hasMore =
    !!localComment.summary ||
    !!localComment.has_more_text ||
    (!!localComment.resource_link?.collaboration_info?.snippet_data && !!localComment.has_more_text_snippet);

  const resourceHierarchy = localComment.resource_link?.resource_path?.hierarchy || [];
  const snippetData =
    (localComment.resource_link?.collaboration_info as any)?.snippet_data?.data ||
    (localComment.resource_link?.collaboration_info as any)?.snippet_data?.snippetData?.data ||
    (localComment.resource_link?.collaboration_info as any)?.snippet_data?.snippetData ||
    null;

  const hasFileHierarchySnippet = Array.isArray(resourceHierarchy) && resourceHierarchy.length > 1;
  const fileHierarchyTitle = hasFileHierarchySnippet ? (resourceHierarchy[1] as any)?.title : null;
  const fileExt = fileHierarchyTitle ? getFileExtension(fileHierarchyTitle) : '';
  const fileIconClass = fileExt ? getSmallFileIconClassByType(fileExt) : '';

  const hideSelectionTooltip = useCallback(() => {
    setSelTooltip(null);
    clearNativeSelection();
  }, []);

  useEffect(() => {
    // If comment gets hidden/removed/edited, clear tooltip
    return () => {
      clearNativeSelection();
    };
  }, []);
  
  // Show dropdown only if: not posting, not posting_failed, not editing, not deleted
  const showDropdown = !localComment.is_posting && 
                       !localComment.posting_failed && 
                       !isEditing && 
                       !isDeleted;
  
  const handleLikeClick = async (action: 'like' | 'unlike') => {
    try {
      const response = await likeService.likeConversation(
        localComment.uid,
        resourceId,
        appInstanceId,
        action
      );
      return response.data;
    } catch (error) {
      console.error('Failed to like comment:', error);
      throw error;
    }
  };

  const handleReplyClick = () => {
    if (onReplyClick) {
      onReplyClick(localComment.uid, localComment.from_user);
    }
  };

  const handleViewThreadClick = () => {
    if (!onViewThread) return;
    onViewThread(localComment.resource_link?.collaboration_info, localComment.uid, localComment.thread_root_comment_id);
  };

  const handleHideThreadClick = () => {
    if (!onHideThread) return;
    onHideThread(localComment.uid);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const editSnippetWrapper = useMemo(() => {
    const sd = (localComment.resource_link?.collaboration_info as any)?.snippet_data;
    if (!sd) return null;
    // Mirror Angular _initSnippetDataForEdit
    if (sd.type === 'scrybe.components.snippet.NotesSnippet') {
      const source = sd?.data?.source;
      return {
        classes: source === 'comment' ? 'comment_snippet' : 'detail_snippet',
        fileViewerTextAnnotation: true,
        snippetData: sd,
      };
    }
    return sd;
  }, [localComment]);

  const handleDelete = () => {
    // Show confirmation modal (matches AngularJS alertsService.promptModal)
    promptModal(
      'Delete Comment',
      'Are you sure you want to delete this comment? This cannot be undone.',
      async () => {
        // OK callback - delete the comment
        try {
          await commentsService.deleteComment(
            localComment.uid,
            resourceId,
            appInstanceId
          );

          // Angular feed comments panel: remove immediately from list.
          onCommentDeleted?.(localComment.uid, { hardRemove: true });
        } catch (error) {
          console.error('Failed to delete comment:', error);
        }
      },
      null, // Cancel callback (no action needed)
      'Delete' // OK button label
    );
  };

  const dropdownOptions = [];
  
  // Copy comment link (always available)
  dropdownOptions.push({
    label: 'Copy comment link',
    callback: () => {
      const url = `${window.location.origin}/#/post/${resourceId}/comment/${localComment.uid}`;
      navigator.clipboard.writeText(url);
    }
  });

  // Edit option (if current user and can comment and not from email integration)
  if (localComment.update_kind !== 2 && 
      isCurrentUser && 
      relatedPermissions.canComment && 
      !hasOrigin) {
    dropdownOptions.push({
      label: 'Edit',
      callback: handleEdit
    });
  }

  // Delete option (if current user or admin and not from email integration)
  if (localComment.update_kind !== 2 && 
      (isCurrentUser || isAdminMode) && 
      !hasOrigin) {
    dropdownOptions.push({
      label: 'Delete',
      callback: handleDelete
    });
  }

  const [isHovered, setIsHovered] = useState(false);

  const limitToWithEllipsis = useCallback((txt: string, max: number) => {
    const s = String(txt ?? '');
    if (s.length <= max) return s;
    return `${s.slice(0, max)}...`;
  }, []);

  // Smooth hide/show during thread playback: mimic jQuery slideUp(700) by animating to the real height (not a huge maxHeight).
  const commentContRef = useRef<HTMLDivElement>(null);
  const [measuredMaxHeight, setMeasuredMaxHeight] = useState<number>(1000);
  useLayoutEffect(() => {
    const el = commentContRef.current;
    if (!el) return;
    const measure = () => {
      // scrollHeight is stable even when maxHeight is constrained; use it to get full expanded height
      setMeasuredMaxHeight(Math.max(0, el.scrollHeight));
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [showMore]);

  return (
    <div 
      ref={commentContRef}
      className={[
        'comment-cont',
        threadPlayback?.isSourcePointer ? 'source-comment-pointer' : '',
        threadPlayback?.isRepliedPointer ? 'replied-comment-pointer' : '',
        threadPlayback?.isThreadBPad ? 'thread-b-pad' : '',
        threadPlayback?.isThreadTPad ? 'thread-t-pad' : '',
      ].filter(Boolean).join(' ')}
      style={{
        backgroundColor: '#f2f4f8',
        position: 'relative',
        // Angular parity:
        // - Normal comments are NOT height-capped (so "more/less" expands naturally).
        // - Height-capping + slide animation is only used during thread playback hide/show.
        maxHeight:
          isHiddenByThreadPlayback
            ? '0px'
            : (threadPlayback?.active ? `${measuredMaxHeight}px` : undefined),
        // IMPORTANT: When visible, allow overflow so `.show-all-cont` (bottom:-8px) isn't clipped.
        // When hidden (thread playback), clip like Angular's slideUp.
        overflow: isHiddenByThreadPlayback ? 'hidden' : 'visible',
        opacity: isHiddenByThreadPlayback ? 0 : 1,
        transition: threadPlayback?.active ? 'max-height 700ms ease, opacity 250ms ease' : 'opacity 250ms ease',
        pointerEvents: isHiddenByThreadPlayback ? 'none' : 'auto',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`comment ${localComment.uid}`}
        id={localComment.uid}
        style={{
          position: 'relative',
          padding: '10px 0px',
          borderBottom: '1px solid #e0e0e0',
          // Angular parity: `.comment { width: 473px; }`
          width: '473px',
        }}
      >
        {/* Three-dot Dropdown Menu - Shows on hover (matches AngularJS) */}
        {showDropdown && dropdownOptions.length > 0 && (
          <div className="comment-drop-down">
            <CommentDropdown options={dropdownOptions} align="right" />
          </div>
        )}

        {/* Profile Picture */}
        <span className="pic_container" style={{
          display: 'block',
          float: 'left',
          marginRight: '10px',
          marginLeft: '10px',
          width: '40px',
          height: '40px',
        }}>
          <a href={`#/feed?filter=user:${localComment.from_user}`}>
            <UserProfileImage
              userId={localComment.from_user}
              user={users[localComment.from_user]}
              width={40}
              height={40}
              source="Feed"
            />
          </a>
        </span>

        {/* View Mode (Angular: `.comment_body` only when NOT editing) */}
        {!isEditing && (
          <div className="comment_body" style={{
            marginTop: '6px',
            display: 'block',
            overflow: 'hidden',
            verticalAlign: 'middle',
            padding: '0px',
            marginRight: '20px',
          }}>
            {/* File hierarchy snippet (Angular: shown ABOVE .comment_txt, not inside it) */}
            {hasFileHierarchySnippet && fileHierarchyTitle && (
              <div className="img-snippet" style={{ marginBottom: '6px' }}>
                {fileExt && (
                  <i className={`ext_holder ${fileIconClass}`} style={{ marginRight: '6px' }}>
                    {fileExt}
                  </i>
                )}
                <a
                  className="snippet-file-name"
                  href={`#/post/${resourceId}/comment/${localComment.uid}`}
                  style={{ color: 'rgb(51, 113, 189)', textDecoration: 'none' }}
                >
                  {String(fileHierarchyTitle).slice(0, 72)}
                </a>
              </div>
            )}

            {/* Comment Text (Angular: .comment_txt contains ONLY reply-arrow + comment-inner placeholders) */}
            <div
              className="comment_txt"
              ref={commentInnerRef}
              onMouseUp={(e) => {
                const target = e.target as HTMLElement | null;
                if (target?.classList?.contains('truncate-placeholder')) return;
                setTimeout(() => {
                  if (!relatedPermissions.canComment) return;
                  const root = commentInnerRef.current;
                  if (!root) return;
                  const inner = root.querySelector('.comment-inner') as HTMLElement | null;
                  if (!inner) return;
                  const data = getSelectionDataWithin(inner);
                  if (!data) return;
                  if (data.beginIndex >= data.endIndex) return;
                  if (!data.text || data.text.trim() === '') return;
                  setSelTooltip({
                    portalTarget: document.body,
                    top: data.rect.top + window.scrollY - 40,
                    left: data.rect.left + window.scrollX + data.rect.width / 2,
                    beginIndex: data.beginIndex,
                    endIndex: data.endIndex,
                    text: data.text,
                  });
                }, 0);
              }}
              style={{
                wordWrap: 'break-word',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                overflow: 'hidden',
                position: 'relative',
                display: 'block',
              }}
            >
              {hasThread && <span className="reply-arrow" />}

              {!showMore ? (
                <div
                  className="comment-inner comment-inner-less less"
                  style={{ display: 'block', color: '#272b2c' }}
                  onClick={(e) => {
                    const t = e.target as HTMLElement | null;
                    if (t?.classList?.contains('truncate-placeholder')) setShowMore(true);
                  }}
                  dangerouslySetInnerHTML={lessInnerHtml}
                />
              ) : (
                <div
                  className="comment-inner comment-inner-full full"
                  style={{ display: 'block', color: '#272b2c' }}
                  onClick={(e) => {
                    const t = e.target as HTMLElement | null;
                    if (t?.classList?.contains('truncate-placeholder')) setShowMore(false);
                  }}
                  dangerouslySetInnerHTML={fullInnerHtml}
                />
              )}
            </div>

            {/* Snippet blocks (Angular: siblings AFTER .comment_txt; this affects meta alignment) */}
            {snippetData?.text && !snippetData?.source && (resourceHierarchy?.length || 0) < 2 && appInstanceId !== 4 && (
              <a
                className="comment-snippet-attachment"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPostSnippetPlayback?.(snippetData, localComment.uid);
                }}
              >
                <div className="snippet-wrapper note-file-snippet">
                  <div className="textSnippet">
                    <span>{limitToWithEllipsis(String(snippetData.text), 100)}</span>
                  </div>
                </div>
              </a>
            )}

            {snippetData?.text && !snippetData?.source && ((resourceHierarchy?.length || 0) > 1 || appInstanceId === 4) && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPostSnippetPlayback?.(snippetData, localComment.uid);
                }}
              >
                <div className="snippet-wrapper note-file-snippet">
                  <div className="textSnippet">
                    <span>{limitToWithEllipsis(String(snippetData.text), 100)}</span>
                  </div>
                </div>
              </a>
            )}

            {snippetData?.text && snippetData?.source === 'comment' && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleViewThreadClick();
                }}
              >
                <div className="snippet-wrapper comment-snippet">
                  <div className="textSnippet">
                    <span>{limitToWithEllipsis(String(snippetData.text), 100)}</span>
                  </div>
                </div>
              </a>
            )}

            {/* File Attachments - Angular: below snippets, above action_line */}
            {localComment.files && localComment.files.length > 0 && (
              <CommentFileAttachments
                files={localComment.files}
                commentUid={localComment.uid}
                resourceId={resourceId}
                appInstanceId={appInstanceId}
                commentData={localComment}
              />
            )}

            {/* Action Line - Angular: INSIDE .comment_body */}
            {localComment.posting_failed ? (
              <div className="action_line" style={{ color: '#596d97', margin: '4px 0 0 0', fontSize: '13px' }}>
                <span className="warning-icon-red" style={{ marginRight: '6px' }}></span>
                <span>Unable to post comment.&nbsp;</span>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onRetryFailedPost?.(localComment);
                  }}
                  style={{ color: 'rgb(51, 113, 189)', textDecoration: 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  Retry
                </a>
                <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onDiscardFailedPost?.(localComment.uid);
                  }}
                  style={{ color: 'rgb(51, 113, 189)', textDecoration: 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  Delete
                </a>
              </div>
            ) : (
              <div className="action_line" style={{ color: '#596d97', margin: '4px 0 0 0', fontSize: '13px' }}>
                <span className="meta comment_info">
                  <a
                    className="meta"
                    href={`#/feed?filter=user:${localComment.from_user}`}
                    style={{ color: '#7b8386', textDecoration: 'none' }}
                  >
                    {getUserName(users, localComment.from_user)}
                  </a>
                  {!localComment.is_posting && (
                    <>
                      <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                      {isDeleted ? (
                        <span>deleted&nbsp;&nbsp;&#8226;</span>
                      ) : (
                        <>
                          {isReplied && <span>replied{' '}</span>}
                          {isEdited && !isReplied && (
                            <>
                              <a
                                className="meta"
                                href={`#/post/${resourceId}/comment/${localComment.uid}`}
                                style={{ color: '#7b8386', textDecoration: 'none' }}
                              >
                                edited
                              </a>{' '}
                            </>
                          )}
                          <a
                            className="time hover_underline meta"
                            href={`#/post/${resourceId}/comment/${localComment.uid}`}
                            style={{ color: '#7b8386', textDecoration: 'none' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                            title={new Date(localComment.update_timestamp).toLocaleString()}
                          >
                            {timestampText}
                          </a>
                        </>
                      )}
                    </>
                  )}
                </span>
            {!isDeleted && onReplyClick && (
              <>
                <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                <span>
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      handleReplyClick();
                    }}
                    className="reply-btn hover_underline"
                    style={{
                      color: 'rgb(51, 113, 189)', // Theme color
                      cursor: 'pointer',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                  >
                    Reply
                  </a>
                </span>
              </>
            )}
            {!isDeleted && !localComment.is_posting && (
              <>
                <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                <LikeButton 
                  likeInfo={localComment.like_info} 
                  onLikeClick={handleLikeClick}
                />
                {localComment.like_info.likes_count > 0 && (
                  <>
                    <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                    <span className="likes_count" style={{
                      color: 'rgb(51, 113, 189)', // Theme color
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}>
                      <i className="cnv-icons-15 icons2_Like-darkgray" style={{
                        verticalAlign: 'middle',
                        opacity: 0.7,
                        display: 'inline-block',
                      }}></i>
                      &nbsp;
                      <span className="count" style={{
                        color: 'rgb(51, 113, 189)', // Theme color
                      }}>{localComment.like_info.likes_count}</span>
                    </span>
                  </>
                )}
              </>
            )}
            {hasThread && !isCurrentlyPlayingCommentSnippet && (
              <>
                <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                <span 
                  className="reply-btn hover_underline thread-control"
                  onClick={handleViewThreadClick}
                  style={{
                    color: 'rgb(51, 113, 189)', // Theme color
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  View thread
                </span>
              </>
            )}
            {hasThread && isCurrentlyPlayingCommentSnippet && (
              <>
                <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                <span
                  className="reply-btn hover_underline thread-control"
                  onClick={handleHideThreadClick}
                  style={{
                    color: 'rgb(51, 113, 189)',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  Hide thread
                </span>
              </>
            )}
              </div>
            )}
          </div>
        )}

        {/* Edit Mode (Angular: `editCommentEditorCtrl` shows `<cnv-comment-editor>` with margin-left: 60px) */}
        {isEditing && (
          <div style={{ marginLeft: '60px' }}>
            <CommentEditor
              mode="edit"
              commentToEdit={localComment}
              resourceId={resourceId}
              appInstanceId={appInstanceId}
              feedId={null}
              resourceType={String(appInstanceId)}
              snippetData={editSnippetWrapper}
              relatedPermissions={relatedPermissions}
              onCancelEdit={handleCancelEdit}
              onCommentEdited={(updated) => {
                setLocalComment(updated);
                if (onCommentUpdated) onCommentUpdated(updated);
              }}
            />
          </div>
        )}
        {/* "View all comments" gap button (Angular appends this inside `.comment`) */}
        {threadPlayback?.showViewAllButton && (
          <ViewAllCommentsGap onClick={() => onHideThread?.()} />
        )}
        </div>

      {selTooltip && (
        <CommentOnThisTooltip
          portalTarget={selTooltip.portalTarget}
          position={{ top: selTooltip.top, left: selTooltip.left }}
          onClose={hideSelectionTooltip}
          onClick={() => {
            const snippetId = `cnv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

            const snippetWrapper = {
              snippetData: {
                type: 'scrybe.components.snippet.NotesSnippet',
                data: {
                  beginIndex: selTooltip.beginIndex,
                  endIndex: selTooltip.endIndex,
                  text: selTooltip.text,
                  source: 'comment',
                  snippetId,
                },
              },
              fileViewerTextAnnotation: true,
              classes: 'comment_snippet',
            };

            const collaborationInfo = {
              replied_to_comment_id: localComment.uid,
              replied_to_user_id: localComment.from_user,
              parent_resource_index: 0,
            };

            onCreateSnippetReply?.(snippetWrapper, collaborationInfo);
            hideSelectionTooltip();
          }}
        />
      )}
    </div>
  );
}
