/**
 * Chat Utilities
 * 
 * Replicates AngularJS ChatUtils functions EXACTLY
 * Source: web_app/src/app/chat/sdk/utils/chatUtils.js
 */

import * as CryptoJS from 'crypto-js';

/**
 * Generate chat ID for P2P chat (matches Angular ChatUtils.generateChatId EXACTLY)
 * 
 * Angular code:
 *   generateChatId: function (jid, otherUserId) {
 *     var chatId = null;
 *     if (jid && otherUserId) {
 *       var info = this.makeUserIdAndAccountIdFromJid(jid);
 *       chatId = info[0]; // account id
 *       var thisUserId = info[1]; // user id
 *       if (thisUserId.localeCompare(otherUserId) < 0) {
 *         chatId += (thisUserId + otherUserId);
 *       } else {
 *         chatId += (otherUserId + thisUserId);
 *       }
 *       chatId = $().crypt({method: "sha1", source: chatId});
 *     }
 *     return chatId.toLowerCase();
 *   }
 * 
 * @param jid - Current user's JID (e.g., "acc-xxx;usr-yyy@domain.com")
 * @param otherUserId - Other user's user ID
 * @returns Chat ID (SHA1 hash, lowercase)
 */
export function generateChatId(jid: string, otherUserId: string): string {
  if (!jid || !otherUserId) {
    return '';
  }

  // Parse JID to extract account ID and user ID
  // JID format: "acc-xxx;usr-yyy@domain.com"
  const jidParts = jid.split('@')[0].split(';');
  const accountId = jidParts[0] || '';
  const thisUserId = jidParts[1]?.replace('usr-', '') || '';

  // Build chat ID: accountId + sorted user IDs
  let chatId = accountId;
  if (thisUserId.localeCompare(otherUserId) < 0) {
    chatId += (thisUserId + otherUserId);
  } else {
    chatId += (otherUserId + thisUserId);
  }

  // Hash with SHA1 (matches Angular $().crypt({method: "sha1"}))
  const hash = CryptoJS.SHA1(chatId).toString();
  return hash.toLowerCase();
}

/**
 * Get current user's JID from session data
 */
export function getCurrentUserJid(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const win = window as any;
  const sessionData = win?.com_convo?.sessionData?.signInResponseData;
  if (!sessionData) {
    return '';
  }

  const accountId = sessionData.account_id || '';
  const userId = sessionData.user?.user_id || '';
  const domain = win?.com_convo?.config?.XMPP_DOMAIN || 'xmpp.convodev.net';

  return `${accountId};usr-${userId}@${domain}`;
}

/**
 * Get current user ID from session data
 */
export function getCurrentUserId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const win = window as any;
  const sessionData = win?.com_convo?.sessionData?.signInResponseData;
  return sessionData?.user?.user_id || '';
}

