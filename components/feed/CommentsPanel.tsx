'use client';

/**
 * Comments Panel Component
 * 
 * Displays comments for a feed item with threading support
 * Migrated from AngularJS cnv-comments-panel directive
 */

import { useState } from 'react';
import { FeedItem } from '@/lib/api/feed';
import { User } from '@/lib/api/auth';
import CommentItem from './CommentItem';
import { useFeedContext } from '@/lib/contexts/FeedContext';

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

const LATEST_COMMENTS_ONLY_COUNT = 3;

export default function CommentsPanel({ item, showCommentsPanel, onToggleComments: _onToggleComments }: CommentsPanelProps) {
  const { users } = useFeedContext();
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [loadedCommentsCount, setLoadedCommentsCount] = useState(LATEST_COMMENTS_ONLY_COUNT);

  const comments = item.conversations || [];
  const totalComments = item.conversations_count || 0;
  const displayedComments = commentsExpanded 
    ? comments.slice(-loadedCommentsCount)
    : comments.slice(-LATEST_COMMENTS_ONLY_COUNT);

  const loadAllComments = () => {
    setLoadedCommentsCount(totalComments);
    setCommentsExpanded(true);
  };

  const showLatestCommentsOnly = () => {
    setLoadedCommentsCount(LATEST_COMMENTS_ONLY_COUNT);
    setCommentsExpanded(false);
  };

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
                    href="javascript:void(0)"
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
            <a 
              onClick={loadAllComments}
              href="javascript:void(0)"
              style={{
                marginLeft: '10px',
                color: '#339fb8',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {totalComments} comments
            </a>
          ) : (
            <a 
              onClick={showLatestCommentsOnly}
              href="javascript:void(0)"
              style={{
                marginLeft: '10px',
                color: '#339fb8',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Hide comments
            </a>
          )}
        </div>
      )}

      {/* Comments Collection */}
      <div 
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
          />
        ))}
      </div>

      {/* Comment Editor */}
      {showCommentsPanel && (
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
          <div style={{
            border: '1px solid #e2e5ea',
            borderRadius: '3px',
            padding: '8px',
            minHeight: '40px',
            backgroundColor: '#fff',
          }}>
            <textarea
              placeholder="Write a comment..."
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: "'Source Sans Pro', sans-serif",
                fontSize: '14px',
                minHeight: '24px',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

