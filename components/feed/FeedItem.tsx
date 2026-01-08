'use client';

/**
 * Feed Item Component
 * 
 * Displays a single feed item with all its content
 * Migrated from AngularJS cnv-feed-item directive
 * Exact UI match with AngularJS version
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FeedItem as FeedItemType } from '@/lib/api/feed';
import { User } from '@/lib/api/auth';
import CommentsPanel from './CommentsPanel';
import { useFeedContext } from '@/lib/contexts/FeedContext';
import UserProfileImage from '@/components/common/UserProfileImage';
import LikeButton from './LikeButton';
import { likeService } from '@/lib/api/feed';
import FileGallery from './FileGallery';
import FeedItemDropdown, { DropdownOption } from './FeedItemDropdown';
import { itemsService } from '@/lib/api/items';
import { promptModal } from '@/lib/utils/modal';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import CommentOnThisTooltip from '@/components/common/CommentOnThisTooltip';
import { clearNativeSelection, getSelectionDataWithin } from '@/lib/utils/text-selection';
import { rmAllSelections, selectTextNested } from '@/lib/utils/text-selections-engine';
import NoteSnippetPlaybackBanner from '@/components/feed/NoteSnippetPlaybackBanner';

interface FeedItemProps {
  item: FeedItemType;
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

// Helper function to format date as DD/MM/YYYY
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function FeedItem({ item }: FeedItemProps) {
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [localItem, setLocalItem] = useState(item);
  const { users, groups } = useFeedContext();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const snippetReplySetterRef = useRef<((snippetWrapper: any, collaborationInfo: any | null, initialText?: string) => void) | null>(null);
  const noteDetailsRef = useRef<HTMLDivElement>(null);
  const feedItemRef = useRef<HTMLDivElement>(null);
  const [selTooltip, setSelTooltip] = useState<{ portalTarget: HTMLElement; top: number; left: number; beginIndex: number; endIndex: number; text: string } | null>(null);
  const [snippetBanner, setSnippetBanner] = useState<{ visible: boolean; commentId: string; highlightTop: number } | null>(null);

  // IMPORTANT: Memoize the innerHTML object so React does NOT re-apply innerHTML on unrelated state changes.
  // If React re-applies, it wipes our DOM-injected highlight spans (Angular parity requires direct DOM mutation).
  const noteDetailsHtml = useMemo(() => {
    const html = localItem.search_fragment || localItem.details || '';
    return { __html: html };
  }, [localItem.search_fragment, localItem.details]);

  // Reposition selection tooltip on scroll (Angular keeps it visible and moves it)
  useEffect(() => {
    if (!selTooltip) return;
    const onScroll = () => {
      const noteEl = noteDetailsRef.current;
      if (!noteEl) return;
      const data = getSelectionDataWithin(noteEl);
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

  // Update local item when prop changes
  useEffect(() => {
    setLocalItem(item);
  }, [item]);

  const hideSelectionTooltip = () => {
    setSelTooltip(null);
    clearNativeSelection();
  };

  const handlePostSnippetPlayback = (snippetData: any, commentId: string) => {
    const noteEl = noteDetailsRef.current;
    const itemEl = feedItemRef.current;
    if (!noteEl || !itemEl) return;
    if (!snippetData) return;

    const feedScroller = document.getElementById('feedScroller') as HTMLElement | null;
    const scrollContainer = feedScroller || document.documentElement;

    // Angular: textSelections.rmAllSelections() before playback
    rmAllSelections();

    selectTextNested({
      commentId,
      data: snippetData,
      nodes: noteEl,
      scrollContainer,
      highlight: true,
      highlightRemoveTime: null,
      selectionOffset: 150,
      getContent: () => noteEl.textContent || '',
      complete: () => {
        // Match Angular: element.find('.sel-text-highlight').position()
        const hl = noteEl.querySelector(`.${'sel-text-highlight'}`) as HTMLElement | null;
        if (!hl) return;
        let highlightTop = 0;
        let cur: HTMLElement | null = hl;
        while (cur && cur !== itemEl) {
          highlightTop += cur.offsetTop;
          cur = cur.offsetParent as HTMLElement | null;
        }
        setSnippetBanner({ visible: true, commentId, highlightTop });
      },
    });
  };

  const handleLikeClick = async (action: 'like' | 'unlike') => {
    try {
      const title = item.hierarchy?.[0]?.title || '';
      const type = localItem.resource_type || '';
      const response = await likeService.likeResource(
        localItem.feed_id,
        localItem.resource_id,
        localItem.app_instance_id,
        action,
        title,
        type
      );
      return response.data;
    } catch (error) {
      console.error('Failed to like feed item:', error);
      throw error;
    }
  };

  // Filter out milestones and todos
  if (localItem.app_instance_id === 3 || localItem.app_instance_id === 14) {
    return null;
  }

  // Handle different app instance types
  const isNote = localItem.app_instance_id === 6 || localItem.app_instance_id === 4 || localItem.app_instance_id === 23;
  const isChat = localItem.app_instance_id === 21 || localItem.app_instance_id === 18 || localItem.app_instance_id === 9;

  if (!isNote && !isChat) {
    return null;
  }

  // Show dropdown menu only for specific app instance IDs (matches AngularJS feedItemOptionsMenu logic)
  const showFeedItemOptionsMenu = localItem.app_instance_id === 3 || 
                                   localItem.app_instance_id === 4 || 
                                   localItem.app_instance_id === 6 || 
                                   localItem.app_instance_id === 14 || 
                                   localItem.app_instance_id === 23;

  const createdBy = localItem.created_by;
  const updatedBy = localItem.updated_by;
  const isEdited = createdBy !== updatedBy;
  const isDimmed = localItem.action === 'DOUBLE_DELETED' || localItem.deleted === '2';
  const appInstanceId = localItem.app_instance_id;

  // Dropdown options initialization (matches AngularJS initializeDropdownOptions)
  const initializeDropdownOptions = (): DropdownOption[] => {
    const options: DropdownOption[] = [];

    // Open post (not for polls)
    if (appInstanceId !== 23) {
      options.push({
        label: 'Open post',
        icon: 'icons_Post-lightgray',
        iconStyle: 'cnv-icons-16',
        class: 'open-in-detail-view',
        callback: () => {
          // Navigate to post detail view
          const title = localItem.hierarchy?.[0]?.title || '';
          window.location.href = `#/post/${localItem.resource_id}?title=${encodeURIComponent(title)}`;
        }
      });
    }

    // Edit post (only for notes app, not system messages)
    if (appInstanceId === 6 && localItem.data?.is_system_message !== 1) {
      // TODO: Check canEdit permission
      options.push({
        label: 'Edit post',
        icon: 'icons2_Compose-lightgray',
        iconStyle: 'cnv-icons-16',
        class: 'open-in-detail-view',
        callback: () => {
          const title = localItem.hierarchy?.[0]?.title || '';
          window.location.href = `#/post/${localItem.resource_id}?view=Edit&title=${encodeURIComponent(title)}`;
        }
      });
    }

    // Divider before permissions
    if (appInstanceId !== 23) {
      options.push({ isDivider: true });
    }

    // Mute/Unmute notifications
    if (appInstanceId !== 23 && !localItem.viewData?.showManageSubscriptionOption) {
      if (localItem.muted === 0 && localItem.deleted === '0' && localItem.data?.draft === 0) {
        options.push({
          label: 'Mute notifications',
          icon: 'icons2_Mute-lightgray',
          iconStyle: 'cnv-icons-16',
          callback: async () => {
            try {
              await itemsService.mutePost(appInstanceId, localItem.resource_id);
              setLocalItem({ ...localItem, muted: 1 });
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            } catch (error) {
              console.error('Failed to mute post:', error);
            }
          }
        });
      } else if (localItem.muted === 1) {
        options.push({
          label: 'Unmute notifications',
          icon: 'icons2_Speaker-lightgray',
          iconStyle: 'cnv-icons-16',
          callback: async () => {
            try {
              await itemsService.unmutePost(appInstanceId, localItem.resource_id);
              setLocalItem({ ...localItem, muted: 0 });
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            } catch (error) {
              console.error('Failed to unmute post:', error);
            }
          }
        });
      }
    }

    // Star/Unstar
    if (localItem.starred === 1) {
      options.push({
        label: 'Unstar this post',
        icon: 'icons_Star-lightgray',
        iconStyle: 'cnv-icons-16',
        callback: async () => {
          try {
            await itemsService.unStarPost(appInstanceId, localItem.resource_id);
            setLocalItem({ ...localItem, starred: 0 });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
          } catch (error) {
            console.error('Failed to unstar post:', error);
          }
        }
      });
    } else {
      options.push({
        label: 'Star this post',
        icon: 'icons_Star-lightgray',
        iconStyle: 'cnv-icons-16',
        callback: async () => {
          try {
            await itemsService.starPost(appInstanceId, localItem.resource_id);
            setLocalItem({ ...localItem, starred: 1 });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
          } catch (error) {
            console.error('Failed to star post:', error);
          }
        }
      });
    }

    // Divider before delete
    if (appInstanceId !== 23) {
      options.push({ isDivider: true });
    }

    // Copy link
    if (appInstanceId !== 23) {
      options.push({
        label: 'Copy link',
        icon: 'linkhorizontal-lightgray',
        iconStyle: 'cnv-icons-16',
        callback: () => {
          const title = localItem.hierarchy?.[0]?.title || '';
          const url = `${window.location.origin}/#/post/${localItem.resource_id}?title=${encodeURIComponent(title)}`;
          navigator.clipboard.writeText(url);
        }
      });
    }

    // Delete post (if deletable)
    if (localItem.viewData?.deletable) {
      if (localItem.deleted === '1') {
        // Already in trash - show delete permanently
        options.push({
          label: 'Delete permanently',
          icon: 'icons2_Trash-lightgray',
          iconStyle: 'cnv-icons-16',
          callback: () => {
            promptModal(
              'Delete Post',
              'Are you sure you want to delete this post permanently? This cannot be undone.',
              async () => {
                try {
                  await itemsService.deletePermanently(appInstanceId, localItem.resource_id);
                  queryClient.invalidateQueries({ queryKey: ['feed'] });
                } catch (error) {
                  console.error('Failed to delete post permanently:', error);
                }
              },
              null,
              'Delete'
            );
          }
        });
      } else {
        // Not in trash - show move to trash
        options.push({
          label: 'Delete post',
          icon: 'icons2_Trash-lightgray',
          iconStyle: 'cnv-icons-16',
          callback: () => {
            promptModal(
              'Delete Post',
              'Are you sure you want to delete this post?',
              async () => {
                try {
                  await itemsService.moveToTrash(appInstanceId, localItem.resource_id);
                  queryClient.invalidateQueries({ queryKey: ['feed'] });
                } catch (error) {
                  console.error('Failed to move post to trash:', error);
                }
              },
              null,
              'Delete'
            );
          }
        });
      }
    }

    return options;
  };

  const dropdownOptions = showFeedItemOptionsMenu ? initializeDropdownOptions() : [];

  return (
    <div 
      className={`feed-item-container row ${isDimmed ? 'dim-feed-item' : ''}`}
      id={localItem.feed_id}
      ref={feedItemRef}
      style={{
        padding: '0px',
        position: 'relative',
        margin: '15px 0 15px 0',
      }}
    >
      {snippetBanner?.visible && (
        <NoteSnippetPlaybackBanner
          visible={true}
          feedId={localItem.feed_id || null}
          resourceId={localItem.resource_id}
          appInstanceId={localItem.app_instance_id}
          commentId={snippetBanner.commentId}
          highlightTop={snippetBanner.highlightTop}
          onDismiss={() => {
            setSnippetBanner(null);
            rmAllSelections();
          }}
          onBackToComments={() => {
            setSnippetBanner(null);
            rmAllSelections();
            const feedScroller = document.getElementById('feedScroller');
            const commentsContainer = feedItemRef.current?.querySelector('.comments-collection') as HTMLElement | null;
            if (feedScroller && commentsContainer) {
              const scRect = feedScroller.getBoundingClientRect();
              const cRect = commentsContainer.getBoundingClientRect();
              const top = (feedScroller as HTMLElement).scrollTop + (cRect.top - scRect.top) - 100;
              (feedScroller as HTMLElement).scrollTo({ top, behavior: 'smooth' });
            }
          }}
        />
      )}
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
          <UserProfileImage
            userId={createdBy}
            user={users[createdBy]}
            width={60}
            height={60}
            source="Feed"
          />
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
            <UserProfileImage
              userId={updatedBy}
              user={users[updatedBy]}
              width={32}
              height={32}
              source="Feed"
              showBorder={true}
            />
          </a>
        )}
      </div>

      {/* Feed Item Content */}
      <div 
        className="feed-item-content-right"
        style={{
          width: '495px',
          float: 'left',
          marginLeft: '12px',
        }}
      >
        {/* Action Items Wrapper (Star, Mute, Options) */}
        <div className="action-items-wrapper" style={{
          position: 'relative',
          float: 'right',
        }}>
          {localItem.starred === 1 && (
            <i className="cnv-icons-16 icons_Star-blue" style={{
              marginRight: '10px',
              marginBottom: '2px',
              display: 'inline-block',
            }}></i>
          )}
          {localItem.muted === 1 && (
            <i className="cnv-icons-16 bell-mute" style={{
              marginRight: '10px',
              marginBottom: '2px',
              display: 'inline-block',
            }}></i>
          )}
          {localItem.muted === 0 && localItem.viewData?.showManageSubscriptionOption && (
            <i className="cnv-icons-16 bell" style={{
              marginRight: '10px',
              marginBottom: '2px',
              display: 'inline-block',
            }}></i>
          )}
          {/* Feed Item Options Dropdown - matches AngularJS cnv-dropdowns */}
          {showFeedItemOptionsMenu && dropdownOptions.length > 0 && (
            <div className="feed-item-options-menu-container" style={{
              display: 'inline-block',
              marginLeft: '5px',
            }}>
              <FeedItemDropdown
                options={dropdownOptions}
                align="right"
                ddType="more-options"
              />
            </div>
          )}
        </div>

        {/* Shared With Container */}
        <div className="shared-with-container" style={{
          marginTop: '-3px',
          marginBottom: '5px',
          marginRight: '18px',
          lineHeight: '15px',
          color: 'rgb(51, 113, 189)', // Theme color
          wordBreak: 'break-all',
        }}>
          <a 
            href={`#/feed?filter=user:${createdBy}`}
            style={{
              color: 'rgb(51, 113, 189)', // Theme color
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
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
                  color: 'rgb(51, 113, 189)', // Theme color
                  textDecoration: 'none',
                  marginLeft: '4px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
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
              <a 
                href="#" 
                style={{
                  color: 'rgb(51, 113, 189)', // Theme color
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
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
                {formatDate(item.last_modified_date)}
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
                    color: 'rgb(51, 113, 189)', // Theme color (@link-color / @cnv-blue-dark)
                    fontWeight: 'bold',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                    e.currentTarget.style.color = 'rgb(65, 131, 215)'; // @cnv-blue on hover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                    e.currentTarget.style.color = 'rgb(51, 113, 189)'; // Back to theme color
                  }}
                >
                  {item.hierarchy[0].searched_title || item.hierarchy[0].title}
                </a>
              </div>
            )}

            {/* Note Details */}
            {item.show_post_contents === 1 && (
              <div
                className="note-details"
                ref={noteDetailsRef}
                onMouseUp={() => {
                  // Angular mkTxtSnippet triggers on mouseup with setTimeout 0
                  setTimeout(() => {
                    const noteEl = noteDetailsRef.current;
                    if (!noteEl) return;
                    const data = getSelectionDataWithin(noteEl);
                    if (!data) return;
                    if (data.beginIndex >= data.endIndex) return;
                    if (!data.text || data.text.trim() === '') return;

                    // Tooltip is appended to <body> in Angular; position is absolute in page coords.
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
                paddingRight: '20px',
                marginTop: '0px',
                color: '#272b2c', // @text-color - matches AngularJS
              }}
              >
                <span dangerouslySetInnerHTML={noteDetailsHtml}></span>
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

            {/* File Gallery - matches AngularJS cnv-note-gallery */}
            {localItem.data?.files && localItem.data.files.length > 0 && (
              <FileGallery
                files={localItem.data.files}
                noteId={localItem.resource_id}
                resourceType={localItem.resource_type}
                appId={localItem.app_instance_id}
                isActivatedPinnedPost={false}
              />
            )}
          </div>
        )}

        {/* Feed Info Container (Comment, Like, Tags) */}
        {localItem.show_post_contents === 1 && (
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
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    setShowCommentsPanel(!showCommentsPanel);
                  }}
                  className="meta"
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
                color: '#959595',
                fontSize: '20px',
              }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
              <li className="nobullet" style={{ display: 'inline' }}>
                <LikeButton 
                  likeInfo={localItem.like_info} 
                  onLikeClick={handleLikeClick}
                />
              </li>
            </ul>
          </div>
        )}

        {/* Comments Panel - Always show if show_post_contents == 1 (matches AngularJS) */}
        {localItem.show_post_contents === 1 && (
          <CommentsPanel 
            item={localItem}
            showCommentsPanel={showCommentsPanel}
            onToggleComments={() => setShowCommentsPanel(!showCommentsPanel)}
            snippetReplySetterRef={snippetReplySetterRef}
            onPostSnippetPlayback={handlePostSnippetPlayback}
          />
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
                  snippetId,
                },
              },
              fileViewerTextAnnotation: true,
              classes: 'detail_snippet',
            };

            // Angular: showAndActivateCommentsPanel('', true)
            snippetReplySetterRef.current?.(snippetWrapper, null, '');
            hideSelectionTooltip();
          }}
        />
      )}

      {/* Feed Divider - Always show (matches AngularJS) */}
      <hr className="feed-divider" style={{
        marginTop: '0px',
        marginBottom: '0px',
        borderTop: '1px solid #e2e5ea',
        borderBottom: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        width: '100%',
      }} />
    </div>
  );
}
