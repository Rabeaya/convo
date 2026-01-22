'use client';

/**
 * DockedChat - Main chat container
 * 
 * Replicates AngularJS chat structure:
 * - Chat list window (docked bottom-right)
 * - Individual chat windows (open next to list)
 * 
 * Uses standard HTML elements only (no Angular custom tags)
 */

import { useState, useEffect, useMemo } from 'react';
import { ChatListProvider } from '@/contexts/ChatListContext';
import { ChatWindowsProvider, useChatWindows } from '@/contexts/ChatWindowsContext';
import { calculateChatWindowPosition, LEFT_PANEL_WIDTH, CHAT_WINDOW_MAXIMIZED_WIDTH, WINDOW_MINIMIZED_WIDTH, SPACE_BETWEEN_WINDOWS } from '@/utils/chatWindowPositioning';
import ChatListWindow from './ChatListWindow';
import ChatWindow from './ChatWindow';

interface ChatWindowsRendererProps {
  chatListIsMinimized: boolean;
}

function ChatWindowsRenderer({ chatListIsMinimized }: ChatWindowsRendererProps) {
  const { openWindows, focusedChatId } = useChatWindows();

  // Render BOTH minimized + maximized windows (matches AngularJS cnvWindowMaximizeMinimizeManager):
  // - minimized windows shrink to 28px height and remain visible as headers
  // - minimized windows still occupy width (166px) in positioning
  const visibleWindows = useMemo(() => {
    if (typeof window === 'undefined' || openWindows.length === 0) {
      return [];
    }

    const windowsForPosition = openWindows.map(w => ({
      chatId: w.chatId,
      isMinimized: w.isMinimized,
    }));

    const visible: Array<{ windowMeta: (typeof openWindows)[number]; positionIndex: number }> = [];

    for (let i = 0; i < openWindows.length; i++) {
      const meta = openWindows[i];
      const rightOffset = calculateChatWindowPosition(i, windowsForPosition, { isMinimized: chatListIsMinimized });
      const windowWidth = meta.isMinimized ? WINDOW_MINIMIZED_WIDTH : CHAT_WINDOW_MAXIMIZED_WIDTH;
      const windowLeftEdge = window.innerWidth - rightOffset - windowWidth;

      // Stop rendering when windows would overlap left sidebar (Angular docks instead).
      if (windowLeftEdge < LEFT_PANEL_WIDTH) break;

      visible.push({ windowMeta: meta, positionIndex: i });
    }

    return visible;
  }, [openWindows, chatListIsMinimized]);

  return (
    <>
      {visibleWindows.map(({ windowMeta, positionIndex }) => (
        <ChatWindow
          key={windowMeta.chatId}
          chatId={windowMeta.chatId}
          chat={windowMeta.chat}
          isMinimized={windowMeta.isMinimized}
          initialHeight={windowMeta.height}
          position={positionIndex}
          chatListIsMinimized={chatListIsMinimized}
        />
      ))}
    </>
  );
}

export default function DockedChat() {
  // Manage chat list minimized state (lifted from ChatListWindow for positioning)
  const [chatListIsMinimized, setChatListIsMinimized] = useState(false);

  // Listen for window resize to recalculate positions (matches AngularJS window resize handler)
  // CRITICAL: Do NOT dispatch resize event inside resize handler - causes infinite loop
  // The useMemo in ChatWindowsRenderer will automatically recalculate when window size changes
  // because it depends on openWindows and chatListIsMinimized, which will trigger re-render
  useEffect(() => {
    // No-op handler - just need to trigger re-render when window resizes
    // The useMemo dependencies will handle the recalculation
    const handleResize = () => {
      // Force re-render by updating a state (but we don't have state here)
      // Actually, we don't need to do anything - the useMemo will recalculate automatically
      // when the component re-renders due to window resize
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <ChatWindowsProvider>
      <ChatListProvider>
        <div id="ChatDiv">
          <ChatListWindow 
            onMinimizeChange={setChatListIsMinimized}
          />
          <ChatWindowsRenderer chatListIsMinimized={chatListIsMinimized} />
        </div>
      </ChatListProvider>
    </ChatWindowsProvider>
  );
}

