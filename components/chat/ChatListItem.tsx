'use client';

/**
 * ChatListItem - Individual chat item in the list
 * 
 * EXACT replication of AngularJS chat item (cnvChatUsersWindow.tpl.html lines 127-258)
 * Shows: avatar, name, last message, unread count, timestamp, presence, typing indicator
 */

import React, { useMemo } from 'react';
import type { Chat } from '@/types/chat';
import UserProfileImage from '@/components/common/UserProfileImage';
import GroupChatAvatar from './GroupChatAvatar';
import { useChatList } from '@/contexts/ChatListContext';
import { computeGroupChatTitle } from '@/utils/chatTitleUtils';
import './ChatListItem.css';

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}

// Format timestamp (matches Angular dateAgo filter)
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

import { useChatWindows } from '@/contexts/ChatWindowsContext';

export default function ChatListItem({ chat, isSelected, onClick }: ChatListItemProps) {
  const { openChatWindow } = useChatWindows();
  const { allUsers } = useChatList();
  
  // Get current user ID for title computation
  const currentUserId = typeof window !== 'undefined' 
    ? ((window as any)?.com_convo?.sessionData?.signInResponseData?.user?.user_id || '')
    : '';
  
  // Compute group chat title if needed (matches AngularJS chat.getTitle)
  const displayTitle = useMemo(() => {
    if (chat.chatType === 2 && (!chat.title || chat.title.trim() === '')) {
      return computeGroupChatTitle(chat, allUsers, currentUserId);
    }
    return chat.title || 'Chat';
  }, [chat, allUsers, currentUserId]);
  
  const unreadLabel = chat.unreadCount > 20 ? '20+' : String(chat.unreadCount);
  const isP2P = chat.chatType === 1;
  const isGroup = chat.chatType === 2;
  
  // Enrich chat._user with profile image data from allUsers (matches MessageList logic)
  // CRITICAL: Also enrich with name properties for initials calculation
  let enrichedUser: any = chat._user;
  if (chat._user && chat._user.userId) {
    const chatUserId = chat._user.userId;
    const userFromList = allUsers.find(u => {
      const userId = (u as any).user_id || (u as any).userId;
      return userId === chatUserId;
    });
    if (userFromList) {
      // Merge user data to ensure initials can be calculated
      // getUserInitials needs: name, first_name/last_name, or email
      enrichedUser = {
        ...chat._user,
        // Preserve displayName from chat._user, but also add name properties from userFromList
        displayName: chat._user.displayName || `${userFromList.first_name || ''} ${userFromList.last_name || ''}`.trim() || userFromList.email,
        name: chat._user.displayName || `${userFromList.first_name || ''} ${userFromList.last_name || ''}`.trim() || userFromList.email,
        firstName: userFromList.first_name,
        lastName: userFromList.last_name,
        // Support both camelCase and snake_case fields (Angular parity)
        first_name: (userFromList as any).first_name,
        last_name: (userFromList as any).last_name,
        email: userFromList.email,
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
      } as any;
    } else {
      // If user not found in allUsers, ensure we have name properties for initials
      // Try to extract from displayName if it's in "FirstName LastName" format
      const displayName = chat._user.displayName || '';
      const nameParts = displayName.trim().split(/\s+/);
      const rawUser: any = chat._user as any;
      enrichedUser = {
        ...chat._user,
        name: displayName || chat._user.name,
        firstName: nameParts.length > 0 ? nameParts[0] : chat._user.firstName || rawUser.first_name,
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : chat._user.lastName || rawUser.last_name,
        first_name: nameParts.length > 0 ? nameParts[0] : chat._user.firstName || rawUser.first_name,
        last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : chat._user.lastName || rawUser.last_name,
        email: rawUser.email,
      } as any;
    }
  }

  // Check if user has blocked/left chat (Angular lines 196-204)
  const hasUserBlockedChat = false; // TODO: Implement
  const hasUserLeftChat = false; // TODO: Implement
  
  // Get presence status for P2P chat participant (matches Angular chat._user.presenceStatus)
  const p2pUserPresenceStatus = isP2P && chat._user 
    ? (typeof chat._user.presenceStatus === 'number' ? chat._user.presenceStatus : 4)
    : 4;
  const p2pUserDevice = isP2P && chat._user
    ? (typeof chat._user.device === 'number' ? chat._user.device : 1)
    : 1;
  

  return (
    <div className={`chatListItemContainer ${isSelected ? 'selected' : ''}`}>
      {/* EXACT Angular structure: bo-if='chat.chatId' - line 127 */}
      <div
        className="listItem"
        onMouseDown={(e) => {
          e.preventDefault();
          // Open chat window (matches Angular openChatWindow behavior)
          openChatWindow(chat, { isOpenedOnUserAction: true });
          onClick();
        }}
        style={{ paddingTop: '10px' }}
      >
        {/* P2P Avatar (Angular lines 128-132) */}
        {isP2P && enrichedUser && (
          <div className="user-img-48">
            <UserProfileImage
              userId={enrichedUser.userId}
              width={40}
              height={40}
              profileType={enrichedUser.profileImageType && enrichedUser.profileImageType !== '' ? enrichedUser.profileImageType : enrichedUser.profile_image_type}
              profileVersion={enrichedUser.profileImageVersion && enrichedUser.profileImageVersion !== '' ? enrichedUser.profileImageVersion : enrichedUser.profile_image_version}
              fullName={enrichedUser.displayName}
              user={{
                ...enrichedUser,
                // CRITICAL: Ensure name properties are available for getUserInitials
                // getUserInitials needs: name, first_name/last_name, or email
                name: enrichedUser.displayName || enrichedUser.name,
                first_name: enrichedUser.firstName || enrichedUser.first_name,
                last_name: enrichedUser.lastName || enrichedUser.last_name,
                email: enrichedUser.email,
                // Ensure snake_case properties for UserProfileImage compatibility
                // Convert empty strings to undefined
                profile_image_type: (enrichedUser.profileImageType && enrichedUser.profileImageType !== '') ? enrichedUser.profileImageType : (enrichedUser.profile_image_type && enrichedUser.profile_image_type !== '' ? enrichedUser.profile_image_type : undefined),
                profile_image_version: (enrichedUser.profileImageVersion && enrichedUser.profileImageVersion !== '') ? enrichedUser.profileImageVersion : (enrichedUser.profile_image_version && enrichedUser.profile_image_version !== '' ? enrichedUser.profile_image_version : undefined),
                user_id: enrichedUser.userId ?? enrichedUser.user_id,
              }}
            />
          </div>
        )}

        {/* Group Chat Custom Image (Angular lines 133-135) */}
        {isGroup && chat.iconVersion && chat.iconVersion !== '0' && (
          <div style={{ marginLeft: '5%', display: 'inline-block', width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }}>
            <img src={`/path/to/chat/image/${chat.chatId}`} width="40px" height="40px" alt="" />
          </div>
        )}

        {/* Group Chat Avatar (Angular lines 138-191) */}
        {isGroup && (!chat.iconVersion || chat.iconVersion === '0') && (
          <div style={{ width: 42, height: 40, marginLeft: '5%', fontSize: 8, display: 'inline-block' }}>
            <GroupChatAvatar
              chat={chat}
              participants={chat.participants || {}}
              allUsers={allUsers}
              size={18}
              width={18}
              height={18}
            />
          </div>
        )}

        {/* Chat Info (Angular lines 192-231) - EXACT structure match */}
        <div className="chatListInfo">
          {/* Timestamp / Blocked / Left Pills (Angular lines 193-205) */}
          <div className="chatListDate">
            <div>{formatTimeAgo(chat.lastMessageTimestamp)}</div>
            {hasUserBlockedChat && (
              <div className="users-blocked-pill">
                <span>BLOCKED</span>
              </div>
            )}
            {hasUserLeftChat && (
              <div className="users-left-pill">
                <span> LEFT </span>
              </div>
            )}
          </div>

          {/* Chat Title (Angular lines 207-212) */}
          <div className="display-flex">
            <div className={`chatListTitle ${chat.unreadCount > 0 ? 'boldChatTitle' : ''}`}>
              {displayTitle}
            </div>
            {chat.isUnifiedChat && (
              <div className="users-gvn-pill" title="Unified Chat">
                <i className="cnv-icons-18 gvn-icn"></i>
              </div>
            )}
          </div>

          {/* Unread Count / Mute Icon (Angular lines 213-217) */}
          <div className="listUnreadCountCont">
            {chat.isMuted && !(hasUserLeftChat || hasUserBlockedChat) && (
              <i className="cnv-icons-16 icons2_Mute-lightgray" style={{ top: '3px', position: 'relative' }} />
            )}
            {chat.unreadCount > 0 && (
              <div className="listUnreadCount">{unreadLabel}</div>
            )}
          </div>

          {/* Last Message or Typing Indicator (Angular lines 218-230) */}
          {!chat.isAnyParticipantComposing && !chat.isAnyParticipantRecording ? (
            <div 
              className={`chatListMsg ${hasUserBlockedChat ? 'pt0' : ''}`}
              dangerouslySetInnerHTML={{ __html: chat.summeryText || '&nbsp;' }}
            />
          ) : (
            <div className="composingDetails">
              {chat.chatType === 2 && chat.composingParticipants && chat.composingParticipants.length > 0 && (
                <span>{chat.composingParticipants[chat.composingParticipants.length - 1].name.split(' ')[0]}:</span>
              )}
              {chat.isAnyParticipantComposing && !chat.isAnyParticipantRecording && (
                <div className="composingMessageFromOtherUser composingMessageFromOtherUserChatList">
                  <div className="dot1"></div>
                  <div className="dot2"></div>
                  <div className="dot3"></div>
                </div>
              )}
              {chat.isAnyParticipantRecording && !chat.isAnyParticipantComposing && (
                <span className="recordingMessage">recording audio...</span>
              )}
            </div>
          )}
        </div>

        {/* P2P Presence Status (Angular lines 232-248) - EXACT positioning match */}
        {isP2P && chat._user && !chat._user.isInvitedUser && (
          <div style={{ position: 'absolute', left: '42px', marginTop: '23px', display: 'inline-block' }}>
            {hasUserBlockedChat && (
              <div className="listUserStatusBlocked">
                <i className="cnv-icons-10 blocked-icn"></i>
              </div>
            )}
            {!hasUserBlockedChat && p2pUserPresenceStatus === 1 && p2pUserDevice !== 2 && (
              <div className="listUserStatusOnline" />
            )}
            {!hasUserBlockedChat && p2pUserPresenceStatus === 2 && p2pUserDevice !== 2 && (
              <div className="listUserStatusBusy" />
            )}
            {!hasUserBlockedChat && p2pUserPresenceStatus === 3 && p2pUserDevice !== 2 && (
              <div className="listUserStatusIdle" />
            )}
            {!hasUserBlockedChat && p2pUserPresenceStatus === 4 && p2pUserDevice !== 2 && !chat._user.hasMobile && (
              <div className="listUserStatusOffline" />
            )}
            {!hasUserBlockedChat && (p2pUserDevice === 2 || (p2pUserPresenceStatus === 4 && chat._user.hasMobile)) && (
              <div className="user-inactive-time-field">
                {p2pUserPresenceStatus === 4 && chat._user.lastPingTime && (
                  <span className="user-inactive-time">
                    {formatTimeAgo(chat._user.lastPingTime)}
                  </span>
                )}
                <div className="listUserStatusMobile chat-list" />
              </div>
            )}
          </div>
        )}

        {/* Seen Participants (Angular lines 249-257) */}
        {chat.shouldShowSeenParticipantsInList && chat.unreadCount === 0 && (
          <div className="seen other-user-message-seen" style={{ marginTop: '-23px', padding: '0 11px 0px 0px' }}>
            {chat.moreParticipantsCount && chat.moreParticipantsCount > 0 && (
              <span className="group-chat-seen-more-counter">
                <span className="seen-counter">{chat.moreParticipantsCount}</span>
              </span>
            )}
            {/* Seen participant avatars */}
          </div>
        )}
      </div>

      {/* Border (Angular line 259) */}
      <div className="listItemBorder"></div>
    </div>
  );
}
