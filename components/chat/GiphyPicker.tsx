'use client';

/**
 * GiphyPicker - GIF picker popover component
 * 
 * Replicates AngularJS cnv-giphy-popover directive EXACTLY
 * Matches AngularJS behavior:
 * - Opens popover on click
 * - Searches Giphy API with debounced search
 * - Displays GIFs in horizontal scrollable gallery
 * - Sends GIF as file attachment via upload service
 * - Matches AngularJS UI exactly
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './GiphyPicker.css';

interface GiphyPickerProps {
  onGifSelect: (gifUrl: string, gifData: any) => void;
  disabled?: boolean;
  chatId?: string;
}

const GIPHY_API_KEY = 'xTiTnI9GNUe8rosXMQ'; // Matches AngularJS line 95

interface GifImage {
  original: string;
  downsized: string;
  src: string;
  thumbnail: string;
  size: number;
}

export default function GiphyPicker({ onGifSelect, disabled = false, chatId }: GiphyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState(''); // Start empty, default to 'happy reactions' on search
  const [gifs, setGifs] = useState<GifImage[]>([]);
  const [searching, setSearching] = useState(true); // Start with searching true (matches AngularJS line 88)
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchGifs = useCallback(async (query: string) => {
    setSearching(true);
    try {
      // Matches AngularJS Giphy API call line 123
      // Use https:// protocol (AngularJS uses //api.giphy.com which defaults to current protocol)
      const params = new URLSearchParams({
        api_key: GIPHY_API_KEY,
        q: query || 'happy reactions', // Default to 'happy reactions' if empty (matches AngularJS line 122)
        limit: '20', // Matches AngularJS line 94
        rating: 'pg', // Matches AngularJS line 93
      });

      const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
      const data = await response.json();

      // Map response to match AngularJS format (line 131-139)
      const mappedGifs: GifImage[] = data.data.map((gif: any) => ({
        original: gif.images.original.url,
        downsized: gif.images.downsized.url,
        src: gif.images.fixed_height_small.url,
        thumbnail: gif.images.fixed_height_small_still.url,
        size: gif.images.fixed_height_small.size,
      }));

      setGifs(mappedGifs);
      
      // Reset gallery scroll position (matches AngularJS resetGiphyControls line 7-17)
      if (galleryRef.current) {
        galleryRef.current.scrollLeft = 0;
      }
    } catch (error) {
      console.error('Giphy search error:', error);
      setGifs([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Load initial GIFs when popover opens (matches AngularJS line 115-148)
  // Default search is 'happy reactions' if searchText is empty (matches AngularJS line 122)
  useEffect(() => {
    if (isOpen) {
      // Reset search text and load default GIFs
      setSearchText('');
      searchGifs('happy reactions');
    } else {
      // Reset state when closed
      setGifs([]);
      setSearchText('');
    }
  }, [isOpen, searchGifs]);

  // Debounced search (matches AngularJS ng-model-options debounce 500ms line 5)
  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = setTimeout(() => {
      const query = searchText.trim() || 'happy reactions'; // Default to 'happy reactions' if empty (matches AngularJS line 122)
      searchGifs(query);
    }, 500); // Matches AngularJS debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [searchText, isOpen, searchGifs]);

  // Close popover on outside click (matches AngularJS hideGiphyPopover line 93-109)
  // IMPORTANT: Do NOT close if clicking the search input (matches AngularJS line 95)
  // Uses mousedown event like emoji picker to catch events before they bubble
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the button
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking inside the popover
      if (popoverRef.current && popoverRef.current.contains(target)) {
        return;
      }
      
      // Don't close if clicking the search input field (matches AngularJS line 95)
      const htmlTarget = target as HTMLElement;
      if (htmlTarget.tagName === 'INPUT' && htmlTarget.classList.contains('cnv-giphy-search-field')) {
        return;
      }
      
      // Close if clicking outside
      setIsOpen(false);
    };

    // Use mousedown like emoji picker (matches AngularJS behavior)
    window.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  // Close on Escape key (matches AngularJS onDocumentEscapeKeyUp line 125-127)
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keyup', handleEscape);
    return () => {
      window.removeEventListener('keyup', handleEscape);
    };
  }, [isOpen]);

  // Focus search input when popover opens (matches AngularJS line 180-185)
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 0);
    }
  }, [isOpen]);

  const handleGifClick = useCallback((gif: GifImage) => {
    // Matches AngularJS onGifSelectionFromGiphy line 19-51
    // Create file object matching AngularJS fileDetail structure
    const fileDetail = {
      name: 'giphy.gif',
      size: (gif as any).size || 0, // Default to 0 if size not available
      fileExt: 'gif',
      type: 'gif',
      fileId: crypto.randomUUID(), // Client-side UUID (will be replaced by server fileId)
      fileUploadName: `${crypto.randomUUID()}.gif`,
      source: 'url' as const,
      file_url: gif.downsized,
      mp_attachment_source: 'Giphy',
      status: 'WAITING',
      uploadFrom: 'chat-window',
    };

    console.log('[GiphyPicker] GIF selected, fileDetail:', fileDetail);
    onGifSelect(gif.downsized, fileDetail);
    setIsOpen(false);
  }, [onGifSelect]);

  const handleButtonClick = useCallback(() => {
    if (disabled) return;
    
    // Toggle popover (matches AngularJS popover-trigger='click' line 29)
    // Simple toggle like emoji picker - no event manipulation needed
    setIsOpen(prev => !prev);
  }, [disabled]);

  // Prevent event propagation on gallery (matches AngularJS line 155-157)
  const handleGalleryMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Handle horizontal mousewheel scrolling (matches AngularJS line 160-170)
  useEffect(() => {
    if (!galleryRef.current) return;

    const gallery = galleryRef.current;
    
    const handleMouseWheel = (e: WheelEvent) => {
      // Scroll only horizontally with mousewheel (matches AngularJS line 161-169)
      if (e.deltaX !== 0) {
        gallery.scrollLeft += e.deltaX * (e.deltaMode === 0 ? 1 : 20); // deltaFactor handling
        e.preventDefault();
        e.stopPropagation();
      } else if (e.deltaY !== 0) {
        // Convert vertical scroll to horizontal
        gallery.scrollLeft += e.deltaY * (e.deltaMode === 0 ? 1 : 20);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    gallery.addEventListener('wheel', handleMouseWheel, { passive: false });
    
    return () => {
      gallery.removeEventListener('wheel', handleMouseWheel);
    };
  }, [gifs.length]); // Re-attach when GIFs change

  // Calculate popover position (matches AngularJS EXACTLY)
  // AngularJS line 175: $('.popover').css('top',$('#'+scope.cnvChatWindowIdForGiphy).find('#iShowGiphyPopup').offset().top-223+'px');
  // AngularJS line 75-85: adjustPopoverPlacement checks if rect.top < 250 to switch to bottom
  const getPopoverPosition = useCallback(() => {
    if (!buttonRef.current) return { top: 0, left: 0, placement: 'top' as const, arrowLeft: 20 };

    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 355; // Matches AngularJS max-width line 13
    const popoverOffsetTop = 223; // Matches AngularJS line 175 (offset().top - 223)

    // Calculate arrow position to align with button center
    // Arrow should point to the center of the button
    const buttonCenter = rect.left + rect.width / 2;
    const popoverLeft = rect.left - popoverWidth + rect.width; // Align right edge with button right edge
    const arrowLeft = buttonCenter - popoverLeft; // Distance from popover left edge to button center

    // Check if we should use bottom placement (matches AngularJS line 79)
    // If button is too close to top (< 250px), use bottom placement
    const useBottomPlacement = rect.top < 250;

    if (useBottomPlacement) {
      // Position below button (bottom placement)
      return {
        top: rect.bottom + 4,
        left: popoverLeft,
        arrowLeft: Math.max(10, Math.min(arrowLeft, popoverWidth - 10)), // Clamp arrow position
        placement: 'bottom' as const,
      };
    }

    // Default: Position above button (top placement)
    // Matches AngularJS: button.offset().top - 223px
    return {
      top: rect.top - popoverOffsetTop, // Matches AngularJS line 175 exactly
      left: popoverLeft,
      arrowLeft: Math.max(10, Math.min(arrowLeft, popoverWidth - 10)), // Clamp arrow position
      placement: 'top' as const,
    };
  }, []);

  // Calculate position when popover opens
  // Use useEffect to ensure buttonRef is available after render
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom'; arrowLeft: number } | null>(null);
  
  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    
    // Wait for next frame to ensure buttonRef is mounted
    const timer = setTimeout(() => {
      if (buttonRef.current) {
        const newPosition = getPopoverPosition();
        console.log('[GiphyPicker] Calculated position:', newPosition);
        if (newPosition) {
          setPosition(newPosition);
        } else {
          console.warn('[GiphyPicker] Failed to calculate position - getPopoverPosition returned null');
        }
      } else {
        console.warn('[GiphyPicker] buttonRef.current is not available yet');
      }
    }, 10); // Small delay to ensure DOM is ready
    
    return () => clearTimeout(timer);
  }, [isOpen, getPopoverPosition]);

  // Update popover position on window resize/scroll (matches AngularJS line 174-176)
  useEffect(() => {
    if (!isOpen || !chatId || !buttonRef.current || !popoverRef.current) return;

    const updatePosition = () => {
      const newPosition = getPopoverPosition();
      if (newPosition && popoverRef.current) {
        popoverRef.current.style.top = `${newPosition.top}px`;
        popoverRef.current.style.left = `${newPosition.left}px`;
        // Update arrow position
        const arrow = popoverRef.current.querySelector('.arrow') as HTMLElement;
        if (arrow && newPosition.arrowLeft) {
          arrow.style.left = `${newPosition.arrowLeft}px`;
        }
      }
    };

    // Update position on scroll and resize (matches AngularJS line 174)
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, chatId, getPopoverPosition]);

  return (
    <>
      <div className="giphy-action-container">
        <div
          ref={buttonRef}
          id="iShowGiphyPopup"
          className={`attachmentButton giphy ${isOpen ? 'selected' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onClick={handleButtonClick}
          style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 0.85,
          }}
        />
      </div>
      {isOpen && position && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className={`custom-giphy-popover popover ${position.placement}`}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 10003, // Above chat window (10000) and chat list (9999) - ensure it covers everything
          }}
          onMouseDown={(e) => e.stopPropagation()} // Prevent mousedown from bubbling (matches emoji picker)
        >
          <div className="arrow" style={{ left: position.arrowLeft ? `${position.arrowLeft}px` : '20px' }} />
          <div className="popover-content">
            <div className="cnv-giphy-container">
              {/* Search bar - matches AngularJS cnv-giphy.tpl.html line 3-6 */}
              <div className="chatSearchBar">
                <div className="searchChatIcon" />
                <input
                  ref={searchInputRef}
                  className="cnv-giphy-search-field"
                  type="text"
                  placeholder="Find the right GIF for any situation"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    // Trigger searchChanged (matches AngularJS ng-change="searchChanged()" line 5)
                    setSearching(true);
                  }}
                  spellCheck={false}
                />
              </div>
              {/* GIF gallery - matches AngularJS cnv-giphy.tpl.html line 7-14 */}
              <div 
                ref={galleryRef}
                className="cnv-giphy-gallary"
                onMouseUp={handleGalleryMouseUp}
              >
                {searching ? (
                  <div className="cnv-spinner light" style={{ display: 'flex', position: 'absolute', top: '50%', left: '50%', margin: 0, marginLeft: '-12px', marginTop: '-12px' }}>
                    <i className="cnv-circle-spinner-small" />
                  </div>
                ) : gifs.length === 0 ? (
                  <div className="not-found">No GIFs found</div>
                ) : (
                  <ul>
                    {gifs.map((gif, index) => (
                      <li key={index}>
                        <img
                          className="lazy"
                          src={gif.thumbnail}
                          data-original={gif.src}
                          data-thumbnail={gif.thumbnail}
                          alt="GIF"
                          onClick={() => handleGifClick(gif)}
                          onMouseEnter={(e) => {
                            // Lazy load: switch to animated version on hover
                            const img = e.currentTarget;
                            if (img.dataset.original && img.src !== img.dataset.original) {
                              img.src = img.dataset.original;
                            }
                          }}
                          onMouseLeave={(e) => {
                            // Switch back to thumbnail when not hovering
                            const img = e.currentTarget;
                            if (img.dataset.thumbnail && img.src !== img.dataset.thumbnail) {
                              img.src = img.dataset.thumbnail;
                            }
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Branding - matches AngularJS cnv-giphy.tpl.html line 17 */}
              <div className="cnv-giphy-branding" />
            </div>
          </div>
        </div>,
        document.body // Render to body like emoji picker (matches AngularJS popover-append-to-body='true')
      )}
    </>
  );
}
