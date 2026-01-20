'use client';

/**
 * MessageBubble - Individual message bubble
 * 
 * Replicates Angular message templates
 * File: messageList.tpl.html
 */

import React, { useMemo } from 'react';
import type { ChatMessage } from '@/types/message';
import UserProfileImage from '@/components/common/UserProfileImage';
import { getTimeFormatHmma } from '@/utils/timestampUtils';
import { isTextSingleEmoji } from '@/utils/emojiUtils';
import { resolveServicesHostString } from '@/lib/config/services-host';
import { useMessages } from '@/contexts/MessagesContext';
import './MessageBubble.css';

// Helper function to check if device is retina (matches AngularJS utils.isRetina())
function isRetina(): boolean {
  if (typeof window === 'undefined') return false;
  return window.devicePixelRatio > 1 || (window.matchMedia && window.matchMedia('(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)').matches);
}

// Helper function to get thumbnail size (matches AngularJS getNoteThumbnailPath filter)
function getThumbnailSize(fileVer?: number): string {
  const retina = isRetina();
  
  if (fileVer && fileVer >= 5) {
    return retina ? '980x500/' : '490x250/';
  } else if (fileVer === 4 && retina) {
    return '855x900/';
  } else if (fileVer && fileVer >= 3) {
    return '566x600/';
  }
  return '';
}

// Helper function to get load-balanced AWS file dir base (matches AngularJS config.getLoadBalancedAwsFileDirBase)
function getLoadBalancedAwsFileDirBase(fileIdx: number = 0): string {
  if (typeof window === 'undefined') return '';
  
  const config = (window as any).com_convo?.config;
  if (!config) return '';
  
  // Use config.AWS_FILE_DIR_BASE if available
  if (config.AWS_FILE_DIR_BASE) {
    return config.AWS_FILE_DIR_BASE;
  }
  
  // Fallback: construct from servicesHost
  const servicesHost = config.servicesHost || 
    (typeof window !== 'undefined' ? (window as any).servicesHost : undefined) ||
    resolveServicesHostString({ allowWindow: true });
  const apiVersion = config.API_VERSION || 'v1';
  
  if (servicesHost) {
    return `https://${servicesHost}/api/${apiVersion}/files/`;
  }
  
  return '';
}

// Helper function to generate thumbnail URL (matches AngularJS getNoteThumbnailPath filter)
// Matches AngularJS: getNoteThumbnailPath(file, chatId, null, null, size, isUnifiedChat)
function getThumbnailUrl(thumbnailName: string, chatId: string, storageVersion?: number, isUnifiedChat?: boolean, fileVer?: number, size?: string): string {
  if (!thumbnailName) return '';
  
  if (typeof window === 'undefined') return '';
  
  const config = (window as any).com_convo?.config;
  const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
  const networkSettingService = (window as any).com_convo?.networkSettingService;
  
  if (!config || !sessionData) return '';
  
  // Get thumbnail size (matches AngularJS lines 690-708)
  let thumbnailSize = size;
  if (!thumbnailSize) {
    thumbnailSize = getThumbnailSize(fileVer);
  } else {
    thumbnailSize += '/';
  }
  
  // Get base URL (matches AngularJS config.getLoadBalancedAwsFileDirBase)
  const baseUrl = getLoadBalancedAwsFileDirBase(0);
  if (!baseUrl) {
    console.warn('[MessageBubble] Cannot construct thumbnail URL - missing base URL');
    return '';
  }
  
  let accountId = sessionData.account_id;
  
  // Handle unified chat (matches AngularJS lines 723-730)
  if (isUnifiedChat && networkSettingService?.IsAllowChatAcrossNetwork?.()) {
    const unifiedNetworkId = networkSettingService.getUnifiedNetworkAccountId?.();
    if (unifiedNetworkId) {
      accountId = unifiedNetworkId;
    }
  }
  
  if (!accountId) return '';
  
  // Construct URL based on storage_version (matches AngularJS lines 737-747)
  let url: string;
  const storageVer = storageVersion ? parseInt(String(storageVersion)) : 0;
  
  if (storageVer > 0) {
    // For storage_version > 0: accountId + "/attachments" + "/thumbnails/" + size + thumbnailName
    url = `${baseUrl}${accountId}/attachments/thumbnails/${thumbnailSize}${thumbnailName}`;
  } else {
    // For storage_version = 0: accountId + "/note" + chatId + "/thumbnails/" + size + thumbnailName
    url = `${baseUrl}${accountId}/note${chatId}/thumbnails/${thumbnailSize}${thumbnailName}`;
  }
  
  return url;
}

