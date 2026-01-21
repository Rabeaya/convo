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

  import { useState, useMemo, useEffect, useRef } from 'react';
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
    const [isMinimized, setIsMinimized] = useState(false);
    const [searchText, setSearchText] = useState('');
    const { chats, users, isLoading, error, selectedChatId, selectedUserId, selectChat, selectUser } = useChatList();
    const { openChatWindow } = useChatWindows();

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
    // Notify parent component of minimize state change (for window positioning)
    if (onMinimizeChange) {
      onMinimizeChange(newMinimized);
    }
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
      style={{
        height: isMinimized ? '28px' : '350px',
        width: isMinimized ? '166px' : '260px',
      }}
    >
      {/* Resize handle (matches Angular) */}
      {!isMinimized && (
        <div
          className="content-resizer"
          data-cnv-window-resize-manager="vertical"
          data-resizer-bottom="chatUserListMainWindow"
        />
      )}

      {/* Header (EXACT match to AngularJS cnvChatUsersWindow.tpl.html lines 3-43) */}
      <div
        className="chatUserListHeader unfocused-state"
        data-cnv-chats-list-window-header=""
        onMouseDown={toggleMinimize}
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
        {!isMinimized && (
          <a
            className="btnExpand"
            href="#/chats/all"
            target="_blank"
            style={{ display: 'block' }}
          >
            <i className="headerIcon cnv-icons-16 chat-window-expand-white" />
            <i className="headerIcon cnv-icons-16 chat-window-expand-gray-hover" />
          </a>
        )}

        {/* New chat button */}
        {!isMinimized && (
          <div
            className="create-new-feed-chat-btn"
            onMouseDown={handleNewChat}
          >
            <i className="headerIcon cnv-icons-16 chat_create_new_chat_white" />
            <i className="headerIcon cnv-icons-16 chat_create_new_chat" />
          </div>
        )}

        {/* Settings button */}
        {!isMinimized && (
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
      {!isMinimized && (
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
          />
        </div>
      )}

      {/* Chat list container (EXACT match to Angular) */}
      {!isMinimized && (
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

