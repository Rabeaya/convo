'use client';

/**
 * Feed Item Component
 * 
 * Displays a single feed item with all its content
 * Migrated from AngularJS cnv-feed-item directive
 * Exact UI match with AngularJS version
 */

import { useState } from 'react';
import { FeedItem as FeedItemType } from '@/lib/api/feed';
import { User } from '@/lib/api/auth';
import CommentsPanel from './CommentsPanel';
import { useFeedContext } from '@/lib/contexts/FeedContext';

interface FeedItemProps {
  item: FeedItemType;
}

// Helper function to get user name from users map
function getUserName(users: Record<string, User>, userId: string): string {
  const user = users[userId];
  if (!user) return 'Unknown';
  return (user as any).name || (user as any).firstName + ' ' + (user as any).lastName || userId;
}

// Helper function to get group name from groups map
function getGroupName(groups: Record<string, any>, groupId: string): string {
  const group = groups[groupId];
  if (!group) return 'Unknown';
  return group.name || groupId;
}

// Helper function to get name by ID (user or group)
function getNameById(users: Record<string, User>, groups: Record<string, any>, id: string): string {
  if (id.indexOf('grp-') === 0 || id.indexOf('g_') === 0) {
    return getGroupName(groups, id);
  } else {
    return getUserName(users, id);
  }
}