// Helper function to generate file URL (matches AngularJS getOriginalImagePath filter)
// Matches AngularJS: getOriginalImagePath(originalName, chatId, null, null, null, isUnifiedChat, storage_version)
function getFileUrl(fileName: string, chatId: string, storageVersion?: number, isUnifiedChat?: boolean): string {
  if (!fileName) return '';
  
  // Get config and account ID from window (matches AngularJS config and $rootScope.login_data.account_id)
  if (typeof window === 'undefined') return '';
  
  const config = (window as any).com_convo?.config;
  const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
  const networkSettingService = (window as any).com_convo?.networkSettingService;
  
  if (!config || !sessionData) return '';
  
  // Get base URL - matches AngularJS config.AWS_FILE_DIR_BASE = "https://"+window["servicesHost"]+"/api/" + config.API_VERSION + "/files/"
  // Use config.AWS_FILE_DIR_BASE if available, otherwise construct from servicesHost
  let baseUrl = config.AWS_FILE_DIR_BASE;
  
  if (!baseUrl) {
    // Fallback: construct from servicesHost (matches AngularJS line 72)
    const servicesHost = config.servicesHost || 
      (typeof window !== 'undefined' ? (window as any).servicesHost : undefined) ||
      resolveServicesHostString({ allowWindow: true });
    const apiVersion = config.API_VERSION || 'v1';
    
    if (servicesHost) {
      baseUrl = `https://${servicesHost}/api/${apiVersion}/files/`;
    } else {
      console.warn('[MessageBubble] Cannot construct file URL - missing AWS_FILE_DIR_BASE and servicesHost');
      return '';
    }
  }
  
  let accountId = sessionData.account_id;
  
  // Handle unified chat (matches AngularJS lines 987-989)
  if (isUnifiedChat && networkSettingService?.IsAllowChatAcrossNetwork?.()) {
    const unifiedNetworkId = networkSettingService.getUnifiedNetworkAccountId?.();
    if (unifiedNetworkId) {
      accountId = unifiedNetworkId;
    }
  }
  
  if (!accountId) return '';
  
  // Construct URL based on storage_version (matches AngularJS lines 991-995)
  // If storageVersion is truthy, use: accountId + "/attachments/" + originalName
  // Otherwise, use: accountId + "/note" + chatId + "/" + originalName (appInstanceId is null, so _dir = 'note')
  let url: string;
  if (storageVersion && storageVersion > 0) {
    url = `${baseUrl}${accountId}/attachments/${fileName}`;
  } else {
    // For chats, appInstanceId is null, so _dir defaults to 'note' (matches AngularJS line 974)
    url = `${baseUrl}${accountId}/note${chatId}/${fileName}`;
  }
  
  // Debug logging (can be removed in production)
  if (typeof window !== 'undefined' && (window as any).__DEBUG_FILE_URL__) {
    console.log('[MessageBubble] Generated file URL:', {
      fileName,
      chatId,
      storageVersion,
      isUnifiedChat,
      accountId,
      url,
    });
  }
  
  return url;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  showDate?: boolean;
  dateToShow?: string;
}

