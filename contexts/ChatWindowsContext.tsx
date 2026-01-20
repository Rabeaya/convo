'use client';

/**
 * ChatWindowsContext - Manages multiple open chat windows
 * 
 * Replicates AngularJS chatManager behavior:
 * - Multiple chat windows can be open simultaneously
 * - Windows are positioned at bottom-right, stacked horizontally
 * - Each window is independent with own state
 * - Windows can be minimized/maximized/closed
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { canOpenChat } from '@/utils/chatWindowPositioning';
import type { Chat } from '@/types/chat';

interface ChatWindowMeta {
  chatId: string;
  chat: Chat;
  isMinimized: boolean;
  height: number;
  isOpenedOnUserAction: boolean;
}

interface ChatWindowsContextValue {
  openWindows: ChatWindowMeta[];
  focusedChatId: string | null; // Matches AngularJS _selectedChat - tracks which chat is currently focused
  openChatWindow: (chat: Chat, options?: Partial<ChatWindowMeta>) => void;
  closeChatWindow: (chatId: string) => void;
  minimizeChatWindow: (chatId: string) => void;
  maximizeChatWindow: (chatId: string) => void;
  isChatWindowOpen: (chatId: string) => boolean;
  setFocusedChat: (chatId: string | null) => void; // Matches AngularJS chatGainedFocus/chatLostFocus
}

const ChatWindowsContext = createContext<ChatWindowsContextValue | null>(null);

export function ChatWindowsProvider({ children }: { children: ReactNode }) {
  const [openWindows, setOpenWindows] = useState<ChatWindowMeta[]>([]);
  const [focusedChatId, setFocusedChatId] = useState<string | null>(null); // Matches AngularJS _selectedChat

  const openChatWindow = useCallback((chat: Chat, options?: Partial<ChatWindowMeta>) => {
    setOpenWindows((prev) => {
      // Check if chat is already open
      const existingIndex = prev.findIndex((w) => w.chatId === chat.chatId);
      
      if (existingIndex !== -1) {
        // Chat already open - maximize it and bring to front (matches AngularJS maxChatWin behavior)
        // Initially opened windows remain unchanged - only this one is maximized
        const updated = [...prev];
        const existing = updated[existingIndex];
        // Maximize the reopened chat
        const maximized = { ...existing, isMinimized: false };
        // Move to end (bring to front)
        updated.splice(existingIndex, 1);
        updated.push(maximized);
        return updated;
      }

      // Check if we can open a new window (matches AngularJS canOpenChat check)
      // This prevents windows from overlapping
      const isOpeningAsMinimized = options?.isMinimized || false;
      const allWindows = prev.map(w => ({
        chatId: w.chatId,
        isMinimized: w.isMinimized,
      }));
      
      // TODO: Get chat list minimized state from context when available
      const chatListProperties = { isMinimized: false };
      
      // Check if there's enough space to open the new window
      const canOpen = canOpenChat(
        allWindows,
        chatListProperties,
        isOpeningAsMinimized,
        false // hasDockedWindows - TODO: implement docking
      );

      // CRITICAL: Dispatch event to add chat to chat list (matches AngularJS chatManager.startChatWithUser)
      // This ensures the chat appears in the chat list with correct displayName
      // Defer event dispatch to avoid React "Cannot update component while rendering" error
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          const event = new CustomEvent('chatWindowOpened', {
            detail: { chat },
          });
          window.dispatchEvent(event);
        }, 0);
      }

      // Open new chat window (maximized by default unless explicitly minimized)
      const newWindow: ChatWindowMeta = {
        chatId: chat.chatId,
        chat,
        isMinimized: options?.isMinimized || false,
        height: options?.height || 350,
        isOpenedOnUserAction: options?.isOpenedOnUserAction !== false,
      };

      // Matches AngularJS behavior (lines 667-694):
      // - If there's space: open new window, keep ALL others unchanged (including initially opened windows)
      // - If there's NO space AND opened on user action: dock the last opened window
      //   The last window is: prev[prev.length - 1] (most recently opened)
      //   AngularJS flow: dock last window, open new window, remove docked window from array
      //   Since we don't have docking yet, we minimize it instead
      if (!canOpen && options?.isOpenedOnUserAction !== false && prev.length > 0) {
        // No space available - dock/minimize ONLY the last opened window (matches AngularJS line 684-689)
        // AngularJS: lastOpenedChatWindow = scope.chatWindows[scope.chatWindows.length - 1]
        //            lastOpenedChatWindow.metaDetails.isDocked = true
        //            scope.dockedWind.push(lastOpenedChatWindow)
        //            openChatWindow(chatObj, metaDetails) // adds to end
        //            scope.chatWindows.splice(scope.chatWindows.length - 2, 1) // removes old last window
        
        const updated = [...prev];
        const lastWindowIndex = updated.length - 1;
        
        if (lastWindowIndex >= 0) {
          // Get the last opened window (most recently opened)
          const lastOpenedWindow = updated[lastWindowIndex];
          
          // In AngularJS, this window would be docked (moved to dockedWind)
          // Since we don't have docking yet, we minimize it instead
          // TODO: Implement docking functionality to match AngularJS exactly
          updated[lastWindowIndex] = { ...lastOpenedWindow, isMinimized: true };
        }
        
        // Add new window to end (matches AngularJS openChatWindow which does push)
        // The new window becomes the last opened window
        updated.push(newWindow);
        
        // In AngularJS, the old last window is removed from chatWindows after docking
        // Since we're minimizing instead of docking, we keep it in the array
        // When docking is implemented, we should remove it here
        
        return updated;
      } else {
        // There's space - open new window, keep ALL others unchanged (initially opened windows stay as they are)
        // Matches AngularJS: openChatWindow() does scope.chatWindows.push(chatWindow)
        return [...prev, newWindow];
      }
    });
  }, []);

  const closeChatWindow = useCallback((chatId: string) => {
    setOpenWindows((prev) => {
      // Find the window to close
      const windowToCloseIndex = prev.findIndex((w) => w.chatId === chatId);
      if (windowToCloseIndex === -1) {
        return prev;
      }

      // Remove the closed window
      const updated = prev.filter((w) => w.chatId !== chatId);
      
      // Matches AngularJS openPossibleDockedChatWindows behavior:
      // When a window is closed, previously minimized windows are shown again
      // Find the first minimized window and unminimize it
      const minimizedIndex = updated.findIndex(w => w.isMinimized);
      if (minimizedIndex !== -1) {
        // Unminimize the first minimized window (show it again)
        updated[minimizedIndex] = { ...updated[minimizedIndex], isMinimized: false };
      }
      
      return updated;
    });
  }, []);

  const minimizeChatWindow = useCallback((chatId: string) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.chatId === chatId ? { ...w, isMinimized: true } : w))
    );
  }, []);

  const maximizeChatWindow = useCallback((chatId: string) => {
    setOpenWindows((prev) => {
      // When maximizing a window, bring it to front
      // Initially opened windows remain unchanged - only this one is maximized
      const updated = [...prev];
      const maximizedIndex = updated.findIndex(w => w.chatId === chatId);
      if (maximizedIndex !== -1) {
        // Maximize this window only
        updated[maximizedIndex] = { ...updated[maximizedIndex], isMinimized: false };
        // Move to end (bring to front)
        if (maximizedIndex < updated.length - 1) {
          const maximized = updated[maximizedIndex];
          updated.splice(maximizedIndex, 1);
          updated.push(maximized);
        }
      }
      return updated;
    });
  }, []);

  const isChatWindowOpen = useCallback(
    (chatId: string) => {
      return openWindows.some((w) => w.chatId === chatId);
    },
    [openWindows]
  );

  // Set focused chat (matches AngularJS chatGainedFocus/chatLostFocus)
  const setFocusedChat = useCallback((chatId: string | null) => {
    setFocusedChatId(chatId);
    
    // Dispatch event for ChatListContext to listen (avoids circular dependency)
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('focusedChatChanged', {
        detail: { chatId },
      });
      window.dispatchEvent(event);
    }
  }, []);

  return (
    <ChatWindowsContext.Provider
      value={{
        openWindows,
        focusedChatId,
        openChatWindow,
        closeChatWindow,
        minimizeChatWindow,
        maximizeChatWindow,
        isChatWindowOpen,
        setFocusedChat,
      }}
    >
      {children}
    </ChatWindowsContext.Provider>
  );
}

export function useChatWindows() {
  const context = useContext(ChatWindowsContext);
  if (!context) {
    throw new Error('useChatWindows must be used within ChatWindowsProvider');
  }
  return context;
}




