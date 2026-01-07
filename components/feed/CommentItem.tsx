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
import { likeService } from '@/lib/api/feed';
import { commentsService } from '@/lib/api/comments';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatDateAgo } from '@/lib/utils/dateFormat';
import CommentFileAttachments from './CommentFileAttachments';
import { promptModal } from '@/lib/utils/modal';
import { getFileExtension, getSmallFileIconClassByType } from '@/lib/utils/file-icons';
import CommentOnThisTooltip from '@/components/common/CommentOnThisTooltip';
import { clearNativeSelection, getSelectionDataWithin } from '@/lib/utils/text-selection';

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
  onCommentDeleted?: (commentId: string) => void;
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
  const [editText, setEditText] = useState('');
  const [showMore, setShowMore] = useState(false); // mirrors AngularJS $scope.showMore
  const commentInnerRef = useRef<HTMLDivElement>(null);
  const [selTooltip, setSelTooltip] = useState<{ portalTarget: HTMLElement; top: number; left: number; beginIndex: number; endIndex: number; text: string } | null>(null);

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
  const isAdminMode = (user as any)?.isAdminMode?.() || false;
  const hasOrigin = !!(localComment as any).origin;
  
  const isDeleted = localComment.update_kind === 2;
  const hasThread = !!localComment.resource_link?.collaboration_info?.replied_to_user_id && !!localComment.thread_root_comment_id;
  const isEdited = localComment.update_timestamp > localComment.creation_timestamp;
  const isReplied = localComment.update_kind === 3 && localComment.update_timestamp === localComment.creation_timestamp;
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
  const timestampText = formatDateAgo(localComment.update_timestamp);

  // Comment truncation logic mirrors AngularJS:
  // - prefer `summary` if present
  // - else use `comment_text_less` (or snippet variant) when `has_more_text` is true
  const lessHtml = useMemo(() => {
    if (localComment.summary) return localComment.summary;
    // snippet variant if present
    if (localComment.resource_link?.collaboration_info?.snippet_data && localComment.comment_text_less_snippet) {
      return localComment.comment_text_less_snippet;
    }
    return localComment.comment_text_less || localComment.comment_text || '';
  }, [localComment]);

  const fullHtml = useMemo(() => localComment.comment_text || '', [localComment]);

  // IMPORTANT: Memoize innerHTML objects so React does NOT re-apply innerHTML on state updates
  // (otherwise it wipes the DOM-injected highlight spans used for snippet playback).
  const lessInnerHtml = useMemo(() => ({ __html: lessHtml }), [lessHtml]);
  const fullInnerHtml = useMemo(() => ({ __html: fullHtml }), [fullHtml]);
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
    setEditText(localComment.comment_text);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  const handleSaveEdit = async () => {
    try {
      const response = await commentsService.editComment(
        localComment.uid,
        localComment.citem_uid,
        editText,
        resourceId,
        appInstanceId,
        false, // attachContext
        null, // snippetData
        null, // onCommentAttachment
        null, // attachedFiles
        null, // link
        localComment
      );

      // Update local comment immediately
      const updatedComment: Comment = {
        ...localComment,
        comment_text: editText,
        update_timestamp: Date.now(),
        update_kind: 1, // edited
      };
      setLocalComment(updatedComment);
      setIsEditing(false);
      
      if (onCommentUpdated) {
        onCommentUpdated(updatedComment);
      }
    } catch (error) {
      console.error('Failed to edit comment:', error);
      // Revert on error
      setIsEditing(false);
    }
  };

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

          // Update local comment to show as deleted
          const deletedComment: Comment = {
            ...localComment,
            update_kind: 2, // deleted
            update_timestamp: Date.now(),
          };
          setLocalComment(deletedComment);
          
          if (onCommentDeleted) {
            onCommentDeleted(localComment.uid);
          }
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
  }, []);

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
        maxHeight: isHiddenByThreadPlayback ? '0px' : `${measuredMaxHeight}px`,
        // IMPORTANT: When visible, allow overflow so `.show-all-cont` (bottom:-8px) isn't clipped.
        // When hidden (thread playback), clip like Angular's slideUp.
        overflow: isHiddenByThreadPlayback ? 'hidden' : 'visible',
        opacity: isHiddenByThreadPlayback ? 0 : 1,
        transition: 'max-height 700ms ease, opacity 250ms ease',
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

        {/* Comment Body */}
        <div className="comment_body" style={{
          marginTop: '6px',
          display: 'block',
          overflow: 'hidden',
          verticalAlign: 'middle',
          padding: '0px',
          marginRight: '20px',
        }}>
          {isEditing ? (
            /* Edit Mode */
            <div style={{ marginLeft: '60px' }}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
                autoFocus
              />
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={handleSaveEdit}
                  style={{
                    padding: '6px 12px',
                    marginRight: '8px',
                    backgroundColor: 'rgb(51, 113, 189)', // Theme color
                    color: '#fff',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f5f5f5',
                    color: '#272b2c',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
          {/* Comment Text */}
          <div
            className="comment_txt"
            ref={commentInnerRef}
            onMouseUp={() => {
              // Mirrors Angular: commentTextMouseUpHandler -> mkTxtSnippet (setTimeout 0)
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

                // Tooltip is appended to <body> in Angular; keep it stable during scroll.
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
            overflow: 'hidden',
            position: 'relative',
            display: 'block',
          }}
          >
            {/* File hierarchy snippet (mirrors Angular: commentData.resource_link.resource_path.hierarchy.length > 1) */}
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

            {hasThread && (
              <span className="reply-arrow" />
            )}

            {/* Mirrors Angular: .comment-inner.less / .comment-inner.full toggled by showMore */}
            {!showMore ? (
              <div className="comment-inner comment-inner-less less text" style={{ display: 'block', color: '#272b2c' }}>
                <span dangerouslySetInnerHTML={lessInnerHtml} />
                {hasMore && (
                  <span
                    className="truncate-placeholder hover_underline"
                    style={{ marginLeft: '4px', cursor: 'pointer' }}
                    onClick={() => setShowMore(true)}
                  >
                    more
                  </span>
                )}
              </div>
            ) : (
              <div className="comment-inner comment-inner-full full text" style={{ display: 'block', color: '#272b2c' }}>
                <span dangerouslySetInnerHTML={fullInnerHtml} />
                {hasMore && (
                  <span
                    className="truncate-placeholder hover_underline"
                    style={{ marginLeft: '4px', cursor: 'pointer' }}
                    onClick={() => setShowMore(false)}
                  >
                    less
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Snippet blocks (Angular parity: cnvComment.tpl.html) */}
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
              onClick={(e) => {
                e.preventDefault(); // keep anchor semantics but match Angular "no href"
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

          {/* File Attachments - matches AngularJS placement (below comment text) */}
          {localComment.files && localComment.files.length > 0 && (
            <CommentFileAttachments
              files={localComment.files}
              commentUid={localComment.uid}
              resourceId={resourceId}
              appInstanceId={appInstanceId}
              commentData={localComment}
            />
          )}
            </>
          )}

          {/* Action Line - matches AngularJS .action_line + posting_failed branch */}
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
          <div className="action_line" style={{
            color: '#596d97',
              margin: '4px 0 0 0',
              fontSize: '13px',
          }}>
            <span className="meta comment_info">
              <a 
                className="meta"
                href={`#/feed?filter=user:${localComment.from_user}`}
                style={{
                  color: '#7b8386',
                  textDecoration: 'none',
                }}
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
                      {isReplied && (
                        <span>replied</span>
                      )}
                      {isEdited && !isReplied && (
                        <a 
                          className="meta"
                          href={`#/post/${resourceId}/comment/${localComment.uid}`}
                          style={{
                            color: '#7b8386',
                            textDecoration: 'none',
                          }}
                        >
                          edited
                        </a>
                      )}
                      <a 
                        className="time hover_underline meta"
                        href={`#/post/${resourceId}/comment/${localComment.uid}`}
                        style={{
                          color: '#7b8386',
                          textDecoration: 'none',
                        }}
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
        {/* "View all comments" gap button (Angular appends this inside `.comment`) */}
        {threadPlayback?.showViewAllButton && (
          <ViewAllCommentsGap onClick={() => onHideThread?.()} />
        )}
        </div>
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
