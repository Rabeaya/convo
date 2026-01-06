'use client';

/**
 * MentionAutocomplete Component
 * 
 * Provides @mention autocomplete dropdown for comment editor
 * Matches AngularJS Quill mention plugin behavior
 */

import React, { useEffect, useRef, useState } from 'react';
import { useUsers, queryPublishableUsersAndGroups, getUserFullName } from '@/lib/hooks/use-users';
import { useGroups } from '@/lib/hooks/use-groups';
import { getUserProfileImageUrl, stringToColor } from '@/lib/api/users';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useFeedContext } from '@/lib/contexts/FeedContext';
import type { UserListItem } from '@/lib/hooks/use-users';

interface MentionAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (item: UserListItem) => void;
  onClose: () => void;
}

export default function MentionAutocomplete({
  query,
  position,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const { data: usersData, isLoading: usersLoading } = useUsers();
  const { data: groupsData, isLoading: groupsLoading } = useGroups();
  const { user } = useAuthStore();
  
  // Try to get groups from feed context, but don't throw error if not available
  let feedGroups: Record<string, any> = {};
  try {
    const context = useFeedContext();
    feedGroups = context.groups || {};
  } catch {
    // FeedContext not available, will use groups from hook
  }
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentUserId = (user as any)?.user_id || (user as any)?.userId;

  // Get suggestions based on query (users + groups)
  // Matches AngularJS atMentionsListProvider.queryPublishableUsersAndGroups()
  const suggestions: UserListItem[] = React.useMemo(() => {
    if (usersLoading || groupsLoading) return [];
    if (!usersData?.usersArray) return [];
    
    // Use groups from feed context if available, otherwise from groups hook
    const groupsArray = feedGroups && Object.keys(feedGroups).length > 0
      ? Object.values(feedGroups)
      : (groupsData?.groups || []);
    
    return queryPublishableUsersAndGroups(
      usersData.usersArray,
      groupsArray,
      query,
      10, // maxResults
      currentUserId
    );
  }, [usersData, groupsData, feedGroups, query, currentUserId, usersLoading, groupsLoading]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && suggestions.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, suggestions.length]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, suggestions.length]);

  if (usersLoading || groupsLoading || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="mention-autocomplete-dropdown"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: '#fff',
        border: '1px solid #ddd', // Light grey border (matches reference image)
        borderRadius: '3px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: '200px',
        maxWidth: '300px',
        maxHeight: '200px',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <ul
        ref={listRef}
        style={{
          listStyle: 'none',
          padding: '5px 0',
          margin: 0,
        }}
      >
        {suggestions.map((item, index) => {
          const isUser = item.type === 'USER';
          const isGroup = item.type === 'GROUP';
          
          // Get user data for profile image
          const user = isUser ? usersData?.users?.[item.id] : null;
          const profileImageUrl = user
            ? getUserProfileImageUrl(
                (user as any).user_id || (user as any).userId,
                (user as any).profile_image_type,
                (user as any).profile_image_version,
                '32x32'
              )
            : '';

          // Get user initials for avatar fallback
          const initials = isUser && user
            ? getUserFullName(user).substring(0, 2).toUpperCase()
            : (isUser ? item.label.substring(0, 2).toUpperCase() : '');

          // Get avatar background color (for users without profile images)
          const avatarBgColor = isUser && !profileImageUrl
            ? stringToColor(item.label || item.id)
            : '#e0e0e0';

          // Group icon classes (matches AngularJS createGroupListItem)
          const getGroupIconClass = () => {
            const access = (item.access || 'PUBLIC').toLowerCase();
            if (access === 'public') {
              return 'Icon1_PublicChannel-01-lightgray'; // Blue square with 'C'
            } else {
              return 'privateGroup_icon-lightgray'; // Private/Secret groups
            }
          };

          return (
            <li
              key={item.id}
              onClick={() => onSelect(item)}
              className="img-label-list-item"
              style={{
                padding: '8px 15px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? '#f5f5f5' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                lineHeight: item.formatteddesclabel ? 'normal' : '35px',
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {/* User Avatar (circular) or Group Icon (square) */}
              {isUser && (
                <div
                  className="single-user"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: profileImageUrl
                      ? `url(${profileImageUrl}) center/cover`
                      : avatarBgColor,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  {!profileImageUrl && initials}
                </div>
              )}
              
              {isGroup && (
                <i
                  className={`cnv-icons-32 ${getGroupIconClass()}`}
                  style={{
                    width: '32px',
                    height: '32px',
                    flexShrink: 0,
                    display: 'inline-block',
                    fontSize: '32px', // For cnv-icons font
                    lineHeight: '32px',
                    textAlign: 'center',
                  }}
                ></i>
              )}

              {/* Name and Description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '14px',
                    color: '#272b2c',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                  dangerouslySetInnerHTML={{ __html: item.formattedlabel || item.label }}
                />
                {/* Email for users, "Group" for groups (matches reference image) */}
                {item.formatteddesclabel && (
                  <span
                    className="sec-label"
                    style={{
                      fontSize: '12px',
                      color: '#959595',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                    dangerouslySetInnerHTML={{ __html: item.formatteddesclabel }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

