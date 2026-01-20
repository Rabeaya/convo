'use client';

/**
 * ChatWindow - Individual docked chat window
 * 
 * Replicates AngularJS chatWindow behavior:
 * - Docked at bottom-right of screen
 * - Can be minimized/maximized/closed
 * - Resizable height
 * - Shows chat history and message input
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useChatWindows } from '@/contexts/ChatWindowsContext';
import { useMessages } from '@/contexts/MessagesContext';
import { useChatList } from '@/contexts/ChatListContext';
import { xmppChatService } from '@/utils/xmppChatService';
import { calculateChatWindowPosition } from '@/utils/chatWindowPositioning';
import type { Chat, ChatParticipant } from '@/types/chat';
import type { ChatMessage } from '@/types/message';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import UserProfileImage from '@/components/common/UserProfileImage';
import ParticipantList from './ParticipantList';
import AddPeopleToChat from './AddPeopleToChat';
import UserSearchDropdown from './UserSearchDropdown';
import { computeGroupChatTitle } from '@/utils/chatTitleUtils';
import type { NetworkUser } from '@/types/chat';
import './ChatWindow.css';
import '../chat/ChatListWindow-icons.css'; // For presence status icons

// CRITICAL: Module-level map to track file upload messages (matches AngularJS fileIdToChatMessageMap)
// This map stores message references BEFORE server ACK arrives, keyed by fileUploadName
// This allows us to find messages even after server ACK changes the messageId
// Structure: { [fileUploadName]: { chatId: string, messageId: string, timestamp: number } }
const fileIdToChatMessageMap: Record<string, { chatId: string; messageId: string; timestamp: number }> = {};

interface ChatWindowProps {
  chatId: string;
  chat: Chat;
  isMinimized: boolean;
  initialHeight: number;
  position: number; // Index in windows array for positioning
  chatListIsMinimized?: boolean; // Whether chat list is minimized (for positioning)
}

export default function ChatWindow({
  chatId,
  chat,
  isMinimized,
  initialHeight,
  position,
  chatListIsMinimized = false,
}: ChatWindowProps) {
  const {
    openWindows,
    closeChatWindow,
    minimizeChatWindow,
    maximizeChatWindow,
    setFocusedChat,
    focusedChatId,
  } = useChatWindows();
  
  const { resetUnreadCount, allUsers } = useChatList();
  
  // Compute group chat title if needed (matches AngularJS chat.getTitle)
  const displayTitle = useMemo(() => {
    if (chat.chatType === 2 && (!chat.title || chat.title.trim() === '')) {
      const currentUserId = typeof window !== 'undefined' 
        ? ((window as any)?.com_convo?.sessionData?.signInResponseData?.user?.user_id || '')
        : '';
      return computeGroupChatTitle(chat, allUsers, currentUserId);
    }
    return chat.title || 'Chat';
  }, [chat, allUsers]);
  
  // State for AddPeopleToChat modal
  const [showAddPeopleModal, setShowAddPeopleModal] = useState(false);
  
  // State for UserSearchDropdown (inline dropdown for small chat window)
  const [showUserSearchDropdown, setShowUserSearchDropdown] = useState(false);
  
  // Enrich chat._user with profile image data from allUsers (matches MessageList logic)
  const enrichedUser = React.useMemo(() => {
    if (!chat._user || chat.chatType !== 1) return chat._user;
    
    // If profile image data is missing or empty, try to enrich from allUsers
    if (!chat._user.profileImageType || chat._user.profileImageType === '' || 
        !chat._user.profileImageVersion || chat._user.profileImageVersion === '') {
      const userFromList = allUsers.find(u => {
        const userId = (u as any).user_id || (u as any).userId;
        return userId === chat._user.userId;
      });
      if (userFromList) {
        return {
          ...chat._user,
          profileImageType: chat._user.profileImageType && chat._user.profileImageType !== '' 
            ? chat._user.profileImageType 
            : (userFromList.profile_image_type !== undefined && userFromList.profile_image_type !== null 
                ? String(userFromList.profile_image_type) 
                : undefined),
          profileImageVersion: chat._user.profileImageVersion && chat._user.profileImageVersion !== '' 
            ? chat._user.profileImageVersion 
            : (userFromList.profile_image_version !== undefined && userFromList.profile_image_version !== null 
                ? String(userFromList.profile_image_version) 
                : undefined),
        };
      }
    }
    return chat._user;
  }, [chat._user, allUsers, chat.chatType]);

  // Use global message store instead of local state (matches AngularJS global chatIdToChatMap)
  // CRITICAL: Access state directly (globalMessages) so React detects changes and re-renders
  // Using getMessages() doesn't trigger re-renders because it's a function call, not a reactive value
  const messagesContext = useMessages();
  const { messages: globalMessages, getMessages, setMessages: setGlobalMessages, mergeMessages: mergeGlobalMessages, addMessage: addGlobalMessage, processFailedMessages, loadMessagesFromLocalStore } = messagesContext;
  
  // Get messages for this chat from global store
  // CRITICAL: Access directly from globalMessages - React Context will trigger re-render when state changes
  // When reducer updates state, it creates a new globalMessages object with new array references
  // React Context will trigger re-render when context value changes
  const messages = globalMessages[chat.chatId] || [];
  
  // Debug: Log messages access (disabled by default)
  // if (typeof window !== 'undefined' && (window as any).__DEBUG_MESSAGES__) {
  //   console.log('[ChatWindow] 📋 Messages accessed:', {
  //     chatId: chat.chatId,
  //     count: messages.length,
  //     messageIds: messages.map(m => m.messageId),
  //     lastMessageId: messages[messages.length - 1]?.messageId,
  //     lastMessageText: messages[messages.length - 1]?.messageText?.substring(0, 20),
  //     globalMessagesKeys: Object.keys(globalMessages),
  //     globalMessagesRef: globalMessages,
  //     messagesReference: messages,
  //   });
  // }

  const [height, setHeight] = useState(initialHeight);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Get current user ID from session
  const getCurrentUserId = () => {
    if (typeof window !== 'undefined') {
      const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
      return sessionData?.user?.user_id || 'me';
    }
    return 'me';
  };

  const currentUserId = getCurrentUserId();

  // Calculate position using AngularJS logic (matches adjustChatWindowsPosition)
  // This accounts for minimized/maximized states and proper spacing
  // CRITICAL: Use position prop which is the index in filtered activeWindows array
  // In AngularJS, minimized windows are removed from chatWindows, so they don't affect positioning
  // The position prop passed from DockedChat is already the correct index among active windows only
  const rightOffset = useMemo(() => {
    // Filter to only active (non-minimized) windows for position calculation
    // This matches AngularJS where minimized windows are removed from chatWindows array
    const activeWindows = openWindows.filter(w => !w.isMinimized);
    const activeWindowsForPosition = activeWindows.map(w => ({
      chatId: w.chatId,
      isMinimized: false, // All are active
    }));
    
    // Use position prop which is already the index in activeWindows array
    return calculateChatWindowPosition(
      position,
      activeWindowsForPosition,
      { isMinimized: chatListIsMinimized }
    );
  }, [position, openWindows, chatListIsMinimized]);

  const handleMinimize = useCallback(() => {
    minimizeChatWindow(chatId);
  }, [chatId, minimizeChatWindow]);

  const handleMaximize = useCallback(() => {
    maximizeChatWindow(chatId);
  }, [chatId, maximizeChatWindow]);

  const handleClose = useCallback(() => {
    closeChatWindow(chatId);
  }, [chatId, closeChatWindow]);

  // Handle chat focus/unfocus (matches AngularJS chatWindow.js setWindFocus lines 153-191)
  // When chat gains focus: reset unread count (matches AngularJS line 188-191)
  useEffect(() => {
    if (!isMinimized && chat.chatId && !chat.chatId.startsWith('temp-')) {
      // Chat gained focus (matches AngularJS chatWindow.js line 183: chatManager.chatGainedFocus)
      // CRITICAL: Only set focus if it's different to prevent infinite loop
      if (focusedChatId !== chat.chatId) {
        setFocusedChat(chat.chatId);
      }
      
      // Reset unread count if > 0 (matches AngularJS chatWindow.js lines 188-191)
      if (chat.unreadCount > 0) {
        resetUnreadCount(chat.chatId);
        
        // TODO: Send chatRead IQ stanza to server (matches AngularJS chatManager.chatRead)
        // This will be implemented when we add the XMPP chatRead method
      }
    } else {
      // Chat lost focus (matches AngularJS chatWindow.js chatLostFocus)
      // CRITICAL: Only clear focus if this chat was focused to prevent infinite loop
      if (focusedChatId === chat.chatId) {
        setFocusedChat(null);
      }
    }
  }, [isMinimized, chat.chatId, chat.unreadCount, focusedChatId, setFocusedChat, resetUnreadCount]);
  
  // Separate cleanup effect to handle unmount/minimize
  useEffect(() => {
    return () => {
      // Cleanup: chat lost focus when component unmounts or becomes minimized
      // Only clear if this chat was focused (prevents unnecessary updates)
      if (focusedChatId === chat.chatId) {
        setFocusedChat(null);
      }
    };
  }, [chat.chatId, focusedChatId, setFocusedChat]);

  // Load messages when chat opens (matches Angular messagesLoader.chatOpened EXACTLY)
  // AngularJS: chatManager.chatOpened() → messagesLoader.chatOpened() → fetchMessages()
  useEffect(() => {
    if (!isMinimized && chat.chatId && !chat.chatId.startsWith('temp-')) {
      // Prevent duplicate loading (matches AngularJS chat.isLoadingInProgress check line 2175)
      if ((chat as any).isLoadingInProgress) {
        return;
      }
      (chat as any).isLoadingInProgress = true;
      setIsLoadingMessages(true);

      // Matches AngularJS messagesLoader.chatOpened() lines 2182-2195 EXACTLY:
      // - If admin mode ON OR unreadCount == 0 OR unreadCount <= 20: fetch from_index 1 to 20
      // - Otherwise: fetch from lastSeenSequenceNumber + 1 to lastMessageSequenceNumber
      const MESSAGE_FETCH_PAGE_SIZE = 20; // Matches AngularJS constant
      let range: { from_index?: number; to_index?: number; from_sequence_number?: number; to_sequence_number?: number };
      
      // Check if admin mode (simplified - check if needed)
      const isAdminMode = false; // TODO: Implement admin mode check if needed
      
      if (isAdminMode || chat.unreadCount === 0 || chat.unreadCount <= MESSAGE_FETCH_PAGE_SIZE) {
        range = {
          from_index: 1,
          to_index: MESSAGE_FETCH_PAGE_SIZE
        };
      } else {
        // Get this participant's lastSeenMessageSequenceNumber
        const thisParticipant = chat.participants?.[currentUserId];
        const lastSeenSeqNo = thisParticipant?.lastSeenMessageSequenceNumber || 0;
        const lastMessageSeqNo = (chat as any).lastMessageSequenceNumber || 0;
        
        range = {
          from_sequence_number: lastSeenSeqNo + 1,
          to_sequence_number: lastMessageSeqNo
        };
      }

      // Load persisted messages from localStorage first (matches AngularJS chatLocalStore.selectMessages)
      const persistedMessages = loadMessagesFromLocalStore(chat.chatId);
      // CRITICAL: Don't clear loading state immediately even if we have persisted messages
      // We still want to show loader while fetching fresh messages from server
      // Only clear loading state after fetch completes (success or error)
      if (persistedMessages.length > 0) {
        // Merge persisted messages immediately (they'll be merged with fetched messages below)
        mergeGlobalMessages(chat.chatId, persistedMessages);
      }

      // CRITICAL: Set timeout to prevent infinite loading state
      // If fetch doesn't complete within 10 seconds, reset loading state
      const loadingTimeout = setTimeout(() => {
        console.warn('[ChatWindow] ⚠️ Message fetch timeout - resetting loading state');
        (chat as any).isLoadingInProgress = false;
        setIsLoadingMessages(false);
      }, 10000); // 10 second timeout
      
      // Get unified chat info (matches AngularJS lines 2199-2202)
      const sessionData = (typeof window !== 'undefined' && (window as any).com_convo?.sessionData?.signInResponseData);
      const isUnifiedChat = chat.isUnifiedChat || false;
      const unifiedNetworkAccountId = sessionData?.unified_network_settings?.account_id || sessionData?.account_id;

      // Fetch messages using proper range (matches AngularJS IQ stanza structure)
      xmppChatService.fetchMessagesWithRange(
        chat.chatId,
        range,
        (fetchedMessages) => {
          // Clear timeout on success
          clearTimeout(loadingTimeout);
          
          // CRITICAL: If no messages fetched but we have persisted messages, that's OK
          // Don't show error, just use persisted messages
          if (fetchedMessages.length === 0 && persistedMessages.length > 0) {
            (chat as any).isLoadingInProgress = false;
            setIsLoadingMessages(false);
            return;
          }

          // Sort messages by sequenceNumber (matches AngularJS Util.sortMessages)
          // AngularJS sorts by sequenceNumber ascending (oldest first)
          const sortedFetchedMessages = [...fetchedMessages].sort((a, b) => {
            // First sort by sequenceNumber if available
            if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
              if (a.sequenceNumber !== b.sequenceNumber) {
                return a.sequenceNumber - b.sequenceNumber;
              }
            }
            // Fallback to timestamp
            return a.timestamp - b.timestamp;
          });
          
          // Process failed messages and merge with history (matches AngularJS messagesLoader.processMessages line 2679)
          // This merges optimistic/failed messages from localStorage with fetched history
          const existingMessages = getMessages(chat.chatId);
          const maxSequenceNumber = (chat as any).maxSequenceNumber || 0;
          const messagesWithFailed = processFailedMessages(
            chat.chatId,
            sortedFetchedMessages,
            existingMessages,
            maxSequenceNumber
          );
          
          // Merge with existing messages, replacing optimistic ones (matches AngularJS chat.appendMessages)
          // Use global store mergeMessages which handles deduplication and optimistic message replacement
          mergeGlobalMessages(chat.chatId, messagesWithFailed);
          
          // Calculate and set minSequenceNumber for load older messages (matches AngularJS chat.minSequenceNumber)
          const allMessages = getMessages(chat.chatId);
          if (allMessages.length > 0) {
            const minSeq = Math.min(...allMessages.map(m => m.sequenceNumber || 0).filter(seq => seq > 0));
            if (minSeq > 0) {
              // Update chat in ChatListContext via event (will be handled by ChatListContext)
              // The ChatListContext useEffect will update minSequenceNumber when messages change
            }
          }
          
          (chat as any).isLoadingInProgress = false;
          setIsLoadingMessages(false);
          
          // Auto-scroll to bottom after messages load (matches AngularJS historyLoaded)
          // CRITICAL: Use requestAnimationFrame to ensure DOM is updated before scrolling
          // CRITICAL: Debounce to prevent blinking - only scroll once after messages are loaded
          requestAnimationFrame(() => {
            setTimeout(() => {
              const messageContainer = document.getElementById(`msgWinId-${chat.chatId}`);
              if (messageContainer) {
                messageContainer.scrollTop = messageContainer.scrollHeight;
                // Single scroll event - MutationObserver in scrollbar hook will handle recalculation
                messageContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
              }
            }, 100);
          });
        },
        (error) => {
          // Clear timeout on error
          clearTimeout(loadingTimeout);
          
          // Failed to load messages
          console.error('[ChatWindow] ❌ Failed to load messages:', error);
          
          // CRITICAL: If we have persisted messages, use them instead of showing error
          // This prevents infinite spinner when XMPP is not connected but we have cached messages
          const existingMessages = getMessages(chat.chatId);
          if (existingMessages.length > 0 || persistedMessages.length > 0) {
            // We have messages from localStorage, so don't show error
            // Just clear loading state
            (chat as any).isLoadingInProgress = false;
            setIsLoadingMessages(false);
          } else {
            (chat as any).isLoadingInProgress = false;
            setIsLoadingMessages(false);
          }
        },
        isUnifiedChat,
        unifiedNetworkAccountId
      );
    }
    // CRITICAL: Only depend on chat.chatId, isMinimized, and currentUserId
    // mergeGlobalMessages, getMessages, and loadMessagesFromLocalStore are stable functions from context
    // Adding them to dependencies causes unnecessary re-renders and blinking
  }, [chat.chatId, isMinimized, currentUserId]);

  // NOTE: Real-time messages are now handled globally by MessagesContext
  // The context receives XMPP messages and updates the global store
  // This component automatically re-renders when messages change because we access globalMessages[chatId] directly
  // Multi-tab sync is handled by BroadcastChannel/localStorage in MessagesContext
  
  // CRITICAL: Scroll management is handled by MessageList component
  // This matches AngularJS where scroll logic is in chatWindow.js but operates on chatMessageListContainer
  // We removed duplicate scroll logic from here to avoid conflicts

  // Send message handler (matches Angular chatManager.sendMessage EXACTLY)
  const handleSendMessage = useCallback((messageText: string) => {

    // Validate chat state (matches AngularJS chatManager.sendMessage lines 149-154)
    if (chat.chatType && chat.participants && chat.participants[currentUserId]?.status === 'invited') {
      // Cannot send message - user is invited
      return;
    }

    // Get recipient JID for P2P chats (matches AngularJS sendMessageInP2PChat)
    let recipientJid = '';
    if (chat.chatType === 1 && chat._user) {
      const domain = (window as any).com_convo?.config?.XMPP_DOMAIN || 'xmpp.convodev.net';
      const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
      const accountId = sessionData?.account_id;
      recipientJid = `${accountId};${chat._user.userId}@${domain}`;
    }

    // Get recipient display name from chat participants (matches AngularJS other.displayName || other.getDisplayName())
    const recipientDisplayName = chat._user?.displayName || chat._user?.name || '';

    // Unified chat account id (needed for groupchat stanzas)
    const sessionData = (typeof window !== 'undefined' && (window as any).com_convo?.sessionData?.signInResponseData);
    const unifiedNetworkAccountId = sessionData?.unified_network_settings?.account_id || sessionData?.account_id;
    
    // Send via XMPP (P2P vs GROUP matches AngularJS)
    const optimisticMessage =
      chat.chatType === 2
        ? xmppChatService.sendGroupMessage(
            messageText,
            chat,
            () => {
              // Sent successfully (server echo will update sequenceNumber)
            },
            () => {
              // Failed to send
            },
            undefined,
            undefined,
            unifiedNetworkAccountId
          )
        : xmppChatService.sendMessage(
            messageText,
            chat.chatId,
            recipientJid,
            recipientDisplayName, // Pass recipient display name (matches AngularJS line 545)
            () => {
              // Message sent successfully - Server ACK will update sequenceNumber via messageReceivedAtServer handler
            },
            () => {
              // Failed to send message - TODO: Handle retry logic (matches AngularJS sentMsgFailed handler)
            }
          );

    // Add optimistic message to global store immediately (matches AngularJS messagesLoaderSentMessageInChat)
    if (optimisticMessage && messagesContext?.addMessage) {
      console.log('[ChatWindow] 🚀 Calling addMessage for optimistic message:', {
        messageId: optimisticMessage.messageId,
        chatId: chat.chatId,
        sequenceNumber: optimisticMessage.sequenceNumber,
      });
      messagesContext.addMessage(chat.chatId, optimisticMessage);
      console.log('[ChatWindow] ✅ addMessage called');
    } else {
      console.warn('[ChatWindow] ⚠️ Cannot add optimistic message:', {
        hasOptimisticMessage: !!optimisticMessage,
        hasAddMessage: !!messagesContext?.addMessage,
      });
    }
    
    // CRITICAL: Scroll management is handled by MessageList component
    // MessageList detects when a message is sent (by checking if last message senderId === currentUserId)
    // and automatically scrolls to bottom (matches AngularJS messageSent handler)
    // No need to manually scroll here - MessageList will handle it
  }, [chat, currentUserId, messagesContext]);

  // Handle GIF selection (matches AngularJS onGifSelectionFromGiphy line 19-51)
  // Flow: 1) Create fileDetail, 2) Send optimistic message, 3) Call fileConversionReq, 4) Poll if converting, 5) Update message when complete
  const handleGifSelect = useCallback(async (gifUrl: string, gifData: any) => {
    console.log('[ChatWindow] GIF selected:', { gifUrl, gifData });
    
    try {
      // Import file upload service dynamically to avoid circular dependencies
      const { fileConversionReq, pollFileConversionStatus } = await import('@/utils/fileUploadService');
      
      // Get unified network account ID if needed (matches AngularJS networkSettingService)
      const getUnifiedNetworkAccountId = () => {
        if (typeof window !== 'undefined') {
          const networkSettingService = (window as any).com_convo?.networkSettingService;
          if (networkSettingService && typeof networkSettingService.getUnifiedNetworkAccountId === 'function') {
            return networkSettingService.getUnifiedNetworkAccountId();
          }
        }
        return undefined;
      };
      
      const unifiedNetworkAccountId = getUnifiedNetworkAccountId();
      const isUnifiedChat = chat.isUnifiedChat || false;
      
      // Step 1: Create initial fileInfo WITHOUT fileId (matches AngularJS chatFilesManager.onFileLoaded line 23-25)
      // CRITICAL: fileId is NOT set initially - it's only set AFTER conversion completes
      // This matches AngularJS: when onFileLoaded is called, fileData.serverFileId doesn't exist yet
      // So messageFileInfo.fileId = fileData.serverFileId is undefined, and upload UI shows
      const initialFileInfo: ChatMessage['fileInfo'] = {
        // Don't set fileId - it will be set after conversion completes (matches AngularJS line 24: fileId = fileData.serverFileId, but serverFileId is undefined)
        fileId: undefined, // CRITICAL: No fileId initially - matches AngularJS: !msgItem.fileInfo.fileId shows upload UI
        name: gifData.name,
        size: gifData.size,
        type: gifData.type,
        isUploading: true, // Uploading initially (matches AngularJS line 25: isUploading = true)
        fileFormat: 'GIF', // Will be updated after conversion
        format: 'GIF',
        storage_version: 1,
      };
      
      // Step 2: Send optimistic message WITHOUT fileId (matches AngularJS chatFilesManager.onFileLoaded line 26)
      // Message is created immediately when onFileLoaded is called, before fileConversionReq completes
      const recipientJid = chat.chatType === 1 && chat._user
        ? (() => {
            const domain = (window as any).com_convo?.config?.XMPP_DOMAIN || 'xmpp.convodev.net';
            const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
            const accountId = sessionData?.account_id;
            return `${accountId};${chat._user.userId}@${domain}`;
          })()
        : '';
      
      const recipientDisplayName = chat._user?.displayName || chat._user?.name || '';
      
      // Send optimistic message (matches AngularJS - message sent immediately, but fileId is undefined)
      // Note: XMPP message is NOT sent yet because fileInfo.status != FS_SUCCESS (matches AngularJS line 572)
      const optimisticMessage = xmppChatService.sendMessage(
        '', // Empty message text for GIFs (matches AngularJS)
        chat.chatId,
        recipientJid,
        recipientDisplayName,
        () => {
          // Message sent successfully
        },
        (error) => {
          console.error('[ChatWindow] Failed to send GIF:', error);
        },
        initialFileInfo // Pass file info WITHOUT fileId
      );
      
      // Add optimistic message to global store IMMEDIATELY (matches AngularJS - message added immediately)
      // This ensures upload UI shows right away because fileId is undefined
      if (optimisticMessage && messagesContext?.addMessage) {
        // CRITICAL: Create a new message object with fileInfo and gifUrl to ensure they're preserved
        // The spread operator ensures all properties are copied, including fileInfo
        // CRITICAL: Ensure fileId is explicitly undefined (not just missing) to match AngularJS
        const messageWithFileInfo: ChatMessage = {
          ...optimisticMessage,
          fileInfo: {
            ...initialFileInfo,
            // CRITICAL: Explicitly set fileId to undefined (not just omit it)
            // This ensures the upload UI condition (!fileId) works correctly
            fileId: undefined,
          },
        };
        
        // Store GIF URL for upload UI preview (matches AngularJS file.localUrl)
        (messageWithFileInfo as any).gifUrl = gifUrl;
        // Store fileUploadName for mapping (matches AngularJS fileIdToChatMessageMap)
        const fileUploadName = `${gifData.name || 'giphy.gif'}`;
        (messageWithFileInfo as any).fileUploadName = fileUploadName;
        
        // CRITICAL: Store message reference in map BEFORE server ACK arrives (matches AngularJS line 28-30)
        // This allows us to find the message even after server ACK changes the messageId
        // CRITICAL: Also store by messageId for direct lookup fallback
        if (!fileIdToChatMessageMap[fileUploadName]) {
          fileIdToChatMessageMap[fileUploadName] = {
            chatId: chat.chatId,
            messageId: messageWithFileInfo.messageId,
            timestamp: messageWithFileInfo.timestamp,
            senderId: messageWithFileInfo.senderId, // Store senderId for fallback lookup
          };
          // CRITICAL: Also store by messageId for direct lookup
          (fileIdToChatMessageMap as any)[`msg_${messageWithFileInfo.messageId}`] = {
            chatId: chat.chatId,
            messageId: messageWithFileInfo.messageId,
            timestamp: messageWithFileInfo.timestamp,
            senderId: messageWithFileInfo.senderId,
            fileUploadName,
          };
          console.log('[ChatWindow] ✅ Stored message reference in fileIdToChatMessageMap:', {
            fileUploadName,
            messageId: messageWithFileInfo.messageId,
            chatId: chat.chatId,
            timestamp: messageWithFileInfo.timestamp,
            senderId: messageWithFileInfo.senderId,
          });
        }
        
        console.log('[ChatWindow] 📤 About to add message with fileInfo:', {
          messageId: messageWithFileInfo.messageId,
          chatId: chat.chatId,
          hasFileInfo: !!messageWithFileInfo.fileInfo,
          fileId: messageWithFileInfo.fileInfo?.fileId,
          fileIdType: typeof messageWithFileInfo.fileInfo?.fileId,
          fileInfo: JSON.parse(JSON.stringify(messageWithFileInfo.fileInfo)), // Deep clone for logging
          gifUrl: (messageWithFileInfo as any).gifUrl,
        });
        
        messagesContext.addMessage(chat.chatId, messageWithFileInfo);
        
        console.log('[ChatWindow] ✅ Optimistic GIF message added to store:', {
          messageId: messageWithFileInfo.messageId,
          chatId: chat.chatId,
          fileId: messageWithFileInfo.fileInfo?.fileId,
          fileIdType: typeof messageWithFileInfo.fileInfo?.fileId,
          hasFileInfo: !!messageWithFileInfo.fileInfo,
          isUploading: messageWithFileInfo.fileInfo?.isUploading,
          fileName: messageWithFileInfo.fileInfo?.name,
          gifUrl: (messageWithFileInfo as any).gifUrl,
        });
        
        // CRITICAL: Verify message was added correctly by reading it back from store
        if (messagesContext?.getMessages) {
          const messages = messagesContext.getMessages(chat.chatId);
          const addedMessage = messages.find(m => m.messageId === messageWithFileInfo.messageId);
          console.log('[ChatWindow] 🔍 Verification - Message in store after add:', {
            found: !!addedMessage,
            fileId: addedMessage?.fileInfo?.fileId,
            fileIdType: typeof addedMessage?.fileInfo?.fileId,
            hasFileInfo: !!addedMessage?.fileInfo,
            gifUrl: (addedMessage as any)?.gifUrl,
          });
        }
      } else {
        console.error('[ChatWindow] ❌ Failed to add optimistic message:', {
          hasOptimisticMessage: !!optimisticMessage,
          hasAddMessage: !!messagesContext?.addMessage,
        });
      }
      
      // Step 3: Call file conversion request ASYNCHRONOUSLY (matches AngularJS UploadService.fileConversionReq line 42)
      // This happens AFTER message is created, matching AngularJS flow
      // In AngularJS: onFileLoaded is called first, then fileConversionReq is called (fire-and-forget)
      // Handle conversion asynchronously without blocking
      // CRITICAL: Store messageId to find message in store later (optimisticMessage reference might be stale)
      const storedMessageId = optimisticMessage?.messageId;
      
      // CRITICAL: Store optimistic messageId for direct lookup fallback
      const optimisticMessageId = optimisticMessage?.messageId;
      const optimisticSenderId = optimisticMessage?.senderId;
      
      console.log('[ChatWindow] 📤 Starting file conversion for GIF:', {
        optimisticMessageId,
        optimisticSenderId,
        fileUploadName: `${gifData.name || 'giphy.gif'}`,
        chatId: chat.chatId,
      });
      
      // CRITICAL: Wait a bit before starting conversion to ensure React renders the upload UI first
      // This matches AngularJS behavior where the upload UI shows before conversion starts
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Fire-and-forget: start conversion asynchronously (don't await)
      // Define async function and call it immediately to avoid parser issues
      console.log('[ChatWindow] 🔥 About to start processFileConversion function');
      const processFileConversion = async () => {
        console.log('[ChatWindow] ✅ processFileConversion function STARTED');
        try {
          console.log('[ChatWindow] 🚀 Starting file conversion request:', {
            gifDataName: gifData.name,
            gifDataSize: gifData.size,
            gifDataType: gifData.type,
            gifDataFileUploadName: gifData.fileUploadName,
            gifDataFileUrl: gifData.file_url,
            gifDataFileId: gifData.fileId,
            gifDataSource: gifData.source,
            fullGifData: JSON.stringify(gifData),
            chatId: chat.chatId,
            isUnifiedChat,
            unifiedNetworkAccountId,
            optimisticMessageId,
          });
          
          // CRITICAL: Verify gifData has required fields
          if (!gifData.fileUploadName || !gifData.file_url) {
            console.error('[ChatWindow] ❌ gifData missing required fields:', {
              hasFileUploadName: !!gifData.fileUploadName,
              hasFileUrl: !!gifData.file_url,
              gifData,
            });
            return;
          }
          
          let conversionResponse: any;
          try {
            console.log('[ChatWindow] 📞 Calling fileConversionReq NOW...');
            conversionResponse = await fileConversionReq(
              gifData,
              chat.chatId,
              isUnifiedChat,
              unifiedNetworkAccountId
            );
            console.log('[ChatWindow] 📞 fileConversionReq returned successfully');
            
            console.log('[ChatWindow] ✅ File conversion request completed:', {
              conversionResponse,
              file: conversionResponse?.file,
              fileId: conversionResponse?.file?.file_id,
              status: conversionResponse?.file?.status,
              fullResponse: JSON.stringify(conversionResponse),
            });
          } catch (conversionError) {
            console.error('[ChatWindow] ❌ File conversion request failed:', {
              error: conversionError,
              errorMessage: conversionError instanceof Error ? conversionError.message : String(conversionError),
              errorStack: conversionError instanceof Error ? conversionError.stack : undefined,
              gifDataName: gifData.name,
              chatId: chat.chatId,
            });
            // Don't return - let the error propagate so we can handle it
            throw conversionError;
          }
          
          if (!conversionResponse || !conversionResponse.file) {
            console.error('[ChatWindow] ❌ Invalid conversion response:', {
              conversionResponse,
              hasFile: !!conversionResponse?.file,
              responseType: typeof conversionResponse,
            });
            return;
          }
          
          const serverFileId = conversionResponse.file.file_id; // Store for polling
          const conversionStatus = conversionResponse.file.status?.toLowerCase();
          const isConverting = conversionStatus === 'converting';
          const isSuccess = conversionStatus === 'success';
          
          console.log('[ChatWindow] 📥 File conversion response received:', {
            serverFileId,
            conversionStatus,
            isConverting,
            isSuccess,
            fileId: conversionResponse.file.file_id,
            originalName: conversionResponse.file.original_name,
            thumbnailName: conversionResponse.file.thumbnail_name,
            optimisticMessageId,
            optimisticSenderId,
          });
          
          // Step 4: Handle conversion response (matches AngularJS chatFilesManager.onFileDataChanged)
          if (isConverting) {
            // File is still converting - poll for status (matches AngularJS lines 672-701)
            console.log('[ChatWindow] GIF conversion in progress, polling for status...');
            
            // Poll until conversion completes (matches AngularJS pollForFilesStatus)
            const finalFileInfo = await pollFileConversionStatus(
              serverFileId,
              chat.chatId,
              isUnifiedChat,
              unifiedNetworkAccountId
            );
            
            console.log('[ChatWindow] 📥 Polling completed, finalFileInfo:', {
              finalFileInfo,
              serverFileId,
              finalFileInfoFileId: finalFileInfo?.fileId,
              finalFileInfoType: typeof finalFileInfo,
            });
            
            // Step 5: Update message with final fileInfo and set fileId (matches AngularJS chatFilesManager.onFileDataChanged line 80)
            // CRITICAL: Match AngularJS EXACTLY - use fileUploadName as primary lookup (not messageId)
            // AngularJS line 69: fileMsgInfo = fileIdToChatMessageMap[uploadFileVO.fileUploadName];
            // This is because messageId might change when server ACK replaces optimistic message
            if (finalFileInfo && messagesContext?.updateMessage && messagesContext?.getMessages) {
              const fileUploadName = `${gifData.name || 'giphy.gif'}`;
              const messages = messagesContext.getMessages(chat.chatId);
              
              console.log('[ChatWindow] 🔍 Starting message lookup for update (polling completed):', {
                fileUploadName,
                serverFileId,
                finalFileId: finalFileInfo?.fileId,
                totalMessages: messages.length,
                optimisticMessageId,
                optimisticSenderId,
              });
              
                     // CRITICAL: Try direct lookup by messageId FIRST (most reliable)
                     let messageToUpdate: ChatMessage | undefined;
                     if (optimisticMessageId) {
                       messageToUpdate = messages.find(m => m.messageId === optimisticMessageId);
                       if (messageToUpdate) {
                         console.log('[ChatWindow] ✅ Found message by optimisticMessageId (direct lookup):', {
                           messageId: messageToUpdate.messageId,
                           hasFileInfo: !!messageToUpdate.fileInfo,
                           fileId: messageToUpdate.fileInfo?.fileId,
                           isUploading: messageToUpdate.fileInfo?.isUploading,
                         });
                        // CRITICAL: If found message already has a different fileId, it's still the correct message
                        // Don't reset - this is the correct messageId, so we should update it anyway
                        // The fileId mismatch might be because updateMessage was called multiple times or server ACK changed it
                        if (messageToUpdate.fileInfo?.fileId && messageToUpdate.fileInfo.fileId !== serverFileId) {
                          console.warn('[ChatWindow] ⚠️ Found message by optimisticMessageId but it has DIFFERENT fileId! Updating anyway (correct messageId):', {
                            foundMessageId: messageToUpdate.messageId,
                            foundFileId: messageToUpdate.fileInfo.fileId,
                            expectedFileId: serverFileId,
                          });
                          // Don't reset - this is the correct message, update it with new fileId
                        }
                       } else {
                         console.log('[ChatWindow] ⚠️ Message not found by optimisticMessageId, trying fileIdToChatMessageMap');
                       }
                     }
              
              // Fallback: Primary lookup using fileIdToChatMessageMap (matches AngularJS line 69)
              if (!messageToUpdate) {
                const fileMsgInfo = fileIdToChatMessageMap[fileUploadName];
              
              console.log('[ChatWindow] 🔍 fileIdToChatMessageMap lookup:', {
                fileUploadName,
                foundInMap: !!fileMsgInfo,
                mapEntry: fileMsgInfo,
                allMapKeys: Object.keys(fileIdToChatMessageMap),
              });
              
              if (fileMsgInfo) {
                console.log('[ChatWindow] ✅ Found message reference in fileIdToChatMessageMap:', {
                  fileUploadName,
                  storedMessageId: fileMsgInfo.messageId,
                  storedChatId: fileMsgInfo.chatId,
                  currentChatId: chat.chatId,
                  storedTimestamp: fileMsgInfo.timestamp,
                });
                
                // Try to find message by stored messageId first (optimistic message)
                messageToUpdate = messages.find(m => m.messageId === fileMsgInfo.messageId);
                
                // CRITICAL: If found message already has a different fileId, it's the wrong message
                // Find the correct one (without fileId - the current uploading message)
                if (messageToUpdate && messageToUpdate.fileInfo?.fileId && messageToUpdate.fileInfo.fileId !== serverFileId) {
                  console.warn('[ChatWindow] ⚠️ Found message by stored messageId but it has DIFFERENT fileId! Finding correct one:', {
                    foundMessageId: messageToUpdate.messageId,
                    foundFileId: messageToUpdate.fileInfo.fileId,
                    expectedFileId: serverFileId,
                  });
                  messageToUpdate = undefined; // Reset to find correct one
                }
                
                // If not found by messageId, try to find by timestamp match (server ACK might have changed messageId)
                if (!messageToUpdate) {
                  console.log('[ChatWindow] 🔍 Message not found by stored messageId, trying timestamp match');
                  const optimisticSenderId = optimisticMessage?.senderId;
                  
                  // CRITICAL: Log all messages to debug why lookup fails
                  const allMessageIds = messages.map(m => m.messageId);
                  const messagesWithFileInfo = messages.filter(m => m.fileInfo);
                  const messagesWithoutFileInfo = messages.filter(m => !m.fileInfo);
                  
                  console.log('[ChatWindow] 🔍 All messages in store:', {
                    totalMessages: messages.length,
                    storedMessageId: fileMsgInfo.messageId,
                    storedTimestamp: fileMsgInfo.timestamp,
                    optimisticSenderId,
                    storedMessageIdInStore: allMessageIds.includes(fileMsgInfo.messageId),
                    allMessageIds: allMessageIds,
                    recentMessageIds: allMessageIds.slice(-5), // Last 5 messages
                    messagesWithFileInfo: messagesWithFileInfo.map(m => ({
                      messageId: m.messageId,
                      timestamp: m.timestamp,
                      senderId: m.senderId,
                      timeDiff: Math.abs(m.timestamp - fileMsgInfo.timestamp),
                      hasFileId: !!m.fileInfo?.fileId,
                      fileId: m.fileInfo?.fileId,
                      fileName: m.fileInfo?.name,
                      fileUploadName: (m as any).fileUploadName,
                      isUploading: m.fileInfo?.isUploading,
                    })),
                    messagesWithoutFileInfo: messagesWithoutFileInfo.map(m => ({
                      messageId: m.messageId,
                      timestamp: m.timestamp,
                      senderId: m.senderId,
                      timeDiff: Math.abs(m.timestamp - fileMsgInfo.timestamp),
                      sequenceNumber: m.sequenceNumber,
                    })),
                    // CRITICAL: Check if server ACK replaced the optimistic message
                    messagesWithMatchingTimestamp: messages
                      .filter(m => 
                        Math.abs(m.timestamp - fileMsgInfo.timestamp) < 1000 && // Within 1 second
                        m.senderId === optimisticSenderId
                      )
                      .map(m => ({
                        messageId: m.messageId,
                        timestamp: m.timestamp,
                        sequenceNumber: m.sequenceNumber,
                        hasFileInfo: !!m.fileInfo,
                        fileId: m.fileInfo?.fileId,
                        fileName: m.fileInfo?.name,
                        fileUploadName: (m as any).fileUploadName,
                      })),
                    // Check most recent messages from same sender
                    recentMessagesFromSender: messages
                      .filter(m => m.senderId === optimisticSenderId)
                      .slice(-5)
                      .map(m => ({
                        messageId: m.messageId,
                        timestamp: m.timestamp,
                        hasFileInfo: !!m.fileInfo,
                        fileId: m.fileInfo?.fileId,
                        sequenceNumber: m.sequenceNumber,
                      })),
                  });
                  
                  // CRITICAL: Check if server ACK replaced the optimistic message
                  // Server ACK might have same timestamp but different messageId
                  const messagesWithMatchingTimestamp = messages.filter(m => 
                    Math.abs(m.timestamp - fileMsgInfo.timestamp) < 1000 && // Within 1 second
                    m.senderId === optimisticSenderId
                  );
                  
                  // CRITICAL: If server ACK replaced the message, try to find it by timestamp + senderId
                  if (messagesWithMatchingTimestamp.length > 0 && !messageToUpdate) {
                    // Find the one without fileId (should be the optimistic message that was replaced)
                    // Or the one with matching fileUploadName
                    const replacedMessage = messagesWithMatchingTimestamp.find(m => 
                      ((m as any).fileUploadName === fileUploadName || 
                       (m.fileInfo && m.fileInfo.name === fileUploadName)) &&
                      (!m.fileInfo || !m.fileInfo.fileId) // Must not have fileId (uploading state)
                    ) || messagesWithMatchingTimestamp.find(m => 
                      !m.fileInfo || !m.fileInfo.fileId // Fallback: any without fileId
                    );
                    
                    if (replacedMessage) {
                      messageToUpdate = replacedMessage;
                      console.log('[ChatWindow] ✅ Found message replaced by server ACK (timestamp match):', {
                        messageId: messageToUpdate.messageId,
                        originalMessageId: fileMsgInfo.messageId,
                        timestamp: messageToUpdate.timestamp,
                        hasFileInfo: !!messageToUpdate.fileInfo,
                        fileId: messageToUpdate.fileInfo?.fileId,
                        fileUploadName: (messageToUpdate as any).fileUploadName,
                      });
                    }
                  }
                  
                  // CRITICAL: Find the most recent message from the same sender that doesn't have fileId yet
                  // This handles the case where server ACK replaced the optimistic message but hasn't set fileId
                  // We don't rely on timestamp matching because server timestamps can differ significantly
                  // CRITICAL: Also check if fileUploadName matches (more reliable than timestamp)
                  const recentMessagesFromSender = messages
                    .filter(m => {
                      // Must be from same sender
                      if (m.senderId !== optimisticSenderId) return false;
                      // Must have fileInfo but no fileId (uploading state)
                      if (!m.fileInfo || m.fileInfo.fileId) return false;
                      // CRITICAL: Check if fileUploadName matches (most reliable)
                      const matchesFileUploadName = (m as any).fileUploadName === fileUploadName ||
                                                    (m.fileInfo && m.fileInfo.name === fileUploadName);
                      // Must be recent (within last 60 seconds to handle server timestamp differences)
                      const timeDiff = Math.abs(m.timestamp - fileMsgInfo.timestamp);
                      const isRecent = timeDiff < 60000; // 60 seconds tolerance
                      // Prioritize messages that match fileUploadName OR are recent
                      return matchesFileUploadName || isRecent;
                    })
                    .sort((a, b) => {
                      // Sort by: 1) fileUploadName match, 2) timestamp (most recent first)
                      const aMatchesName = (a as any).fileUploadName === fileUploadName ||
                                          (a.fileInfo && a.fileInfo.name === fileUploadName);
                      const bMatchesName = (b as any).fileUploadName === fileUploadName ||
                                          (b.fileInfo && b.fileInfo.name === fileUploadName);
                      if (aMatchesName && !bMatchesName) return -1;
                      if (!aMatchesName && bMatchesName) return 1;
                      return b.timestamp - a.timestamp; // Most recent first
                    });
                  
                  if (recentMessagesFromSender.length > 0) {
                    messageToUpdate = recentMessagesFromSender[0];
                    console.log('[ChatWindow] ✅ Found message by sender + no fileId (most recent):', {
                      messageId: messageToUpdate.messageId,
                      storedMessageId: fileMsgInfo.messageId,
                      timestamp: messageToUpdate.timestamp,
                      storedTimestamp: fileMsgInfo.timestamp,
                      timeDiff: Math.abs(messageToUpdate.timestamp - fileMsgInfo.timestamp),
                      senderId: messageToUpdate.senderId,
                      optimisticSenderId,
                      hasFileInfo: !!messageToUpdate.fileInfo,
                      fileId: messageToUpdate.fileInfo?.fileId,
                      fileName: messageToUpdate.fileInfo?.name,
                      isUploading: messageToUpdate.fileInfo?.isUploading,
                    });
                  } else {
                    // Fallback: Find ANY recent message from same sender without fileId (even if timestamp doesn't match)
                    console.log('[ChatWindow] 🔍 No messages found with timestamp match, trying most recent from sender without fileId');
                    const mostRecentFromSender = messages
                      .filter(m => {
                        if (m.senderId !== optimisticSenderId) return false;
                        if (!m.fileInfo || m.fileInfo.fileId) return false;
                        return true;
                      })
                      .sort((a, b) => b.timestamp - a.timestamp);
                    
                    if (mostRecentFromSender.length > 0) {
                      messageToUpdate = mostRecentFromSender[0];
                      console.log('[ChatWindow] ✅ Found most recent message from sender without fileId (fallback):', {
                        messageId: messageToUpdate.messageId,
                        storedMessageId: fileMsgInfo.messageId,
                        timestamp: messageToUpdate.timestamp,
                        storedTimestamp: fileMsgInfo.timestamp,
                        timeDiff: Math.abs(messageToUpdate.timestamp - fileMsgInfo.timestamp),
                        senderId: messageToUpdate.senderId,
                        optimisticSenderId,
                        hasFileInfo: !!messageToUpdate.fileInfo,
                        fileId: messageToUpdate.fileInfo?.fileId,
                        fileName: messageToUpdate.fileInfo?.name,
                        isUploading: messageToUpdate.fileInfo?.isUploading,
                      });
                    } else {
                      console.warn('[ChatWindow] ⚠️ No messages found from sender without fileId:', {
                        storedTimestamp: fileMsgInfo.timestamp,
                        optimisticSenderId,
                        allMessagesFromSender: messages
                          .filter(m => m.senderId === optimisticSenderId)
                          .slice(-5)
                          .map(m => ({
                            messageId: m.messageId,
                            timestamp: m.timestamp,
                            hasFileInfo: !!m.fileInfo,
                            fileId: m.fileInfo?.fileId,
                            sequenceNumber: m.sequenceNumber,
                          })),
                      });
                    }
                  }
                }
              }
              
              // Fallback: Try to find by fileUploadName on message object (if map lookup failed)
              // CRITICAL: Prioritize messages WITHOUT fileId (uploading state) - these are the ones we want to update
              if (!messageToUpdate) {
                console.log('[ChatWindow] 🔍 Message not found in fileIdToChatMessageMap, trying fileUploadName on message object');
                // CRITICAL: First, try to find messages with fileUploadName that DON'T have fileId yet (uploading state)
                // These are the messages that are currently showing the upload UI
                // CRITICAL: Also check if messageId matches optimisticMessageId (most reliable)
                const messagesWithoutFileId = messages.filter(m => {
                  // Must match fileUploadName
                  const matchesName = (m as any).fileUploadName === fileUploadName || 
                                     (m.fileInfo && m.fileInfo.name === fileUploadName);
                  // Must NOT have fileId (uploading state)
                  const hasNoFileId = !m.fileInfo || !m.fileInfo.fileId;
                  // Must be from same sender
                  const isFromSameSender = !optimisticSenderId || m.senderId === optimisticSenderId;
                  // CRITICAL: Also check if messageId matches (most reliable)
                  const matchesMessageId = optimisticMessageId && m.messageId === optimisticMessageId;
                  // Prioritize messages that match messageId OR match fileUploadName without fileId
                  return (matchesMessageId || (matchesName && hasNoFileId)) && isFromSameSender;
                });
                
                if (messagesWithoutFileId.length > 0) {
                  // Sort by timestamp descending to get most recent (should be the current uploading message)
                  messagesWithoutFileId.sort((a, b) => b.timestamp - a.timestamp);
                  messageToUpdate = messagesWithoutFileId[0];
                  console.log('[ChatWindow] ✅ Found message by fileUploadName WITHOUT fileId (uploading state):', {
                    messageId: messageToUpdate.messageId,
                    fileUploadName: (messageToUpdate as any).fileUploadName,
                    hasFileId: !!messageToUpdate.fileInfo?.fileId,
                    timestamp: messageToUpdate.timestamp,
                    senderId: messageToUpdate.senderId,
                    optimisticSenderId,
                  });
                } else {
                  console.log('[ChatWindow] ⚠️ No messages found with fileUploadName WITHOUT fileId, checking if any exist with fileId');
                  // Fallback: find ANY message with matching fileUploadName (even if it has fileId)
                  // But only if it matches the serverFileId (same conversion)
                  const messagesWithFileId = messages.filter(m => {
                    const matchesName = (m as any).fileUploadName === fileUploadName ||
                                       (m.fileInfo && m.fileInfo.name === fileUploadName);
                    return matchesName;
                  });
                  
                  if (messagesWithFileId.length > 0) {
                    // Check if any have the same fileId (already updated)
                    const alreadyUpdated = messagesWithFileId.find(m => m.fileInfo?.fileId === serverFileId);
                    if (alreadyUpdated) {
                      console.log('[ChatWindow] ℹ️ Message already updated with this fileId, skipping:', {
                        messageId: alreadyUpdated.messageId,
                        fileId: alreadyUpdated.fileInfo?.fileId,
                      });
                      // Don't update - already done
                    } else {
                      console.warn('[ChatWindow] ⚠️ Found message by fileUploadName but it has DIFFERENT fileId (wrong message):', {
                        messages: messagesWithFileId.map(m => ({
                          messageId: m.messageId,
                          fileId: m.fileInfo?.fileId,
                          timestamp: m.timestamp,
                        })),
                        expectedFileId: serverFileId,
                      });
                      // Don't update wrong message
                    }
                  }
                }
              }
              
              // Fallback: Try to find by storedMessageId (original optimistic message ID)
              // CRITICAL: This should be tried BEFORE fileUploadName lookup, as it's more reliable
              if (!messageToUpdate && storedMessageId) {
                console.log('[ChatWindow] 🔍 Message not found by optimisticMessageId, trying storedMessageId:', {
                  fileUploadName,
                  storedMessageId,
                  optimisticMessageId,
                  totalMessages: messages.length,
                });
                const foundByStoredId = messages.find(m => m.messageId === storedMessageId);
                if (foundByStoredId) {
                  // CRITICAL: Always use if messageId matches (it's the correct message)
                  // Even if it has a different fileId, we should update it (might be from previous update attempt)
                  messageToUpdate = foundByStoredId;
                  console.log('[ChatWindow] ✅ Found message by storedMessageId:', {
                    messageId: messageToUpdate.messageId,
                    hasFileInfo: !!messageToUpdate.fileInfo,
                    fileId: messageToUpdate.fileInfo?.fileId,
                    expectedFileId: serverFileId,
                  });
                  // CRITICAL: If it has a different fileId, log warning but still update
                  if (messageToUpdate.fileInfo?.fileId && messageToUpdate.fileInfo.fileId !== serverFileId) {
                    console.warn('[ChatWindow] ⚠️ Found message by storedMessageId but it has DIFFERENT fileId! Updating anyway (correct messageId):', {
                      messageId: messageToUpdate.messageId,
                      existingFileId: messageToUpdate.fileInfo.fileId,
                      expectedFileId: serverFileId,
                    });
                    // Don't reset - this is the correct message, update it with new fileId
                  }
                }
              }
              
              // CRITICAL: Last resort - find ANY message from same sender with fileInfo but no fileId
              // This handles edge cases where all other lookups fail
              if (!messageToUpdate && optimisticSenderId) {
                console.log('[ChatWindow] 🔍 Last resort: Finding ANY message from sender with fileInfo but no fileId');
                const anyMessageFromSender = messages
                  .filter(m => {
                    if (m.senderId !== optimisticSenderId) return false;
                    if (!m.fileInfo) return false;
                    if (m.fileInfo.fileId) return false; // Must not have fileId
                    return true;
                  })
                  .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
                
                if (anyMessageFromSender.length > 0) {
                  messageToUpdate = anyMessageFromSender[0];
                  console.log('[ChatWindow] ✅ Found message by last resort (any from sender without fileId):', {
                    messageId: messageToUpdate.messageId,
                    timestamp: messageToUpdate.timestamp,
                    senderId: messageToUpdate.senderId,
                    fileName: messageToUpdate.fileInfo?.name,
                  });
                } else {
                  // CRITICAL: Ultimate fallback - find the most recent message from sender (even without fileInfo)
                  // This handles the case where server ACK replaced optimistic message but doesn't have fileInfo yet
                  console.log('[ChatWindow] 🔍 Ultimate fallback: Finding most recent message from sender (even without fileInfo)');
                  const mostRecentFromSender = messages
                    .filter(m => m.senderId === optimisticSenderId)
                    .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
                  
                  if (mostRecentFromSender.length > 0) {
                    messageToUpdate = mostRecentFromSender[0];
                    console.log('[ChatWindow] ✅ Found message by ultimate fallback (most recent from sender):', {
                      messageId: messageToUpdate.messageId,
                      timestamp: messageToUpdate.timestamp,
                      senderId: messageToUpdate.senderId,
                      hasFileInfo: !!messageToUpdate.fileInfo,
                      fileId: messageToUpdate.fileInfo?.fileId,
                      sequenceNumber: messageToUpdate.sequenceNumber,
                    });
                    
                    // CRITICAL: If message doesn't have fileInfo, create it from the optimistic message's fileInfo
                    if (!messageToUpdate.fileInfo) {
                      console.log('[ChatWindow] ⚠️ Message has no fileInfo, creating from optimistic message');
                      // We'll create fileInfo in updatedFileInfo below
                    }
                  }
                }
              }
              
              // CRITICAL: If still not found, try to find the MOST RECENT message from sender WITHOUT fileId
              // This handles the case where server ACK replaced optimistic message but fileUploadName doesn't match
              if (!messageToUpdate && optimisticSenderId) {
                console.log('[ChatWindow] 🔍 Still not found, trying most recent message from sender WITHOUT fileId');
                const mostRecentWithoutFileId = messages
                  .filter(m => {
                    if (m.senderId !== optimisticSenderId) return false;
                    if (!m.fileInfo) return false;
                    if (m.fileInfo.fileId) return false; // Must NOT have fileId
                    // Must be recent (within last 60 seconds)
                    const timeDiff = Math.abs(m.timestamp - fileMsgInfo.timestamp);
                    return timeDiff < 60000;
                  })
                  .sort((a, b) => b.timestamp - a.timestamp);
                
                if (mostRecentWithoutFileId.length > 0) {
                  messageToUpdate = mostRecentWithoutFileId[0];
                  console.log('[ChatWindow] ✅ Found most recent message from sender WITHOUT fileId:', {
                    messageId: messageToUpdate.messageId,
                    timestamp: messageToUpdate.timestamp,
                    senderId: messageToUpdate.senderId,
                    hasFileInfo: !!messageToUpdate.fileInfo,
                    fileId: messageToUpdate.fileInfo?.fileId,
                    fileUploadName: (messageToUpdate as any).fileUploadName,
                    fileName: messageToUpdate.fileInfo?.name,
                  });
                }
              }
              
              // CRITICAL: Only delete from map AFTER successfully finding the message (matches AngularJS line 71)
              // Don't delete if we haven't found it yet - we might need it for retries
              if (messageToUpdate && fileMsgInfo) {
                delete fileIdToChatMessageMap[fileUploadName];
                console.log('[ChatWindow] ✅ Removed message reference from fileIdToChatMessageMap after successful lookup:', fileUploadName);
              }
              
              if (messageToUpdate) {
                console.log('[ChatWindow] ✅ Found message to update:', {
                  messageId: messageToUpdate.messageId,
                  fileUploadName: (messageToUpdate as any).fileUploadName,
                  currentFileId: messageToUpdate.fileInfo?.fileId,
                  hasFileInfo: !!messageToUpdate.fileInfo,
                  currentFileInfo: messageToUpdate.fileInfo ? JSON.parse(JSON.stringify(messageToUpdate.fileInfo)) : null, // Deep clone for logging
                });
                
                // CRITICAL: If message doesn't have fileInfo, we need to create it
                // This handles the case where server ACK replaced optimistic message but doesn't have fileInfo
                if (!messageToUpdate.fileInfo) {
                  console.warn('[ChatWindow] ⚠️ Message found but has no fileInfo! Will create fileInfo from scratch:', {
                    messageId: messageToUpdate.messageId,
                    hasFileInfo: false,
                    fileInfo: undefined,
                  });
                  // We'll create fileInfo below in updatedFileInfo
                }
                
                // CRITICAL: If message already has a DIFFERENT fileId, skip update (wrong message)
                // This happens when server ACK replaces optimistic message and lookup finds old message
                // CRITICAL: Only check fileId if fileInfo exists
                if (messageToUpdate.fileInfo?.fileId && messageToUpdate.fileInfo.fileId !== serverFileId) {
                  console.warn('[ChatWindow] ⚠️ Message already has DIFFERENT fileId! Skipping update (wrong message):', {
                    messageId: messageToUpdate.messageId,
                    existingFileId: messageToUpdate.fileInfo.fileId,
                    newFileId: serverFileId,
                    optimisticMessageId,
                    storedMessageId,
                  });
                  // Don't update - this is the wrong message, try to find the correct one
                  // CRITICAL: Find the MOST RECENT message from sender WITHOUT fileId (should be the current uploading one)
                  console.log('[ChatWindow] 🔍 Trying to find correct message: most recent from sender WITHOUT fileId');
                  const correctMessage = messages
                    .filter(m => {
                      if (m.senderId !== optimisticSenderId) return false;
                      if (!m.fileInfo) return false;
                      if (m.fileInfo.fileId) return false; // Must NOT have fileId
                      return true;
                    })
                    .sort((a, b) => b.timestamp - a.timestamp)[0];
                  
                  if (correctMessage) {
                    messageToUpdate = correctMessage;
                    console.log('[ChatWindow] ✅ Found correct message (most recent from sender WITHOUT fileId):', {
                      messageId: messageToUpdate.messageId,
                      timestamp: messageToUpdate.timestamp,
                      hasFileId: !!messageToUpdate.fileInfo?.fileId,
                    });
                  } else {
                    console.error('[ChatWindow] ❌ Could not find correct message to update!');
                    messageToUpdate = undefined;
                  }
                } else if (messageToUpdate?.fileInfo?.fileId === serverFileId) {
                  // Message already has the correct fileId - update anyway to ensure all fields are set
                  console.log('[ChatWindow] ℹ️ Message already has the correct fileId, updating to ensure all fields are set');
                }
                
                // CRITICAL: If messageToUpdate is still undefined after all lookup attempts, return early
                if (!messageToUpdate) {
                  console.error('[ChatWindow] ❌ CRITICAL: No message to update after all lookup attempts!', {
                    optimisticMessageId,
                    storedMessageId,
                    fileUploadName,
                    serverFileId,
                    totalMessages: messages.length,
                    messagesFromSender: messages.filter(m => m.senderId === optimisticSenderId).map(m => ({
                      messageId: m.messageId,
                      hasFileInfo: !!m.fileInfo,
                      fileId: m.fileInfo?.fileId,
                      timestamp: m.timestamp,
                      fileUploadName: (m as any).fileUploadName,
                    })),
                  });
                  return; // Don't proceed if message not found
                }
                
                // CRITICAL: Determine the correct fileId to use
                // finalFileInfo might be an object with fileId property, or it might be the fileId itself
                // serverFileId is the file_id from the conversion response
                let actualFileId: string | undefined;
                if (finalFileInfo && typeof finalFileInfo === 'object' && finalFileInfo !== null && 'fileId' in finalFileInfo) {
                  actualFileId = finalFileInfo.fileId;
                } else if (finalFileInfo && typeof finalFileInfo === 'string') {
                  actualFileId = finalFileInfo;
                } else if (serverFileId) {
                  actualFileId = String(serverFileId);
                }
                
                // CRITICAL: If still no fileId, try to extract from finalFileInfo object properties
                if (!actualFileId && finalFileInfo && typeof finalFileInfo === 'object' && finalFileInfo !== null) {
                  actualFileId = (finalFileInfo as any).fileId || (finalFileInfo as any).serverFileId || (finalFileInfo as any).file_id;
                }
                
                console.log('[ChatWindow] 🔍 Determining fileId:', {
                  finalFileInfo: finalFileInfo ? JSON.parse(JSON.stringify(finalFileInfo)) : null,
                  finalFileInfoType: typeof finalFileInfo,
                  finalFileInfoFileId: (finalFileInfo as any)?.fileId,
                  serverFileId,
                  actualFileId,
                });
                
                if (!actualFileId) {
                  console.error('[ChatWindow] ❌ CRITICAL: No fileId available! Cannot update message:', {
                    finalFileInfo,
                    serverFileId,
                    messageId: messageToUpdate.messageId,
                  });
                  return; // Don't update if we don't have a fileId
                }
                
                // NOW set fileId since conversion is complete (matches AngularJS line 80: msg.fileInfo.fileId = uploadFileVO.serverFileId)
                // CRITICAL: If message doesn't have fileInfo, create it from finalFileInfo
                // This handles the case where server ACK replaced optimistic message but doesn't have fileInfo
                // CRITICAL: Ensure all required fields are set, especially originalName for GIF rendering
                // CRITICAL: Safely access finalFileInfo properties (it might be undefined)
                const safeFinalFileInfo = (finalFileInfo && typeof finalFileInfo === 'object' && finalFileInfo !== null) ? finalFileInfo : {};
                
                // CRITICAL: Safely access messageToUpdate.fileInfo - it might be undefined
                const existingFileInfo = messageToUpdate.fileInfo || {};
                
                const updatedFileInfo: ChatMessage['fileInfo'] = {
                  ...existingFileInfo, // Use existing fileInfo if available (might be empty object)
                  ...safeFinalFileInfo, // Merge finalFileInfo safely
                  fileId: actualFileId, // Set fileId now that conversion is done
                  isUploading: false, // Conversion complete (matches AngularJS line 76: msg.fileInfo.isUploading = false)
                  // Ensure required fields are set (matches AngularJS lines 78-93)
                  name: existingFileInfo.name || (safeFinalFileInfo as any).name || gifData.name || 'giphy.gif',
                  type: existingFileInfo.type || (safeFinalFileInfo as any).type || 'gif',
                  size: existingFileInfo.size || (safeFinalFileInfo as any).size || gifData.size || 0,
                  // CRITICAL: Set originalName for GIF rendering (matches AngularJS line 84: msg.fileInfo.originalName = uploadFileVO.originalName)
                  originalName: (safeFinalFileInfo as any).originalName || (safeFinalFileInfo as any).original_name || existingFileInfo.originalName || existingFileInfo.original_name,
                  original_name: (safeFinalFileInfo as any).originalName || (safeFinalFileInfo as any).original_name || existingFileInfo.originalName || existingFileInfo.original_name,
                  // CRITICAL: Set thumbnailName for fallback rendering
                  thumbnailName: (safeFinalFileInfo as any).thumbnailName || (safeFinalFileInfo as any).thumbnail_name || existingFileInfo.thumbnailName || existingFileInfo.thumbnail_name,
                  thumbnail_name: (safeFinalFileInfo as any).thumbnailName || (safeFinalFileInfo as any).thumbnail_name || existingFileInfo.thumbnailName || existingFileInfo.thumbnail_name,
                  // Set dimensions for proper rendering
                  width: (safeFinalFileInfo as any).width || existingFileInfo.width,
                  height: (safeFinalFileInfo as any).height || existingFileInfo.height,
                  // Set format
                  fileFormat: (safeFinalFileInfo as any).fileFormat || (safeFinalFileInfo as any).format || existingFileInfo.fileFormat || existingFileInfo.format || 'GIF',
                  format: (safeFinalFileInfo as any).fileFormat || (safeFinalFileInfo as any).format || existingFileInfo.fileFormat || existingFileInfo.format || 'GIF',
                  // Set storage version
                  storage_version: (safeFinalFileInfo as any).storage_version || existingFileInfo.storage_version || 1,
                };
                
                // CRITICAL: If originalName is still missing, construct it from fileId (matches AngularJS behavior)
                // AngularJS constructs originalName as: fileId + '.gif' when original_name is not provided
                if (!updatedFileInfo.originalName && !updatedFileInfo.original_name && updatedFileInfo.fileId) {
                  const constructedOriginalName = `${updatedFileInfo.fileId}.gif`;
                  updatedFileInfo.originalName = constructedOriginalName;
                  updatedFileInfo.original_name = constructedOriginalName;
                  console.log('[ChatWindow] ⚠️ originalName missing, constructing from fileId:', {
                    fileId: updatedFileInfo.fileId,
                    constructedOriginalName,
                  });
                }
                
                console.log('[ChatWindow] 📝 About to update message with fileId:', {
                  messageId: messageToUpdate.messageId,
                  chatId: chat.chatId,
                  oldFileId: messageToUpdate.fileInfo?.fileId,
                  newFileId: updatedFileInfo.fileId,
                  actualFileId,
                  originalName: updatedFileInfo.originalName,
                  original_name: updatedFileInfo.original_name,
                  updatedFileInfo: updatedFileInfo ? JSON.parse(JSON.stringify(updatedFileInfo)) : null, // Deep clone for logging
                });
                
                // CRITICAL: Update message in store FIRST (matches AngularJS line 80: msg.fileInfo.fileId = uploadFileVO.serverFileId)
                // This ensures the upload UI hides immediately when fileId is set
                // Use actual messageId from found message (not storedMessageId which might be stale)
                console.log('[ChatWindow] 📝 Calling updateMessage:', {
                  chatId: chat.chatId,
                  messageId: messageToUpdate.messageId,
                  updatedFileInfo: updatedFileInfo,
                  updatedFileId: updatedFileInfo.fileId,
                  updatedFileIdType: typeof updatedFileInfo.fileId,
                  hasUpdatedFileInfo: !!updatedFileInfo,
                });
                
                try {
                  // CRITICAL: Pass fileUploadName in updates so reducer can use it for fallback lookup
                  // This handles the case where server ACK replaced optimistic message with different messageId
                  // CRITICAL: Always set fileUploadName to ensure fallback lookup works
                  const fileUploadNameForUpdate = (messageToUpdate as any).fileUploadName || 
                                                  gifData.name || 
                                                  gifData.fileUploadName || 
                                                  'giphy.gif';
                  
                  const updates: any = { 
                    fileInfo: updatedFileInfo,
                    fileUploadName: fileUploadNameForUpdate, // CRITICAL: Always set fileUploadName for fallback lookup
                  };
                  
                  console.log('[ChatWindow] 📝 updateMessage updates:', {
                    fileUploadName: fileUploadNameForUpdate,
                    fileInfo: updatedFileInfo,
                    fileId: updatedFileInfo.fileId,
                  });
                  
                  messagesContext.updateMessage(chat.chatId, messageToUpdate.messageId, updates);
                  console.log('[ChatWindow] ✅ updateMessage called successfully');
                } catch (error) {
                  console.error('[ChatWindow] ❌ Error calling updateMessage:', error);
                  throw error; // Re-throw to be caught by outer try-catch
                }
                
                console.log('[ChatWindow] ✅ Message updated in store with fileId, upload UI should hide now');
                
                // CRITICAL: Wait a bit to ensure the update is processed before re-sending
                // This prevents race condition where server ACK arrives before update completes
                // CRITICAL: Use requestAnimationFrame to ensure React has processed the state update
                await new Promise(resolve => {
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      setTimeout(resolve, 50); // Additional delay for state update
                    });
                  });
                });
                
                // Verify the update succeeded before re-sending
                // CRITICAL: Server ACK might have replaced the message with different messageId, so check by fileId/fileUploadName too
                const verifyMessages = messagesContext.getMessages(chat.chatId);
                
                // Try to find by messageId first
                let verifyMessage = verifyMessages.find(m => m.messageId === messageToUpdate.messageId);
                
                // CRITICAL: If not found by messageId, try to find by fileId (server ACK might have different messageId)
                if (!verifyMessage && actualFileId) {
                  verifyMessage = verifyMessages.find(m => m.fileInfo?.fileId === actualFileId);
                  console.log('[ChatWindow] 🔍 Message not found by messageId, trying fileId:', {
                    originalMessageId: messageToUpdate.messageId,
                    fileId: actualFileId,
                    found: !!verifyMessage,
                    foundMessageId: verifyMessage?.messageId,
                  });
                }
                
                // CRITICAL: If still not found, try by fileUploadName (last resort)
                if (!verifyMessage && fileUploadName) {
                  verifyMessage = verifyMessages.find(m => 
                    (m as any).fileUploadName === fileUploadName ||
                    (m.fileInfo && m.fileInfo.name === fileUploadName)
                  );
                  console.log('[ChatWindow] 🔍 Message not found by fileId, trying fileUploadName:', {
                    originalMessageId: messageToUpdate.messageId,
                    fileUploadName,
                    found: !!verifyMessage,
                    foundMessageId: verifyMessage?.messageId,
                  });
                }
                
                console.log('[ChatWindow] 🔍 Update verification check:', {
                  originalMessageId: messageToUpdate.messageId,
                  found: !!verifyMessage,
                  foundMessageId: verifyMessage?.messageId,
                  hasFileInfo: !!verifyMessage?.fileInfo,
                  fileId: verifyMessage?.fileInfo?.fileId,
                  fileIdType: typeof verifyMessage?.fileInfo?.fileId,
                  updatedFileId: updatedFileInfo.fileId,
                  updatedFileIdType: typeof updatedFileInfo.fileId,
                  expectedFileId: actualFileId,
                  allMessageIds: verifyMessages.map(m => m.messageId),
                  messagesWithFileId: verifyMessages.filter(m => m.fileInfo?.fileId).map(m => ({
                    messageId: m.messageId,
                    fileId: m.fileInfo?.fileId,
                    fileUploadName: (m as any).fileUploadName,
                  })),
                });
                
                if (!verifyMessage) {
                  console.error('[ChatWindow] ❌ Update verification failed: Message not found by any method!', {
                    originalMessageId: messageToUpdate.messageId,
                    fileId: actualFileId,
                    fileUploadName,
                    allMessageIds: verifyMessages.map(m => m.messageId),
                    allMessages: verifyMessages.map(m => ({
                      messageId: m.messageId,
                      hasFileInfo: !!m.fileInfo,
                      fileId: m.fileInfo?.fileId,
                      fileUploadName: (m as any).fileUploadName,
                      sequenceNumber: m.sequenceNumber,
                    })),
                  });
                  // CRITICAL: Try to update again with fileUploadName as fallback
                  // This handles the case where the message wasn't found but might exist with different messageId
                  if (fileUploadName) {
                    console.log('[ChatWindow] 🔧 Retrying updateMessage with fileUploadName fallback');
                    try {
                      messagesContext.updateMessage(chat.chatId, messageToUpdate.messageId, {
                        fileInfo: updatedFileInfo,
                        fileUploadName: fileUploadName,
                      });
                    } catch (error) {
                      console.error('[ChatWindow] ❌ Error in retry updateMessage:', error);
                    }
                  }
                  // Don't return - still try to re-send, the update might work
                } else if (!verifyMessage.fileInfo?.fileId) {
                  console.error('[ChatWindow] ❌ Update verification failed: Message found but fileId is missing!', {
                    foundMessageId: verifyMessage.messageId,
                    originalMessageId: messageToUpdate.messageId,
                    hasFileInfo: !!verifyMessage.fileInfo,
                    fileInfo: verifyMessage.fileInfo,
                    updatedFileInfo: updatedFileInfo,
                    expectedFileId: actualFileId,
                  });
                  
                  // CRITICAL: If message was found but doesn't have fileId, try to update it again
                  // This handles the case where updateMessage was called but the update didn't apply
                  console.log('[ChatWindow] 🔧 Retrying updateMessage on found message:', {
                    foundMessageId: verifyMessage.messageId,
                    updatedFileInfo: updatedFileInfo,
                  });
                  try {
                    messagesContext.updateMessage(chat.chatId, verifyMessage.messageId, {
                      fileInfo: updatedFileInfo,
                      fileUploadName: fileUploadName,
                    });
                    console.log('[ChatWindow] ✅ Retry updateMessage called');
                  } catch (error) {
                    console.error('[ChatWindow] ❌ Error in retry updateMessage:', error);
                  }
                  
                  // CRITICAL: Still re-send - the update might have failed but we should still try
                  // The server ACK preservation logic should handle this
                } else {
                  console.log('[ChatWindow] ✅ Update verified successfully, fileId is set:', {
                    foundMessageId: verifyMessage.messageId,
                    originalMessageId: messageToUpdate.messageId,
                    fileId: verifyMessage?.fileInfo?.fileId,
                  });
                }
                
                console.log('[ChatWindow] ✅ Update verified, re-sending message with fileId:', {
                  messageId: messageToUpdate.messageId,
                  fileId: verifyMessage?.fileInfo?.fileId || updatedFileInfo.fileId, // Use updatedFileInfo.fileId as fallback
                  updatedFileId: updatedFileInfo.fileId,
                });
                
                // Re-send message with updated fileInfo (matches AngularJS messagesLoader.reSendMessageInChat line 112)
                // CRITICAL: This uses the SAME messageId, so server ACK will update existing message, not create duplicate
                xmppChatService.sendMessage(
                  '',
                  chat.chatId,
                  recipientJid,
                  recipientDisplayName,
                  () => {
                    console.log('[ChatWindow] GIF message re-sent with updated fileInfo');
                  },
                  (error) => {
                    console.error('[ChatWindow] Failed to re-send GIF message:', error);
                  },
                  updatedFileInfo,
                  messageToUpdate.messageId // CRITICAL: Pass existing messageId to prevent duplicate
                );
                
                // CRITICAL: Verify update succeeded by reading message back from store
                // Use multiple timeouts to check at different intervals (server ACK might arrive later)
                setTimeout(() => {
                  const updatedMessages = messagesContext.getMessages(chat.chatId);
                  const updatedMessage = updatedMessages.find(m => m.messageId === messageToUpdate.messageId);
                  console.log('[ChatWindow] 🔍 Verification (100ms) - Message after update:', {
                    messageId: messageToUpdate.messageId,
                    found: !!updatedMessage,
                    fileId: updatedMessage?.fileInfo?.fileId,
                    fileIdType: typeof updatedMessage?.fileInfo?.fileId,
                    hasFileInfo: !!updatedMessage?.fileInfo,
                    fileInfo: updatedMessage?.fileInfo ? JSON.parse(JSON.stringify(updatedMessage.fileInfo)) : null,
                    allMessageIds: updatedMessages.map(m => m.messageId),
                    messagesWithFileId: updatedMessages.filter(m => m.fileInfo?.fileId).map(m => ({
                      messageId: m.messageId,
                      fileId: m.fileInfo?.fileId,
                    })),
                  });

                  if (!updatedMessage || !updatedMessage.fileInfo?.fileId) {
                    console.error('[ChatWindow] ❌ UPDATE FAILED (100ms): Message still has no fileId after update!', {
                      messageId: messageToUpdate.messageId,
                      found: !!updatedMessage,
                      hasFileInfo: !!updatedMessage?.fileInfo,
                      fileId: updatedMessage?.fileInfo?.fileId,
                    });
                  } else {
                    console.log('[ChatWindow] ✅ UPDATE SUCCESS (100ms): Message now has fileId, upload UI should hide and GIF should show');
                  }
                }, 100);
                
                // Also check after 500ms in case server ACK arrives and replaces the message
                // CRITICAL: Server ACK might have different messageId, so check by fileId or fileUploadName
                setTimeout(() => {
                  const updatedMessages = messagesContext.getMessages(chat.chatId);
                  
                  // CRITICAL: Try to find message by original messageId first
                  let updatedMessage = updatedMessages.find(m => m.messageId === messageToUpdate.messageId);
                  
                  // CRITICAL: If not found by messageId, try to find by fileId (server ACK might have different messageId)
                  if (!updatedMessage && actualFileId) {
                    updatedMessage = updatedMessages.find(m => 
                      m.fileInfo?.fileId === actualFileId
                    );
                    console.log('[ChatWindow] 🔍 Message not found by messageId, trying fileId:', {
                      originalMessageId: messageToUpdate.messageId,
                      fileId: actualFileId,
                      found: !!updatedMessage,
                      foundMessageId: updatedMessage?.messageId,
                    });
                  }
                  
                  // CRITICAL: If still not found, try to find by fileUploadName (last resort)
                  if (!updatedMessage && fileUploadName) {
                    updatedMessage = updatedMessages.find(m => 
                      (m as any).fileUploadName === fileUploadName ||
                      (m.fileInfo && m.fileInfo.name === fileUploadName)
                    );
                    console.log('[ChatWindow] 🔍 Message not found by fileId, trying fileUploadName:', {
                      originalMessageId: messageToUpdate.messageId,
                      fileUploadName,
                      found: !!updatedMessage,
                      foundMessageId: updatedMessage?.messageId,
                    });
                  }
                  
                  console.log('[ChatWindow] 🔍 Verification (500ms) - Message after update (after potential server ACK):', {
                    originalMessageId: messageToUpdate.messageId,
                    found: !!updatedMessage,
                    foundMessageId: updatedMessage?.messageId,
                    fileId: updatedMessage?.fileInfo?.fileId,
                    fileIdType: typeof updatedMessage?.fileInfo?.fileId,
                    hasFileInfo: !!updatedMessage?.fileInfo,
                    fileInfo: updatedMessage?.fileInfo ? JSON.parse(JSON.stringify(updatedMessage.fileInfo)) : null,
                    expectedFileId: actualFileId,
                    allMessagesWithFileId: updatedMessages.filter(m => m.fileInfo?.fileId).map(m => ({
                      messageId: m.messageId,
                      fileId: m.fileInfo?.fileId,
                      fileUploadName: (m as any).fileUploadName,
                    })),
                  });

                  if (!updatedMessage || !updatedMessage.fileInfo?.fileId) {
                    console.error('[ChatWindow] ❌ UPDATE FAILED (500ms): Message still has no fileId after update and server ACK!', {
                      originalMessageId: messageToUpdate.messageId,
                      found: !!updatedMessage,
                      foundMessageId: updatedMessage?.messageId,
                      hasFileInfo: !!updatedMessage?.fileInfo,
                      fileId: updatedMessage?.fileInfo?.fileId,
                      expectedFileId: actualFileId,
                      // Check if there's a message with the same fileId but different messageId (server ACK replaced it)
                      messagesWithSameFileId: updatedMessages.filter(m => 
                        m.fileInfo && m.fileInfo.fileId === actualFileId
                      ).map(m => ({
                        messageId: m.messageId,
                        fileId: m.fileInfo?.fileId,
                        fileUploadName: (m as any).fileUploadName,
                      })),
                      allMessages: updatedMessages.map(m => ({
                        messageId: m.messageId,
                        hasFileInfo: !!m.fileInfo,
                        fileId: m.fileInfo?.fileId,
                        fileUploadName: (m as any).fileUploadName,
                        sequenceNumber: m.sequenceNumber,
                      })),
                    });
                    
                    // CRITICAL: If message was found but doesn't have fileId, try to update it again
                    // This handles the case where server ACK replaced the message but didn't preserve fileInfo
                    if (updatedMessage && !updatedMessage.fileInfo?.fileId && actualFileId) {
                      console.log('[ChatWindow] 🔧 Attempting to update message again with fileId:', {
                        messageId: updatedMessage.messageId,
                        fileId: actualFileId,
                        updatedFileInfo: updatedFileInfo,
                      });
                      try {
                        messagesContext.updateMessage(chat.chatId, updatedMessage.messageId, {
                          fileInfo: updatedFileInfo,
                          fileUploadName: fileUploadName,
                        });
                        console.log('[ChatWindow] ✅ Retry updateMessage called');
                      } catch (error) {
                        console.error('[ChatWindow] ❌ Error in retry updateMessage:', error);
                      }
                    }
                  } else {
                    console.log('[ChatWindow] ✅ UPDATE SUCCESS (500ms): Message has fileId after server ACK:', {
                      messageId: updatedMessage.messageId,
                      fileId: updatedMessage.fileInfo?.fileId,
                    });
                  }
                }, 500);
                
                console.log('[ChatWindow] ✅ Message update dispatched, file display should show');
              } else {
                // CRITICAL: Log all messages with fileInfo to debug why lookup failed
                const messagesWithFileInfo = messages.filter(m => m.fileInfo);
                console.warn('[ChatWindow] ❌ Could not find message to update:', {
                  storedMessageId,
                  fileUploadName,
                  chatId: chat.chatId,
                  totalMessages: messages.length,
                  messagesWithFileInfoCount: messagesWithFileInfo.length,
                  allMessageIds: messages.map(m => m.messageId),
                  messagesWithFileInfo: messagesWithFileInfo.map(m => ({
                    messageId: m.messageId,
                    fileUploadName: (m as any).fileUploadName,
                    fileId: m.fileInfo?.fileId,
                    fileName: m.fileInfo?.name,
                    hasNoFileId: !m.fileInfo?.fileId,
                    sequenceNumber: m.sequenceNumber,
                    senderId: m.senderId,
                    timestamp: m.timestamp,
                  })),
                  // Check if any message matches fileUploadName (case-insensitive)
                  matchingFileUploadName: messagesWithFileInfo.filter(m => 
                    (m as any).fileUploadName === fileUploadName ||
                    (m.fileInfo && !m.fileInfo.fileId && m.fileInfo.name === fileUploadName)
                  ).map(m => ({
                    messageId: m.messageId,
                    fileUploadName: (m as any).fileUploadName,
                    fileName: m.fileInfo?.name,
                  })),
                });
                
                // CRITICAL: Try to find by checking if any message has fileInfo without fileId and matching name
                const fallbackMessage = messages.find(m => 
                  m.fileInfo && 
                  !m.fileInfo.fileId && 
                  m.fileInfo.name === fileUploadName &&
                  m.senderId === (optimisticMessage as any)?.senderId
                );
                
                if (fallbackMessage) {
                  console.log('[ChatWindow] 🔍 Found fallback message by fileInfo.name and senderId:', {
                    messageId: fallbackMessage.messageId,
                    fileUploadName: (fallbackMessage as any).fileUploadName,
                    fileName: fallbackMessage.fileInfo?.name,
                  });
                  
                  // Update the fallback message
                  // CRITICAL: Ensure all required fields are set, especially originalName for GIF rendering
                  const updatedFileInfo: ChatMessage['fileInfo'] = {
                    ...fallbackMessage.fileInfo,
                    ...(typeof finalFileInfo === 'object' && finalFileInfo !== null ? finalFileInfo : {}),
                    fileId: finalFileInfo?.fileId || String(serverFileId), // CRITICAL: Convert to string
                    isUploading: false,
                    // CRITICAL: Set originalName for GIF rendering
                    originalName: finalFileInfo?.originalName || finalFileInfo?.original_name || `${serverFileId}.gif`,
                    original_name: finalFileInfo?.originalName || finalFileInfo?.original_name || `${serverFileId}.gif`,
                    thumbnailName: finalFileInfo?.thumbnailName || finalFileInfo?.thumbnail_name || fallbackMessage.fileInfo?.thumbnailName || fallbackMessage.fileInfo?.thumbnail_name,
                    thumbnail_name: finalFileInfo?.thumbnailName || finalFileInfo?.thumbnail_name || fallbackMessage.fileInfo?.thumbnailName || fallbackMessage.fileInfo?.thumbnail_name,
                    width: finalFileInfo?.width || fallbackMessage.fileInfo?.width,
                    height: finalFileInfo?.height || fallbackMessage.fileInfo?.height,
                    fileFormat: finalFileInfo?.fileFormat || finalFileInfo?.format || fallbackMessage.fileInfo?.fileFormat || fallbackMessage.fileInfo?.format || 'GIF',
                    format: finalFileInfo?.fileFormat || finalFileInfo?.format || fallbackMessage.fileInfo?.fileFormat || fallbackMessage.fileInfo?.format || 'GIF',
                  };
                  
                  // CRITICAL: Update message FIRST (matches AngularJS line 80)
                  messagesContext.updateMessage(chat.chatId, fallbackMessage.messageId, { fileInfo: updatedFileInfo });
                  console.log('[ChatWindow] ✅ Message updated with fileId (fallback method)');
                  
                  // Then re-send XMPP message
                  xmppChatService.sendMessage(
                    '',
                    chat.chatId,
                    recipientJid,
                    recipientDisplayName,
                    () => {
                      console.log('[ChatWindow] GIF message re-sent with updated fileInfo (fallback)');
                    },
                    (error) => {
                      console.error('[ChatWindow] Failed to re-send GIF message (fallback):', error);
                    },
                    updatedFileInfo,
                    fallbackMessage.messageId // CRITICAL: Pass existing messageId
                  );
                } else {
                  // CRITICAL: Last resort - find ANY message from sender without fileId
                  const messagesWithoutFileId = messages.filter(m => 
                    m.senderId === optimisticMessage?.senderId && 
                    m.fileInfo && 
                    !m.fileInfo.fileId
                  );
                  
                  if (messagesWithoutFileId.length > 0) {
                    const lastResortMessage = messagesWithoutFileId.sort((a, b) => b.timestamp - a.timestamp)[0];
                    console.log('[ChatWindow] 🔧 LAST RESORT: Updating most recent message without fileId:', {
                      messageId: lastResortMessage.messageId,
                      timestamp: lastResortMessage.timestamp,
                      fileName: lastResortMessage.fileInfo?.name,
                    });
                    
                    const lastResortFileInfo: ChatMessage['fileInfo'] = {
                      ...lastResortMessage.fileInfo!,
                      fileId: String(serverFileId), // CRITICAL: Convert to string
                      isUploading: false,
                      originalName: finalFileInfo?.originalName || finalFileInfo?.original_name || `${serverFileId}.gif`,
                      original_name: finalFileInfo?.originalName || finalFileInfo?.original_name || `${serverFileId}.gif`,
                      thumbnailName: finalFileInfo?.thumbnailName || finalFileInfo?.thumbnail_name,
                      thumbnail_name: finalFileInfo?.thumbnailName || finalFileInfo?.thumbnail_name,
                      width: finalFileInfo?.width,
                      height: finalFileInfo?.height,
                      fileFormat: finalFileInfo?.fileFormat || finalFileInfo?.format || 'GIF',
                      format: finalFileInfo?.fileFormat || finalFileInfo?.format || 'GIF',
                    };
                    
                    messagesContext.updateMessage(chat.chatId, lastResortMessage.messageId, { fileInfo: lastResortFileInfo });
                    console.log('[ChatWindow] ✅ LAST RESORT: Message updated with fileId');
                  }
                }
              }
            }
          } else if (conversionResponse.file.status.toLowerCase() === 'success') {
            // Conversion completed immediately - set fileId and update message (matches AngularJS onFileDataChanged)
            // CRITICAL: Add a MINIMUM delay to ensure upload UI renders first (matches AngularJS async behavior)
            // AngularJS shows upload UI because fileId is undefined initially, then updates after conversion
            // We need to ensure React renders the upload UI BEFORE we set fileId
            await new Promise(resolve => {
              // Wait for React to render (multiple frames to be safe)
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    setTimeout(resolve, 300); // Minimum delay to ensure UI renders
                  });
                });
              });
            });
            
            // CRITICAL: Match AngularJS EXACTLY - use fileUploadName as primary lookup (not messageId)
            // AngularJS line 69: fileMsgInfo = fileIdToChatMessageMap[uploadFileVO.fileUploadName];
            if (messagesContext?.updateMessage && messagesContext?.getMessages) {
              const fileUploadName = `${gifData.name || 'giphy.gif'}`;
              const messages = messagesContext.getMessages(chat.chatId);
              
              // CRITICAL: Primary lookup using fileIdToChatMessageMap (matches AngularJS line 69)
              // This map stores the message reference BEFORE server ACK arrives
              let messageToUpdate: ChatMessage | undefined;
              const fileMsgInfo = fileIdToChatMessageMap[fileUploadName];
              
              if (fileMsgInfo) {
                console.log('[ChatWindow] ✅ Found message reference in fileIdToChatMessageMap (immediate success):', {
                  fileUploadName,
                  storedMessageId: fileMsgInfo.messageId,
                  storedChatId: fileMsgInfo.chatId,
                  currentChatId: chat.chatId,
                  storedTimestamp: fileMsgInfo.timestamp,
                });
                
                // Try to find message by stored messageId first (optimistic message)
                messageToUpdate = messages.find(m => m.messageId === fileMsgInfo.messageId);
                
                // If not found by messageId, try to find by timestamp match (server ACK might have changed messageId)
                if (!messageToUpdate) {
                  console.log('[ChatWindow] 🔍 Message not found by stored messageId, trying timestamp match (immediate success)');
                  const optimisticSenderId = optimisticMessage?.senderId;
                  
                  // Find messages with fileInfo that match timestamp and sender
                  const messagesWithFileInfo = messages.filter(m => {
                    if (!m.fileInfo) return false;
                    const timeMatch = Math.abs(m.timestamp - fileMsgInfo.timestamp) < 5000; // Within 5 seconds
                    const senderMatch = !optimisticSenderId || m.senderId === optimisticSenderId;
                    return timeMatch && senderMatch;
                  });
                  
                  // Sort by timestamp descending to get most recent
                  messagesWithFileInfo.sort((a, b) => b.timestamp - a.timestamp);
                  
                  if (messagesWithFileInfo.length > 0) {
                    messageToUpdate = messagesWithFileInfo[0];
                    console.log('[ChatWindow] ✅ Found message by timestamp match (immediate success):', {
                      messageId: messageToUpdate.messageId,
                      storedMessageId: fileMsgInfo.messageId,
                      timestamp: messageToUpdate.timestamp,
                      storedTimestamp: fileMsgInfo.timestamp,
                      timeDiff: Math.abs(messageToUpdate.timestamp - fileMsgInfo.timestamp),
                      senderId: messageToUpdate.senderId,
                      optimisticSenderId,
                    });
                  } else {
                    console.warn('[ChatWindow] ⚠️ No messages found by timestamp match (immediate success):', {
                      storedTimestamp: fileMsgInfo.timestamp,
                      optimisticSenderId,
                      allMessagesWithFileInfo: messages.filter(m => m.fileInfo).map(m => ({
                        messageId: m.messageId,
                        timestamp: m.timestamp,
                        senderId: m.senderId,
                        timeDiff: Math.abs(m.timestamp - fileMsgInfo.timestamp),
                      })),
                    });
                  }
                }
              }
              
              // Fallback: Try to find by fileUploadName on message object (if map lookup failed)
              if (!messageToUpdate) {
                console.log('[ChatWindow] 🔍 Message not found in fileIdToChatMessageMap, trying fileUploadName on message object (immediate success)');
                messageToUpdate = messages.find(m => 
                  (m as any).fileUploadName === fileUploadName ||
                  (m.fileInfo && !m.fileInfo.fileId && m.fileInfo.name === fileUploadName)
                );
              }
              
              // Fallback: Try to find by storedMessageId (original optimistic message ID)
              if (!messageToUpdate && storedMessageId) {
                console.log('[ChatWindow] 🔍 Message not found by fileUploadName, trying storedMessageId (immediate success):', {
                  fileUploadName,
                  storedMessageId,
                  totalMessages: messages.length,
                });
                messageToUpdate = messages.find(m => m.messageId === storedMessageId);
              }
              
              // CRITICAL: Only delete from map AFTER successfully finding the message (matches AngularJS line 71)
              // Don't delete if we haven't found it yet - we might need it for retries
              if (messageToUpdate && fileMsgInfo) {
                delete fileIdToChatMessageMap[fileUploadName];
                console.log('[ChatWindow] ✅ Removed message reference from fileIdToChatMessageMap after successful lookup (immediate success):', fileUploadName);
              }
              
              console.log('[ChatWindow] 🔍 Checking message before update:', {
                fileUploadName,
                storedMessageId,
                found: !!messageToUpdate,
                actualMessageId: messageToUpdate?.messageId,
                currentFileId: messageToUpdate?.fileInfo?.fileId,
                hasFileInfo: !!messageToUpdate?.fileInfo,
                gifUrl: (messageToUpdate as any)?.gifUrl,
              });
              
              if (messageToUpdate) {
                // Verify message still has no fileId (upload UI should be showing)
                if (messageToUpdate.fileInfo?.fileId) {
                  console.log('[ChatWindow] ⚠️ Message already has fileId, skipping update. This should not happen!', {
                    fileId: messageToUpdate.fileInfo.fileId,
                    messageId: messageToUpdate.messageId,
                  });
                  return;
                }
                
                console.log('[ChatWindow] ✅ Message has no fileId, proceeding with update (upload UI should be visible)');
                
                // Set fileId now that conversion is done (matches AngularJS line 80)
                // CRITICAL: Ensure all required fields are set, especially originalName for GIF rendering
                const updatedFileInfo: ChatMessage['fileInfo'] = {
                  ...(messageToUpdate.fileInfo || {}), // Use existing fileInfo if available
                  fileId: conversionResponse.file.file_id, // Set fileId now that conversion is done
                  isUploading: false, // Conversion complete
                  // CRITICAL: Set originalName for GIF rendering (matches AngularJS line 84)
                  originalName: conversionResponse.file.original_name || messageToUpdate.fileInfo?.originalName || messageToUpdate.fileInfo?.original_name,
                  original_name: conversionResponse.file.original_name || messageToUpdate.fileInfo?.originalName || messageToUpdate.fileInfo?.original_name,
                  thumbnailName: conversionResponse.file.thumbnail_name || messageToUpdate.fileInfo?.thumbnailName || messageToUpdate.fileInfo?.thumbnail_name,
                  thumbnail_name: conversionResponse.file.thumbnail_name || messageToUpdate.fileInfo?.thumbnailName || messageToUpdate.fileInfo?.thumbnail_name,
                  width: conversionResponse.file.width || messageToUpdate.fileInfo?.width,
                  height: conversionResponse.file.height || messageToUpdate.fileInfo?.height,
                  available_previews: conversionResponse.file.available_previews || messageToUpdate.fileInfo?.available_previews,
                  preview_name: conversionResponse.file.preview_name || messageToUpdate.fileInfo?.preview_name,
                  no_of_pages: conversionResponse.file.no_of_pages || messageToUpdate.fileInfo?.no_of_pages,
                  fileFormat: conversionResponse.file.file_format || messageToUpdate.fileInfo?.fileFormat || messageToUpdate.fileInfo?.format || 'GIF',
                  format: conversionResponse.file.file_format || messageToUpdate.fileInfo?.fileFormat || messageToUpdate.fileInfo?.format || 'GIF',
                  // Ensure required fields are set
                  name: messageToUpdate.fileInfo?.name || conversionResponse.file.name || gifData.name || 'giphy.gif',
                  type: messageToUpdate.fileInfo?.type || conversionResponse.file.type || 'gif',
                  size: messageToUpdate.fileInfo?.size || conversionResponse.file.size || gifData.size || 0,
                  storage_version: conversionResponse.file.storage_version || messageToUpdate.fileInfo?.storage_version || 1,
                };
                
                // CRITICAL: If originalName is still missing, construct it from fileId (matches AngularJS behavior)
                // AngularJS constructs originalName as: fileId + '.gif' when original_name is not provided
                if (!updatedFileInfo.originalName && !updatedFileInfo.original_name && updatedFileInfo.fileId) {
                  const constructedOriginalName = `${updatedFileInfo.fileId}.gif`;
                  updatedFileInfo.originalName = constructedOriginalName;
                  updatedFileInfo.original_name = constructedOriginalName;
                  console.log('[ChatWindow] ⚠️ originalName missing (immediate success), constructing from fileId:', {
                    fileId: updatedFileInfo.fileId,
                    constructedOriginalName,
                  });
                }
                
                console.log('[ChatWindow] 📝 About to update message (immediate success):', {
                  messageId: messageToUpdate.messageId,
                  chatId: chat.chatId,
                  oldFileId: messageToUpdate.fileInfo?.fileId,
                  newFileId: updatedFileInfo.fileId,
                  originalName: updatedFileInfo.originalName,
                  original_name: updatedFileInfo.original_name,
                  thumbnailName: updatedFileInfo.thumbnailName,
                  updatedFileInfo: updatedFileInfo ? JSON.parse(JSON.stringify(updatedFileInfo)) : null,
                });
                
                // CRITICAL: Update message in store FIRST (matches AngularJS line 80: msg.fileInfo.fileId = uploadFileVO.serverFileId)
                // This ensures the upload UI hides immediately when fileId is set
                messagesContext.updateMessage(chat.chatId, messageToUpdate.messageId, { fileInfo: updatedFileInfo });
                console.log('[ChatWindow] ✅ Message updated in store with fileId, upload UI should hide now (immediate success)');
                
                // Re-send message with updated fileInfo (matches AngularJS messagesLoader.reSendMessageInChat line 112)
                // CRITICAL: This uses the SAME messageId, so server ACK will update existing message, not create duplicate
                xmppChatService.sendMessage(
                  '',
                  chat.chatId,
                  recipientJid,
                  recipientDisplayName,
                  () => {
                    console.log('[ChatWindow] GIF message sent with complete fileInfo (immediate success)');
                  },
                  (error) => {
                    console.error('[ChatWindow] Failed to send GIF message (immediate success):', error);
                  },
                  updatedFileInfo,
                  messageToUpdate.messageId // CRITICAL: Pass existing messageId to prevent duplicate
                );
                
                // CRITICAL: Verify update succeeded by reading message back from store
                setTimeout(() => {
                  const updatedMessages = messagesContext.getMessages(chat.chatId);
                  const updatedMessage = updatedMessages.find(m => m.messageId === messageToUpdate.messageId);
                  console.log('[ChatWindow] 🔍 Verification - Message after update (immediate success):', {
                    messageId: messageToUpdate.messageId,
                    found: !!updatedMessage,
                    fileId: updatedMessage?.fileInfo?.fileId,
                    fileIdType: typeof updatedMessage?.fileInfo?.fileId,
                    originalName: updatedMessage?.fileInfo?.originalName,
                    thumbnailName: updatedMessage?.fileInfo?.thumbnailName,
                    hasFileInfo: !!updatedMessage?.fileInfo,
                    fileInfo: updatedMessage?.fileInfo ? JSON.parse(JSON.stringify(updatedMessage.fileInfo)) : null,
                  });
                  
                  if (!updatedMessage || !updatedMessage.fileInfo?.fileId) {
                    console.error('[ChatWindow] ❌ UPDATE FAILED: Message still has no fileId after update (immediate success)!');
                  } else if (!updatedMessage.fileInfo?.originalName && updatedMessage.fileInfo?.type?.toUpperCase() === 'GIF') {
                    console.error('[ChatWindow] ❌ UPDATE INCOMPLETE: Message has fileId but no originalName for GIF rendering!');
                  } else {
                    console.log('[ChatWindow] ✅ UPDATE SUCCESS: Message now has fileId and originalName, GIF should show (immediate success)');
                  }
                }, 100);
              } else {
                // CRITICAL: Log all messages with fileInfo to debug why lookup failed
                const messagesWithFileInfo = messages.filter(m => m.fileInfo);
                console.warn('[ChatWindow] ❌ Could not find message to update (immediate success):', {
                  fileUploadName,
                  storedMessageId,
                  chatId: chat.chatId,
                  totalMessages: messages.length,
                  messagesWithFileInfoCount: messagesWithFileInfo.length,
                  allMessageIds: messages.map(m => m.messageId),
                  messagesWithFileInfo: messagesWithFileInfo.map(m => ({
                    messageId: m.messageId,
                    fileUploadName: (m as any).fileUploadName,
                    fileId: m.fileInfo?.fileId,
                    fileName: m.fileInfo?.name,
                    hasNoFileId: !m.fileInfo?.fileId,
                    sequenceNumber: m.sequenceNumber,
                    senderId: m.senderId,
                    timestamp: m.timestamp,
                  })),
                  // Check if any message matches fileUploadName (case-insensitive)
                  matchingFileUploadName: messagesWithFileInfo.filter(m => 
                    (m as any).fileUploadName === fileUploadName ||
                    (m.fileInfo && !m.fileInfo.fileId && m.fileInfo.name === fileUploadName)
                  ).map(m => ({
                    messageId: m.messageId,
                    fileUploadName: (m as any).fileUploadName,
                    fileName: m.fileInfo?.name,
                  })),
                });
                
                // CRITICAL: Try to find by checking if any message has fileInfo without fileId and matching name
                const fallbackMessage = messages.find(m => 
                  m.fileInfo && 
                  !m.fileInfo.fileId && 
                  m.fileInfo.name === fileUploadName &&
                  m.senderId === (optimisticMessage as any)?.senderId
                );
                
                if (fallbackMessage) {
                  console.log('[ChatWindow] 🔍 Found fallback message by fileInfo.name and senderId (immediate success):', {
                    messageId: fallbackMessage.messageId,
                    fileUploadName: (fallbackMessage as any).fileUploadName,
                    fileName: fallbackMessage.fileInfo?.name,
                  });
                  
                  // Update the fallback message
                  const updatedFileInfo: ChatMessage['fileInfo'] = {
                    ...fallbackMessage.fileInfo,
                    fileId: conversionResponse.file.file_id,
                    isUploading: false,
                    thumbnailName: conversionResponse.file.thumbnail_name,
                    thumbnail_name: conversionResponse.file.thumbnail_name,
                    originalName: conversionResponse.file.original_name,
                    original_name: conversionResponse.file.original_name,
                    width: conversionResponse.file.width,
                    height: conversionResponse.file.height,
                    available_previews: conversionResponse.file.available_previews,
                    preview_name: conversionResponse.file.preview_name,
                    no_of_pages: conversionResponse.file.no_of_pages,
                    fileFormat: conversionResponse.file.file_format,
                    format: conversionResponse.file.file_format,
                  };
                  
                  xmppChatService.sendMessage(
                    '',
                    chat.chatId,
                    recipientJid,
                    recipientDisplayName,
                    () => {
                      console.log('[ChatWindow] GIF message sent with complete fileInfo (fallback)');
                    },
                    (error) => {
                      console.error('[ChatWindow] Failed to send GIF message (fallback):', error);
                    },
                    updatedFileInfo
                  );
                  
                  messagesContext.updateMessage(chat.chatId, fallbackMessage.messageId, { fileInfo: updatedFileInfo });
                  console.log('[ChatWindow] ✅ Message updated with fileId (fallback method - immediate success)');
                }
              }
            }
          }
        }
        } catch (error) {
          console.error('[ChatWindow] ❌ Error in file conversion flow:', {
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            optimisticMessageId,
            chatId: chat.chatId,
            gifDataName: gifData.name,
          });
          
          // Try to update message to show error state
          if (messagesContext?.updateMessage && optimisticMessageId) {
            const messages = messagesContext.getMessages(chat.chatId);
            const messageToUpdate = messages.find(m => m.messageId === optimisticMessageId);
            if (messageToUpdate && messageToUpdate.fileInfo) {
              console.log('[ChatWindow] 🔧 Attempting to mark message as failed');
              // Don't update fileId, but could set an error flag if needed
            }
          }
        } finally {
          console.log('[ChatWindow] 🏁 processFileConversion function COMPLETED');
        }
      };
      console.log('[ChatWindow] 🚀 Calling processFileConversion()');
      void processFileConversion();
      console.log('[ChatWindow] ✅ processFileConversion() call completed (fire-and-forget)');
    } catch (error) {
      console.error('[ChatWindow] Error sending GIF:', error);
      // Fallback: send as text message if file upload fails
      handleSendMessage(`[GIF: ${gifUrl}]`);
    }
  }, [chat, messagesContext, handleSendMessage]);

  // Resize handling (matches Angular cnv-window-resize-manager)
  const onResizerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragRef.current = {
      startY: e.clientY,
      startH: height,
    };

    const onPointerMove = (moveE: PointerEvent) => {
      if (!dragRef.current) return;
      const deltaY = dragRef.current.startY - moveE.clientY;
      const newHeight = Math.max(200, Math.min(600, dragRef.current.startH + deltaY));
      setHeight(newHeight);
    };

    const onPointerUp = () => {
      dragRef.current = null;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, [height]);

  return (
    <div
      ref={rootRef}
      className="chatWindowMain"
      style={{
        position: 'fixed',
        right: `${rightOffset}px`,
        bottom: 0,
        width: isMinimized ? '166px' : '302px', // Matches AngularJS: minimized=166px, maximized=302px
        height: isMinimized ? '28px' : `${height}px`,
        border: '1px solid rgba(150,150,150,0.3)',
        borderBottom: 'none',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        background: '#fff', // Solid white background - CRITICAL for isolation
        boxShadow: '0px 0px 0px 1px rgba(150,150,150,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10000, // Higher than chat list (z-index: 9999) and background content - CRITICAL for proper stacking
        transform: 'translateZ(0)', // Creates new stacking context (matches AngularJS)
        isolation: 'isolate', // Creates new stacking context - ensures isolation from background
        willChange: 'transform', // Optimizes rendering and creates stacking context
        backgroundColor: '#fff', // Explicitly set background color for isolation
        outline: 'none', // Matches AngularJS
        userSelect: 'text', // Matches AngularJS
        WebkitUserSelect: 'text', // Matches AngularJS
        MozUserSelect: 'text', // Matches AngularJS
        msUserSelect: 'text', // Matches AngularJS
        backgroundClip: 'padding-box', // Matches AngularJS
        WebkitBackgroundClip: 'padding', // Matches AngularJS
        MozBackgroundClip: 'padding', // Matches AngularJS
      }}
    >
      {/* Resizer (only when maximized) */}
      {!isMinimized && (
        <div
          className="content-resizer"
          onPointerDown={onResizerPointerDown}
        />
      )}

      {/* Header - Matches AngularJS chatWindow.tpl.html exactly */}
      {/* Header background: #1f2e3d (focused) or #7b8386 (unfocused) - matches @cnv-chat-focused-color */}
      <div className="chatWindowHeader" style={{ background: '#1f2e3d' }}>
        {/* User avatar and presence (P2P chats only) - Matches AngularJS lines 7-23 */}
        {chat.chatType === 1 && enrichedUser && !isMinimized && (
          <div className="namesPopover" style={{ cursor: 'pointer', verticalAlign: 'middle', minHeight: '100%' }}>
            <div className="userProfileImg" style={{ position: 'absolute' }}>
              <UserProfileImage
                userId={enrichedUser.userId}
                width={28}
                height={28}
                profileType={enrichedUser.profileImageType && enrichedUser.profileImageType !== '' ? enrichedUser.profileImageType : enrichedUser.profile_image_type}
                profileVersion={enrichedUser.profileImageVersion && enrichedUser.profileImageVersion !== '' ? enrichedUser.profileImageVersion : enrichedUser.profile_image_version}
                fullName={enrichedUser.displayName || chat.title}
                user={{
                  ...enrichedUser,
                  // Ensure snake_case properties for UserProfileImage compatibility
                  // Convert empty strings to undefined
                  profile_image_type: (enrichedUser.profileImageType && enrichedUser.profileImageType !== '') ? enrichedUser.profileImageType : (enrichedUser.profile_image_type && enrichedUser.profile_image_type !== '' ? enrichedUser.profile_image_type : undefined),
                  profile_image_version: (enrichedUser.profileImageVersion && enrichedUser.profileImageVersion !== '') ? enrichedUser.profileImageVersion : (enrichedUser.profile_image_version && enrichedUser.profile_image_version !== '' ? enrichedUser.profile_image_version : undefined),
                  user_id: enrichedUser.userId ?? enrichedUser.user_id,
                }}
              />
            </div>
            {/* Presence status indicator - Matches AngularJS lines 12-23 */}
            {enrichedUser.presenceStatus !== undefined && (
              <div style={{ marginLeft: '32px', marginBottom: '-7px', display: 'inline-block' }}>
                {enrichedUser.presenceStatus === 1 && enrichedUser.device !== 2 && (
                  <div className="listUserStatusOnline" />
                )}
                {enrichedUser.presenceStatus === 2 && enrichedUser.device !== 2 && (
                  <div className="listUserStatusBusy" />
                )}
                {enrichedUser.presenceStatus === 3 && enrichedUser.device !== 2 && (
                  <div className="listUserStatusIdle" />
                )}
                {enrichedUser.presenceStatus === 4 && enrichedUser.device !== 2 && !enrichedUser.hasMobile && (
                  <div className="listUserStatusOffline" />
                )}
                {(enrichedUser.device === 2 || (enrichedUser.presenceStatus === 4 && enrichedUser.hasMobile)) && (
                  <div className="listUserStatusMobileWhite" />
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Group chat icon (AngularJS: .group-title-img) */}
        {chat.chatType === 2 && !isMinimized && (
          <img
            src="/assets/img/chat/icon2__Group-Following-white.svg"
            alt="Group"
            width={24}
            height={24}
            style={{
              position: 'absolute',
              top: '2px',
              left: '4px',
              zIndex: 1,
              display: 'block',
            }}
          />
        )}

        {/* Chat title - fetched from API (chat.title). Falls back to computed title when API title is empty */}
        <span
          className="userProfileName"
          style={{
            width: isMinimized ? '54%' : (chat.chatType === 2 ? '50%' : '46%'),
            left: chat.chatType === 2 ? '33px' : (chat._user ? '50px' : '10px'),
            position: 'absolute',
            lineHeight: '27px',
            top: '1px',
            fontSize: '14px',
            color: '#ffffff',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            cursor: 'default',
          }}
        >
          {displayTitle}
        </span>
        
        {/* Header icons - Matches AngularJS lines 51-157 */}
        {!isMinimized && (
          <>
            {/* Expand icon - right: 91px */}
            <a className="btnExpand" style={{ position: 'absolute', right: '91px', top: 0 }}>
              <i className="headerIcon cnv-icons-16 chat-window-expand-white" />
            </a>
            {/* Audio call icon - right: 68px */}
            <div className="btnStartAudioCall" style={{ position: 'absolute', right: '68px', top: 0 }}>
              <i className="headerIcon cnv-icons-20 chat-window-audio-white" />
            </div>
            {/* Add to chat icon - right: 45px (AngularJS shows this for BOTH P2P + GROUP) */}
            <div
              className="addToChat"
              style={{ position: 'absolute', right: '45px', top: 0, cursor: 'pointer' }}
              onClick={() => {
                setShowUserSearchDropdown(!showUserSearchDropdown);
              }}
              title="Add people to chat"
            >
              <i className="headerIcon cnv-icons-20 chat-window-plus-white" />
            </div>
            {/* Settings icon - right: 25px */}
            <div className="btnChatOptions" style={{ position: 'absolute', right: '25px', top: 0 }}>
              <i className="headerIcon cnv-icons-20 chat_settings_white" />
            </div>
          </>
        )}
        {/* Close icon - right: 4px */}
        <div className="btnClose" style={{ position: 'absolute', right: '4px', top: 0 }} onClick={handleClose}>
          <i className="headerIcon cnv-icons-20 chat-window-cancel-white" />
        </div>
      </div>
      
      {/* Status Bar (chatActionBar) - Matches AngularJS chatActionBar.tpl.html */}
      {!isMinimized && chat.chatType === 1 && chat._user && (
        <div className="chatActionBar" style={{
          height: '40px',
          background: '#fff',
          borderBottom: '1px solid #d4d9e3',
          position: 'relative',
        }}>
          <div className="statusMessage" style={{
            width: '60%',
            height: 'inherit',
            position: 'absolute',
            marginLeft: '5px',
            lineHeight: '40px',
            fontSize: '14px',
            color: '#7b8386',
          }}>
            {enrichedUser && enrichedUser.presenceStatus === 1 && enrichedUser.device !== 2 && `${enrichedUser.displayName || chat.title} is online`}
            {enrichedUser && enrichedUser.presenceStatus === 2 && enrichedUser.device !== 2 && `${enrichedUser.displayName || chat.title} is busy`}
            {enrichedUser && enrichedUser.presenceStatus === 3 && enrichedUser.device !== 2 && `${enrichedUser.displayName || chat.title} is idle`}
            {enrichedUser && enrichedUser.presenceStatus === 4 && enrichedUser.device !== 2 && !enrichedUser.hasMobile && `${enrichedUser.displayName || chat.title} is offline`}
            {enrichedUser && (enrichedUser.device === 2 || (enrichedUser.presenceStatus === 4 && enrichedUser.hasMobile)) && `Active ${enrichedUser.lastPingTime ? new Date(enrichedUser.lastPingTime).toLocaleDateString() : ''}`}
          </div>
        </div>
      )}

      {/* Group Chat Action Bar - Participant List */}
      {!isMinimized && chat.chatType === 2 && (
        <ParticipantList chat={chat} allUsers={allUsers} />
      )}

      {/* Add user in chat dropdown (AngularJS cnv-add-user-in-chat) */}
      {!isMinimized && showUserSearchDropdown && (
        <div className="chatActionBar" style={{
          height: '40px',
          background: '#fff',
          borderBottom: '1px solid #d4d9e3',
          position: 'relative',
        }}>
          {/* Participants list would go here */}
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <UserSearchDropdown
              chat={chat}
              isOpen={showUserSearchDropdown}
              onClose={() => setShowUserSearchDropdown(false)}
              onUserSelect={async (user: NetworkUser) => {
                try {
                  // Get current session info
                  const sessionData =
                    typeof window !== 'undefined'
                      ? (window as any).com_convo?.sessionData?.signInResponseData
                      : null;
                  const currentAccountId = sessionData?.account_id;
                  const currentUser = sessionData?.user;
                  const currentUserId = currentUser?.user_id || '';
                  const currentUserName =
                    `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || currentUser?.email || '';

                  // Selected user fields
                  const selectedUserId = user.user_id || user.userId || '';
                  const selectedUserName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';
                  const selectedUserAccountId = user.account_id || user.accountId;

                  if (chat.chatType === 1) {
                    // P2P → create a new local group chat (AngularJS: chatManager.startChatWithUsers)
                    const other = chat._user;
                    if (!other?.userId) {
                      console.warn('[ChatWindow] Cannot create group chat from P2P: missing other participant');
                      return;
                    }

                    const newChatId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    const isUnifiedChat =
                      !!selectedUserAccountId && !!currentAccountId && selectedUserAccountId !== currentAccountId;

                    const participants: Record<string, ChatParticipant> = {};
                    // this user
                    if (currentUserId) {
                      participants[currentUserId] = {
                        userId: currentUserId,
                        name: currentUserName,
                        displayName: currentUserName,
                        status: 'joined',
                        accountId: currentAccountId,
                        showParticipantInfo: 1,
                      };
                    }
                    // existing other participant
                    participants[other.userId] = {
                      ...other,
                      userId: other.userId,
                      name: other.name || other.displayName || other.userId,
                      displayName: other.displayName || other.name,
                      status: 'joined',
                      accountId: other.accountId || currentAccountId,
                      showParticipantInfo: 1,
                    };
                    // newly selected participant
                    participants[selectedUserId] = {
                      userId: selectedUserId,
                      name: selectedUserName,
                      displayName: selectedUserName,
                      status: 'joined',
                      accountId: selectedUserAccountId,
                      showParticipantInfo: 1,
                    };

                    const newGroupChat: Chat = {
                      chatId: newChatId,
                      title: '', // server/computed title
                      chatType: 2,
                      unreadCount: 0,
                      lastMessageTimestamp: 0,
                      lastMessageSequenceNumber: 0,
                      summeryText: '',
                      isMuted: false,
                      participants,
                      isUnifiedChat,
                    };

                    openChatWindow(newGroupChat, { isOpenedOnUserAction: true });
                    setShowUserSearchDropdown(false);
                    return;
                  }

                  // GROUP: invite into existing group chat (AngularJS: chatManager.inviteUsersInChat)
                  const isUnifiedChat = chat.isUnifiedChat || false;
                  const unifiedNetworkAccountId = sessionData?.account_id;

                  const inviteUsers = [
                    {
                      userId: selectedUserId,
                      displayName: selectedUserName,
                      accountId: selectedUserAccountId,
                    },
                  ];

                  xmppChatService.inviteUsersInChat(
                    inviteUsers,
                    chat.chatId,
                    chat.chatType,
                    isUnifiedChat,
                    unifiedNetworkAccountId,
                    () => {
                      setShowUserSearchDropdown(false);
                    },
                    (error) => {
                      console.error('[ChatWindow] ❌ Error inviting user:', error);
                    }
                  );
                } catch (error) {
                  console.error('[ChatWindow] ❌ Error in invite handler:', error);
                }
              }}
              availableUsers={allUsers}
            />
          </div>
        </div>
      )}

      {/* Chat content (only when maximized) - Matches AngularJS chatWindowContent structure */}
      {!isMinimized && (
        <div className="chatWindowContent" style={{ 
          position: 'relative', 
          height: chat.chatType === 1 && chat._user ? 'calc(100% - 68px)' : 'calc(100% - 28px)', // 28px header + 40px status bar (if P2P)
          width: '100%',
          overflow: 'hidden', // Keep overflow hidden for content clipping
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff', // Solid white background - CRITICAL for isolation
          backgroundColor: '#fff', // Explicitly set background color
          zIndex: 1, // Ensure content is above background
          isolation: 'isolate', // Creates new stacking context
        }}>
          {/* Message list - Takes available space, matches AngularJS .chatMessageWindow */}
          {/* CRITICAL: Parent must have position: relative for scrollbar positioning */}
          {/* Overflow can be hidden because scrollbar is absolutely positioned and will be visible */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              chatType={chat.chatType}
              isLoading={isLoadingMessages}
              chatId={chat.chatId}
              chat={chat} // Pass chat object for accessing participants
            />
          </div>

          {/* Message input - Fixed at bottom, matches AngularJS .messageInputContainer */}
          <MessageInput
            onSend={handleSendMessage}
            onGifSelect={handleGifSelect}
            placeholder={`Message ${chat.title}...`}
            showGiphy={true}
            disabled={false}
          />
        </div>
      )}

      {/* AddPeopleToChat Modal - Only for group chats */}
      {chat.chatType === 2 && (
        <AddPeopleToChat
          chat={chat}
          isOpen={showAddPeopleModal}
          onClose={() => setShowAddPeopleModal(false)}
          onInvite={async (users: NetworkUser[]) => {
            try {
              // Get current user info for unified chat check
              const sessionData = (typeof window !== 'undefined' && (window as any).com_convo?.sessionData?.signInResponseData);
              const isUnifiedChat = chat.isUnifiedChat || false;
              const unifiedNetworkAccountId = sessionData?.account_id;

              // Convert NetworkUser to invite format
              const inviteUsers = users.map(user => ({
                userId: user.user_id || user.userId || '',
                displayName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '',
                accountId: user.account_id || user.accountId,
              }));

              // Call XMPP invite service
              xmppChatService.inviteUsersInChat(
                inviteUsers,
                chat.chatId,
                chat.chatType,
                isUnifiedChat,
                unifiedNetworkAccountId,
                () => {
                  console.log('[ChatWindow] ✅ Users invited successfully');
                  setShowAddPeopleModal(false);
                },
                (error) => {
                  console.error('[ChatWindow] ❌ Error inviting users:', error);
                  // TODO: Show error alert
                }
              );
            } catch (error) {
              console.error('[ChatWindow] ❌ Error in invite handler:', error);
            }
          }}
          availableUsers={allUsers}
        />
      )}
    </div>
  );
}

