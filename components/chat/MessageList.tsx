'use client';

/**
 * MessageList - Scrollable message container
 * 
 * Replicates Angular messageListContainer EXACTLY
 * File: chatWindow.tpl.html
 * 
 * Scroll behavior matches AngularJS chatWindow.js:
 * - Only message area is scrollable (header/footer fixed)
 * - Auto-scroll on send: ALWAYS
 * - Auto-scroll on receive: ONLY if user is already at bottom
 * - Check if at bottom: scrollHeight <= scrollTop + clientHeight + 10 (10px threshold)
 * - Preserve scroll position when user scrolls up
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatMessage } from '@/types/message';
import MessageBubble from './MessageBubble';
import { dateSeparatorFromCurrentTime, isDayDiff } from '@/utils/timestampUtils';
import { useAutoHidingScrollbar } from '@/hooks/useAutoHidingScrollbar';
import './MessageList.css';
import { useChatList } from '@/contexts/ChatListContext';
import { useMessages } from '@/contexts/MessagesContext';
import { xmppChatService } from '@/utils/xmppChatService';
import type { Chat } from '@/types/chat';
import { getUserId } from '@/types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  chatType: number; // 1=P2P, 2=GROUP
  isLoading?: boolean;
  chatId?: string;
  chat?: Chat; // Chat object for accessing participants
}

export default function MessageList({ messages, currentUserId, chatType, isLoading = false, chatId, chat }: MessageListProps) {
  
  // Get ALL users from ChatListContext (matches AngularJS chatUsersManager.getUser())
  // Use allUsers (not just users without chats) - matches AngularJS userManager._usersDictionary
  const { allUsers } = useChatList();
  
  // Auto-hiding scrollbar hook (matches AngularJS autoHidingScrollBar directive)
  // This hook creates a custom scrollbar that auto-hides and shows on scroll/hover
  const containerRef = useAutoHidingScrollbar();
  
  // Track if user is scrolled to bottom (matches AngularJS scope.isChatWindowScrolledToBottom)
  // CRITICAL: Initialize to true (matches AngularJS line 72: scope.isChatWindowScrolledToBottom = true)
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  
  // Track if this is the first render (for initial scroll to bottom)
  const isFirstRenderRef = useRef(true);
  
  // Track previous message count to detect new messages
  const prevMessageCountRef = useRef(messages.length);
  
  // Track if last message was sent by current user (for auto-scroll on send)
  const lastMessageWasSentRef = useRef(false);
  
  // Load older messages state (matches AngularJS scope.messageListSpinner / scope.loadingOlderMessages)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  
  // Scroll position preservation (matches AngularJS ScrollPosition class)
  const scrollPositionRef = useRef<{
    previousScrollHeightMinusTop: number;
    readyFor: 'up' | 'down';
  }>({
    previousScrollHeightMinusTop: 0,
    readyFor: 'up',
  });
  
  // Prevent duplicate load calls (matches AngularJS chat.isLoadingInProgress check)
  const isLoadingOlderMessagesRef = useRef(false);
  
  // Track when we need to restore scroll position after prepending messages
  const shouldRestoreScrollRef = useRef(false);
  
  // Get messages context for prepending older messages
  const { prependMessages } = useMessages();
  
  // Populate user data and calculate avatar visibility for messages
  // Matches AngularJS messageListTempCalculator.js lines 906-925 EXACTLY
  // CRITICAL: Process messages in forward order, but check NEXT message to determine avatar visibility
  const messagesWithUserData = messages.map((message, index) => {
    const isOwnMessage = message.senderId === currentUserId;
    
    // For incoming messages, ALWAYS populate user data (matches AngularJS lines 914-925 EXACTLY)
    if (!isOwnMessage) {
      // CRITICAL: AngularJS ALWAYS sets _user - either from chatUsersManager.getUser() OR chatObj.participants
      // Matches AngularJS messageListTempCalculator.js lines 914-925:
      //   var user = chatUsersManager.getUser(thisMessage.senderId);
      //   if (user) {
      //     thisMessageView._user = user;
      //   } else {
      //     thisMessageView._user = chatObj.participants[thisMessage.senderId];
      //   }
      let userData = message._view?._user;
      
      // If not already set, try to get from users list first (matches AngularJS chatUsersManager.getUser())
      if (!userData) {
        // Try to find user in allUsers (matches AngularJS chatUsersManager.getUser() which checks _usersDictionary)
        // CRITICAL: Use allUsers, not just users without chats, because users in chats still need profile images
        const userFromList = allUsers.find(u => getUserId(u) === message.senderId);
        
        if (userFromList) {
          // Use user from users list (has profileImageType and profileImageVersion)
          // CRITICAL: Convert to number/string as needed (AngularJS stores as number)
          const profileImageType = userFromList.profile_image_type !== undefined && userFromList.profile_image_type !== null
            ? String(userFromList.profile_image_type)
            : undefined;
          const profileImageVersion = userFromList.profile_image_version !== undefined && userFromList.profile_image_version !== null
            ? String(userFromList.profile_image_version)
            : undefined;
          
          userData = {
            userId: getUserId(userFromList),
            displayName: userFromList.first_name && userFromList.last_name 
              ? `${userFromList.first_name} ${userFromList.last_name}` 
              : userFromList.email || message.senderId,
            profileImageType,
            profileImageVersion,
            // CRITICAL: Include name properties for initials calculation
            name: userFromList.first_name && userFromList.last_name 
              ? `${userFromList.first_name} ${userFromList.last_name}` 
              : userFromList.email,
            first_name: userFromList.first_name,
            last_name: userFromList.last_name,
            firstName: userFromList.first_name,
            lastName: userFromList.last_name,
            email: userFromList.email,
          };
          
          // Debug log for avatar lookup
          if (!isOwnMessage) {
            // console.log('[Avatar] 🔍 Found user in allUsers:', {
            //   senderId: message.senderId,
            //   userId: userData.userId,
            //   displayName: userData.displayName,
            //   profileImageType: userData.profileImageType,
            //   profileImageVersion: userData.profileImageVersion,
            //   rawProfileImageType: userFromList.profile_image_type,
            //   rawProfileImageVersion: userFromList.profile_image_version,
            //   allUsersCount: allUsers.length,
            // });
          }
        } else if (chat?.participants && chat.participants[message.senderId]) {
          // Fallback to participant data (matches AngularJS line 923)
          const participant = chat.participants[message.senderId];
          // CRITICAL: Convert to string as needed (XMPP attributes are strings)
          const profileImageType = participant.profileImageType !== undefined && participant.profileImageType !== null
            ? String(participant.profileImageType)
            : undefined;
          const profileImageVersion = participant.profileImageVersion !== undefined && participant.profileImageVersion !== null
            ? String(participant.profileImageVersion)
            : undefined;
          
          userData = {
            userId: participant.userId || message.senderId,
            displayName: participant.displayName || participant.name || 
              (participant.firstName && participant.lastName ? `${participant.firstName} ${participant.lastName}` : '') || 
              message.senderId,
            profileImageType,
            profileImageVersion,
            // CRITICAL: Include name properties for initials calculation
            name: participant.displayName || participant.name || 
              (participant.firstName && participant.lastName ? `${participant.firstName} ${participant.lastName}` : '') ||
              participant.email,
            first_name: participant.firstName || (participant as any).first_name,
            last_name: participant.lastName || (participant as any).last_name,
            firstName: participant.firstName || (participant as any).first_name,
            lastName: participant.lastName || (participant as any).last_name,
            email: participant.email || (participant as any).email,
          };
          
          // Debug log for participant lookup (disabled by default)
          // if (!isOwnMessage && typeof window !== 'undefined' && (window as any).__DEBUG_AVATAR__) {
          //   console.log('[Avatar] 🔍 Found user in participants:', {
          //     senderId: message.senderId,
          //     userId: userData.userId,
          //     displayName: userData.displayName,
          //     profileImageType: userData.profileImageType,
          //     profileImageVersion: userData.profileImageVersion,
          //     rawProfileImageType: participant.profileImageType,
          //     rawProfileImageVersion: participant.profileImageVersion,
          //   });
          // }
        } else {
          // Final fallback: Create minimal user data from senderId
          userData = {
            userId: message.senderId,
            displayName: message.senderId,
            profileImageType: undefined,
            profileImageVersion: undefined,
          };
          
          // Debug log for missing user (disabled by default)
          // if (!isOwnMessage && typeof window !== 'undefined' && (window as any).__DEBUG_AVATAR__) {
          //   console.log('[Avatar] ⚠️ User NOT found in allUsers or participants:', {
          //     senderId: message.senderId,
          //     allUsersCount: allUsers.length,
          //     hasParticipants: !!chat?.participants,
          //     participantKeys: chat?.participants ? Object.keys(chat.participants) : [],
          //   });
          // }
        }
      }
      
      // CRITICAL: Always ensure userData is set (AngularJS always sets it)
      if (!userData) {
        userData = {
          userId: message.senderId,
          displayName: message.senderId,
          profileImageType: undefined,
          profileImageVersion: undefined,
        };
      }
      
      // Calculate avatar visibility based on next message (matches AngularJS lines 906-912)
      // Show avatar if: !nextMessage OR nextMessage.senderId != message.senderId OR nextMessage.type != MESSAGE
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
      
      // CRITICAL: Ensure boolean result (matches AngularJS line 906 exactly)
      // AngularJS: !nextMessage || nextMessage.senderId != thisMessage.senderId || nextMessage.type != com_convo.chatsdk.MessageType.MESSAGE
      let shouldShowAvatar: boolean;
      if (!nextMessage) {
        shouldShowAvatar = true; // No next message - show avatar
      } else if (nextMessage.senderId !== message.senderId) {
        shouldShowAvatar = true; // Different sender - show avatar
      } else if (nextMessage.isSystemMessage) {
        shouldShowAvatar = true; // Next is system message - show avatar
      } else if (nextMessage.type && nextMessage.type !== 'message') {
        shouldShowAvatar = true; // Next is not a regular message - show avatar
      } else {
        shouldShowAvatar = false; // Same sender, regular message - hide avatar
      }
      
      // Avatar visibility calculation complete
      
      // CRITICAL: Always set _user (matches AngularJS line 920 or 923)
      // AngularJS: thisMessageView._user = user OR thisMessageView._user = chatObj.participants[thisMessage.senderId]
      // Ensure userData has both camelCase and snake_case properties for UserProfileImage compatibility
      // CRITICAL: Include name properties for initials calculation
      const userDataForView = {
        ...userData,
        // Ensure snake_case properties for UserProfileImage component
        profile_image_type: userData.profileImageType ?? userData.profile_image_type,
        profile_image_version: userData.profileImageVersion ?? userData.profile_image_version,
        user_id: userData.userId ?? userData.user_id,
        // CRITICAL: Include name properties for getUserInitials
        // Priority: displayName > name > first_name + last_name > email
        name: userData.displayName || 
              (userData as any).name || 
              ((userData as any).first_name && (userData as any).last_name 
                ? `${(userData as any).first_name} ${(userData as any).last_name}` 
                : (userData as any).email || undefined),
        first_name: (userData as any).first_name || (userData as any).firstName,
        last_name: (userData as any).last_name || (userData as any).lastName,
        firstName: (userData as any).first_name || (userData as any).firstName,
        lastName: (userData as any).last_name || (userData as any).lastName,
        email: (userData as any).email,
      };
      
      // CRITICAL: If name properties are missing, try to extract from displayName
      // This ensures initials can be calculated even if name properties weren't set
      if (!userDataForView.name && userData.displayName) {
        userDataForView.name = userData.displayName;
      }
      if (!userDataForView.first_name && !userDataForView.last_name && userData.displayName) {
        const nameParts = userData.displayName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          userDataForView.first_name = nameParts[0];
          userDataForView.firstName = nameParts[0];
          userDataForView.last_name = nameParts.slice(1).join(' ');
          userDataForView.lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          userDataForView.first_name = nameParts[0];
          userDataForView.firstName = nameParts[0];
          userDataForView.name = userDataForView.name || nameParts[0];
        }
      }
      
      // Debug: Log userDataForView for initials debugging (disabled by default)
      // if (!isOwnMessage && typeof window !== 'undefined' && (window as any).__DEBUG_AVATAR__) {
      //   console.log('[MessageList] userDataForView for initials:', {
      //     userId: userDataForView.user_id,
      //     displayName: userData.displayName,
      //     name: userDataForView.name,
      //     first_name: userDataForView.first_name,
      //     last_name: userDataForView.last_name,
      //     email: userDataForView.email,
      //   });
      // }
      
      return {
        ...message,
        _view: {
          ...message._view,
          _user: userDataForView, // ALWAYS set - matches AngularJS behavior
          otherUserWithImg: shouldShowAvatar ? 1 : 0,
          otherUserWithoutImg: shouldShowAvatar ? 0 : 1,
        },
      };
    }
    
    // For own messages, keep as is
    return message;
  });
  
  // Update previous messages if current message is from same sender (matches AngularJS lines 522-528)
  // This hides avatar on previous message when consecutive messages are from same sender
  // Process messages in forward order, updating previous message when consecutive messages found
  const processedMessages = [...messagesWithUserData];
  for (let i = 1; i < processedMessages.length; i++) {
    const currentMsg = processedMessages[i];
    const prevMsg = processedMessages[i - 1];
    
    // If current and previous are from same sender (and both are incoming), hide avatar on previous
    if (currentMsg.senderId === prevMsg.senderId && 
        currentMsg.senderId !== currentUserId && 
        prevMsg.senderId !== currentUserId &&
        prevMsg._view?.otherUserWithImg === 1) {
      processedMessages[i - 1] = {
        ...prevMsg,
        _view: {
          ...prevMsg._view,
          otherUserWithImg: 0,
          otherUserWithoutImg: 1,
        },
      };
    }
  }
  
  // Use processed messages with correct avatar visibility
  const messagesWithAvatarVisibility = processedMessages;
  
  // Debug: Log processed messages (disabled by default)
  // if (typeof window !== 'undefined' && (window as any).__DEBUG_MESSAGES__) {
  //   console.log('[MessageList] 📊 Processed messages:', {
  //     inputCount: messages.length,
  //     processedCount: messagesWithAvatarVisibility.length,
  //     processedMessageIds: messagesWithAvatarVisibility.map(m => m.messageId),
  //     lastMessageId: messagesWithAvatarVisibility[messagesWithAvatarVisibility.length - 1]?.messageId,
  //     lastMessageText: messagesWithAvatarVisibility[messagesWithAvatarVisibility.length - 1]?.messageText?.substring(0, 20),
  //     messagesRef: messages,
  //     processedRef: messagesWithAvatarVisibility,
  //   });
  // }

  /**
   * Check if scrolled to bottom (matches AngularJS isChatMessageListScrolledToBottom)
   * Source: chatWindow.js lines 133-148
   * 
   * Returns true if: scrollHeight <= scrollTop + clientHeight + 10 (10px threshold)
   */
  const checkIsScrolledToBottom = useCallback((): boolean => {
    if (!containerRef.current) {
      return true; // If no container, assume at bottom (matches AngularJS line 146)
    }
    
    const container = containerRef.current;
    const scrollTop = Math.ceil(container.scrollTop);
    const elementHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;
    
    // Matches AngularJS line 139: scrollHeight <= scrollTop + elementHeight + 10
    const isAtBottom = scrollHeight <= scrollTop + elementHeight + 10;
    
    return isAtBottom;
  }, [containerRef]);
  
  /**
   * Scroll to bottom (matches AngularJS scrollChatMessageListContainerToBottom)
   * Source: chatWindow.js lines 114-132
   * 
   * @param scrollPos - If >= 0, scroll to specific position. If < 0, scroll to bottom.
   */
  const scrollToBottom = useCallback((scrollPos?: number) => {
    if (!containerRef.current) {
      return;
    }
    
    const container = containerRef.current;
    
    // Matches AngularJS line 117: if (scrollHeight > clientHeight)
    if (container.scrollHeight > container.clientHeight) {
      if (scrollPos !== undefined && scrollPos >= 0) {
        // Scroll to specific position (matches AngularJS line 121)
        container.scrollTop = scrollPos;
      } else {
        // Scroll to bottom (matches AngularJS line 124)
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [containerRef]);
  
  // Handle scroll events to track if user is at bottom (matches AngularJS containerScrolled)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    
    const handleScroll = () => {
      const wasAtBottom = checkIsScrolledToBottom();
      setIsScrolledToBottom(wasAtBottom);
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, checkIsScrolledToBottom]);
  
  // Separate effect for scroll-to-top detection and load older messages (matches AngularJS containerScrolled)
  // CRITICAL: This handler must NOT interfere with the scrollbar hook's scroll listener
  // The scrollbar hook already adds a scroll listener, so we use a small delay to check scrollTop
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !chatId || !chat) {
      return;
    }
    
    // Use a debounced handler to avoid conflicts with scrollbar hook
    let scrollTimeout: NodeJS.Timeout | null = null;
    let lastScrollTop = container.scrollTop;
    
    const handleScrollToTop = () => {
      // Clear any pending timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Store current scrollTop immediately
      const currentScrollTop = container.scrollTop;
      lastScrollTop = currentScrollTop;
      
      // CRITICAL: Reduce debounce to 50ms (matches AngularJS scrollTimeout 50ms line 42)
      // This ensures scroll-to-top detection is responsive and doesn't miss scroll events
      scrollTimeout = setTimeout(() => {
        // Re-read scrollTop after debounce (scrollbar hook may have changed it)
        const scrollTop = Math.ceil(container.scrollTop);
        
        // CRITICAL: Detect scroll to top and load older messages (matches AngularJS line 488-493)
        // Matches AngularJS: if (scrollTop == 0) { ... chatManager.loadOlderMessagesInChat(...) }
        if (scrollTop === 0 || scrollTop < 1) {
          // CRITICAL: Check loading flags in correct order (matches AngularJS)
          // 1. Check isLoadingOlderMessagesRef first (local state)
          // 2. Check chat.isLoadingInProgress (global state)
          // Both must be false to allow new load
          if (isLoadingOlderMessagesRef.current) {
            return;
          }
          
          // Check if chat is already loading (matches AngularJS chat.isLoadingInProgress line 2761)
          // CRITICAL: This check MUST come before minSequenceNumber check to prevent stuck loader
          if ((chat as any).isLoadingInProgress) {
            return;
          }
          
          // Get minSequenceNumber from chat (matches AngularJS chat.minSequenceNumber)
          // Calculate from messages if not set in chat object
          const messages = messagesWithAvatarVisibility;
          const minSequenceNumber = chat.minSequenceNumber || 
            (messages.length > 0 
              ? Math.min(...messages.map(m => m.sequenceNumber || 0).filter(seq => seq > 0))
              : 0);
          
          // Check if there are more messages to load (matches AngularJS currentMinSequenceNumber > 1 line 2765)
          if (minSequenceNumber <= 1) {
            // Debug: Log no more messages (disabled by default)
            // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
            //   console.log('[MessageList] No more older messages to load (minSequenceNumber <= 1):', minSequenceNumber);
            // }
            return;
          }
          
          // Debug: Log scroll to top (disabled by default)
          // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
          //   console.log('[MessageList] 📜 Scroll to top detected - loading older messages', {
          //     chatId,
          //     minSequenceNumber,
          //     scrollTop,
          //     messageCount: messages.length,
          //   });
          // }
          
        // Store scroll position before loading (matches AngularJS scrollPosition.prepareFor('up'))
        // CRITICAL: When scrollTop === 0, we're at the top, so previousScrollHeightMinusTop = scrollHeight
        // This ensures after prepending, we stay at the top (where the loader is)
        scrollPositionRef.current.previousScrollHeightMinusTop = container.scrollHeight - container.scrollTop;
        scrollPositionRef.current.readyFor = 'up';
        
        // Debug: Log scroll position preparation (disabled by default)
        // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
        //   console.log('[MessageList] 📜 Preparing scroll position for restore:', {
        //     scrollTop: container.scrollTop,
        //     scrollHeight: container.scrollHeight,
        //     previousScrollHeightMinusTop: scrollPositionRef.current.previousScrollHeightMinusTop,
        //   });
        // }
          
          // Set loading state (matches AngularJS scope.messageListSpinner = true)
          setLoadingOlderMessages(true);
          isLoadingOlderMessagesRef.current = true;
          
          // Get unified chat info (matches AngularJS isUnifiedChat and unifiedNetworkAccountId)
          const isUnifiedChat = chat.isUnifiedChat || false;
          const unifiedNetworkAccountId = chat.participants && Object.values(chat.participants)[0]?.accountId;
          
          // CRITICAL: Set chat.isLoadingInProgress BEFORE calling loadOlderMessagesInChat
          // This matches AngularJS line 2766: chat.isLoadingInProgress = true
          (chat as any).isLoadingInProgress = true;
          
          // Load older messages (matches AngularJS chatManager.loadOlderMessagesInChat)
          xmppChatService.loadOlderMessagesInChat(
            chatId,
            minSequenceNumber,
            isUnifiedChat,
            unifiedNetworkAccountId,
            (olderMessages) => {
              // CRITICAL: Reset loading flag AFTER fetch completes (matches AngularJS line 2317, 2714, 2896)
              // This MUST be reset to allow next scroll-to-top to trigger another load
              (chat as any).isLoadingInProgress = false;
              
              // Debug: Log loaded messages (disabled by default)
              // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
              //   console.log(`[MessageList] ✅ Loaded ${olderMessages.length} older messages`);
              // }
              
              // Prepend messages to context (matches AngularJS chat.prependMessages)
              if (olderMessages.length > 0 && chatId) {
                prependMessages(chatId, olderMessages);
                // Mark that we need to restore scroll position after React re-renders
                shouldRestoreScrollRef.current = true;
              } else {
                // No messages loaded - clear loading state immediately
                // CRITICAL: Also reset isLoadingOlderMessagesRef to allow next load
                setLoadingOlderMessages(false);
                isLoadingOlderMessagesRef.current = false;
              }
            },
            (error) => {
              // CRITICAL: Reset loading flag on error (matches AngularJS error handling)
              // This MUST be reset to allow next scroll-to-top to trigger another load
              (chat as any).isLoadingInProgress = false;
              
              console.error('[MessageList] ❌ Failed to load older messages:', error);
              setLoadingOlderMessages(false);
              isLoadingOlderMessagesRef.current = false;
            }
          );
        }
      }, 50); // Matches AngularJS scrollTimeout 50ms (line 42)
    };
    
    // Add scroll listener with passive flag to not interfere with scrollbar hook
    container.addEventListener('scroll', handleScrollToTop, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScrollToTop);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [containerRef, chatId, chat, prependMessages, messagesWithAvatarVisibility]);
  
  // Restore scroll position after messages are prepended (matches AngularJS scrollPosition.restore())
  // This runs AFTER React re-renders with the new messages
  useEffect(() => {
    if (!shouldRestoreScrollRef.current || !containerRef.current) {
      return;
    }
    
    const container = containerRef.current;
    
    // Wait for DOM to update (matches AngularJS onListRenderComplete -> scrollPosition.restore())
    // Use requestAnimationFrame to ensure DOM has fully updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (container && scrollPositionRef.current.readyFor === 'up') {
          // Restore scroll position (matches AngularJS scrollPosition.restore())
          // Formula: scrollTop = scrollHeight - previousScrollHeightMinusTop
          // When user was at top (scrollTop === 0), previousScrollHeightMinusTop = scrollHeight
          // After prepending, newScrollTop = newScrollHeight - oldScrollHeight
          // This keeps user at the top (where loader is), not jumping to bottom
          const newScrollTop = container.scrollHeight - scrollPositionRef.current.previousScrollHeightMinusTop;
          
          // CRITICAL: Ensure we stay at the top (scrollTop === 0 or very close) when loading messages
          // If the calculation results in a value > 0, clamp it to 0 to stay at top
          const finalScrollTop = Math.max(0, Math.min(newScrollTop, 10)); // Allow small offset for rounding, but stay near top
          container.scrollTop = finalScrollTop;
          
          // Debug: Log scroll restoration (disabled by default)
          // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
          //   console.log('[MessageList] 📜 Scroll position restored after prepend:', {
          //     calculatedScrollTop: newScrollTop,
          //     finalScrollTop,
          //     scrollHeight: container.scrollHeight,
          //     previousScrollHeightMinusTop: scrollPositionRef.current.previousScrollHeightMinusTop,
          //     messageCount: messagesWithAvatarVisibility.length,
          //     expectedPosition: 'top (where loader is)',
          //   });
          // }
          
          // CRITICAL: Force scrollbar recalculation when messages are added
          // The MutationObserver in useAutoHidingScrollbar will recalculate, but we need to ensure
          // scrollbar is visible and positioned correctly after content changes
          // Use requestAnimationFrame to ensure DOM is fully updated before recalculating
          // CRITICAL: Only trigger ONE scroll event to prevent blinking
          requestAnimationFrame(() => {
            // Single scroll event trigger - MutationObserver will handle the rest
            container.dispatchEvent(new Event('scroll', { bubbles: true }));
          });
        }
        
        // CRITICAL: Clear loading flags AFTER scroll restoration completes
        // This ensures loading state is reset and next scroll-to-top can trigger another load
        shouldRestoreScrollRef.current = false;
        setLoadingOlderMessages(false);
        isLoadingOlderMessagesRef.current = false;
        
        // CRITICAL: Ensure chat.isLoadingInProgress is reset (matches AngularJS)
        // This allows multiple history loads to work correctly
        if (chat) {
          (chat as any).isLoadingInProgress = false;
        }
      }, 1); // Matches AngularJS setTimeout 1ms
    });
  }, [messagesWithAvatarVisibility.length, containerRef, chat]);
  
  // Auto-scroll logic (matches AngularJS messageReceived and messageSent handlers)
  // CRITICAL: Also ensure scrollbar is visible when messages are added
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    
    // Skip auto-scroll if we're restoring scroll position after prepending
    if (shouldRestoreScrollRef.current) {
      return;
    }
    
    const currentMessageCount = messagesWithAvatarVisibility.length;
    const prevMessageCount = prevMessageCountRef.current;
    const hasNewMessages = currentMessageCount > prevMessageCount;
    
    // Check if last message was sent by current user
    const lastMessage = messagesWithAvatarVisibility[messagesWithAvatarVisibility.length - 1];
    const lastMessageIsOwn = lastMessage?.senderId === currentUserId;
    const messageWasJustSent = lastMessageIsOwn && hasNewMessages;
    
    // Update refs BEFORE any async operations to prevent race conditions
    prevMessageCountRef.current = currentMessageCount;
    lastMessageWasSentRef.current = messageWasJustSent;
    
    // CRITICAL: Only trigger scrollbar recalculation if we actually have new messages
    // This prevents unnecessary re-renders and blinking
    if (!hasNewMessages) {
      return;
    }
    
    // CRITICAL: Debounce scrollbar recalculation to prevent blinking
    // Use a single requestAnimationFrame instead of multiple events
    requestAnimationFrame(() => {
      if (containerRef.current && messagesWithAvatarVisibility.length > 0) {
        // Single scroll event trigger - don't dispatch multiple events
        containerRef.current.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
    });
    
    // On first render: Always scroll to bottom (matches AngularJS initial render)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      // Debug: Log first render scroll (disabled by default)
      // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
      //   console.log('[MessageList] 📜 First render - scrolling to bottom');
      // }
      setTimeout(() => {
        scrollToBottom();
        // Double scroll to ensure we're at bottom (matches AngularJS line 900-902)
        setTimeout(() => {
          scrollToBottom();
        }, 1);
      }, 0);
      return;
    }
    
    // On send: Always scroll to bottom (matches AngularJS messageSent handler)
    if (messageWasJustSent) {
      // Debug: Log message sent scroll (disabled by default)
      // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
      //   console.log('[MessageList] 📜 Message sent - scrolling to bottom');
      // }
      setTimeout(() => {
        scrollToBottom();
        // Double scroll to ensure we're at bottom (matches AngularJS line 900-902)
        setTimeout(() => {
          scrollToBottom();
        }, 1);
      }, 0);
      return;
    }
    
    // On receive: Only scroll if user was already at bottom (matches AngularJS messageReceived line 841-902)
    if (hasNewMessages && !lastMessageIsOwn) {
      const wasAtBottom = checkIsScrolledToBottom();
      // Debug: Log message received scroll (disabled by default)
      // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
      //   console.log('[MessageList] 📜 Message received - wasAtBottom:', wasAtBottom);
      // }
      
      if (wasAtBottom) {
        // User was at bottom - scroll to show new message (matches AngularJS line 898-902)
        setTimeout(() => {
          scrollToBottom();
          // Double scroll to ensure we're at bottom (matches AngularJS line 900-902)
          setTimeout(() => {
            scrollToBottom();
          }, 1);
        }, 0);
      } else {
        // User scrolled up - preserve position (matches AngularJS line 889-891)
        // Show "new message" indicator would go here (matches AngularJS scope.showNewMessageBar)
        // Debug: Log scroll up (disabled by default)
        // if (typeof window !== 'undefined' && (window as any).__DEBUG_SCROLL__) {
        //   console.log('[MessageList] 📜 User scrolled up - preserving scroll position');
        // }
      }
    }
  }, [messagesWithAvatarVisibility, containerRef, scrollToBottom, checkIsScrolledToBottom, currentUserId]);

  if (isLoading) {
    return (
      <div className="messageListContainer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="spinner-container">
          <i className="cnv-circle-spinner-small" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="messageListContainer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#7b8386' }}>
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      id={chatId ? `msgWinId-${chatId}` : `msgWinId-${chatType === 1 ? 'p2p' : 'group'}`}
      className="messageListContainer chatMessageWindow"
      style={{
        // CRITICAL: Matches AngularJS .chatMessageWindow exactly
        // Source: AngularJS styles.less and chatWindow.tpl.html
        position: 'absolute',
        top: 0,
        bottom: 0, // Fill parent container (chatWindowContent handles input spacing)
        left: 0,
        right: 0,
        overflow: 'hidden', // Matches AngularJS overflow: hidden (outer container)
        overflowY: 'scroll', // Matches AngularJS overflow-y: scroll (enables scrolling - scrollbar hidden via CSS)
        overflowX: 'hidden', // Prevent horizontal scroll
        scrollbarWidth: 'none', // Firefox - hide default scrollbar
        msOverflowStyle: 'none', // IE/Edge - hide default scrollbar
        padding: '10px 0px', // Matches AngularJS padding: 10px 0px
        paddingRight: '30px', // Matches AngularJS padding-right: 30px (compensates for hidden scrollbar)
        width: 'calc(100% + 30px)', // Matches AngularJS width: ~'calc(100% + 30px)' (scrollbar compensation)
        height: '100%', // Matches AngularJS height: 100%
        background: '#fff', // Solid white background - CRITICAL for isolation
        backgroundColor: '#fff', // Explicitly set background color
        zIndex: 1, // Ensure messages are above background
        boxSizing: 'border-box', // Ensure padding is included in width
        willChange: 'transform', // Matches AngularJS will-change: transform
        transform: 'translateZ(0)', // Matches AngularJS transform: translateZ(0)
        outline: 'none', // Matches AngularJS outline: none
        // CRITICAL: Ensure scrollbar appears only when content overflows
        // AngularJS uses custom scrollbar (autoHidingScrollBar directive) but native scrollbar is fallback
      }}
    >
      {/* Main loader when loading initial messages (matches AngularJS spinner-container / messageListSpinner) */}
      {/* Matches AngularJS: <div class="spinner-container" bo-show="messageListSpinner" style="margin-top:-10px"><i class="cnv-circle-spinner-small"></i></div> */}
      {isLoading && (
        <div className="spinner-container" style={{ marginTop: '-10px', textAlign: 'center', padding: '20px' }}>
          <i className="cnv-circle-spinner-small" />
        </div>
      )}
      
      {/* Loader for older messages (matches AngularJS items-loading-spinner / loadingOlderMessages) */}
      {/* Matches AngularJS: <div class="items-loading-spinner" bo-if="loadingOlderMessages"><i class="cnv-circle-spinner-small"></i></div> */}
      {/* CRITICAL: Loader must be FIRST in the flow (before messages) to appear at top, not absolutely positioned */}
      {loadingOlderMessages && (
        <div className="items-loading-spinner">
          <i className="cnv-circle-spinner-small" />
        </div>
      )}
      {messagesWithAvatarVisibility.map((message, index) => {
        // Debug: Log last message render (disabled by default)
        // if (index === messagesWithAvatarVisibility.length - 1 && typeof window !== 'undefined' && (window as any).__DEBUG_MESSAGES__) {
        //   console.log('[MessageList] 🎨 Rendering LAST message:', {
        //     index,
        //     messageId: message.messageId,
        //     messageText: message.messageText?.substring(0, 20),
        //     sequenceNumber: message.sequenceNumber,
        //     isRetrying: message.isRetrying,
        //   });
        // }
        // Determine if this is the current user's message
        // Check _view.thisUserWithoutImg first (matches AngularJS), then fall back to senderId comparison
        const isOwnMessage = message._view?.thisUserWithoutImg === 1 
          || message._view?.thisUserWithImg === 1
          || message.senderId === currentUserId;
        
        // Avatar visibility - Use _view.otherUserWithImg (already calculated above)
        // Matches AngularJS: message._view.otherUserWithImg == 1 && !message.fileInfo.fileId && !message.isDeleted
        const showAvatar = !isOwnMessage && 
          message._view?.otherUserWithImg === 1 && 
          !message.fileInfo?.fileId && 
          !message.isDeleted;
        
        
        // Sender name visibility - Matches AngularJS (only for group chats when avatar is shown)
        const showSenderName = chatType === 2 && showAvatar && message._view?._user;
        
        // Get previous message for date separator calculation
        const prevMessage = index > 0 ? messagesWithAvatarVisibility[index - 1] : null;
        
        // Calculate date separator - Matches AngularJS messageListTempCalculator.js computeDateForMessage()
        // Use _view.showDate if available (pre-computed), otherwise calculate
        let showDate = false;
        let dateToShow = '';
        
        if (message._view?.showDate !== undefined) {
          showDate = message._view.showDate;
          dateToShow = message._view.dateToShow || '';
        } else if (!message.isSystemMessage && message.type !== 'system') {
          if (!prevMessage) {
            // First message always shows date
            showDate = true;
          } else if (isDayDiff(message.timestamp, prevMessage.timestamp)) {
            // Different day - show date
            showDate = true;
          }
          
          if (showDate) {
            dateToShow = dateSeparatorFromCurrentTime(message.timestamp, true);
          }
        }

        return (
          <MessageBubble
            key={message.messageId}
            message={message}
            isOwnMessage={isOwnMessage}
            showAvatar={showAvatar}
            showSenderName={showSenderName}
            showDate={showDate}
            dateToShow={dateToShow}
          />
        );
      })}
    </div>
  );
}




