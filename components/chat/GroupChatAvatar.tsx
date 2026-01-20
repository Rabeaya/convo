'use client';

/**
 * GroupChatAvatar Component
 * 
 * Displays multiple overlapping avatars for group chats
 * Matches AngularJS cnvGroupChatAvatar directive EXACTLY
 * 
 * Chat List Layout (size=18):
 * - <= 2 users: Default group icon
 * - 3+ users: First 3 avatars inline with natural overlap, 4th if 4 users, counter if 5+
 * 
 * Chat Header Layout (size=44):
 * - Uses grid layout with positioning classes
 */

import React, { useMemo } from 'react';
import type { Chat, ChatParticipant, NetworkUser } from '@/types/chat';
import UserProfileImage from '@/components/common/UserProfileImage';
import './GroupChatAvatar.css';

interface GroupChatAvatarProps {
  chat: Chat;
  participants: Record<string, ChatParticipant>;
  allUsers: NetworkUser[];
  size?: number; // Container size (18 for list, 44 for header)
  width?: number; // Avatar width (18 for header, 20 for list)
  height?: number; // Avatar height (18 for header, 20 for list)
}

export default function GroupChatAvatar({
  chat,
  participants,
  allUsers,
  size = 18,
  width = 18,
  height = 18,
}: GroupChatAvatarProps) {
  // Get current user ID to include in display
  const currentUserId = useMemo(() => {
    if (typeof window !== 'undefined') {
      const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
      return sessionData?.user?.user_id || '';
    }
    return '';
  }, []);

  // Build user array from participants (matches AngularJS populateChatAvatar)
  const userArr = useMemo(() => {
    const users: Array<NetworkUser & { participant: ChatParticipant }> = [];

    if (!participants) {
      return users;
    }

    for (const userId in participants) {
      const participant = participants[userId];
      
      // Only show JOINED or INVITED participants (for unified chat)
      const status = (participant as any).status;
      const statusLower = status ? status.toLowerCase() : '';
      const isJoined = statusLower === 'joined' || statusLower === 'active' || !status;
      const isInvited = chat.isUnifiedChat && statusLower === 'invited';
      
      // Skip if participant has left
      if (statusLower === 'exit' || statusLower === 'left' || statusLower === 'removed') {
        continue;
      }
      
      // Skip if participant info should be hidden
      if (participant.showParticipantInfo === 0) {
        continue;
      }
      
      if (!isJoined && !isInvited) {
        continue;
      }

      // Include current user in avatar display
      const user = allUsers.find(u => {
        const uId = u.user_id || u.userId || '';
        return uId === userId;
      });

      if (user && user.is_accessible !== false && user.isAccessible !== false) {
        users.push({ ...user, participant });
      } else if (userId === currentUserId) {
        // Current user not found in allUsers, try to get from session data
        if (typeof window !== 'undefined') {
          const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
          const currentUserData = sessionData?.user;
          if (currentUserData) {
            users.push({
              user_id: currentUserId,
              userId: currentUserId,
              first_name: currentUserData.first_name || participant.firstName,
              last_name: currentUserData.last_name || participant.lastName,
              name: participant.name || `${currentUserData.first_name || ''} ${currentUserData.last_name || ''}`.trim(),
              displayName: participant.displayName || `${currentUserData.first_name || ''} ${currentUserData.last_name || ''}`.trim(),
              email: currentUserData.email || '',
              profile_image_type: participant.profileImageType || currentUserData.profile_image_type,
              profile_image_version: participant.profileImageVersion || currentUserData.profile_image_version,
              is_accessible: true,
              isAccessible: true,
              participant,
            } as NetworkUser & { participant: ChatParticipant });
          }
        }
      }
    }

    return users;
  }, [participants, allUsers, currentUserId, chat.isUnifiedChat]);

  // Determine if this is header size (44px) or list size (18px)
  const isHeaderSize = size >= 44;
  
  // For chat list: show default icon if <= 2 users (matches AngularJS line 171)
  if (!isHeaderSize && userArr.length <= 2) {
    return (
      <div style={{ marginLeft: '5%', display: 'inline-block', width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }}>
        <img src="/assets/img/chat/group-icn.svg" width="40px" height="40px" alt="Group" />
      </div>
    );
  }

  // For header: single user (matches AngularJS lines 51-55)
  if (isHeaderSize && userArr.length === 1) {
    const user = userArr[0];
    return (
      <div style={{ fontSize: '15px', margin: '-4px' }}>
        <UserProfileImage
          userId={user.user_id || user.userId || ''}
          width={44}
          height={44}
          profileType={user.profile_image_type?.toString()}
          profileVersion={user.profile_image_version?.toString()}
          fullName={`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || ''}
        />
      </div>
    );
  }

  // For header: empty chat user (matches AngularJS lines 56-60)
  if (isHeaderSize && userArr.length === 0) {
    const currentUser = allUsers.find(u => {
      const uId = u.user_id || u.userId || '';
      return uId === currentUserId;
    });
    if (currentUser) {
      return (
        <div style={{ fontSize: '15px', margin: '-4px' }}>
          <UserProfileImage
            userId={currentUserId}
            width={44}
            height={44}
            profileType={currentUser.profile_image_type?.toString()}
            profileVersion={currentUser.profile_image_version?.toString()}
            fullName={`${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email || ''}
          />
        </div>
      );
    }
  }

  // Multiple users layout
  const show2images = userArr.length === 2;
  const show3images = userArr.length === 3;
  const showCounter = userArr.length >= 5;

  // Chat List layout (matches AngularJS cnvChatUsersWindow.tpl.html lines 141-170)
  // For 3 avatars: Triangle layout (2 on top overlapping, 1 below overlapping bottom edges)
  // For 4+ avatars: Horizontal row with overlap
  // For header size 28 (small chat window), also use chat list layout with smaller container
  if (!isHeaderSize || size === 28) {
    return (
      <div 
        style={{ 
          width: size === 28 ? 28 : 42, 
          height: size === 28 ? 28 : 40, 
          marginLeft: size === 28 ? 0 : '5%', 
          fontSize: 8, 
          display: 'inline-block',
          position: 'relative',
        }}
      >
        {userArr.length > 2 && (
          <>
            {/* 3 avatars: Triangle layout - 2 on top, 1 below */}
            {userArr.length === 3 ? (
              <>
                {/* First avatar: top-left */}
                <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 3 }}>
                  <UserProfileImage
                    userId={userArr[0].user_id || userArr[0].userId || ''}
                    width={20}
                    height={20}
                    profileType={userArr[0].profile_image_type?.toString()}
                    profileVersion={userArr[0].profile_image_version?.toString()}
                    fullName={`${userArr[0].first_name || ''} ${userArr[0].last_name || ''}`.trim() || userArr[0].email || ''}
                  />
                </div>
                {/* Second avatar: top-right, with more spacing */}
                <div style={{ position: 'absolute', left: 18, top: 0, zIndex: 2 }}>
                  <UserProfileImage
                    userId={userArr[1].user_id || userArr[1].userId || ''}
                    width={20}
                    height={20}
                    profileType={userArr[1].profile_image_type?.toString()}
                    profileVersion={userArr[1].profile_image_version?.toString()}
                    fullName={`${userArr[1].first_name || ''} ${userArr[1].last_name || ''}`.trim() || userArr[1].email || ''}
                  />
                </div>
                {/* Third avatar: bottom-center, with more vertical spacing */}
                <div style={{ position: 'absolute', left: 9, top: 20, zIndex: 1 }}>
                  <UserProfileImage
                    userId={userArr[2].user_id || userArr[2].userId || ''}
                    width={20}
                    height={20}
                    profileType={userArr[2].profile_image_type?.toString()}
                    profileVersion={userArr[2].profile_image_version?.toString()}
                    fullName={`${userArr[2].first_name || ''} ${userArr[2].last_name || ''}`.trim() || userArr[2].email || ''}
                  />
                </div>
              </>
            ) : userArr.length === 4 ? (
              <>
                {/* 4 avatars: 2x2 grid layout with more spacing */}
                {/* Top row */}
                <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 4 }}>
                  <UserProfileImage
                    userId={userArr[0].user_id || userArr[0].userId || ''}
                    width={size === 28 ? 18 : 20}
                    height={size === 28 ? 18 : 20}
                    profileType={userArr[0].profile_image_type?.toString()}
                    profileVersion={userArr[0].profile_image_version?.toString()}
                    fullName={`${userArr[0].first_name || ''} ${userArr[0].last_name || ''}`.trim() || userArr[0].email || ''}
                  />
                </div>
                <div style={{ position: 'absolute', left: size === 28 ? 14 : 18, top: 0, zIndex: 3 }}>
                  <UserProfileImage
                    userId={userArr[1].user_id || userArr[1].userId || ''}
                    width={size === 28 ? 18 : 20}
                    height={size === 28 ? 18 : 20}
                    profileType={userArr[1].profile_image_type?.toString()}
                    profileVersion={userArr[1].profile_image_version?.toString()}
                    fullName={`${userArr[1].first_name || ''} ${userArr[1].last_name || ''}`.trim() || userArr[1].email || ''}
                  />
                </div>
                {/* Bottom row */}
                <div style={{ position: 'absolute', left: 0, top: size === 28 ? 14 : 20, zIndex: 2 }}>
                  <UserProfileImage
                    userId={userArr[2].user_id || userArr[2].userId || ''}
                    width={size === 28 ? 18 : 20}
                    height={size === 28 ? 18 : 20}
                    profileType={userArr[2].profile_image_type?.toString()}
                    profileVersion={userArr[2].profile_image_version?.toString()}
                    fullName={`${userArr[2].first_name || ''} ${userArr[2].last_name || ''}`.trim() || userArr[2].email || ''}
                  />
                </div>
                <div style={{ position: 'absolute', left: size === 28 ? 14 : 18, top: size === 28 ? 14 : 20, zIndex: 1 }}>
                  <UserProfileImage
                    userId={userArr[3].user_id || userArr[3].userId || ''}
                    width={size === 28 ? 18 : 20}
                    height={size === 28 ? 18 : 20}
                    profileType={userArr[3].profile_image_type?.toString()}
                    profileVersion={userArr[3].profile_image_version?.toString()}
                    fullName={`${userArr[3].first_name || ''} ${userArr[3].last_name || ''}`.trim() || userArr[3].email || ''}
                  />
                </div>
              </>
            ) : (
              <>
                {/* 5+ avatars: Horizontal row with minimal overlap */}
                {userArr.slice(0, 3).map((user, index) => (
                  <span 
                    key={user.user_id || user.userId || index}
                    style={{
                      display: 'inline-block',
                      marginLeft: index > 0 ? '-4px' : '0', // Minimal overlap
                      verticalAlign: 'middle',
                      position: 'relative',
                      zIndex: 3 - index,
                    }}
                  >
                    <UserProfileImage
                      userId={user.user_id || user.userId || ''}
                      width={size === 28 ? 18 : 20}
                      height={size === 28 ? 18 : 20}
                      profileType={user.profile_image_type?.toString()}
                      profileVersion={user.profile_image_version?.toString()}
                      fullName={`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || ''}
                    />
                  </span>
                ))}
              </>
            )}
            
            {/* Counter if 5+ users */}
            {showCounter && (
              <span 
                className="groupAvatarCounter" 
                style={{ 
                  position: 'absolute',
                  width: size === 28 ? 18 : 20, 
                  height: size === 28 ? 18 : 20, 
                  lineHeight: size === 28 ? '18px' : '20px',
                  fontSize: size === 28 ? 9 : 10,
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                +{userArr.length - 3}
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  // Chat Header layout (matches AngularJS cnvChatHeadBubble.tpl.html lines 26-50)
  return (
    <div className="group-chat-avatar-container" style={{ width: 44, height: 44 }}>
      {/* Top row */}
      <div 
        className={`group-chat-avatar-top ${show3images ? 'showing3GroupUsersTop' : show2images ? 'showing2GroupUsersTop' : ''}`}
        style={{ display: 'flex', WebkitDisplay: 'flex', msDisplay: 'flexbox' }}
      >
        {userArr[0] && (
          <UserProfileImage
            userId={userArr[0].user_id || userArr[0].userId || ''}
            width={18}
            height={18}
            profileType={userArr[0].profile_image_type?.toString()}
            profileVersion={userArr[0].profile_image_version?.toString()}
            fullName={`${userArr[0].first_name || ''} ${userArr[0].last_name || ''}`.trim() || userArr[0].email || ''}
          />
        )}
        {userArr[3] && !show2images && !show3images && (
          <UserProfileImage
            userId={userArr[3].user_id || userArr[3].userId || ''}
            width={18}
            height={18}
            profileType={userArr[3].profile_image_type?.toString()}
            profileVersion={userArr[3].profile_image_version?.toString()}
            fullName={`${userArr[3].first_name || ''} ${userArr[3].last_name || ''}`.trim() || userArr[3].email || ''}
          />
        )}
      </div>

      {/* Bottom row */}
      <div 
        className={`group-chat-avatar-bottom ${show3images ? 'showing3GroupUsersBot' : ''}`}
        style={{ display: 'flex', WebkitDisplay: 'flex', msDisplay: 'flexbox' }}
      >
        {userArr[2] && !show2images && (
          <UserProfileImage
            userId={userArr[2].user_id || userArr[2].userId || ''}
            width={18}
            height={18}
            profileType={userArr[2].profile_image_type?.toString()}
            profileVersion={userArr[2].profile_image_version?.toString()}
            fullName={`${userArr[2].first_name || ''} ${userArr[2].last_name || ''}`.trim() || userArr[2].email || ''}
          />
        )}
        {userArr[1] && userArr.length <= 4 && (
          <div className={show2images ? 'showing2GroupUsersBot' : ''} style={{ display: 'inline-block' }}>
            <UserProfileImage
              userId={userArr[1].user_id || userArr[1].userId || ''}
              width={18}
              height={18}
              profileType={userArr[1].profile_image_type?.toString()}
              profileVersion={userArr[1].profile_image_version?.toString()}
              fullName={`${userArr[1].first_name || ''} ${userArr[1].last_name || ''}`.trim() || userArr[1].email || ''}
            />
          </div>
        )}
        {showCounter && (
          <div className="groupAvatarCounter" style={{ width: 18, height: 18, lineHeight: '18px' }}>
            +{userArr.length - 3}
          </div>
        )}
      </div>
    </div>
  );
}
