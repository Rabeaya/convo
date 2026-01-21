'use client';

/**
 * UserSearchDropdown Component
 * 
 * Inline dropdown for searching and selecting users to add to chat
 * Matches AngularJS cnvAddUserInChat directive EXACTLY
 * Used in small chat windows (not modal)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { NetworkUser, Chat } from '@/types/chat';
import UserProfileImage from '@/components/common/UserProfileImage';
import './UserSearchDropdown.css';

interface UserSearchDropdownProps {
  chat: Chat;
  isOpen: boolean;
  onClose: () => void;
  onUserSelect: (user: NetworkUser) => void;
  availableUsers: NetworkUser[];
}

export default function UserSearchDropdown({
  chat,
  isOpen,
  onClose,
  onUserSelect,
  availableUsers,
}: UserSearchDropdownProps) {
  const [searchText, setSearchText] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<NetworkUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [displayCount, setDisplayCount] = useState(20);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const usersListRef = useRef<HTMLDivElement>(null);

  // Filter users based on search text and exclude existing participants
  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      setFilteredUsers([]);
      setSelectedIndex(-1);
      setDisplayCount(20);
      return;
    }

    const existingParticipantIds = new Set(Object.keys(chat.participants || {}));
    
    let filtered = availableUsers.filter(user => {
      const userId = user.user_id || user.userId || '';
      
      // Exclude existing participants
      if (existingParticipantIds.has(userId)) {
        return false;
      }
      
      // Filter by search text
      if (searchText.trim()) {
        const searchLower = searchText.toLowerCase();
        const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
        const email = (user.email || '').toLowerCase();
        return displayName.includes(searchLower) || email.includes(searchLower);
      }
      
      return true;
    });

    // Limit display count
    filtered = filtered.slice(0, displayCount);
    setFilteredUsers(filtered);
  }, [isOpen, searchText, availableUsers, chat.participants, displayCount]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle scroll to load more
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Load more when scrolled to bottom
    if (scrollTop >= scrollHeight - clientHeight - 20) {
      if (displayCount < availableUsers.length) {
        setDisplayCount(prev => Math.min(prev + 20, availableUsers.length));
      }
    }
    // Reset to top when scrolled to top
    else if (scrollTop === 0 && !searchText.trim()) {
      setDisplayCount(20);
    }
  }, [displayCount, availableUsers.length, searchText]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setSelectedIndex(-1);
    setDisplayCount(20); // Reset display count on new search
  };

  const handleUserClick = (user: NetworkUser) => {
    onUserSelect(user);
    setSearchText('');
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
      // Scroll selected item into view
      if (usersListRef.current && selectedIndex >= 0) {
        const selectedElement = usersListRef.current.children[selectedIndex + 1] as HTMLElement;
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: 'nearest' });
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
      // Scroll selected item into view
      if (usersListRef.current && selectedIndex > 0) {
        const selectedElement = usersListRef.current.children[selectedIndex] as HTMLElement;
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: 'nearest' });
        }
      }
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < filteredUsers.length) {
      e.preventDefault();
      handleUserClick(filteredUsers[selectedIndex]);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking inside the dropdown
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.user-search-dropdown')) {
      return;
    }
    // Close after a short delay to allow click events to fire
    setTimeout(() => {
      if (document.activeElement !== searchInputRef.current) {
        onClose();
      }
    }, 200);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="user-search-dropdown cnvScrollContainerParent addParticipantList">
      <div className="userSearchBarContainer">
        <div className="searchChatIconContainer">
          <i className="searchChatIcon"></i>
        </div>
        <input
          ref={searchInputRef}
          className="userSearchBar"
          type="text"
          placeholder=""
          value={searchText}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </div>

      <div 
        ref={usersListRef}
        className="addUserList cnvScrollContainer"
        style={{ overflowY: 'scroll' }}
        onScroll={handleScroll}
      >
        {filteredUsers.length === 0 ? (
          <div className="no-users-found">No users found</div>
        ) : (
          filteredUsers.map((user, index) => {
            const userId = user.user_id || user.userId || '';
            const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';
            const isSelected = selectedIndex === index;
            const isParticipant = chat.participants?.[userId] !== undefined;

            return (
              <div
                key={userId}
                className={`chat-member possible-chat-participant ${isSelected ? 'chat-member-selected' : ''} ${isParticipant ? 'user-not-participant' : ''}`}
                onClick={() => !isParticipant && handleUserClick(user)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="user-img-with-presence">
                  <UserProfileImage
                    userId={userId}
                    size={81}
                    width={32}
                    height={32}
                    profileType={user.profile_image_type?.toString()}
                    profileVersion={user.profile_image_version?.toString()}
                    fullName={displayName}
                  />
                  {/* Presence indicator would go here if needed */}
                </div>
                <span className="chat-member-label">{displayName}</span>
                {isParticipant && (
                  <span className="chat-participant">
                    {user.user_role === 'GUEST' || user.userRole === 'GUEST' ? 'GUEST' : ''}
                    {isParticipant && (user.user_role === 'GUEST' || user.userRole === 'GUEST') && ' | '}
                    {isParticipant && 'ADDED'}
                  </span>
                )}
              </div>
            );
          })
        )}
        <div className="scroll-bar-cover-bar"></div>
      </div>
    </div>
  );
}



