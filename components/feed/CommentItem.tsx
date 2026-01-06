'use client';

/**
 * Comment Item Component
 * 
 * Displays a single comment with threading support
 * Migrated from AngularJS cnv-comment directive
 * Exact 1:1 match with AngularJS implementation
 */

import { useState } from 'react';
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
import { promptModal } from '@/lib/utils/modal.tsx';

interface CommentItemProps {
  comment: Comment;
  resourceId: string;
  appInstanceId: number;
  onReplyClick?: (commentId: string, fromUser: string) => void;
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
  onCommentUpdated,
  onCommentDeleted,
  relatedPermissions = { canComment: true }
}: CommentItemProps) {
  const { users } = useFeedContext();
  const { user, loginData, account } = useAuthStore();
  const [localComment, setLocalComment] = useState(comment);
  const [showThread, setShowThread] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  
  const currentUserId = (user as any)?.user_id || (user as any)?.userId;
  const isCurrentUser = currentUserId === localComment.from_user;
  const isAdminMode = (user as any)?.isAdminMode?.() || false;
  const hasOrigin = !!(localComment as any).origin;
  
  const isDeleted = localComment.update_kind === 2;
  const isReply = !!localComment.thread_root_comment_id;
  const isEdited = localComment.update_timestamp > localComment.creation_timestamp;
  const isReplied = localComment.update_kind === 3 && localComment.update_timestamp === localComment.creation_timestamp;
  const hasThread = !!localComment.resource_link?.collaboration_info?.replied_to_user_id && !!localComment.thread_root_comment_id;
  
  // Format timestamp - matches AngularJS dateAgo filter
  const timestampText = formatDateAgo(localComment.update_timestamp);
  
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

  return (
    <div 
      className={`comment-cont ${isReply ? 'replied-comment-pointer' : ''}`}
      style={{
        backgroundColor: '#f2f4f8',
        position: 'relative',
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
          <div className="comment_txt" style={{
            wordWrap: 'break-word',
            overflow: 'hidden',
            position: 'relative',
            display: 'block',
          }}>
            {isReply && (
              <span className="reply-arrow" style={{
                width: '13px',
                height: '5px',
                background: 'url(/assets/img/common/reply_arrow.png)',
                backgroundSize: '13px 5px',
                display: 'inline-block',
                verticalAlign: 'middle',
                float: 'left',
                marginTop: '8px',
                marginRight: '4px',
              }}></span>
            )}
                
                {/* File Attachments - matches AngularJS file-attachments-container */}
                {localComment.files && localComment.files.length > 0 && (
                  <CommentFileAttachments
                    files={localComment.files}
                    commentUid={localComment.uid}
                    resourceId={resourceId}
                    appInstanceId={appInstanceId}
                    commentData={localComment}
                  />
                )}

            <div 
              className="comment-inner text"
              dangerouslySetInnerHTML={{ 
                    __html: localComment.comment_text_less || localComment.comment_text || '' 
              }}
              style={{
                display: 'block',
                color: '#272b2c',
              }}
            ></div>
          </div>
            </>
          )}

          {/* Action Line - matches AngularJS .feed_item .action_line color */}
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
            {hasThread && (
              <>
                <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                <span 
                  className="reply-btn hover_underline thread-control"
                  onClick={() => setShowThread(!showThread)}
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
                  {showThread ? 'Hide thread' : 'View thread'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
