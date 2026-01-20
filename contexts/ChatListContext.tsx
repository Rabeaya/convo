'use client';

/**
 * ChatListContext - Manages chat list state
 * 
 * Replicates AngularJS chatManager functionality
 * Real data source: XMPP SDK via IQ stanzas
 * 
 * NO DUMMY DATA - fetches from real backend
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { xmppChatService } from '@/utils/xmppChatService';
import { usersService } from '@/lib/api/users';
import { sortUsers, sortChats } from '@/utils/chatSorting';
import { computeGroupChatTitle } from '@/utils/chatTitleUtils';
import type { Chat, NetworkUser } from '@/types/chat';
import { getUserId } from '@/types/chat';
import { useMessages } from '@/contexts/MessagesContext';

interface ChatListContextValue {
  chats: Chat[];
  users: NetworkUser[]; // Network users without active chats
  allUsers: NetworkUser[]; // ALL users (for looking up profile images) - matches AngularJS userManager._usersDictionary
  isLoading: boolean;
  error: string | null;
  selectedChatId: string | null;
  selectedUserId: string | null;
  selectChat: (chatId: string) => void;
  selectUser: (userId: string) => void;
  refreshChats: () => void;
  resortChatList: () => void; // Re-sort when presence/messages change
  updateUnreadCount: (chatId: string, count: number) => void; // Update unread count for a chat
  resetUnreadCount: (chatId: string) => void; // Reset unread count to 0 (when chat gains focus)
  getUnreadCount: (chatId: string) => number; // Get current unread count for a chat
}

const ChatListContext = createContext<ChatListContextValue | null>(null);

export function ChatListProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<NetworkUser[]>([]); // Users without active chats (for display)
  const [allUsers, setAllUsers] = useState<NetworkUser[]>([]); // ALL users (for lookup) - matches AngularJS userManager._usersDictionary
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isXmppReady, setIsXmppReady] = useState(false);
  const [rosterReceived, setRosterReceived] = useState(false); // Track if roster has been received

  // Get XMPP config from window (set by ConfigScript)
  const getXMPPConfig = () => {
    if (typeof window === 'undefined') return null;
    
    const win = window as any;
    const config = win?.com_convo?.config;
    const sessionData = win?.com_convo?.sessionData?.signInResponseData;
    
    if (!config || !sessionData) return null;

    const domain = config.XMPP_DOMAIN || process.env.NEXT_PUBLIC_XMPP_DOMAIN;
    const boshServer = config.XMPP_SERVER || process.env.NEXT_PUBLIC_XMPP_SERVER;
    const secure = config.SECURE_COMM !== false;
    const protocol = secure ? 'https' : 'http';
    
    const accountId = sessionData.account_id;
    const userId = sessionData.user?.user_id;
    const xmppToken = sessionData.xmpp_session_token;

    if (!domain || !boshServer || !accountId || !userId || !xmppToken) {
      return null;
    }

    // Build JID: accountId;userId@domain (matches Angular ChatUtils.makeJid)
    const jid = `${accountId};${userId}@${domain}`;
    
    // Build BOSH URL with trailing slash (matches Angular)
    const boshUrl = `${protocol}://${boshServer}/http-bind/`;

    return { domain, boshUrl, jid, password: xmppToken };
  };

  const fetchChatsFromXMPP = () => {
    console.log('[ChatListContext] Fetching chats...');
    setIsLoading(true);
    setError(null);

    // Fetch chats via XMPP IQ stanza (matches Angular)
    xmppChatService.fetchChats(
      0, // from_index
      20, // to_index (first page)
      (fetchedChats) => {
        console.log(`[ChatListContext] ✅ Loaded ${fetchedChats.length} chats`);
        
        // Get current user ID for title computation
        const win = typeof window !== 'undefined' ? (window as any) : null;
        const currentUserId = win?.com_convo?.sessionData?.signInResponseData?.user?.user_id || '';
        
        // Compute group chat titles from participants (matches AngularJS chat.getTitle)
        // We need allUsers for this, but they're not loaded yet, so we'll update titles after users load
        // For now, store chats as-is
        const sortedChats = [...fetchedChats];
        sortChats(sortedChats);
        console.log('[ChatListContext] Chats sorted by timestamp:', sortedChats.map(c => ({ title: c.title, timestamp: c.lastMessageTimestamp })));
        setChats(sortedChats);
        setIsLoading(false);
        
        // After chats load, fetch network users (matches Angular flow)
        // Titles will be recomputed after users are loaded
        fetchNetworkUsers(sortedChats);
      },
      (errorMsg) => {
        console.error('[ChatListContext] ❌ Fetch error:', errorMsg);
        setError(errorMsg);
        setIsLoading(false);
      }
    );
  };

  const fetchNetworkUsers = async (currentChats: Chat[]) => {
    console.log('[ChatListContext] Fetching network users...');
    
    try {
      // Fetch all network users from API (raw data, no filtering yet)
      const allUsers = await usersService.getAllUsers();
      console.log(`[ChatListContext] Fetched ${allUsers.length} raw users from API`);

      // Get current user ID and account ID from session
      const win = typeof window !== 'undefined' ? (window as any) : null;
      const currentUserId = win?.com_convo?.sessionData?.signInResponseData?.user?.user_id;
      const currentAccountId = win?.com_convo?.sessionData?.signInResponseData?.account_id;

      console.log(`[ChatListContext] Current user ID: ${currentUserId}`);
      console.log(`[ChatListContext] Current account ID: ${currentAccountId}`);

      // Apply ALL filters (matching AngularJS usersService.js + xmppChatService.js logic)
      const filteredUsers = allUsers.filter(user => {
        const userId = getUserId(user);
        
        // FILTER 1: Exclude current user (Angular userManager.js line 314-316, 871)
        if (userId === currentUserId) {
          console.log(`[ChatListContext] ❌ Excluding current user: ${userId}`);
          return false;
        }
        
        // FILTER 2: show_in_buddy_list check (Angular usersService.js line 133-135)
        // Current user has show_in_buddy_list = false
        if (user.show_in_buddy_list === false) {
          console.log(`[ChatListContext] ❌ Excluding user ${userId} (${user.first_name} ${user.last_name}) - show_in_buddy_list = false`);
          return false;
        }
        
        // FILTER 3: is_accessible check (Angular xmppChatService.js line 1018)
        // Excludes admin/test/blocked users
        if (!user.is_accessible && user.is_accessible !== undefined) {
          console.log(`[ChatListContext] ❌ User ${userId} not accessible`);
          return false;
        }
        
        // FILTER 4: account_id check (Angular xmppChatService.js line 1019)
        // Only show users from same network/account
        const userAccountId = user.account_id || currentAccountId;
        if (currentAccountId && userAccountId !== currentAccountId) {
          console.log(`[ChatListContext] ❌ User ${userId} from different account (${userAccountId} vs ${currentAccountId})`);
          return false;
        }
        
        return true;
      });

      console.log(`[ChatListContext] After filtering: ${allUsers.length} → ${filteredUsers.length} users`);

      // FILTER 5: Separate users with existing P2P chats vs without (Angular xmppChatService.js line 1009-1021)
      const usersWithoutChats = filteredUsers.filter(user => {
        const userId = getUserId(user);
        
        const hasP2PChat = currentChats.some(chat =>
          chat.chatType === 1 && // P2P chat
          chat.participants[userId] !== undefined
        );
        
        if (hasP2PChat) {
          console.log(`[ChatListContext] User ${userId} already has P2P chat - showing in chats list`);
        }
        
        return !hasP2PChat;
      });

      // Merge presence data from XMPP roster (if available)
      // Matches Angular: userManager.updateUsersPresenceStatus() (line 660-688)
      const presenceMap = xmppChatService.getPresenceMap();
      console.log('[ChatListContext] Merging presence data:', Object.keys(presenceMap).length, 'presence entries');
      
      const usersWithPresence = usersWithoutChats.map(user => {
        const userId = getUserId(user);
        const presence = presenceMap[userId];
        if (presence) {
          console.log(`[ChatListContext] Merging presence for ${userId}: status=${presence.status}, device=${presence.device}`);
          return {
            ...user,
            presenceStatus: presence.status,
            device: presence.device,
          };
        }
        // Default to offline if no presence data yet (matches Angular behavior)
        // console.log(`[ChatListContext] No presence data for ${userId}, defaulting to offline`);
        return {
          ...user,
          presenceStatus: 4, // UNAVAILABLE/OFFLINE
          device: 1, // DESKTOP
        };
      });

      // Sort users by presence status and rank (matches Angular sortUsers)
      // Create new array to ensure React detects the change
      const sortedUsers = [...usersWithPresence];
      sortUsers(sortedUsers);
      console.log('[ChatListContext] Users sorted by presence:', sortedUsers.map(u => ({ 
        name: `${u.first_name} ${u.last_name}`, 
        presence: u.presenceStatus || 4,
        invited: (u as any).status === 'INVITED' || u.user_role === 'invited',
        rank: (u as any).rank || 0
      })));
      console.log(`[ChatListContext] ✅ Final: ${sortedUsers.length} users without active chats`);
      setUsers(sortedUsers);
      
      // CRITICAL: Also store ALL filtered users (not just those without chats) for profile image lookup
      // This matches AngularJS userManager._usersDictionary which contains ALL users
      // Users in chats are still needed for profileImageType/profileImageVersion lookup
      setAllUsers(filteredUsers);
    } catch (err) {
      console.error('[ChatListContext] ❌ Failed to fetch users:', err);
      // Don't set error - users are optional, chats already loaded
    }
  };

  // Update chat list when messages are sent/received (matches AngularJS messagesLoaderSentMessageInChat)
  // Subscribe to message updates from MessagesContext
  const { messages: messagesState } = useMessages();
  
  // Get focused chat ID from ChatWindowsContext (matches AngularJS _selectedChat)
  // We use a custom event to avoid circular dependency
  const [focusedChatId, setFocusedChatIdState] = useState<string | null>(null);
  
  // Listen for focused chat changes from ChatWindowsContext
  useEffect(() => {
    const handleFocusedChatChange = (event: CustomEvent<{ chatId: string | null }>) => {
      setFocusedChatIdState(event.detail.chatId);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('focusedChatChanged', handleFocusedChatChange as EventListener);
      return () => {
        window.removeEventListener('focusedChatChanged', handleFocusedChatChange as EventListener);
      };
    }
  }, []);

  // Helper to generate unique tab ID (matches AngularJS clientInstanceId)
  const getTabId = useCallback((): string => {
    if (typeof window === 'undefined') return 'server';
    
    // Try to get from window (set by app initialization)
    if ((window as any).com_convo?.clientInstanceId) {
      return `tab-${(window as any).com_convo.clientInstanceId}`;
    }
    
    // Generate and store if not exists
    let tabId = sessionStorage.getItem('convo_tab_id');
    if (!tabId) {
      tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('convo_tab_id', tabId);
    }
    
    return tabId;
  }, []);

  // Persist unread counts to localStorage (matches AngularJS chatsDiskManager.saveChats)
  const persistUnreadCounts = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const accountId = win?.com_convo?.sessionData?.signInResponseData?.account_id;
    const userId = win?.com_convo?.sessionData?.signInResponseData?.user?.user_id;
    
    if (!accountId || !userId) return;
    
    try {
      // Save unread counts per chat (matches AngularJS chatsDiskManager line 31)
      const unreadCountsKey = `com.convo.chat.${accountId}.${userId}.unread_counts`;
      const unreadCountsMap: Record<string, number> = {};
      
      chats.forEach(chat => {
        if (chat.unreadCount > 0) {
          unreadCountsMap[chat.chatId] = chat.unreadCount;
        }
      });
      
      localStorage.setItem(unreadCountsKey, JSON.stringify(unreadCountsMap));
      console.log('[ChatListContext] 💾 Persisted unread counts to localStorage:', Object.keys(unreadCountsMap).length, 'chats');
    } catch (error) {
      console.error('[ChatListContext] ❌ Error persisting unread counts:', error);
    }
  }, [chats]);

  // Update unread count for a chat (matches AngularJS chat.updateUnreadCount)
  const updateUnreadCount = useCallback((chatId: string, count: number) => {
    setChats(prevChats => {
      const updated = prevChats.map(chat => {
        if (chat.chatId === chatId) {
          const newCount = Math.max(0, count); // Ensure non-negative
          if (chat.unreadCount !== newCount) {
            console.log(`[ChatListContext] 📊 Updating unread count for ${chatId}: ${chat.unreadCount} → ${newCount}`);
            
            // Broadcast to other tabs (matches AngularJS appTabs.js)
            if (typeof window !== 'undefined') {
              const tabId = getTabId();
              const event = new CustomEvent('unreadCountUpdated', {
                detail: { chatId, count: newCount, tabId },
              });
              window.dispatchEvent(event);
              
              // Also use BroadcastChannel if available
              try {
                const channel = new BroadcastChannel('convoUnreadCountsChannel');
                channel.postMessage({
                  type: 'UNREAD_COUNT_UPDATE',
                  tabId,
                  chatId,
                  count: newCount,
                  timestamp: Date.now(),
                });
                channel.close();
              } catch (error) {
                console.warn('[ChatListContext] BroadcastChannel not available for unread counts');
              }
            }
            
            return { ...chat, unreadCount: newCount };
          }
        }
        return chat;
      });
      return updated;
    });
    
    // Persist to localStorage (matches AngularJS chatsDiskManager.saveChats)
    persistUnreadCounts();
  }, [getTabId, persistUnreadCounts]);

  // Reset unread count to 0 (matches AngularJS chatRead - when chat gains focus)
  const resetUnreadCount = useCallback((chatId: string) => {
    setChats(prevChats => {
      const updated = prevChats.map(chat => {
        if (chat.chatId === chatId && chat.unreadCount > 0) {
          console.log(`[ChatListContext] ✅ Resetting unread count for ${chatId}: ${chat.unreadCount} → 0`);
          
          // Broadcast to other tabs (matches AngularJS appTabs.js)
          if (typeof window !== 'undefined') {
            const tabId = getTabId();
            const event = new CustomEvent('unreadCountUpdated', {
              detail: { chatId, count: 0, tabId },
            });
            window.dispatchEvent(event);
            
            // Also use BroadcastChannel if available
            try {
              const channel = new BroadcastChannel('convoUnreadCountsChannel');
              channel.postMessage({
                type: 'UNREAD_COUNT_RESET',
                tabId,
                chatId,
                count: 0,
                timestamp: Date.now(),
              });
              channel.close();
            } catch (error) {
              console.warn('[ChatListContext] BroadcastChannel not available for unread counts');
            }
          }
          
          return { ...chat, unreadCount: 0 };
        }
        return chat;
      });
      return updated;
    });
    
    // Persist to localStorage
    persistUnreadCounts();
  }, [getTabId, persistUnreadCounts]);

  // Get current unread count for a chat
  const getUnreadCount = useCallback((chatId: string): number => {
    const chat = chats.find(c => c.chatId === chatId);
    return chat?.unreadCount || 0;
  }, [chats]);
  
  // Handle unread count updates when messages are received (matches AngularJS xmppChatService.messagesLoaderReceivedMessageInChat lines 746-799)
  useEffect(() => {
    const handleMessageForUnreadCount = (event: CustomEvent<{
      message: any;
      chatId: string;
      isOwnMessage: boolean;
      currentUserId: string;
    }>) => {
      const { message, chatId, isOwnMessage } = event.detail;
      
      // Find the chat
      const chat = chats.find(c => c.chatId === chatId);
      if (!chat) return;
      
      // Matches AngularJS logic (lines 759-793):
      // 1. If sender is current user AND unreadCount > 0: reset to 0
      if (isOwnMessage) {
        if (chat.unreadCount > 0) {
          console.log(`[ChatListContext] 📨 Own message received, resetting unread count for ${chatId}`);
          updateUnreadCount(chatId, 0);
        }
        return;
      }
      
      // 2. If sender is NOT current user:
      //    - If chat is focused: reset to 0
      //    - If chat is NOT focused: increment by 1
      const isChatFocused = focusedChatId === chatId;
      
      // Only increment for MESSAGE type (matches AngularJS line 771)
      // Skip system messages and other types
      const isMessageType = !message.isSystemMessage && message.type !== 'system';
      
      if (isMessageType && !message.skipUnreadCount) {
        if (isChatFocused) {
          // Chat is focused - reset to 0 (matches AngularJS line 786-788)
          console.log(`[ChatListContext] 📨 Message received in focused chat ${chatId}, resetting unread count`);
          updateUnreadCount(chatId, 0);
        } else {
          // Chat is NOT focused - increment (matches AngularJS line 790)
          const newCount = chat.unreadCount + 1;
          console.log(`[ChatListContext] 📨 Message received in unfocused chat ${chatId}, incrementing unread count: ${chat.unreadCount} → ${newCount}`);
          updateUnreadCount(chatId, newCount);
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('messageReceivedForUnreadCount', handleMessageForUnreadCount as EventListener);
      return () => {
        window.removeEventListener('messageReceivedForUnreadCount', handleMessageForUnreadCount as EventListener);
      };
    }
  }, [chats, focusedChatId, updateUnreadCount]);
  
  // CRITICAL: Ensure chat exists when message arrives (matches AngularJS xmppMessageReceived lines 1988-2004)
  useEffect(() => {
    const handleEnsureChatExists = async (event: CustomEvent) => {
      const { chatId, message, senderId, timestamp, sequenceNumber } = event.detail;
      
      // Check if chat already exists
      const existingChat = chats.find(c => c.chatId === chatId);
      if (existingChat) {
        // Chat exists - update last message info (matches AngularJS processP2PMessage)
        setChats(prevChats => prevChats.map(chat => {
          if (chat.chatId === chatId) {
            return {
              ...chat,
              lastMessageTimestamp: timestamp,
              lastMessageSequenceNumber: sequenceNumber,
              last_message_sender_id: senderId,
            };
          }
          return chat;
        }));
        return;
      }
      
      // Chat doesn't exist - create it (matches AngularJS xmppMessageReceived lines 1988-2004)
      console.log('[ChatListContext] 📝 Creating new chat for received message:', chatId);
      
      // Get current user ID
      const getCurrentUserId = () => {
        if (typeof window !== 'undefined') {
          const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
          return sessionData?.user?.user_id || '';
        }
        return '';
      };
      const currentUserId = getCurrentUserId();
      
      // Get sender and recipient info
      const isOwnMessage = senderId === currentUserId;
      const otherUserId = isOwnMessage ? message.for_user_id : senderId;
      
      // Find user in allUsers list
      const otherUser = allUsers.find(u => getUserId(u) === otherUserId);
      const otherUserName = otherUser 
        ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.email || 'Unknown'
        : 'Unknown';
      
      // Create new chat (matches AngularJS Chat.setInfo)
      const newChat: Chat = {
        chatId,
        title: otherUserName,
        chatType: 'P2P',
        unreadCount: isOwnMessage ? 0 : 1, // Increment if message from other user
        lastMessageTimestamp: timestamp,
        lastMessageSequenceNumber: sequenceNumber,
        last_message_sender_id: senderId,
        participants: {
          [currentUserId]: {
            userId: currentUserId,
            displayName: 'You',
            presenceStatus: 1, // ONLINE
            lastSeenMessageSequenceNumber: 0,
            accountId: (window as any).com_convo?.sessionData?.signInResponseData?.account_id || '',
          },
          [otherUserId]: {
            userId: otherUserId,
            displayName: otherUserName,
            presenceStatus: 4, // OFFLINE (will be updated by presence)
            lastSeenMessageSequenceNumber: isOwnMessage ? sequenceNumber : 0,
            accountId: otherUser?.account_id || '',
          },
        },
        isMuted: false,
        isUnifiedChat: false,
        chatStatus: '',
      };
      
      // Add chat to list (check for duplicates first)
      setChats(prevChats => {
        // Check if chat already exists
        const existingChat = prevChats.find(c => c.chatId === chatId);
        if (existingChat) {
          console.log('[ChatListContext] ⚠️ Chat already exists, skipping duplicate:', chatId);
          return prevChats; // Don't add duplicate
        }
        
        const updated = [...prevChats, newChat];
        sortChats(updated);
        console.log('[ChatListContext] ✅ Created new chat:', chatId, otherUserName);
        return updated;
      });
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('ensureChatExistsForMessage', handleEnsureChatExists as EventListener);
      return () => {
        window.removeEventListener('ensureChatExistsForMessage', handleEnsureChatExists as EventListener);
      };
    }
  }, [chats, allUsers]);
  
  // CRITICAL: Add chat to list when chat window is opened (matches AngularJS chatManager.startChatWithUser)
  // This ensures new chats appear in the chat list with correct displayName
  useEffect(() => {
    const handleChatWindowOpened = (event: CustomEvent) => {
      const { chat } = event.detail;
      
      if (!chat || !chat.chatId) {
        return;
      }
      
      // CRITICAL: Use functional update to ensure we check the latest state
      // This prevents duplicate chats from being added
      setChats(prevChats => {
        // Check if chat already exists in the current state
        const existingChatIndex = prevChats.findIndex(c => c.chatId === chat.chatId);
        
        if (existingChatIndex !== -1) {
          // Chat exists - update it with latest data from chat window
          // CRITICAL: Do NOT update lastMessageTimestamp when opening a window
          // Only update it when a message is actually sent/received
          // This matches AngularJS behavior where opening a window doesn't change chat list order
          const updated = [...prevChats];
          const existingChat = updated[existingChatIndex];
          updated[existingChatIndex] = {
            ...existingChat,
            // Preserve existing unreadCount and lastMessageTimestamp
            // Do NOT set lastMessageTimestamp to Date.now() - this would reorder the chat list
            unreadCount: existingChat.lastMessageSequenceNumber > 0 ? existingChat.unreadCount : chat.unreadCount || 0,
            // Only update lastMessageTimestamp if chat has messages (lastMessageSequenceNumber > 0)
            // Otherwise preserve existing timestamp (which may be undefined/0 for chats with no history)
            lastMessageTimestamp: existingChat.lastMessageSequenceNumber > 0 
              ? (existingChat.lastMessageTimestamp || chat.lastMessageTimestamp || 0)
              : (existingChat.lastMessageTimestamp || 0), // Don't set timestamp for chats with no messages
            // Update _user and title if provided (for new chats)
            _user: chat._user || existingChat._user,
            title: chat.title || existingChat.title,
            participants: chat.participants || existingChat.participants,
          };
          // Do NOT re-sort - opening a window should not change chat list order
          return updated;
        } else {
          // New chat - add to list (only if it doesn't already exist)
          // CRITICAL: Do NOT set lastMessageTimestamp to Date.now() for new chats with no messages
          // This would place them at the top of the list incorrectly
          const chatToAdd = {
            ...chat,
            // Only set timestamp if chat has messages, otherwise leave it undefined/0
            lastMessageTimestamp: chat.lastMessageSequenceNumber > 0 
              ? (chat.lastMessageTimestamp || 0)
              : 0, // No timestamp for chats with no messages
          };
          const updated = [...prevChats, chatToAdd];
          sortChats(updated);
          console.log('[ChatListContext] ✅ Added new chat to list:', chat.chatId, chat.title);
          return updated;
        }
      });
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('chatWindowOpened', handleChatWindowOpened as EventListener);
      return () => {
        window.removeEventListener('chatWindowOpened', handleChatWindowOpened as EventListener);
      };
    }
  }, []); // Remove chats from dependency array - use functional update instead
  
  // CRITICAL: Update chat's last message info (matches AngularJS processP2PMessage lines 2112-2115)
  useEffect(() => {
    const handleUpdateChatLastMessage = (event: CustomEvent) => {
      const { chatId, timestamp, sequenceNumber, senderId } = event.detail;
      
      setChats(prevChats => prevChats.map(chat => {
        if (chat.chatId === chatId) {
          return {
            ...chat,
            lastMessageTimestamp: timestamp,
            lastMessageSequenceNumber: sequenceNumber,
            last_message_sender_id: senderId,
          };
        }
        return chat;
      }));
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('updateChatLastMessage', handleUpdateChatLastMessage as EventListener);
      return () => {
        window.removeEventListener('updateChatLastMessage', handleUpdateChatLastMessage as EventListener);
      };
    }
  }, []);
  
  useEffect(() => {
    // Update chats when messages change
    setChats(prevChats => {
      let updated = false;
      const updatedChats = prevChats.map(chat => {
        const messages = messagesState[chat.chatId] || [];
        if (messages.length === 0) return chat;
        
        // Get latest message (messages are sorted ascending, so last is newest)
        const latestMessage = messages[messages.length - 1];
        
        // Get minimum sequence number (matches AngularJS chat.minSequenceNumber)
        // This is used for load older messages functionality
        const minSequenceNumber = messages.length > 0
          ? Math.min(...messages.map(m => m.sequenceNumber || 0).filter(seq => seq > 0))
          : 0;
        
        // Update chat properties (matches AngularJS chat.addMessage and chatManager.updateChat)
        const newLastMessageTimestamp = latestMessage.timestamp;
        const newLastMessageSequenceNumber = latestMessage.sequenceNumber || 0;
        const newSummeryText = latestMessage.messageText || '';
        
        // Only update if changed
        if (
          chat.lastMessageTimestamp !== newLastMessageTimestamp ||
          chat.lastMessageSequenceNumber !== newLastMessageSequenceNumber ||
          chat.summeryText !== newSummeryText ||
          chat.minSequenceNumber !== minSequenceNumber
        ) {
          updated = true;
          console.log(`[ChatListContext] 📝 Updating chat ${chat.chatId}:`, {
            oldTimestamp: chat.lastMessageTimestamp,
            newTimestamp: newLastMessageTimestamp,
            oldSeq: chat.lastMessageSequenceNumber,
            newSeq: newLastMessageSequenceNumber,
            oldMinSeq: chat.minSequenceNumber,
            newMinSeq: minSequenceNumber,
          });
          return {
            ...chat,
            lastMessageTimestamp: newLastMessageTimestamp,
            lastMessageSequenceNumber: newLastMessageSequenceNumber,
            summeryText: newSummeryText,
            minSequenceNumber: minSequenceNumber || undefined, // Store undefined if 0 (no messages with sequenceNumber > 0)
            isLoadingInProgress: false, // Clear loading flag after messages update
          };
        }
        return chat;
      });
      
      if (updated) {
        // Re-sort chats (matches AngularJS - chat moves to top when message sent/received)
        const sorted = [...updatedChats];
        sortChats(sorted);
        console.log('[ChatListContext] ✅ Chat list updated and re-sorted due to message change');
        return sorted;
      }
      
      return prevChats;
    });
  }, [messagesState]);

  // Re-sort when presence changes or new messages arrive (matches Angular)
  const resortChatList = useCallback(() => {
    console.log('[ChatListContext] Re-sorting chat list...');
    
    setChats(prevChats => {
      const sorted = [...prevChats];
      sortChats(sorted);
      return sorted;
    });
    
    setUsers(prevUsers => {
      const sorted = [...prevUsers];
      sortUsers(sorted);
      return sorted;
    });
  }, []);

  useEffect(() => {
    const initializeChat = () => {
      const config = getXMPPConfig();
      if (!config) {
        console.warn('[ChatListContext] XMPP config not available - waiting for session');
        setError('Please log in to see your chats');
        return;
      }

      console.log('[ChatListContext] Initializing XMPP connection...');
      setIsLoading(true);
      setError(null);

      // Step 1: Connect to XMPP (matches Angular chatAppContext.connectConnectionManager)
      xmppChatService.connect(
        config,
        () => {
          // Step 2: Connection successful (matches Angular onConnected event)
          console.log('[ChatListContext] ✅ XMPP connected, fetching chats...');
          setIsXmppReady(true);
          
          // Add presence handler after connection (matches Angular callsManager.attachHandlers)
          xmppChatService.addPresenceHandler((presenceMap) => {
            console.log('[ChatListContext] 📡 Presence update received');
            setUsers(prevUsers => {
              const updated = prevUsers.map(user => {
                const userId = getUserId(user);
                const presence = presenceMap[userId];
                if (presence) {
                  return {
                    ...user,
                    presenceStatus: presence.status,
                    device: presence.device,
                  };
                }
                return user;
              });
              
              const sorted = [...updated];
              sortUsers(sorted);
              return sorted;
            });
          });
          
          // Step 3: Fetch chats (matches Angular fetchRecentChats)
          fetchChatsFromXMPP();
        },
        (errorMsg) => {
          // Only log permanent errors (like AUTHFAIL) - CONNFAIL is handled by XMPP service retry logic
          if (errorMsg === 'Authentication failed') {
            console.error('[ChatListContext] ❌ Authentication failed - permanent error');
            setError(`Authentication failed: ${errorMsg}`);
            setIsLoading(false);
          } else {
            // For CONNFAIL, XMPP service will retry automatically - just log and don't set error state
            console.warn('[ChatListContext] ⚠️ Connection failed - XMPP service will retry automatically');
            // Don't set error state or stop loading - let retry logic handle it
          }
        }
      );
    };

    // Handle presence updates (both roster and real-time changes)
    // Matches Angular: presenceManager.onPresenceReceived → userManager.updateUsersPresenceStatus
    const handlePresenceUpdate = (presenceMap: Record<string, { status: number; device: number }>) => {
      console.log('[ChatListContext] 📡 Presence update received, updating user presence...');
      console.log('[ChatListContext] Presence map:', Object.keys(presenceMap).length, 'users');
      
      // Update users with presence data and re-sort (matches Angular userManager.updateUsersPresenceStatus)
      // Matches Angular: userManager.onPresenceChanged → sortUsers() → firePresenceChanged
      setUsers(prevUsers => {
        if (prevUsers.length === 0) {
          console.log('[ChatListContext] No users yet, presence will be merged when users are fetched');
          return prevUsers; // Users not loaded yet, will merge when fetched
        }
        
        const updated = prevUsers.map(user => {
          const userId = getUserId(user);
          const presence = presenceMap[userId];
          if (presence) {
            console.log(`[ChatListContext] Updating ${userId} presence: ${presence.status} (device: ${presence.device})`);
            return {
              ...user,
              presenceStatus: presence.status,
              device: presence.device,
            };
          }
          // Keep existing presence or default to offline
          return user;
        });
        
        // Re-sort users with updated presence (matches Angular sortUsers)
        // Angular: userManager.onPresenceChanged → sortUsers() (line 335, 533, 571, 605, 622)
        const sorted = [...updated];
        sortUsers(sorted);
        console.log('[ChatListContext] ✅ Users updated with presence and re-sorted:', sorted.length, 'users');
        console.log('[ChatListContext] User order:', sorted.map(u => ({
          name: `${u.first_name} ${u.last_name}`,
          presence: u.presenceStatus || 4,
          rank: (u as any).rank || 0
        })));
        return sorted;
      });
      
      // Also update chats with presence data for P2P participants (matches Angular)
      setChats(prevChats => {
        let updatedCount = 0;
        const updated = prevChats.map(chat => {
          if (chat.chatType === 1 && chat._user) { // P2P chat
            const userId: string = chat._user.userId;
            const presence = presenceMap[userId];
            if (presence) {
              updatedCount++;
              console.log(`[ChatListContext] Updating P2P chat ${chat.chatId} with presence for ${userId}: status=${presence.status}, device=${presence.device}`);
              return {
                ...chat,
                _user: {
                  ...chat._user,
                  presenceStatus: presence.status,
                  device: presence.device,
                },
              };
            }
          }
          return chat;
        });
        
        console.log(`[ChatListContext] Updated ${updatedCount} P2P chats with presence`);
        
        // Re-sort chats by last message timestamp (matches Angular ChatUtils.sortChats)
        // IMPORTANT: Chats are sorted by timestamp, NOT by presence
        // Presence only affects user sorting, not chat sorting
        const sorted = [...updated];
        sortChats(sorted);
        console.log('[ChatListContext] ✅ Chats re-sorted by timestamp after presence update');
        
        // Trigger re-fetch of users to merge presence (if users haven't been fetched yet)
        // This ensures presence is merged when users are loaded
        // Use the updated chats from this state setter
        if (users.length === 0) {
          console.log('[ChatListContext] Triggering user fetch to merge presence data...');
          fetchNetworkUsers(sorted);
        }
        
        return sorted;
      });
    };

    // Listen for roster received event (initial presence data)
    const handleRosterReceived = (event: CustomEvent<Record<string, { status: number; device: number }>>) => {
      handlePresenceUpdate(event.detail);
    };
    
    // Listen for real-time presence changes (when users change status)
    const handlePresenceChanged = (event: CustomEvent<Record<string, { status: number; device: number }>>) => {
      console.log('[ChatListContext] 🔄 Real-time presence change detected');
      handlePresenceUpdate(event.detail);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('xmppRosterReceived', handleRosterReceived as EventListener);
      window.addEventListener('xmppPresenceChanged', handlePresenceChanged as EventListener);
    }

    // Wait for config to be ready (ConfigScript sets it)
    // Try immediately first
    const config = getXMPPConfig();
    if (config) {
      console.log('[ChatListContext] Config available immediately, initializing...');
      initializeChat();
    } else {
      console.log('[ChatListContext] Config not ready, waiting for configReady event...');
      // Listen for configReady event from ConfigScript
      const handleConfigReady = () => {
        console.log('[ChatListContext] configReady event received, initializing...');
        initializeChat();
      };
      
      window.addEventListener('configReady', handleConfigReady);
      
      // Also listen for login event
      const handleLoginReceived = () => {
        console.log('[ChatListContext] loginDataRecieved event received, initializing...');
        // Wait a bit for session data to be set
        setTimeout(initializeChat, 100);
      };
      
      document.body.addEventListener('loginDataRecieved', handleLoginReceived);

      // Cleanup listeners
      return () => {
        window.removeEventListener('configReady', handleConfigReady);
        document.body.removeEventListener('loginDataRecieved', handleLoginReceived);
        if (typeof window !== 'undefined') {
          window.removeEventListener('xmppRosterReceived', handleRosterReceived as EventListener);
          window.removeEventListener('xmppPresenceChanged', handlePresenceChanged as EventListener);
        }
        console.log('[ChatListContext] Cleaning up XMPP connection');
        xmppChatService.disconnect();
      };
    }

    return () => {
      // Cleanup on unmount
      if (typeof window !== 'undefined') {
        window.removeEventListener('xmppRosterReceived', handleRosterReceived as EventListener);
        window.removeEventListener('xmppPresenceChanged', handlePresenceChanged as EventListener);
      }
      console.log('[ChatListContext] Cleaning up XMPP connection');
      xmppChatService.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setSelectedUserId(null); // Deselect user
  };

  const selectUser = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedChatId(null); // Deselect chat
  };

  const refreshChats = () => {
    fetchChatsFromXMPP();
  };

  // Load unread counts from localStorage on initialization (matches AngularJS chatsDiskManager.loadFromLocalStore)
  useEffect(() => {
    if (typeof window === 'undefined' || chats.length === 0) return;
    
    const win = typeof window !== 'undefined' ? (window as any) : null;
    const accountId = win?.com_convo?.sessionData?.signInResponseData?.account_id;
    const userId = win?.com_convo?.sessionData?.signInResponseData?.user?.user_id;
    
    if (!accountId || !userId) return;
    
    try {
      const unreadCountsKey = `com.convo.chat.${accountId}.${userId}.unread_counts`;
      const storedValue = localStorage.getItem(unreadCountsKey);
      
      if (storedValue) {
        const unreadCountsMap: Record<string, number> = JSON.parse(storedValue);
        console.log('[ChatListContext] 📦 Loaded unread counts from localStorage:', Object.keys(unreadCountsMap).length, 'chats');
        
        // Restore unread counts for chats
        setChats(prevChats => {
          const updated = prevChats.map(chat => {
            const storedCount = unreadCountsMap[chat.chatId];
            if (storedCount !== undefined && storedCount > 0) {
              console.log(`[ChatListContext] ✅ Restored unread count for ${chat.chatId}: ${storedCount}`);
              return { ...chat, unreadCount: storedCount };
            }
            return chat;
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('[ChatListContext] ❌ Error loading unread counts:', error);
    }
  }, [chats.length]); // Only run when chats are first loaded

  // Listen for unread count updates from other tabs (multi-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Listen for BroadcastChannel messages
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel('convoUnreadCountsChannel');
      broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.tabId !== getTabId()) {
          const { chatId, count, type } = event.data;
          console.log('[ChatListContext] 📡 Received unread count update from other tab:', { chatId, count, type });
          
          if (type === 'UNREAD_COUNT_UPDATE' || type === 'UNREAD_COUNT_RESET') {
            setChats(prevChats => {
              const updated = prevChats.map(chat => {
                if (chat.chatId === chatId && chat.unreadCount !== count) {
                  console.log(`[ChatListContext] 📊 Syncing unread count from other tab: ${chatId}: ${chat.unreadCount} → ${count}`);
                  return { ...chat, unreadCount: count };
                }
                return chat;
              });
              return updated;
            });
          }
        }
      };
    } catch (error) {
      console.warn('[ChatListContext] BroadcastChannel not available for unread counts');
    }
    
    // Listen for custom events (fallback)
    const handleUnreadCountUpdate = (event: CustomEvent<{ chatId: string; count: number; tabId: string }>) => {
      if (event.detail.tabId !== getTabId()) {
        const { chatId, count } = event.detail;
        console.log('[ChatListContext] 📡 Received unread count update via custom event:', { chatId, count });
        
        setChats(prevChats => {
          const updated = prevChats.map(chat => {
            if (chat.chatId === chatId && chat.unreadCount !== count) {
              return { ...chat, unreadCount: count };
            }
            return chat;
          });
          return updated;
        });
      }
    };
    
    window.addEventListener('unreadCountUpdated', handleUnreadCountUpdate as EventListener);
    
    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      window.removeEventListener('unreadCountUpdated', handleUnreadCountUpdate as EventListener);
    };
  }, [getTabId]);

  return (
    <ChatListContext.Provider value={{ 
      chats, 
      users, 
      allUsers, // Expose ALL users for profile image lookup
      isLoading, 
      error, 
      selectedChatId, 
      selectedUserId,
      selectChat, 
      selectUser,
      refreshChats,
      resortChatList, // Expose for external triggers
      updateUnreadCount,
      resetUnreadCount,
      getUnreadCount,
    }}>
      {children}
    </ChatListContext.Provider>
  );
}

export function useChatList() {
  const context = useContext(ChatListContext);
  if (!context) {
    throw new Error('useChatList must be used within ChatListProvider');
  }
  return context;
}

