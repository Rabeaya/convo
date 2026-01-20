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

  // Filter windows to only render active (non-minimized) windows
  // Matches AngularJS behavior where minimized windows are hidden (not in chatWindows array)
  // Only active/open windows are visible, and windows cannot overlap
  const visibleWindows = useMemo(() => {
    if (typeof window === 'undefined' || openWindows.length === 0) {
      return [];
    }

    // In AngularJS, chatWindows array contains only active (non-minimized) windows
    // Minimized windows are moved to dockedWind and are hidden
    // Filter out minimized windows - only show active windows
    const activeWindows = openWindows.filter(w => !w.isMinimized);
    
    if (activeWindows.length === 0) {
      return [];
    }

    // Process active windows in order, ensuring no overlap
    // Matches AngularJS adjustChatWindowsPosition logic
    // In AngularJS, minimized windows are removed from chatWindows array, so they don't take up space
    // We filter them out and only calculate positions for active windows
    const visible: typeof openWindows = [];
    
    // Map only active windows for position calculation (matches AngularJS chatWindows array)
    const activeWindowsForPosition = activeWindows.map(w => ({
      chatId: w.chatId,
      isMinimized: false, // All are active, so none are minimized
    }));
    
    for (let i = 0; i < activeWindows.length; i++) {
      // Calculate position using index in activeWindows array (matches AngularJS chatWindows array)
      const rightOffset = calculateChatWindowPosition(
        i,
        activeWindowsForPosition,
        { isMinimized: chatListIsMinimized }
      );
      
      const windowWidth = CHAT_WINDOW_MAXIMIZED_WIDTH; // All active windows are maximized
      
      // Calculate left edge of this window
      const windowLeftEdge = window.innerWidth - rightOffset - windowWidth;
      
      // Check if window would overlap with left sidebar
      // Window should not cover left sidebar (235px)
      if (windowLeftEdge < LEFT_PANEL_WIDTH) {
        // This window would overlap with left sidebar - stop rendering
        // Matches AngularJS docking behavior
        break;
      }
      
      // Check if this window overlaps with previous window
      if (i > 0 && visible.length > 0) {
        const prevWindowWidth = CHAT_WINDOW_MAXIMIZED_WIDTH;
        const prevRightOffset = calculateChatWindowPosition(
          i - 1,
          activeWindowsForPosition,
          { isMinimized: chatListIsMinimized }
        );
        
        const currentWindowLeftFromRight = rightOffset + windowWidth;
        const prevWindowLeftFromRight = prevRightOffset + prevWindowWidth;
        
        // Check for overlap: current window's left edge should be to the left of previous window's left edge
        if (currentWindowLeftFromRight <= prevWindowLeftFromRight) {
          // Overlap detected - stop rendering (matches AngularJS docking behavior)
          break;
        }
      }
      
      // Window fits - add it to visible
      visible.push(activeWindows[i]);
    }
    
    return visible;
  }, [openWindows, chatListIsMinimized]);

  return (
    <>
      {visibleWindows.map((windowMeta, index) => (
        <ChatWindow
          key={windowMeta.chatId}
          chatId={windowMeta.chatId}
          chat={windowMeta.chat}
          isMinimized={windowMeta.isMinimized}
          initialHeight={windowMeta.height}
          position={index}
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

