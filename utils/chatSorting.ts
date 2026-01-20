/**
 * Chat Sorting Utilities
 * 
 * Replicates AngularJS ChatUtils sorting logic EXACTLY
 * Source: web_app/src/app/chat/sdk/utils/chatUtils.js
 * Source: web_app/src/app/chat/sdk/vos/user.js (compareTo method)
 */

import type { Chat, NetworkUser } from '@/types/chat';

/**
 * Compare two users for sorting (matches Angular User.compareTo EXACTLY)
 * 
 * Source: web_app/src/app/chat/sdk/vos/user.js lines 156-189
 * 
 * Sorting logic:
 * 1. Invited users go to the bottom (sorted alphabetically)
 * 2. Regular users sorted by:
 *    a) Presence status (online=1, busy=2, idle=3, offline=4) - ascending
 *    b) Rank (higher rank first) - descending
 * 
 * @param userA - First user
 * @param userB - Second user
 * @returns -1 if userA < userB, 0 if equal, 1 if userA > userB
 */
export function compareUsers(userA: NetworkUser, userB: NetworkUser): number {
  // Check if user is invited (matches Angular isInvitedUser: status === "INVITED")
  // Angular: com_convo.chatsdk.User.prototype.isInvitedUser = function () { return this.status === "INVITED"; }
  const statusA = (userA as any).status || userA.user_role || '';
  const statusB = (userB as any).status || userB.user_role || '';
  const isInvitedA = statusA === 'INVITED' || statusA === 'invited';
  const isInvitedB = statusB === 'INVITED' || statusB === 'invited';

  // Handle invited users (matches Angular lines 161-174 EXACTLY)
  if (isInvitedA || isInvitedB) {
    if (isInvitedA && isInvitedB) {
      // Both invited: sort alphabetically by display name (matches Angular line 164-166)
      const nameA = `${userA.first_name || ''} ${userA.last_name || ''}`.trim() || userA.email;
      const nameB = `${userB.first_name || ''} ${userB.last_name || ''}`.trim() || userB.email;
      // Angular: result = lhs < rhs ? -1 : (lhs === rhs ? 0 : 1);
      return nameA < nameB ? -1 : (nameA === nameB ? 0 : 1);
    } else if (isInvitedA) {
      // Only userA is invited: userA goes to bottom (matches Angular line 168-169)
      return 1;
    } else {
      // Only userB is invited: userB goes to bottom (matches Angular line 171-172)
      return -1;
    }
  }

  // Regular users (matches Angular lines 176-186 EXACTLY)
  const presenceA = userA.presenceStatus || 4; // Default offline (UNAVAILABLE)
  const presenceB = userB.presenceStatus || 4;

  if (presenceA !== presenceB) {
    // Primary sort: by presence status (ascending: 1, 2, 3, 4)
    // Online (1) first, offline (4) last (matches Angular line 177-180)
    // Angular: result = lhs < rhs ? -1 : (lhs === rhs ? 0 : 1);
    return presenceA < presenceB ? -1 : (presenceA === presenceB ? 0 : 1);
  }

  // Secondary sort: by rank (descending: higher rank first) (matches Angular line 182-184)
  // Angular: result = lhs < rhs ? 1 : (lhs === rhs ? 0 : -1);
  const rankA = (userA as any).rank || 0;
  const rankB = (userB as any).rank || 0;
  return rankA < rankB ? 1 : (rankA === rankB ? 0 : -1);
}

/**
 * Sort users array in place (matches Angular sortUsers)
 * 
 * @param users - Array of network users
 */
export function sortUsers(users: NetworkUser[]): void {
  users.sort(compareUsers);
}

/**
 * Compare two chats for sorting (matches Angular ChatUtils.sortChats EXACTLY)
 * 
 * Source: web_app/src/app/chat/sdk/utils/chatUtils.js lines 65-70
 * 
 * Sorts by lastMessageTimestamp descending (most recent first)
 * 
 * Angular code:
 *   chatsList.sort(function (lhs, rhs) {
 *     return (lhs.lastMessageTimestamp < rhs.lastMessageTimestamp ? 1 :
 *       (lhs.lastMessageTimestamp > rhs.lastMessageTimestamp ? -1 : 0));
 *   });
 * 
 * @param chatA - First chat (lhs)
 * @param chatB - Second chat (rhs)
 * @returns -1 if chatA > chatB (more recent), 0 if equal, 1 if chatA < chatB
 */
export function compareChats(chatA: Chat, chatB: Chat): number {
  const timestampA = chatA.lastMessageTimestamp || 0;
  const timestampB = chatB.lastMessageTimestamp || 0;
  
  // Exact match to Angular ChatUtils.sortChats (line 65-69):
  // chatsList.sort(function (lhs, rhs) {
  //   return (lhs.lastMessageTimestamp < rhs.lastMessageTimestamp ? 1 :
  //     (lhs.lastMessageTimestamp > rhs.lastMessageTimestamp ? -1 : 0));
  // });
  // 
  // Most recent first (descending): if A < B, return 1 (A goes after B)
  //                                  if A > B, return -1 (A goes before B)
  //                                  if A == B, return 0 (equal)
  if (timestampA < timestampB) {
    return 1; // A is older, goes after B
  } else if (timestampA > timestampB) {
    return -1; // A is newer, goes before B
  } else {
    return 0; // Equal timestamps
  }
}

/**
 * Sort chats array in place (matches Angular ChatUtils.sortChats)
 * 
 * @param chats - Array of chats
 */
export function sortChats(chats: Chat[]): void {
  chats.sort(compareChats);
}

/**
 * Merge and sort chats + users (matches Angular cnvChatUserList.js line 1132)
 * 
 * Order: Chats first, then users (IMPORTANT!)
 * Chats are sorted by last message timestamp (most recent first)
 * Users are sorted by presence + rank (online first)
 * 
 * This matches Angular's populateUserList:
 * $scope.chatList = result.chats.concat(result.users);
 * 
 * @param users - Array of network users (without active chats)
 * @param chats - Array of existing chats
 * @returns Merged and sorted array
 */
export function mergeAndSortChatList(
  users: NetworkUser[],
  chats: Chat[]
): (NetworkUser | Chat)[] {
  // Sort chats (in place)
  const sortedChats = [...chats];
  sortChats(sortedChats);

  // Sort users (in place)
  const sortedUsers = [...users];
  sortUsers(sortedUsers);

  // Merge: chats first, then users (matches Angular line 1132)
  return [...sortedChats, ...sortedUsers];
}

/**
 * Check if item is a chat (type guard)
 */
export function isChat(item: NetworkUser | Chat): item is Chat {
  return 'chatId' in item;
}

/**
 * Check if item is a user (type guard)
 */
export function isUser(item: NetworkUser | Chat): item is NetworkUser {
  return 'user_id' in item || ('userId' in item && !('chatId' in item));
}

/**
 * Get sort priority for presence status (for debugging/display)
 */
export function getPresencePriority(presenceStatus: number): string {
  switch (presenceStatus) {
    case 1: return '1-Online';
    case 2: return '2-Busy';
    case 3: return '3-Idle';
    case 4: return '4-Offline';
    default: return '4-Offline';
  }
}


