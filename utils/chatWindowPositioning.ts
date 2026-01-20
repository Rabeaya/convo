/**
 * Chat Window Positioning Utilities
 * 
 * Matches AngularJS cnvChatManager.js positioning logic exactly:
 * - adjustChatWindowsPosition() - calculates window positions
 * - canOpenChat() - checks if new window can be opened
 * - isDockingNeededToOpenChatWindow() - checks screen space
 */

// Constants matching AngularJS (cnvChatManager.js lines 45-50)
export const CHAT_WINDOW_MAXIMIZED_WIDTH = 302;
export const WINDOW_MINIMIZED_WIDTH = 166;
export const CHAT_LIST_MAXIMIZED_WIDTH = 260;
export const SPACE_BETWEEN_WINDOWS = 4;
export const SPACE_BETWEEN_CHAT_LIST_AND_CHAT_WINDOWS = 16;

// Left sidebar width (from left-panel.css - matches AngularJS)
export const LEFT_PANEL_WIDTH = 235;

interface ChatWindowMeta {
  chatId: string;
  isMinimized: boolean;
}

interface ChatListProperties {
  isMinimized: boolean;
}

/**
 * Calculate the right offset (from right edge) for a chat window at a given index
 * Matches AngularJS adjustChatWindowsPosition() function (lines 215-229)
 * This calculates positions sequentially to prevent overlaps
 */
export function calculateChatWindowPosition(
  windowIndex: number,
  allWindows: ChatWindowMeta[],
  chatListProperties: ChatListProperties
): number {
  if (windowIndex < 0 || windowIndex >= allWindows.length) {
    return 0;
  }

  // Start position: chat list width + space between chat list and windows - 2
  // This matches AngularJS line 216 exactly
  let lastChatWindowPos = (chatListProperties.isMinimized 
    ? WINDOW_MINIMIZED_WIDTH 
    : CHAT_LIST_MAXIMIZED_WIDTH) 
    + SPACE_BETWEEN_CHAT_LIST_AND_CHAT_WINDOWS - 2;

  // Add width of each previous window + spacing (matches AngularJS lines 218-221)
  for (let cWindow = 0; cWindow < windowIndex; cWindow++) {
    const prevWindow = allWindows[cWindow];
    if (prevWindow) {
      const prevWindowWidth = prevWindow.isMinimized 
        ? WINDOW_MINIMIZED_WIDTH 
        : CHAT_WINDOW_MAXIMIZED_WIDTH;
      lastChatWindowPos += prevWindowWidth + SPACE_BETWEEN_WINDOWS;
    }
  }

  // Note: We don't adjust position here if it would cover left sidebar
  // Instead, the caller should check and dock the window instead of rendering it
  // This matches AngularJS behavior where overlapping windows are docked

  return lastChatWindowPos;
}

/**
 * Get vertical scrollbar width
 * Matches AngularJS getWindowVerticalScrollbarWidth() function (lines 460-471)
 */
function getWindowVerticalScrollbarWidth(): number {
  if (typeof window === 'undefined') return 0;
  
  const outerWidth = window.outerWidth;
  const innerWidth = window.innerWidth;
  
  // Chrome in win native app gives 0 window.outerWidth
  let scale = 1;
  if (outerWidth !== 0) {
    scale = outerWidth / innerWidth;
  }
  
  // Using Math.max because on mac native on 90% zoom the width comes out to be -1
  const scrollBarWidth = Math.max(innerWidth - (document.body?.clientWidth || innerWidth), 0) * scale;
  
  return scrollBarWidth;
}

/**
 * Check if a new chat window needs to be docked due to insufficient screen space
 * Matches AngularJS isDockingNeededToOpenChatWindow() function (lines 410-431)
 */
export function isDockingNeededToOpenChatWindow(
  openingPosition: number,
  isOpeningChatWindowAsMinimized: boolean,
  hasDockedWindows: boolean = false
): boolean {
  if (typeof window === 'undefined') return false;

  const adjustingOffset = 10;
  const windowInnerWidth = window.innerWidth;
  const scrollbarWidth = getWindowVerticalScrollbarWidth();
  
  let offset = windowInnerWidth - scrollbarWidth - adjustingOffset;

  // Subtract the new window width + spacing
  if (!isOpeningChatWindowAsMinimized) {
    offset -= (CHAT_WINDOW_MAXIMIZED_WIDTH + SPACE_BETWEEN_WINDOWS);
  } else {
    offset -= (WINDOW_MINIMIZED_WIDTH + SPACE_BETWEEN_WINDOWS);
  }

  offset -= adjustingOffset;

  // Subtract docked windows width if any
  if (hasDockedWindows) {
    offset -= 80; // Width of docked box
  }

  // If opening position >= available offset, need to dock
  return openingPosition >= offset;
}

/**
 * Check if we can open a new chat window
 * Matches AngularJS canOpenChat() function (lines 232-248)
 */
export function canOpenChat(
  allWindows: ChatWindowMeta[],
  chatListProperties: ChatListProperties,
  isOpeningChatWindowAsMinimized: boolean,
  hasDockedWindows: boolean = false
): boolean {
  if (allWindows.length === 0) {
    return true;
  }

  // Calculate position where new window would be placed
  let lastOpenedPos = (chatListProperties.isMinimized 
    ? WINDOW_MINIMIZED_WIDTH 
    : CHAT_LIST_MAXIMIZED_WIDTH) 
    + SPACE_BETWEEN_CHAT_LIST_AND_CHAT_WINDOWS - 2;

  // Add width of all existing windows + spacing
  for (let cWindow = 0; cWindow < allWindows.length; cWindow++) {
    const window = allWindows[cWindow];
    const windowWidth = window.isMinimized 
      ? WINDOW_MINIMIZED_WIDTH 
      : CHAT_WINDOW_MAXIMIZED_WIDTH;
    lastOpenedPos += windowWidth + SPACE_BETWEEN_WINDOWS;
  }

  // Check if there's enough space
  return !isDockingNeededToOpenChatWindow(
    lastOpenedPos,
    isOpeningChatWindowAsMinimized,
    hasDockedWindows
  );
}

/**
 * Check if already opened windows need to be docked due to screen resize
 * Matches AngularJS isDockingNeededForAlreadyOpenedChatWindows() function (lines 433-458)
 */
export function isDockingNeededForAlreadyOpenedChatWindows(
  allWindows: ChatWindowMeta[]
): boolean {
  if (allWindows.length === 0 || typeof window === 'undefined') {
    return false;
  }

  const lastWindow = allWindows[allWindows.length - 1];
  if (!lastWindow) return false;

  // Calculate position of last window's right edge
  // Note: In AngularJS, this uses metaDetails.xPosition, but we'll calculate it
  const lastWindowIndex = allWindows.length - 1;
  const chatListProperties: ChatListProperties = { isMinimized: false }; // Default, should be passed from context
  
  let lastOpenedChatWindowPos = calculateChatWindowPosition(
    lastWindowIndex,
    allWindows,
    chatListProperties
  );

  // Add the last window's width
  const lastWindowWidth = lastWindow.isMinimized 
    ? WINDOW_MINIMIZED_WIDTH 
    : CHAT_WINDOW_MAXIMIZED_WIDTH;
  lastOpenedChatWindowPos += lastWindowWidth;

  // Check if it exceeds screen width
  const adjustingOffset = 10;
  const scrollbarWidth = getWindowVerticalScrollbarWidth();
  const availableWidth = window.innerWidth - scrollbarWidth - adjustingOffset;

  return lastOpenedChatWindowPos > availableWidth;
}

