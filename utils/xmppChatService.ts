/**
 * XMPP Chat Service
 * 
 * Fetches chat list via XMPP IQ stanzas (same as AngularJS)
 * Endpoint: convochat@domain
 * Namespace: convo:chat:history:chats
 */

import { Strophe, $iq, $msg, $pres } from 'strophe.js';
import type { Chat, ChatParticipant } from '@/types/chat';
import type { ChatMessage } from '@/types/message';

type TimeoutHandle = ReturnType<typeof setTimeout>;

interface XMPPConfig {
  domain: string;
  boshUrl: string;
  jid: string;
  password: string;
}

interface PresenceInfo {
  status: number; // 1=online, 2=busy, 3=idle, 4=offline
  device: number; // 1=desktop, 2=mobile
}

export class XMPPChatService {
  private connection: Strophe.Connection | null = null;
  private isConnected = false;
  private isConnecting = false; // Prevent multiple simultaneous connection attempts (matches AngularJS isConnecting)
  private domain: string | null = null;
  private userIdToPresenceMap: Record<string, PresenceInfo> = {}; // Matches Angular presenceManager.userIdToPresenceMap
  private messageHandlers: Array<(message: ChatMessage) => void> = []; // Track all registered handlers
  private messageHandlerAttached: boolean = false; // Track if Strophe handler is attached
  private messageHandlerRef: any = null; // Store handler reference to prevent garbage collection (matches AngularJS)
  private pendingMessageTimeouts: Map<string, TimeoutHandle> | null = null; // Track fallback timeouts for sent messages
  
  // Retry logic (matches AngularJS connectionManager.js lines 15-17)
  private reconnectTimerId: TimeoutHandle | null = null;
  private connectionTimeoutTimerId: TimeoutHandle | null = null;
  private reconnectAfterSecs = 1000; // DEFAULT_RECONNECTION_DELAY = 1 second
  private readonly DEFAULT_RECONNECTION_DELAY = 1000; // 1 second
  private readonly MAX_RECONNECTION_DELAY = 60 * 1000; // 1 minute
  private readonly CONNECTION_TIMEOUT = 30 * 1000; // 30 seconds
  private readonly WILL_RECONNECT = 9; // Custom status for will reconnect
  private connectionStatus: number = Strophe.Status.DISCONNECTED;
  private connectCallbacks: { onConnected: () => void; onError: (error: string) => void } | null = null;
  private connectConfig: XMPPConfig | null = null;

  connect(config: XMPPConfig, onConnected: () => void, onError: (error: string) => void) {
    // If already connected, call onConnected immediately (matches AngularJS)
    if (this.isConnected) {
      console.log('[XMPP] Already connected');
      onConnected();
      return;
    }

    // Prevent multiple simultaneous connection attempts (matches AngularJS isConnecting flag)
    if (this.isConnecting) {
      console.log('[XMPP] Connection already in progress, ignoring duplicate connect call');
      // Store callbacks for when connection completes
      this.connectCallbacks = { onConnected, onError };
      this.connectConfig = config;
      return;
    }

    // Store callbacks and config for retry logic
    this.connectCallbacks = { onConnected, onError };
    this.connectConfig = config;

    this.connectInternal();
  }

  private connectInternal() {
    if (!this.connectConfig || !this.connectCallbacks) {
      console.error('[XMPP] Cannot connect - config or callbacks missing');
      return;
    }

    const config = this.connectConfig;
    const { onConnected, onError } = this.connectCallbacks;

    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      console.log('[XMPP] Connection already in progress');
      return;
    }

