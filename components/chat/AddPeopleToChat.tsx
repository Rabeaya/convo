'use client';

/**
 * AddPeopleToChat Component
 * 
 * Modal component for adding people to a group chat
 * Matches AngularJS addPeopleInChatModalCtrl and cnvAddPeopleInChat directive
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { NetworkUser, Chat } from '@/types/chat';
import UserProfileImage from '@/components/common/UserProfileImage';
import './AddPeopleToChat.css';

interface AddPeopleToChatProps {
  chat: Chat;
  isOpen: boolean;
  onClose: () => void;
  onInvite: (users: NetworkUser[]) => void;
  availableUsers: NetworkUser[];
}

interface SelectedUser {
  userId: string;
  displayName: string;
  accountId?: string;
}

export default function AddPeopleToChat({
  chat,
  isOpen,
  onClose,
  onInvite,
  availableUsers,
}: AddPeopleToChatProps) {
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<NetworkUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const usersListRef = useRef<HTMLDivElement>(null);

  // Filter users based on search text and exclude existing participants
  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      setSelectedUsers([]);
      setSelectedIndex(-1);
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

    // Limit to 20 users for performance
    filtered = filtered.slice(0, 20);
    setFilteredUsers(filtered);
  }, [isOpen, searchText, availableUsers, chat.participants]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setSelectedIndex(-1);
  };

  const handleUserClick = (user: NetworkUser) => {
    const userId = user.user_id || user.userId || '';
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';
    
    // Check if already selected
    if (selectedUsers.some(u => u.userId === userId)) {
      return;
    }

    // Add to selected users
    setSelectedUsers([...selectedUsers, {
      userId,
      displayName,
      accountId: user.account_id || user.accountId,
    }]);
    
    // Clear search
    setSearchText('');
    setSelectedIndex(-1);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.userId !== userId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < filteredUsers.length) {
      e.preventDefault();
      handleUserClick(filteredUsers[selectedIndex]);
    }
  };

  const handleInvite = () => {
    if (selectedUsers.length === 0) {
      return;
    }

    // Convert selected users to NetworkUser format
    const usersToInvite: NetworkUser[] = selectedUsers.map(selected => {
      const user = availableUsers.find(u => (u.user_id || u.userId) === selected.userId);
      return user || {
        user_id: selected.userId,
        userId: selected.userId,
        first_name: selected.displayName.split(' ')[0] || '',
        last_name: selected.displayName.split(' ').slice(1).join(' ') || '',
        email: '',
      };
    });

    onInvite(usersToInvite);
    setSelectedUsers([]);
    setSearchText('');
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="add-people-modal-overlay" onClick={onClose}>
      <div className="add-people-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-people-modal-header">
          <h3>Add People</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="add-people-modal-content">
          {/* Selected users tags */}
          {selectedUsers.length > 0 && (
            <div className="selected-users-tags">
              {selectedUsers.map(user => (
                <span key={user.userId} className="user-tag">
                  {user.displayName}
                  <button
                    className="remove-tag"
                    onClick={() => handleRemoveUser(user.userId)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="search-input-container">
            <input
              ref={searchInputRef}
              type="text"
              className="user-search-input"
              placeholder="Search for people..."
              value={searchText}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Users list */}
          <div className="users-list-container" ref={usersListRef}>
            {filteredUsers.length === 0 ? (
              <div className="no-users">No users found</div>
            ) : (
              filteredUsers.map((user, index) => {
                const userId = user.user_id || user.userId || '';
                const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';
                const isSelected = selectedIndex === index;
                const isAlreadyParticipant = chat.participants?.[userId] !== undefined;

                return (
                  <div
                    key={userId}
                    className={`user-item ${isSelected ? 'selected' : ''} ${isAlreadyParticipant ? 'participant' : ''}`}
                    onClick={() => !isAlreadyParticipant && handleUserClick(user)}
                  >
                    <div className="user-avatar">
                      <UserProfileImage
                        userId={userId}
                        size={81}
                        width={32}
                        height={32}
                        profileType={user.profile_image_type?.toString()}
                        profileVersion={user.profile_image_version?.toString()}
                        fullName={displayName}
                      />
                    </div>
                    <span className="user-name">{displayName}</span>
                    {isAlreadyParticipant && (
                      <span className="participant-badge">ADDED</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="add-people-modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-invite"
            onClick={handleInvite}
            disabled={selectedUsers.length === 0}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}



