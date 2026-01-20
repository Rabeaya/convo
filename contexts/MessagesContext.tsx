'use client';

/**
 * MessagesContext - Global message store with multi-tab synchronization and localStorage persistence
 * 
 * Replicates AngularJS global message storage, multi-tab sync, and messagesDiskManager:
 * - Stores messages per chatId globally
 * - BroadcastChannel for multi-tab sync
 * - localStorage events as fallback
 * - Persists failed/optimistic messages to localStorage (matches messagesDiskManager)
 * - Loads persisted messages on initialization
 * - Updates trigger re-renders in all ChatWindows
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import type { ChatMessage } from '@/types/message';
import { xmppChatService } from '@/utils/xmppChatService';

// Message store state: chatId -> messages[]
interface MessagesState {
  [chatId: string]: ChatMessage[];
}

interface MessagesContextType {
  messages: MessagesState;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  setMessages: (chatId: string, messages: ChatMessage[]) => void;
  mergeMessages: (chatId: string, newMessages: ChatMessage[]) => void;
  prependMessages: (chatId: string, olderMessages: ChatMessage[]) => void; // Prepend older messages (for load older messages)
  getMessages: (chatId: string) => ChatMessage[];
  processFailedMessages: (chatId: string, historyMessages: ChatMessage[], existingMessages?: ChatMessage[], maxSequenceNumber?: number) => ChatMessage[];
  getFailedMessages: (chatId: string) => ChatMessage[];
  loadMessagesFromLocalStore: (chatId: string) => ChatMessage[];
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

// Action types
type MessagesAction =
  | { type: 'ADD_MESSAGE'; chatId: string; message: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; chatId: string; messageId: string; updates: Partial<ChatMessage> }
  | { type: 'REMOVE_MESSAGE'; chatId: string; messageId: string } // Remove message (matches AngularJS chat.cancelMessage)
  | { type: 'SET_MESSAGES'; chatId: string; messages: ChatMessage[] }
  | { type: 'MERGE_MESSAGES'; chatId: string; messages: ChatMessage[] }
  | { type: 'PREPEND_MESSAGES'; chatId: string; messages: ChatMessage[] } // Prepend older messages (matches AngularJS chat.prependMessages)
  | { type: 'SYNC_FROM_STORAGE'; chatId: string; messages: ChatMessage[] };

// Reducer for message state management
function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case 'ADD_MESSAGE': {
      const { chatId, message } = action;
      console.log('[MessagesContext] 🔄 Reducer ADD_MESSAGE:', {
        messageId: message.messageId,
        chatId,
        sequenceNumber: message.sequenceNumber,
        existingCount: state[chatId]?.length || 0,
      });
      const existing = state[chatId] || [];
      
      // Check for duplicates by messageId (matches AngularJS chat.appendMessages)
      // CRITICAL: Server echoes back sent messages with same messageId but sequenceNumber > 0
      // This is how we match server ACK to optimistic message
      let existingIndex = existing.findIndex(m => m.messageId === message.messageId);
      let existingMessage = existingIndex >= 0 ? existing[existingIndex] : null;
      let messageToProcess = message; // Use a mutable variable for message processing
      
      console.log('[MessagesContext] 🔍 Matching server ACK:', {
        incomingMessageId: message.messageId,
        incomingSequenceNumber: message.sequenceNumber,
        incomingSenderId: message.senderId,
        incomingHasFileInfo: !!message.fileInfo,
        incomingFileId: message.fileInfo?.fileId,
        existingMessageFound: !!existingMessage,
        existingMessageId: existingMessage?.messageId,
        existingSequenceNumber: existingMessage?.sequenceNumber,
        existingIsRetrying: existingMessage?.isRetrying,
        existingHasFileInfo: !!existingMessage?.fileInfo,
        existingFileId: existingMessage?.fileInfo?.fileId,
        totalMessages: existing.length,
        // CRITICAL: Check if there are any optimistic messages with fileInfo
        optimisticMessagesWithFileInfo: existing.filter(m => 
          m.sequenceNumber === 0 && 
          m.fileInfo && 
          !m.fileInfo.fileId
        ).map(m => ({
          messageId: m.messageId,
          senderId: m.senderId,
          hasFileInfo: !!m.fileInfo,
          fileId: m.fileInfo?.fileId,
        })),
      });
      
      // FALLBACK: If messageId doesn't match but this is a server ACK (sequenceNumber > 0, isOwnMessage),
      // try to match optimistic message by senderId, chatId, timestamp, and optionally messageText
      // CRITICAL: ACK messages (recipient_ack) have empty messageText, so we can't match by text
      // This handles cases where server might generate a new messageId for the echo
      // CRITICAL: Only match if this is our own message (server ACK), not received messages from others
      if (!existingMessage && message.sequenceNumber > 0) {
        const getCurrentUserId = () => {
          if (typeof window !== 'undefined') {
            const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
            return sessionData?.user?.user_id || '';
          }
          return '';
        };
        const currentUserId = getCurrentUserId();
        const isOwnMessage = message.senderId === currentUserId;
        
        // CRITICAL: Only match optimistic messages for our own messages (server ACKs)
        // Received messages from others should never match optimistic messages
        if (isOwnMessage) {
          console.log('[MessagesContext] 🔍 Fallback matching: Looking for optimistic message for server ACK:', {
            messageId: message.messageId,
            senderId: message.senderId,
            currentUserId,
            sequenceNumber: message.sequenceNumber,
          });
          // Find optimistic message that might match this server ACK
          // Match by: same sender, same chat, optimistic (seq 0), timestamp within 10 seconds
          // CRITICAL: If server ACK has empty messageText (recipient_ack), skip text matching
          // Otherwise, match by text as well
          const hasMessageText = message.messageText && message.messageText.trim().length > 0;
          
          const optimisticMatch = existing.findIndex(m => {
            const senderMatch = m.senderId === message.senderId;
            const sequenceMatch = m.sequenceNumber === 0;
            const retryingMatch = m.isRetrying === true || m.isRetrying === undefined;
            const timestampDiff = Math.abs(m.timestamp - message.timestamp);
            const timestampMatch = timestampDiff < 10000; // Within 10 seconds
            const textMatch = hasMessageText 
              ? m.messageText.trim() === message.messageText.trim() 
              : true; // If ACK has no text, skip text matching
            
            // CRITICAL: For file messages, also match by fileInfo (fileId, name, fileUploadName)
            // This handles cases where server ACK has different messageId but same file
            // CRITICAL: Match if:
            // 1. Both have no fileInfo (text-only messages)
            // 2. Optimistic has fileInfo and server ACK has fileInfo with matching fileId/name/fileUploadName
            // 3. Optimistic has fileInfo but server ACK doesn't (server ACK might not include fileInfo initially)
            //    - This is critical for GIF uploads where server ACK arrives before fileInfo is set
            const optimisticHasFileInfo = !!m.fileInfo;
            const serverHasFileInfo = !!message.fileInfo;
            const bothHaveNoFileInfo = !optimisticHasFileInfo && !serverHasFileInfo;
            const bothHaveFileInfo = optimisticHasFileInfo && serverHasFileInfo;
            const optimisticHasFileInfoButServerDoesnt = optimisticHasFileInfo && !serverHasFileInfo;
            
            let fileMatch = false;
            if (bothHaveNoFileInfo) {
              // Both have no fileInfo - this is a text-only message
              fileMatch = true;
            } else if (bothHaveFileInfo && m.fileInfo && message.fileInfo) {
              // Both have fileInfo - match by fileId, name, or fileUploadName
              fileMatch = (m.fileInfo.fileId && message.fileInfo.fileId && m.fileInfo.fileId === message.fileInfo.fileId) || // Same fileId
                         (m.fileInfo.name && message.fileInfo.name && m.fileInfo.name === message.fileInfo.name) || // Same fileName
                         ((m as any).fileUploadName && (message as any).fileUploadName && (m as any).fileUploadName === (message as any).fileUploadName); // Same fileUploadName
            } else if (optimisticHasFileInfoButServerDoesnt && m.fileInfo) {
              // CRITICAL: Optimistic has fileInfo but server ACK doesn't - still match!
              // This handles the case where server ACK arrives before fileInfo is set or server ACK doesn't include fileInfo
              // We match by timestamp and sender - if they're close enough, it's the same message
              fileMatch = true; // Match if optimistic has fileInfo (even if server ACK doesn't)
              console.log('[MessagesContext] 🔍 File match: Optimistic has fileInfo but server ACK doesn\'t - matching anyway:', {
                optimisticMessageId: m.messageId,
                optimisticFileId: m.fileInfo?.fileId,
                optimisticFileUploadName: (m as any).fileUploadName,
                serverACKMessageId: message.messageId,
                timestampDiff: Math.abs(m.timestamp - message.timestamp),
              });
            }
            
            // CRITICAL: For file messages, fileMatch can replace textMatch
            // This handles GIF messages where text is empty but fileInfo matches (or optimistic has fileInfo)
            const matches = senderMatch && sequenceMatch && retryingMatch && timestampMatch && (textMatch || fileMatch);
            
            if (matches) {
              console.log('[MessagesContext] 🎯 Fallback match found:', {
                optimisticMessageId: m.messageId,
                optimisticSequenceNumber: m.sequenceNumber,
                optimisticIsRetrying: m.isRetrying,
                optimisticTimestamp: m.timestamp,
                serverACKTimestamp: message.timestamp,
                timestampDiff,
                senderMatch,
                sequenceMatch,
                retryingMatch,
                timestampMatch,
                textMatch,
                fileMatch,
                optimisticFileId: m.fileInfo?.fileId,
                serverACKFileId: message.fileInfo?.fileId,
                optimisticFileUploadName: (m as any).fileUploadName,
                serverACKFileUploadName: (message as any).fileUploadName,
              });
            }
            
            return matches;
          });
          
          if (optimisticMatch >= 0) {
            const matchedMessage = existing[optimisticMatch];
            existingIndex = optimisticMatch;
            existingMessage = matchedMessage;
            console.log('[MessagesContext] ✅ Fallback match applied:', {
              matchedMessageId: matchedMessage.messageId,
              newMessageId: message.messageId,
              finalMessageId: existingMessage.messageId,
            });
            // CRITICAL: When fallback match is found, preserve fileInfo from server ACK if it has fileId
            // Server ACK fileInfo is authoritative (has correct fileId from server)
            const serverACKHasFileInfo = !!message.fileInfo;
            const serverACKHasFileId = !!message.fileInfo?.fileId;
            
            messageToProcess = { 
              ...message, 
              messageId: existingMessage.messageId,
              messageText: hasMessageText ? message.messageText : existingMessage.messageText,
              // CRITICAL: Preserve isRetrying = false from server ACK (not from optimistic message)
              isRetrying: false,
              // CRITICAL: Preserve fileInfo - prioritize server ACK fileInfo if it has fileId (authoritative)
              // Otherwise, use optimistic fileInfo if server ACK doesn't have it
              fileInfo: (serverACKHasFileInfo && serverACKHasFileId) 
                ? message.fileInfo  // Server ACK has fileInfo with fileId - use it (authoritative)
                : (message.fileInfo || existingMessage.fileInfo), // Fallback to optimistic if server ACK doesn't have it
              // CRITICAL: Preserve custom properties from optimistic message
              ...((existingMessage as any).gifUrl ? { gifUrl: (existingMessage as any).gifUrl } : {}),
              ...((existingMessage as any).fileUploadName ? { fileUploadName: (existingMessage as any).fileUploadName } : {}),
            };
            
            console.log('[MessagesContext] 🔍 Fallback match - messageToProcess fileInfo:', {
              serverACKHasFileInfo,
              serverACKHasFileId,
              serverACKFileId: message.fileInfo?.fileId,
              optimisticFileId: existingMessage.fileInfo?.fileId,
              finalFileInfo: messageToProcess.fileInfo,
              finalFileId: messageToProcess.fileInfo?.fileId,
            });
          } else {
            console.log('[MessagesContext] ❌ No fallback match found for server ACK:', {
              serverACKMessageId: message.messageId,
              serverACKSequenceNumber: message.sequenceNumber,
              serverACKSenderId: message.senderId,
              serverACKTimestamp: message.timestamp,
              serverACKMessageText: message.messageText.substring(0, 50),
              optimisticMessages: existing.filter(m => m.sequenceNumber === 0 && m.senderId === message.senderId).map(m => ({
                messageId: m.messageId,
                sequenceNumber: m.sequenceNumber,
                isRetrying: m.isRetrying,
                timestamp: m.timestamp,
                timestampDiff: Math.abs(m.timestamp - message.timestamp),
                messageText: m.messageText.substring(0, 50),
              })),
            });
          }
        }
      }
      
      if (existingIndex >= 0 && existingMessage) {
        // CRITICAL: If existing message doesn't have fileInfo, try to find optimistic message that does
        // This handles the case where server ACK matches wrong message (old message without fileInfo)
        // The optimistic message with fileInfo might be a different messageId (server ACK changed it)
        // CRITICAL: Also check if incoming message doesn't have fileInfo (server ACK removed it)
        if ((!existingMessage.fileInfo || !messageToProcess.fileInfo)) {
          console.log('[MessagesContext] 🔍 Searching for optimistic message with fileInfo:', {
            existingMessageId: existingMessage.messageId,
            existingSequenceNumber: existingMessage.sequenceNumber,
            existingHasFileInfo: !!existingMessage.fileInfo,
            incomingMessageId: messageToProcess.messageId,
            incomingSequenceNumber: messageToProcess.sequenceNumber,
            incomingHasFileInfo: !!messageToProcess.fileInfo,
          });
          
          // Find most recent message from same sender with fileInfo but no fileId (uploading state)
          const getCurrentUserId = () => {
            if (typeof window !== 'undefined') {
              const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
              return sessionData?.user?.user_id || '';
            }
            return '';
          };
          const currentUserId = getCurrentUserId();
          const isOwnMessage = messageToProcess.senderId === currentUserId;
          
          if (isOwnMessage) {
            // CRITICAL: Find optimistic message (sequenceNumber 0) with fileInfo
            // Also check if messageId matches (server ACK might have same messageId)
            let optimisticMessageWithFileInfo = existing.find(m => 
              m.messageId === messageToProcess.messageId &&
              m.fileInfo &&
              !m.fileInfo.fileId // Must be uploading (no fileId yet)
            );
            
            // If not found by messageId, try sequenceNumber 0
            if (!optimisticMessageWithFileInfo) {
              optimisticMessageWithFileInfo = existing.find(m => 
                m.senderId === messageToProcess.senderId &&
                m.sequenceNumber === 0 &&
                m.fileInfo &&
                !m.fileInfo.fileId // Must be uploading (no fileId yet)
              );
            }
            
            // CRITICAL: If still not found, try ANY message from same sender with fileInfo but no fileId (most recent)
            if (!optimisticMessageWithFileInfo) {
              const messagesWithFileInfo = existing
                .filter(m => 
                  m.senderId === messageToProcess.senderId &&
                  m.fileInfo &&
                  !m.fileInfo.fileId // Must be uploading (no fileId yet)
                )
                .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
              
              if (messagesWithFileInfo.length > 0) {
                optimisticMessageWithFileInfo = messagesWithFileInfo[0];
                console.log('[MessagesContext] 🔍 Found optimistic message by most recent (no fileId):', {
                  optimisticMessageId: optimisticMessageWithFileInfo.messageId,
                  timestamp: optimisticMessageWithFileInfo.timestamp,
                });
              }
            }
            
            if (optimisticMessageWithFileInfo) {
              console.log('[MessagesContext] ✅ Found optimistic message with fileInfo:', {
                optimisticMessageId: optimisticMessageWithFileInfo.messageId,
                existingMessageId: existingMessage.messageId,
                hasFileInfo: !!optimisticMessageWithFileInfo.fileInfo,
                fileId: optimisticMessageWithFileInfo.fileInfo?.fileId,
              });
              // CRITICAL: Use the optimistic message's fileInfo
              // If messageId matches, replace existingMessage entirely
              // Otherwise, just use its fileInfo
              if (optimisticMessageWithFileInfo.messageId === existingMessage.messageId) {
                existingMessage = optimisticMessageWithFileInfo;
              } else {
                // Use optimistic message's fileInfo but keep existing message's other properties
                existingMessage = {
                  ...existingMessage,
                  fileInfo: optimisticMessageWithFileInfo.fileInfo,
                };
              }
              if (existingMessage) {
                const messageIdToFind = existingMessage.messageId;
                existingIndex = existing.findIndex(m => m.messageId === messageIdToFind);
              }
            } else {
              console.warn('[MessagesContext] ⚠️ No optimistic message with fileInfo found!', {
                existingMessageId: existingMessage?.messageId,
                incomingMessageId: messageToProcess.messageId,
                totalMessages: existing.length,
                messagesWithFileInfo: existing.filter(m => m.fileInfo).length,
              });
            }
          }
        }
        
        // CRITICAL: ALWAYS preserve fileInfo from existing message if it exists
        // This handles the case where optimistic message has fileInfo but server ACK doesn't
        // This is the ROOT CAUSE FIX - server ACK removes fileInfo, so we must preserve it
        if (existingMessage.fileInfo && !messageToProcess.fileInfo) {
          console.log('[MessagesContext] 🔒 ROOT CAUSE FIX: Preserving fileInfo from existing message (server ACK has none):', {
            messageId: existingMessage.messageId,
            existingHasFileInfo: !!existingMessage.fileInfo,
            existingFileId: existingMessage.fileInfo?.fileId,
            incomingHasFileInfo: !!messageToProcess.fileInfo,
          });
          messageToProcess = {
            ...messageToProcess,
            fileInfo: existingMessage.fileInfo, // CRITICAL: Preserve fileInfo from existing message
          };
        }
        
        // CRITICAL: Handle both optimistic message replacement (seq 0 -> seq > 0) 
        // AND synthetic ACK replacement (seq > 0 -> seq 1, but preserve fileInfo)
        // Match AngularJS: when server ACK arrives, it finds existing message and updates it
        const isOptimisticReplacement = existingMessage.sequenceNumber === 0 && messageToProcess.sequenceNumber > 0;
        // CRITICAL: Synthetic ACK detection - if incoming message has seq 1 and no fileInfo, 
        // but existing message has fileInfo, preserve it (synthetic ACK doesn't have fileInfo)
        const isSyntheticAck = existingMessage.sequenceNumber > 0 && 
          messageToProcess.sequenceNumber === 1 && 
          !messageToProcess.fileInfo && 
          existingMessage.fileInfo;
        
        // CRITICAL: Also handle case where synthetic ACK has fileInfo but existing message has fileId (from updateMessage)
        // In this case, prefer existing message's fileInfo (it has fileId from updateMessage)
        const shouldPreserveFileInfo = isSyntheticAck || 
          (existingMessage.fileInfo && existingMessage.fileInfo.fileId && 
           (!messageToProcess.fileInfo || !messageToProcess.fileInfo.fileId));
        
        // CRITICAL: ALWAYS preserve fileInfo if existing message has fileId (from updateMessage)
        // This handles ALL cases where server ACK arrives after updateMessage sets fileId
        const existingHasFileId = existingMessage.fileInfo && 
          existingMessage.fileInfo.fileId &&
          existingMessage.fileInfo.fileId !== 'undefined' &&
          existingMessage.fileInfo.fileId !== 'null' &&
          String(existingMessage.fileInfo.fileId).trim() !== '';
        
        // CRITICAL: Also check if existing message has fileInfo (even without fileId yet)
        // This handles the case where optimistic message has fileInfo but server ACK doesn't
        const existingHasFileInfo = !!existingMessage.fileInfo;
        const incomingHasFileInfo = !!messageToProcess.fileInfo;
        
        // CRITICAL: If existing message has fileInfo (with or without fileId), preserve it
        // This ensures fileInfo is never lost when server ACK arrives
        if (existingHasFileInfo && (!incomingHasFileInfo || existingHasFileId)) {
          console.log('[MessagesContext] 🔒 CRITICAL: Existing message has fileInfo, preserving it:', {
            messageId: existingMessage.messageId,
            existingHasFileInfo,
            existingHasFileId,
            existingFileId: existingMessage.fileInfo?.fileId,
            incomingHasFileInfo,
            incomingFileId: messageToProcess.fileInfo?.fileId,
          });
          // CRITICAL: Set fileInfo on messageToProcess BEFORE any other processing
          messageToProcess = {
            ...messageToProcess,
            fileInfo: existingMessage.fileInfo, // CRITICAL: Preserve fileInfo (with or without fileId)
          };
        }
        
        // CRITICAL: ALWAYS run replacement logic if existing message has fileInfo and incoming doesn't
        // This ensures fileInfo is never lost when server ACK arrives
        const shouldRunReplacement = isOptimisticReplacement || 
          isSyntheticAck || 
          shouldPreserveFileInfo || 
          existingHasFileId ||
          (existingHasFileInfo && !incomingHasFileInfo); // CRITICAL: If existing has fileInfo but incoming doesn't, preserve it
        
        if (shouldRunReplacement) {
          // CRITICAL: Replace optimistic message with server ACK
          // This changes the message from light blue (sending) to normal blue (sent)
          // CRITICAL: Preserve messageText from optimistic message if server ACK has empty text (recipient_ack)
          const hasServerMessageText = messageToProcess.messageText && messageToProcess.messageText.trim().length > 0;
          const preservedMessageText = hasServerMessageText 
            ? messageToProcess.messageText 
            : existingMessage.messageText; // Use optimistic message text if server ACK has no text
          
          // CRITICAL: Check if this is a recipient_ack (which doesn't have fileInfo)
          // For recipient_ack messages, we MUST preserve fileInfo from optimistic message
          const isRecipientAck = !messageToProcess.fileInfo && 
            (!hasServerMessageText || messageToProcess.messageText.trim().length === 0);
          
          // CRITICAL: Log fileInfo BEFORE any processing to see what we have
          console.log('[MessagesContext] 🔍 Server ACK replacement - Initial fileInfo check:', {
            optimisticMessageId: existingMessage.messageId,
            serverACKMessageId: messageToProcess.messageId,
            optimisticFileInfo: existingMessage.fileInfo,
            optimisticFileId: existingMessage.fileInfo?.fileId,
            serverACKFileInfo: messageToProcess.fileInfo,
            serverACKFileId: messageToProcess.fileInfo?.fileId,
            rawMessageFileInfo: (message as any).fileInfo,
            rawMessageFileId: (message as any).fileInfo?.fileId,
            isRecipientAck,
            hasServerMessageText,
            messageToProcessKeys: Object.keys(messageToProcess),
            messageKeys: Object.keys(message),
            // CRITICAL: Check if optimistic message has fileInfo (this is what we MUST preserve)
            optimisticHasFileInfo: !!existingMessage.fileInfo,
            optimisticHasFileId: !!existingMessage.fileInfo?.fileId,
          });
          
          // CRITICAL: If this is a recipient_ack or server ACK doesn't have fileInfo, 
          // we MUST preserve fileInfo from optimistic message (it has fileId from updateMessage)
          if (isRecipientAck || !messageToProcess.fileInfo) {
            if (existingMessage.fileInfo) {
              console.log('[MessagesContext] 🔒 CRITICAL: Server ACK has no fileInfo (recipient_ack or missing), preserving from optimistic message:', {
                isRecipientAck,
                optimisticFileId: existingMessage.fileInfo?.fileId,
                optimisticFileInfo: existingMessage.fileInfo,
                serverACKFileInfo: messageToProcess.fileInfo,
              });
              // CRITICAL: Set fileInfo on messageToProcess BEFORE any other processing
              // This ensures fileInfo is preserved throughout the replacement logic
              messageToProcess = {
                ...messageToProcess,
                fileInfo: existingMessage.fileInfo, // CRITICAL: Preserve optimistic fileInfo
              };
            }
          }
          
          // CRITICAL: ALWAYS preserve fileInfo from optimistic message if it exists
          // The server ACK might not have fileInfo, but the optimistic message does (especially after updateMessage)
          // This is critical for GIF uploads where we update the message with fileId before the server ACK arrives
          // CRITICAL: If optimistic message has fileInfo with fileId, ALWAYS preserve it (even if server ACK has fileInfo without fileId)
          if (existingMessage.fileInfo) {
            if (!messageToProcess.fileInfo) {
              console.log('[MessagesContext] 🔒 CRITICAL: Server ACK has no fileInfo, preserving from optimistic message:', {
                optimisticMessageId: existingMessage.messageId,
                serverACKMessageId: messageToProcess.messageId,
                optimisticFileId: existingMessage.fileInfo?.fileId,
                optimisticFileInfo: existingMessage.fileInfo,
              });
            } else if (existingMessage.fileInfo.fileId && !messageToProcess.fileInfo.fileId) {
              // CRITICAL: Optimistic message has fileId but server ACK doesn't - preserve optimistic fileInfo
              console.log('[MessagesContext] 🔒 CRITICAL: Server ACK has fileInfo but no fileId, preserving optimistic fileInfo with fileId:', {
                optimisticMessageId: existingMessage.messageId,
                serverACKMessageId: messageToProcess.messageId,
                optimisticFileId: existingMessage.fileInfo?.fileId,
                serverACKFileId: messageToProcess.fileInfo?.fileId,
                optimisticFileInfo: existingMessage.fileInfo,
                serverACKFileInfo: messageToProcess.fileInfo,
              });
            }
          }
          
          // CRITICAL: Log BEFORE preservation to see what we're working with
          console.log('[MessagesContext] 🔍 BEFORE preservation - Checking fileInfo:', {
            optimisticMessageId: existingMessage.messageId,
            serverACKMessageId: messageToProcess.messageId,
            optimisticFileInfo: existingMessage.fileInfo,
            optimisticFileId: existingMessage.fileInfo?.fileId,
            serverACKFileInfo: messageToProcess.fileInfo,
            serverACKFileId: messageToProcess.fileInfo?.fileId,
            serverACKFileIdType: typeof messageToProcess.fileInfo?.fileId,
            serverACKFileIdString: String(messageToProcess.fileInfo?.fileId || ''),
            optimisticHasFileInfo: !!existingMessage.fileInfo,
            serverACKHasFileInfo: !!messageToProcess.fileInfo,
            // CRITICAL: Log the raw message to see if fileInfo is present
            rawMessageFileInfo: (message as any).fileInfo,
            rawMessageFileId: (message as any).fileInfo?.fileId,
            messageToProcessKeys: Object.keys(messageToProcess),
            messageKeys: Object.keys(message),
          });
          
          // CRITICAL: Preserve fileInfo from existing message (optimistic message has fileInfo, server ACK might not)
          // CRITICAL: If server ACK has fileInfo with fileId, use it; otherwise preserve optimistic fileInfo
          // This ensures fileId is not lost when server ACK replaces optimistic message
          // CRITICAL: Always prioritize optimistic fileInfo if server ACK doesn't have valid fileInfo
          const serverHasValidFileInfo = messageToProcess.fileInfo && 
            messageToProcess.fileInfo.fileId && 
            messageToProcess.fileInfo.fileId !== 'undefined' && 
            messageToProcess.fileInfo.fileId !== 'null' &&
            String(messageToProcess.fileInfo.fileId).trim() !== '';
          
          // CRITICAL: If optimistic message has fileInfo with fileId, ALWAYS use it (even if server ACK has fileInfo without fileId)
          // This handles the case where updateMessage sets fileId, but then server ACK arrives and replaces the message
          const optimisticHasFileId = existingMessage.fileInfo && 
            existingMessage.fileInfo.fileId && 
            existingMessage.fileInfo.fileId !== 'undefined' && 
            existingMessage.fileInfo.fileId !== 'null' &&
            String(existingMessage.fileInfo.fileId).trim() !== '';
          
          // CRITICAL: ALWAYS preserve optimistic fileInfo if it exists, regardless of server ACK
          // This ensures that if updateMessage sets fileId, it's preserved even if server ACK arrives later
          // Priority: optimistic fileInfo with fileId > server ACK fileInfo with fileId > optimistic fileInfo > server ACK fileInfo
          let preservedFileInfo: ChatMessage['fileInfo'] | undefined;
          if (optimisticHasFileId) {
            // CRITICAL: Optimistic message has fileId (from updateMessage), ALWAYS use it
            preservedFileInfo = existingMessage.fileInfo;
            console.log('[MessagesContext] 🔒 Using optimistic fileInfo with fileId (highest priority):', {
              optimisticFileId: existingMessage.fileInfo?.fileId,
              serverACKFileId: messageToProcess.fileInfo?.fileId,
            });
          } else if (serverHasValidFileInfo && messageToProcess.fileInfo) {
            // Server ACK has valid fileId, use it (but merge with optimistic fileInfo to preserve other fields)
            // CRITICAL: Ensure fileId is preserved from server ACK
            preservedFileInfo = {
              ...(existingMessage.fileInfo || {}), // Preserve optimistic fileInfo fields (if any)
              ...messageToProcess.fileInfo, // Override with server ACK fileInfo (has fileId)
              // CRITICAL: Explicitly set fileId to ensure it's not lost
              fileId: messageToProcess.fileInfo.fileId,
            };
            console.log('[MessagesContext] 🔒 Using server ACK fileInfo with fileId (merged with optimistic):', {
              optimisticFileId: existingMessage.fileInfo?.fileId,
              serverACKFileId: messageToProcess.fileInfo?.fileId,
              preservedFileId: preservedFileInfo?.fileId,
              preservedFileInfo: preservedFileInfo,
            });
          } else if (messageToProcess.fileInfo) {
            // CRITICAL: Server ACK has fileInfo (even without valid fileId), use it
            // This handles cases where server ACK has fileInfo but fileId validation failed
            preservedFileInfo = messageToProcess.fileInfo;
            console.log('[MessagesContext] 🔒 Using server ACK fileInfo (has fileInfo but fileId validation failed or optimistic has fileId):', {
              serverACKFileId: messageToProcess.fileInfo?.fileId,
              serverACKFileInfo: messageToProcess.fileInfo,
              preservedFileId: preservedFileInfo?.fileId,
              optimisticHasFileId,
              serverHasValidFileInfo,
            });
          } else if (existingMessage.fileInfo) {
            // Optimistic message has fileInfo (even without fileId), preserve it
            preservedFileInfo = existingMessage.fileInfo;
            console.log('[MessagesContext] 🔒 Using optimistic fileInfo (no fileId yet, but has fileInfo):', {
              optimisticFileId: existingMessage.fileInfo?.fileId,
              serverACKFileInfo: messageToProcess.fileInfo,
            });
          } else {
            // Fallback to server ACK fileInfo (might be null/undefined)
            preservedFileInfo = messageToProcess.fileInfo;
            console.log('[MessagesContext] 🔒 Using server ACK fileInfo (fallback):', {
              serverACKFileInfo: messageToProcess.fileInfo,
            });
          }
          
          // CRITICAL: Log if we're preserving optimistic fileInfo (this should happen when server ACK doesn't have fileInfo)
          if (!serverHasValidFileInfo && existingMessage.fileInfo) {
            console.log('[MessagesContext] 🔒 Preserving optimistic fileInfo (server ACK has no valid fileInfo):', {
              optimisticFileId: existingMessage.fileInfo?.fileId,
              serverACKFileInfo: messageToProcess.fileInfo,
              preservedFileId: preservedFileInfo?.fileId,
            });
          }
          
          console.log('[MessagesContext] ✅ Replacing optimistic message with server ACK:', {
            optimisticMessageId: existingMessage.messageId,
            optimisticSequenceNumber: existingMessage.sequenceNumber,
            optimisticIsRetrying: existingMessage.isRetrying,
            serverACKSequenceNumber: messageToProcess.sequenceNumber,
            serverACKIsRetrying: messageToProcess.isRetrying,
            preservedMessageText: preservedMessageText.substring(0, 50),
            optimisticFileInfo: existingMessage.fileInfo,
            optimisticFileId: existingMessage.fileInfo?.fileId,
            optimisticFileUploadName: (existingMessage as any).fileUploadName,
            optimisticGifUrl: (existingMessage as any).gifUrl,
            serverACKFileInfo: messageToProcess.fileInfo,
            serverACKFileId: messageToProcess.fileInfo?.fileId,
            serverACKFileUploadName: (messageToProcess as any).fileUploadName,
            preservedFileInfo: preservedFileInfo,
            preservedFileId: preservedFileInfo?.fileId,
          });
          
          // CRITICAL: Match AngularJS EXACTLY - AngularJS line 2037-2044 shows that when server ACK arrives,
          // it finds the existing message and updates it, but the fileInfo is preserved from the existing message
          // However, if the server ACK has fileInfo (which it does for file messages), we should use it
          // CRITICAL: The server ACK XML ALWAYS has fileInfo with fileId for file messages, so we MUST use it
          // This is the authoritative source - the server knows the correct fileId
          
          // CRITICAL: Check if raw message (before messageToProcess) has fileInfo
          // This is important because messageToProcess might have been modified in fallback matching
          const rawMessageFileInfo = (message as any).fileInfo;
          const rawMessageHasFileId = rawMessageFileInfo && rawMessageFileInfo.fileId;
          
          console.log('[MessagesContext] 🔍 Checking fileInfo sources:', {
            rawMessageFileInfo: rawMessageFileInfo ? { fileId: rawMessageFileInfo.fileId } : null,
            rawMessageHasFileId,
            messageToProcessFileInfo: messageToProcess.fileInfo ? { fileId: messageToProcess.fileInfo.fileId } : null,
            messageToProcessHasFileId: !!messageToProcess.fileInfo?.fileId,
            optimisticFileInfo: existingMessage.fileInfo ? { fileId: existingMessage.fileInfo.fileId } : null,
            optimisticHasFileId: !!existingMessage.fileInfo?.fileId,
          });
          
          // CRITICAL: Priority order (matches AngularJS behavior):
          // 1. Server ACK fileInfo with fileId (authoritative - server knows the correct fileId)
          // 2. Optimistic fileInfo with fileId (from updateMessage - more recent than server ACK parsing)
          // 3. Server ACK fileInfo without fileId (fallback)
          // 4. Optimistic fileInfo without fileId (fallback)
          let finalFileInfo: ChatMessage['fileInfo'] | undefined;
          
          // CRITICAL: Use raw message fileInfo if it has fileId (it's the authoritative source from server)
          if (rawMessageFileInfo && rawMessageFileInfo.fileId) {
            finalFileInfo = {
              ...(existingMessage.fileInfo || {}), // Preserve optimistic fileInfo fields (if any)
              ...rawMessageFileInfo, // Override with server ACK fileInfo (has fileId from server XML)
              fileId: rawMessageFileInfo.fileId, // Explicitly set fileId from server
            };
            console.log('[MessagesContext] 🔒 Final fileInfo: Using RAW server ACK fileInfo with fileId (authoritative from XML):', {
              rawServerACKFileId: rawMessageFileInfo.fileId,
              finalFileId: finalFileInfo?.fileId,
            });
          } else if (messageToProcess.fileInfo && messageToProcess.fileInfo.fileId) {
            // Fallback: Use messageToProcess fileInfo if raw message doesn't have it
            finalFileInfo = {
              ...(existingMessage.fileInfo || {}), // Preserve optimistic fileInfo fields (if any)
              ...messageToProcess.fileInfo, // Override with server ACK fileInfo (has fileId)
              fileId: messageToProcess.fileInfo.fileId, // Explicitly set fileId
            };
            console.log('[MessagesContext] 🔒 Final fileInfo: Using messageToProcess fileInfo with fileId:', {
              serverACKFileId: messageToProcess.fileInfo.fileId,
              finalFileId: finalFileInfo.fileId,
            });
          } else if (optimisticHasFileId) {
            // Fallback: Use optimistic fileInfo if server ACK doesn't have fileId
            finalFileInfo = existingMessage.fileInfo;
            console.log('[MessagesContext] 🔒 Final fileInfo: Using optimistic fileInfo with fileId (server ACK has no fileId):', {
              optimisticFileId: existingMessage.fileInfo?.fileId,
            });
          } else {
            // Last resort: Use preservedFileInfo or any available fileInfo
            finalFileInfo = preservedFileInfo || messageToProcess.fileInfo || existingMessage.fileInfo;
            console.log('[MessagesContext] 🔒 Final fileInfo: Using last resort fallback:', {
              preservedFileInfo: preservedFileInfo ? { fileId: preservedFileInfo.fileId } : null,
              serverACKFileInfo: messageToProcess.fileInfo ? { fileId: messageToProcess.fileInfo.fileId } : null,
              optimisticFileInfo: existingMessage.fileInfo ? { fileId: existingMessage.fileInfo.fileId } : null,
              finalFileInfo: finalFileInfo ? { fileId: finalFileInfo.fileId } : null,
            });
          }
          
          // CRITICAL: Ensure finalFileInfo is always set (never undefined)
          // This prevents fileInfo from being lost
          const ensuredFinalFileInfo: ChatMessage['fileInfo'] | undefined = finalFileInfo || 
            rawMessageFileInfo || 
            messageToProcess.fileInfo || 
            existingMessage.fileInfo || 
            preservedFileInfo;
          
          if (!ensuredFinalFileInfo && (rawMessageFileInfo || messageToProcess.fileInfo || existingMessage.fileInfo)) {
            console.error('[MessagesContext] ❌ CRITICAL: finalFileInfo is undefined but fileInfo exists! Using fallback:', {
              rawMessageFileInfo,
              messageToProcessFileInfo: messageToProcess.fileInfo,
              optimisticFileInfo: existingMessage.fileInfo,
              preservedFileInfo,
            });
          }
          
          // CRITICAL: Match AngularJS EXACTLY - AngularJS line 2037-2044 shows that when server ACK arrives,
          // it finds the existing message and updates it, preserving fileInfo from the existing message
          // CRITICAL: If optimistic message has fileInfo, we MUST preserve it (even if server ACK doesn't have it)
          // This is critical because updateMessage sets fileId on the optimistic message BEFORE server ACK arrives
          // CRITICAL: Priority order (matches AngularJS):
          // 1. Optimistic fileInfo (has fileId from updateMessage) - HIGHEST PRIORITY
          // 2. Server ACK fileInfo (has fileId from server XML) - SECOND PRIORITY  
          // 3. Raw message fileInfo (from parsing) - THIRD PRIORITY
          let finalFileInfoToUse: ChatMessage['fileInfo'] | undefined;
          
          // CRITICAL: ALWAYS prioritize optimistic fileInfo if it exists (it has fileId from updateMessage)
          if (existingMessage.fileInfo) {
            // If optimistic has fileId, use it (it's from updateMessage, more recent)
            if (existingMessage.fileInfo.fileId) {
              finalFileInfoToUse = existingMessage.fileInfo;
              console.log('[MessagesContext] 🔒 Using optimistic fileInfo with fileId (HIGHEST PRIORITY):', {
                optimisticFileId: existingMessage.fileInfo.fileId,
              });
            } else if (ensuredFinalFileInfo && ensuredFinalFileInfo.fileId) {
              // Optimistic doesn't have fileId yet, but ensuredFinalFileInfo does - merge them
              finalFileInfoToUse = {
                ...existingMessage.fileInfo, // Preserve optimistic fileInfo fields
                ...ensuredFinalFileInfo, // Override with fileId from server ACK
                fileId: ensuredFinalFileInfo.fileId, // Explicitly set fileId
              };
              console.log('[MessagesContext] 🔒 Merging optimistic fileInfo with server ACK fileId:', {
                optimisticFileInfo: existingMessage.fileInfo,
                serverACKFileId: ensuredFinalFileInfo.fileId,
              });
            } else {
              // Optimistic has fileInfo but no fileId, and server ACK doesn't have fileId either - use optimistic
              finalFileInfoToUse = existingMessage.fileInfo;
              console.log('[MessagesContext] 🔒 Using optimistic fileInfo (no fileId yet):', {
                optimisticFileInfo: existingMessage.fileInfo,
              });
            }
          } else {
            // Optimistic doesn't have fileInfo - use ensuredFinalFileInfo
            finalFileInfoToUse = ensuredFinalFileInfo;
            console.log('[MessagesContext] 🔒 Using ensuredFinalFileInfo (optimistic has no fileInfo):', {
              ensuredFinalFileInfo,
            });
          }
          
          if (!finalFileInfoToUse && existingMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: finalFileInfoToUse is undefined but optimistic message has fileInfo! Using optimistic fileInfo:', {
              optimisticFileInfo: existingMessage.fileInfo,
              ensuredFinalFileInfo,
              rawMessageFileInfo,
              messageToProcessFileInfo: messageToProcess.fileInfo,
            });
            finalFileInfoToUse = existingMessage.fileInfo;
          }
          
          // CRITICAL: Ensure fileInfo is ALWAYS set if existing message has it
          // This is the ROOT CAUSE FIX - if existing message has fileInfo, we MUST preserve it
          const finalFileInfoForMessage = finalFileInfoToUse || 
            existingMessage.fileInfo || 
            messageToProcess.fileInfo ||
            ensuredFinalFileInfo;
          
          if (!finalFileInfoForMessage && existingMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: finalFileInfoForMessage is undefined but existing message has fileInfo! Using existing:', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticFileInfo: existingMessage.fileInfo,
              finalFileInfoToUse,
              ensuredFinalFileInfo,
            });
          }
          
          // CRITICAL: Ensure fileInfo is ALWAYS set - this is the ROOT CAUSE FIX
          // If existing message has fileInfo, we MUST preserve it (even if finalFileInfoForMessage is undefined)
          const finalFileInfoToSet = finalFileInfoForMessage || existingMessage.fileInfo || messageToProcess.fileInfo;
          
          if (!finalFileInfoToSet && existingMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: finalFileInfoToSet is undefined but existing message has fileInfo! Using existing:', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticFileInfo: existingMessage.fileInfo,
              finalFileInfoForMessage,
              finalFileInfoToUse,
            });
          }
          
          const updatedMessage: ChatMessage = {
            ...messageToProcess,
            messageText: preservedMessageText, // CRITICAL: Preserve original message text
            _view: existingMessage._view || messageToProcess._view,
            isRetrying: false, // CRITICAL: Server ACK means message is confirmed, not retrying
            // CRITICAL: ALWAYS set fileInfo - this is the key to preserving it
            // Match AngularJS: when server ACK arrives, fileInfo is preserved from the message object
            // CRITICAL: Use finalFileInfoToSet which ensures fileInfo is never lost
            fileInfo: finalFileInfoToSet, // CRITICAL: This MUST be set if existing message has fileInfo
            // CRITICAL: Preserve custom properties like gifUrl from existing message
            ...((existingMessage as any).gifUrl ? { gifUrl: (existingMessage as any).gifUrl } : {}),
            ...((existingMessage as any).fileUploadName ? { fileUploadName: (existingMessage as any).fileUploadName } : {}),
          } as any;
          
          // CRITICAL: Final safety check - if fileInfo is still missing but optimistic has it, force it
          // This is a last resort to prevent fileInfo from being lost
          if (!updatedMessage.fileInfo && existingMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: fileInfo is STILL missing after all checks! Force setting from optimistic:', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticFileId: existingMessage.fileInfo?.fileId,
              optimisticFileInfo: existingMessage.fileInfo,
              finalFileInfoToSet,
              finalFileInfoForMessage,
              finalFileInfoToUse,
              ensuredFinalFileInfo,
              rawMessageFileInfo,
              messageToProcessFileInfo: messageToProcess.fileInfo,
            });
            updatedMessage.fileInfo = existingMessage.fileInfo;
          }
          
          // CRITICAL: Verify fileInfo is set before proceeding
          if (!updatedMessage.fileInfo && existingMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: fileInfo verification failed - still missing!', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticFileInfo: existingMessage.fileInfo,
              updatedMessageKeys: Object.keys(updatedMessage),
            });
            // Force set it one more time
            updatedMessage.fileInfo = existingMessage.fileInfo;
          }
          
          console.log('[MessagesContext] 🔍 Final fileInfo determination:', {
            rawMessageFileInfo: rawMessageFileInfo ? { fileId: rawMessageFileInfo.fileId } : null,
            messageToProcessFileInfo: messageToProcess.fileInfo ? { fileId: messageToProcess.fileInfo.fileId } : null,
            preservedFileInfo: preservedFileInfo ? { fileId: preservedFileInfo.fileId } : null,
            optimisticFileInfo: existingMessage.fileInfo ? { fileId: existingMessage.fileInfo.fileId } : null,
            finalFileInfo: finalFileInfo ? { fileId: finalFileInfo.fileId, hasFileId: !!finalFileInfo.fileId } : null,
            updatedMessageFileInfo: updatedMessage.fileInfo ? { fileId: updatedMessage.fileInfo.fileId, hasFileId: !!updatedMessage.fileInfo.fileId } : null,
          });
          
          // CRITICAL: Double-check that fileInfo is preserved (defensive check)
          // This handles edge cases where preservedFileInfo might be null/undefined
          // CRITICAL: ALWAYS preserve fileInfo from server ACK if it has fileId (it's the authoritative source)
          // CRITICAL: Then fallback to optimistic message fileInfo if server ACK doesn't have it
          if (!updatedMessage.fileInfo) {
            // CRITICAL: If fileInfo is missing, try to restore from server ACK first (it has the correct fileId)
            if (messageToProcess.fileInfo) {
              console.warn('[MessagesContext] ⚠️ fileInfo was lost, restoring from server ACK:', {
                serverACKFileId: messageToProcess.fileInfo?.fileId,
                serverACKFileInfo: messageToProcess.fileInfo,
                preservedFileInfo,
                optimisticFileInfo: existingMessage.fileInfo,
              });
              updatedMessage.fileInfo = messageToProcess.fileInfo;
            } else if (existingMessage.fileInfo) {
              console.warn('[MessagesContext] ⚠️ fileInfo was lost, restoring from optimistic message:', {
                optimisticFileId: existingMessage.fileInfo?.fileId,
                optimisticFileInfo: existingMessage.fileInfo,
                preservedFileInfo,
                serverACKFileInfo: messageToProcess.fileInfo,
              });
              updatedMessage.fileInfo = existingMessage.fileInfo;
            }
          } else if (updatedMessage.fileInfo && existingMessage.fileInfo) {
            // CRITICAL: If optimistic message has fileId but updated message doesn't, preserve it
            // CRITICAL: Also check if optimistic message has fileId and updated message doesn't
            const optimisticHasFileId = existingMessage.fileInfo.fileId && 
              existingMessage.fileInfo.fileId !== 'undefined' && 
              existingMessage.fileInfo.fileId !== 'null' &&
              String(existingMessage.fileInfo.fileId).trim() !== '';
            const updatedHasFileId = updatedMessage.fileInfo.fileId && 
              updatedMessage.fileInfo.fileId !== 'undefined' && 
              updatedMessage.fileInfo.fileId !== 'null' &&
              String(updatedMessage.fileInfo.fileId).trim() !== '';
            
            if (optimisticHasFileId && !updatedHasFileId) {
              console.warn('[MessagesContext] ⚠️ fileId was lost, restoring from optimistic message:', {
                optimisticFileId: existingMessage.fileInfo?.fileId,
                updatedFileId: updatedMessage.fileInfo?.fileId,
                optimisticFileInfo: existingMessage.fileInfo,
                updatedFileInfo: updatedMessage.fileInfo,
              });
              // CRITICAL: Merge optimistic fileInfo to preserve fileId and all other fields
              updatedMessage.fileInfo = {
                ...updatedMessage.fileInfo,
                ...existingMessage.fileInfo, // Merge optimistic fileInfo to preserve fileId
              };
            } else if (optimisticHasFileId && updatedHasFileId && existingMessage.fileInfo.fileId !== updatedMessage.fileInfo.fileId) {
              // CRITICAL: If optimistic has fileId and updated has different fileId, prefer optimistic (it's more recent from updateMessage)
              console.warn('[MessagesContext] ⚠️ fileId mismatch, preferring optimistic fileId:', {
                optimisticFileId: existingMessage.fileInfo?.fileId,
                updatedFileId: updatedMessage.fileInfo?.fileId,
              });
              updatedMessage.fileInfo = {
                ...updatedMessage.fileInfo,
                fileId: existingMessage.fileInfo.fileId, // Use optimistic fileId (from updateMessage)
              };
            }
          } else if (!updatedMessage.fileInfo && existingMessage.fileInfo) {
            // CRITICAL: Fallback - if updatedMessage has no fileInfo but optimistic does, use it
            console.warn('[MessagesContext] ⚠️ updatedMessage has no fileInfo, using optimistic fileInfo:', {
              optimisticFileId: existingMessage.fileInfo?.fileId,
              optimisticFileInfo: existingMessage.fileInfo,
              preservedFileInfo,
              serverACKFileInfo: messageToProcess.fileInfo,
            });
            updatedMessage.fileInfo = existingMessage.fileInfo;
          }
          
          // CRITICAL: Final safety check - if fileInfo still doesn't exist but optimistic message has it, force it
          // This is a last resort to prevent fileInfo from being lost
          // CRITICAL: This handles the race condition where updateMessage sets fileId but server ACK arrives before update completes
          if (!updatedMessage.fileInfo && existingMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: fileInfo is STILL missing after all checks! Force restoring from optimistic:', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticFileId: existingMessage.fileInfo?.fileId,
              optimisticFileInfo: existingMessage.fileInfo,
              preservedFileInfo,
              serverACKFileInfo: messageToProcess.fileInfo,
            });
            updatedMessage.fileInfo = existingMessage.fileInfo;
          }
          
          // CRITICAL: Final verification - log if fileInfo is still missing after all preservation attempts
          if (!updatedMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: fileInfo is STILL missing after preservation attempts!', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticFileInfo: existingMessage.fileInfo,
              serverACKFileInfo: messageToProcess.fileInfo,
              preservedFileInfo,
            });
          } else {
            console.log('[MessagesContext] ✅ fileInfo preserved successfully:', {
              fileId: updatedMessage.fileInfo?.fileId,
              hasFileId: !!updatedMessage.fileInfo?.fileId,
              originalName: updatedMessage.fileInfo?.originalName,
              optimisticFileId: existingMessage.fileInfo?.fileId,
              serverACKFileId: messageToProcess.fileInfo?.fileId,
            });
          }
          
          // CRITICAL: Preserve ALL custom properties from existing message (gifUrl, fileUploadName, etc.)
          // These are needed for file conversion lookup (matches AngularJS fileIdToChatMessageMap)
          if ((existingMessage as any).gifUrl) {
            (updatedMessage as any).gifUrl = (existingMessage as any).gifUrl;
          }
          // CRITICAL: ALWAYS preserve fileUploadName from optimistic message (needed for UPDATE_MESSAGE fallback lookup)
          // This is essential because UPDATE_MESSAGE uses fileUploadName to find messages when messageId changes
          if ((existingMessage as any).fileUploadName) {
            (updatedMessage as any).fileUploadName = (existingMessage as any).fileUploadName;
            console.log('[MessagesContext] ✅ Preserved fileUploadName from optimistic message:', (existingMessage as any).fileUploadName);
          } else if (existingMessage.fileInfo?.name) {
            // Fallback: Use fileInfo.name as fileUploadName if fileUploadName doesn't exist
            (updatedMessage as any).fileUploadName = existingMessage.fileInfo.name;
            console.log('[MessagesContext] ✅ Using fileInfo.name as fileUploadName:', existingMessage.fileInfo.name);
          } else if ((messageToProcess as any).fileUploadName) {
            // Try to get from server ACK
            (updatedMessage as any).fileUploadName = (messageToProcess as any).fileUploadName;
            console.log('[MessagesContext] ✅ Using fileUploadName from server ACK:', (messageToProcess as any).fileUploadName);
          } else if (messageToProcess.fileInfo?.name) {
            // Last resort: Use server ACK fileInfo.name
            (updatedMessage as any).fileUploadName = messageToProcess.fileInfo.name;
            console.log('[MessagesContext] ✅ Using server ACK fileInfo.name as fileUploadName:', messageToProcess.fileInfo.name);
          } else {
            console.warn('[MessagesContext] ⚠️ fileUploadName not found anywhere:', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticHasFileInfo: !!existingMessage.fileInfo,
              optimisticFileName: existingMessage.fileInfo?.name,
              serverACKHasFileInfo: !!messageToProcess.fileInfo,
              serverACKFileName: messageToProcess.fileInfo?.name,
            });
          }
          
          // CRITICAL: Final verification - ensure fileInfo is set before updating state
          if (!updatedMessage.fileInfo && existingMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: fileInfo verification failed BEFORE state update! Force setting:', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticFileInfo: existingMessage.fileInfo,
              updatedMessageKeys: Object.keys(updatedMessage),
            });
            updatedMessage.fileInfo = existingMessage.fileInfo;
          }
          
          // CRITICAL: Create new array with new message object to ensure React detects change
          const updated = existing.map((msg, idx) => 
            idx === existingIndex ? updatedMessage : msg
          );
          
          // CRITICAL: Verify fileInfo is set in the updated array
          const verifyUpdatedMessage = updated[existingIndex];
          if (!verifyUpdatedMessage.fileInfo && existingMessage.fileInfo) {
            console.error('[MessagesContext] ❌ CRITICAL: fileInfo verification failed AFTER array update! Force setting:', {
              optimisticMessageId: existingMessage.messageId,
              serverACKMessageId: messageToProcess.messageId,
              optimisticFileInfo: existingMessage.fileInfo,
            });
            updated[existingIndex] = {
              ...verifyUpdatedMessage,
              fileInfo: existingMessage.fileInfo,
            };
          }
          
          // Sort messages (matches AngularJS ChatUtils.sortMessages)
          const sorted = [...updated].sort((a, b) => {
            // Primary sort: timestamp (ascending)
            if (a.timestamp !== b.timestamp) {
              return a.timestamp - b.timestamp;
            }
            // Secondary sort: sequenceNumber (only if both > 0)
            if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
              if (a.sequenceNumber > 0 && b.sequenceNumber > 0) {
                return a.sequenceNumber - b.sequenceNumber;
              }
            }
            return 0;
          });
          
          // CRITICAL: Final verification - ensure fileInfo is set in sorted array
          const finalMessageIndex = sorted.findIndex(m => m.messageId === updatedMessage.messageId);
          if (finalMessageIndex >= 0) {
            const finalMessage = sorted[finalMessageIndex];
            if (!finalMessage.fileInfo && existingMessage.fileInfo) {
              console.error('[MessagesContext] ❌ CRITICAL: fileInfo verification failed AFTER sorting! Force setting:', {
                optimisticMessageId: existingMessage.messageId,
                serverACKMessageId: messageToProcess.messageId,
                optimisticFileInfo: existingMessage.fileInfo,
              });
              sorted[finalMessageIndex] = {
                ...finalMessage,
                fileInfo: existingMessage.fileInfo,
              };
            }
          }
          
          // CRITICAL: Return new state object with new array reference
          return {
            ...state,
            [chatId]: sorted,
          };
        }
        
        if (messageToProcess.isEdited) {
          // CRITICAL: Save edited message to localStorage (matches AngularJS messagesDiskManager.saveMessageForChatId lines 104-132)
          // This needs to be done outside the reducer, so we'll handle it in the messageHandler
          // For now, just update the state
          const updated = [...existing];
          updated[existingIndex] = messageToProcess;
          return {
            ...state,
            [chatId]: updated.sort((a, b) => {
              if (a.timestamp !== b.timestamp) {
                return a.timestamp - b.timestamp;
              }
              if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
                if (a.sequenceNumber > 0 && b.sequenceNumber > 0) {
                  return a.sequenceNumber - b.sequenceNumber;
                }
              }
              return 0;
            }),
          };
        }
        
        // Duplicate message (not optimistic replacement, not edited)
        // CRITICAL: Even for duplicates, preserve fileInfo from existing message if it has fileId
        // This handles the case where server ACK arrives after updateMessage sets fileId
        // The server ACK might not have fileInfo, but the existing message does (from updateMessage)
        if (existingMessage && existingMessage.fileInfo && existingMessage.fileInfo.fileId) {
          // CRITICAL: Existing message has fileInfo with fileId - preserve it
          // This handles server ACKs that don't have fileInfo but existing message does
          console.log('[MessagesContext] 🔒 Duplicate message detected - preserving fileInfo from existing message:', {
            messageId: existingMessage.messageId,
            existingFileId: existingMessage.fileInfo.fileId,
            incomingHasFileInfo: !!messageToProcess.fileInfo,
            incomingFileId: messageToProcess.fileInfo?.fileId,
          });
          
          // Update the existing message to preserve fileInfo
          const updated = [...existing];
          updated[existingIndex] = {
            ...messageToProcess,
            // CRITICAL: Preserve fileInfo from existing message (it has fileId from updateMessage)
            fileInfo: existingMessage.fileInfo,
            // Preserve other properties from existing message
            _view: existingMessage._view || messageToProcess._view,
            // Preserve custom properties
            ...((existingMessage as any).gifUrl ? { gifUrl: (existingMessage as any).gifUrl } : {}),
            ...((existingMessage as any).fileUploadName ? { fileUploadName: (existingMessage as any).fileUploadName } : {}),
          } as any;
          
          return {
            ...state,
            [chatId]: updated,
          };
        }
        
        // CRITICAL: Even for duplicates, create a new array reference to ensure React detects change
        // This ensures that if the same message arrives again, React still re-renders
        const newArray = [...existing];
        return {
          ...state,
          [chatId]: newArray,
        };
      }
      
      // CRITICAL: Ensure isRetrying is preserved correctly for new messages
      // Received messages should have isRetrying = false (set by parseMessageStanza)
      // Only optimistic messages (sent with sequenceNumber 0) should have isRetrying = true
      console.log('[MessagesContext] 📝 Adding new message:', {
        messageId: messageToProcess.messageId,
        sequenceNumber: messageToProcess.sequenceNumber,
        isRetrying: messageToProcess.isRetrying,
        senderId: messageToProcess.senderId,
        hasFileInfo: !!messageToProcess.fileInfo,
        fileId: messageToProcess.fileInfo?.fileId,
        fileInfo: messageToProcess.fileInfo,
        gifUrl: (messageToProcess as any).gifUrl,
        fileUploadName: (messageToProcess as any).fileUploadName,
      });
      
      // CRITICAL: Check for duplicate messages with same fileId but different messageId
      // This handles cases where server ACK creates a new message instead of replacing optimistic one
      // CRITICAL: If this is a file message with fileId, check if another message already has this fileId
      if (messageToProcess.fileInfo?.fileId) {
        const incomingFileId = messageToProcess.fileInfo.fileId;
        const duplicateFileMessage = existing.find(m => 
          m.messageId !== messageToProcess.messageId && // Different messageId
          m.fileInfo?.fileId === incomingFileId && // Same fileId
          m.senderId === messageToProcess.senderId && // Same sender
          m.chatId === messageToProcess.chatId // Same chat
        );
        
        if (duplicateFileMessage) {
          console.log('[MessagesContext] 🔍 Found duplicate file message, removing old one:', {
            oldMessageId: duplicateFileMessage.messageId,
            newMessageId: messageToProcess.messageId,
            fileId: messageToProcess.fileInfo.fileId,
            oldSequenceNumber: duplicateFileMessage.sequenceNumber,
            newSequenceNumber: messageToProcess.sequenceNumber,
          });
          // Remove the duplicate message (keep the server ACK)
          const filtered = existing.filter(m => m.messageId !== duplicateFileMessage.messageId);
          const updated = [...filtered, messageToProcess].sort((a, b) => {
            if (a.timestamp !== b.timestamp) {
              return a.timestamp - b.timestamp;
            }
            if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
              if (a.sequenceNumber > 0 && b.sequenceNumber > 0) {
                return a.sequenceNumber - b.sequenceNumber;
              }
            }
            return 0;
          });
          return {
            ...state,
            [chatId]: updated,
          };
        }
      }
      
      // CRITICAL: Ensure all properties (including custom ones like gifUrl) are preserved
      // Use spread operator to copy all properties including non-standard ones
      const messageToAdd = { ...messageToProcess } as any;
      
      const updated = [...existing, messageToAdd].sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }
        if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
          if (a.sequenceNumber > 0 && b.sequenceNumber > 0) {
            return a.sequenceNumber - b.sequenceNumber;
          }
        }
        return 0;
      });
      
      console.log('[MessagesContext] ✅ Reducer returning new state:', {
        chatId,
        newCount: updated.length,
        messageIds: updated.map(m => m.messageId),
        lastMessageId: updated[updated.length - 1]?.messageId,
        lastMessageText: updated[updated.length - 1]?.messageText?.substring(0, 20),
        lastMessageIsRetrying: updated[updated.length - 1]?.isRetrying,
        lastMessageSequenceNumber: updated[updated.length - 1]?.sequenceNumber,
      });
      
      return {
        ...state,
        [chatId]: updated,
      };
    }
    
    case 'UPDATE_MESSAGE': {
      const { chatId, messageId, updates } = action;
      const existing = state[chatId] || [];
      let index = existing.findIndex(m => m.messageId === messageId);
      const originalMessageId = messageId; // Store original for logging
      
      console.log('[MessagesContext] 🔄 UPDATE_MESSAGE reducer called:', {
        chatId,
        messageId: originalMessageId,
        found: index >= 0,
        index,
        updatesFileInfo: updates.fileInfo,
        updatesFileId: updates.fileInfo?.fileId,
        updatesFileIdType: typeof updates.fileInfo?.fileId,
        fileUploadName: (updates as any).fileUploadName || updates.fileInfo?.name,
        totalMessages: existing.length,
        allMessageIds: existing.map(m => m.messageId),
      });
      
      // CRITICAL: If message not found by messageId, try to find it by fileUploadName (matches AngularJS fileIdToChatMessageMap)
      // This handles the case where server ACK replaced optimistic message with different messageId
      if (index < 0 && updates.fileInfo) {
        const fileUploadName = (updates as any).fileUploadName || updates.fileInfo.name;
        if (fileUploadName) {
          console.log('[MessagesContext] 🔍 Message not found by messageId, trying fileUploadName:', {
            messageId,
            fileUploadName,
            totalMessages: existing.length,
          });
          
          // CRITICAL: Try to find message by fileUploadName
          // If updating with fileId, prioritize messages without fileId (uploading state)
          // But also match messages without fileInfo at all (server ACK might have replaced optimistic message)
          if (updates.fileInfo.fileId) {
            // If updating with fileId, find message without fileId (uploading state) OR without fileInfo at all
            const messagesWithoutFileId = existing.filter(m => {
              const matchesName = (m as any).fileUploadName === fileUploadName || 
                                 (m.fileInfo && m.fileInfo.name === fileUploadName);
              // CRITICAL: Match messages without fileInfo OR without fileId
              const hasNoFileInfo = !m.fileInfo;
              const hasNoFileId = m.fileInfo && !m.fileInfo.fileId;
              return matchesName && (hasNoFileInfo || hasNoFileId);
            });
            
            if (messagesWithoutFileId.length > 0) {
              // Sort by timestamp descending to get most recent
              messagesWithoutFileId.sort((a, b) => b.timestamp - a.timestamp);
              const foundMessage = messagesWithoutFileId[0];
              index = existing.findIndex(m => m.messageId === foundMessage.messageId);
              console.log('[MessagesContext] ✅ Found message by fileUploadName (without fileId or fileInfo):', {
                messageId: foundMessage.messageId,
                fileUploadName,
                hasFileInfo: !!foundMessage.fileInfo,
                fileId: foundMessage.fileInfo?.fileId,
                originalMessageId,
              });
            }
          } else {
            // If not updating with fileId, try to find by fileUploadName (any message matching the name)
            const matchingMessages = existing.filter(m => 
              (m as any).fileUploadName === fileUploadName || 
              (m.fileInfo && m.fileInfo.name === fileUploadName)
            );
            
            if (matchingMessages.length > 0) {
              // Sort by timestamp descending to get most recent
              matchingMessages.sort((a, b) => b.timestamp - a.timestamp);
              const foundMessage = matchingMessages[0];
              index = existing.findIndex(m => m.messageId === foundMessage.messageId);
              console.log('[MessagesContext] ✅ Found message by fileUploadName:', {
                messageId: foundMessage.messageId,
                fileUploadName,
                hasFileInfo: !!foundMessage.fileInfo,
                fileId: foundMessage.fileInfo?.fileId,
                originalMessageId,
              });
            }
          }
        }
      }
      
      // CRITICAL: If still not found, try to find by senderId + timestamp + fileInfo (last resort)
      // This handles edge cases where server ACK replaced optimistic message but fileUploadName doesn't match
      if (index < 0 && updates.fileInfo?.fileId) {
        console.log('[MessagesContext] 🔍 Message still not found, trying senderId + timestamp + fileInfo match:', {
          messageId,
          fileUploadName: (updates as any).fileUploadName || updates.fileInfo?.name,
          totalMessages: existing.length,
        });
        
        // Find messages from same sender without fileId (uploading state) within last 60 seconds
        const getCurrentUserId = () => {
          if (typeof window !== 'undefined') {
            const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
            return sessionData?.user?.user_id || '';
          }
          return '';
        };
        const currentUserId = getCurrentUserId();
        
        // Find most recent message from same sender without fileId
        const recentMessagesWithoutFileId = existing.filter(m => {
          if (m.senderId !== currentUserId) return false;
          if (!m.fileInfo || m.fileInfo.fileId) return false; // Must have fileInfo but no fileId
          // Must be recent (within last 60 seconds)
          const timeDiff = Math.abs(m.timestamp - Date.now());
          return timeDiff < 60000;
        });
        
        if (recentMessagesWithoutFileId.length > 0) {
          // Sort by timestamp descending to get most recent
          recentMessagesWithoutFileId.sort((a, b) => b.timestamp - a.timestamp);
          const foundMessage = recentMessagesWithoutFileId[0];
          index = existing.findIndex(m => m.messageId === foundMessage.messageId);
          console.log('[MessagesContext] ✅ Found message by senderId + no fileId (last resort):', {
            messageId: foundMessage.messageId,
            hasFileInfo: !!foundMessage.fileInfo,
            fileId: foundMessage.fileInfo?.fileId,
            originalMessageId: messageId,
          });
        }
      }
      
      if (index < 0) {
        console.error('[MessagesContext] ❌ UPDATE_MESSAGE: Message not found by any method!', {
          chatId,
          messageId,
          fileUploadName: (updates as any).fileUploadName || updates.fileInfo?.name,
          totalMessages: existing.length,
          allMessageIds: existing.map(m => m.messageId),
          messagesWithFileInfo: existing.filter(m => m.fileInfo).map(m => ({
            messageId: m.messageId,
            fileUploadName: (m as any).fileUploadName,
            fileId: m.fileInfo?.fileId,
            hasNoFileId: !m.fileInfo?.fileId,
          })),
          messagesWithoutFileId: existing.filter(m => m.fileInfo && !m.fileInfo.fileId).map(m => ({
            messageId: m.messageId,
            fileUploadName: (m as any).fileUploadName,
            timestamp: m.timestamp,
          })),
        });
        // CRITICAL: Return state unchanged if message not found
        return state;
      }
      
      if (index >= 0) {
        const updated = [...existing];
        // CRITICAL: Deep merge fileInfo to preserve all properties (including custom ones like gifUrl)
        const currentMessage = updated[index];
        
        console.log('[MessagesContext] 🔄 Current message before update:', {
          messageId: currentMessage.messageId,
          hasFileInfo: !!currentMessage.fileInfo,
          currentFileId: currentMessage.fileInfo?.fileId,
          currentFileInfo: currentMessage.fileInfo,
        });
        
        const mergedUpdates: any = { ...currentMessage, ...updates };
        
        // If updating fileInfo, merge it properly to preserve custom properties
        // CRITICAL: Always set fileInfo if updates.fileInfo exists, even if currentMessage doesn't have it
        if (updates.fileInfo) {
          // CRITICAL: If currentMessage has fileInfo, merge it; otherwise use updates.fileInfo directly
          if (currentMessage.fileInfo) {
            mergedUpdates.fileInfo = { ...currentMessage.fileInfo, ...updates.fileInfo };
          } else {
            // CRITICAL: Current message doesn't have fileInfo, so use updates.fileInfo directly
            mergedUpdates.fileInfo = { ...updates.fileInfo };
          }
          
          console.log('[MessagesContext] 🔄 Merged fileInfo:', {
            updatesFileInfo: updates.fileInfo,
            currentFileInfo: currentMessage.fileInfo,
            currentHasFileInfo: !!currentMessage.fileInfo,
            mergedFileInfo: mergedUpdates.fileInfo,
            mergedFileId: mergedUpdates.fileInfo?.fileId,
            mergedHasFileInfo: !!mergedUpdates.fileInfo,
          });
        } else {
          // CRITICAL: If updates doesn't have fileInfo, preserve current fileInfo
          mergedUpdates.fileInfo = currentMessage.fileInfo;
          console.log('[MessagesContext] 🔄 No fileInfo in updates, preserving current fileInfo:', {
            currentFileInfo: currentMessage.fileInfo,
            preservedFileInfo: mergedUpdates.fileInfo,
          });
        }
        
        // CRITICAL: Ensure fileId is explicitly set from updates.fileInfo (don't let it be overwritten)
        // This matches AngularJS line 80: msg.fileInfo.fileId = uploadFileVO.serverFileId
        // The fileId MUST be set to trigger UI switch from upload UI to final GIF
        if (updates.fileInfo?.fileId !== undefined) {
          // CRITICAL: Always set fileId from updates, even if it's a string 'undefined' or 'null'
          // Convert to proper value: if it's a valid fileId, use it; otherwise keep undefined
          const incomingFileId = updates.fileInfo.fileId;
          const validFileId = incomingFileId && 
            incomingFileId !== 'undefined' && 
            incomingFileId !== 'null' && 
            String(incomingFileId).trim() !== '';
          
          // CRITICAL: Ensure fileInfo exists before setting fileId
          if (!mergedUpdates.fileInfo) {
            mergedUpdates.fileInfo = {};
          }
          
          mergedUpdates.fileInfo = {
            ...mergedUpdates.fileInfo,
            fileId: validFileId ? incomingFileId : undefined, // Explicitly set fileId from updates
          };
          
          // CRITICAL: Also ensure isUploading is set to false when fileId is set (matches AngularJS line 76)
          if (validFileId && updates.fileInfo.isUploading === false) {
            mergedUpdates.fileInfo.isUploading = false;
          }
          
          console.log('[MessagesContext] 🔄 fileId set in mergedUpdates:', {
            incomingFileId,
            validFileId,
            mergedFileId: mergedUpdates.fileInfo?.fileId,
            mergedFileInfo: mergedUpdates.fileInfo,
          });
        }
        
        // Preserve custom properties from current message (gifUrl, fileUploadName, etc.)
        if ((currentMessage as any).gifUrl) {
          (mergedUpdates as any).gifUrl = (currentMessage as any).gifUrl;
        }
        if ((currentMessage as any).fileUploadName) {
          (mergedUpdates as any).fileUploadName = (currentMessage as any).fileUploadName;
        }
        
        // If updates has custom properties, preserve them
        if ((updates as any).gifUrl !== undefined) {
          (mergedUpdates as any).gifUrl = (updates as any).gifUrl;
        }
        if ((updates as any).fileUploadName !== undefined) {
          (mergedUpdates as any).fileUploadName = (updates as any).fileUploadName;
        }
        
        updated[index] = mergedUpdates;
        
        console.log('[MessagesContext] 🔄 UPDATE_MESSAGE - Message updated in array:', {
          messageId,
          chatId,
          hasFileInfo: !!mergedUpdates.fileInfo,
          fileId: mergedUpdates.fileInfo?.fileId,
          fileIdType: typeof mergedUpdates.fileInfo?.fileId,
          updatesFileId: updates.fileInfo?.fileId,
          updatesFileIdType: typeof updates.fileInfo?.fileId,
          currentFileId: currentMessage.fileInfo?.fileId,
          originalName: mergedUpdates.fileInfo?.originalName,
          original_name: mergedUpdates.fileInfo?.original_name,
          thumbnailName: mergedUpdates.fileInfo?.thumbnailName,
          thumbnail_name: mergedUpdates.fileInfo?.thumbnail_name,
          mergedFileInfo: mergedUpdates.fileInfo ? JSON.parse(JSON.stringify(mergedUpdates.fileInfo)) : null,
          gifUrl: (mergedUpdates as any).gifUrl,
          arrayLength: updated.length,
          messageAtIndex: updated[index]?.messageId,
          fileInfoAtIndex: updated[index]?.fileInfo,
          fileIdAtIndex: updated[index]?.fileInfo?.fileId,
        });
        
        // CRITICAL: Verify the update was applied correctly
        const verifyUpdatedMessage = updated[index];
        if (!verifyUpdatedMessage.fileInfo || !verifyUpdatedMessage.fileInfo.fileId) {
          console.error('[MessagesContext] ❌ CRITICAL: Update failed - message still has no fileInfo/fileId after update!', {
            messageId,
            chatId,
            hasFileInfo: !!verifyUpdatedMessage.fileInfo,
            fileId: verifyUpdatedMessage.fileInfo?.fileId,
            mergedFileInfo: mergedUpdates.fileInfo,
            mergedFileId: mergedUpdates.fileInfo?.fileId,
          });
        } else {
          console.log('[MessagesContext] ✅ Update verified - message has fileInfo with fileId:', {
            messageId,
            fileId: verifyUpdatedMessage.fileInfo.fileId,
          });
        }
        
        // CRITICAL: If updating with fileId but originalName is missing for GIF, log warning
        if (mergedUpdates.fileInfo?.fileId && mergedUpdates.fileInfo?.type?.toUpperCase() === 'GIF' && !mergedUpdates.fileInfo?.originalName && !mergedUpdates.fileInfo?.original_name) {
          console.warn('[MessagesContext] ⚠️ UPDATE_MESSAGE: GIF has fileId but no originalName!', {
            messageId,
            chatId,
            fileId: mergedUpdates.fileInfo?.fileId,
            originalName: mergedUpdates.fileInfo?.originalName,
            original_name: mergedUpdates.fileInfo?.original_name,
            updatesOriginalName: updates.fileInfo?.originalName,
            updatesOriginal_name: updates.fileInfo?.original_name,
          });
        }
        
        // CRITICAL: Sort messages before returning
        const sorted = updated.sort((a, b) => {
          // Primary sort: timestamp (ascending)
          if (a.timestamp !== b.timestamp) {
            return a.timestamp - b.timestamp;
          }
          // Secondary sort: sequenceNumber (only if both > 0)
          if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
            if (a.sequenceNumber > 0 && b.sequenceNumber > 0) {
              return a.sequenceNumber - b.sequenceNumber;
            }
          }
          return 0;
        });
        
        // CRITICAL: Verify the updated message is in the sorted array
        const verifyInSorted = sorted.find(m => m.messageId === messageId);
        if (!verifyInSorted) {
          console.error('[MessagesContext] ❌ CRITICAL: Updated message not found in sorted array!', {
            messageId,
            chatId,
            sortedLength: sorted.length,
            sortedMessageIds: sorted.map(m => m.messageId),
          });
        } else if (!verifyInSorted.fileInfo || !verifyInSorted.fileInfo.fileId) {
          console.error('[MessagesContext] ❌ CRITICAL: Updated message in sorted array has no fileInfo/fileId!', {
            messageId,
            chatId,
            hasFileInfo: !!verifyInSorted.fileInfo,
            fileId: verifyInSorted.fileInfo?.fileId,
            mergedFileId: mergedUpdates.fileInfo?.fileId,
          });
        } else {
          console.log('[MessagesContext] ✅ UPDATE_MESSAGE SUCCESS - Message updated with fileId:', {
            messageId,
            fileId: verifyInSorted.fileInfo.fileId,
          });
        }
        
        return {
          ...state,
          [chatId]: sorted,
        };
      }
      
      // Message not found - create new state object with new array reference to ensure React detects change
      const newArray = [...existing];
      return {
        ...state,
        [chatId]: newArray,
      };
    }
    
    case 'REMOVE_MESSAGE': {
      const { chatId, messageId } = action;
      const existing = state[chatId] || [];
      const filtered = existing.filter(m => m.messageId !== messageId);
      
      console.log('[MessagesContext] 🗑️ REMOVE_MESSAGE:', {
        messageId,
        chatId,
        beforeCount: existing.length,
        afterCount: filtered.length,
      });
      
      return {
        ...state,
        [chatId]: filtered,
      };
    }
    
    case 'SET_MESSAGES': {
      return {
        ...state,
        [action.chatId]: action.messages,
      };
    }
    
    case 'MERGE_MESSAGES': {
      const { chatId, messages: newMessages } = action;
      const existing = state[chatId] || [];
      
      // Merge messages, avoiding duplicates
      const messageMap = new Map<string, ChatMessage>();
      
      // Add existing messages
      existing.forEach(msg => {
        messageMap.set(msg.messageId, msg);
      });
      
      // Add/update new messages
      newMessages.forEach(msg => {
        const existingMsg = messageMap.get(msg.messageId);
        if (existingMsg) {
          // If optimistic and new has real sequenceNumber, replace
          if (existingMsg.sequenceNumber === 0 && msg.sequenceNumber > 0) {
            messageMap.set(msg.messageId, msg);
          } else if (msg.isEdited) {
            messageMap.set(msg.messageId, msg);
          }
          // Otherwise keep existing
        } else {
          messageMap.set(msg.messageId, msg);
        }
      });
      
      const merged = Array.from(messageMap.values()).sort((a, b) => {
        if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
          if (a.sequenceNumber !== b.sequenceNumber) {
            return a.sequenceNumber - b.sequenceNumber;
          }
        }
        return a.timestamp - b.timestamp;
      });
      
      return {
        ...state,
        [chatId]: merged,
      };
    }
    
    case 'PREPEND_MESSAGES': {
      // Prepend older messages (matches AngularJS chat.prependMessages EXACTLY)
      const { chatId, messages: olderMessages } = action;
      const existing = state[chatId] || [];
      
      if (!olderMessages || olderMessages.length === 0) {
        return state;
      }
      
      console.log('[MessagesContext] 📜 Prepending older messages:', {
        chatId,
        olderCount: olderMessages.length,
        existingCount: existing.length,
      });
      
      // Create message map to avoid duplicates (matches AngularJS chat.prependMessages duplicate check)
      const messageMap = new Map<string, ChatMessage>();
      
      // Add existing messages first
      existing.forEach(msg => {
        messageMap.set(msg.messageId, msg);
      });
      
      // Process older messages in reverse order (matches AngularJS line 484: for (var i = messagesCount - 1; i >= 0; --i))
      // This ensures messages are prepended in correct order
      let addedCount = 0;
      for (let i = olderMessages.length - 1; i >= 0; --i) {
        const message = olderMessages[i];
        
        // Skip if already exists (matches AngularJS line 501-513)
        const existingMsg = messageMap.get(message.messageId);
        if (existingMsg) {
          // If existing is optimistic (sequenceNumber 0) and new has real sequenceNumber, replace
          if (existingMsg.sequenceNumber === 0 && message.sequenceNumber > 0) {
            messageMap.delete(message.messageId);
            messageMap.set(message.messageId, message);
            addedCount++;
          } else if (message.isEdited) {
            // Replace if edited
            messageMap.delete(message.messageId);
            messageMap.set(message.messageId, message);
            addedCount++;
          }
          // Otherwise skip duplicate
          continue;
        }
        
        // Add new message
        messageMap.set(message.messageId, message);
        addedCount++;
      }
      
      // Convert to array and sort (matches AngularJS sorting by sequenceNumber)
      const prepended = Array.from(messageMap.values()).sort((a, b) => {
        // Primary sort: sequenceNumber (if both > 0)
        if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
          if (a.sequenceNumber > 0 && b.sequenceNumber > 0) {
            if (a.sequenceNumber !== b.sequenceNumber) {
              return a.sequenceNumber - b.sequenceNumber;
            }
          }
        }
        // Secondary sort: timestamp
        return a.timestamp - b.timestamp;
      });
      
      console.log('[MessagesContext] ✅ Prepended messages:', {
        chatId,
        addedCount,
        totalCount: prepended.length,
        minSequenceNumber: prepended[0]?.sequenceNumber,
        maxSequenceNumber: prepended[prepended.length - 1]?.sequenceNumber,
      });
      
      return {
        ...state,
        [chatId]: prepended,
      };
    }
    
    case 'SYNC_FROM_STORAGE': {
      return {
        ...state,
        [action.chatId]: action.messages,
      };
    }
    
    default:
      return state;
  }
}

// BroadcastChannel for multi-tab sync (matches AngularJS appTabs.js line 57)
const BROADCAST_CHANNEL_NAME = 'convoMessagesChannel';
const STORAGE_KEY_PREFIX = 'convo_messages_';

// localStorage key for failed/optimistic messages (matches AngularJS messagesDiskManager.js line 25)
function getFailedMessagesStoreKey(accountId: string, userId: string): string {
  if (!userId || !accountId) {
    throw new Error('Not Initialized Exception: Please provide user ID and account ID');
  }
  return `com.convo.chat.${accountId}.${userId}.failed_messages`;
}

// localStorage key for all messages per chat (matches AngularJS chatLocalStore.js PREFIX_MSGS)
function getMessagesStoreKey(accountId: string, userId: string, chatId: string): string {
  if (!userId || !accountId || !chatId) {
    throw new Error('Not Initialized Exception: Please provide user ID, account ID, and chat ID');
  }
  return `com.convo.chat.${accountId}.${userId}.messages.V1.${chatId}`;
}

// Maximum messages to persist per chat (matches AngularJS MAX_MSGS = 20)
const MAX_PERSISTED_MESSAGES = 20;

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(messagesReducer, {});
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isInitializedRef = useRef(false);
  const isLoadedFromStorageRef = useRef(false);
  
  // Get accountId and userId for localStorage key
  const getAccountAndUserId = useCallback(() => {
    if (typeof window === 'undefined') return { accountId: '', userId: '' };
    const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
    return {
      accountId: sessionData?.account_id || '',
      userId: sessionData?.user?.user_id || '',
    };
  }, []);

  // Initialize BroadcastChannel (matches AngularJS appTabs.js)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Initialize BroadcastChannel if available
    if (window.BroadcastChannel && !broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        
        broadcastChannelRef.current.onmessage = (event) => {
          if (event.data && event.data.type === 'MESSAGE_UPDATE') {
            const { chatId, action: actionType, payload } = event.data;
            
            // Ignore messages from this tab (prevent loops)
            if (event.data.tabId === getTabId()) {
              return;
            }
            
            // Apply the action
            switch (actionType) {
              case 'ADD_MESSAGE':
                if (payload.message) {
                  dispatch({ type: 'ADD_MESSAGE', chatId, message: payload.message });
                }
                break;
              case 'UPDATE_MESSAGE':
                if (payload.messageId && payload.updates) {
                  dispatch({ type: 'UPDATE_MESSAGE', chatId, messageId: payload.messageId, updates: payload.updates });
                }
                break;
              case 'SET_MESSAGES':
                if (payload.messages) {
                  dispatch({ type: 'SET_MESSAGES', chatId, messages: payload.messages });
                }
                break;
              case 'MERGE_MESSAGES':
                if (payload.messages) {
                  dispatch({ type: 'MERGE_MESSAGES', chatId, messages: payload.messages });
                }
                break;
            }
          }
        };
        
        broadcastChannelRef.current.onmessageerror = (error) => {
          };
      } catch (error) {
        // Failed to create BroadcastChannel
      }
    }
    
    // Fallback: localStorage events (matches AngularJS appTabs.js line 81)
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key && event.key.startsWith(STORAGE_KEY_PREFIX)) {
        try {
          const data = JSON.parse(event.newValue || '{}');
          if (data.type === 'MESSAGE_UPDATE' && data.tabId !== getTabId()) {
            const { chatId, action: actionType, payload } = data;
            
            switch (actionType) {
              case 'ADD_MESSAGE':
                if (payload.message) {
                  dispatch({ type: 'ADD_MESSAGE', chatId, message: payload.message });
                }
                break;
              case 'UPDATE_MESSAGE':
                if (payload.messageId && payload.updates) {
                  dispatch({ type: 'UPDATE_MESSAGE', chatId, messageId: payload.messageId, updates: payload.updates });
                }
                break;
              case 'SET_MESSAGES':
                if (payload.messages) {
                  dispatch({ type: 'SET_MESSAGES', chatId, messages: payload.messages });
                }
                break;
              case 'MERGE_MESSAGES':
                if (payload.messages) {
                  dispatch({ type: 'MERGE_MESSAGES', chatId, messages: payload.messages });
                }
                break;
            }
          }
        } catch (error) {
          // Error parsing storage event
        }
      }
    };
    
    window.addEventListener('storage', handleStorageEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
        broadcastChannelRef.current = null;
      }
    };
  }, []);

  // Broadcast message update to other tabs
  const broadcastUpdate = useCallback((actionType: string, chatId: string, payload: any) => {
    const tabId = getTabId();
    const message = {
      type: 'MESSAGE_UPDATE',
      tabId,
      chatId,
      action: actionType,
      payload,
      timestamp: Date.now(),
    };
    
    // Broadcast via BroadcastChannel
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(message);
      } catch (error) {
        // Failed to broadcast
      }
    }
    
    // Fallback: localStorage (matches AngularJS dispatchTabsEvent2)
    if (typeof window !== 'undefined') {
      try {
        const storageKey = `${STORAGE_KEY_PREFIX}${chatId}_${actionType}`;
        localStorage.setItem(storageKey, JSON.stringify(message));
        // Clean up after a short delay (matches AngularJS line 728-730)
        setTimeout(() => {
          localStorage.removeItem(storageKey);
        }, 20);
      } catch (error) {
        // Failed to write to localStorage
      }
    }
  }, []);

  // Load failed/optimistic messages from localStorage on initialization (matches AngularJS messagesDiskManager.loadFromLocalStore)
  useEffect(() => {
    if (isLoadedFromStorageRef.current || typeof window === 'undefined') return;
    
    const { accountId, userId } = getAccountAndUserId();
    if (!accountId || !userId) {
      return;
    }
    
    isLoadedFromStorageRef.current = true;
    
    try {
      const storeKey = getFailedMessagesStoreKey(accountId, userId);
      const storedValue = localStorage.getItem(storeKey);
      
      if (storedValue) {
        const data = JSON.parse(storedValue);
        
        // Restore messages for each chat (matches AngularJS messagesDiskManager.repair)
        Object.keys(data).forEach((chatId) => {
          const messages = data[chatId];
          if (Array.isArray(messages) && messages.length > 0) {
            // Filter out system messages (matches AngularJS line 216)
            const nonSystemMessages = messages.filter((msg: any) => !msg.isSystemMessage);
            if (nonSystemMessages.length > 0) {
              // Merge with existing state (don't replace, merge)
              dispatch({ type: 'MERGE_MESSAGES', chatId, messages: nonSystemMessages });
            }
          }
        });
      }
    } catch (error) {
      // Error loading from localStorage
    }
  }, [getAccountAndUserId]);

  // Save failed/optimistic messages to localStorage (matches AngularJS messagesDiskManager.saveToLocalStore)
  const saveFailedMessagesToLocalStore = useCallback((messagesMap: MessagesState) => {
    if (typeof window === 'undefined') return;
    
    const { accountId, userId } = getAccountAndUserId();
    if (!accountId || !userId) return;
    
    try {
      const storeKey = getFailedMessagesStoreKey(accountId, userId);
      
      // Only save messages that are optimistic (sequenceNumber === 0) or failed (isRetrying === true)
      // Matches AngularJS behavior: only failed messages are persisted
      const failedMessagesMap: MessagesState = {};
      Object.keys(messagesMap).forEach((chatId) => {
        const messages = messagesMap[chatId];
        const failedMessages = messages.filter(
          (msg) => msg.sequenceNumber === 0 || msg.isRetrying === true
        );
        if (failedMessages.length > 0) {
          failedMessagesMap[chatId] = failedMessages;
        }
      });
      
      if (Object.keys(failedMessagesMap).length > 0) {
        localStorage.setItem(storeKey, JSON.stringify(failedMessagesMap));
      } else {
        // Remove key if no failed messages
        localStorage.removeItem(storeKey);
      }
    } catch (error) {
      // Handle quota exceeded exception (matches AngularJS line 187-190)
    }
  }, [getAccountAndUserId]);

  // Save ALL messages per chat to localStorage (matches AngularJS chatLocalStore.saveChatMessages)
  // Saves up to MAX_PERSISTED_MESSAGES most recent messages per chat
  const saveAllMessagesToLocalStore = useCallback((messagesMap: MessagesState) => {
    if (typeof window === 'undefined') return;
    
    const { accountId, userId } = getAccountAndUserId();
    if (!accountId || !userId) return;
    
    try {
      Object.keys(messagesMap).forEach((chatId) => {
        const messages = messagesMap[chatId];
        if (!messages || messages.length === 0) return;
        
        // Get most recent messages (matches AngularJS chatsDiskManager.saveChats line 73)
        // AngularJS saves from newest to oldest, up to MAX_MSGS
        const sortedMessages = [...messages].sort((a, b) => {
          // Sort by sequenceNumber descending (newest first)
          if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
            if (a.sequenceNumber !== b.sequenceNumber) {
              return b.sequenceNumber - a.sequenceNumber;
            }
          }
          return b.timestamp - a.timestamp;
        });
        
        // Take only most recent MAX_PERSISTED_MESSAGES (matches AngularJS line 73)
        const messagesToSave = sortedMessages.slice(0, MAX_PERSISTED_MESSAGES);
        
        // Filter out messages with fileInfo that isn't uploaded (matches AngularJS line 76-86)
        const filteredMessages = messagesToSave.filter(msg => {
          if (!msg.fileInfo) return true; // Text messages always save
          if (msg.fileInfo && (msg.fileInfo as any).fileId) {
            // File is uploaded, save it (but remove file blob)
            const msgCopy = { ...msg };
            if ((msgCopy.fileInfo as any).file) {
              (msgCopy.fileInfo as any).file = null;
            }
            return true;
          }
          return false; // File not uploaded, don't save
        });
        
        if (filteredMessages.length > 0) {
          // Re-sort ascending (oldest first) for storage (matches AngularJS ChatUtils.sortMessages)
          const storageMessages = [...filteredMessages].sort((a, b) => {
            if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
              if (a.sequenceNumber !== b.sequenceNumber) {
                return a.sequenceNumber - b.sequenceNumber;
              }
            }
            return a.timestamp - b.timestamp;
          });
          
          const storeKey = getMessagesStoreKey(accountId, userId, chatId);
          localStorage.setItem(storeKey, JSON.stringify(storageMessages));
        }
      });
    } catch (error) {
      // Handle quota exceeded exception
    }
  }, [getAccountAndUserId]);

  // Load all persisted messages for a chat (matches AngularJS chatLocalStore.selectMessages)
  const loadMessagesFromLocalStore = useCallback((chatId: string): ChatMessage[] => {
    if (typeof window === 'undefined') return [];
    
    const { accountId, userId } = getAccountAndUserId();
    if (!accountId || !userId) return [];
    
    try {
      const storeKey = getMessagesStoreKey(accountId, userId, chatId);
      const storedValue = localStorage.getItem(storeKey);
      if (storedValue) {
        const messages = JSON.parse(storedValue);
        if (Array.isArray(messages) && messages.length > 0) {
          return messages;
        }
      }
    } catch (error) {
      // Error loading messages
    }
    return [];
  }, [getAccountAndUserId]);

  // Auto-save to localStorage when state changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Save failed messages (for retry logic)
      saveFailedMessagesToLocalStore(state);
      // Save all messages (for persistence on reload)
      saveAllMessagesToLocalStore(state);
    }, 500); // Debounce saves to avoid excessive writes
    
    return () => clearTimeout(timeoutId);
  }, [state, saveFailedMessagesToLocalStore, saveAllMessagesToLocalStore]);

  // Get failed messages from localStorage for a chat (matches AngularJS messagesDiskManager.getMessagesForChatId)
  const getFailedMessages = useCallback((chatId: string): ChatMessage[] => {
    if (typeof window === 'undefined') return [];
    
    const { accountId, userId } = getAccountAndUserId();
    if (!accountId || !userId) return [];
    
    try {
      const storeKey = getFailedMessagesStoreKey(accountId, userId);
      const storedValue = localStorage.getItem(storeKey);
      if (storedValue) {
        const data = JSON.parse(storedValue);
        const messages = data[chatId];
        if (Array.isArray(messages)) {
          // Filter out system messages (matches AngularJS line 216)
          return messages.filter((msg: any) => !msg.isSystemMessage);
        }
      }
    } catch (error) {
      // Error loading failed messages
    }
    return [];
  }, [getAccountAndUserId]);

  // Process failed messages and merge with history (matches AngularJS messagesDiskManager.processFailedMessages)
  const processFailedMessages = useCallback((
    chatId: string,
    historyMessages: ChatMessage[],
    existingMessages: ChatMessage[] = [],
    maxSequenceNumber: number = 0
  ): ChatMessage[] => {
    const failedMessages = getFailedMessages(chatId);
    
    if (!failedMessages || failedMessages.length === 0 || historyMessages.length === 0) {
      return historyMessages;
    }
    
    const messagesToPass = [...historyMessages];
    
    // Check if there are more messages before this history (matches AngularJS line 53)
    const hasMoreMessages = historyMessages[0]?.sequenceNumber !== 1;
    const minTimestamp = historyMessages[0]?.timestamp || 0;
    
    // Calculate max timestamp (matches AngularJS lines 55-60)
    let maxTimestamp = 0;
    let chatMaxTimestamp = 0;
    if (existingMessages && existingMessages.length > 0) {
      chatMaxTimestamp = existingMessages[0].timestamp;
    } else if (historyMessages.length > 0) {
      chatMaxTimestamp = historyMessages[historyMessages.length - 1].timestamp;
    }
    maxTimestamp = Math.max(chatMaxTimestamp, historyMessages[historyMessages.length - 1]?.timestamp || 0);
    
    // Merge failed messages into history (matches AngularJS lines 61-70)
    failedMessages.forEach((failedMessage) => {
      const failedMsgTimestamp = failedMessage.timestamp || 0;
      
      // Check if failed message should be included
      if (failedMsgTimestamp >= minTimestamp) {
        if (failedMsgTimestamp <= maxTimestamp || maxSequenceNumber === 0 || failedMsgTimestamp > chatMaxTimestamp) {
          // Check if message already exists in history with real sequenceNumber
          const existingInHistory = messagesToPass.find(m => m.messageId === failedMessage.messageId);
          if (existingInHistory && existingInHistory.sequenceNumber && existingInHistory.sequenceNumber > 0) {
            // Message already exists with real sequenceNumber, delete from failed storage
            const { accountId, userId } = getAccountAndUserId();
            if (accountId && userId) {
              try {
                const storeKey = getFailedMessagesStoreKey(accountId, userId);
                const storedValue = localStorage.getItem(storeKey);
                if (storedValue) {
                  const data = JSON.parse(storedValue);
                  if (data[chatId]) {
                    const messages = data[chatId];
                    const index = messages.findIndex((m: any) => m.messageId === failedMessage.messageId);
                    if (index >= 0) {
                      messages.splice(index, 1);
                      if (messages.length === 0) {
                        delete data[chatId];
                      }
                      localStorage.setItem(storeKey, JSON.stringify(data));
                    }
                  }
                }
              } catch (error) {
                // Error deleting from localStorage
              }
            }
          } else {
            // Add failed message to history
            messagesToPass.push(failedMessage);
          }
        }
      } else if (!hasMoreMessages) {
        // If no more messages before this history, include all failed messages
        const existingInHistory = messagesToPass.find(m => m.messageId === failedMessage.messageId);
        if (!existingInHistory || !existingInHistory.sequenceNumber || existingInHistory.sequenceNumber === 0) {
          messagesToPass.push(failedMessage);
        }
      }
    });
    
    // Sort merged messages (matches AngularJS Util.sortMessages)
    return messagesToPass.sort((a, b) => {
      if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
        if (a.sequenceNumber !== b.sequenceNumber) {
          return a.sequenceNumber - b.sequenceNumber;
        }
      }
      return a.timestamp - b.timestamp;
    });
  }, [getFailedMessages, getAccountAndUserId]);

  // Register XMPP message handler (matches AngularJS xmppCallsManager.addListener)
  // Also handles unread count logic (matches AngularJS xmppChatService.messagesLoaderReceivedMessageInChat lines 746-799)
  // CRITICAL: Use dispatch directly (it's stable) and don't access state in closure
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    
    const messageHandler = (message: ChatMessage) => {
      // CRITICAL: Log handler invocation FIRST to verify messages are being received
      console.log('[MessagesContext] 🔔🔔🔔 MESSAGE HANDLER CALLED - Message received from XMPP!');
      console.log('[MessagesContext] 📥 Received message:', {
        messageId: message.messageId,
        chatId: message.chatId,
        senderId: message.senderId,
        messageText: message.messageText.substring(0, 50),
        sequenceNumber: message.sequenceNumber,
        timestamp: message.timestamp,
      });
      
      // CRITICAL: This matches AngularJS xmppMessageReceived → processP2PMessage → messagesLoaderReceivedMessageInChat flow
      // Step 1: Get current user ID (matches AngularJS this.usersManager.getThisUser().userId)
      const getCurrentUserId = () => {
        if (typeof window !== 'undefined') {
          const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
          return sessionData?.user?.user_id || '';
        }
        return '';
      };
      const currentUserId = getCurrentUserId();
      const isOwnMessage = message.senderId === currentUserId;
      
      console.log('[MessagesContext] 🔍 Message ownership:', {
        senderId: message.senderId,
        currentUserId,
        isOwnMessage,
      });
      
      // Step 2: Ensure chat exists (matches AngularJS xmppMessageReceived lines 1988-2004)
      // If chat doesn't exist, we need to create it in ChatListContext
      // Dispatch event to ChatListContext to ensure chat exists
      if (typeof window !== 'undefined') {
        console.log('[MessagesContext] 📤 Dispatching ensureChatExistsForMessage event');
        const ensureChatExistsEvent = new CustomEvent('ensureChatExistsForMessage', {
          detail: {
            chatId: message.chatId,
            message,
            senderId: message.senderId,
            timestamp: message.timestamp,
            sequenceNumber: message.sequenceNumber,
          },
        });
        window.dispatchEvent(ensureChatExistsEvent);
      }
      
      // Step 3: Add message to store (matches AngularJS chat.addMessage → messagesLoaderReceivedMessageInChat)
      // The reducer will handle matching and replacing optimistic messages
      // CRITICAL: Dispatch immediately - don't check state here (stale closure issue)
      console.log('[MessagesContext] 🚀🚀🚀 Dispatching ADD_MESSAGE action to reducer:', {
        messageId: message.messageId,
        chatId: message.chatId,
        sequenceNumber: message.sequenceNumber,
        isOwnMessage,
        senderId: message.senderId,
        messageText: message.messageText.substring(0, 50),
      });
      dispatch({ type: 'ADD_MESSAGE', chatId: message.chatId, message });
      console.log('[MessagesContext] ✅ ADD_MESSAGE action dispatched');
      
      // Step 4: Broadcast to other tabs (matches AngularJS multi-tab sync)
      broadcastUpdate('ADD_MESSAGE', message.chatId, { message });
      
      // Step 5: Handle unread count logic (matches AngularJS xmppChatService.messagesLoaderReceivedMessageInChat lines 759-793)
      // Dispatch custom event for unread count update (ChatListContext will listen)
      if (typeof window !== 'undefined' && !(message as any).skipUnreadCount) {
        const unreadCountEvent = new CustomEvent('messageReceivedForUnreadCount', {
          detail: {
            message,
            chatId: message.chatId,
            isOwnMessage,
            currentUserId,
          },
        });
        window.dispatchEvent(unreadCountEvent);
      }
      
      // Step 6: Update chat's last message info (matches AngularJS processP2PMessage lines 2112-2115)
      // Dispatch event to ChatListContext to update chat's lastMessageTimestamp and sequenceNumber
      if (typeof window !== 'undefined') {
        const updateChatLastMessageEvent = new CustomEvent('updateChatLastMessage', {
          detail: {
            chatId: message.chatId,
            timestamp: message.timestamp,
            sequenceNumber: message.sequenceNumber,
            senderId: message.senderId,
          },
        });
        window.dispatchEvent(updateChatLastMessageEvent);
      }
      
      // Step 7: CRITICAL - Handle messagesDiskManager logic (matches AngularJS messagesDiskManager.deleteMessageWithIdForChatId)
      // If message has real sequenceNumber (> 0), it means server ACK arrived
      // Delete it from failed messages storage (matches AngularJS line 1723, 2134)
      if (message.sequenceNumber > 0) {
        const { accountId, userId } = getAccountAndUserId();
        if (accountId && userId) {
          try {
            const storeKey = getFailedMessagesStoreKey(accountId, userId);
            const storedValue = localStorage.getItem(storeKey);
            if (storedValue) {
              const data = JSON.parse(storedValue);
              if (data[message.chatId]) {
                const messages = data[message.chatId];
                const index = messages.findIndex((m: any) => m.messageId === message.messageId);
                if (index >= 0) {
                  // Mark as deleted and remove (matches AngularJS line 164)
                  messages.splice(index, 1);
                  if (messages.length === 0) {
                    delete data[message.chatId];
                  }
                  // Save to localStorage (matches AngularJS line 175)
                  localStorage.setItem(storeKey, JSON.stringify(data));
                  console.log('[MessagesContext] ✅ Deleted message from failed_messages storage:', message.messageId);
                }
              }
            }
          } catch (error) {
            // Handle quota exceeded exception (matches AngularJS line 187-190)
            console.error('[MessagesContext] ❌ Error deleting from localStorage:', error);
          }
        }
      }
    };
    
    xmppChatService.addMessageHandler(messageHandler);
    
    return () => {
      xmppChatService.removeMessageHandler(messageHandler);
      isInitializedRef.current = false;
    };
  }, [dispatch, broadcastUpdate, getAccountAndUserId]);

  // Context methods
  const addMessage = useCallback((chatId: string, message: ChatMessage) => {
    try {
      console.log('[MessagesContext] 🚀 addMessage called:', {
        messageId: message.messageId,
        chatId,
        sequenceNumber: message.sequenceNumber,
        dispatchType: typeof dispatch,
      });
      
      if (typeof dispatch !== 'function') {
        console.error('[MessagesContext] ❌ dispatch is not a function!');
        return;
      }
      
      // CRITICAL: Save optimistic/failed messages to localStorage (matches AngularJS messagesDiskManager.saveMessageForChatId)
      // Only save if sequenceNumber === 0 (optimistic) or isRetrying === true (failed)
      // Only save if message doesn't have fileInfo (matches AngularJS lines 489-490, 692-693, 870-871)
      if ((message.sequenceNumber === 0 || message.isRetrying === true) && !message.fileInfo) {
        const { accountId, userId } = getAccountAndUserId();
        if (accountId && userId) {
          try {
            const storeKey = getFailedMessagesStoreKey(accountId, userId);
            let storedValue = localStorage.getItem(storeKey);
            let data: Record<string, ChatMessage[]> = {};
            
            if (storedValue) {
              try {
                data = JSON.parse(storedValue);
              } catch (e) {
                data = {};
              }
            }
            
            // Initialize chat array if needed (matches AngularJS lines 100-102)
            if (!data[chatId]) {
              data[chatId] = [];
            }
            
            // Check if message already exists (matches AngularJS lines 134-142)
            const existingIndex = data[chatId].findIndex((m: any) => m.messageId === message.messageId);
            if (existingIndex < 0) {
              // Add message to array (matches AngularJS line 145)
              data[chatId].push(message);
              
              // Save to localStorage (matches AngularJS saveToLocalStore line 184)
              localStorage.setItem(storeKey, JSON.stringify(data));
              console.log('[MessagesContext] 💾 Saved optimistic message to failed_messages storage:', message.messageId);
            }
          } catch (error) {
            // Handle quota exceeded exception (matches AngularJS line 187-190)
            console.error('[MessagesContext] ❌ Error saving to localStorage:', error);
          }
        }
      }
      
      console.log('[MessagesContext] 📤 Dispatching ADD_MESSAGE action');
      dispatch({ type: 'ADD_MESSAGE', chatId, message });
      broadcastUpdate('ADD_MESSAGE', chatId, { message });
      console.log('[MessagesContext] ✅ addMessage completed');
    } catch (error) {
      console.error('[MessagesContext] ❌ Error in addMessage:', error);
    }
  }, [broadcastUpdate, dispatch, getAccountAndUserId]);

  const updateMessage = useCallback((chatId: string, messageId: string, updates: Partial<ChatMessage>) => {
    console.log('[MessagesContext] 📤 updateMessage called (before dispatch):', {
      chatId,
      messageId,
      updatesFileInfo: updates.fileInfo,
      updatesFileId: updates.fileInfo?.fileId,
      updatesFileIdType: typeof updates.fileInfo?.fileId,
      hasUpdates: !!updates,
      updatesKeys: Object.keys(updates),
      dispatchType: typeof dispatch,
      hasDispatch: !!dispatch,
    });
    
    // CRITICAL: Verify dispatch exists
    if (!dispatch) {
      console.error('[MessagesContext] ❌ CRITICAL: dispatch is undefined!');
      return;
    }
    
    try {
      const action = { type: 'UPDATE_MESSAGE' as const, chatId, messageId, updates };
      console.log('[MessagesContext] 📤 Dispatching UPDATE_MESSAGE action:', {
        actionType: action.type,
        chatId: action.chatId,
        messageId: action.messageId,
        updatesFileId: action.updates.fileInfo?.fileId,
      });
      
      dispatch(action);
      console.log('[MessagesContext] ✅ UPDATE_MESSAGE action dispatched successfully');
    } catch (error) {
      console.error('[MessagesContext] ❌ Error dispatching UPDATE_MESSAGE:', error);
      throw error;
    }
    
    broadcastUpdate('UPDATE_MESSAGE', chatId, { messageId, updates });
  }, [broadcastUpdate, dispatch]);

  const removeMessage = useCallback((chatId: string, messageId: string) => {
    dispatch({ type: 'REMOVE_MESSAGE', chatId, messageId });
    broadcastUpdate('REMOVE_MESSAGE', chatId, { messageId });
  }, [broadcastUpdate]);

  const setMessages = useCallback((chatId: string, messages: ChatMessage[]) => {
    dispatch({ type: 'SET_MESSAGES', chatId, messages });
    broadcastUpdate('SET_MESSAGES', chatId, { messages });
  }, [broadcastUpdate]);

  const mergeMessages = useCallback((chatId: string, newMessages: ChatMessage[]) => {
    dispatch({ type: 'MERGE_MESSAGES', chatId, messages: newMessages });
    broadcastUpdate('MERGE_MESSAGES', chatId, { messages: newMessages });
  }, [broadcastUpdate]);

  const prependMessages = useCallback((chatId: string, olderMessages: ChatMessage[]) => {
    console.log('[MessagesContext] 📜 prependMessages called:', {
      chatId,
      olderCount: olderMessages.length,
    });
    dispatch({ type: 'PREPEND_MESSAGES', chatId, messages: olderMessages });
    
    // Dispatch event to update minSequenceNumber in ChatListContext (matches AngularJS chat.prependMessages updating chat.minSequenceNumber)
    if (typeof window !== 'undefined' && olderMessages.length > 0) {
      // Find minimum sequence number from prepended messages
      const minSeq = Math.min(...olderMessages.map(m => m.sequenceNumber || 0).filter(seq => seq > 0));
      if (minSeq > 0) {
        window.dispatchEvent(new CustomEvent('messagesPrepended', {
          detail: { chatId, minSequenceNumber: minSeq }
        }));
      }
    }
    
    // Note: We don't broadcast PREPEND_MESSAGES to other tabs as it's a local scroll action
    // Other tabs will load their own older messages when user scrolls
  }, []);

  const getMessages = useCallback((chatId: string): ChatMessage[] => {
    return state[chatId] || [];
  }, [state]);

  // CRITICAL: Create new value object when state changes
  // React Context compares by reference, so when state changes, we need a new value object
  // IMPORTANT: Only depend on state - callbacks are stable (useCallback with stable deps)
  const value: MessagesContextType = React.useMemo(() => {
    console.log('[MessagesContext] 🔄 Context value recalculating:', {
      stateKeys: Object.keys(state),
      stateChatIds: Object.keys(state).map(key => ({ chatId: key, count: state[key]?.length || 0 })),
      hasUpdateMessage: typeof updateMessage === 'function',
      updateMessageType: typeof updateMessage,
    });
    return {
      messages: state,
      addMessage,
      updateMessage,
      removeMessage,
      setMessages,
      mergeMessages,
      prependMessages,
      getMessages,
      processFailedMessages,
      getFailedMessages,
      loadMessagesFromLocalStore,
    };
  }, [state, addMessage, updateMessage, removeMessage, setMessages, mergeMessages, prependMessages, getMessages, processFailedMessages, getFailedMessages, loadMessagesFromLocalStore]);

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within MessagesProvider');
  }
  return context;
}

// Helper to generate unique tab ID (matches AngularJS clientInstanceId)
function getTabId(): string {
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
}

