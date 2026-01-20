'use client';

/**
 * ParticipantList Component
 * 
 * Displays group chat participants with avatars and status indicators
 * Matches AngularJS cnvParticipantList directive EXACTLY
 * 
 * Shows:
 * - Up to 7 avatars horizontally with status indicators
 * - "+N" link if more than 7 participants (clickable to expand)
 * - Expanded list with all participants and their names
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Chat, ChatParticipant, NetworkUser } from '@/types/chat';
import UserProfileImage from '@/components/common/UserProfileImage';
import './ParticipantList.css';

interface ParticipantListProps {
  chat: Chat;
  allUsers: NetworkUser[];
}

export default function ParticipantList({ chat, allUsers }: ParticipantListProps) {
  const [showingParticipantList, setShowingParticipantList] = useState(false);

  // Get current user ID
  const currentUserId = useMemo(() => {
    if (typeof window !== 'undefined') {
      const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
      return sessionData?.user?.user_id || '';
    }
    return '';
  }, []);

  // Build participants list (matches AngularJS cnvParticipantList controller)
  const { usersAvatar, participantsList } = useMemo(() => {
    const avatarUsers: NetworkUser[] = [];
    const allParticipants: NetworkUser[] = [];
    const maxAvatars = 7;
    const participants = chat.participants || {};

    for (const userId in participants) {
      const participant = participants[userId];
      
      // Skip current user
      if (userId === currentUserId) {
        continue;
      }

      // Only show JOINED or INVITED participants (for unified chat)
      const status = (participant as any).status;
      const statusLower = status ? status.toLowerCase() : '';
      const isJoined = statusLower === 'joined' || statusLower === 'active';
      const isInvited = chat.isUnifiedChat && statusLower === 'invited';
      
      // Skip if participant has left
      if (statusLower === 'exit' || statusLower === 'left') {
        continue;
      }
      
      // Skip if participant info should be hidden
      if (participant.showParticipantInfo === 0) {
        continue;
      }
      
      if (!isJoined && !isInvited) {
        continue;
      }

      // Find user in allUsers
      const user = allUsers.find(u => {
        const uId = u.user_id || u.userId || '';
        return uId === userId;
      });

      if (user && user.is_accessible !== false && user.isAccessible !== false) {
        // Add to full list
        allParticipants.push(user);
        
        // Add to avatar list (max 7)
        if (avatarUsers.length < maxAvatars) {
          avatarUsers.push(user);
        }
      }
    }

    return { usersAvatar: avatarUsers, participantsList: allParticipants };
  }, [chat.participants, chat.isUnifiedChat, allUsers, currentUserId]);

  const handleToggleList = useCallback(() => {
    setShowingParticipantList(prev => !prev);
  }, []);

  // Check if user is invited (matches AngularJS isInvitedUser)
  const isInvitedUser = useCallback((user: NetworkUser): boolean => {
    const status = (user as any).status;
    return status === 'INVITED' || status === 'invited' || user.user_role === 'invited';
  }, []);

  // Get presence status from user or participant
  const getPresenceStatus = useCallback((user: NetworkUser): number => {
    return user.presenceStatus || (user as any).presence_status || 4;
  }, []);

  // Get device from user
  const getDevice = useCallback((user: NetworkUser): number => {
    return user.device || (user as any).device_type || 1;
  }, []);

  // Check if user has mobile
  const hasMobile = useCallback((user: NetworkUser): boolean => {
    return user.hasMobile || (user as any).has_mobile || false;
  }, []);

  // Show empty message if no other participants
  if (participantsList.length === 0 && chat.chatType === 2) {
    return (
      <div className="chatActionBar" style={{
        height: '40px',
        background: '#fff',
        borderBottom: '1px solid #d4d9e3',
        position: 'relative',
      }}>
        <div className="system-chat-message" style={{
          width: '100%',
          height: 'inherit',
          position: 'absolute',
          marginLeft: '5px',
          lineHeight: '40px',
          fontSize: '14px',
          color: '#7b8386',
        }}>
          There is no one else in this group chat
        </div>
      </div>
    );
  }

  return (
    <div className="chatActionBar" style={{
      height: '40px',
      background: '#fff',
      borderBottom: '1px solid #d4d9e3',
      position: 'relative',
    }}>
      <div className="participantsList" style={{
        width: '98%',
        height: 'inherit',
        position: 'absolute',
        marginTop: '4px',
        marginLeft: '4px',
        overflowX: 'auto',
        overflowY: 'hidden',
        whiteSpace: 'nowrap',
      }}>
        {/* Avatar list - up to 7 avatars (AngularJS chatActionBar.tpl.html) */}
        {usersAvatar.map((user, index) => {
          const presenceStatus = getPresenceStatus(user);
          const device = getDevice(user);
          const userHasMobile = hasMobile(user);
          const invited = isInvitedUser(user);
          const displayName =
            user.displayName || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';

          return (
            <div
              key={user.user_id || user.userId}
              style={{
                verticalAlign: 'middle',
                display: 'inline-block',
                fontSize: '12px',
                marginLeft: index > 0 ? '2px' : '0px', // AngularJS: margin-left: 2px
                marginTop: '1px',
                lineHeight: 0, // prevents baseline drift across avatars
              }}
              title={displayName}
            >
              {/* Avatar (force exact 30x30 box like AngularJS cnv-user-profile-image) */}
              <span style={{ display: 'inline-block', width: '30px', height: '30px', verticalAlign: 'middle' }}>
                <UserProfileImage
                  userId={user.user_id || user.userId || ''}
                  size={64}
                  width={30}
                  height={30}
                  profileType={user.profile_image_type?.toString()}
                  profileVersion={user.profile_image_version?.toString()}
                  fullName={displayName}
                />
              </span>

              {/* Presence indicator (match AngularJS: margin-left:-11px; margin-bottom:-14px) */}
              {!invited && (
                <span
                  style={{
                    display: 'inline-block',
                    marginLeft: '-11px',
                    marginBottom: '-14px',
                    verticalAlign: 'middle',
                    pointerEvents: 'none',
                  }}
                >
                  {presenceStatus === 1 && device !== 2 && <div className="listUserStatusOnline" />}
                  {presenceStatus === 2 && device !== 2 && <div className="listUserStatusBusy" />}
                  {presenceStatus === 3 && device !== 2 && <div className="listUserStatusIdle" />}
                  {presenceStatus === 4 && device !== 2 && !userHasMobile && <div className="listUserStatusOffline" />}
                  {(device === 2 || (presenceStatus === 4 && userHasMobile)) && <div className="listUserStatusMobile" />}
                </span>
              )}
            </div>
          );
        })}

        {/* "+N" link if more than 7 participants */}
        {participantsList.length > 7 && (
          <a
            onClick={handleToggleList}
            style={{
              cursor: 'pointer',
              verticalAlign: 'middle',
              marginLeft: '4px',
              color: '#4998dd',
              textDecoration: 'none',
              fontSize: '12px',
            }}
            title={`${participantsList.length - 7} more participants`}
          >
            +{participantsList.length - 7}
          </a>
        )}

        {/* Expanded participant list (AngularJS: .participantList) */}
        {showingParticipantList && (
          <div
            className="participantList cnvScrollContainer"
            tabIndex={0}
            style={{
              overflowY: 'scroll',
              position: 'absolute',
              top: '35px',
              left: 0,
              right: 0,
              margin: 0,
              maxWidth: 'none',
              background: '#fff',
              borderBottom: '1px solid #d4d9e3',
              maxHeight: '200px',
              zIndex: 10,
            }}
            onBlur={() => setShowingParticipantList(false)}
          >
            {participantsList.map((user) => {
              const presenceStatus = getPresenceStatus(user);
              const device = getDevice(user);
              const userHasMobile = hasMobile(user);
              const invited = isInvitedUser(user);
              const displayName = user.displayName || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';

              return (
                <div key={user.user_id || user.userId} style={{ padding: '8px 12px' }}>
                  <div className="participantUserName" style={{ display: 'inline-block' }}>
                    {displayName}
                  </div>
                  {!invited && (
                    <div style={{ display: 'inline-block', marginLeft: '8px' }}>
                      {presenceStatus === 1 && device !== 2 && <div className="listUserStatusOnline" />}
                      {presenceStatus === 2 && device !== 2 && <div className="listUserStatusBusy" />}
                      {presenceStatus === 3 && device !== 2 && <div className="listUserStatusIdle" />}
                      {presenceStatus === 4 && device !== 2 && !userHasMobile && <div className="listUserStatusOffline" />}
                      {(device === 2 || (presenceStatus === 4 && userHasMobile)) && (
                        <div className="listUserStatusMobile aling-to-normal-status-bubble" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

