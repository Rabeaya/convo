'use client';

/**
 * ChatListWindow - EXACT replication of AngularJS cnvChatUsersWindow
 * Template: cnvChatUsersWindow.tpl.html
 * Styles: chatUsersWindow.less
 * 
 * Scroll behavior matches AngularJS:
 * - Uses auto-hiding scrollbar (autoHidingScrollBar directive)
 * - Scroll container: #chatsListScroller with overflow-y: scroll
 * - Scrollbar appears only when content overflows
 */

  import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
  import { useChatList } from '@/contexts/ChatListContext';
  import { xmppChatService } from '@/utils/xmppChatService';
  import ChatListItem from './ChatListItem';
  import UserListItem from './UserListItem';
  import { useChatWindows } from '@/contexts/ChatWindowsContext';
  import { sortChats, sortUsers } from '@/utils/chatSorting';
  import { generateChatId, getCurrentUserJid, getCurrentUserId } from '@/utils/chatUtils';
  import type { Chat, NetworkUser } from '@/types/chat';
  import { useAutoHidingScrollbar } from '@/hooks/useAutoHidingScrollbar';
  import './ChatListWindow.css';
  import './ChatListWindow-icons.css';
  
  interface ChatListWindowProps {
    onMinimizeChange?: (isMinimized: boolean) => void;
  }

  export default function ChatListWindow({ onMinimizeChange }: ChatListWindowProps = {} as ChatListWindowProps) {
    // AngularJS cnvWindowMaximizeMinimizeManager initializes the chat list window in minimized state.
    const [isMinimized, setIsMinimized] = useState(true);
    // Keep siblings visible during the minimize animation, then hide after 200ms (matches AngularJS)
    const [showBody, setShowBody] = useState(false);
    // Height is stretchable in-place (matches AngularJS vertical resizer + maximizeWindow clamp)
    const [listHeight, setListHeight] = useState(350);
    const [isExpanded, setIsExpanded] = useState(false);
    const prevHeightRef = useRef(350);
    const dragRef = useRef<{ startY: number; startH: number } | null>(null);
    const [searchText, setSearchText] = useState('');
    const { chats, users, isLoading, error, selectedChatId, selectedUserId, selectChat, selectUser } = useChatList();
    const { openChatWindow } = useChatWindows();
    const rootRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Header color state (matches AngularJS cnvChatUsersWindow.js + chatUsersWindow.less)
    // - Focused (no class): @cnv-chat-focused-color (from colorProfile.less) → #4183d7
    // - Unfocused: .unfocused-state → @cnv-chat-unfocused-color → #1e2e3d
    // - Unread: .unread-state → @cnv-chat-unread-color → #3371bd
    const CNV_CHAT_FOCUSED_COLOR = '#4183d7';
    const CNV_CHAT_UNFOCUSED_COLOR = '#1e2e3d';
    const CNV_CHAT_UNREAD_COLOR = '#3371bd';
    const BLINK_LIGHT = '#4183d7'; // Angular: CHAT_WINDOW_HEADER_HIGHLIGHTED_LIGHT_COLOR
    const BLINK_DARK = '#3166aa'; // Angular: CHAT_WINDOW_HEADER_HIGHLIGHTED_DARK_COLOR

    const [listWindInFocus, setListWindInFocus] = useState(false);
    const [lastSeenUnreadCount, setLastSeenUnreadCount] = useState(0);
    const [blinkBg, setBlinkBg] = useState<string | null>(null);
    const blinkTimeoutRef = useRef<number | null>(null);

    const getMaxListHeight = () => {
      // AngularJS cnvWindowMaximizeMinimizeManager: maxHeight = getVisibleBrowserHeight() - 59 (for chat list)
      // We approximate visible browser height via window.innerHeight and apply the same subtraction.
      if (typeof window === 'undefined') return 350;
      const maxHeight = Math.max(window.innerHeight - 59, 350);
      return maxHeight;
    };

    // Vertical resize handling for chat list (matches Angular cnv-window-resize-manager="vertical")
    const onResizerPointerDown = useCallback((e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMinimized) return;

      dragRef.current = {
        startY: e.clientY,
        startH: listHeight,
      };

      const onPointerMove = (moveE: PointerEvent) => {
        if (!dragRef.current) return;
        const deltaY = dragRef.current.startY - moveE.clientY; // drag up increases height
        const maxH = getMaxListHeight();
        const newH = Math.max(350, Math.min(maxH, dragRef.current.startH + deltaY));
        setListHeight(newH);
        // If user manually resized away from max, treat as not "expanded"
        setIsExpanded(newH >= maxH - 1);
      };

      const onPointerUp = () => {
        dragRef.current = null;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        // Persist last manual height for collapse-from-expanded
        prevHeightRef.current = listHeight;
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    }, [isMinimized, listHeight]);

  // Ensure chats and users are always sorted (matches AngularJS behavior)
  // This ensures sorting is applied even if data changes
  // CRITICAL: Deduplicate chats by chatId to prevent duplicate key warnings
  const sortedChats = useMemo(() => {
    // Remove duplicates by chatId (keep the first occurrence)
    const uniqueChats = chats.reduce((acc, chat) => {
      if (!acc.find(c => c.chatId === chat.chatId)) {
        acc.push(chat);
      }
      return acc;
    }, [] as Chat[]);
    
    const sorted = [...uniqueChats];
    sortChats(sorted);
    return sorted;
  }, [chats]);

    const sortedUsers = useMemo(() => {
      // Filter out users who already have P2P chats (matches AngularJS xmppChatService.chatsForFilteredUsers)
      // AngularJS logic: only show users WITHOUT existing P2P chats to prevent duplicates
      const usersWithoutChats = users.filter(user => {
        const userId = user.userId || user.user_id;
        // Check if this user already has a P2P chat
        const hasP2PChat = chats.some(chat => {
          if (chat.chatType !== 1) return false; // Not P2P
          // Check if user is a participant in this P2P chat
          if (chat._user && chat._user.userId === userId) return true;
          if (chat.participants && chat.participants[userId]) return true;
          return false;
        });
        return !hasP2PChat; // Only include users without existing chats
      });
      
      const sorted = [...usersWithoutChats];
      // Ensure all users have presenceStatus for sorting
      sorted.forEach(user => {
        if (!user.presenceStatus) {
          (user as any).presenceStatus = 4; // Default offline
        }
      });
      sortUsers(sorted);
      return sorted;
    }, [users, chats]);

  // Calculate unread count (matches Angular: chatsUnreadCount)
  const unreadCount = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const unreadLabel = unreadCount > 20 ? '20+' : String(unreadCount);

  // Get current user's presence status from XMPP (matches Angular: chatUsersManager.getThisUser())
  // Update when roster is received
  const [thisUserPresenceStatus, setThisUserPresenceStatus] = useState<number>(4);
  const [thisUserDevice, setThisUserDevice] = useState<number>(1);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateCurrentUserPresence = () => {
      const win = window as any;
      const sessionData = win?.com_convo?.sessionData?.signInResponseData;
      if (!sessionData?.user?.user_id) return;
      
      const currentUserId = sessionData.user.user_id;
      const presenceMap = xmppChatService.getPresenceMap();
      const presence = presenceMap[currentUserId];
      
      if (presence) {
        setThisUserPresenceStatus(presence.status);
        setThisUserDevice(presence.device);
      }
    };
    
    // Update immediately
    updateCurrentUserPresence();
    
    // Listen for roster updates (initial presence)
    const handleRosterUpdate = () => {
      updateCurrentUserPresence();
    };
    
    // Listen for real-time presence changes (when current user changes status)
    const handlePresenceChanged = () => {
      updateCurrentUserPresence();
    };
    
    window.addEventListener('xmppRosterReceived', handleRosterUpdate);
    window.addEventListener('xmppPresenceChanged', handlePresenceChanged);
    return () => {
      window.removeEventListener('xmppRosterReceived', handleRosterUpdate);
      window.removeEventListener('xmppPresenceChanged', handlePresenceChanged);
    };
  }, []);

  const [showSettings, setShowSettings] = useState(false);

  // Auto-hiding scrollbar hook for chat list (matches AngularJS autoHidingScrollBar directive)
  // This creates a custom scrollbar that auto-hides and shows on scroll/hover
  const chatsListScrollerRef = useAutoHidingScrollbar();

  const toggleMinimize = () => {
    const newMinimized = !isMinimized;
    setIsMinimized(newMinimized);
  };

  // Keep global minimized flag in sync for window positioning (used by ChatWindowsContext)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__cnvChatListIsMinimized = isMinimized;
  }, [isMinimized]);

  // Match AngularJS cnvWindowMaximizeMinimizeManager transitions (applied after initial paint)
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return;
    const headerEl = root.querySelector('.chatUserListHeader') as HTMLElement | null;
    const t = window.setTimeout(() => {
      if (headerEl) {
        headerEl.style.transition = 'background-color 0.2s, width 0.25s';
      }
      root.style.transition = 'width 0.25s, height 0.25s, left 0.25s, right 0.25s';
    }, 1);
    return () => window.clearTimeout(t);
  }, []);

  // Focus management for header color switching (matches Angular: input focus/blur drives listWindInFocus)
  useEffect(() => {
    if (isMinimized) {
      setListWindInFocus(false);
      return;
    }
    if (showBody) {
      // Angular maximizes then focuses inputSearchBar
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 1);
      setListWindInFocus(true);
      setLastSeenUnreadCount(unreadCount);
    }
  }, [isMinimized, showBody, unreadCount]);

  // Blink on new unread when not focused (matches AngularJS: blink(7, 800))
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear any previous blink when focus changes.
    if (listWindInFocus || isMinimized) {
      if (blinkTimeoutRef.current) {
        window.clearTimeout(blinkTimeoutRef.current);
        blinkTimeoutRef.current = null;
      }
      setBlinkBg(null);
      if (listWindInFocus) {
        setLastSeenUnreadCount(unreadCount);
      }
      return;
    }

    const isNewUnread = unreadCount > lastSeenUnreadCount;
    if (!isNewUnread || unreadCount <= 0) return;

    // Toggle between light/dark blue for N times, then restore class-based color.
    let times = 7;
    const step = () => {
      if (times <= 0) {
        setBlinkBg(null);
        blinkTimeoutRef.current = null;
        // Don't update lastSeenUnreadCount here; Angular only considers "seen" when focused.
        return;
      }
      setBlinkBg((prev) => (prev === BLINK_LIGHT ? BLINK_DARK : BLINK_LIGHT));
      times -= 1;
      blinkTimeoutRef.current = window.setTimeout(step, 800);
    };

    // start
    step();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount, lastSeenUnreadCount, listWindInFocus, isMinimized]);

  // Keep focus state in sync with input focus/blur (matches AngularJS 100ms blur delay)
  const onSearchFocus = () => {
    setListWindInFocus(true);
    setLastSeenUnreadCount(unreadCount);
  };
  const onSearchBlur = () => {
    window.setTimeout(() => {
      setListWindInFocus(false);
    }, 100);
  };

  // Compute header class + background (use inline backgroundColor to avoid any theme mismatches/opacity washout)
  const hasUnread = unreadCount > 0;
  const hasNewUnreadSinceLastFocus = hasUnread && unreadCount > lastSeenUnreadCount;
  const headerClass =
    `chatUserListHeader` +
    (listWindInFocus && !isMinimized ? '' : hasNewUnreadSinceLastFocus ? ' unread-state' : ' unfocused-state');
  const headerBg =
    blinkBg ??
    (listWindInFocus && !isMinimized ? CNV_CHAT_FOCUSED_COLOR : hasNewUnreadSinceLastFocus ? CNV_CHAT_UNREAD_COLOR : CNV_CHAT_UNFOCUSED_COLOR);

  // Siblings hide after transition on minimize; show immediately on maximize.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMinimized) {
      setShowBody(true);
      // Keep DockedChat in sync
      onMinimizeChange?.(false);
      return;
    }
    const t = window.setTimeout(() => setShowBody(false), 200);
    // Keep DockedChat in sync
    onMinimizeChange?.(true);
    return () => window.clearTimeout(t);
  }, [isMinimized, onMinimizeChange]);

  // Clamp expanded height on browser resize (in-place; no new window)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      if (!isExpanded) return;
      setListHeight(getMaxListHeight());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isExpanded]);

  // Header mousedown toggles minimize/maximize (matches AngularJS onWindowHeaderMouseDown)
  const onHeaderMouseDown = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.classList.contains('headerIcon') ||
      target.classList.contains('dropdownLinkContainer') ||
      target.closest('.btnChatSettings') ||
      target.closest('.btnExpand') ||
      target.closest('.create-new-feed-chat-btn') ||
      target.closest('.chatSettingsOptionsBtn')
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    toggleMinimize();
  };

    const handleNewChat = () => {
      // TODO: Open new chat window
    };

  const handleSettings = () => {
    setShowSettings(!showSettings);
  };

    // Handle clicking a user (start new P2P chat)
    // Matches AngularJS: scope.openChatWindow($event, obj, isInviteChat) (line 185-284)
    const handleUserClick = (user: NetworkUser) => {
      const userId = user.userId || user.user_id;
      // CRITICAL: Calculate displayName with fallback to prevent "Unknown"
      // Matches AngularJS: user.getDisplayName() which returns firstName + lastName or email
      const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || `User ${userId.substring(0, 8)}`;
      
      // CRITICAL: Prevent self-chat (matches AngularJS filtering)
      const currentUserId = getCurrentUserId();
      if (userId === currentUserId) {
        return;
      }

      selectUser(userId);

      // Generate chatId first to check for existing chat (matches Angular: chatManager.startChatWithUser)
      const currentUserJid = getCurrentUserJid();
      const currentAccountId = (window as any)?.com_convo?.sessionData?.signInResponseData?.account_id;
      let p2pChatId: string;
      let isUnifiedChat = false;
      
      // Check if unified network chat (matches AngularJS chatsLoader.js lines 167-175)
      if (user.accountId && user.accountId !== currentAccountId && 
          (window as any)?.com_convo?.sessionData?.signInResponseData?.network_settings?.allow_chat_across_network) {
        isUnifiedChat = true;
        const unifiedNetworkAccountId = (window as any)?.com_convo?.sessionData?.signInResponseData?.unified_network_settings?.account_id;
        p2pChatId = generateChatIdForUnifiedNetwork(unifiedNetworkAccountId, currentUserJid, userId, user.accountId);
      } else {
        p2pChatId = generateChatId(currentUserJid, userId);
      }
      
      // Check if chat already exists (matches Angular: if (obj.chatId) or chatIdToChatMap[chatId])
      const existingChat = chats.find(c => c.chatId === p2pChatId);

      let chatObj: Chat;
      
      if (existingChat) {
        // Use existing chat (matches Angular: chatObj = obj)
        chatObj = existingChat;
      } else {
        // Create new chat (matches Angular: chatObj = chatManager.startChatWithUser(obj))
        // ChatId already generated above
        
        chatObj = {
          chatId: p2pChatId,
          chatType: 1, // P2P
          title: displayName,
          unreadCount: 0,
          lastMessageTimestamp: Date.now(), // Use current timestamp for new chat
          lastMessageSequenceNumber: 0,
          summeryText: '',
          isMuted: false,
          participants: {
            [userId]: {
              userId: userId,
              displayName: displayName,
              presenceStatus: user.presenceStatus || 4,
              device: user.device || 1,
              profileImageType: user.profile_image_type?.toString(),
              profileImageVersion: user.profile_image_version?.toString(),
              accountId: user.account_id || user.accountId,
            },
          },
          _user: {
            userId: userId,
            displayName: displayName,
            presenceStatus: user.presenceStatus || 4,
            device: user.device || 1,
            profileImageType: user.profile_image_type?.toString(),
            profileImageVersion: user.profile_image_version?.toString(),
            accountId: user.account_id || user.accountId,
          },
          isUnifiedChat: isUnifiedChat,
        };
      }

      // Set _user property (matches Angular: chatObj._user = obj)
      chatObj._user = {
        userId: userId,
        displayName: displayName,
        presenceStatus: user.presenceStatus || 4,
        device: user.device || 1,
        profileImageType: user.profile_image_type?.toString(),
        profileImageVersion: user.profile_image_version?.toString(),
        accountId: user.account_id || user.accountId,
      };

      // Open chat window (matches Angular: scope.$emit('openChatWindow', chatObj, {...}))
      openChatWindow(chatObj, {
        isOpenedOnUserAction: true,
      });
    };

    // Handle clicking a chat (open existing conversation)
    const handleChatClick = (chat: Chat) => {
      selectChat(chat.chatId);
      openChatWindow(chat);
    };

  return (
    <div
      id="chatUserListMainWindow"
      className="chatUserListMainStyl z-index-9"
      tabIndex={0}
      ref={rootRef}
      style={{
        height: isMinimized ? '28px' : `${listHeight}px`,
        width: isMinimized ? '166px' : '260px',
      }}
    >
      {/* Resize handle (matches Angular) */}
      {showBody && (
        <div
          className="content-resizer"
          data-cnv-window-resize-manager="vertical"
          data-resizer-bottom="chatUserListMainWindow"
          onPointerDown={onResizerPointerDown}
        />
      )}

      {/* Header (EXACT match to AngularJS cnvChatUsersWindow.tpl.html lines 3-43) */}
      <div
        className={headerClass}
        data-cnv-chats-list-window-header=""
        onMouseDown={onHeaderMouseDown}
        style={{ backgroundColor: headerBg }}
      >
        {/* Unread count badge (Angular line 4) - positioned FIRST before chatsIcon, on LEFT side */}
        {unreadCount > 0 && (
          <div className="unreadCount">{unreadLabel}</div>
        )}

        {/* Chats icon (Angular line 5) - positioned after unreadCount */}
        <div className="chatsIcon" />

        {/* Header text with presence indicator (Angular lines 6-20) */}
        <div className="chatHeaderText">
          <span>Chats</span>
          <div style={{ display: 'inline-block', marginBottom: '-2px', marginLeft: '5px' }}>
            {thisUserPresenceStatus === 1 && thisUserDevice !== 2 && (
              <div className="listUserStatusOnline" />
            )}
            {thisUserPresenceStatus === 2 && thisUserDevice !== 2 && (
              <div className="listUserStatusBusy" />
            )}
            {thisUserPresenceStatus === 3 && thisUserDevice !== 2 && (
              <div className="listUserStatusIdle" />
            )}
            {thisUserPresenceStatus === 4 && thisUserDevice !== 2 && !(thisUserDevice === 2) && (
              <div className="listUserStatusOffline" />
            )}
            {(thisUserDevice === 2 || (thisUserPresenceStatus === 4 && false)) && (
              <div className="listUserStatusMobileWhite" />
            )}
          </div>
        </div>

        {/* Expand button (link to full chat view) */}
        {showBody && (
          <a
            className="btnExpand"
            href="#"
            style={{ display: 'block' }}
            onMouseUp={() => {
              // AngularJS chat list expands/collapses within the same container (no new window).
              // We implement in-place stretch: toggle height between previous and max visible height.
              if (isMinimized) return;
              if (!isExpanded) {
                prevHeightRef.current = listHeight;
                setListHeight(getMaxListHeight());
                setIsExpanded(true);
              } else {
                setListHeight(prevHeightRef.current || 350);
                setIsExpanded(false);
              }
            }}
            onClick={(e) => {
              // prevent page jump due to href="#"
              e.preventDefault();
            }}
          >
            <i className="headerIcon cnv-icons-16 chat-window-expand-white" />
            <i className="headerIcon cnv-icons-16 chat-window-expand-gray-hover" />
          </a>
        )}

        {/* New chat button */}
        {showBody && (
          <div
            className="create-new-feed-chat-btn"
            onMouseDown={handleNewChat}
          >
            <i className="headerIcon cnv-icons-16 chat_create_new_chat_white" />
            <i className="headerIcon cnv-icons-16 chat_create_new_chat" />
          </div>
        )}

        {/* Settings button */}
        {showBody && (
          <div
            className="chatSettingsOptionsBtn btnChatSettings"
            onMouseDown={(e) => {
              e.stopPropagation();
              handleSettings();
            }}
          >
            <i className="headerIcon cnv-icons-20 chat_settings_white" />
            <i className="headerIcon cnv-icons-16 chat_settings" />
            
            {/* Settings dropdown */}
            {showSettings && (
              <div className="chat-settings-dropdown">
                <div className="chat-settings-item" onClick={() => {
                  setShowSettings(false);
                }}>
                  Mark all as read
                </div>
                <div className="chat-settings-item" onClick={() => {
                  setShowSettings(false);
                }}>
                  Settings
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search bar (EXACT match to Angular) */}
      {showBody && (
        <div className="chatSearchBar">
          <div className="searchChatIconContainer">
            <i className="searchChatIcon" />
          </div>
          <input
            className="inputSearchBar"
            spellCheck={false}
            placeholder="SEARCH"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            ref={searchInputRef}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
          />
        </div>
      )}

      {/* Chat list container (EXACT match to Angular) */}
      {showBody && (
        <div
          id="chatUserList"
          className="chatUserList cnvScrollContainerParent"
          style={{
            display: 'block',
            position: 'absolute',
            width: '100%',
            top: '69px', /* Matches AngularJS: header (28px) + search bar (40px) + 1px border = 69px */
            bottom: '0px',
            zIndex: 1, /* Ensure chat list is below search bar */
          }}
        >
          <div
            ref={chatsListScrollerRef}
            id="chatsListScroller"
            className="chats-scroll-container"
            style={{
              // CRITICAL: Matches AngularJS .chats-scroll-container exactly
              // Source: AngularJS cnvChatUsersWindow.tpl.html line 91-94
              height: '100%',
              overflowX: 'hidden',
              overflowY: 'scroll', // Enables scrolling - scrollbar hidden via CSS
              scrollbarWidth: 'none', // Firefox - hide default scrollbar
              msOverflowStyle: 'none', // IE/Edge - hide default scrollbar
              // Additional styles for proper scrollbar behavior
              position: 'relative',
              width: '100%',
            }}
          >
            <div
              id="chatsView"
              style={{
                overflow: 'hidden',
                flex: 1,
                WebkitFlex: 1,
                msFlex: 1,
                width: 'inherit',
              }}
            >
              {/* Loading state */}
              {isLoading && (
                <div className="spinner-container">
                  <i className="cnv-circle-spinner-small" />
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="chat-blank-state-wrapper" style={{ textAlign: 'center', padding: '20px', color: '#7b8386' }}>
                  <i className="cnv-icons-40 chatbar-comment-lightgray" />
                  <p>{error}</p>
                </div>
              )}

               {/* Blank state (no chats and no users) */}
               {!isLoading && !error && chats.length === 0 && users.length === 0 && (
                 <div className="chat-blank-state-wrapper blank-view">
                   <div>
                     <i className="cnv-icons-40 chatbar-comment-lightgray" />
                     <p>No chats yet.</p>
                   </div>
                 </div>
               )}
 
              {/* Chat list items (Existing conversations) - FIRST (matches Angular line 1132) */}
              {/* Use sortedChats to ensure sorting is always applied */}
              {sortedChats.map((chat) => (
                <ChatListItem
                  key={chat.chatId}
                  chat={chat}
                  isSelected={chat.chatId === selectedChatId}
                  onClick={() => handleChatClick(chat)}
                />
              ))}

              {/* User list items (Network users WITHOUT active chats) - SECOND (matches Angular) */}
              {/* Use sortedUsers to ensure sorting is always applied */}
              {sortedUsers.map((user) => {
                const userId = user.userId || user.user_id;
                // Debug: Log user data before rendering
                return (
                  <UserListItem
                    key={userId}
                    user={user}
                    isSelected={userId === selectedUserId}
                    onClick={() => handleUserClick(user)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

