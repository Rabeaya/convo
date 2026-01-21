'use client';

/**
 * MessageInput - Message composition area
 * 
 * Replicates Angular messageInputContainer
 * File: chatWindow.tpl.html lines 200-223
 * 
 * Matches AngularJS exactly:
 * - Emoji picker integration
 * - GIF picker integration
 * - File attachment handler
 * - Emoji insertion at cursor position
 */

import { useState, useRef, useCallback } from 'react';
import EmojiPicker from './EmojiPicker';
import GiphyPicker from './GiphyPicker';
import './MessageInput.css';

interface MessageInputProps {
  onSend: (message: string) => void;
  onFileSelect?: (files: FileList) => void;
  onGifSelect?: (gifUrl: string, gifData: any) => void;
  disabled?: boolean;
  placeholder?: string;
  showGiphy?: boolean; // Matches AngularJS showGiphy
}

export default function MessageInput({ 
  onSend, 
  onFileSelect,
  onGifSelect,
  disabled = false, 
  placeholder = 'Type a message...',
  showGiphy = true, // Matches AngularJS default
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Insert emoji at cursor position (matches AngularJS emoji.set line 636)
  const handleEmojiSelect = useCallback((unicode: string) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = message.substring(0, start);
    const textAfter = message.substring(end);
    
    // Insert emoji at cursor position
    const newMessage = textBefore + unicode + textAfter;
    setMessage(newMessage);
    
    // Set cursor position after inserted emoji
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + unicode.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [message]);

  // Handle GIF selection (matches AngularJS onGifSelectionFromGiphy)
  const handleGifSelect = useCallback((gifUrl: string, gifData: any) => {
    if (onGifSelect) {
      onGifSelect(gifUrl, gifData);
    } else {
      // Fallback: send GIF URL as message if no handler provided
      onSend(`[GIF: ${gifUrl}]`);
    }
  }, [onGifSelect, onSend]);

  // Handle file selection (matches AngularJS onAttachFileBtnClick line 330-344)
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (onFileSelect) {
        onFileSelect(files);
      }
    }
    // Reset input to allow selecting same file again (matches AngularJS)
    e.target.value = '';
  }, [onFileSelect]);

  // Trigger file input click (matches AngularJS onAttachFileBtnClick line 342)
  const handleAttachmentClick = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift) - matches AngularJS cnv-text-editor-submit-on-enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea (matches AngularJS editor behavior)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize textarea - matches AngularJS Quill editor auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 23), 150); // Min 23px (line-height), max 150px
    textarea.style.height = `${newHeight}px`;
  };

  return (
    <div className="messageInputContainer" style={{
      position: 'relative', // Changed from absolute to relative - parent flex handles positioning
      borderTop: '1px solid #eee', // Matches AngularJS .messageInputBar border-top
      background: '#ffffff', // Solid white background - CRITICAL for isolation
      backgroundColor: '#ffffff', // Explicitly set background color
      zIndex: 2, // Ensure input is above messages
      flexShrink: 0, // Prevent input from shrinking
    }}>
      <div className="messageInputBar">
        {/* Input field wrapper - matches AngularJS .ql-container with padding */}
        <div className="ql-container" style={{
          padding: '2px 8px 0px 8px', // Matches AngularJS .ql-container padding (line 504-506)
        }}>
          {/* Input field - 76% width, matches AngularJS line 207 */}
          <div style={{ width: '76%', display: 'inline-block', paddingTop: '4px', position: 'relative' }}>
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="messageInputField ql-editor"
            rows={1}
            style={{
              width: '100%',
              padding: '0',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: '14px',
              backgroundColor: 'transparent',
              lineHeight: '23px', // Matches AngularJS hardcoded line-height for emoji support (line 510-512)
              maxHeight: '150px',
              overflowY: 'hidden', // Matches AngularJS overflow-y: hidden !important (line 523)
              borderRadius: '3px',
              minHeight: '23px', // Matches line-height for single line
              height: '23px', // Start with single line height
              verticalAlign: 'bottom', // Matches AngularJS (line 518)
            }}
          />
            {/* Scroll hider - Matches AngularJS line 220 */}
            <div className="scrollHider" style={{
              display: disabled ? 'none' : 'block',
            }} />
          </div>
        </div>
        
        {/* Icons - Matches AngularJS lines 222-226 exactly - positioned relative to messageInputBar */}
        {/* AngularJS uses bottom positioning (bottom: 6px for emoji/attach, bottom: 4px for giphy) */}
        {/* Input has line-height: 23px, padding-top: 4px on wrapper, container padding: 2px 8px 0px 8px */}
        {/* Emoji picker - Matches AngularJS cnv-emoji-popover line 222 */}
        <div className={`emoji-action-container ${showGiphy ? '' : 'giphyDisabled'}`}>
          <EmojiPicker 
            onEmojiSelect={handleEmojiSelect}
            disabled={disabled}
          />
        </div>
        
        {/* Attach icon - Matches AngularJS chatWindow.tpl.html line 224 */}
        {/* NOTE: AngularJS does NOT have title attribute - no tooltip */}
        <div 
          className={`attachmentButton photo icons2_Attach-darkgray ${showGiphy ? '' : 'giphyDisabled'}`}
          style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : undefined, // Let CSS handle opacity for hover effect
          }}
          onClick={handleAttachmentClick}
        >
          {/* Attach icon - uses CSS class icons2_Attach-darkgray */}
        </div>
        
        {/* GIF picker - Matches AngularJS cnv-giphy-popover line 223 */}
        {/* NOTE: In small chat window, there is NO send button - only emoji, giphy, attachment */}
        {showGiphy && (
          <GiphyPicker
            onGifSelect={handleGifSelect}
            disabled={disabled}
            chatId="chatWindow"
          />
        )}
        
        {/* Hidden file input - Matches AngularJS chatWindow.tpl.html line 228 */}
        <input
          ref={fileInputRef}
          id="chatAttachment"
          name="file"
          type="file"
          multiple
          className="inputHide"
          style={{ display: 'none' }}
          disabled={disabled}
          onChange={handleFileChange}
        />
        
        {/* NOTE: Small chat window does NOT have a send button - messages are sent via Enter key */}
        {/* Send button only exists in full view chat (ChatMessageInput.tpl.html) */}
      </div>
    </div>
  );
}

