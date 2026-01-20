/**
 * Chat Types - Replicates AngularJS chat data model
 * Based on: web_app/src/app/chat/sdk/vos/chat.js
 */

export type ChatType = 1 | 2; // 1 = P2P, 2 = GROUP

/**
 * Network User - from Users API
 * Represents a user in the network who may not have an active chat
 */
export interface NetworkUser {
  user_id: string;
  userId?: string; // Alias
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  profile_picture?: string;
  profile_image_type?: number;
  profile_image_version?: number;
  user_role?: string;
  designation?: string;
  department?: string;
  is_accessible?: boolean;
  isAccessible?: boolean;
  last_active_time?: number;
  account_id?: string;
  accountId?: string;
  presenceStatus?: number; // Populated from XMPP
  device?: number;
  has_mobile?: boolean;
  lastPingTime?: number;
  [key: string]: unknown;
}

export interface ChatParticipant {
  userId: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  name?: string; // Alternative name field (matches AngularJS)
  status?: string; // 'JOINED', 'INVITED', 'LEFT', 'EXIT', 'ACTIVE' (matches AngularJS ParticipantStatus)
  presenceStatus?: number; // 1=online, 2=busy, 3=idle, 4=offline
  device?: number; // 1=desktop, 2=mobile
  profileImageType?: string;
  profileImageVersion?: string;
  accountId?: string;
  isInvitedUser?: boolean;
  lastPingTime?: number;
  hasMobile?: boolean; // Alias for has_mobile
  showParticipantInfo?: number; // 0 = hide, 1 = show (matches AngularJS)
}

export interface Chat {
  chatId: string;
  title: string;
  chatType: ChatType;
  unreadCount: number;
  lastMessageTimestamp: number;
  lastMessageSequenceNumber: number;
  minSequenceNumber?: number; // Minimum sequence number in loaded messages (for load older messages) - matches AngularJS chat.minSequenceNumber
  isLoadingInProgress?: boolean; // Prevents duplicate load older messages calls - matches AngularJS chat.isLoadingInProgress
  summeryText?: string; // Last message preview (HTML)
  isMuted: boolean;
  participants: Record<string, ChatParticipant>;
  isUnifiedChat?: boolean;
  chatStatus?: string;
  iconVersion?: string;
  lastMessageSenderId?: string;
  
  // Typing/Recording indicators
  isAnyParticipantComposing?: boolean;
  isAnyParticipantRecording?: boolean;
  composingParticipants?: Array<{ name: string; userId: string }>;
  
  // Read receipts (seen indicators)
  shouldShowSeenParticipantsInList?: boolean;
  seenParticipants?: Array<{ userId: string; name: string; accountId?: string }>;
  moreParticipantsCount?: number;
  
  // For P2P chats
  _user?: ChatParticipant; // Other user in P2P chat
  
  // For display
  accountName?: string; // For grouping by network
}

/**
 * Combined type for chat list display
 * Can be either an existing Chat or a NetworkUser
 */
export type ChatListItem = Chat | NetworkUser;

/**
 * Type guards
 */
export function isChat(item: ChatListItem): item is Chat {
  return 'chatId' in item;
}

export function isNetworkUser(item: ChatListItem): item is NetworkUser {
  return ('user_id' in item || 'userId' in item) && !('chatId' in item);
}

/**
 * Helper to get display name from user
 */
export function getUserDisplayName(user: NetworkUser): string {
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
}

/**
 * Helper to get user ID (handles both user_id and userId)
 */
export function getUserId(user: NetworkUser): string {
  // user_id is required, userId is optional - use user_id as fallback
  return (typeof user.userId === 'string' ? user.userId : user.user_id);
}

