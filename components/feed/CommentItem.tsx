'use client';

/**
 * Comment Item Component
 * 
 * Displays a single comment with threading support
 * Migrated from AngularJS cnv-comment directive
 */

import { Comment } from '@/lib/api/feed';
import { User } from '@/lib/api/auth';
import { useFeedContext } from '@/lib/contexts/FeedContext';

interface CommentItemProps {
  comment: Comment;
  resourceId: string;
  appInstanceId: number;
}

// Helper function to get user name from users map
function getUserName(users: Record<string, User>, userId: string): string {
  const user = users[userId];
  if (!user) return 'Unknown';
  return (user as any).name || (user as any).firstName + ' ' + (user as any).lastName || userId;
}

export default function CommentItem({ comment, resourceId, appInstanceId: _appInstanceId }: CommentItemProps) {
  const { users } = useFeedContext();
  const isDeleted = comment.update_kind === 2;
  const isReply = !!comment.thread_root_comment_id;
  const isEdited = comment.update_timestamp > comment.creation_timestamp;

  return (
    <div 
      className={`comment-cont ${isReply ? 'replied-comment-pointer' : ''}`}
      style={{
        backgroundColor: '#f2f4f8',
        position: 'relative',
      }}
    >
      <div 
        className={`comment ${comment.uid}`}
        style={{
          position: 'relative',
          padding: '10px 0px',
          borderBottom: '1px solid #e6e8ec',
          width: '473px',
        }}
      >
        {/* Profile Picture */}
        <span className="pic_container" style={{
          display: 'block',
          float: 'left',
          marginRight: '10px',
          marginLeft: '10px',
          width: '40px',
          height: '40px',
        }}>
          <a href={`#/feed?filter=user:${comment.from_user}`}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#4183d7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '14px',
            }}>
              {comment.from_user ? comment.from_user.charAt(0).toUpperCase() : 'U'}
            </div>
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
            <div 
              className="comment-inner text"
              dangerouslySetInnerHTML={{ 
                __html: comment.comment_text_less || comment.comment_text || '' 
              }}
              style={{
                display: 'block',
                color: '#272b2c',
              }}
            ></div>
          </div>

          {/* Action Line */}
          <div className="action_line" style={{
            color: '#596d97',
            margin: '5px 0',
          }}>
            <span className="meta comment_info">
              <a 
                className="meta"
                href={`#/feed?filter=user:${comment.from_user}`}
                style={{
                  color: '#7b8386',
                  textDecoration: 'none',
                }}
              >
                {getUserName(users, comment.from_user)}
              </a>
              {!comment.is_posting && (
                <>
                  <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                  {isDeleted ? (
                    <span>deleted&nbsp;&nbsp;&#8226;</span>
                  ) : (
                    <>
                      {isEdited && (
                        <a 
                          className="meta"
                          href={`#/post/${resourceId}/comment/${comment.uid}`}
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
                        href={`#/post/${resourceId}/comment/${comment.uid}`}
                        style={{
                          color: '#7b8386',
                          textDecoration: 'none',
                        }}
                      >
                        {new Date(comment.update_timestamp).toLocaleDateString()}
                      </a>
                    </>
                  )}
                </>
              )}
            </span>
            {!isDeleted && (
              <>
                <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                <span>
                  <a 
                    href="javascript:void(0)" 
                    className="reply-btn hover_underline"
                    style={{
                      color: '#339fb8',
                      cursor: 'pointer',
                      textDecoration: 'none',
                    }}
                  >
                    Reply
                  </a>
                </span>
                {comment.like_info.likes_count > 0 && (
                  <>
                    <span style={{ color: '#959595' }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
                    <span className="likes_count" style={{
                      color: '#339fb8',
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
                        color: '#339fb8',
                      }}>{comment.like_info.likes_count}</span>
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