    try {
      console.log('[XMPP] Connecting to:', config.boshUrl);
      console.log('[XMPP] JID:', config.jid);
      
      this.isConnecting = true;
      this.domain = config.domain;
      this.updateStatus(Strophe.Status.CONNECTING);
      
      // Clear any existing connection timeout
      this.clearConnectionTimeout();
      
      // Set connection timeout (matches AngularJS CONNECTION_TIMEOUT = 30 seconds)
      this.connectionTimeoutTimerId = setTimeout(() => {
        if (!this.isConnected) {
          console.warn('[XMPP] Connection timeout after 30 seconds');
          if (this.connection) {
            this.connection.reset();
          }
          this.cleanAndRetry();
        }
      }, this.CONNECTION_TIMEOUT);
      
      // Dispose existing connection if any
      if (this.connection) {
        try {
          this.connection.reset();
        } catch (e) {
          // Ignore reset errors
        }
        this.connection = null;
      }
      
      // Create Strophe Connection with BOSH options (matches Angular connectionManager)
      // Angular uses: connection = new Strophe.Connection(boshURL)
      this.connection = new Strophe.Connection(config.boshUrl, {
        // BOSH connection options
        keepalive: true, // Keep connection alive
        // Note: Strophe.js handles BOSH-specific options automatically
      });
      
      // Enable verbose logging in development
      if (process.env.NODE_ENV === 'development') {
        (this.connection as any).rawInput = (data: string) => {
          console.log('[XMPP IN]', data);
          // CRITICAL: Log ALL incoming data, especially empty body tags
          if (data.trim() === '<body xmlns="http://jabber.org/protocol/httpbind"/>' || data.trim() === '<body xmlns="http://jabber.org/protocol/httpbind"></body>') {
            console.log('[XMPP IN] ⚠️ Empty body tag received - server might not be echoing message back');
          }
          // Check if this is a server echo of our sent message
          if (data.includes('convo-message')) {
            console.log('[XMPP IN] 🔍 Convo message detected in raw input');
            const seqMatch = data.match(/sequence_number="([^"]*)"/);
            const msgIdMatch = data.match(/id="([^"]+)"/);
            const msgTypeMatch = data.match(/message_type="([^"]*)"/);
            const fromMatch = data.match(/from="([^"]+)"/);
            const toMatch = data.match(/to="([^"]+)"/);
            const hasBodyTag = data.includes('<body>') && !data.includes('<body xmlns');
            const bodyTextMatch = data.match(/<body[^>]*>([^<]*)<\/body>/);
            
            console.log('[XMPP IN] 🔍 Convo message details:', {
              messageId: msgIdMatch ? msgIdMatch[1] : 'unknown',
              sequenceNumber: seqMatch ? seqMatch[1] : 'unknown',
              messageType: msgTypeMatch ? msgTypeMatch[1] : 'unknown',
              from: fromMatch ? fromMatch[1] : 'unknown',
              to: toMatch ? toMatch[1] : 'unknown',
              hasBody: hasBodyTag,
              bodyText: bodyTextMatch ? bodyTextMatch[1].substring(0, 50) : 'NO BODY TEXT',
              fullData: data.substring(0, 2000), // First 2000 chars for debugging
            });
            
            // CRITICAL: Check if this is a regular message (not composing/typing/ack)
            const isRegularMessage = (!msgTypeMatch || msgTypeMatch[1] === '' || msgTypeMatch[1] === 'message') && hasBodyTag;
            if (isRegularMessage) {
              console.log('[XMPP IN] ✅ REGULAR MESSAGE DETECTED IN RAW INPUT:', {
                messageId: msgIdMatch ? msgIdMatch[1] : 'unknown',
                messageType: msgTypeMatch ? msgTypeMatch[1] : 'message (empty)',
                bodyText: bodyTextMatch ? bodyTextMatch[1].substring(0, 100) : 'NO BODY',
                from: fromMatch ? fromMatch[1] : 'unknown',
              });
            }
            
            // Check if this might be a server ACK for a sent message
            if (seqMatch && seqMatch[1] && parseInt(seqMatch[1], 10) > 0) {
              console.log('[XMPP IN] 🎯 POTENTIAL SERVER ACK - sequence_number > 0:', {
                messageId: msgIdMatch ? msgIdMatch[1] : 'unknown',
                sequenceNumber: seqMatch[1],
                messageType: msgTypeMatch ? msgTypeMatch[1] : 'unknown',
              });
            }
          }
        };
        (this.connection as any).rawOutput = (data: string) => {
          console.log('[XMPP OUT]', data);
          // Extract messageId from outgoing message for tracking
          const messageIdMatch = data.match(/id="([^"]+)"/);
          if (messageIdMatch) {
            console.log('[XMPP OUT] 📤 Message sent with ID:', messageIdMatch[1]);
          }
        };
      }
      
      this.connection.connect(
        config.jid,
        config.password,
        (status) => {
          this.handleConnectionStatus(status, onConnected, onError);
        }
      );
    } catch (error) {
      console.error('[XMPP] Connection error:', error);
      this.isConnecting = false;
      this.updateStatus(Strophe.Status.DISCONNECTED);
      onError(error instanceof Error ? error.message : 'Connection error');
    }
  }

  private handleConnectionStatus(
    status: number,
    onConnected: () => void,
    onError: (error: string) => void
  ) {
    console.log('[XMPP] Status:', status, '(', this.getStatusName(status), ')');
    
    try {
      switch (status) {
        case Strophe.Status.CONNECTING:
          // Already handled in connectInternal
          break;
          
        case Strophe.Status.AUTHENTICATING:
          // Authentication in progress
          break;
          
        case Strophe.Status.CONNECTED:
          this.handleConnected(onConnected);
          break;
          
        case Strophe.Status.CONNFAIL:
        case Strophe.Status.DISCONNECTED:
          this.handleDisconnected(status === Strophe.Status.CONNFAIL);
          break;
          
        case Strophe.Status.AUTHFAIL:
          console.warn('[XMPP] Authentication failed');
          this.isConnecting = false;
          this.updateStatus(Strophe.Status.DISCONNECTED);
          // Don't retry on auth failure - it's a permanent error
          onError('Authentication failed');
          break;
          
        case Strophe.Status.DISCONNECTING:
          this.isConnecting = false;
          break;
          
        case Strophe.Status.ERROR:
          console.warn('[XMPP] Connection error');
          this.handleDisconnected(true);
          break;
          
        default:
          console.log('[XMPP] Unhandled status:', status);
      }
    } catch (ex) {
      console.error('[XMPP] Error handling connection status:', ex);
    }
  }

  private handleConnected(onConnected: () => void) {
    this.clearConnectionTimeout();
    this.isConnecting = false;
    this.isConnected = true;
    this.updateStatus(Strophe.Status.CONNECTED);
    
    // Reset reconnect delay on successful connection (matches AngularJS line 200)
    this.reconnectAfterSecs = this.DEFAULT_RECONNECTION_DELAY;
    
    console.log('[XMPP] ✅ Connected successfully');
    console.log('[XMPP] Connection state:', {
      connectionExists: !!this.connection,
      connectionConnected: this.connection?.connected,
      connectionAuthenticated: (this.connection as any)?.authenticated,
      isConnected: this.isConnected,
      jid: this.connection?.jid,
    });
    console.log('[XMPP] Registered message handlers:', this.messageHandlers?.length || 0);
    
    // CRITICAL: Wait a bit for connection to be fully ready (matches AngularJS timing)
    // In AngularJS, handlers are attached in callsManager.onXMPPConnected which is called
    // AFTER the CONNECTED event is dispatched, giving time for connection to stabilize
    setTimeout(() => {
      console.log('[XMPP] ⏰ Delayed handler attachment - checking connection state again');
      console.log('[XMPP] Connection state after delay:', {
        connectionExists: !!this.connection,
        connectionConnected: this.connection?.connected,
        connectionAuthenticated: (this.connection as any)?.authenticated,
        isConnected: this.isConnected,
        jid: this.connection?.jid,
      });
      
      // Attach message handlers after connection is fully ready (matches AngularJS callsManager.onXMPPConnected line 153)
      // This ensures handlers are registered before any messages arrive
      // CRITICAL: Attach handlers even if callbacks were registered before connection
      this.attachHandlers();
    }, 100); // Small delay to ensure connection is fully ready
    
    // Fetch roster immediately after connection (matches Angular presenceManager line 24-26)
    setTimeout(() => {
      this.fetchRoster();
    }, 0);
    
    // Call onConnected callback
    if (this.connectCallbacks) {
      this.connectCallbacks.onConnected();
    }
    onConnected();
  }

  private handleDisconnected(connectionClosedOnError: boolean) {
    console.warn('[XMPP] Disconnected');
    this.clearConnectionTimeout();
    this.isConnecting = false;
    this.isConnected = false;
    this.messageHandlerAttached = false; // Reset handler flag on disconnect
    this.messageHandlerRef = null; // Clear handler reference on disconnect
    
    const oldStatus = this.connectionStatus;
    this.updateStatus(Strophe.Status.DISCONNECTED);
    
    // CRITICAL: Set current user's presence to offline when disconnected
    // Matches AngularJS presenceManager line 29-31: clears map on DISCONNECTED
    // But we also need to set current user to offline so UI updates
    const getCurrentUserId = () => {
      if (typeof window !== 'undefined') {
        const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
        return sessionData?.user?.user_id || '';
      }
      return '';
    };
    const currentUserId = getCurrentUserId();
    if (currentUserId) {
      // Set to offline (UNAVAILABLE = 4)
      this.userIdToPresenceMap[currentUserId] = {
        status: 4, // UNAVAILABLE (offline)
        device: 1, // DESKTOP
      };
      console.log('[XMPP] Set current user presence to offline on disconnect');
      
      // Dispatch event so UI updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('xmppPresenceChanged', { detail: this.userIdToPresenceMap }));
      }
    }
    
    // Reset connection if it exists (matches AngularJS line 172)
    if (this.connection) {
      try {
        this.connection.reset();
      } catch (e) {
        // Ignore reset errors
      }
    }
    
    // Only retry if connection closed on error (not manual disconnect)
    // Matches AngularJS line 186: if (connectivityService.isConnected() && connectionClosedOnError)
    if (connectionClosedOnError) {
      // Check if we have internet connectivity (simplified check)
      if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
        this.cleanAndRetry();
      } else {
        console.warn('[XMPP] No internet connectivity, not retrying');
      }
    }
  }

  private updateStatus(newStatus: number) {
    if (newStatus !== this.connectionStatus) {
      this.connectionStatus = newStatus;
    }
  }

  private clearConnectionTimeout() {
    if (this.connectionTimeoutTimerId) {
      clearTimeout(this.connectionTimeoutTimerId);
      this.connectionTimeoutTimerId = null;
    }
  }

  private clearReconnectTimeout() {
    if (this.reconnectTimerId) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }
  }

  private maybeStartReconnect(now: boolean = false) {
    // Check internet connectivity
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.updateStatus(Strophe.Status.DISCONNECTED);
      return;
    }
    
    this.updateStatus(this.WILL_RECONNECT);
    
    // Clear existing reconnect timer (matches AngularJS line 115-117)
    this.clearReconnectTimeout();
    
    if (now) {
      // Reconnect immediately
      this.reconnectAfterSecs = this.DEFAULT_RECONNECTION_DELAY;
      this.connectInternal();
    } else {
      // Exponential backoff (matches AngularJS line 122-125)
      this.reconnectAfterSecs *= 2;
      if (this.reconnectAfterSecs >= this.MAX_RECONNECTION_DELAY) {
        this.reconnectAfterSecs = this.DEFAULT_RECONNECTION_DELAY;
      }
      
      console.log(`[XMPP] Will reconnect after ${this.reconnectAfterSecs}ms`);
      this.reconnectTimerId = setTimeout(() => {
        this.connectInternal();
      }, this.reconnectAfterSecs);
    }
  }

  private cleanAndRetry(now: boolean = false) {
    // Dispose connection (matches AngularJS dispose function)
    if (this.connection) {
      try {
        this.connection.reset();
      } catch (e) {
        // Ignore errors
      }
      this.connection = null;
    }
    
    // CRITICAL: Reset isConnecting flag to allow reconnection
    this.isConnecting = false;
    
    // Only reconnect if we have config and callbacks (connection was previously established)
    if (this.connectConfig && this.connectCallbacks) {
      // Start reconnect with backoff
      this.maybeStartReconnect(now);
    } else {
      console.warn('[XMPP] Cannot reconnect - config or callbacks missing');
    }
  }

  private getStatusName(status: number): string {
    const names: Record<number, string> = {
      0: 'ERROR',
      1: 'CONNECTING',
      2: 'CONNFAIL',
      3: 'AUTHENTICATING',
      4: 'AUTHFAIL',
      5: 'CONNECTED',
      6: 'DISCONNECTED',
      7: 'DISCONNECTING',
      8: 'ATTACHED',
    };
    return names[status] || 'UNKNOWN';
  }

  fetchChats(
    fromIndex: number = 0,
    toIndex: number = 20,
    onSuccess: (chats: Chat[]) => void,
    onError: (error: string) => void
  ) {
    if (!this.connection || !this.isConnected) {
      console.error('[XMPP] Cannot fetch chats - not connected');
      onError('XMPP not connected. Please wait for connection to establish.');
      return;
    }

    if (!this.domain) {
      console.error('[XMPP] Cannot fetch chats - domain not set');
      onError('XMPP domain not configured');
      return;
    }

    const convoChatJid = `convochat@${this.domain}`;
    const uuid = this.generateUuid();

    console.log('[XMPP] Fetching chats from:', convoChatJid, `(${fromIndex}-${toIndex})`);

    // Build IQ stanza matching AngularJS exactly
    const iq = $iq({
      to: convoChatJid,
      type: 'get',
      id: uuid,
    })
      .c('query', { xmlns: 'convo:chat:history:chats', 'basic-info': 'true' })
      .c('range', { from_index: String(fromIndex), to_index: String(toIndex) });

    this.connection.sendIQ(
      iq.tree(),
      // Success handler
      (response) => {
        console.log('[XMPP] ✅ Chats fetched successfully');
        try {
          const chats = this.parseChatsXML(response);
          console.log(`[XMPP] Parsed ${chats.length} chats`);
          onSuccess(chats);
        } catch (error) {
          console.error('[XMPP] Parse error:', error);
          onError(error instanceof Error ? error.message : 'Failed to parse chats');
        }
      },
      // Error handler
      (error) => {
        console.error('[XMPP] ❌ Failed to fetch chats:', error);
        onError('Failed to fetch chats from server');
      }
    );
  }

  private parseChatsXML(xmlResponse: Element): Chat[] {
    const chats: Chat[] = [];
    
    // Parse <chats> element
    const chatsElement = xmlResponse.querySelector('chats');
    if (!chatsElement) {
      return chats;
    }

    // Get current user ID (matches Angular getOtherParticipant)
    const currentUserId = (typeof window !== 'undefined' && (window as any)?.com_convo?.sessionData?.signInResponseData?.user?.user_id) || null;

    // Parse each <chat> element
    const chatElements = chatsElement.querySelectorAll('chat');
    chatElements.forEach((chatEl) => {
      const chatId = chatEl.getAttribute('id');
      const title = chatEl.getAttribute('title') || '';
      const chatType = chatEl.getAttribute('type') === 'chat' ? 1 : 2; // P2P or GROUP
      const unreadCount = parseInt(chatEl.getAttribute('unread_count') || '0', 10);
      const lastMessageTimestamp = parseInt(chatEl.getAttribute('last_message_time') || '0', 10);
      const lastMessageSequenceNumber = parseInt(chatEl.getAttribute('sequence_number') || '0', 10);
      const summeryText = chatEl.getAttribute('last_message') || '';
      const isMuted = chatEl.getAttribute('mute') === 'true';
      const iconVersion = chatEl.getAttribute('chat_icon_version') || undefined;
      const isUnifiedChat = chatEl.getAttribute('is_unified_chat') === '1';
      const chatStatus = chatEl.getAttribute('chat_status') || undefined;

      if (!chatId) return;

      // Parse participants
      const participants: Record<string, ChatParticipant> = {};
      let otherUser: ChatParticipant | undefined;

      const participantsEl = chatEl.querySelector('participants');
      if (participantsEl) {
        const participantElements = participantsEl.querySelectorAll('participant');
        participantElements.forEach((partEl) => {
          const userId = partEl.getAttribute('id') || '';
          const displayName = partEl.getAttribute('name') || '';
          const presenceStatus = parseInt(partEl.getAttribute('presence_status') || '4', 10);
          
          // Get presence from XMPP roster if available (more up-to-date than XML attribute)
          const presenceFromRoster = this.userIdToPresenceMap[userId];
          const finalPresenceStatus = presenceFromRoster ? presenceFromRoster.status : presenceStatus;
          const finalDevice = presenceFromRoster ? presenceFromRoster.device : 1;
          
          // CRITICAL: Convert empty strings to undefined (getAttribute returns "" for empty attributes)
          // Empty strings would be converted to 0 by Number(), causing default images to show
          const profileImageTypeAttr = partEl.getAttribute('profile_image_type');
          const profileImageVersionAttr = partEl.getAttribute('profile_image_version');
          
          // Parse participant status (matches AngularJS: status="joined", "invited", "left", "exit", etc.)
          const statusAttr = partEl.getAttribute('status') || '';
          const status = statusAttr.toLowerCase(); // Normalize to lowercase
          
          // Parse showParticipantInfo (0 = hide, 1 = show)
          const showParticipantInfoAttr = partEl.getAttribute('show_participant_info');
          const showParticipantInfo = showParticipantInfoAttr ? parseInt(showParticipantInfoAttr, 10) : 1;
          
          const participant: ChatParticipant = {
            userId,
            displayName,
            name: displayName, // Also set name field for compatibility
            status: status || 'joined', // Default to 'joined' if not specified
            presenceStatus: finalPresenceStatus, // Use roster presence if available, else XML attribute
            device: finalDevice, // From roster
            profileImageType: (profileImageTypeAttr && profileImageTypeAttr.trim() !== '') ? profileImageTypeAttr : undefined,
            profileImageVersion: (profileImageVersionAttr && profileImageVersionAttr.trim() !== '') ? profileImageVersionAttr : undefined,
            accountId: partEl.getAttribute('account_id') || undefined,
            showParticipantInfo: showParticipantInfo,
          };
          
          // Debug log for profile image data
          if (participant.profileImageType || participant.profileImageVersion) {
            console.log(`[XMPP] Participant ${userId} profile image:`, {
              profileImageType: participant.profileImageType,
              profileImageVersion: participant.profileImageVersion,
              rawType: profileImageTypeAttr,
              rawVersion: profileImageVersionAttr,
            });
          }
          
          if (presenceFromRoster) {
            console.log(`[XMPP] Using roster presence for chat participant ${userId}: status=${finalPresenceStatus}, device=${finalDevice}`);
          }

          participants[userId] = participant;

          // For P2P chats, get the OTHER user (NOT the current logged-in user)
          // Matches Angular: chat.getOtherParticipant(chat.thisUser.userId)
          if (chatType === 1 && userId !== currentUserId) {
            otherUser = participant;
            console.log(`[XMPP] P2P Chat ${chatId} - Other user:`, displayName, `(excluding current user: ${currentUserId})`);
          }
        });
      }

      // For P2P chats, use other user's name as title if no custom title
      // For group chats, title will be computed later from participants (in ChatListContext)
      // Matches Angular: chat.getTitle() returns other participant's name for P2P
      const chatTitle = title || (chatType === 1 && otherUser?.displayName) || (chatType === 2 ? '' : 'Chat');

      chats.push({
        chatId,
        title: chatTitle,
        chatType,
        unreadCount,
        lastMessageTimestamp,
        lastMessageSequenceNumber,
        summeryText,
        isMuted,
        participants,
        iconVersion,
        isUnifiedChat,
        chatStatus,
        _user: otherUser,
      });
    });

    console.log(`[XMPP] Parsed ${chats.length} chats. P2P chats show OTHER participant, not current user.`);
    return chats;
  }

  private generateUuid(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Fetch message history for a chat (matches Angular messagesLoader.chatOpened EXACTLY)
   * 
   * @param chatId - Chat ID
   * @param range - Range object with either {from_index, to_index} or {from_sequence_number, to_sequence_number}
   * @param onSuccess - Success callback
   * @param onError - Error callback
   */
  fetchMessagesWithRange(
    chatId: string,
    range: { from_index?: number; to_index?: number; from_sequence_number?: number; to_sequence_number?: number },
    onSuccess: (messages: ChatMessage[]) => void,
    onError: (error: string) => void,
    isUnifiedChat?: boolean,
    unifiedNetworkAccountId?: string
  ) {
    if (!this.connection || !this.isConnected) {
      console.error('[XMPP] Cannot fetch messages - not connected');
      onError('XMPP not connected');
      return;
    }

    if (!this.domain) {
      console.error('[XMPP] Cannot fetch messages - domain not set');
      onError('XMPP domain not configured');
      return;
    }

    const convoChatJid = `convochat@${this.domain}`;
    const uuid = this.generateUuid();

    console.log('[XMPP] Fetching messages for chat:', chatId, 'range:', range);

    // Build chat request object (matches AngularJS line 2197-2205)
    const chatRequest: Record<string, string> = { id: chatId };
    
    // Add unified chat parameters if needed (matches AngularJS lines 2199-2202)
    if (isUnifiedChat) {
      const sessionData = (typeof window !== 'undefined' && (window as any).com_convo?.sessionData?.signInResponseData);
      chatRequest['unified_account_id'] = unifiedNetworkAccountId || 
        sessionData?.unified_network_settings?.account_id || 
        sessionData?.account_id || '';
      chatRequest['is_unified_chat'] = '1';
    }

    // Build IQ stanza matching Angular messagesLoader.js line 2207-2213 EXACTLY
    const iq = $iq({
      to: convoChatJid,
      type: 'get',
      id: uuid,
    })
      .c('query', { xmlns: 'convo:chat:history:messages' })
      .c('chat', chatRequest);
    
    // Add range element with appropriate attributes (matches AngularJS line 2213)
    if (range.from_index !== undefined && range.to_index !== undefined) {
      iq.c('range', { from_index: String(range.from_index), to_index: String(range.to_index) });
    } else if (range.from_sequence_number !== undefined && range.to_sequence_number !== undefined) {
      iq.c('range', { 
        from_sequence_number: String(range.from_sequence_number), 
        to_sequence_number: String(range.to_sequence_number) 
      });
    }

    this.connection.sendIQ(
      iq.tree(),
      // Success handler
      (response) => {
        console.log('[XMPP] ✅ Messages fetched successfully');
        console.log('[XMPP] Response XML:', response.outerHTML || response.toString());
        try {
          const messages = this.parseMessagesXML(response);
          console.log(`[XMPP] Parsed ${messages.length} messages`);
          if (messages.length === 0) {
            console.warn('[XMPP] ⚠️ No messages found in response - this might be normal if chat is empty');
          }
          onSuccess(messages);
        } catch (error) {
          console.error('[XMPP] Parse error:', error);
          console.error('[XMPP] Response that failed to parse:', response.outerHTML || response.toString());
          onError(error instanceof Error ? error.message : 'Failed to parse messages');
        }
      },
      // Error handler
      (error) => {
        console.error('[XMPP] ❌ Failed to fetch messages:', error);
        onError('Failed to fetch messages from server');
      }
    );
  }

  /**
   * Fetch message history for a chat (legacy method - use fetchMessagesWithRange instead)
   * 
   * @param chatId - Chat ID
   * @param fromIndex - Start index (1-based)
   * @param toIndex - End index
   * @param onSuccess - Success callback with messages
   * @param onError - Error callback
   */
  fetchMessages(
    chatId: string,
    fromIndex: number = 1,
    toIndex: number = 20,
    onSuccess: (messages: ChatMessage[]) => void,
    onError: (error: string) => void
  ) {
    this.fetchMessagesWithRange(chatId, { from_index: fromIndex, to_index: toIndex }, onSuccess, onError);
  }

  /**
   * Load older messages in chat (matches AngularJS messagesLoader.loadOlderMessagesInChat EXACTLY)
   * 
   * Fetches older messages when user scrolls to top of chat window.
   * Uses sequence number range to fetch messages before the current minimum sequence number.
   * 
   * @param chatId - Chat ID
   * @param minSequenceNumber - Current minimum sequence number in loaded messages
   * @param isUnifiedChat - Whether this is a unified chat
   * @param unifiedNetworkAccountId - Unified network account ID (if unified chat)
   * @param onSuccess - Success callback with older messages
   * @param onError - Error callback
   * @returns boolean - true if loading started, false if already loading or no more messages
   */
  loadOlderMessagesInChat(
    chatId: string,
    minSequenceNumber: number,
    isUnifiedChat: boolean = false,
    unifiedNetworkAccountId?: string,
    onSuccess?: (messages: ChatMessage[]) => void,
    onError?: (error: string) => void
  ): boolean {
    // Prevent duplicate calls (matches AngularJS line 2761-2763)
    // This check should be done by caller, but we also check here for safety
    if (minSequenceNumber <= 1) {
      console.log('[XMPP] Cannot load older messages - already at beginning (minSequenceNumber <= 1)');
      return false;
    }

    const MESSAGE_FETCH_PAGE_SIZE = 20; // Matches AngularJS MESSAGE_FETCH_PAGE_SIZE constant
    
    // Calculate range (matches AngularJS lines 2767-2768)
    const fromSequenceNo = Math.max(1, minSequenceNumber - MESSAGE_FETCH_PAGE_SIZE);
    const toSequenceNumber = minSequenceNumber - 1;

    console.log('[XMPP] Loading older messages:', {
      chatId,
      minSequenceNumber,
      fromSequenceNo,
      toSequenceNumber,
      isUnifiedChat,
    });

    // Fetch messages using sequence number range (matches AngularJS line 2769)
    this.fetchMessagesWithRange(
      chatId,
      { from_sequence_number: fromSequenceNo, to_sequence_number: toSequenceNumber },
      (messages) => {
        console.log(`[XMPP] ✅ Loaded ${messages.length} older messages`);
        if (onSuccess) {
          onSuccess(messages);
        }
      },
      (error) => {
        console.error('[XMPP] ❌ Failed to load older messages:', error);
        if (onError) {
          onError(error);
        }
      }
    );

    return true; // Loading started
  }

  /**
   * Send a message (matches AngularJS messagesLoader.sendMessageInP2PChat EXACTLY)
   * 
   * @param messageText - Message text
   * @param chatId - Chat ID
   * @param recipientJid - Recipient JID (for P2P) - format: "accountId;userId@domain"
   * @param recipientDisplayName - Optional: recipient's display name (matches AngularJS other.displayName)
   * @param onSuccess - Success callback
   * @param onError - Error callback
   * @param fileInfo - Optional: file attachment info (matches AngularJS serializeFileInfo)
   */
  sendMessage(
    messageText: string,
    chatId: string,
    recipientJid: string,
    recipientDisplayName?: string, // Optional: recipient's display name (matches AngularJS other.displayName)
    onSuccess?: () => void,
    onError?: (error: string) => void,
    fileInfo?: ChatMessage['fileInfo'], // Optional: file attachment info
    existingMessageId?: string // Optional: existing messageId for re-sending (matches AngularJS reSendMessageInChat line 924)
  ) {
    if (!this.connection || !this.isConnected) {
      console.error('[XMPP] Cannot send message - not connected', {
        hasConnection: !!this.connection,
        isConnected: this.isConnected,
        connectionStatus: this.connectionStatus,
        statusName: this.getStatusName(this.connectionStatus),
      });
      
      // If we have config, try to reconnect
      if (this.connectConfig && this.connectCallbacks && !this.isConnecting) {
        console.log('[XMPP] Attempting to reconnect...');
        this.cleanAndRetry(true); // Reconnect immediately
      }
      
      onError?.('XMPP not connected');
      return null;
    }

    if (!this.domain) {
      console.error('[XMPP] Cannot send message - domain not set');
      onError?.('XMPP domain not configured');
      return null;
    }

    // CRITICAL: Use existing messageId if provided (matches AngularJS reSendMessageInChat line 924: id: message.messageId)
    // This ensures re-sent messages update the existing message instead of creating duplicates
    const messageId = existingMessageId || this.generateUuid();
    const timestamp = Date.now();

    // Get current user info (matches AngularJS thisUser)
    const getCurrentUser = () => {
      if (typeof window !== 'undefined') {
        const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
        const user = sessionData?.user || {};
        
        // Construct display name (matches AngularJS User.getDisplayName() lines 79-90)
        // Uses: first_name + " " + last_name, or email if empty
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        let displayName = `${firstName} ${lastName}`.trim();
        
        // If full name is empty, use email as fallback (matches AngularJS line 86)
        if (!displayName) {
          displayName = user.email || '';
        }
        
        return {
          userId: user.user_id || '',
          displayName: displayName,
          accountId: sessionData?.account_id || '',
        };
      }
      return { userId: '', displayName: '', accountId: '' };
    };
    const thisUser = getCurrentUser();

    // Extract recipient user ID from JID (format: "accountId;userId@domain")
    const recipientUserId = recipientJid.split(';')[1]?.split('@')[0] || '';
    // Use provided display name or fallback to empty (matches AngularJS other.displayName || other.getDisplayName())
    const recipientName = recipientDisplayName || '';

    // Build message stanza matching AngularJS EXACTLY (lines 573-579)
    // CRITICAL: Send to convochat@domain, NOT directly to recipient
    const convoChatJid = `convochat@${this.domain}`;
    
    // Get current user's JID (matches AngularJS this.xmppCallsManager.getJid())
    // First try to get from connection (most reliable)
    let fromJid = '';
    if (this.connection && this.connection.jid) {
      fromJid = this.connection.jid;
    } else {
      // Fallback to constructing from session data
      if (thisUser.accountId && thisUser.userId && this.domain) {
        fromJid = `${thisUser.accountId};${thisUser.userId}@${this.domain}`;
      }
    }
    
    // CRITICAL: Validate that we have required data (matches AngularJS validation)
    if (!fromJid) {
      console.error('[XMPP] Cannot send message - fromJid is empty', {
        accountId: thisUser.accountId,
        userId: thisUser.userId,
        domain: this.domain,
      });
      onError?.('Cannot determine sender JID');
      return null;
    }
    
    // Build convo-message attributes (matches AngularJS lines 538-549)
    // CRITICAL: AngularJS includes sequence_number as empty string when sending (server fills it in echo)
    // Note: from_name can be empty - server will fill it from user profile (matches AngularJS behavior)
    const convoMessageAttrs: Record<string, string> = {
      xmlns: 'http://convo.com/xmpp/chat/message', // XMLNS.CONVO_MESSAGE
      chat_id: chatId,
      from_name: thisUser.displayName || '', // Matches AngularJS thisUser.getDisplayName() (can be empty)
      message_type: 'message', // MType.toString(MType.MESSAGE)
      timestamp: String(timestamp),
      for_user_id: recipientUserId,
      for_name: recipientName, // Matches AngularJS other.displayName || other.getDisplayName()
      sequence_number: '', // Empty string - server will fill it in echo (matches AngularJS line 546)
      is_edited: '0', // Matches AngularJS line 547
    };

    // Build message packet (matches AngularJS line 573-579)
    // CRITICAL: Structure is: <message><body/><convo-message/><convo-file/></message>
    // convo-file is a SIBLING of convo-message, not a child (see test scripts 05-p2p_msg_with_file.cor)
    // CRITICAL: XMPP body tag cannot be empty - send space if messageText is empty (matches AngularJS behavior)
    // Note: Some XMPP servers reject empty body tags, so we always ensure there's at least a space
    const trimmedText = messageText ? messageText.trim() : '';
    const bodyText = trimmedText || ' '; // Use space if empty to avoid empty body tag rejection
    const messagePacket = $msg({
      id: messageId,
      to: convoChatJid, // CRITICAL: Send to convochat@domain, not recipient
      from: fromJid,
      type: 'chat', // CType.toString(CType.P2P) = "chat"
    })
      .c('body').t(bodyText).up()
      .c('convo-message', convoMessageAttrs).up(); // Close convo-message first (matches AngularJS line 579)

    // Add file attachment if provided (matches AngularJS serializeFileInfo line 1871-1891)
    // CRITICAL: Tag name must be "convo-file" (not "convo:file") - matches TAGS.CONVO_FILE = "convo-file"
    // CRITICAL: convo-file is added AFTER convo-message is closed, making it a sibling (matches AngularJS line 580-581)
    if (fileInfo && fileInfo.fileId) {
      messagePacket.c('convo-file', {
        xmlns: 'http://convo.com/xmpp/chat/file',
        name: fileInfo.name || fileInfo.fileName || '',
        size: String(fileInfo.size || fileInfo.fileSize || 0),
        width: String(fileInfo.width || 0),
        height: String(fileInfo.height || 0),
        type: fileInfo.type || fileInfo.fileType || '',
        thumbnail_name: fileInfo.thumbnailName || fileInfo.thumbnail_name || '',
        original_name: fileInfo.originalName || fileInfo.original_name || '',
        format: fileInfo.format || fileInfo.fileFormat || '',
        id: fileInfo.fileId,
        available_previews_x: String(fileInfo.available_previews || 0),
        preview_name: fileInfo.preview_name || '',
        number_of_pages: String(fileInfo.no_of_pages || 0),
        is_voice: fileInfo.isVoice ? 'true' : 'false',
        duration: String(fileInfo.duration || 0),
        is_played: fileInfo.isPlayed ? 'true' : 'false',
        storage_version: String(fileInfo.storage_version || 1),
      }).up(); // Close convo-file element (matches AngularJS line 1890)
    }

    // Send via connection manager (matches AngularJS this.xmppCallsManager.sendMessage)
    // AngularJS uses: this._connectionManager.sendPacket(packet) for messages
    // Strophe.js connection.send() is equivalent
    try {
      const packetTree = messagePacket.tree();
      this.connection.send(packetTree);
      
      // Log the actual XML being sent for debugging
      if (process.env.NODE_ENV === 'development') {
        const xmlString = Strophe.serialize(packetTree);
        console.log('[XMPP] 📤 Sending message XML:', xmlString.substring(0, 500));
      }
      
      console.log('[XMPP] ✅ Message packet sent:', {
        messageId,
        to: convoChatJid,
        from: fromJid,
        chatId,
        convoMessage: convoMessageAttrs,
      });
      
      // CRITICAL: Log messageId for tracking server echo
      console.log('[XMPP] 🔍 Tracking sent message - waiting for server echo with same messageId:', messageId);
      
      // CRITICAL: Fallback timeout - if server doesn't echo back within 3 seconds, 
      // mark message as sent anyway (prevents messages staying light blue forever)
      // This handles cases where server echo is delayed or not sent
      const fallbackTimeout = setTimeout(() => {
        console.log('[XMPP] ⏰ Fallback timeout: Server echo not received for messageId:', messageId, '- marking as sent');
        // Dispatch a synthetic server ACK to mark message as sent
        // This will be handled by the message handler in MessagesContext
        const getCurrentUserId = () => {
          if (typeof window !== 'undefined') {
            const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
            return sessionData?.user?.user_id || '';
          }
          return '';
        };
        const currentUserId = getCurrentUserId();
        
        // Create a synthetic server ACK message
        // CRITICAL: Preserve fileInfo from the original message (if it exists)
        // This ensures that if updateMessage set fileId, it's preserved when synthetic ACK replaces the message
        // NOTE: The synthetic ACK might not have fileInfo with fileId yet (updateMessage might not have completed),
        // but the MessagesContext will preserve fileInfo from the existing message when processing the synthetic ACK
        const syntheticAck: ChatMessage = {
          messageId: messageId,
          chatId: chatId,
          senderId: currentUserId,
          messageText: messageText,
          timestamp: timestamp,
          sequenceNumber: 1, // Use 1 as fallback sequence number
          isDeleted: false,
          isEdited: false,
          isFakeMessage: false,
          isRetrying: false, // CRITICAL: Mark as not retrying
          // CRITICAL: Include fileInfo if it was passed to sendMessage
          // Even if it doesn't have fileId yet, MessagesContext will preserve fileInfo from existing message
          fileInfo: fileInfo || undefined,
          _view: {
            messageText: messageText.replace(/\n/gi, '<br>'),
            time: new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            otherUserWithImg: 0,
            otherUserWithoutImg: 0,
            thisUserWithImg: 0,
            thisUserWithoutImg: 0,
            showDate: false,
            dateToShow: '',
          },
        };
        
        console.log('[XMPP] 🔍 Synthetic ACK created:', {
          messageId: syntheticAck.messageId,
          hasFileInfo: !!syntheticAck.fileInfo,
          fileId: syntheticAck.fileInfo?.fileId,
          originalFileInfo: fileInfo,
          note: 'MessagesContext will preserve fileInfo from existing message if synthetic ACK lacks it',
        });
        
        // Dispatch to handlers (this will update the optimistic message)
        if (this.messageHandlers && this.messageHandlers.length > 0) {
          console.log('[XMPP] 📤 Dispatching synthetic server ACK to', this.messageHandlers.length, 'handler(s)');
          this.messageHandlers.forEach((handler) => {
            try {
              handler(syntheticAck);
            } catch (error) {
              console.error('[XMPP] ❌ Error in handler for synthetic ACK:', error);
            }
          });
        }
      }, 3000); // 3 second timeout
      
      // Store timeout so we can clear it if server echo arrives
      if (!this.pendingMessageTimeouts) {
        this.pendingMessageTimeouts = new Map();
      }
      this.pendingMessageTimeouts.set(messageId, fallbackTimeout);
      
      onSuccess?.();
    } catch (error) {
      console.error('[XMPP] ❌ Failed to send message:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to send message');
      return null;
    }

    // Get current user ID for optimistic message
    const getCurrentUserId = () => {
      if (typeof window !== 'undefined') {
        const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
        return sessionData?.user?.user_id || '';
      }
      return '';
    };
    const currentUserId = getCurrentUserId();

    // Process message text (replace \n with <br> for HTML rendering)
    const processedMessageText = messageText.replace(/\n/gi, '<br>');

    // Format timestamp
    const formatTime = (ts: number): string => {
      const date = new Date(ts);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
      return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    // Return optimistic message for UI - Matches AngularJS sendMessageInP2PChat() lines 512-536 EXACTLY
    // Key: sequenceNumber = 0 (will be updated when server ACK arrives), isRetrying = true
    return {
      messageId,
      senderId: currentUserId, // Use actual current user ID
      chatId,
      messageText,
      timestamp,
      sequenceNumber: 0, // Server will assign - matches AngularJS line 533 (sequence_number: 0)
      isDeleted: false,
      isEdited: false,
      isFakeMessage: false, // Not a fake message, it's a real optimistic message
      isRetrying: true, // Matches AngularJS line 514 and 536
      fileInfo: fileInfo, // Include file info if provided (matches AngularJS message.fileInfo)
      _view: {
        messageText: processedMessageText,
        time: formatTime(timestamp),
        thisUserWithoutImg: 1, // This is always the current user's message
        thisUserWithImg: 0,
        otherUserWithImg: 0,
        otherUserWithoutImg: 0,
      },
    } as ChatMessage;
  }

  /**
   * Send a GROUP chat message (matches AngularJS messagesLoader.sendMessageInGroupChat)
   *
   * Key differences vs P2P:
   * - stanza type = "groupchat"
   * - no for_user_id / for_name on convo-message
   * - if this is the first message (lastMessageSequenceNumber === 0), include <participants xmlns="..."> block
   */
  sendGroupMessage(
    messageText: string,
    chat: Chat,
    onSuccess?: () => void,
    onError?: (error: string) => void,
    fileInfo?: ChatMessage['fileInfo'],
    existingMessageId?: string,
    unifiedNetworkAccountId?: string
  ) {
    if (!this.connection || !this.isConnected) {
      console.error('[XMPP] Cannot send group message - not connected');
      onError?.('XMPP not connected');
      return null;
    }

    if (!this.domain) {
      console.error('[XMPP] Cannot send group message - domain not set');
      onError?.('XMPP domain not configured');
      return null;
    }

    const messageId = existingMessageId || this.generateUuid();
    const timestamp = Date.now();

    const sessionData = (typeof window !== 'undefined' && (window as any).com_convo?.sessionData?.signInResponseData) || null;
    const thisUser = sessionData?.user || {};
    const thisUserId: string = thisUser?.user_id || '';
    const thisUserDisplayName: string =
      `${thisUser?.first_name || ''} ${thisUser?.last_name || ''}`.trim() || thisUser?.email || '';

    const convoChatJid = `convochat@${this.domain}`;

    // Determine from JID (same approach as P2P)
    let fromJid = '';
    if (this.connection && this.connection.jid) {
      fromJid = this.connection.jid;
    } else if (sessionData?.account_id && thisUserId && this.domain) {
      fromJid = `${sessionData.account_id};${thisUserId}@${this.domain}`;
    }

    if (!fromJid) {
      console.error('[XMPP] Cannot send group message - fromJid is empty');
      onError?.('Cannot determine sender JID');
      return null;
    }

    const convoMessageAttrs: Record<string, string> = {
      xmlns: 'http://convo.com/xmpp/chat/message',
      chat_id: chat.chatId,
      message_type: 'message',
      timestamp: String(timestamp),
      from_name: thisUserDisplayName || '',
      sequence_number: '',
      is_edited: '0',
    };

    if (chat.isUnifiedChat) {
      convoMessageAttrs['is_unified_chat'] = '1';
      convoMessageAttrs['unified_account_id'] =
        unifiedNetworkAccountId || sessionData?.unified_network_settings?.account_id || sessionData?.account_id || '';
    }

    const trimmedText = messageText ? messageText.trim() : '';
    const bodyText = trimmedText || ' ';

    const messagePacket = $msg({
      id: messageId,
      to: convoChatJid,
      from: fromJid,
      type: 'groupchat',
    })
      .c('body')
      .t(bodyText)
      .up()
      .c('convo-message', convoMessageAttrs)
      .up();

    // If this is the first message in the group chat, send participants info (AngularJS bugfix)
    if ((chat.lastMessageSequenceNumber || 0) === 0) {
      messagePacket.c('participants', { xmlns: 'http://convo.com/xmpp/chat/message/participants' });
      for (const participantId in chat.participants || {}) {
        if (!Object.prototype.hasOwnProperty.call(chat.participants, participantId)) continue;
        const p = chat.participants[participantId];
        const id = p.userId || participantId;
        const name = p.name || p.displayName || '';
        const participantAttrs: Record<string, string> = { id, name };
        if (chat.isUnifiedChat) {
          const accId = p.accountId || sessionData?.account_id || '';
          if (accId) participantAttrs['user_account_id'] = String(accId);
        }
        messagePacket.c('participant', participantAttrs).up();
      }
      messagePacket.up(); // </participants>
    }

    if (fileInfo && fileInfo.fileId) {
      messagePacket
        .c('convo-file', {
          xmlns: 'http://convo.com/xmpp/chat/file',
          name: fileInfo.name || (fileInfo as any).fileName || '',
          size: String(fileInfo.size || (fileInfo as any).fileSize || 0),
          width: String((fileInfo as any).width || 0),
          height: String((fileInfo as any).height || 0),
          type: fileInfo.type || (fileInfo as any).fileType || '',
          thumbnail_name: (fileInfo as any).thumbnailName || (fileInfo as any).thumbnail_name || '',
          original_name: (fileInfo as any).originalName || (fileInfo as any).original_name || '',
          format: (fileInfo as any).format || (fileInfo as any).fileFormat || '',
          id: fileInfo.fileId,
          available_previews_x: String((fileInfo as any).available_previews || 0),
          preview_name: (fileInfo as any).preview_name || '',
          number_of_pages: String((fileInfo as any).no_of_pages || 0),
          is_voice: (fileInfo as any).isVoice ? 'true' : 'false',
          duration: String((fileInfo as any).duration || 0),
          is_played: (fileInfo as any).isPlayed ? 'true' : 'false',
          storage_version: String((fileInfo as any).storage_version || 1),
        })
        .up();
    }

    try {
      const packetTree = messagePacket.tree();
      this.connection.send(packetTree);
      onSuccess?.();
    } catch (error) {
      console.error('[XMPP] ❌ Failed to send group message:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to send group message');
      return null;
    }

    // Return optimistic message (same shape as P2P optimistic messages)
    const processedMessageText = messageText.replace(/\n/gi, '<br>');
    const formatTime = (ts: number): string => {
      const date = new Date(ts);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
      return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    return {
      messageId,
      senderId: thisUserId,
      chatId: chat.chatId,
      messageText,
      timestamp,
      sequenceNumber: 0,
      isDeleted: false,
      isEdited: false,
      isFakeMessage: false,
      isRetrying: true,
      fileInfo: fileInfo || undefined,
      _view: {
        messageText: processedMessageText,
        time: formatTime(timestamp),
        thisUserWithoutImg: 1,
        thisUserWithImg: 0,
        otherUserWithImg: 0,
        otherUserWithoutImg: 0,
      },
    } as ChatMessage;
  }

  /**
   * Attach message handlers after connection (matches AngularJS callsManager.attachHandlers)
   * 
   * This registers a single handler that dispatches to all registered callbacks
   * Matches AngularJS callsManager.attachHandlers() line 196-204 EXACTLY
   */
  private attachHandlers() {
    // CRITICAL: Match AngularJS connectionManager.addHandler - only add handlers when connection is fully ready
    // AngularJS checks: if(connectionRefreshed) { connection.addHandler(...) }
    // connectionRefreshed is set to true when connection is fully established (line 202)
    if (!this.connection) {
      console.warn('[XMPP] Cannot attach handlers - connection does not exist');
      return;
    }
    
    // CRITICAL: Check if connection is actually connected and authenticated
    // In Strophe.js, connection.connected is true when fully authenticated
    // Also check connection.authenticated (matches AngularJS connectionRefreshed check)
    const isConnectionReady = this.connection.connected || !!(this.connection as any).authenticated;
    
    console.log('[XMPP] 🔍 Connection readiness check:', {
      connectionExists: !!this.connection,
      connectionConnected: this.connection.connected,
      connectionAuthenticated: (this.connection as any).authenticated,
      isConnectionReady,
      isConnected: this.isConnected,
      jid: this.connection.jid,
    });
    
    if (!isConnectionReady) {
      console.error('[XMPP] ❌ Cannot attach handlers - connection not fully ready!');
      console.error('[XMPP] Connection state:', {
        connected: this.connection.connected,
        authenticated: (this.connection as any).authenticated,
        isConnected: this.isConnected,
      });
      // CRITICAL: Try again after a short delay
      setTimeout(() => {
        console.log('[XMPP] 🔄 Retrying handler attachment...');
        this.attachHandlers();
      }, 500);
      return;
    }

    if (!this.isConnected) {
      console.warn('[XMPP] Cannot attach handlers - isConnected flag is false');
      return;
    }

    // Prevent duplicate handler registration
    if (this.messageHandlerAttached) {
      console.log('[XMPP] Message handler already attached, skipping (but callbacks are registered:', this.messageHandlers?.length || 0, ')');
      return;
    }

    console.log('[XMPP] 🔧 Attaching message handlers. Registered callbacks:', this.messageHandlers?.length || 0);
    console.log('[XMPP] Connection state check:', {
      connectionExists: !!this.connection,
      connectionConnected: this.connection.connected,
      isConnected: this.isConnected,
      jid: this.connection.jid,
    });

    // CRITICAL: Use null namespace to match ALL messages, then filter internally
    // This is more reliable than namespace matching, which can fail if namespace isn't set correctly
    // We'll filter for convo-message elements inside the handler (matches AngularJS logic)
    console.log('[XMPP] 📋 Registering handler with null namespace (matches all messages), filtering for convo-message internally');
    
    // CRITICAL: Store handler reference to prevent garbage collection
    // In AngularJS, handlers are stored in the connection's handlers array and persist
    const handlerRef = this.connection.addHandler(
      (stanza) => {
        // CRITICAL: Log handler invocation FIRST - this proves BOSH polling is working
        console.log('[XMPP] 🔔🔔🔔🔔🔔 MESSAGE HANDLER INVOKED - BOSH session is active and polling!');
        console.log('[XMPP] 🔔🔔🔔 Handler called at:', new Date().toISOString());
        
        try {
          // Log ALL incoming message stanzas for debugging
          const stanzaId = stanza.getAttribute('id');
          const from = stanza.getAttribute('from');
          const to = stanza.getAttribute('to');
          const type = stanza.getAttribute('type');
          const innerHTML = stanza.innerHTML?.substring(0, 500);
          
          console.log('[XMPP] 📨📨📨 Message stanza received:', {
            id: stanzaId,
            from,
            to,
            type,
            innerHTML,
            hasConvoMessage: innerHTML?.includes('convo-message'),
            fullStanza: Strophe.serialize(stanza).substring(0, 1000),
          });
          
          // CRITICAL: Match AngularJS exactly - use children() equivalent
          // AngularJS: var convoMessage = messagePacket.children(TAGS.CONVO_MESSAGE);
          // TAGS.CONVO_MESSAGE = "convo-message"
          // In DOM, this means finding direct child elements with tagName "convo-message"
          let convoMessageEl: Element | null = null;
          
          // Method 1: Try direct children first (matches AngularJS children() exactly)
          const children = stanza.children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            // Check both tagName and localName to handle namespace issues
            if (child.tagName === 'convo-message' || child.localName === 'convo-message') {
              convoMessageEl = child;
              break;
            }
          }
          
          // Method 2: Try querySelector as fallback (finds first match, not just direct children)
          if (!convoMessageEl) {
            convoMessageEl = stanza.querySelector('convo-message');
          }
          
          // Method 3: Try getElementsByTagName as last resort
          if (!convoMessageEl) {
            const elements = stanza.getElementsByTagName('convo-message');
            if (elements.length > 0) {
              convoMessageEl = elements[0];
            }
          }
          
          if (!convoMessageEl) {
            // Not a convo message, ignore (matches AngularJS line 1123-1126)
            console.log('[XMPP] ⏭️ Skipping non-convo message (no convo-message element found)');
            console.log('[XMPP] Stanza children:', Array.from(stanza.children).map(c => `${c.tagName}(${c.localName})`));
            console.log('[XMPP] ✅ Handler returning true - BOSH polling will continue');
            return true; // Keep handler active but don't process
          }
          
          console.log('[XMPP] ✅ Found convo-message element:', {
            tagName: convoMessageEl.tagName,
            localName: convoMessageEl.localName,
            namespaceURI: convoMessageEl.namespaceURI,
            attributes: Array.from(convoMessageEl.attributes).map(a => `${a.name}="${a.value}"`),
          });
          
          // CRITICAL: Check message_type FIRST (matches AngularJS line 1128, 1157-1162)
          // AngularJS filters by message_type before parsing:
          // - RECIPIENT_ACK -> xmppMessageAckReceived
          // - VOICE_ACK -> xmppVoiceMessageAckReceived
          // - REQUEST_ACK -> updateUserStatusFromAckForUnifiedChat
          // - GROUP type -> groupMessageReceived
          // - MESSAGE type -> xmppMessageReceived (only regular messages)
          // - TYPING/RECORDING/COMPOSING -> composingXMPPMessageReceived
          const messageType = convoMessageEl.getAttribute('message_type') || '';
          
          // Skip non-message types (composing, typing, recording, etc.) - these don't have body
          if (messageType === 'composing' || messageType === 'typing' || messageType === 'recording') {
            console.log('[XMPP] ⏭️ Skipping composing/typing message (not a regular message):', messageType);
            return true; // Keep handler active but don't process
          }
          
          // Skip ACK messages (they're handled separately in AngularJS)
          if (messageType === 'recipient_ack' || messageType === 'message_ack' || messageType === 'voice_ack' || messageType === 'request_ack') {
            console.log('[XMPP] ⏭️ Skipping ACK message (handled separately):', messageType);
            return true; // Keep handler active but don't process
          }
          
          // Check for volatile system messages (500-599) - matches AngularJS line 1155, 1159
          const isSystemMessageAttr = convoMessageEl.getAttribute('is_system_message');
          const systemMessageNum = isSystemMessageAttr ? parseInt(isSystemMessageAttr, 10) : 0;
          if (systemMessageNum >= 500 && systemMessageNum <= 599) {
            console.log('[XMPP] ⏭️ Skipping volatile system message (500-599):', systemMessageNum);
            return true; // Keep handler active but don't process volatile messages
          }
          
          // Process both P2P ("chat") and GROUP ("groupchat") messages.
          // AngularJS routes groupchat to groupMessageReceived, but we can parse and dispatch it the same way.
          const messagePacketType = stanza.getAttribute('type') || '';
          if (messagePacketType !== 'chat' && messagePacketType !== 'groupchat') {
            // Unknown/non-chat message packet type
            console.log('[XMPP] ⏭️ Skipping non-chat packet type:', messagePacketType);
            return true;
          }
          
          // Only process regular messages (message_type="message" or empty, type="chat")
          if (messageType && messageType !== 'message') {
            console.log('[XMPP] ⏭️ Skipping non-message type:', messageType);
            return true; // Keep handler active but don't process
          }
          
          console.log('[XMPP] ✅✅✅ PROCESSING REGULAR MESSAGE (message_type="message" or empty)');
          
          // Parse message matching AngularJS callsManagerReceivedMessage() line 1119-1122
          const message = this.parseMessageStanza(stanza);
          
          if (!message) {
            console.error('[XMPP] ❌❌❌ FAILED TO PARSE MESSAGE STANZA');
            console.error('[XMPP] Full stanza:', Strophe.serialize(stanza));
            return true; // Keep handler active
          }
          
          console.log('[XMPP] ✅✅✅ MESSAGE PARSED SUCCESSFULLY:', {
            messageId: message.messageId,
            chatId: message.chatId,
            senderId: message.senderId,
            messageText: message.messageText.substring(0, 50),
            sequenceNumber: message.sequenceNumber,
          });
          
          // Get current user ID to check if this is a server echo
          const getCurrentUserId = () => {
            if (typeof window !== 'undefined') {
              const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
              return sessionData?.user?.user_id || '';
            }
            return '';
          };
          const currentUserId = getCurrentUserId();
          const isOwnMessage = message.senderId === currentUserId;
          
          // CRITICAL: Log incoming messages separately for debugging
          if (!isOwnMessage) {
            console.log('[XMPP] 📥📥📥 INCOMING MESSAGE FROM ANOTHER USER:', {
              messageId: message.messageId,
              chatId: message.chatId,
              senderId: message.senderId,
              currentUserId,
              messageText: message.messageText.substring(0, 100),
              sequenceNumber: message.sequenceNumber,
              timestamp: message.timestamp,
            });
          }
          
          // CRITICAL: Log server ACK detection
          if (isOwnMessage && message.sequenceNumber > 0) {
            console.log('[XMPP] 🎯 SERVER ACK DETECTED - This should replace optimistic message:', {
              messageId: message.messageId,
              chatId: message.chatId,
              sequenceNumber: message.sequenceNumber,
            });
            
            // Clear fallback timeout if server ACK arrives
            if (this.pendingMessageTimeouts && this.pendingMessageTimeouts.has(message.messageId)) {
              const timeout = this.pendingMessageTimeouts.get(message.messageId);
              if (timeout) {
                clearTimeout(timeout);
                this.pendingMessageTimeouts.delete(message.messageId);
                console.log('[XMPP] ✅ Cleared fallback timeout for messageId:', message.messageId);
              }
            }
          }
          
          // Dispatch to all registered handlers (matches AngularJS event dispatching)
          // Ensure messageHandlers is initialized
          if (!this.messageHandlers) {
            this.messageHandlers = [];
          }
          
          if (this.messageHandlers.length === 0) {
            console.error('[XMPP] ❌❌❌ NO MESSAGE HANDLERS REGISTERED! Message will be lost:', message.messageId);
          } else {
            console.log('[XMPP] 📤📤📤 Dispatching to', this.messageHandlers.length, 'registered handler(s)');
            this.messageHandlers.forEach((handler, index) => {
              try {
                console.log(`[XMPP]   → Calling handler ${index + 1}/${this.messageHandlers.length}`);
                handler(message);
                console.log(`[XMPP]   ✅ Handler ${index + 1} completed successfully`);
              } catch (error) {
                console.error(`[XMPP] ❌ Error in message handler ${index + 1}:`, error);
                console.error('[XMPP] Error stack:', error instanceof Error ? error.stack : 'No stack');
              }
            });
          }
        } catch (error) {
          console.error('[XMPP] ❌ Error parsing incoming message:', error);
          console.error('[XMPP] Stanza was:', stanza);
          console.error('[XMPP] Error stack:', error instanceof Error ? error.stack : 'No stack');
        }
        
        // CRITICAL: Always return true to keep handler active and maintain BOSH polling
        // This is essential for HTTP-bind to continue making requests after receiving messages
        // Matches AngularJS callsManager.attachHandlers line 203: return true;
        console.log('[XMPP] ✅ Handler returning true - BOSH polling will continue');
        return true;
    },
    null, // Namespace - null matches ALL messages, then we filter for convo-message child internally
    'message',   // Element name - matches AngularJS "message"
    null         // Type - null matches AngularJS (no type filter, accepts both "chat" and "group")
    );

    if (handlerRef) {
      // CRITICAL: Store handler reference to prevent it from being garbage collected
      // In AngularJS, handlers persist for the lifetime of the connection
      this.messageHandlerRef = handlerRef;
      this.messageHandlerAttached = true;
      console.log('[XMPP] ✅✅✅ Message handler attached successfully!');
      console.log('[XMPP] Handler reference stored:', handlerRef);
      console.log('[XMPP] Connection state:', {
        isConnected: this.isConnected,
        connectionConnected: this.connection.connected,
        connectionAuthenticated: (this.connection as any).authenticated,
        connectionExists: !!this.connection,
        jid: this.connection?.jid,
        handlerAttached: this.messageHandlerAttached,
      });
      
      // CRITICAL: Verify handler is actually registered in Strophe's handlers array
      // This matches AngularJS behavior where handlers persist
      if ((this.connection as any).handlers) {
        const handlers = (this.connection as any).handlers;
        const handlerCount = handlers.length;
        console.log('[XMPP] ✅ Verified: Handler registered in Strophe handlers array. Total handlers:', handlerCount);
        
        // Log all handlers to verify ours is there
        console.log('[XMPP] 📋 All registered handlers:', handlers.map((h: any, i: number) => ({
          index: i,
          name: h.name,
          ns: h.ns,
          type: h.type,
          isMatch: typeof h.isMatch === 'function',
        })));
        
        // Verify our handler is in the list
        const ourHandler = handlers.find((h: any) => h === handlerRef);
        if (ourHandler) {
          console.log('[XMPP] ✅✅✅ Our handler is confirmed in Strophe handlers array!');
        } else {
          console.error('[XMPP] ❌❌❌ Our handler is NOT in Strophe handlers array!');
        }
      } else {
        console.warn('[XMPP] ⚠️ Strophe handlers array not found - cannot verify handler registration');
      }
      
      // CRITICAL: Test if BOSH polling is active by checking connection internals
      if ((this.connection as any)._proto && (this.connection as any)._proto._reqs) {
        const activeRequests = (this.connection as any)._proto._reqs.length;
        console.log('[XMPP] 🔍 BOSH active requests:', activeRequests);
        if (activeRequests > 0) {
          console.log('[XMPP] ✅ BOSH polling appears to be active');
        } else {
          console.warn('[XMPP] ⚠️ No active BOSH requests - polling may not be active');
        }
      }
    } else {
      console.error('[XMPP] ❌❌❌ FAILED TO ATTACH MESSAGE HANDLER!');
      console.error('[XMPP] This will prevent BOSH polling from working correctly!');
      console.error('[XMPP] Connection state:', {
        isConnected: this.isConnected,
        connectionConnected: this.connection?.connected,
        connectionAuthenticated: (this.connection as any)?.authenticated,
        connectionExists: !!this.connection,
        jid: this.connection?.jid,
      });
    }
  }

  /**
   * Add message handler callback for real-time messages
   * 
   * @param callback - Function to call when message is received
   */
  addMessageHandler(callback: (message: ChatMessage) => void) {
    // Ensure messageHandlers is initialized
    if (!this.messageHandlers) {
      this.messageHandlers = [];
    }
    
    // Add to handlers list
    this.messageHandlers.push(callback);
    console.log('[XMPP] ✅ Message handler callback registered. Total handlers:', this.messageHandlers.length);
    
    // CRITICAL: If already connected, ensure handlers are attached
    // This handles the case where a handler is registered after connection
    if (this.isConnected && this.connection) {
      if (!this.messageHandlerAttached) {
        console.log('[XMPP] Connection exists but handlers not attached, attaching now...');
        this.attachHandlers();
      } else {
        console.log('[XMPP] Handlers already attached, callback will receive messages');
      }
    } else {
      console.log('[XMPP] Not connected yet, handler will be attached when connection is established');
    }
  }

  /**
   * Remove message handler callback
   * 
   * @param callback - Function to remove
   */
  removeMessageHandler(callback: (message: ChatMessage) => void) {
    // Ensure messageHandlers is initialized
    if (!this.messageHandlers) {
      this.messageHandlers = [];
      return;
    }
    
    const index = this.messageHandlers.indexOf(callback);
    if (index >= 0) {
      this.messageHandlers.splice(index, 1);
      console.log('[XMPP] ✅ Message handler callback removed. Total handlers:', this.messageHandlers.length);
    }
  }

  /**
   * Parse messages from XML response
   * Matches AngularJS messageListTempCalculator.js logic
   */
  private parseMessagesXML(xmlResponse: Element): ChatMessage[] {
    const messages: ChatMessage[] = [];
    
    const messagesEl = xmlResponse.querySelector('messages');
    if (!messagesEl) {
      return messages;
    }

    // Get current user ID for determining message ownership
    const getCurrentUserId = () => {
      if (typeof window !== 'undefined') {
        const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
        return sessionData?.user?.user_id || '';
      }
      return '';
    };
    const currentUserId = getCurrentUserId();

    const messageElements = messagesEl.querySelectorAll('message');
    messageElements.forEach((msgEl) => {
      // Get convo-message element (matches AngularJS line 2259: messageXML.children(TAGS.CONVO_MESSAGE))
      const convoMessageEl = msgEl.querySelector('convo-message');
      if (!convoMessageEl) {
        console.warn('[XMPP] No convo-message element found in message, skipping');
        return;
      }

      const messageId = msgEl.getAttribute('id') || '';
      const fromId = msgEl.getAttribute('from') || '';
      // Extract sender ID from 'from' attribute (matches AngularJS line 2268: Util.makeUserIdFromJid(fromId))
      // JID format: accountId;userId@domain/resource
      // AngularJS: jid.split("@")[0].split(";")[1] - splits by @ first, then by ;, takes [1]
      const fromParts = fromId.split('@')[0]; // Get part before @
      const userIdParts = fromParts.split(';'); // Split by ;
      const senderId = userIdParts.length > 1 ? userIdParts[1] : userIdParts[0]; // Take userId (second part) or first if no ;
      
      // Extract attributes from convo-message element (matches AngularJS lines 2262-2279)
      const chatId = convoMessageEl.getAttribute('chat_id') || '';
      const fromName = convoMessageEl.getAttribute('from_name') || '';
      const sequenceNumber = parseInt(convoMessageEl.getAttribute('sequence_number') || '0', 10);
      const timestamp = parseInt(convoMessageEl.getAttribute('timestamp') || '0', 10);
      const isDeleted = parseInt(convoMessageEl.getAttribute('is_deleted') || '0', 10) === 1;
      const isEdited = parseInt(convoMessageEl.getAttribute('is_edited') || '0', 10) === 1;
      const editedTimestamp = isEdited ? parseInt(convoMessageEl.getAttribute('edited_timestamp') || '0', 10) : 0;
      
      // Extract message text from <body> element (matches AngularJS line 2270: messageXML.children(TAGS.BODY).text())
      const bodyEl = msgEl.querySelector('body');
      const messageText = bodyEl ? (bodyEl.textContent || '') : '';
      
      // Parse system message attribute (matches AngularJS lines 2291-2297)
      const sysMsgValue = convoMessageEl.getAttribute('is_system_message');
      let isSystemMessage: boolean | undefined = undefined;
      if (sysMsgValue && sysMsgValue.length) {
        const sysMsgInt = parseInt(sysMsgValue);
        isSystemMessage = sysMsgInt !== 0;
      }

      // Determine if this is the current user's message - Matches AngularJS line 900
      const isOwnMessage = senderId === currentUserId;

      // Process message text (replace \n with <br> for HTML rendering) - Matches AngularJS line 244
      const processedMessageText = messageText.replace(/\n/gi, '<br>');

      // Format timestamp - Matches AngularJS datetimeService.getTimeFormatHmma()
      const formatTime = (ts: number): string => {
        const date = new Date(ts);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
        return `${displayHours}:${displayMinutes} ${ampm}`;
      };

      // Parse file info from convo-file element (matches AngularJS parseFileInfo line 1893-1916)
      let fileInfo: ChatMessage['fileInfo'] | undefined = undefined;
      const convoFileEl = msgEl.querySelector('convo-file');
      if (convoFileEl) {
        const fileIdAttr = convoFileEl.getAttribute('id');
        // CRITICAL: Only create fileInfo if fileId exists (matches AngularJS behavior)
        if (fileIdAttr) {
          // Matches AngularJS parseFileInfo exactly (lines 1893-1916)
          // CRITICAL: Map to ChatMessage['fileInfo'] structure (fileId, name, size, type, format, etc.)
          fileInfo = {
            fileId: fileIdAttr, // CRITICAL: Use fileId (not file_id)
            name: convoFileEl.getAttribute('name') || '', // CRITICAL: Use name (not fileName)
            size: parseInt(convoFileEl.getAttribute('size') || '0', 10), // CRITICAL: Use size (not fileSize)
            type: convoFileEl.getAttribute('type') || '', // CRITICAL: Use type (not fileType)
            format: convoFileEl.getAttribute('format') || '', // CRITICAL: Use format (not fileFormat)
            fileFormat: convoFileEl.getAttribute('format') || '', // Also include fileFormat for compatibility
            thumbnailName: convoFileEl.getAttribute('thumbnail_name') || '',
            thumbnail_name: convoFileEl.getAttribute('thumbnail_name') || '',
            originalName: convoFileEl.getAttribute('original_name') || '',
            original_name: convoFileEl.getAttribute('original_name') || '',
            width: parseInt(convoFileEl.getAttribute('width') || '0', 10),
            height: parseInt(convoFileEl.getAttribute('height') || '0', 10),
            available_previews: parseInt(convoFileEl.getAttribute('available_previews_x') || '0', 10),
            preview_name: convoFileEl.getAttribute('preview_name') || '',
            no_of_pages: parseInt(convoFileEl.getAttribute('number_of_pages') || '0', 10),
            storage_version: parseInt(convoFileEl.getAttribute('storage_version') || '1', 10),
            isUploading: false, // Server ACK means upload is complete
          };
          
          console.log('[XMPP] ✅ Parsed fileInfo from server ACK:', {
            fileId: fileInfo.fileId,
            name: fileInfo.name,
            type: fileInfo.type,
            format: fileInfo.format,
            originalName: fileInfo.originalName,
          });
        } else {
          console.warn('[XMPP] ⚠️ convo-file element found but no id attribute:', {
            hasConvoFile: !!convoFileEl,
            attributes: convoFileEl ? Array.from(convoFileEl.attributes).map(attr => ({ name: attr.name, value: attr.value })) : [],
          });
        }
      }

      // Validate timestamp - if 0 or invalid, use current time (matches AngularJS fallback behavior)
      const validTimestamp = timestamp > 0 ? timestamp : Date.now();

      const message: ChatMessage = {
        messageId,
        senderId,
        chatId,
        messageText,
        timestamp: validTimestamp,
        sequenceNumber,
        isDeleted,
        isEdited,
        edited_timestamp: editedTimestamp > 0 ? editedTimestamp : undefined,
        isSystemMessage,
        fileInfo, // Include file info if present (matches AngularJS parseFileInfo)
        _view: {
          messageText: processedMessageText,
          time: formatTime(validTimestamp),
          thisUserWithoutImg: isOwnMessage ? 1 : 0,
          thisUserWithImg: 0,
          otherUserWithImg: !isOwnMessage ? 1 : 0,
          otherUserWithoutImg: 0,
        },
      };

      messages.push(message);
    });

    return messages.reverse(); // Oldest first
  }

  /**
   * Parse incoming message stanza
   * 
   * Matches AngularJS callsManagerReceivedMessage() and xmppMessageReceived() EXACTLY
   * Source: messagesLoader.js lines 1117-1168, 1918-2067
   * 
   * XML Structure:
   * <message id="..." from="..." to="..." type="chat">
   *   <body>message text</body>
   *   <convo-message xmlns="convo-message" 
   *                  chat_id="..."
   *                  from_name="..."
   *                  message_type="message"
   *                  timestamp="..."
   *                  sequence_number="..."
   *                  for_user_id="..."
   *                  for_name="..."
   *                  is_deleted="..."
   *                  is_edited="..."
   *                  is_system_message="..."/>
   * </message>
   */
  private parseMessageStanza(stanza: Element): ChatMessage | null {
    // Get convo-message element first (matches AngularJS line 1122)
    // AngularJS uses: messagePacket.children(TAGS.CONVO_MESSAGE)
    const convoMessageEl = stanza.querySelector('convo-message');
    if (!convoMessageEl) {
      console.warn('[XMPP] No convo-message element found in message stanza');
      return null;
    }
    
    // Check message_type before requiring body (ACK messages don't have body)
    const messageType = convoMessageEl.getAttribute('message_type') || '';
    const isAckMessage = messageType === 'recipient_ack' || messageType === 'message_ack';
    
    // Get body text (matches AngularJS line 1937)
    // CRITICAL: ACK messages don't have body element - use empty string
    let messageText = '';
    if (!isAckMessage) {
      // Regular messages must have body
      // CRITICAL: Match AngularJS exactly - use children() equivalent
      // AngularJS: var messageText = xmppMessage.children(TAGS.BODY).text();
      // TAGS.BODY = "body"
      // In DOM, this means finding direct child elements with tagName "body"
      let body: Element | null = null;
      
      // Method 1: Try direct children first (matches AngularJS children() exactly)
      const children = stanza.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'body' || child.localName === 'body') {
          body = child;
          break;
        }
      }
      
      // Method 2: Try querySelector as fallback
      if (!body) {
        body = stanza.querySelector('body');
      }
      
      // Method 3: Try getElementsByTagName as last resort
      if (!body) {
        const elements = stanza.getElementsByTagName('body');
        if (elements.length > 0) {
          body = elements[0];
        }
      }
      
      console.log('[XMPP] 🔍 Looking for body element:', {
        messageType,
        isAckMessage,
        hasBody: !!body,
        bodyText: body ? body.textContent : 'NO BODY',
        bodyTagName: body?.tagName,
        bodyLocalName: body?.localName,
        stanzaChildren: Array.from(stanza.children).map(c => `${c.tagName}(${c.localName})`),
        stanzaHTML: stanza.innerHTML?.substring(0, 500),
        fullStanza: Strophe.serialize(stanza).substring(0, 1000),
      });
      
      if (!body) {
        console.warn('[XMPP] ⚠️ No body element in message stanza (and not an ACK message). Full stanza:', Strophe.serialize(stanza).substring(0, 500));
        return null;
      }
      messageText = body.textContent || '';
      console.log('[XMPP] ✅ Extracted message text:', {
        messageText: messageText.substring(0, 50),
        textLength: messageText.length,
      });
    } else {
      // ACK messages don't have body - use empty string
      console.log('[XMPP] ACK message detected (no body element):', messageType);
      messageText = '';
    }

    // Extract attributes from convo-message element (matches AngularJS lines 1920-1949)
    const chatId = convoMessageEl.getAttribute('chat_id') || '';
    const fromName = convoMessageEl.getAttribute('from_name') || '';
    const timestamp = parseInt(convoMessageEl.getAttribute('timestamp') || '0', 10);
    const sequenceNumberAttr = convoMessageEl.getAttribute('sequence_number') || '';
    const sequenceNumber = sequenceNumberAttr ? parseInt(sequenceNumberAttr, 10) : 0;
    
    console.log('[XMPP] 🔍 Parsing sequence_number:', {
      sequenceNumberAttr,
      sequenceNumber,
      messageType,
      isAckMessage,
      fullStanza: Strophe.serialize(stanza).substring(0, 500),
    });
    
    const forUserId = convoMessageEl.getAttribute('for_user_id') || '';
    const forName = convoMessageEl.getAttribute('for_name') || '';
    const isDeleted = convoMessageEl.getAttribute('is_deleted') === '1';
    const isEdited = convoMessageEl.getAttribute('is_edited') === '1';
    const editedTimestamp = isEdited ? parseInt(convoMessageEl.getAttribute('edited_timestamp') || '0', 10) : 0;
    const isSystemMessageAttr = convoMessageEl.getAttribute('is_system_message');
    const isSystemMessage = isSystemMessageAttr && isSystemMessageAttr !== '0' ? isSystemMessageAttr : undefined;

    // Extract sender ID from message 'from' attribute (matches AngularJS line 1930)
    const from = stanza.getAttribute('from') || '';
    // AngularJS uses: Util.makeUserIdFromJid(xmppMessage.attr("from"))
    // JID format: accountId;userId@domain/resource
    // AngularJS: jid.split("@")[0].split(";")[1] - splits by @ first, then by ;, takes [1]
    const fromParts = from.split('@')[0]; // Get part before @
    const userIdParts = fromParts.split(';'); // Split by ;
    const senderId = userIdParts.length > 1 ? userIdParts[1] : userIdParts[0]; // Take userId (second part) or first if no ;

    // Get current user ID for determining message ownership
    const getCurrentUserId = () => {
      if (typeof window !== 'undefined') {
        const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
        return sessionData?.user?.user_id || '';
      }
      return '';
    };
    const currentUserId = getCurrentUserId();
    const isOwnMessage = senderId === currentUserId;

    // Process message text (replace \n with <br> for HTML rendering) - Matches AngularJS line 244
    const processedMessageText = messageText.replace(/\n/gi, '<br>');

    // Format timestamp - Matches AngularJS datetimeService.getTimeFormatHmma()
    const formatTime = (ts: number): string => {
      const date = new Date(ts);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
      return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    const messageId = stanza.getAttribute('id') || '';

    // CRITICAL: isRetrying should only be true for optimistic messages (sent messages with sequenceNumber 0)
    // Received messages (isOwnMessage = false) should always have isRetrying = false
    // Server ACKs (isOwnMessage = true, sequenceNumber > 0) should have isRetrying = false
    const isRetryingValue = false; // All parsed messages are not retrying (matches AngularJS line 2044)
    
    // Parse file info from convo-file element (matches AngularJS parseFileInfo line 1893-1916)
    let fileInfo: ChatMessage['fileInfo'] | undefined = undefined;
    const convoFileEl = stanza.querySelector('convo-file');
    if (convoFileEl) {
      const fileIdAttr = convoFileEl.getAttribute('id');
      // CRITICAL: Only create fileInfo if fileId exists (matches AngularJS behavior)
      if (fileIdAttr) {
        // Matches AngularJS parseFileInfo exactly (lines 1893-1916)
        // CRITICAL: Map to ChatMessage['fileInfo'] structure (fileId, name, size, type, format, etc.)
        fileInfo = {
          fileId: fileIdAttr, // CRITICAL: Use fileId (not file_id)
          name: convoFileEl.getAttribute('name') || '', // CRITICAL: Use name (not fileName)
          size: parseInt(convoFileEl.getAttribute('size') || '0', 10), // CRITICAL: Use size (not fileSize)
          type: convoFileEl.getAttribute('type') || '', // CRITICAL: Use type (not fileType)
          format: convoFileEl.getAttribute('format') || '', // CRITICAL: Use format (not fileFormat)
          fileFormat: convoFileEl.getAttribute('format') || '', // Also include fileFormat for compatibility
          thumbnailName: convoFileEl.getAttribute('thumbnail_name') || '',
          thumbnail_name: convoFileEl.getAttribute('thumbnail_name') || '',
          originalName: convoFileEl.getAttribute('original_name') || '',
          original_name: convoFileEl.getAttribute('original_name') || '',
          width: parseInt(convoFileEl.getAttribute('width') || '0', 10),
          height: parseInt(convoFileEl.getAttribute('height') || '0', 10),
          available_previews: parseInt(convoFileEl.getAttribute('available_previews_x') || '0', 10),
          preview_name: convoFileEl.getAttribute('preview_name') || '',
          no_of_pages: parseInt(convoFileEl.getAttribute('number_of_pages') || '0', 10),
          storage_version: parseInt(convoFileEl.getAttribute('storage_version') || '1', 10),
          isUploading: false, // Server ACK means upload is complete
        };
        
        console.log('[XMPP] ✅ Parsed fileInfo from server ACK (onMessage):', {
          fileId: fileInfo.fileId,
          name: fileInfo.name,
          type: fileInfo.type,
          format: fileInfo.format,
          originalName: fileInfo.originalName,
        });
      } else {
        console.warn('[XMPP] ⚠️ convo-file element found but no id attribute (onMessage):', {
          hasConvoFile: !!convoFileEl,
          attributes: convoFileEl ? Array.from(convoFileEl.attributes).map(attr => ({ name: attr.name, value: attr.value })) : [],
        });
      }
    }

    console.log('[XMPP] 📥 Parsed incoming message:', {
      messageId,
      chatId,
      senderId,
      forUserId,
      messageText: messageText.substring(0, 50) + '...',
      timestamp,
      sequenceNumber,
      isOwnMessage,
      isServerACK: isOwnMessage && sequenceNumber > 0, // Server echo of our sent message
      isRetrying: isRetryingValue,
      messageType,
      hasFileInfo: !!fileInfo,
    });

    return {
      messageId,
      senderId,
      chatId,
      messageText,
      timestamp,
      sequenceNumber,
      isDeleted,
      isEdited,
      editedTimestamp: editedTimestamp || undefined,
      isSystemMessage,
      isRetrying: isRetryingValue, // Real-time messages are not retrying (matches AngularJS line 2044)
      fileInfo, // Include file info if present (matches AngularJS parseFileInfo)
      _view: {
        messageText: processedMessageText,
        time: formatTime(timestamp),
        thisUserWithoutImg: isOwnMessage ? 1 : 0,
        thisUserWithImg: 0,
        otherUserWithImg: !isOwnMessage ? 1 : 0,
        otherUserWithoutImg: 0,
      },
    };
  }

  /**
   * Fetch XMPP roster to get user presence data (matches Angular presenceManager.fetchRoster)
   * 
   * Source: web_app/src/app/chat/sdk/managers/presenceManager.js lines 99-108
   * 
   * Sends IQ stanza to: convop@domain
   * Namespace: convo:jabber:iq:roster
   */
  fetchRoster() {
    if (!this.connection || !this.isConnected) {
      console.warn('[XMPP] Cannot fetch roster - not connected');
      return;
    }

    if (!this.domain) {
      console.error('[XMPP] Cannot fetch roster - domain not set');
      return;
    }

    const convoPJid = `convop@${this.domain}`;
    const uuid = this.generateUuid();

    console.log('[XMPP] Fetching roster for presence data...');

    // Build IQ stanza matching Angular (presenceManager.js line 101-105)
    const iq = $iq({
      to: convoPJid,
      type: 'get',
      id: uuid,
    })
      .c('query', { xmlns: 'convo:jabber:iq:roster' });

    this.connection.sendIQ(
      iq.tree(),
      // Success handler
      (response) => {
        console.log('[XMPP] ✅ Roster received');
        console.log('[XMPP] Roster response type:', typeof response);
        console.log('[XMPP] Roster response:', response);
        
        try {
          // Strophe returns the response as an Element
          // Angular receives packet as Element and uses $(packet).find("item")
          let responseElement: Element;
          
          if (response instanceof Element) {
            responseElement = response;
          } else if (typeof response === 'string') {
            // Parse XML string if needed
            const parser = new DOMParser();
            const doc = parser.parseFromString(response, 'text/xml');
            responseElement = doc.documentElement;
          } else {
            // Try to access as Element
            responseElement = response as Element;
          }
          
          console.log('[XMPP] Parsing roster XML...');
          this.parseRosterXML(responseElement, true); // isRoster = true
          
          // CRITICAL: After roster is received, set current user's presence to online and send to server
          // Matches AngularJS userManager.onPresenceManagerIsConnected (line 596-601)
          // This ensures current user shows as "online" when connected
          this.setCurrentUserPresenceOnline();
          
          // Dispatch event for presence update (matches Angular ChatEvents.ROSTER_RECEIVED)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('xmppRosterReceived', { detail: this.userIdToPresenceMap }));
          }
        } catch (error) {
          console.error('[XMPP] Parse roster error:', error);
          console.error('[XMPP] Response was:', response);
        }
      },
      // Error handler
      (error) => {
        console.error('[XMPP] ❌ Failed to fetch roster:', error);
      }
    );
  }

  /**
   * Parse roster XML response (matches Angular presenceManager.onPresenceReceived)
   * 
   * Source: web_app/src/app/chat/sdk/managers/presenceManager.js lines 52-97
   * 
   * XML format:
   * <iq type="result">
   *   <query xmlns="convo:jabber:iq:roster">
   *     <item user_id="..." type="..." value="..." device="..." user_account_id="..."/>
   *   </query>
   * </iq>
   * 
   * Note: Angular uses $(packet).find("item") directly, so items might be at root or in query
   * 
   * @param xmlResponse - XML element containing presence/roster data
   * @param isRoster - If true, clears map first (initial roster). If false, updates map (presence change)
   */
  private parseRosterXML(xmlResponse: Element, isRoster: boolean = true): void {
    // Clear existing map ONLY if this is a roster (initial fetch)
    // For presence updates, we update the map without clearing (matches Angular line 54-58)
    if (isRoster) {
      this.userIdToPresenceMap = {};
    }

    // Try multiple ways to find items (matches Angular $(packet).find("item"))
    // Method 1: Find query element by namespace
    let itemElements: HTMLCollectionOf<Element> | NodeListOf<Element> | null = null;
    
    // Try using getElementsByTagNameNS (proper namespace handling)
    try {
      const queryEls = xmlResponse.getElementsByTagNameNS('convo:jabber:iq:roster', 'query');
      if (queryEls.length > 0) {
        itemElements = queryEls[0].getElementsByTagName('item');
      }
    } catch (e) {
      // Namespace might not be registered, try other methods
    }

    // Method 2: Find query element by checking xmlns attribute
    if (!itemElements || itemElements.length === 0) {
      const allQueries = xmlResponse.getElementsByTagName('query');
      for (let i = 0; i < allQueries.length; i++) {
        const query = allQueries[i];
        const xmlns = query.getAttribute('xmlns');
        if (xmlns === 'convo:jabber:iq:roster') {
          itemElements = query.getElementsByTagName('item');
          break;
        }
      }
    }

    // Method 3: Find items directly (Angular uses $(packet).find("item"))
    if (!itemElements || itemElements.length === 0) {
      itemElements = xmlResponse.getElementsByTagName('item');
    }

    if (!itemElements || itemElements.length === 0) {
      console.warn('[XMPP] No roster items found in response');
      console.log('[XMPP] Response XML:', xmlResponse.outerHTML || xmlResponse.textContent);
      return;
    }

    console.log(`[XMPP] Parsing ${itemElements.length} roster items`);

    const currentAccountId = typeof window !== 'undefined' 
      ? (window as any)?.com_convo?.sessionData?.signInResponseData?.account_id 
      : null;

    // Convert NodeList to Array for safe iteration (some environments don't support NodeList.forEach)
    const itemsArray = Array.from(itemElements);
    console.log(`[XMPP] Processing ${itemsArray.length} roster items`);
    
    itemsArray.forEach((itemEl, index) => {
      // Extract attributes (matches Angular: item.attr("user_id"))
      const userId = itemEl.getAttribute('user_id') || '';
      const type = itemEl.getAttribute('type') || '';
      const value = itemEl.getAttribute('value') || '';
      const device = itemEl.getAttribute('device') || '';
      const userAccountId = itemEl.getAttribute('user_account_id') || '';

      if (!userId) {
        console.warn(`[XMPP] Roster item ${index} missing user_id, skipping`);
        return;
      }
      
      console.log(`[XMPP] Parsing roster item ${index + 1}/${itemsArray.length}: userId=${userId}, type=${type}, value=${value}, device=${device}`);

      // Map presence status (matches Angular lines 67-83)
      let status: number;
      if (type === 'unavailable') {
        status = 4; // UNAVAILABLE
      } else if (!value) {
        status = 1; // AVAILABLE
      } else {
        switch (value) {
          case 'available':
            status = 1; // AVAILABLE
            break;
          case 'away':
            status = 3; // IDLE
            break;
          case 'dnd':
            status = 2; // BUSY
            break;
          default:
            status = 4; // UNAVAILABLE (fallback)
        }
      }

      // Map device (matches Angular line 87)
      const deviceNum = device === 'mobile' ? 2 : 1; // MOBILE = 2, DESKTOP = 1

      // Store presence info (matches Angular lines 85-95)
      // Only store for same account users (matches Angular line 90-94)
      if (!currentAccountId || !userAccountId || userAccountId === currentAccountId) {
        this.userIdToPresenceMap[userId] = {
          status,
          device: deviceNum,
        };
      }
    });

    console.log(`[XMPP] ✅ Parsed ${Object.keys(this.userIdToPresenceMap).length} presence entries`);
  }

  /**
   * Get presence info for a user (matches Angular presenceManager.getUserPresenceInfo)
   */
  getUserPresenceInfo(userId: string): number {
    const presence = this.userIdToPresenceMap[userId];
    return presence ? presence.status : -1;
  }

  /**
   * Get all presence data (for updating users)
   */
  getPresenceMap(): Record<string, PresenceInfo> {
    return { ...this.userIdToPresenceMap };
  }

  /**
   * Set current user's presence to online and send to server
   * Matches AngularJS userManager.onPresenceManagerIsConnected (line 596-601)
   * and presenceManager.changePresence (line 122-171)
   * 
   * This is called after roster is received to ensure current user shows as online
   */
  private setCurrentUserPresenceOnline(): void {
    if (!this.connection || !this.isConnected) {
      console.warn('[XMPP] Cannot set presence - not connected');
      return;
    }

    // Get current user ID from session
    const getCurrentUserId = () => {
      if (typeof window !== 'undefined') {
        const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
        return sessionData?.user?.user_id || '';
      }
      return '';
    };

    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
      console.warn('[XMPP] Cannot set presence - current user ID not found');
      return;
    }

    // Set current user's presence to AVAILABLE (online) in local map
    // Matches AngularJS: _thisUser.presenceStatus = status (line 600)
    this.userIdToPresenceMap[currentUserId] = {
      status: 1, // AVAILABLE (online)
      device: 1, // DESKTOP
    };

    console.log('[XMPP] ✅ Set current user presence to online:', currentUserId);

    // Send presence to server (matches AngularJS presenceManager.changePresence line 122-171)
    // AVAILABLE status = send empty presence (no show element)
    // Matches AngularJS line 134-136: pres = $pres({ 'id' : iqId })
    const iqId = this.generateUuid();
    
    // Use Strophe's $pres helper to build presence stanza
    // Matches AngularJS: $pres({ 'id' : iqId })
    const pres = $pres({
      id: iqId,
    });

    // Send presence using send() method (presence is not an IQ stanza)
    // AngularJS uses sendIQ wrapper, but internally Strophe sends presence with send()
    // Matches AngularJS: this._callsManager.sendIQ(pres, iqId, false)
    // But presence stanzas should use send(), not sendIQ()
    try {
      this.connection.send(pres);
      console.log('[XMPP] ✅ Presence sent successfully - current user is now online');
      
      // CRITICAL: Dispatch presence changed event so UI updates immediately
      // Matches AngularJS: dispatches PRESENCE_CHANGED event after setting presence
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('xmppPresenceChanged', { detail: this.userIdToPresenceMap }));
      }
    } catch (error) {
      console.error('[XMPP] ❌ Failed to send presence:', error);
    }
  }

  /**
   * Add handler for presence updates (matches Angular callsManager.addHandler for PRESENCE_RECEIVED)
   * 
   * Source: web_app/src/app/chat/sdk/managers/callsManager.js lines 184-193
   * Namespace: convo:presence:batched
   * 
   * This handler listens for real-time presence updates (not roster)
   * When a user changes their status (online/offline/busy/idle), this is called
   */
  addPresenceHandler(onPresenceUpdate: (presenceMap: Record<string, PresenceInfo>) => void) {
    if (!this.connection) {
      console.warn('[XMPP] Cannot add presence handler - no connection');
      return;
    }

    // Add handler for batched presence updates (matches Angular line 185-193)
    this.connection.addHandler(
      (stanza: Element) => {
        try {
          console.log('[XMPP] 🔄 Real-time presence update received');
          // Parse presence update (same format as roster, but isRoster=false to NOT clear map)
          // Matches Angular: presenceManager.onPresenceReceived(packet, false)
          this.parseRosterXML(stanza, false); // isRoster = false (incremental update)
          
          // Dispatch event for real-time presence change (matches Angular PRESENCE_CHANGED)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('xmppPresenceChanged', { detail: this.userIdToPresenceMap }));
          }
          
          // Call callback
          onPresenceUpdate(this.userIdToPresenceMap);
        } catch (error) {
          console.error('[XMPP] Error handling presence update:', error);
        }
        return true; // Keep handler active
      },
      'convo:presence:batched',
      'message',
      null,
      null
    );
    
    console.log('[XMPP] ✅ Real-time presence handler registered');
  }

  disconnect() {
    // Clear all timers
    this.clearConnectionTimeout();
    this.clearReconnectTimeout();
    
    // Update status to DISCONNECTING (matches AngularJS)
    this.updateStatus(Strophe.Status.DISCONNECTING);
    this.isConnecting = false;
    
    if (this.connection) {
      try {
        this.connection.disconnect();
      } catch (error) {
        console.error('[XMPP] Error disconnecting:', error);
        // Reset connection on error
        try {
          this.connection.reset();
        } catch (e) {
          // Ignore reset errors
        }
      }
      this.connection = null;
    }
    
    this.isConnected = false;
    this.messageHandlerAttached = false;
    this.updateStatus(Strophe.Status.DISCONNECTED);
    
    // Clear presence map on disconnect (matches Angular line 30)
    this.userIdToPresenceMap = {};
    
    // Clear callbacks and config
    this.connectCallbacks = null;
    this.connectConfig = null;
  }

  /**
   * Invite users to a group chat (matches AngularJS messagesLoader.inviteUsersInChat EXACTLY)
   * 
   * @param users - Array of users to invite
   * @param chatId - Chat ID
   * @param chatType - Chat type (1=P2P, 2=GROUP)
   * @param isUnifiedChat - Whether this is a unified chat
   * @param unifiedNetworkAccountId - Unified network account ID (if unified chat)
   * @param onSuccess - Success callback
   * @param onError - Error callback
   */
  inviteUsersInChat(
    users: Array<{ userId: string; displayName: string; accountId?: string }>,
    chatId: string,
    chatType: number,
    isUnifiedChat?: boolean,
    unifiedNetworkAccountId?: string,
    onSuccess?: () => void,
    onError?: (error: string) => void
  ) {
    if (!this.connection || !this.isConnected) {
      console.error('[XMPP] Cannot invite users - not connected');
      onError?.('XMPP not connected');
      return;
    }

    if (chatType !== 2) { // GROUP = 2
      console.error('[XMPP] Cannot invite users - not a group chat');
      onError?.('Not a group chat');
      return;
    }

    if (!users || users.length === 0) {
      console.error('[XMPP] Cannot invite users - no users provided');
      onError?.('No users provided');
      return;
    }

    if (!this.domain) {
      console.error('[XMPP] Cannot invite users - domain not set');
      onError?.('XMPP domain not configured');
      return;
    }

    // Get current user info
    const sessionData = (typeof window !== 'undefined' && (window as any).com_convo?.sessionData?.signInResponseData);
    if (!sessionData) {
      console.error('[XMPP] Cannot invite users - session data not available');
      onError?.('Session data not available');
      return;
    }

    const currentUserId = sessionData.user?.user_id || '';
    const currentUserDisplayName = `${sessionData.user?.first_name || ''} ${sessionData.user?.last_name || ''}`.trim() || sessionData.user?.email || '';
    const timestamp = Date.now();

    // Generate message ID
    const messageId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build message text (comma-separated user IDs)
    const msgText = users.map(u => u.userId).join(',');

    // Build invitees array
    const invitees = users.map(user => ({
      id: user.userId,
      name: user.displayName,
      ...(isUnifiedChat && user.accountId ? { user_account_id: user.accountId } : {}),
    }));

    // Build convo-message attributes
    const convoMessageAttrs: Record<string, string> = {
      xmlns: 'http://convo.com/xmpp/chat/message',
      chat_id: chatId,
      message_type: 'invite',
      timestamp: timestamp.toString(),
      from_name: currentUserDisplayName,
    };

    if (isUnifiedChat) {
      convoMessageAttrs.is_unified_chat = '1';
      if (unifiedNetworkAccountId) {
        convoMessageAttrs.unified_account_id = unifiedNetworkAccountId;
      }
    }

    // Build XMPP message packet (matches AngularJS lines 2471-2485)
    const convoChatJid = `convochat@${this.domain}`;
    const fromJid = this.getJid();
    
    if (!fromJid) {
      console.error('[XMPP] Cannot invite users - JID not available');
      onError?.('JID not available');
      return;
    }

    // Build message packet
    let messagePacket = $msg({
      id: messageId,
      to: convoChatJid,
      from: fromJid,
      type: 'groupchat', // GROUP chat type
    })
      .c('body')
      .t(msgText)
      .up()
      .c('convo-message', convoMessageAttrs);

    // Add invitees
    messagePacket = messagePacket.up().c('invitees');
    invitees.forEach((invitee) => {
      messagePacket = messagePacket.c('invitee', {
        id: invitee.id,
        name: invitee.name,
        ...(invitee.user_account_id ? { user_account_id: invitee.user_account_id } : {}),
      }).up();
    });

    console.log('[XMPP] 📤 Inviting users to group chat:', {
      chatId,
      messageId,
      inviteesCount: invitees.length,
      isUnifiedChat,
      unifiedNetworkAccountId,
    });

    // Send message via connection manager
    try {
      this.connection.send(messagePacket);
      console.log('[XMPP] ✅ Invite message sent successfully');
      onSuccess?.();
    } catch (error) {
      console.error('[XMPP] ❌ Error sending invite message:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to send invite');
    }
  }
}

export const xmppChatService = new XMPPChatService();

