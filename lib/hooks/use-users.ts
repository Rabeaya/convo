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
  const results: UserListItem[] = [];
  const queryLower = query ? query.toLowerCase() : '';
  
  // Helper to check if text matches query (with highlighting support)
  const matchesQuery = (text: string): boolean => {
    if (!query || query.trim().length === 0) return true;
    return text.toLowerCase().includes(queryLower);
  };
  
  // Process users
  const publishableUsers = users.filter(user => {
    const userId = (user as any).user_id || (user as any).userId;
    return (user as any).publishable && 
           user.status !== 'INVITED' && 
           userId !== currentUserId;
  });
  
  // Process groups (filter publishable groups)
  const publishableGroups = (groups || []).filter(group => {
    // Filter groups that can be published to (matches AngularJS logic)
    return group.isListable !== false;
  });
  
  // If no query, return top ranked items
  if (!query || query.trim().length === 0) {
    const userItems = publishableUsers
      .sort((a, b) => ((b as any).rank || 0) - ((a as any).rank || 0))
      .slice(0, Math.floor(maxResults / 2))
      .map(user => createUserListItem(user, currentUserId))
      .filter(item => item !== null);
    
    const groupItems = publishableGroups
      .sort((a, b) => ((b as any).rank || 0) - ((a as any).rank || 0))
      .slice(0, Math.floor(maxResults / 2))
      .map(group => createGroupListItem(group));
    
    return [...userItems, ...groupItems].slice(0, maxResults);
  }
  
  // Filter users by query
  const matchingUsers = publishableUsers
    .filter(user => {
      const fullName = getUserFullName(user).toLowerCase();
      const email = ((user as any).email || '').toLowerCase();
      return matchesQuery(fullName) || matchesQuery(email);
    })
    .map(user => {
      const item = createUserListItem(user, currentUserId);
      if (item) {
        // Add formatted labels with highlighting (simplified - AngularJS uses regex)
        const fullName = getUserFullName(user);
        const email = (user as any).email || '';
        item.formattedlabel = fullName; // Would highlight matches in real implementation
        item.formatteddesclabel = email;
        item.desclabel = email;
      }
      return item;
    })
    .filter(item => item !== null);
  
  // Filter groups by query
  const matchingGroups = publishableGroups
    .filter(group => {
      const title = (group.title || group.name || '').toLowerCase();
      return matchesQuery(title);
    })
    .map(group => {
      const item = createGroupListItem(group);
      item.formattedlabel = group.title || group.name || ''; // Would highlight matches
      return item;
    });
  
  // Combine and sort by relevance (matches first, then by rank)
  const allItems = [...matchingUsers, ...matchingGroups].sort((a, b) => {
    // Items that start with query come first
    const aStarts = a.label.toLowerCase().startsWith(queryLower) ? 1 : 0;
    const bStarts = b.label.toLowerCase().startsWith(queryLower) ? 1 : 0;
    if (aStarts !== bStarts) return bStarts - aStarts;
    
    // Then by rank
    const rankDiff = (b.rank || 0) - (a.rank || 0);
    if (rankDiff !== 0) return rankDiff;
    
    // Finally alphabetically
    return a.label.localeCompare(b.label);
  });
  
  return allItems.slice(0, maxResults);
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

