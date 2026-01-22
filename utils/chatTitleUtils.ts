/**
 * Chat Title Utilities
 * 
 * Replicates AngularJS chat.getTitle() logic for computing group chat titles
 * from participant names.
 */

import type { Chat, ChatParticipant, NetworkUser } from '@/types/chat';

/**
 * Computes group chat title from participant names
 * Matches AngularJS: com_convo.chatsdk.Chat.prototype.getTitle
 * 
 * Logic:
 * - If chat has a custom title (_title), use it
 * - Otherwise, compute from participants:
 *   - Show first 2 participant names (first name only for groups)
 *   - Add "+N" if more than 2 participants
 *   - If no participants, show "Group Chat" or "Empty Room"
 */
export function computeGroupChatTitle(
  chat: Chat,
  allUsers: NetworkUser[],
  currentUserId: string
): string {
  // If chat has a custom title, use it
  if (chat.title && chat.title.trim() !== '') {
    return chat.title;
  }

  // For non-group chats, return default
  if (chat.chatType !== 2) {
    return chat.title || 'Chat';
  }

  const participants = chat.participants || {};
  let participantsCount = 0;
  let titleString = '';
  let thisUserInChat = false;

  // Iterate through participants
  for (const userId in participants) {
    const participant = participants[userId];
    
    // Match AngularJS: if(!chatParticipant.showParticipantInfo ...) continue;
    // (Angular treats undefined/0 as hidden)
    if (!(participant as any).showParticipantInfo) {
      continue;
    }
    
    // Skip if participant has left (matches AngularJS status === 'exit' || status === 'left')
    if (participant.status === 'exit' || participant.status === 'left') {
      continue;
    }

    if (userId === currentUserId) {
      thisUserInChat = true;
    } else {
      // Find user in allUsers
      const user = allUsers.find(u => {
        const uId = u.user_id || u.userId || '';
        return uId === userId;
      });

      // Match AngularJS: usersManager.getUserById(...) presence is enough to include user in title
      if (user) {
        participantsCount++;
        
        // Show first 2 names
        if (participantsCount < 3) {
          if (titleString) {
            titleString += ', ';
          }
          
          // For group chats, use first name only
          if (chat.chatType === 2) {
            // Prefer firstName, then first word of name, then displayName
            if (user.first_name) {
              titleString += user.first_name;
            } else if (user.name) {
              titleString += user.name.split(' ')[0];
            } else if (participant.firstName) {
              titleString += participant.firstName;
            } else if (participant.name) {
              titleString += participant.name.split(' ')[0];
            } else if (participant.displayName) {
              titleString += participant.displayName.split(' ')[0];
            } else if (user.displayName) {
              titleString += user.displayName.split(' ')[0];
            }
          } else {
            // For P2P chats, use full display name
            titleString = user.displayName || user.first_name || user.name || participant.displayName || participant.name || '';
          }
        }
      } else if (user === undefined && chat.isUnifiedChat && participant.name) {
        // Handle unified chat participants not in network (matches AngularJS lines 808-823)
        participantsCount++;
        if (participantsCount < 3) {
          if (titleString) {
            titleString += ', ';
          }
          if (chat.chatType === 2) {
            titleString += participant.name.split(' ')[0];
          } else {
            titleString = participant.name;
          }
        }
      }
    }
  }

  // Subtract 2 because we've already displayed 2 names
  participantsCount = participantsCount - 2;

  // Add "+N" if more than 2 participants
  if (participantsCount > 0) {
    titleString += ` +${participantsCount}`;
  }

  // Fallback if no title computed
  if (!titleString) {
    // Match AngularJS: if every other participant left but this user is in chat → "Group Chat"
    if (thisUserInChat) {
      titleString = 'Group Chat';
    } else {
      titleString = 'Empty Room';
    }
  }

  return titleString;
}



