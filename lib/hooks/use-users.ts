/**
 * useUsers Hook
 * 
 * Fetches and caches users for @mentions and user display
 * Matches AngularJS Users service behavior
 */

import { useQuery } from '@tanstack/react-query';
import { usersService } from '../api/users';
import type { User } from '../api/auth';

export interface UserListItem {
  id: string;
  label: string;
  formattedlabel: string;
  formatteddesclabel?: string;
  labelisemail?: boolean;
  labelisphone?: boolean;
  type?: 'USER' | 'GROUP' | 'CONTACT';
  imgUrl?: string;
  classes?: string;
  isGuestUser?: boolean;
  status?: string;
  rank?: number;
  desclabel?: string;
  email?: string;
  access?: string; // For groups: 'PUBLIC', 'PRIVATE', 'SECRET'
  grouptype?: string; // For groups
}

/**
 * Get user full name
 * Matches AngularJS Users.getUserFullName()
 */
export function getUserFullName(user: User | null | undefined): string {
  if (!user) return 'Unknown';
  
  let fullName = '';
  if ((user as any).fullName) {
    fullName = (user as any).fullName;
  } else if ((user as any).first_name || (user as any).last_name) {
    fullName = ((user as any).first_name || '') + ' ' + ((user as any).last_name || '').trim();
  } else if ((user as any).name) {
    fullName = (user as any).name;
  }
  
  if (fullName.trim().length < 2) {
    // Fallback to email or user_id
    if ((user as any).email) {
      fullName = (user as any).email;
    } else if ((user as any).user_id) {
      fullName = (user as any).user_id;
    } else {
      fullName = 'Unknown';
    }
  }
  
  return fullName.trim();
}

/**
 * Create user list item for @mentions
 * Matches AngularJS usersGroupsListProvider.createUserListItem()
 */
export function createUserListItem(user: User, currentUserId?: string): UserListItem {
  const fullName = getUserFullName(user);
  const userId = (user as any).user_id || (user as any).userId || (user as any).id;
  
  // Don't include current user in mentions
  if (currentUserId && userId === currentUserId) {
    return null as any;
  }
  
  // Get email/phone for desc label (matches AngularJS logic)
  const email = (user as any).email || '';
  const phone = (user as any).phone_no || '';
  const showEmail = (user as any).show_email;
  const showPhone = (user as any).show_phone;
  
  let desclabel = '';
  let labelisemail = false;
  let labelisphone = false;
  
  // Determine desc label (matches AngularJS createUserListItem logic)
  if (showEmail && email) {
    desclabel = email;
    labelisemail = true;
  } else if (showPhone && phone) {
    desclabel = phone;
    labelisphone = true;
  }
  
  return {
    id: userId,
    label: fullName,
    formattedlabel: fullName,
    formatteddesclabel: desclabel,
    desclabel: desclabel,
    labelisemail,
    labelisphone,
    type: 'USER',
    imgUrl: '', // Will be generated using getUserProfileImageUrl
    classes: `user ${(user as any).isGuestUser ? 'guest-user' : ''}`,
    isGuestUser: (user as any).isGuestUser || false,
    status: (user as any).status || 'ACTIVE',
    rank: (user as any).rank || 0,
    email: email,
  };
}

/**
 * Create group list item for @mentions
 * Matches AngularJS usersGroupsListProvider.createGroupListItem()
 */
export function createGroupListItem(group: any): UserListItem {
  const groupId = group.id || group.group_id;
  const groupTitle = group.title || group.name || '';
  const access = (group.access || 'PUBLIC').toLowerCase();
  
  // Determine group icon class (matches AngularJS createGroupListItem)
  let classes = 'group ';
  if (access === 'public') {
    classes += 'Icon1_PublicChannel-01-lightgray';
  } else if (access === 'private' || access === 'profile') {
    classes += 'privateGroup_icon-lightgray';
  } else if (access === 'secret') {
    classes += 'privateGroup_icon-lightgray';
  }
  
  return {
    id: groupId,
    label: groupTitle,
    formattedlabel: groupTitle,
    formatteddesclabel: 'Group',
    desclabel: 'Group',
    type: 'GROUP',
    imgUrl: '',
    classes,
    grouptype: group.type,
    access: access.toUpperCase(),
    rank: group.rank || 0,
  };
}