export default function FeedItem({ item }: FeedItemProps) {
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const { users, groups } = useFeedContext();

  // Filter out milestones and todos
  if (item.app_instance_id === 3 || item.app_instance_id === 14) {
    return null;
  }

  // Handle different app instance types
  const isNote = item.app_instance_id === 6 || item.app_instance_id === 4 || item.app_instance_id === 23;
  const isChat = item.app_instance_id === 21 || item.app_instance_id === 18 || item.app_instance_id === 9;

  if (!isNote && !isChat) {
    return null;
  }

  const createdBy = item.created_by;
  const updatedBy = item.updated_by;
  const isEdited = createdBy !== updatedBy;
  const isDimmed = item.action === 'DOUBLE_DELETED' || item.deleted === '2';

  return (
    <div 
      className={`feed-item-container row ${isDimmed ? 'dim-feed-item' : ''}`}
      id={item.feed_id}
      style={{
        padding: '0px',
        position: 'relative',
        margin: '15px 0 15px 0',
      }}
    >
      {/* Profile Picture Container */}
      <div 
        className={`dp-container ${isEdited ? 'edited' : 'normal'} ${isDimmed ? 'dim-feed-item' : ''}`}
        style={{
          float: 'left',
          width: '60px',
          height: '60px',
          position: 'relative',
          display: 'block',
          fontSize: '15px',
        }}
      >
        {/* Created By Profile Picture */}
        <a 
          className="dp-wrapper created-by"
          href={`#/feed?filter=user:${createdBy}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '60px',
            width: '60px',
          }}
        >
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#4183d7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '18px',
          }}>
            {createdBy ? createdBy.charAt(0).toUpperCase() : 'U'}
          </div>
        </a>

        {/* Updated By Profile Picture (if edited) */}
        {isEdited && (
          <a 
            className="dp-wrapper edited-by"
            href={`#/feed?filter=user:${updatedBy}`}
            style={{
              position: 'absolute',
              bottom: '-3px',
              right: '-5px',
              height: '35px',
              width: '35px',
            }}
          >
            <div style={{
              width: '35px',
              height: '35px',
              borderRadius: '50%',
              backgroundColor: '#4183d7',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '10px',
            }}>
              {updatedBy ? updatedBy.charAt(0).toUpperCase() : 'U'}
            </div>
          </a>
        )}
      </div>

      {/* Feed Item Content */}
      <div 
        className="feed-item-content-right"
        style={{
          width: '100%',
          float: 'left',
          marginLeft: '12px',
        }}
      >
        {/* Action Items Wrapper (Star, Mute, Options) */}
        <div className="action-items-wrapper" style={{
          position: 'relative',
          float: 'right',
        }}>
          {item.starred === 1 && (
            <i className="cnv-icons-16 icons_Star-blue" style={{
              marginRight: '10px',
              marginBottom: '2px',
              display: 'inline-block',
            }}></i>
          )}
          {item.muted === 1 && (
            <i className="cnv-icons-16 bell-mute" style={{
              marginRight: '10px',
              marginBottom: '2px',
              display: 'inline-block',
            }}></i>
          )}
        </div>

        {/* Shared With Container */}
        <div className="shared-with-container" style={{
          marginTop: '-3px',
          marginBottom: '5px',
          marginRight: '18px',
          lineHeight: '15px',
          color: '#339fb8',
          wordBreak: 'break-all',
        }}>
          <a 
            href={`#/feed?filter=user:${createdBy}`}
            style={{
              color: '#339fb8',
              textDecoration: 'none',
            }}
          >
            {getNameById(users, groups, createdBy)}
          </a>
          <br />
          <span className="grey-txt" style={{ color: '#959595' }}>To</span>
          {item.sharing_info && item.sharing_info.slice(0, 2).map((shareInfo, index) => (
            <span key={index}>
              <a 
                href={`#/feed?filter=${shareInfo.type.toLowerCase()}:${shareInfo.published_to}`}
                style={{
                  color: '#339fb8',
                  textDecoration: 'none',
                }}
              >
                {getNameById(users, groups, shareInfo.published_to)}
              </a>
              {index < Math.min(item.sharing_info.length, 2) - 1 && (
                <span style={{ color: '#959595' }}>,</span>
              )}
            </span>
          ))}
          {item.sharing_info && item.sharing_info.length > 2 && (
            <span className="more-sharing-info">
              <span style={{ color: '#959595' }}>, </span>
              <a href="javascript:void(0)" style={{
                color: '#339fb8',
                textDecoration: 'none',
              }}>
                +{item.sharing_info.length - 2} more
              </a>
            </span>
          )}
          <span className="dot" style={{
            marginLeft: '0px',
            fontSize: '20px',
            color: '#7b8386',
          }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
          <ul style={{
            display: 'inline-flex',
            flexFlow: 'row nowrap',
            padding: '0px 2px 1px 2px',
            margin: '0px 0px 0px -2px',
            borderRadius: '2px',
            listStyleType: 'none',
          }}>
            {item.created_date !== item.last_modified_date && (
              <li className="nobullet" style={{ marginRight: '2px' }}>
                <a className="meta" style={{
                  color: '#7b8386',
                  textDecoration: 'none',
                }}>edited</a>&nbsp;
              </li>
            )}
            <li>
              <a className="meta timestamp" style={{
                color: '#7b8386',
                textDecoration: 'none',
              }}>
                {new Date(item.last_modified_date).toLocaleDateString()}
              </a>
            </li>
          </ul>
        </div>

        {/* Note Content */}
        {isNote && (
          <div 
            className="note"
            style={{
              wordWrap: 'break-word',
              position: 'relative',
              paddingRight: '20px',
            }}
          >
            {/* Title */}
            {item.hierarchy && item.hierarchy[0] && (
              <div className="title-text" style={{
                display: 'block',
                paddingBottom: '3px',
                verticalAlign: 'top',
                wordWrap: 'break-word',
              }}>
                <a 
                  href={`#/post/${item.resource_id}`}
                  className="open-in-detail-view"
                  style={{
                    color: '#339fb8',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                  }}
                >
                  {item.hierarchy[0].searched_title || item.hierarchy[0].title}
                </a>
              </div>
            )}

            {/* Note Details */}
            {item.show_post_contents === 1 && (
              <div className="note-details" style={{
                wordWrap: 'break-word',
                position: 'relative',
                paddingRight: '20px',
              }}>
                <span dangerouslySetInnerHTML={{ 
                  __html: item.search_fragment || item.details || '' 
                }}></span>
              </div>
            )}

            {/* Acknowledge Post Placeholder */}
            {item.show_post_contents === 0 && (
              <div className="note-details ackWrapper" style={{
                color: 'white',
                position: 'relative',
                textAlign: 'center',
                cursor: 'pointer',
              }}>
                <img 
                  src={item.attachment_count > 0 
                    ? '/assets/img/feed/ack_post_attachment.png' 
                    : '/assets/img/feed/ack_post_without_attachment.png'}
                  width="495px"
                  alt="Acknowledge post"
                />
                <div className="ackLabel" style={{
                  position: 'absolute',
                  top: 'calc(50% - 19px)',
                  left: 'calc(50% - 145px)',
                  backgroundColor: '#929191',
                  padding: '10px 30px',
                  borderRadius: '18px',
                  opacity: 0.8,
                }}>
                  <span style={{
                    opacity: 1,
                    width: '230px',
                    display: 'inline-block',
                  }}>
                    Click <u>Acknowledge</u> to view the post
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feed Info Container (Comment, Like, Tags) */}
        {item.show_post_contents === 1 && (
          <div className="feed-info-container" style={{
            clear: 'left',
            marginTop: '0px',
            fontSize: '13px',
          }}>
            <ul style={{
              paddingLeft: '0px',
              margin: '0px',
              listStyle: 'none',
            }}>
              <li style={{ display: 'inline' }}>
                <a 
                  href="javascript:void(0);" 
                  onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                  style={{
                    color: '#7b8386',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Comment
                </a>
              </li>
              <span className="dot" style={{
                color: '#7b8386',
                fontSize: '20px',
              }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
              <li className="nobullet" style={{ display: 'inline' }}>
                <a 
                  href="javascript:void(0);"
                  style={{
                    color: '#7b8386',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Like
                </a>
                {item.like_info.likes_count > 0 && (
                  <span style={{ color: '#7b8386', marginLeft: '5px' }}>
                    ({item.like_info.likes_count})
                  </span>
                )}
              </li>
            </ul>
          </div>
        )}

        {/* Comments Panel */}
        {(item.conversations_count > 0 || item.like_info.likes_count > 0 || showCommentsPanel) && (
          <CommentsPanel 
            item={item}
            showCommentsPanel={showCommentsPanel}
            onToggleComments={() => setShowCommentsPanel(!showCommentsPanel)}
          />
        )}
      </div>

      {/* Feed Divider */}
      <hr className="feed-divider" style={{
        marginTop: '0px',
        marginBottom: '0px',
        borderTop: '1px solid #e2e5ea',
      }} />
    </div>
  );
}

