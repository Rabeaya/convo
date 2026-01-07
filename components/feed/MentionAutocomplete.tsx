'use client';

/**
 * MentionAutocomplete Component
 * 
 * Provides @mention autocomplete dropdown for comment editor
 * Mirrors AngularJS Quill mention dropdown UI (dropdown-cont / dropdown-item-cont / img-label-list-item)
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUsers, queryPublishableUsersAndGroups, getUserFullName } from '@/lib/hooks/use-users';
import { useGroups } from '@/lib/hooks/use-groups';
import { getUserProfileImageUrl, stringToColor } from '@/lib/api/users';
import { useAuthStore } from '@/lib/stores/auth-store';
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [adjustedTop, setAdjustedTop] = useState<number>(position.top);

  const currentUserId = (user as any)?.user_id || (user as any)?.userId;

  // Get suggestions based on query (users + groups) — users first, then groups (matches Angular itemsItems order)
  const suggestions: UserListItem[] = useMemo(() => {
    if (usersLoading || groupsLoading) return [];
    if (!usersData?.usersArray) return [];
    
    const groupsArray = groupsData?.groups || [];
    
    return queryPublishableUsersAndGroups(
      usersData.usersArray,
      groupsArray,
      query,
      10, // maxResults
      currentUserId
    );
  }, [usersData, groupsData, query, currentUserId, usersLoading, groupsLoading]);

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

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, suggestions.length]);

  // Mirror mention.js behavior: if dropdown would overflow bottom, flip above caret (top - dropdownHeight - 26)
  useLayoutEffect(() => {
    setAdjustedTop(position.top);
    const el = dropdownRef.current;
    if (!el) return;
    const dropdownHeight = el.getBoundingClientRect().height;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    let top = position.top;
    if (top + dropdownHeight > viewportHeight) {
      top = top - dropdownHeight - 26;
    }
    setAdjustedTop(top);
  }, [position.top, position.left, suggestions.length]);

  if (usersLoading || groupsLoading || suggestions.length === 0) {
    return null;
  }

  // Render into document.body like Angular mention plugin (dropdown-menu.dropdown-cont is absolutely positioned on body)
  if (typeof document === 'undefined') return null;

  return createPortal(
    <ul
      ref={dropdownRef}
      className="rte-autocomplete dropdown-menu dropdown-cont"
      style={{
        top: `${adjustedTop}px`,
        left: `${position.left}px`,
        display: 'block',
      }}
      onMouseDown={(e) => {
        // Prevent textarea blur before we handle selection
        e.preventDefault();
      }}
    >
      {suggestions.map((item, index) => {
        const isUser = item.type === 'USER';
        const isGroup = item.type === 'GROUP';

        const userObj = isUser ? usersData?.users?.[item.id] : null;
        const imgurl = userObj
          ? getUserProfileImageUrl(
              (userObj as any).user_id || (userObj as any).userId,
              (userObj as any).profile_image_type,
              (userObj as any).profile_image_version,
              '32x32'
            )
          : '';

        const isDefaultUserThumb = !!imgurl && imgurl.indexOf('user-images/default-user/thumbnails/') !== -1;
        const initials = (item.label || '. .').trim().length
          ? (item.label || '. .').trim().split(/\s+/).slice(0, 2).map((p) => (p[0] || '')).join('').toUpperCase().slice(0, 2)
          : '. .';
        const initialsBg = stringToColor(item.label || item.id);

        // Group icon class (mirrors usersGroupsListProvider.createGroupListItem)
        const groupAccess = (item.access || 'PUBLIC').toUpperCase();
        const groupIconClass =
          groupAccess === 'PUBLIC' ? 'Icon1_PublicChannel-01-lightgray' : 'privateGroup_icon-lightgray';

        return (
          <li
            key={item.id}
            className={`dropdown-item-cont ${index === selectedIndex ? 'active' : ''}`}
            onMouseEnter={() => setSelectedIndex(index)}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
          >
            <a href="#" onClick={(e) => e.preventDefault()}>
              <div className="img-label-list-item">
                {/* Avatar / icon */}
                {isUser ? (
                  isDefaultUserThumb ? (
                    <span
                      className="img-circle"
                      style={{
                        height: '32px',
                        width: '32px',
                        fontStyle: 'normal',
                        lineHeight: '32px',
                        fontSize: 'inherit',
                        textAlign: 'center',
                        borderRadius: '100%',
                        backgroundColor: initialsBg,
                        display: 'inline-block',
                        color: '#fff',
                      }}
                    >
                      {initials || '. .'}
                    </span>
                  ) : (
                    <img src={imgurl} className="usr-img-32 img-circle" alt={item.label} />
                  )
                ) : (
                  <span className="img-circle mention-group-avatar">
                    <i className={`cnv-icons-32 ${groupIconClass}`} />
                  </span>
                )}

                {/* Text */}
                <span dangerouslySetInnerHTML={{ __html: item.formattedlabel || item.label }} />
                <span
                  className="sec-label"
                  dangerouslySetInnerHTML={{ __html: item.formatteddesclabel || item.desclabel || '' }}
                />
                {(item as any).invited ? <status className="list-item-status light">Invited</status> : null}
              </div>
            </a>
          </li>
        );
      })}
    </ul>,
    document.body
  );
}

