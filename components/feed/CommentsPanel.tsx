'use client';

/**
 * Comments Panel Component
 * 
 * Displays comments for a feed item with threading support
 * Migrated from AngularJS cnv-comments-panel directive
 */

import { useState, useEffect, useRef } from 'react';
import { FeedItem, Comment } from '@/lib/api/feed';
import { User } from '@/lib/api/auth';
import CommentItem from './CommentItem';
import CommentEditor from './CommentEditor';
import { useFeedContext } from '@/lib/contexts/FeedContext';
import { commentsService } from '@/lib/api/comments';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useFeedPoll } from '@/lib/hooks/use-feed';
import { useQueryClient } from '@tanstack/react-query';

// Helper function to get user name from users map
function getUserName(users: Record<string, User>, userId: string): string {
  const user = users[userId];
  if (!user) return 'Unknown';
  return (user as any).name || (user as any).firstName + ' ' + (user as any).lastName || userId;
}

interface CommentsPanelProps {
  item: FeedItem;
  showCommentsPanel: boolean;
  onToggleComments: () => void;
}

// Helper to sort comments by creation_timestamp (oldest first, newest at bottom)
const sortCommentsByTimestamp = (comments: Comment[]): Comment[] => {
  return [...comments].sort((a, b) => (a.creation_timestamp || 0) - (b.creation_timestamp || 0));
};

const LATEST_COMMENTS_ONLY_COUNT = 2; // Exact match from AngularJS
const PAGE_SIZE = 10; // Exact match from AngularJS