export default function MessageBubble({
  message,
  isOwnMessage,
  showAvatar = false,
  showSenderName = false,
  showDate = false,
  dateToShow,
}: MessageBubbleProps) {
  const messagesContext = useMessages();
  
  // CRITICAL: Log every render to detect duplicate rendering
  // console.log('[MessageBubble] Component rendered:', {
  //   messageId: message.messageId,
  //   isOwnMessage,
  //   hasFileInfo: !!message.fileInfo,
  //   fileId: message.fileInfo?.fileId,
  //   timestamp: Date.now(),
  // });
  
  // Use edited timestamp if message is edited, otherwise use regular timestamp
  const timestampToUse = message.isEdited && (message as any).edited_timestamp 
    ? (message as any).edited_timestamp 
    : message.timestamp;
  const timeStr = getTimeFormatHmma(timestampToUse);
  
  // Handler for remove button (matches AngularJS remove() and cancelMessageItem())
  const handleRemoveFile = () => {
    if (message.chatId && message.messageId) {
      messagesContext.removeMessage(message.chatId, message.messageId);
    }
  };
  
  // CRITICAL: Single check function to determine which UI to render (upload UI or final display)
  // This ensures only ONE state renders, preventing both from showing
  // CRITICAL: Use useMemo to ensure this is computed only once per message/fileInfo change
  const fileAttachmentRenderState = useMemo(() => {
    if (!isOwnMessage) return null;
    
    const hasFileInfo = !!message.fileInfo;
    if (!hasFileInfo) return null; // No fileInfo, don't render anything
    
    const fileId = message.fileInfo?.fileId;
    // CRITICAL: Check if fileId exists and is a non-empty string
    // CRITICAL: Be very strict - only truthy non-empty strings count as having fileId
    const hasFileId = !!fileId && 
      fileId !== '' && 
      fileId !== null && 
      fileId !== undefined && 
      String(fileId).trim() !== '' &&
      fileId !== 'undefined' &&
      fileId !== 'null';
    
    // CRITICAL: Return a single value that determines which UI to show
    // 'UPLOAD_UI' = show upload UI (file icon placeholder) - ONLY when fileId is missing
    // 'FINAL_DISPLAY' = show final display (GIF) - ONLY when fileId exists
    // null = don't render anything
    const renderState = hasFileId ? 'FINAL_DISPLAY' : 'UPLOAD_UI';
    
    console.log('[MessageBubble] File attachment render state (own message):', {
      messageId: message.messageId,
      hasFileInfo,
      fileId,
      fileIdType: typeof fileId,
      fileIdString: String(fileId),
      hasFileId,
      renderState,
      originalName: message.fileInfo?.originalName,
      original_name: message.fileInfo?.original_name,
      thumbnailName: message.fileInfo?.thumbnailName,
      thumbnail_name: message.fileInfo?.thumbnail_name,
      fileInfo: message.fileInfo ? JSON.parse(JSON.stringify(message.fileInfo)) : null, // Deep clone for accurate logging
      isUploading: message.fileInfo?.isUploading,
      fileName: message.fileInfo?.name,
      gifUrl: (message as any).gifUrl,
      sequenceNumber: message.sequenceNumber,
      timestamp: message.timestamp,
    });
    
    // CRITICAL: If fileId exists but originalName doesn't, log warning
    if (hasFileId && message.fileInfo?.type?.toUpperCase() === 'GIF' && !message.fileInfo?.originalName && !message.fileInfo?.original_name) {
      console.warn('[MessageBubble] ⚠️ GIF has fileId but no originalName - GIF won\'t render!', {
        messageId: message.messageId,
        fileId,
        originalName: message.fileInfo?.originalName,
        original_name: message.fileInfo?.original_name,
        thumbnailName: message.fileInfo?.thumbnailName,
      });
    }
    
    // CRITICAL: If renderState is UPLOAD_UI but fileId exists, log error
    if (renderState === 'UPLOAD_UI' && fileId) {
      console.error('[MessageBubble] ❌ INCONSISTENT STATE: renderState is UPLOAD_UI but fileId exists!', {
        messageId: message.messageId,
        fileId,
        fileIdType: typeof fileId,
        renderState,
      });
    }
    
    // CRITICAL: If renderState is FINAL_DISPLAY but fileId doesn't exist, log error
    if (renderState === 'FINAL_DISPLAY' && !fileId) {
      console.error('[MessageBubble] ❌ INCONSISTENT STATE: renderState is FINAL_DISPLAY but fileId doesn\'t exist!', {
        messageId: message.messageId,
        fileId,
        fileIdType: typeof fileId,
        renderState,
      });
    }
    
    // CRITICAL: Assert that renderState is never both UPLOAD_UI and FINAL_DISPLAY
    if (renderState !== 'UPLOAD_UI' && renderState !== 'FINAL_DISPLAY' && renderState !== null) {
      console.error('[MessageBubble] ❌ Invalid renderState:', renderState);
    }
    
    return renderState;
  }, [
    isOwnMessage, 
    message.messageId, 
    message.fileInfo?.fileId, 
    message.fileInfo?.name, 
    message.fileInfo?.isUploading,
    message.fileInfo?.originalName,
    message.fileInfo?.original_name,
    message.sequenceNumber,
    message.timestamp,
  ]);
  
  // CRITICAL: Add defensive check to prevent both states from rendering
  // If fileAttachmentRenderState is null, don't render file attachment UI at all
  const shouldRenderFileAttachment = fileAttachmentRenderState !== null;
  
  // Check if message is a single emoji (matches AngularJS logic)
  // Only apply noBackground if it's a single emoji AND no reply/forward/edit
  const isSingleEmoji = message._view?.isSingleEmoji !== undefined 
    ? message._view.isSingleEmoji 
    : isTextSingleEmoji(message.messageText);
  const shouldRemoveBackground = isSingleEmoji && 
    !message.messageReply && 
    !message.messageForward && 
    !message.isEdited;
  
  // Render system message - Matches AngularJS messageList.tpl.html lines 220-227
  if (message.isSystemMessage && message._view?.messageToDisplay) {
    return (
      <div className="chat-message-bubble" style={{ clear: 'both' }}>
        <div className="system-chat-msg" style={{
          fontSize: '13px',
          color: '#7b8386',
          textAlign: 'center',
          padding: '8px 10px',
          clear: 'both',
        }}>
          <span dangerouslySetInnerHTML={{ __html: message._view.messageToDisplay }} style={{ whiteSpace: 'pre-wrap' }} />
        </div>
        {message._view.showTime && (
          <div className="dateChatSeparator show-time" style={{
            fontSize: '13px',
            color: '#7b8386',
            textAlign: 'center',
            padding: '4px 0',
            clear: 'both',
          }}>
            <span>{message._view.showTime}</span>
          </div>
        )}
      </div>
    );
  }

  if (isOwnMessage) {
    // This user's message (right-aligned) - Matches AngularJS messageList.tpl.html lines 145-174
    // Structure: chat-message-bubble > messsage-meta > dateChatSeparator (if showDate) > chat-message > messageFromMe
    return (
      <div className="chat-message-bubble" style={{ clear: 'both' }}>
        {/* messsage-meta wrapper - Matches AngularJS line 15 */}
        <div className="messsage-meta">
          {/* Date separator - Matches AngularJS messageList.tpl.html line 16-18 */}
          {showDate && dateToShow && (
            <div className="dateChatSeparator" style={{
              fontSize: '13px',
              color: '#7b8386',
              textAlign: 'center',
              padding: '8px 0',
              clear: 'both',
              width: '100%',
            }}>
              <span>{dateToShow}</span>
            </div>
          )}
        </div>
        
        {/* File attachment - Render OUTSIDE message bubble (matches AngularJS ChatMessage.tpl.html lines 63-170) */}
        {/* CRITICAL: Match AngularJS EXACTLY - use separate divs with mutually exclusive conditions */}
        {/* AngularJS line 76: <div bo-if="!msgItem.fileInfo.fileId" cnv-upload-file-ui ...> */}
        {/* AngularJS line 95: <div bo-if="msgItem.fileInfo.fileId" class="message-with-thumbnail" ...> */}
        {/* CRITICAL: These are SEPARATE divs in AngularJS, so they're truly mutually exclusive */}
        {fileAttachmentRenderState === 'UPLOAD_UI' && (
          /* Upload UI - Matches AngularJS line 76-93 (when !fileInfo.fileId or isUploading) */
          <div className="chat-message" style={{ clear: 'both', float: 'right', marginRight: '10px', marginLeft: '5px', maxWidth: '94%' }}>
            <div className="message-with-thumbnail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              {/* Upload box - Matches AngularJS attachment-box */}
              <div className="attachment-box" style={{ 
                backgroundColor: 'white',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid #eee',
                borderBottom: 'none',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                overflow: 'hidden',
                minWidth: '155px',
                position: 'relative',
                height: '100px', // Matches AngularJS file-thumb-cont height
                width: '180px', // Matches AngularJS file-thumb-cont width
              }}>
                {/* Progress bar at top - Matches AngularJS progress-line (thin blue line at top) */}
                {message.fileInfo?.isUploading && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: '#4183d7',
                    width: message.fileInfo.progress ? `${message.fileInfo.progress}%` : '100%',
                    zIndex: 4,
                  }} />
                )}
                
                {/* Background overlay - Matches AngularJS attachment-box-background */}
                <div className="attachment-box-background" style={{ border: 'none', pointerEvents: 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />
                
                {/* Remove button (X icon) - Matches AngularJS remove-file (top-right corner) */}
                {/* Only show if file is not uploaded yet (matches AngularJS bo-if="!file.fileUploaded") */}
                {!message.fileInfo?.fileId && (
                  <div 
                    className="remove-file" 
                    onClick={handleRemoveFile}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '10px', // Matches AngularJS .remove-file { right: 10px; }
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      zIndex: 5, // Above spinner and other elements
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: '50%',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      lineHeight: '1',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                    }}
                  >
                    ×
                  </div>
                )}
                
                {/* File icon placeholder - Matches AngularJS file icon display */}
                {/* In AngularJS, when file.localUrl doesn't exist or fails, it shows fileplainlarge.png */}
                {/* For GIF files, we show a file icon with "GIF" label */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  paddingTop: '20px',
                }}>
                  {/* File icon - Matches AngularJS file icon (document with file type label) */}
                  <div style={{
                    position: 'relative',
                    width: '64px',
                    height: '64px',
                    marginBottom: '8px',
                  }}>
                    {/* Document icon background */}
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}>
                      {/* File type label (GIF) - Matches AngularJS green label on document */}
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        backgroundColor: '#4caf50',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        textTransform: 'uppercase',
                      }}>
                        {message.fileInfo.type?.toUpperCase() || 'GIF'}
                      </div>
                      {/* Document icon (folded corner) */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '20px',
                        height: '20px',
                        backgroundColor: '#e0e0e0',
                        borderBottomLeftRadius: '4px',
                        clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                      }} />
                    </div>
                  </div>
                  
                  {/* File name - Matches AngularJS fileNames (shown below icon) */}
                  {message.fileInfo.name && (
                    <span className="fileNames" style={{ 
                      margin: '0',
                      fontSize: '14px',
                      color: '#4183d7',
                      paddingTop: '0px',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      wordWrap: 'break-word',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '1.2',
                      position: 'relative',
                      zIndex: 2,
                      maxWidth: '160px',
                      textAlign: 'center',
                    }}>
                      {message.fileInfo.name}
                    </span>
                  )}
                </div>
                
                {/* Progress bar with spinner - Matches AngularJS progress-bar */}
                {/* CRITICAL: Only show spinner when uploading (matches AngularJS ng-if="isInProgress()") */}
                {/* In AngularJS, isInProgress() checks if file is uploading/converting, not if fileId exists */}
                {message.fileInfo?.isUploading ? (
                  <div className="progress-bar" style={{ 
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 3,
                    pointerEvents: 'none',
                  }}>
                    <div className="bar-internal" style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {/* Spinner - Matches AngularJS <div class="cnv-spinner"></div> */}
                      <div className="cnv-spinner light" style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: '2px',
                        height: '30px',
                        width: '30px',
                        zIndex: 999,
                      }}>
                        <i className="cnv-circle-spinner-small" />
                      </div>
                    </div>
                    {/* Progress line - Can show upload progress if available */}
                    <div className="progress-line" style={{ 
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      height: '2px',
                      backgroundColor: '#4183d7',
                      width: message.fileInfo.progress ? `${message.fileInfo.progress}%` : '0%',
                      zIndex: 1000,
                    }} />
                  </div>
                ) : null}
              </div>
              {/* Timestamp - Separate div below file (matches AngularJS line 162-164) */}
              <div
                className="notSelectable message-time"
                style={{
                  fontSize: '12px',
                  color: '#aaa',
                  fontWeight: 100,
                  border: '1px solid #eee',
                  borderTop: 'none',
                  padding: '1px 5px',
                  borderBottomLeftRadius: '4px',
                  borderBottomRightRadius: '4px',
                  backgroundColor: '#fff',
                  width: 'fit-content',
                }}
              >
                {message.isEdited === 1 ? `Edited ${timeStr}` : (message._view?.time || timeStr)}
              </div>
            </div>
          </div>
        )}
        
        {/* CRITICAL: Separate div for final display - matches AngularJS line 95 */}
        {/* AngularJS: <div bo-if="msgItem.fileInfo.fileId" class="message-with-thumbnail" ...> */}
        {/* CRITICAL: This is a SEPARATE condition, not an else branch - matches AngularJS structure */}
        {fileAttachmentRenderState === 'FINAL_DISPLAY' && (
          /* File display - Matches AngularJS line 95-170 (when fileInfo.fileId exists and not uploading) */
          <div className="chat-message" style={{ clear: 'both', float: 'right', marginRight: '10px', marginLeft: '5px', maxWidth: '94%' }}>
            <div className="message-with-thumbnail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              {/* File container - Matches AngularJS line 100-101 */}
              <div style={{ 
                backgroundColor: 'white',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid #eee',
                borderBottom: 'none',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
                overflow: 'hidden',
                height: message.fileInfo.height ? `${message.fileInfo.height}px` : 'auto',
                width: message.fileInfo.width ? `${message.fileInfo.width}px` : 'auto',
                maxWidth: '200px',
                maxHeight: '200px',
              }}>
                {message.fileInfo.type?.toUpperCase() === 'GIF' && message.fileInfo.originalName ? (
                  /* GIF rendering - Matches AngularJS line 106-110 */
                  <img
                    className="original-gif gif-image-thumbnail-container"
                    src={getFileUrl(message.fileInfo.originalName, message.chatId, message.fileInfo.storage_version, (message as any).isUnifiedChat)}
                    alt="GIF"
                    style={{
                      height: message.fileInfo.height ? `${message.fileInfo.height}px` : 'auto',
                      width: message.fileInfo.width ? `${message.fileInfo.width}px` : 'auto',
                      maxWidth: '200px',
                      maxHeight: '200px',
                      verticalAlign: 'baseline',
                    }}
                    onError={(e) => {
                      // Hide image on error instead of trying to load fallback that doesn't exist
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : message.fileInfo.thumbnailName || message.fileInfo.thumbnail_name ? (
                  <img
                    src={getThumbnailUrl(
                      message.fileInfo.thumbnailName || message.fileInfo.thumbnail_name || '',
                      message.chatId,
                      message.fileInfo.storage_version,
                      (message as any).isUnifiedChat,
                      (message.fileInfo as any).ver,
                      '566x600' // Default size for chat messages (matches AngularJS line 115)
                    )}
                    alt={message.fileInfo.name || 'File'}
                    style={{
                      width: '100%',
                      height: 'auto',
                      verticalAlign: 'baseline',
                    }}
                    onError={(e) => {
                      // Hide image on error instead of trying to load fallback that doesn't exist
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div style={{ padding: '20px', color: '#7b8386' }}>
                    {message.fileInfo.name || 'File'}
                  </div>
                )}
              </div>
              {/* Timestamp - Separate div below file (matches AngularJS line 162-164) */}
              <div
                className="notSelectable message-time"
                style={{
                  fontSize: '12px',
                  color: '#7b8386',
                  fontWeight: 100,
                  border: '1px solid #eee',
                  borderTop: 'none',
                  padding: '1px 5px 1px',
                  borderBottomLeftRadius: '4px',
                  borderBottomRightRadius: '4px',
                  backgroundColor: '#fff',
                  width: 'fit-content',
                }}
              >
                {message.isEdited === 1 ? `Edited ${timeStr}` : (message._view?.time || timeStr)}
              </div>
            </div>
          </div>
        )}
        
        {/* CRITICAL: Normal text message - only render if no file attachment */}
        {/* Matches AngularJS - text message renders separately from file attachments */}
        {!message.fileInfo && (
          /* Text message - Matches AngularJS line 146-148 */
          <div className="chat-message" style={{ clear: 'both' }}>
            {/* Message container - Matches AngularJS line 150-152 */}
            <div className="message-to-be-selected">
              <div className="message-with-menu-container">
                {/* Message bubble - Matches AngularJS line 153-155 */}
                <div
                  className={`messageFromMe message-content-container ${message.sequenceNumber > 0 || message.isFakeMessage ? 'messageFromMeAckn' : ''} ${shouldRemoveBackground ? 'noBackground single-emoji-msg' : ''}`}
                  style={{
                    padding: shouldRemoveBackground ? '0px' : '4px 7px', // Remove padding for single emoji
                    backgroundColor: shouldRemoveBackground ? 'transparent' : ((message.sequenceNumber > 0 || message.isFakeMessage) ? '#4183d7' : '#8dbefd'), // Remove background for single emoji
                    color: shouldRemoveBackground ? '#aaa' : '#ffffff', // Matches AngularJS .messageFromMe color, gray for single emoji
                    borderRadius: shouldRemoveBackground ? '0' : '5px', // Remove border radius for single emoji
                    maxWidth: shouldRemoveBackground ? '210px' : '225px', // Matches AngularJS .noBackground max-width: 210px
                    minWidth: '0', // Allow shrinking to prevent overflow
                    margin: '1px 10px 1px 5px', // Matches AngularJS margin: 1px 10px 1px 5px
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word', // Additional word breaking
                    textAlign: shouldRemoveBackground ? 'right' : 'left', // Matches AngularJS .messageFromMe.noBackground text-align:right
                    float: 'right', // Matches AngularJS float: right - CRITICAL for right alignment
                    position: 'relative',
                    display: 'inline-block', // Ensure proper display
                    boxSizing: 'border-box', // Include padding in width calculation
                    fontSize: shouldRemoveBackground ? '50px' : undefined, // Matches AngularJS .noBackground font-size:50px
                  }}
                >
                  {/* Message text - Matches AngularJS line 159-162 */}
                  <span 
                    className="chat-msg-cont" 
                    style={{ 
                      whiteSpace: 'pre-wrap',
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: message.isEdited === 1 
                        ? message.messageText.replace(/\n/g, '<br>') 
                        : (message._view?.messageText || message.messageText.replace(/\n/g, '<br>'))
                    }}
                  />
                  {/* Timestamp - Matches AngularJS line 165-167 */}
                  <div
                    className="notSelectable message-time"
                    style={{
                      fontSize: '12px',
                      color: shouldRemoveBackground ? '#7b8386' : '#ffffff', // Gray for single emoji, white for normal
                      fontWeight: 100,
                      marginTop: shouldRemoveBackground ? '4px' : '4px',
                      textAlign: shouldRemoveBackground ? 'center' : 'left', // Center timestamp below emoji
                      width: shouldRemoveBackground ? '100%' : 'auto',
                      display: shouldRemoveBackground ? 'block' : 'block',
                    }}
                  >
                    {message.isEdited === 1 ? `Edited         ${timeStr}` : (message._view?.time || timeStr)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Other user's message (left-aligned) - Matches AngularJS .messageFromOtherUser
  // Color: #f2f4f8 (from @cnv-chat-msg-from-other LESS variable)
  return (
    <div className="chat-message-bubble" style={{ clear: 'both' }}>
      {/* Date separator - Matches AngularJS messageList.tpl.html line 16-18 */}
      {showDate && dateToShow && (
        <div className="dateChatSeparator" style={{
          fontSize: '13px',
          color: '#7b8386',
          textAlign: 'center',
          padding: '8px 0',
          clear: 'both',
          width: '100%',
        }}>
          <span>{dateToShow}</span>
        </div>
      )}
      {/* Sender name - Matches AngularJS messageList.tpl.html lines 20-23 */}
      {showSenderName && message._view?._user && (
        <div
          style={{
            fontSize: '12px',
            width: '100%',
            marginBottom: '2px',
            marginTop: '8px',
            marginLeft: '49px',
            maxWidth: '180px',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            color: '#7b8386',
            clear: 'both',
          }}
        >
          {message._view._user.displayName}
        </div>
      )}
      
      {/* File attachment - Render OUTSIDE message bubble (matches AngularJS ChatMessage.tpl.html lines 63-170) */}
      {/* Upload UI shows when fileId doesn't exist (matches AngularJS: bo-if="!msgItem.fileInfo.fileId") */}
      {/* CRITICAL: Check fileId explicitly - undefined, null, or empty string means upload UI */}
      {(() => {
        const hasFileInfo = !!message.fileInfo;
        if (!hasFileInfo) return null; // No fileInfo, don't render anything
        
        // CRITICAL: Match AngularJS exactly - check if fileId is falsy (undefined, null, empty string, or doesn't exist)
        // Use the same check logic as own message to ensure consistency
        const fileId = message.fileInfo?.fileId;
        // CRITICAL: Check if fileId exists and is a non-empty string
        const hasFileId = !!fileId && fileId !== '' && fileId !== null && fileId !== undefined && String(fileId).trim() !== '';
        
        // CRITICAL: Return a single value that determines which UI to show
        // 'UPLOAD_UI' = show upload UI (file icon placeholder)
        // 'FINAL_DISPLAY' = show final display (GIF)
        // null = don't render anything
        const renderState = hasFileId ? 'FINAL_DISPLAY' : 'UPLOAD_UI';
        
        // Always log for debugging (can be removed later)
        console.log('[MessageBubble] File attachment render state (other message):', {
          messageId: message.messageId,
          hasFileInfo,
          fileId,
          fileIdType: typeof fileId,
          hasFileId,
          renderState,
          fileInfo: message.fileInfo,
          isUploading: message.fileInfo?.isUploading,
          fileName: message.fileInfo?.name,
          gifUrl: (message as any).gifUrl,
        });
        
        return renderState;
      })() === 'UPLOAD_UI' ? (
        /* Upload UI - Matches AngularJS line 76-93 (when !fileInfo.fileId or isUploading) */
        <div className="chat-message" style={{ clear: 'both', float: 'left', marginLeft: showAvatar ? '42px' : '38px', marginRight: '5px', maxWidth: '94%' }}>
          <div className="message-with-thumbnail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {/* Upload box - Matches AngularJS attachment-box */}
            <div className="attachment-box" style={{ 
              backgroundColor: 'white',
              textAlign: 'center',
              cursor: 'pointer',
              border: '1px solid #eee',
              borderBottom: 'none',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              overflow: 'hidden',
              minWidth: '155px',
              position: 'relative',
            }}>
              {/* Background overlay - Matches AngularJS attachment-box-background */}
              <div className="attachment-box-background" style={{ border: 'none', pointerEvents: 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />
              
              {/* Preview image - Matches AngularJS <img ng-src="{{file.localUrl}}" /> */}
              {/* CRITICAL: Always render image (matches AngularJS - no condition, just empty src if no localUrl) */}
              <img 
                src={(message as any).gifUrl || ''} 
                alt="File preview"
                style={{ 
                  maxWidth: '172px', 
                  marginRight: '0px', 
                  verticalAlign: 'baseline',
                  display: (message as any).gifUrl ? 'block' : 'none',
                }}
                onError={(e) => {
                  // Hide image on error (matches AngularJS onError)
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              
              {/* File name - Matches AngularJS fileNames (shown below image, not overlapping) */}
              {message.fileInfo.name && (
                <span className="fileNames" style={{ 
                  margin: '1px',
                  fontSize: '14px',
                  color: '#4183d7',
                  paddingTop: '0px',
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordWrap: 'break-word',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: '1.2',
                  position: 'relative',
                  zIndex: 2,
                }}>
                  {message.fileInfo.name}
                </span>
              )}
              
              {/* Progress bar with spinner - Matches AngularJS progress-bar */}
              {/* CRITICAL: Always show spinner during upload (matches AngularJS ng-if="isInProgress()") */}
              <div className="progress-bar" style={{ 
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 3,
                pointerEvents: 'none',
              }}>
                <div className="bar-internal" style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Spinner - Matches AngularJS <div class="cnv-spinner"></div> */}
                  <div className="cnv-spinner light" style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: '2px',
                    height: '30px',
                    width: '30px',
                    zIndex: 999,
                  }}>
                    <i className="cnv-circle-spinner-small" />
                  </div>
                </div>
                {/* Progress line - Can show upload progress if available */}
                <div className="progress-line" style={{ 
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '2px',
                  backgroundColor: '#4183d7',
                  width: message.fileInfo.progress ? `${message.fileInfo.progress}%` : '0%',
                  zIndex: 1000,
                }} />
              </div>
            </div>
            {/* Timestamp - Separate div below file (matches AngularJS line 162-164) */}
            <div
              className="notSelectable message-time"
              style={{
                fontSize: '12px',
                color: '#aaa',
                fontWeight: 100,
                border: '1px solid #eee',
                borderTop: 'none',
                padding: '1px 5px',
                borderBottomLeftRadius: '4px',
                borderBottomRightRadius: '4px',
                backgroundColor: '#fff',
                width: 'fit-content',
              }}
            >
              {message.isEdited === 1 ? `Edited ${timeStr}` : (message._view?.time || timeStr)}
            </div>
          </div>
        </div>
      ) : (() => {
        // CRITICAL: Only show final display if fileId exists (truthy string)
        // Use the same check logic as own message to ensure consistency
        const hasFileInfo = !!message.fileInfo;
        if (!hasFileInfo) return null;
        
        const fileId = message.fileInfo?.fileId;
        // CRITICAL: Check if fileId exists and is a non-empty string
        const hasFileId = !!fileId && fileId !== '' && fileId !== null && fileId !== undefined && String(fileId).trim() !== '';
        
        return hasFileId ? 'FINAL_DISPLAY' : null;
      })() === 'FINAL_DISPLAY' ? (
        /* File display - Matches AngularJS line 95-170 (when fileInfo.fileId exists and not uploading) */
        <div className="chat-message" style={{ clear: 'both', float: 'left', marginLeft: showAvatar ? '42px' : '38px', marginRight: '5px', maxWidth: '94%' }}>
          <div className="message-with-thumbnail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {/* File container - Matches AngularJS line 100-101 */}
            <div style={{ 
              backgroundColor: 'white',
              textAlign: 'center',
              cursor: 'pointer',
              border: '1px solid #eee',
              borderBottom: 'none',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              overflow: 'hidden',
              height: message.fileInfo.height ? `${message.fileInfo.height}px` : 'auto',
              width: message.fileInfo.width ? `${message.fileInfo.width}px` : 'auto',
              maxWidth: '200px',
              maxHeight: '200px',
            }}>
              {message.fileInfo.type?.toUpperCase() === 'GIF' && message.fileInfo.originalName ? (
                /* GIF rendering - Matches AngularJS line 106-110 */
                <img
                  className="original-gif gif-image-thumbnail-container"
                  src={getFileUrl(message.fileInfo.originalName, message.chatId, message.fileInfo.storage_version, (message as any).isUnifiedChat)}
                  alt="GIF"
                  style={{
                    height: message.fileInfo.height ? `${message.fileInfo.height}px` : 'auto',
                    width: message.fileInfo.width ? `${message.fileInfo.width}px` : 'auto',
                    maxWidth: '200px',
                    maxHeight: '200px',
                    verticalAlign: 'baseline',
                  }}
                  onError={(e) => {
                    // Hide image on error instead of trying to load fallback that doesn't exist
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : message.fileInfo.thumbnailName || message.fileInfo.thumbnail_name ? (
                <img
                  src={getThumbnailUrl(
                    message.fileInfo.thumbnailName || message.fileInfo.thumbnail_name || '',
                    message.chatId,
                    message.fileInfo.storage_version,
                    (message as any).isUnifiedChat,
                    (message.fileInfo as any).ver,
                    '566x600' // Default size for chat messages (matches AngularJS line 115)
                  )}
                  alt={message.fileInfo.name || 'File'}
                  style={{
                    width: '100%',
                    height: 'auto',
                    verticalAlign: 'baseline',
                  }}
                  onError={(e) => {
                    // Hide image on error instead of trying to load fallback that doesn't exist
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ padding: '20px', color: '#7b8386' }}>
                  {message.fileInfo.name || 'File'}
                </div>
              )}
            </div>
            {/* Timestamp - Separate div below file (matches AngularJS line 162-164) */}
            <div
              className="notSelectable message-time"
              style={{
                fontSize: '12px',
                color: '#7b8386',
                fontWeight: 100,
                border: '1px solid #eee',
                borderTop: 'none',
                padding: '1px 5px 1px',
                borderBottomLeftRadius: '4px',
                borderBottomRightRadius: '4px',
                backgroundColor: '#fff',
                width: 'fit-content',
              }}
            >
              {message.isEdited === 1 ? `Edited ${timeStr}` : (message._view?.time || timeStr)}
            </div>
          </div>
        </div>
      ) : showAvatar && !message.isDeleted ? (
        /* Message with avatar - Matches AngularJS messageList.tpl.html lines 47-98 */
        <div className="messageFromOtherUserWithImg chat-message">
          <div className="chat-other-user-image-container" style={{ position: 'relative', minHeight: '32px' }}>
            {/* Avatar wrapper - Matches AngularJS exact positioning */}
            <div style={{ 
              marginLeft: '5px', 
              marginTop: '2px', 
              marginRight: '5px', 
              float: 'left', 
              position: 'absolute', 
              bottom: 0, 
              left: 0,
              zIndex: 1, // Ensure avatar is above message bubble
            }}>
              {message._view?._user ? (
                <UserProfileImage
                  userId={message._view._user.userId}
                  width={30}
                  height={30}
                  profileType={message._view._user.profileImageType ?? message._view._user.profile_image_type}
                  profileVersion={message._view._user.profileImageVersion ?? message._view._user.profile_image_version}
                  fullName={message._view._user.displayName}
                  user={{
                    ...message._view._user,
                    // Ensure snake_case properties for UserProfileImage compatibility
                    profile_image_type: message._view._user.profileImageType ?? message._view._user.profile_image_type,
                    profile_image_version: message._view._user.profileImageVersion ?? message._view._user.profile_image_version,
                    user_id: message._view._user.userId ?? message._view._user.user_id,
                    // CRITICAL: Ensure name properties are available for getUserInitials
                    // Priority: displayName > name > first_name + last_name > email
                    name: message._view._user.displayName || 
                          message._view._user.name || 
                          (message._view._user.first_name && message._view._user.last_name 
                            ? `${message._view._user.first_name} ${message._view._user.last_name}` 
                            : message._view._user.first_name || message._view._user.firstName || 
                              message._view._user.email || 
                              message._view._user.userId),
                    displayName: message._view._user.displayName || message._view._user.name,
                    first_name: message._view._user.first_name || message._view._user.firstName,
                    last_name: message._view._user.last_name || message._view._user.lastName,
                    firstName: message._view._user.first_name || message._view._user.firstName,
                    lastName: message._view._user.last_name || message._view._user.lastName,
                    email: message._view._user.email,
                  }}
                />
              ) : (
                // Fallback: Render avatar with senderId if _user is missing
                <UserProfileImage
                  userId={message.senderId}
                  width={30}
                  height={30}
                  fullName={message.senderId}
                />
              )}
            </div>
            <div
              className={`messageFromOtherUser message-content-container ${shouldRemoveBackground ? 'noBackground single-emoji-msg' : ''}`}
              style={{
                padding: shouldRemoveBackground ? '0px' : '4px 7px', // Remove padding for single emoji
                marginLeft: '42px', // Matches AngularJS line 57: margin-left: 42px
                backgroundColor: shouldRemoveBackground ? 'transparent' : '#f2f4f8', // Remove background for single emoji
                color: shouldRemoveBackground ? '#aaa' : '#2b2b2b', // Matches AngularJS .messageFromOtherUser color, gray for single emoji
                borderRadius: shouldRemoveBackground ? '0' : '4px', // Remove border radius for single emoji
                maxWidth: shouldRemoveBackground ? '210px' : '225px', // Matches AngularJS .noBackground max-width: 210px
                wordWrap: 'break-word',
                textAlign: 'left', // Matches AngularJS text-align: left
                float: 'left', // Matches AngularJS float: left
                minHeight: shouldRemoveBackground ? '0' : '32px', // Remove min-height for single emoji
                position: 'relative',
                boxSizing: 'border-box',
                fontSize: shouldRemoveBackground ? '50px' : undefined, // Matches AngularJS .noBackground font-size:50px
              }}
            >
              {/* Message text - Matches AngularJS line 159-162 */}
              <span 
                className="chat-msg-cont" 
                style={{ whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ 
                  __html: (message.isEdited === 1 
                    ? message.messageText 
                    : (message._view?.messageText || message.messageText || ''))
                    .replace(/\n/g, '<br>')
                }}
              />
              {/* Timestamp - Matches AngularJS line 165-167 */}
              <div
                className="notSelectable message-time"
                style={{
                  fontSize: '12px',
                  color: '#7b8386', // Matches AngularJS line 69: color: #7b8386
                  fontWeight: 100,
                  marginTop: '4px',
                  textAlign: shouldRemoveBackground ? 'center' : 'left', // Center timestamp below emoji
                  width: shouldRemoveBackground ? '100%' : 'auto',
                  display: shouldRemoveBackground ? 'block' : 'block',
                }}
              >
                {message.isEdited === 1 ? `Edited         ${timeStr}` : (message._view?.time || timeStr)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Message without avatar - Matches AngularJS messageList.tpl.html lines 100-144 */
        <div className="chat-message" style={{ display: 'flex', marginLeft: '38px', flexWrap: 'wrap' }}>
          <div
            className={`messageFromOtherUserWithoutImg message-content-container ${shouldRemoveBackground ? 'noBackground single-emoji-msg' : ''}`}
            style={{
              padding: shouldRemoveBackground ? '0px' : '4px 7px', // Remove padding for single emoji
              backgroundColor: shouldRemoveBackground ? 'transparent' : '#f2f4f8', // Remove background for single emoji
              color: shouldRemoveBackground ? '#aaa' : '#2b2b2b', // Matches AngularJS .messageFromOtherUser color, gray for single emoji
              borderRadius: shouldRemoveBackground ? '0' : '4px', // Remove border radius for single emoji
              maxWidth: shouldRemoveBackground ? '210px' : '225px', // Matches AngularJS .noBackground max-width: 210px
              margin: '1px 5px', // Matches AngularJS line 692: margin: 1px 5px
              wordWrap: 'break-word',
              textAlign: 'left', // Matches AngularJS text-align: left
              display: 'inline-block', // Matches AngularJS display: inline-block
              minHeight: shouldRemoveBackground ? '0' : '32px', // Remove min-height for single emoji
              position: 'relative',
              boxSizing: 'border-box',
              fontSize: shouldRemoveBackground ? '50px' : undefined, // Matches AngularJS .noBackground font-size:50px
            }}
          >
            {/* Message text - Matches AngularJS line 159-162 */}
            <span 
              className="chat-msg-cont" 
              style={{ whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{ 
                __html: (message.isEdited === 1 
                  ? message.messageText 
                  : (message._view?.messageText || message.messageText || ''))
                  .replace(/\n/g, '<br>')
              }}
            />
            <div
              className="notSelectable message-time"
              style={{
                fontSize: '12px',
                color: '#7b8386', // Matches AngularJS line 115: color: #7b8386
                fontWeight: 100,
                marginTop: '4px',
                textAlign: shouldRemoveBackground ? 'center' : 'left', // Center timestamp below emoji
                width: shouldRemoveBackground ? '100%' : 'auto',
                display: shouldRemoveBackground ? 'block' : 'block',
              }}
            >
              {message.isEdited === 1 ? `Edited         ${timeStr}` : (message._view?.time || timeStr)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




