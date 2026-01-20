/**
 * Message Types - Replicates AngularJS chat message model
 * Based on: web_app/src/app/chat/sdk/vos/chatMessage.js
 */

export interface ChatMessage {
  messageId: string;
  senderId: string;
  chatId: string;
  messageText: string;
  timestamp: number;
  sequenceNumber: number;
  isDeleted: boolean;
  isEdited: boolean;
  isFakeMessage?: boolean;
  isRetrying?: boolean; // Matches AngularJS message.isRetrying // Optimistic UI message
  isRetrying?: boolean;
  isSystemMessage?: boolean | number; // Can be boolean or number (system message type)
  type?: string; // Message type (e.g., 'system', 'message')
  edited_timestamp?: number; // Timestamp when message was edited
  
  // File info (if message has attachment)
  // Matches AngularJS chatMessage.js fileInfo structure
  fileInfo?: {
    fileId?: string;
    fileName?: string;
    name?: string; // Alternative name field (matches AngularJS)
    fileSize?: number;
    size?: number; // Alternative size field (matches AngularJS)
    fileType?: string;
    type?: string; // Alternative type field (matches AngularJS)
    fileFormat?: string; // File format (e.g., 'GIF', 'IMAGE', 'VIDEO')
    format?: string; // Alternative format field (matches AngularJS)
    thumbnailName?: string; // Thumbnail file name
    thumbnail_name?: string; // Alternative thumbnail name (matches AngularJS)
    originalName?: string; // Original file name
    original_name?: string; // Alternative original name (matches AngularJS)
    width?: number; // Image/video width
    height?: number; // Image/video height
    isUploading?: boolean;
    isVoice?: boolean; // Voice message flag
    duration?: number; // Voice/video duration
    available_previews?: number; // Number of preview pages
    preview_name?: string; // Preview file name
    no_of_pages?: number; // Number of pages (for PDFs)
    storage_version?: number; // Storage version
  };

  // Reply/Quote info
  messageReply?: {
    messageId: string;
    messageText: string;
    senderId: string;
  };

  // Forward info
  messageForward?: {
    originalSenderId: string;
  };

  // View metadata (for UI rendering)
  // Note: AngularJS uses 0/1 for boolean flags (matches messageListTempCalculator.js)
  _view?: {
    showDate?: boolean;
    dateToShow?: string;
    showUserName?: boolean;
    time?: string;
    messageText?: string; // Processed message text (with <br> tags)
    isSingleEmoji?: boolean;
    otherUserWithImg?: number | boolean; // 0 or 1 (matches AngularJS)
    otherUserWithoutImg?: number | boolean; // 0 or 1 (matches AngularJS)
    thisUserWithImg?: number | boolean; // 0 or 1 (matches AngularJS)
    thisUserWithoutImg?: number | boolean; // 0 or 1 (matches AngularJS)
    _user?: {
      userId: string;
      displayName: string;
      profileImageType?: string;
      profileImageVersion?: string;
    };
  };
}

/**
 * Message send options (matches Angular chatManager.sendMessage parameters)
 */
export interface SendMessageOptions {
  messageText: string;
  chatId: string;
  replyToMessageId?: string;
  forwardedMessageId?: string;
  isUnifiedChat?: boolean;
  unifiedNetworkAccountId?: string;
}




