/**
 * useAutoHidingScrollbar Hook
 * 
 * Replicates AngularJS autoHidingScrollBar directive behavior exactly
 * Source: web_app/src/app/chat/fullviewclient/autoHidingScrollBar.js
 * 
 * Behavior:
 * - Scrollbar hidden by default (opacity: 0)
 * - Shows on scroll (with 50ms debounce)
 * - Shows on hover
 * - Auto-hides after 1000ms when scrolling stops or mouse leaves
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseAutoHidingScrollbarOptions {
  scrollDebounceMs?: number; // Default: 50ms (matches AngularJS)
  hideTimeoutMs?: number; // Default: 1000ms (matches AngularJS)
}

export function useAutoHidingScrollbar(options: UseAutoHidingScrollbarOptions = {}) {
  const {
    scrollDebounceMs = 50, // Matches AngularJS line 63
    hideTimeoutMs = 1000, // Matches AngularJS line 96
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollTrackRef = useRef<HTMLDivElement | null>(null);
  const scrollBarRef = useRef<HTMLDivElement | null>(null);
  const scrollbarParentRef = useRef<HTMLElement | null>(null); // Store the parent where scrollbar is appended
  const useContainerAsPositionRef = useRef(false); // If true, position scrollbar relative to container, not parent
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringContainerRef = useRef(false);
  const isHoveringTrackRef = useRef(false);
  const isDraggingRef = useRef(false);
  const containerHeightRef = useRef(0);
  const scrollContentHeightRef = useRef(0);
  const scrollerHeightRef = useRef(0);

  // Calculate scrollbar position and size (matches AngularJS reCalculateScrollerHeight)
  const recalculateScrollbar = useCallback(() => {
    if (!containerRef.current || !scrollTrackRef.current || !scrollBarRef.current) {
      return;
    }

    const container = containerRef.current;
    const scrollTrack = scrollTrackRef.current;
    const scrollBar = scrollBarRef.current;

    scrollContentHeightRef.current = container.scrollHeight;
    containerHeightRef.current = container.clientHeight;

    // Hide scrollbar if content fits (matches AngularJS line 140-144)
    if (containerHeightRef.current >= scrollContentHeightRef.current) {
      scrollTrack.style.display = 'none';
      return;
    }

    // Show scrollbar track (matches AngularJS line 146-150)
    // Position relative to parent (matches AngularJS $element.position().top)
    // Use scrollbarParentRef if available, otherwise use container.parentElement
    const scrollbarParent = scrollbarParentRef.current || container.parentElement;
    if (scrollbarParent) {
      let relativeTop: number;
      
      if (useContainerAsPositionRef.current) {
        // Position scrollbar relative to the scrollable container itself (not parent)
        // This prevents scrollbar from overlapping header/search bar
        // Calculate container's position relative to scrollbarParent (grandparent)
        const containerRect = container.getBoundingClientRect();
        const scrollbarParentRect = scrollbarParent.getBoundingClientRect();
        relativeTop = containerRect.top - scrollbarParentRect.top;
      } else {
        // Normal positioning: relative to parent (scrollbarParent is the immediate parent)
        const containerRect = container.getBoundingClientRect();
        const parentRect = scrollbarParent.getBoundingClientRect();
        relativeTop = containerRect.top - parentRect.top;
      }
      
      scrollTrack.style.display = 'block';
      scrollTrack.style.top = `${relativeTop}px`;
      scrollTrack.style.height = `${containerHeightRef.current}px`;
      scrollTrack.style.right = '0px';
    }

    // Calculate scrollbar thumb height (matches AngularJS line 152-154)
    const ratio = containerHeightRef.current / scrollContentHeightRef.current;
    scrollerHeightRef.current = ratio * containerHeightRef.current;
    if (scrollerHeightRef.current < 20) {
      scrollerHeightRef.current = 20; // Minimum height
    }

    scrollBar.style.height = `${scrollerHeightRef.current}px`;

    // Update scrollbar position (matches AngularJS line 164-167 EXACTLY)
    // CRITICAL: AngularJS calculates position if scrollTop exists, but doesn't explicitly set opacity
    // Opacity is managed by setScrollBarPosition (always 1) and hideAfterTimer (0 after timeout)
    const scrollTop = container.scrollTop;
    const maxScroll = scrollContentHeightRef.current - containerHeightRef.current;
    if (maxScroll > 0) {
      // Content overflows - calculate scrollbar position (matches AngularJS line 164-167)
      if (scrollTop > 0) {
        // Calculate scrollbar thumb position (matches AngularJS line 164-166)
        const perScrolled = scrollTop / maxScroll;
        const topPosition = (perScrolled * containerHeightRef.current) - (perScrolled * scrollerHeightRef.current);
        scrollBar.style.top = `${Math.max(0, topPosition)}px`;
      } else {
        // At top (scrollTop === 0) - position scrollbar at top (matches AngularJS line 164)
        scrollBar.style.top = '0px';
      }
      
      // CRITICAL: AngularJS doesn't explicitly set opacity in reCalculateScrollerHeight
      // But we need to ensure scrollbar is visible when content overflows
      // Show scrollbar - it will be hidden by hideAfterTimer after 1 second if not hovering
      scrollBar.style.opacity = '1';
    } else {
      // Content doesn't overflow - hide scrollbar completely (matches AngularJS line 140-144)
      scrollBar.style.top = '0px';
      scrollBar.style.opacity = '0';
      scrollTrack.style.display = 'none';
    }
  }, []);

  // Hide scrollbar after timeout (matches AngularJS hideAfterTimer)
  const hideAfterTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Don't hide if hovering track (matches AngularJS line 88-91)
    if (isHoveringTrackRef.current) {
      return;
    }

    hideTimeoutRef.current = setTimeout(() => {
      if (scrollBarRef.current && !isHoveringContainerRef.current && !isHoveringTrackRef.current) {
        scrollBarRef.current.style.opacity = '0';
      }
    }, hideTimeoutMs);
  }, [hideTimeoutMs]);

  // Set scrollbar position on scroll (matches AngularJS setScrollBarPosition)
  const setScrollBarPosition = useCallback((scrollTop: number) => {
    if (!scrollBarRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    scrollContentHeightRef.current = container.scrollHeight;
    containerHeightRef.current = container.clientHeight;

    // Hide scrollbar if content fits (matches AngularJS line 140-144)
    if (containerHeightRef.current >= scrollContentHeightRef.current) {
      if (scrollTrackRef.current) {
        scrollTrackRef.current.style.display = 'none';
      }
      return;
    }

    // Show scrollbar track and update its position
    // Use scrollbarParentRef if available, otherwise use container.parentElement
    const scrollbarParent = scrollbarParentRef.current || container.parentElement;
    if (scrollTrackRef.current && scrollbarParent) {
      let relativeTop: number;
      
      if (useContainerAsPositionRef.current) {
        // Position scrollbar relative to the scrollable container itself (not parent)
        // Calculate container's position relative to scrollbarParent (grandparent)
        const containerRect = container.getBoundingClientRect();
        const scrollbarParentRect = scrollbarParent.getBoundingClientRect();
        relativeTop = containerRect.top - scrollbarParentRect.top;
      } else {
        // Normal positioning: relative to parent (scrollbarParent is the immediate parent)
        const containerRect = container.getBoundingClientRect();
        const parentRect = scrollbarParent.getBoundingClientRect();
        relativeTop = containerRect.top - parentRect.top;
      }
      
      scrollTrackRef.current.style.display = 'block';
      scrollTrackRef.current.style.top = `${relativeTop}px`;
      scrollTrackRef.current.style.height = `${containerHeightRef.current}px`;
      scrollTrackRef.current.style.right = '0px';
    }

    // Calculate scrollbar position (matches AngularJS line 99-108 EXACTLY)
    // CRITICAL: AngularJS ALWAYS sets opacity to 1 when scrolling (line 105)
    const maxScroll = scrollContentHeightRef.current - containerHeightRef.current;
    if (maxScroll <= 0) {
      // Content doesn't overflow - hide scrollbar completely
      if (scrollBarRef.current) {
        scrollBarRef.current.style.opacity = '0';
      }
      if (scrollTrackRef.current) {
        scrollTrackRef.current.style.display = 'none';
      }
      return;
    }

    // Content overflows - show scrollbar (matches AngularJS line 102-105)
    const perScrolled = scrollTop / maxScroll;
    const topPosition = (perScrolled * containerHeightRef.current) - (perScrolled * scrollerHeightRef.current);
    scrollBarRef.current.style.top = `${Math.max(0, topPosition)}px`;
    // CRITICAL: AngularJS ALWAYS sets opacity to 1 when scrolling (line 105)
    // The hideAfterTimer will hide it after 1 second if not hovering
    scrollBarRef.current.style.opacity = '1';
    hideAfterTimer(); // Start hide timer (matches AngularJS line 107)
  }, [hideAfterTimer]);

  // Handle scroll event (matches AngularJS onScroll)
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !scrollBarRef.current || !scrollTrackRef.current) {
      return;
    }

    // Clear hide timeout immediately (matches AngularJS line 39-41)
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Show scrollbar immediately on scroll (before debounce)
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    
    // Ensure scrollbar track is visible and positioned correctly
    // Use scrollbarParentRef if available, otherwise use container.parentElement
    const scrollbarParent = scrollbarParentRef.current || container.parentElement;
    if (scrollTrackRef.current && scrollBarRef.current && scrollbarParent) {
      let relativeTop: number;
      
      if (useContainerAsPositionRef.current) {
        // Position scrollbar relative to the scrollable container itself (not parent)
        // This prevents scrollbar from overlapping header/search bar
        // Calculate container's position relative to scrollbarParent (grandparent)
        const containerRect = container.getBoundingClientRect();
        const scrollbarParentRect = scrollbarParent.getBoundingClientRect();
        relativeTop = containerRect.top - scrollbarParentRect.top;
      } else {
        // Normal positioning: relative to parent (scrollbarParent is the immediate parent)
        const containerRect = container.getBoundingClientRect();
        const parentRect = scrollbarParent.getBoundingClientRect();
        relativeTop = containerRect.top - parentRect.top;
      }
      
      scrollTrackRef.current.style.display = 'block';
      scrollTrackRef.current.style.top = `${relativeTop}px`;
      scrollTrackRef.current.style.height = `${container.clientHeight}px`;
      scrollTrackRef.current.style.right = '0px';
      
      scrollBarRef.current.style.opacity = '1';
    }
    
    // Update position immediately
    setScrollBarPosition(scrollTop);

    if (scrollTimeoutRef.current) {
      return; // Already processing
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) {
        scrollTimeoutRef.current = null;
        return;
      }

      const finalScrollTop = containerRef.current.scrollTop;
      setScrollBarPosition(finalScrollTop);
      scrollTimeoutRef.current = null;
    }, scrollDebounceMs);
  }, [scrollDebounceMs, setScrollBarPosition]);

  // Handle mouse enter (matches AngularJS onMouseOver)
  const handleMouseEnter = useCallback(() => {
    isHoveringContainerRef.current = true;
    if (scrollBarRef.current) {
      scrollBarRef.current.style.opacity = '1';
    }
    hideAfterTimer();
  }, [hideAfterTimer]);

  // Handle mouse leave (matches AngularJS onMouseOut)
  const handleMouseLeave = useCallback(() => {
    isHoveringContainerRef.current = false;
    hideAfterTimer();
  }, [hideAfterTimer]);

  // Handle scroll track mouse enter (matches AngularJS onScrollTrackMouseOver)
  const handleTrackMouseEnter = useCallback(() => {
    isHoveringTrackRef.current = true;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    if (scrollTrackRef.current) {
      scrollTrackRef.current.style.backgroundColor = 'rgba(150,150,150,0.3)';
    }
    if (scrollBarRef.current) {
      scrollBarRef.current.style.opacity = '1';
    }
  }, []);

  // Handle scroll track mouse leave (matches AngularJS onScrollTrackMouseOut)
  const handleTrackMouseLeave = useCallback(() => {
    if (isDraggingRef.current) {
      return; // Don't hide while dragging
    }
    isHoveringTrackRef.current = false;
    if (scrollTrackRef.current) {
      scrollTrackRef.current.style.backgroundColor = 'rgba(0,0,0,0.0)';
    }
    hideAfterTimer();
  }, [hideAfterTimer]);

  // Handle scroll track click (matches AngularJS onScrolltrackClick)
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !scrollTrackRef.current) {
      return;
    }

    const rect = scrollTrackRef.current.getBoundingClientRect();
    const y = (e.clientY - rect.top) - (scrollerHeightRef.current / 2);
    const displacement = y / containerHeightRef.current;
    const scrollPos = scrollContentHeightRef.current * displacement;
    
    containerRef.current.scrollTo({
      top: Math.max(0, scrollPos),
      behavior: 'smooth'
    });
  }, []);

  // Handle scrollbar drag (matches AngularJS onDragMouseMove)
  const handleBarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const handleMouseMove = (moveE: MouseEvent) => {
      if (!containerRef.current || !scrollTrackRef.current) {
        return;
      }

      const rect = scrollTrackRef.current.getBoundingClientRect();
      const y = moveE.clientY - (rect.top + scrollerHeightRef.current / 2);
      const displacement = y / containerHeightRef.current;
      containerRef.current.scrollTop = scrollContentHeightRef.current * displacement;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      if (!isHoveringContainerRef.current) {
        handleTrackMouseLeave({} as React.MouseEvent);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleTrackMouseLeave]);

  // Setup effect
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Ensure parent has position relative for absolute positioning (matches AngularJS)
    const parent = container.parentElement;
    if (!parent) {
      console.error('[useAutoHidingScrollbar] Container has no parent element');
      return;
    }

    // Ensure parent has position relative (required for absolute positioning of scrollbar)
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }

    // CRITICAL: If parent has overflow: hidden, we need to append scrollbar to grandparent
    // or ensure scrollbar is positioned correctly to be visible
    // Check if parent has overflow hidden that might clip the scrollbar
    const parentOverflow = parentStyle.overflow;
    const parentOverflowY = parentStyle.overflowY;
    const hasOverflowHidden = parentOverflow === 'hidden' || parentOverflowY === 'hidden';
    
    // CRITICAL: For chat list, always append scrollbar to immediate parent (not grandparent)
    // This ensures scrollbar is positioned correctly relative to the scrollable area
    // Only use grandparent if parent has overflow hidden AND we need to avoid clipping
    let scrollbarParent = parent;
    let useContainerAsPositionReference = false;
    
    // Check if parent has position relative/absolute (required for absolute positioning)
    const parentHasPosition = parentStyle.position === 'relative' || parentStyle.position === 'absolute' || parentStyle.position === 'fixed';
    
    // CRITICAL: If parent has overflow: hidden, we MUST append scrollbar to grandparent
    // Otherwise the scrollbar will be clipped by overflow: hidden
    // Exception: For chat list, parent has position: absolute and no overflow hidden, so use parent
    if (hasOverflowHidden && parent.parentElement) {
      // Parent has overflow hidden - MUST use grandparent to avoid clipping
      const grandparent = parent.parentElement;
      const grandparentStyle = window.getComputedStyle(grandparent);
      if (grandparentStyle.position !== 'static') {
        scrollbarParent = grandparent;
        // Ensure grandparent has position relative if needed
        if (grandparentStyle.position === 'static') {
          grandparent.style.position = 'relative';
        }
        // When using grandparent, position relative to container to prevent overlap
        useContainerAsPositionReference = true;
      } else {
        // Grandparent doesn't have position - set it to relative
        grandparent.style.position = 'relative';
        scrollbarParent = grandparent;
        useContainerAsPositionReference = true;
      }
    } else if (!parentHasPosition) {
      // Parent doesn't have position and no overflow hidden - set to relative
      parent.style.position = 'relative';
    }
    // If parent has position (relative/absolute/fixed) and no overflow hidden, use it directly - this is correct for chat list

    // Create scrollbar elements (matches AngularJS line 27)
    const scrollTrack = document.createElement('div');
    scrollTrack.className = 'scroll-track';
    scrollTrackRef.current = scrollTrack;

    const scrollBar = document.createElement('div');
    scrollBar.className = 'scroll-bar';
    scrollBarRef.current = scrollBar;

    scrollTrack.appendChild(scrollBar);
    scrollbarParent.appendChild(scrollTrack);
    scrollbarParentRef.current = scrollbarParent; // Store reference for later use
    useContainerAsPositionRef.current = useContainerAsPositionReference; // Store positioning mode

    // Attach event listeners
    container.addEventListener('scroll', handleScroll);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    scrollTrack.addEventListener('mouseenter', handleTrackMouseEnter);
    scrollTrack.addEventListener('mouseleave', handleTrackMouseLeave);
    scrollTrack.addEventListener('click', handleTrackClick as any);
    scrollBar.addEventListener('mousedown', handleBarMouseDown as any);

    // CRITICAL: Initial calculation after DOM insertion (matches AngularJS recalculateSizeDebounced line 127)
    // Use setTimeout with 200ms delay to match AngularJS behavior
    // This ensures scrollbar is calculated after DOM is fully ready
    const initialRecalcTimer = setTimeout(() => {
      recalculateScrollbar();
    }, 200); // Matches AngularJS resizetimer setTimeout 200ms (line 125)

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      recalculateScrollbar();
    });
    resizeObserver.observe(container);
    
    // Also recalculate when content changes (messages added/removed)
    // CRITICAL: Use debounced recalculation to match AngularJS recalculateSizeDebounced()
    // Store timer in a variable that can be accessed in cleanup
    let mutationRecalcTimer: NodeJS.Timeout | null = null;
    const mutationObserver = new MutationObserver(() => {
      // Debounce recalculation to prevent excessive calls (matches AngularJS)
      if (mutationRecalcTimer) {
        clearTimeout(mutationRecalcTimer);
      }
      mutationRecalcTimer = setTimeout(() => {
        recalculateScrollbar();
      }, 200); // Matches AngularJS resizetimer setTimeout 200ms
    });
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    // Cleanup
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      scrollTrack.removeEventListener('mouseenter', handleTrackMouseEnter);
      scrollTrack.removeEventListener('mouseleave', handleTrackMouseLeave);
      scrollTrack.removeEventListener('click', handleTrackClick as any);
      scrollBar.removeEventListener('mousedown', handleBarMouseDown as any);
      
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      
      if (initialRecalcTimer) {
        clearTimeout(initialRecalcTimer);
      }
      if (mutationRecalcTimer) {
        clearTimeout(mutationRecalcTimer);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      
      // Remove scrollbar from the correct parent
      if (scrollbarParentRef.current && scrollTrack.parentElement === scrollbarParentRef.current) {
        scrollbarParentRef.current.removeChild(scrollTrack);
      } else if (scrollTrack.parentElement) {
        scrollTrack.parentElement.removeChild(scrollTrack);
      }
      scrollbarParentRef.current = null;
    };
  }, [handleScroll, handleMouseEnter, handleMouseLeave, handleTrackMouseEnter, handleTrackMouseLeave, handleTrackClick, handleBarMouseDown, recalculateScrollbar]);

  // Recalculate when content changes
  useEffect(() => {
    const timer = setTimeout(() => {
      recalculateScrollbar();
    }, 100);
    return () => clearTimeout(timer);
  }, [recalculateScrollbar]);

  return containerRef;
}