/**
 * Query publishable users and groups for @mentions
 * Matches AngularJS atMentionsListProvider.queryPublishableUsersAndGroups()
 */
export function queryPublishableUsersAndGroups(
  users: User[],
  groups: any[],
  query: string,
  maxResults: number = 10,
  currentUserId?: string
): UserListItem[] {
  // AngularJS usersGroupsListProvider.queryPublishableUsersAndGroups:
  // - returns [] if !query
  // - scans users first, then groups (each list already sorted by relevancy)
  // - adds item if label or desc label matches regex, and sets formattedlabel/formatteddesclabel with <b> highlighting

  if (!query || !query.trim().length) {
    return [];
  }

  const escapeRegexChars = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(([\\s,<>():._])|^)(${escapeRegexChars(query)})`, 'gi');

  const highlight = (text: string) => {
    if (!text) return '';
    return text.replace(regex, (_m, p1, _p2, p3) => `${p1}<b>${p3}</b>`);
  };

  const results: UserListItem[] = [];

  // Users first (include INVITED users at the end like Angular does, but keep them searchable)
  const publishableUsers = (users || [])
    .filter((u: any) => {
      const id = u.user_id || u.userId || u.id;
      return !!u.publishable && id !== currentUserId;
    })
    .slice()
    .sort((a: any, b: any) => {
      const aInv = a.status === 'INVITED' ? 1 : 0;
      const bInv = b.status === 'INVITED' ? 1 : 0;
      if (aInv !== bInv) return aInv - bInv; // invited last
      return (b.rank || 0) - (a.rank || 0); // higher rank first
    });

  for (let i = 0; i < publishableUsers.length && results.length < maxResults; i++) {
    const u: any = publishableUsers[i];
    const item = createUserListItem(u as any, currentUserId);
    if (!item) continue;

    const formattedLabel = highlight(item.label || '');
    const formattedDesc = highlight(item.desclabel || '');

    // Only include if match exists in label or desc (Angular checks formatted != original)
    if (formattedLabel !== (item.label || '') || formattedDesc !== (item.desclabel || '')) {
      item.formattedlabel = formattedLabel;
      item.formatteddesclabel = formattedDesc || item.formatteddesclabel || item.desclabel || '';
      (item as any).invited = u.status === 'INVITED';
      results.push(item);
    }
  }

  // Then groups
  const publishableGroups = (groups || [])
    .filter((g: any) => g.isListable !== false)
    .slice()
    .sort((a: any, b: any) => (b.rank || 0) - (a.rank || 0));

  for (let i = 0; i < publishableGroups.length && results.length < maxResults; i++) {
    const g: any = publishableGroups[i];
    const item = createGroupListItem(g);
    const formattedLabel = highlight(item.label || '');
    if (formattedLabel !== (item.label || '')) {
      item.formattedlabel = formattedLabel;
      item.formatteddesclabel = 'Group';
      results.push(item);
    }
  }

  return results;
}

/**
 * Hook to fetch users
 */
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersService.getUsers();
      // Convert users_data array to map for easier lookup
      const usersMap: Record<string, User> = {};
      if (response.data.users_data) {
        response.data.users_data.forEach((user: any) => {
          const userId = user.user_id || user.userId || user.id;
          if (userId) {
            usersMap[userId] = user;
          }
        });
      }
      return {
        users: usersMap,
        usersArray: response.data.users_data || [],
        accountDataRevisionNumber: response.data.account_data_revision_number,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

