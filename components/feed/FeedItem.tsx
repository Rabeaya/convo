'use client';

/**
 * Feed Item Component
 * 
 * Displays a single feed item with all its content
 * Migrated from AngularJS cnv-feed-item directive
 * Exact UI match with AngularJS version
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeedItem as FeedItemType } from '@/lib/api/feed';
import { User } from '@/lib/api/auth';
import CommentsPanel from './CommentsPanel';
import { useFeedContext } from '@/lib/contexts/FeedContext';
import UserProfileImage from '@/components/common/UserProfileImage';
import LikeButton from './LikeButton';
import { likeService } from '@/lib/api/feed';
import FileGallery from './FileGallery';
import FeedItemDropdown, { DropdownOption } from './FeedItemDropdown';
import { ItemsService } from '@/lib/api/items';
import { itemsService } from '@/lib/api/items';
import { addTagsModal, likeInfoModal, shareWithOthersModal } from '@/lib/utils/modal';
import { bannerService } from '@/lib/utils/banner-service';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import CommentOnThisTooltip from '@/components/common/CommentOnThisTooltip';
import { clearNativeSelection, getSelectionDataWithin } from '@/lib/utils/text-selection';
import { rmAllSelections, selectTextNested } from '@/lib/utils/text-selections-engine';
import NoteSnippetPlaybackBanner from '@/components/feed/NoteSnippetPlaybackBanner';
import { rewriteConvoFilesToProxy } from '@/lib/utils/rich-text';
import { formatDateAgo } from '@/lib/utils/dateFormat';
import type { CommentsPanelHandle } from './CommentsPanel';

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

export default function FeedItem({ item }: FeedItemProps) {
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [localItem, setLocalItem] = useState(item);
  const { users, groups } = useFeedContext();
  const { user, loginData, account } = useAuthStore();
  const queryClient = useQueryClient();
  
  // Get auth data for API calls
  const authToken = loginData?.xmpp_session_token;
  const userID = (user as any)?.user_id || (user as any)?.userId;
  const accountID = (account as any)?.account_id;
  const snippetReplySetterRef = useRef<((snippetWrapper: any, collaborationInfo: any | null, initialText?: string) => void) | null>(null);
  const noteDetailsRef = useRef<HTMLDivElement>(null);
  const feedItemRef = useRef<HTMLDivElement>(null);
  const commentsPanelRef = useRef<CommentsPanelHandle | null>(null);
  const [selTooltip, setSelTooltip] = useState<{ portalTarget: HTMLElement; top: number; left: number; beginIndex: number; endIndex: number; text: string } | null>(null);
  const [snippetBanner, setSnippetBanner] = useState<{ visible: boolean; commentId: string; highlightTop: number } | null>(null);
  const [ackCallInProgress, setAckCallInProgress] = useState(false);

  // IMPORTANT: Memoize the innerHTML object so React does NOT re-apply innerHTML on unrelated state changes.
  // If React re-applies, it wipes our DOM-injected highlight spans (Angular parity requires direct DOM mutation).
  const noteDetailsHtml = useMemo(() => {
    const html = localItem.search_fragment || localItem.details || '';
    // Angular parity: allow rich HTML; rewrite inline file URLs to same-origin proxy so images/snippets load on localhost.
    return { __html: rewriteConvoFilesToProxy(html) };
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

  // Helper function to perform scroll and activate editor (extracted for reuse)
  const performScrollAndActivate = useCallback((editorEl: HTMLElement, doActivate: () => void) => {
    const feedScroller = document.getElementById('feedScroller') as HTMLElement | null;
    const animateScroll = (el: HTMLElement, to: number, duration: number, cb: () => void) => {
      const start = el.scrollTop;
      const delta = to - start;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        el.scrollTop = start + delta * p;
        if (p < 1) requestAnimationFrame(tick);
        else cb();
      };
      requestAnimationFrame(tick);
    };

    if (feedScroller) {
      const scRect = feedScroller.getBoundingClientRect();
      const edRect = editorEl.getBoundingClientRect();
      const offsetTop = edRect.top - scRect.top + feedScroller.scrollTop;
      const winInnerHeight = feedScroller.clientHeight;
      const scrollTop = feedScroller.scrollTop;
      if (offsetTop + 150 > scrollTop + winInnerHeight) {
        animateScroll(feedScroller, offsetTop - winInnerHeight + 210, 200, doActivate);
      } else {
        doActivate();
      }
    } else {
      // Fallback to window scroll if feedScroller isn't present
      const rect = editorEl.getBoundingClientRect();
      const offsetTop = rect.top + window.scrollY;
      const winInnerHeight = window.innerHeight;
      const scrollTop = window.scrollY;
      if (offsetTop + 150 > scrollTop + winInnerHeight) {
        window.scrollTo({ top: offsetTop - winInnerHeight + 210, behavior: 'smooth' });
        window.setTimeout(doActivate, 200);
      } else {
        doActivate();
      }
    }
  }, []);

  // Angular parity: cnvFeedItem.js -> showAndActivateCommentsPanel()
  // Angular uses $broadcast('render') to ensure DOM is updated before scrolling
  const showAndActivateCommentsPanel = useCallback((initialContent?: string) => {
    setShowCommentsPanel(true);

    // Use double requestAnimationFrame to ensure React has rendered and DOM is updated
    // (matches Angular's $broadcast('render') behavior)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const doActivate = () => {
          commentsPanelRef.current?.activateEditor(initialContent || '', true);
        };

        const root = feedItemRef.current;
        
        // Check if panel is visible before trying to find editor
        const isPanelVisible = commentsPanelRef.current?.isPanelVisible?.() ?? false;
        if (!isPanelVisible) {
          // Wait for panel to become visible
          window.setTimeout(() => {
            const retryVisible = commentsPanelRef.current?.isPanelVisible?.() ?? false;
            if (retryVisible) {
              const editorEl = root?.querySelector('.feed-comment-editor') as HTMLElement | null;
              if (editorEl) {
                performScrollAndActivate(editorEl, doActivate);
              } else {
                doActivate();
              }
            } else {
              doActivate();
            }
          }, 50);
          return;
        }

        const editorEl = root?.querySelector('.feed-comment-editor') as HTMLElement | null;
        
        if (!editorEl) {
          // If editor not found, wait a bit more and retry (panel might still be rendering)
          window.setTimeout(() => {
            const retryEl = root?.querySelector('.feed-comment-editor') as HTMLElement | null;
            if (retryEl) {
              performScrollAndActivate(retryEl, doActivate);
            } else {
              // If still not found, just activate (editor will be focused when it appears)
              doActivate();
            }
          }, 50);
          return;
        }

        performScrollAndActivate(editorEl, doActivate);
      });
    });
  }, [performScrollAndActivate]);

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
      // Angular: if unlike causes likes to reach 0 and no comments, hide comments panel wrapper.
      if (action === 'unlike') {
        const currentTotalLikes =
          (localItem.like_info?.likes_count || 0) + (localItem.like_info?.sub_res_like_count || 0);
        if (currentTotalLikes <= 1 && (localItem.conversations_count || 0) === 0) {
          setShowCommentsPanel(false);
        }
      }
      // Angular: acknowledge posts trigger refreshFeed on like.
      if (localItem.data?.is_acknowledge_post == 1) {
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      }
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

  // Helper functions (matches AngularJS logic)
  const toInt = (v: any) => {
    const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const checkBitAt = (mask: any, bitIndex: number) => {
    if (mask && typeof mask.checkBitAt === 'function') return !!mask.checkBitAt(bitIndex);
    const m = toInt(mask);
    return (m & (1 << (bitIndex - 1))) !== 0;
  };

  // Helper function to compute permissionsDropdownIconConditions (matches AngularJS evaluatePostPermissions)
  const computePermissionsDropdownIconConditions = useCallback((itemData: any): Record<string, boolean> => {
    const itemPerms = itemData.permissions;
    const itemEnableSharing = itemData.enable_sharing === 1 || itemData.enable_sharing === true || itemData.enableSharing === 1;
    
    // Angular: Only ONE permission level should be checked at a time
    // Reset all to false first, then set the active one based on priority
    const conditions: Record<string, boolean> = {
      canEdit: false,
      canComment: false,
      canView: false,
      enableSharing: !!itemEnableSharing,
    };
    
    // Check permissions in priority order (canEdit > canComment > canView)
    if (checkBitAt(itemPerms, 3)) {
      conditions.canEdit = true;
    } else if (checkBitAt(itemPerms, 2)) {
      conditions.canComment = true;
    } else if (checkBitAt(itemPerms, 1)) {
      conditions.canView = true;
    }
    
    return conditions;
  }, []);

  // Compute permissionsDropdownIconConditions once (matches AngularJS evaluatePostPermissions)
  const anyItem: any = localItem as any;
  const loggedPerms = anyItem.logged_in_user_permissions ?? anyItem.loggedInUserPermissions;
  const perms = anyItem.permissions;
  const canEdit = checkBitAt(loggedPerms, 3);
  const canComment = checkBitAt(loggedPerms, 2);
  const canView = checkBitAt(loggedPerms, 1);
  const canChangePermissions = !!anyItem.can_change_permissions;
  const enableSharing = anyItem.enable_sharing === 1 || anyItem.enable_sharing === true || anyItem.enableSharing === 1;
  const isSystemMessage = anyItem.is_system_message === 1 || anyItem.data?.is_system_message === 1;

  // Compute conditions for current item state
  const [permissionsDropdownIconConditions, setPermissionsDropdownIconConditions] = useState<Record<string, boolean>>(
    () => computePermissionsDropdownIconConditions(anyItem)
  );

  // Update conditions when localItem changes
  useEffect(() => {
    const updatedConditions = computePermissionsDropdownIconConditions(localItem as any);
    setPermissionsDropdownIconConditions(updatedConditions);
  }, [localItem, computePermissionsDropdownIconConditions]);

  // Dropdown options initialization (matches AngularJS initializeDropdownOptions)
  const initializeDropdownOptions = (): DropdownOption[] => {
    const options: DropdownOption[] = [];
    const currentUserId = (user as any)?.user_id || (user as any)?.userId || '';
    const isAdminMode = !!(loginData as any)?.is_administration_mode;

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

    // Permissions submenu (Angular: only if can_change_permissions)
    if (canChangePermissions && appInstanceId !== 23) {
      const submenu: DropdownOption[] = [];
      if (!isSystemMessage && appInstanceId !== 23) {
        submenu.push({
          label: 'Can edit and comment',
          icon: 'icon-cnv-tick',
          iconStyle: 'cnv-icons-12',
          conditionalLabelIcon: true,
          condition: 'canEdit',
          callback: async () => {
            console.log('Changing permissions to canEdit (7)');
            try {
              const response = await itemsService.changePermissions(ItemsService.canEdit, appInstanceId, localItem.resource_id, enableSharing, authToken, userID, accountID);
              console.log('Change permissions response:', response);
              // Angular: response.data.item contains updated permissions
              // Angular structure: promise.then(function(response) { response.data.item })
              // Our structure: { data: {...}, status: ... } where data is the JSON response from backend
              // Backend returns: { data: { item: {...} } }
              // So: response.data.data.item
              const responseItem = response.data?.data?.item || response.data?.item;
              if (responseItem) {
                const updatedItem: any = {
                  ...localItem,
                  permissions: responseItem.permissions,
                  logged_in_user_permissions: responseItem.logged_in_user_permissions,
                  enable_sharing: responseItem.enable_sharing,
                };
                setLocalItem(updatedItem);
                // Recompute conditions (matches Angular's evaluatePostPermissions)
                const updatedConditions = computePermissionsDropdownIconConditions(updatedItem);
                setPermissionsDropdownIconConditions(updatedConditions);
                // Angular: bannerService.showBanner('Permissions updated')
                console.log('Permissions updated successfully');
              } else {
                console.warn('No item in response:', response);
              }
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            } catch (e) {
              console.error('Failed to change permissions:', e);
              throw e; // Re-throw to let caller know it failed
            }
          },
        });
      }
      submenu.push({
        label: 'Comment only',
        icon: 'icon-cnv-tick',
        iconStyle: 'cnv-icons-12',
        conditionalLabelIcon: true,
        condition: 'canComment',
          callback: async () => {
            console.log('Changing permissions to canComment (3)');
            try {
              const response = await itemsService.changePermissions(ItemsService.canComment, appInstanceId, localItem.resource_id, enableSharing, authToken, userID, accountID);
              console.log('Change permissions response:', response);
              // Angular: response.data.item contains updated permissions
              const responseItem = response.data?.item || response.data?.data?.item;
              if (responseItem) {
                const updatedItem: any = {
                  ...localItem,
                  permissions: responseItem.permissions,
                  logged_in_user_permissions: responseItem.logged_in_user_permissions,
                  enable_sharing: responseItem.enable_sharing,
                };
                setLocalItem(updatedItem);
                // Recompute conditions (matches Angular's evaluatePostPermissions)
                const updatedConditions = computePermissionsDropdownIconConditions(updatedItem);
                setPermissionsDropdownIconConditions(updatedConditions);
                // Angular: bannerService.showBanner('Permissions updated')
                console.log('Permissions updated successfully');
              } else {
                console.warn('No item in response:', response);
              }
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            } catch (e) {
              console.error('Failed to change permissions:', e);
              throw e; // Re-throw to let caller know it failed
            }
          },
      });
      submenu.push({
        label: 'View only',
        icon: 'icon-cnv-tick',
        iconStyle: 'cnv-icons-12',
        conditionalLabelIcon: true,
        condition: 'canView',
          callback: async () => {
            console.log('Changing permissions to canView (1)');
            try {
              const response = await itemsService.changePermissions(ItemsService.canView, appInstanceId, localItem.resource_id, enableSharing, authToken, userID, accountID);
              console.log('Change permissions response:', response);
              // Angular: response.data.item contains updated permissions
              const responseItem = response.data?.item || response.data?.data?.item;
              if (responseItem) {
                const updatedItem: any = {
                  ...localItem,
                  permissions: responseItem.permissions,
                  logged_in_user_permissions: responseItem.logged_in_user_permissions,
                  enable_sharing: responseItem.enable_sharing,
                };
                setLocalItem(updatedItem);
                // Recompute conditions (matches Angular's evaluatePostPermissions)
                const updatedConditions = computePermissionsDropdownIconConditions(updatedItem);
                setPermissionsDropdownIconConditions(updatedConditions);
                // Angular: bannerService.showBanner('Permissions updated')
                console.log('Permissions updated successfully');
              } else {
                console.warn('No item in response:', response);
              }
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            } catch (e) {
              console.error('Failed to change permissions:', e);
              throw e; // Re-throw to let caller know it failed
            }
          },
      });

      const isCreator = currentUserId && (currentUserId === localItem.created_by || currentUserId === (anyItem.integration_creator_id || ''));
      if (!isSystemMessage && appInstanceId !== 23 && (isCreator || isAdminMode)) {
        submenu.push({ isDivider: true });
        submenu.push({
          label: 'Enable sharing',
          icon: 'icon-cnv-tick',
          iconStyle: 'cnv-icons-12',
          conditionalLabelIcon: true,
          condition: 'enableSharing',
          callback: async () => {
            console.log('Toggling enableSharing');
            try {
              // Angular: Toggle enableSharing (current value ? 0 : 1)
              const newEnableSharing = !enableSharing;
              const response = await itemsService.changePermissions(toInt(perms), appInstanceId, localItem.resource_id, newEnableSharing, authToken, userID, accountID);
              console.log('Change permissions response:', response);
              // Angular: response.data.item contains updated permissions
              const responseItem = response.data?.item || response.data?.data?.item;
              if (responseItem) {
                const updatedItem: any = {
                  ...localItem,
                  permissions: responseItem.permissions,
                  logged_in_user_permissions: responseItem.logged_in_user_permissions,
                  enable_sharing: responseItem.enable_sharing,
                };
                setLocalItem(updatedItem);
                // Recompute conditions (matches Angular's evaluatePostPermissions)
                const updatedConditions = computePermissionsDropdownIconConditions(updatedItem);
                setPermissionsDropdownIconConditions(updatedConditions);
                // Angular: bannerService.showBanner('Permissions updated')
                console.log('Permissions updated successfully');
              } else {
                console.warn('No item in response:', response);
              }
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            } catch (e) {
              console.error('Failed to change permissions:', e);
              throw e; // Re-throw to let caller know it failed
            }
          },
        });
      }

      options.push({
        label: 'Permissions',
        icon: 'icons_Lock-lightgray',
        iconStyle: 'cnv-icons-16',
        class: 'sharing_preferences pseudo-submenu-arrow',
        submenu,
        conditionalLabelIcon: false,
        // condition handled at render time via FeedItemDropdown.conditions
      });
    }

    // Divider before mute/etc
    if (appInstanceId !== 23) options.push({ isDivider: true });

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

    // Manage Notifications (Angular)
    if (localItem.muted === 0 && localItem.viewData?.showManageSubscriptionOption && localItem.deleted === '0' && localItem.data?.draft === 0) {
      options.push({
        label: 'Manage Notifications',
        icon: 'bell',
        iconStyle: 'cnv-icons-16',
        callback: () => {
          // TODO: Implement notifications modal parity (Angular openNotificationsModal)
        },
      });
    }

    // Add tags
    if (canEdit && !isSystemMessage) {
      options.push({
        label: 'Add tags',
        icon: 'icon_tag-01-01-lightgray',
        iconStyle: 'cnv-icons-16',
        callback: () => {
          addTagsModal({
            initialTags: String((anyItem.tags as any) || ''),
            onSubmit: async (tagsCsv) => {
              await itemsService.updateTags(null, tagsCsv, appInstanceId, localItem.resource_id);
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            },
          });
        },
      });
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

    // Share with others
    const deletedNumForSharing = String(localItem.deleted || '0');
    if (
      deletedNumForSharing === '0' &&
      !isSystemMessage &&
      (enableSharing || isAdminMode || localItem.created_by === currentUserId)
    ) {
      options.push({
        label: 'Share with others',
        icon: 'icons2_Share-lightgray',
        iconStyle: 'cnv-icons-16',
        callback: () => {
          shareWithOthersModal({
            sharingInfo: (localItem.sharing_info || []) as any,
            users,
            groups,
            currentUserId,
            onSubmit: async (nextSharingInfo) => {
              await itemsService.updateSharingInfo(localItem.feed_id || null, nextSharingInfo as any, appInstanceId, localItem.resource_id);
              queryClient.invalidateQueries({ queryKey: ['feed'] });
            },
          });
        },
      });
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

    // Delete post (if deletable) - matches AngularJS line 1989: if ($scope.itemData.deletable)
    // AngularJS checks itemData.deletable directly, not viewData.deletable
    // AngularJS shows "Delete post" when deleted != 1, "Delete permanently" when deleted == 1
    // But user wants only "Delete" option, so we'll only show delete for non-deleted items
    const isDeletable = localItem.deletable || localItem.viewData?.deletable;
    const deletedNum = String(localItem.deleted || '0');
    
    // Only show delete option for items that are not deleted (deleted == 0)
    // Items with deleted == 1 are already in trash and shouldn't appear in normal feed
    if (isDeletable && deletedNum === '0') {
      // Not in trash - show delete option (matches AngularJS line 1997-2007)
      // AngularJS adds a divider before "Delete post" when deleted != 1
      // AngularJS line 2107-2113: moveToTrash() is called directly WITHOUT prompt modal
      // AngularJS: No confirmation popup - delete immediately and show banner
      options.push({ isDivider: true });
      options.push({
        label: 'Delete',
        icon: 'icons2_Trash-lightgray',
        iconStyle: 'cnv-icons-16',
        callback: async () => {
          // AngularJS: bannerService.showBanner_promise(promise, 'Moving to trash...', message, ...)
          const message = (localItem as any).origin > 0 
            ? 'Moved successfully to Trash folder of email client' 
            : 'Moved to trash';
          
          const promise = itemsService.moveToTrash(
            appInstanceId, 
            localItem.resource_id,
            authToken,
            userID,
            accountID
          );
          
          // Show banner with promise - "Moving to trash..." then message on success
          bannerService.showBanner_promise(
            promise,
            'Moving to trash...',
            message,
            'Error... click here to try again.',
            false,
            false,
            () => {
              // Retry on error click
              options[options.length - 1].callback?.();
            }
          );
          
          try {
            await promise;
            // The item will be removed from feed on next poll, or we can update localItem.deleted
            setLocalItem({ ...localItem, deleted: '1' });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
          } catch (error: any) {
            console.error('Failed to move post to trash:', error);
            // Error banner already shown by bannerService
          }
        }
      });
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
                conditions={permissionsDropdownIconConditions}
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
                {/* Angular: `itemData.last_modified_date | dateAgo:server_now_timestamp:true` */}
                {formatDateAgo(item.last_modified_date as any, undefined, true)}
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
              <div
                className="note-details ackWrapper"
                onClick={() => {
                  // Angular: ng-click="onLikeClick('like')"
                  if (ackCallInProgress) return;
                  setAckCallInProgress(true);
                  handleLikeClick('like')
                    .finally(() => setAckCallInProgress(false));
                }}
                style={{
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
                {!ackCallInProgress ? (
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
                ) : (
                  <div className="spinnerWrap" style={{
                    position: 'absolute',
                    top: 'calc(50% - 7px)',
                    left: 'calc(50% - 7px)',
                  }}>
                    <span className="cnv-spinner"></span>
                  </div>
                )}
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
                    showAndActivateCommentsPanel('');
                  }}
                  className="meta"
                  style={{
                    color: 'rgb(51, 113, 189)', // Theme color (match Like link)
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
                  Comment
                </a>
              </li>
              {/* Angular: dot shown if not ack post OR (ack post and has views) */}
              {(localItem.data?.is_acknowledge_post != 1 || (localItem.like_info?.likes_count && localItem.data?.is_acknowledge_post == 1)) && (
                <span className="dot" style={{
                  color: '#959595',
                  fontSize: '20px',
                }}>&nbsp;&nbsp;&#8226;&nbsp;&nbsp;</span>
              )}

              <li className="nobullet" style={{ display: 'inline' }}>
                {localItem.data?.is_acknowledge_post != 1 ? (
                  <LikeButton 
                    likeInfo={localItem.like_info}
                    onLikeClick={handleLikeClick}
                    onLikeInfoChange={(next) => {
                      setLocalItem((prev) => ({ ...prev, like_info: { ...prev.like_info, ...next } }));
                    }}
                  />
                ) : (
                  // Angular: show Views link instead of Like button
                  (localItem.like_info?.likes_count ? (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        likeInfoModal({
                          kind: 'post',
                          pathId: localItem.resource_id,
                          resourceId: localItem.resource_id,
                          appInstanceId: localItem.app_instance_id,
                          includeSubResources: 1,
                          isViewMode: true,
                        });
                      }}
                      style={{
                        color: 'rgb(51, 113, 189)',
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      {Number(localItem.like_info.likes_count) > 1
                        ? `${localItem.like_info.likes_count} Views`
                        : `${localItem.like_info.likes_count} View`}
                    </a>
                  ) : null)
                )}
              </li>
            </ul>
          </div>
        )}

        {/* Comments Panel - Always show if show_post_contents == 1 (matches AngularJS) */}
        {localItem.show_post_contents === 1 && (
          <CommentsPanel 
            ref={commentsPanelRef as any}
            item={localItem}
            showCommentsPanel={showCommentsPanel}
            onToggleComments={() => {
              // Only close if comment editor is not dirty (has no text, files, or snippets)
              // This matches Angular's _checkIsDirty logic
              const commentEditor = commentsPanelRef.current;
              if (commentEditor && typeof (commentEditor as any).checkIsDirty === 'function') {
                const isDirty = (commentEditor as any).checkIsDirty();
                if (!isDirty) {
                  setShowCommentsPanel(false);
                }
              } else {
                // Fallback: close if no files are uploading
                setShowCommentsPanel(false);
              }
            }}
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
