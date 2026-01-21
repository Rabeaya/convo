'use client';

/**
 * UserListItem - Network user item in chat list
 * 
 * EXACT replication of AngularJS user item (cnvChatUsersWindow.tpl.html lines 101-123)
 * Shows: avatar, name, presence indicator
 * Does NOT show: last message, timestamp, unread count (those are only for chats)
 */

import type { NetworkUser } from '@/types/chat';
import UserProfileImage from '@/components/common/UserProfileImage';
import './ChatListItem.css';

interface UserListItemProps {
  user: NetworkUser;
  isSelected: boolean;
  onClick: () => void;
}

// Format last active time (matches Angular dateAgo filter)
function formatLastActiveTime(lastPingTime?: number): string {
  if (!lastPingTime) return '';
  const now = Date.now();
  const diff = now - lastPingTime;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/**
 * Check if user is invited (matches Angular User.isInvitedUser)
 * Angular: User.prototype.isInvitedUser = function () { return this.status === "INVITED"; }
 */
function isInvitedUser(user: NetworkUser): boolean {
  const status = (user as any).status || user.user_role || '';
  return status === 'INVITED' || status === 'invited';
}

export default function UserListItem({ user, isSelected, onClick }: UserListItemProps) {
  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  // Ensure presenceStatus and device are numbers (TypeScript safety)
  const presenceStatus: number = typeof user.presenceStatus === 'number' ? user.presenceStatus : 4; // Default to offline
  const device: number = typeof user.device === 'number' ? user.device : 1; // Default to desktop
  const userId = user.userId || user.user_id;
  const isGuestUser = user.user_role === 'guest' || user.user_role === 'GUEST';
  
  const invited = isInvitedUser(user); // Check invited status (matches Angular)

  return (
    <div className={`chatListItemContainer ${isSelected ? 'selected' : ''}`}>
      {/* EXACT Angular structure: bo-show="chat.userId" - line 101 */}
      <div
        className="listItem"
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
        style={{ paddingTop: '10px' }}
      >
        {/* Avatar (40x40 - Angular lines 102-106) */}
        <div className="user-img-48">
          <UserProfileImage
            userId={userId}
            width={40}
            height={40}
            profileType={user.profile_image_type}
            profileVersion={user.profile_image_version}
            fullName={displayName}
            user={user}
            accountId={user.account_id || user.accountId}
          />
        </div>

        {/* User name (Angular lines 107-110) */}
        <div style={{ display: 'inline-grid' }}>
          <div className="listUserName">{displayName}</div>
          {/* Guest user label (Angular line 109) */}
          {isGuestUser && (
            <div
              style={{
                marginTop: '16px',
                fontSize: '82%',
                color: 'gray',
                marginLeft: '13px',
                left: '19%',
                position: 'absolute',
              }}
            >
              {user.designation ? `${user.designation} | GUEST` : 'GUEST'}
            </div>
          )}
        </div>

        {/* Invited user icon (Angular line 111: bo-if="chat.isInvitedUser()") */}
        {invited && (
          <span className="invited-icon cnv-icons-20 Icon1__Time-darkgray"></span>
        )}

        {/* Presence indicator (Angular lines 112-122: bo-if="!chat.isInvitedUser()") */}
        {!invited && (
          <div
            style={{
              position: 'absolute',
              left: '41px',
              marginTop: '27px',
              display: 'inline-block',
              zIndex: 10,
            }}
          >
            {/* Online - Green dot */}
            {presenceStatus === 1 && device !== 2 && (
              <div className="listUserStatusOnline" />
            )}
            {/* Busy - Red dot */}
            {presenceStatus === 2 && device !== 2 && (
              <div className="listUserStatusBusy" />
            )}
            {/* Idle - Orange dot */}
            {presenceStatus === 3 && device !== 2 && (
              <div className="listUserStatusIdle" />
            )}
            {/* Offline - Grey dot */}
            {presenceStatus === 4 && device !== 2 && !user.has_mobile && (
              <div className="listUserStatusOffline" />
            )}
            {/* Mobile or Offline with mobile */}
            {(device === 2 || (presenceStatus === 4 && user.has_mobile)) && (
              <div className="user-inactive-time-field">
                {presenceStatus === 4 && user.lastPingTime && typeof user.lastPingTime === 'number' && (
                  <span className="user-inactive-time">
                    {formatLastActiveTime(user.lastPingTime)}
                  </span>
                )}
                <div className="listUserStatusMobile chat-list" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Border (Angular line 259) */}
      <div className="listItemBorder" />
    </div>
  );
}