export default function CommentsPanel({ item, showCommentsPanel, onToggleComments: _onToggleComments }: CommentsPanelProps) {
  const { users } = useFeedContext();
  const feedPoll = useFeedPoll();
  const queryClient = useQueryClient();
  const { user, loginData, account } = useAuthStore();
  const commentEditorRef = useRef<{ activate: (initialText: string) => void }>(null);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [loadedCommentsCount, setLoadedCommentsCount] = useState(LATEST_COMMENTS_ONLY_COUNT);
  const [loadingComments, setLoadingComments] = useState(false);
  // Initialize comments and sort by creation_timestamp (oldest first, newest at bottom - matches AngularJS)
  const [allComments, setAllComments] = useState<Comment[]>(sortCommentsByTimestamp(item.conversations || []));
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update comments when item.conversations changes (e.g., after pollFeed response)
  // Deduplicate by uid to avoid duplicate keys (matches AngularJS mergeComments behavior)
  useEffect(() => {
    if (item.conversations && item.conversations.length > 0) {
      // Merge comments: update existing ones, add new ones (matches AngularJS mergeComments)
      setAllComments((prevComments) => {
        // Create a map of existing comments by uid
        const existingCommentsMap = new Map(prevComments.map(c => [c.uid, c]));
        
        // Update or add comments from feed item
        item.conversations.forEach((comment: Comment) => {
          if (comment.uid) {
            existingCommentsMap.set(comment.uid, comment);
          }
        });
        
        // Convert back to array and sort by timestamp
        const mergedComments = Array.from(existingCommentsMap.values());
        return sortCommentsByTimestamp(mergedComments);
      });
    } else if (item.conversations_count === 0) {
      // Clear comments if count is 0
      setAllComments([]);
    }
  }, [item.conversations, item.conversations_count]);

  const comments = allComments;
  const totalComments = item.conversations_count || 0;
  // Display latest comments at bottom (negative slice = from end, matches AngularJS limitTo:-loadedCommentsCount)
  const displayedComments = commentsExpanded 
    ? comments.slice(-loadedCommentsCount)
    : comments.slice(-LATEST_COMMENTS_ONLY_COUNT);

  const loadAllComments = async () => {
    if (loadingComments || !loginData || !user || !account) return;
    
    setLoadingComments(true);
    setCommentsExpanded(true);
    
    const userId = (user as any).user_id || (user as any).userId;
    const accountId = (account as any).account_id;
    const authToken = loginData.xmpp_session_token;
    
    try {
      // First load 10 comments (matching AngularJS behavior)
      const response = await commentsService.getComments_newApi(
        null, // feed_id
        item.resource_id,
        item.app_instance_id,
        true, // fetchFromServerIfNotAvailableLocally
        comments.length, // offset
        PAGE_SIZE, // limit
        authToken,
        userId,
        accountId
      );
      
      if (response.data) {
        const newComments = response.data.comments || [];
        // Merge and deduplicate comments by uid (matches AngularJS mergeComments behavior)
        const existingCommentsMap = new Map(comments.map(c => [c.uid, c]));
        newComments.forEach((comment: Comment) => {
          if (comment.uid) {
            existingCommentsMap.set(comment.uid, comment);
          }
        });
        const mergedComments = Array.from(existingCommentsMap.values());
        setAllComments(sortCommentsByTimestamp(mergedComments));
        setLoadedCommentsCount(Math.min(mergedComments.length, response.data.total_comments || totalComments));
        
        // Then load all comments (matching AngularJS behavior)
        const allResponse = await commentsService.getComments_newApi(
          null,
          item.resource_id,
          item.app_instance_id,
          true,
          0,
          null, // null = all comments
          authToken,
          userId,
          accountId
        );
        
        if (allResponse.data) {
          // Deduplicate and sort all comments by timestamp (oldest first, newest at bottom)
          const allCommentsMap = new Map<string, Comment>();
          (allResponse.data.comments || []).forEach((comment: Comment) => {
            if (comment.uid) {
              allCommentsMap.set(comment.uid, comment);
            }
          });
          const deduplicatedComments = Array.from(allCommentsMap.values());
          setAllComments(sortCommentsByTimestamp(deduplicatedComments));
          setLoadedCommentsCount(allResponse.data.total_comments || totalComments);
        }
      }
    } catch (error) {
      console.error('Failed to load all comments:', error);
    } finally {
      setLoadingComments(false);
      // Scroll to bottom after loading
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  };

  const showLatestCommentsOnly = () => {
    setLoadedCommentsCount(LATEST_COMMENTS_ONLY_COUNT);
    setCommentsExpanded(false);
    if (commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight; // Scroll to bottom
    }
  };

  const handleReplyClick = (commentId: string, fromUser: string) => {
    // Matches AngularJS onCommentReplyButtonClick behavior
    // Activate comment editor with @mention
    if (commentEditorRef.current) {
      const replyUser = users[fromUser];
      let initialText = '';
      
      if (replyUser) {
        // Get user name (matches AngularJS getUserListItem)
        const userName = (replyUser as any).name || 
                        ((replyUser as any).first_name || (replyUser as any).firstName || '') + ' ' + 
                        ((replyUser as any).last_name || (replyUser as any).lastName || '').trim();
        const name = userName.trim() || fromUser;
        
        // Create @mention text (simplified - AngularJS uses Quill with HTML)
        initialText = `@${name} `;
      }
      
      // Activate the comment editor with @mention
      commentEditorRef.current.activate(initialText);
    }
  };

  const handleCommentUpdated = (updatedComment: any) => {
    // CommentItem handles its own local state update
    // This callback can be used for parent-level updates if needed
    // For now, local state in CommentItem provides immediate UI feedback
  };

  const handleCommentDeleted = (commentId: string) => {
    // CommentItem marks the comment as deleted in its local state
    // This provides immediate UI feedback
    // Parent can handle query invalidation if needed
  };

  const handleCommentPosted = async (newComment: any) => {
    // Matches AngularJS cnvFeedItem.commentPosted behavior
    // After posting a comment, AngularJS calls pollFeed to refresh the feed
    // IMPORTANT: Do NOT automatically expand comments panel - it should only expand when user clicks the comments link/button
    if (newComment) {
      // Only update count and scroll if comments are already expanded
      // Do NOT expand the panel automatically (matches AngularJS behavior)
      if (commentsExpanded && loadedCommentsCount > LATEST_COMMENTS_ONLY_COUNT) {
        setLoadedCommentsCount(loadedCommentsCount + 1);
        
        // Scroll to bottom after a short delay (matches AngularJS)
        setTimeout(() => {
          if (commentsContainerRef.current) {
            commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
          }
        }, 100);
      }
      // If comments are not expanded, do nothing - user must click the comments link to expand
      
      // Call feed poll API to refresh the feed (matches AngularJS $rootScope.$broadcast('pollFeedRequest'))
      // The poll response will include updated feed items with conversations/comments
      // The feed cache update in useFeedPoll will merge the new data, and useEffect above will update comments
      try {
        const pollResponse = await feedPoll.mutateAsync({ lastPollTimestamp: undefined });
        
        // Find the updated feed item in the poll response
        if (pollResponse?.feed_items) {
          const updatedItem = pollResponse.feed_items.find(
            (feedItem: FeedItem) => feedItem.feed_id === item.feed_id
          );
          
          if (updatedItem && updatedItem.conversations) {
            // Merge comments from poll response (matches AngularJS updateCommentsDataReceivedInFeedPoll)
            // Deduplicate by uid to avoid duplicate keys
            setAllComments((prevComments) => {
              // Create a map of existing comments by uid
              const existingCommentsMap = new Map(prevComments.map(c => [c.uid, c]));
              
              // Update or add comments from poll response
              updatedItem.conversations.forEach((comment: Comment) => {
                if (comment.uid) {
                  existingCommentsMap.set(comment.uid, comment);
                }
              });
              
              // Convert back to array and sort by timestamp
              const mergedComments = Array.from(existingCommentsMap.values());
              return sortCommentsByTimestamp(mergedComments);
            });
            
            // Update loaded count if comments are already expanded
            if (commentsExpanded && updatedItem.conversations_count !== undefined) {
              setLoadedCommentsCount(Math.max(loadedCommentsCount, updatedItem.conversations_count));
              
              // Scroll to bottom to show the new comment (only if panel is expanded)
              setTimeout(() => {
                if (commentsContainerRef.current) {
                  commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
                }
              }, 100);
            }
          }
        }
        
        // Also invalidate feed query to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      } catch (error) {
        console.error('Failed to poll feed after posting comment:', error);
      }
    }
  };

  // Infinite scroll: load more comments when scrolling to top
  useEffect(() => {
    const container = commentsContainerRef.current;
    if (!container || !commentsExpanded) return;

    const handleScroll = () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }

      loadTimeoutRef.current = setTimeout(() => {
        if (container.scrollHeight >= 435 && commentsExpanded) {
          const scrollTop = container.scrollTop;
          if (scrollTop < 50 && loadedCommentsCount < totalComments) {
            // Load 10 more comments
            const newCount = Math.min(loadedCommentsCount + COMMENTS_LOAD_INCREMENT, totalComments);
            setLoadedCommentsCount(newCount);
          }
        }
      }, 50);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [commentsExpanded, loadedCommentsCount, totalComments]);

  return (
    <div 
      className="comments-panel-wrapper l-pad"
      style={{
        marginTop: '5px',
        marginBottom: '7px',
        position: 'relative',
        background: '#f2f4f8',
        borderRadius: '3px',
        padding: '0px',
      }}
    >
      {/* Likes Count Container */}
      {item.like_info.likes_count > 0 && (
        <div className="likes-count-container" style={{
          borderBottom: '1px solid #e2e5ea',
          borderTop: '1px solid transparent',
          padding: '9px 10px',
          margin: '0px 10px',
        }}>
          <i className="cnv-icons-20 icons2_Like-darkgray" style={{
            verticalAlign: 'bottom',
            position: 'relative',
            top: '-2px',
            opacity: 0.5,
            display: 'inline-block',
          }}></i>
          {item.like_info.liked_by && (
            <>
              <a 
                href={`#/feed?filter=user:${item.like_info.liked_by}`}
                style={{
                  marginLeft: '10px',
                  color: '#7b8386',
                  textDecoration: 'none',
                }}
              >
                {getUserName(users, item.like_info.liked_by)}
              </a>
              {item.like_info.likes_count > 1 && (
                <>
                  <span style={{ color: '#7b8386' }}>, </span>
                  <a 
                    href="#"
                    style={{
                      color: '#7b8386',
                      textDecoration: 'none',
                    }}
                  >
                    +{item.like_info.likes_count - 1} more
                  </a>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Comments Info Bar */}
      {totalComments > LATEST_COMMENTS_ONLY_COUNT && (
        <div 
          className="bar comments_info"
          style={{
            padding: '9px 10px 0px 10px',
            margin: '0px 10px',
            position: 'relative',
          }}
        >
          <i className="cnv-icons-16 icons_Comments-darkgray" style={{
            verticalAlign: 'middle',
            opacity: 0.7,
            display: 'inline-block',
          }}></i>
          {loadedCommentsCount <= LATEST_COMMENTS_ONLY_COUNT ? (
            <>
              {loadingComments && (
                <span className="fetch-more-spinner" style={{
                  marginLeft: '10px',
                  display: 'inline-block',
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid rgb(51, 113, 189)', // Theme color
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}></span>
                </span>
              )}
              <a 
                onClick={(e) => {
                  e.preventDefault();
                  loadAllComments();
                }}
                href="#"
                className="hover_underline"
                style={{
                  marginLeft: '10px',
                  color: 'rgb(51, 113, 189)', // Theme color
                  textDecoration: 'none',
                  cursor: loadingComments ? 'wait' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!loadingComments) {
                    e.currentTarget.style.textDecoration = 'underline';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {totalComments} comments
              </a>
            </>
          ) : (
            <a 
              onClick={(e) => {
                e.preventDefault();
                showLatestCommentsOnly();
              }}
              href="#"
              className="hover_underline"
              style={{
                marginLeft: '10px',
                color: 'rgb(51, 113, 189)', // Theme color
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Hide comments
            </a>
          )}
        </div>
      )}

      {/* Comments Collection */}
      <div 
        ref={commentsContainerRef}
        className={`comments-collection comments-scrollable-panel ${commentsExpanded ? 'expanded' : ''}`}
        style={{
          position: 'relative',
          maxHeight: commentsExpanded ? '435px' : 'auto',
          overflowY: commentsExpanded ? 'auto' : 'hidden',
          overflowX: 'hidden',
          padding: '0px 10px',
          marginRight: '2px',
        }}
      >
        {displayedComments.map((comment) => (
          <CommentItem 
            key={comment.uid} 
            comment={comment}
            resourceId={item.resource_id}
            appInstanceId={item.app_instance_id}
            onReplyClick={handleReplyClick}
            onCommentUpdated={handleCommentUpdated}
            onCommentDeleted={handleCommentDeleted}
            relatedPermissions={{ canComment: true }}
          />
        ))}
      </div>

      {/* Comment Editor - Always show (matches AngularJS) */}
      <div 
        className="feed-comment-editor l-pad r-pad"
        style={{
          paddingBottom: '10px',
          paddingTop: '10px',
          position: 'relative',
          paddingLeft: '10px',
          paddingRight: '10px',
        }}
      >
        <CommentEditor
          ref={commentEditorRef}
          resourceId={item.resource_id}
          appInstanceId={item.app_instance_id}
          feedId={item.feed_id}
          resourceType={item.resource_type}
          hierarchy={item.hierarchy}
          onCommentPosted={handleCommentPosted}
          relatedPermissions={{ canComment: true }}
        />
      </div>
    </div>
  );
}
