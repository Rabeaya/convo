'use client';

/**
 * Comment Editor Component
 * 
 * Matches AngularJS cnv-comment-editor directive exactly
 * Handles posting comments with exact UI match
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { commentsService } from '@/lib/api/comments';
import MentionAutocomplete from './MentionAutocomplete';
import type { UserListItem } from '@/lib/hooks/use-users';

interface CommentEditorProps {
  resourceId: string;
  appInstanceId: number;
  feedId?: string | null;
  resourceType?: string;
  hierarchy?: Array<{ 
    uid?: string; 
    type?: string; 
    title?: string;
    created_by?: string;
    version?: string;
    [key: string]: any;
  }>;
  // Matches AngularJS commentsService.postComment replyEventData
  replyEventData?: { citem_uid: string; from_user: string } | null;
  // Matches AngularJS commentEditorCtrl.snippetData wrapper (for text selection snippets)
  snippetData?: any | null;
  // Matches AngularJS collaborationInfo (used for snippet replies and normal replies)
  collaborationInfo?: { replied_to_comment_id?: string; replied_to_user_id?: string; parent_resource_index?: number } | null;
  onSnippetCleared?: () => void;
  onReplyContextCleared?: () => void;
  onCommentWillPost?: (optimisticComment: any) => void;
  onCommentPostFailed?: (conversationUID: string, error: unknown) => void;
  onCommentPosted?: (comment: any) => void;
  relatedPermissions?: {
    canComment: boolean;
    block?: boolean;
  };
}

const CommentEditor = React.forwardRef<{ activate: (initialText: string) => void }, CommentEditorProps>(
  function CommentEditor({ 
    resourceId, 
    appInstanceId, 
    feedId,
    resourceType = '',
    hierarchy,
    replyEventData,
    snippetData,
    collaborationInfo,
    onSnippetCleared,
    onReplyContextCleared,
    onCommentWillPost,
    onCommentPostFailed,
    onCommentPosted,
    relatedPermissions = { canComment: true }
  }, ref) {
    const { user, loginData, account } = useAuthStore();
    const [active, setActive] = useState(false);
    const [focused, setFocused] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // @mention state
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);

    // Expose activate method via ref (matches AngularJS commentEditorCtrl.activate)
    React.useImperativeHandle(ref, () => ({
      activate: (initialText: string = '') => {
        setActive(true);
        if (initialText) {
          // Strip HTML tags for plain text input (simplified - AngularJS uses Quill editor)
          const textOnly = initialText.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
          setCommentText(textOnly);
        }
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 50);
      }
    }));

  const handleDummyTextAreaClick = () => {
    setActive(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleFocus = () => {
    setFocused(true);
  };

  const handleBlur = () => {
    setFocused(false);
    // Keep active if there's text
    if (!commentText.trim()) {
      setActive(false);
    }
  };

  // Handle @mention detection and autocomplete
  // Matches AngularJS Quill mention plugin: triggers on '@' delimiter
  const handleTextChange = useCallback((newText: string, cursorPosition?: number) => {
    setCommentText(newText);
    
    // Detect @mention trigger (matches Quill mention plugin behavior)
    const pos = cursorPosition !== undefined ? cursorPosition : textareaRef.current?.selectionStart || newText.length;
    const textBeforeCursor = newText.substring(0, pos);
    
    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Check if @ is at start or preceded by space/newline (valid mention trigger)
      const isValidTrigger = lastAtIndex === 0 || 
                             textBeforeCursor[lastAtIndex - 1] === ' ' || 
                             textBeforeCursor[lastAtIndex - 1] === '\n';
      
      if (isValidTrigger) {
        // Get text after @
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        // Check if there's a space or newline (meaning @mention is complete/invalid)
        const hasSpaceOrNewline = textAfterAt.includes(' ') || textAfterAt.includes('\n');
        
        if (!hasSpaceOrNewline) {
          // Show mention autocomplete (matches Quill mention plugin source function)
          const query = textAfterAt.trim();
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setShowMentions(true);
          
          // Calculate dropdown position relative to textarea
          if (textareaRef.current) {
            const textarea = textareaRef.current;
            const rect = textarea.getBoundingClientRect();
            const scrollTop = textarea.scrollTop;
            
            // Get cursor position in textarea
            const textBeforeMention = textBeforeCursor.substring(0, lastAtIndex);
            
            // Create a temporary span to measure text width (for horizontal position)
            const measureSpan = document.createElement('span');
            measureSpan.style.visibility = 'hidden';
            measureSpan.style.position = 'absolute';
            measureSpan.style.whiteSpace = 'pre-wrap';
            measureSpan.style.font = window.getComputedStyle(textarea).font;
            measureSpan.style.fontSize = window.getComputedStyle(textarea).fontSize;
            measureSpan.style.fontFamily = window.getComputedStyle(textarea).fontFamily;
            measureSpan.style.lineHeight = window.getComputedStyle(textarea).lineHeight;
            measureSpan.style.padding = window.getComputedStyle(textarea).padding;
            measureSpan.style.width = window.getComputedStyle(textarea).width;
            measureSpan.textContent = textBeforeMention;
            document.body.appendChild(measureSpan);
            
            const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 23;
            const lines = textBeforeMention.split('\n').length - 1;
            
            // Calculate position (matches Quill mention dropdown positioning)
            const top = rect.top + (lines * lineHeight) + lineHeight + scrollTop + window.scrollY;
            const left = rect.left + parseInt(window.getComputedStyle(textarea).paddingLeft) + 
                        (measureSpan.offsetWidth || 0);
            
            document.body.removeChild(measureSpan);
            
            setMentionPosition({ top, left });
          }
        } else {
          // Space or newline after @, hide mentions
          setShowMentions(false);
        }
      } else {
        // Invalid trigger (not at start or after space), hide mentions
        setShowMentions(false);
      }
    } else {
      // No @ found, hide mentions
      setShowMentions(false);
    }
  }, []);

  const handleMentionSelect = useCallback((item: UserListItem) => {
    if (mentionStartIndex === -1) return;
    
    const textBefore = commentText.substring(0, mentionStartIndex);
    const textAfter = commentText.substring(textareaRef.current?.selectionStart || commentText.length);
    const newText = `${textBefore}@${item.label} ${textAfter}`;
    
    setCommentText(newText);
    setShowMentions(false);
    setMentionStartIndex(-1);
    setMentionQuery('');
    
    // Set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartIndex + item.label.length + 2; // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  }, [commentText, mentionStartIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If mentions dropdown is open, let it handle navigation
    if (showMentions && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape')) {
      return; // Let MentionAutocomplete handle these
    }
    
    // Submit on Enter (but allow Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePostComment();
    }
    // Close on Escape
    if (e.key === 'Escape') {
      setActive(false);
      setCommentText('');
      setFocused(false);
      setShowMentions(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || isPosting || !loginData || !user || !account) {
      return;
    }

    const userId = (user as any).user_id || (user as any).userId;
    const accountId = (account as any).account_id;
    const authToken = loginData.xmpp_session_token;

    setIsPosting(true);

    // Generate stable conversation UID (matches AngularJS utils.generateUniqueId pattern)
    const conversationUID = `cnv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      // Optimistic comment insert (matches Angular initNewComment: immediate UI)
      if (onCommentWillPost) {
        const safeText = commentText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>');

        onCommentWillPost({
          is_posting: true,
          posting_failed: false,
          uid: conversationUID,
          citem_uid: conversationUID,
          app_instance_id: appInstanceId,
          resource_id: resourceId,
          from_user: userId,
          comment_text: `<p>${safeText}</p>`,
          creation_timestamp: Date.now(),
          update_timestamp: Date.now(),
          update_kind: 0,
          like_info: { liked_by: null, liked_by_me: false, likes_count: 0, like_timestamp: 0 },
          resource_link: {
            resource_path: null,
            collaboration_info: snippetData
              ? {
                  parent_resource_index: 0,
                  snippet_data: snippetData?.snippetData || snippetData,
                  ...(collaborationInfo || {}),
                }
              : replyEventData
                  ? {
                      parent_resource_index: 0,
                      replied_to_comment_id: replyEventData.citem_uid,
                      replied_to_user_id: replyEventData.from_user,
                    }
                  : { parent_resource_index: 0 },
          },
        });
      }

      const response = await commentsService.postComment(
        // AngularJS posts HTML from Quill; we emulate minimal HTML wrapper for parity.
        `<p>${commentText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>')}</p>`,
        feedId || null,
        resourceId,
        resourceType,
        appInstanceId,
        false, // attachContext
        snippetData || null, // snippetData wrapper
        null, // onCommentAttachment
        null, // attachedFiles
        null, // link
        authToken,
        userId,
        accountId,
                   hierarchy, // Pass hierarchy for resource_path construction
                   collaborationInfo || null, // collaborationInfo (snippet + reply)
                   replyEventData || null, // replyEventData (non-snippet reply)
                   conversationUID
      );

      if (response.data) {
        // Clear the editor
        setCommentText('');
        setActive(false);
        setFocused(false);
                   if (onReplyContextCleared) {
                     onReplyContextCleared();
                   }
                   if (snippetData && onSnippetCleared) {
                     onSnippetCleared();
                   }

        // Notify parent
        if (onCommentPosted) {
          onCommentPosted(response.data);
        }
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      if (onCommentPostFailed) {
        onCommentPostFailed(conversationUID, error);
      }
      // Keep the text so user can retry
    } finally {
      setIsPosting(false);
    }
  };

  // Check if commenting is closed
  const checkIfCommentingClosed = () => {
    return relatedPermissions.block || !relatedPermissions.canComment;
  };

  if (checkIfCommentingClosed()) {
    return (
      <div className="comments-closed-alert" style={{
        margin: '0px',
        padding: '0px 8px 0px 8px',
        color: '#7b8386',
        fontSize: '14px',
      }}>
        <i className="flag" style={{
          width: '9px',
          height: '12px',
          background: 'url(/assets/img/common/NoteFeedComment.png)',
          backgroundSize: '9px 12px',
          marginRight: '4px',
          display: 'inline-block',
        }}></i>
        <span>Comments are closed</span>
      </div>
    );
  }

  return (
    <div 
      className={`feed-comment-editor-cont ${focused && active ? 'highlight' : ''}`}
      style={{
        borderRadius: '4px',
        background: 'white',
        border: `1px solid ${focused && active ? 'rgb(51, 113, 189)' : '#ced2dc'}`,
        position: 'relative',
      }}
    >
      {/* Dummy Text Area - Shows when not active */}
      {!active && (
        <div 
          className="dummy-text-area" 
          onClick={handleDummyTextAreaClick}
          style={{
            borderRadius: '4px',
            padding: '10px',
            height: '40px',
            cursor: 'text',
            color: '#BFC3C4',
            fontSize: '14px',
            lineHeight: '20px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          Add a comment...
        </div>
      )}

      {/* Active Editor - Shows when active */}
      {active && (
        <div className="feed-comment-editor-active-cont edit-mode" style={{
          borderRadius: '4px',
          position: 'relative',
        }}>
          {/* Loading Overlay */}
          {isPosting && (
            <div className="dummy-sharing-overlay" style={{
              position: 'absolute',
              top: 0,
              bottom: '-40px',
              left: 0,
              right: 0,
              background: 'rgba(226, 232, 237, 0.45)',
              borderRadius: '4px',
              textAlign: 'center',
              zIndex: 1,
            }}>
              <span className="cnv-spinner" style={{
                border: '2px solid #e1e1e1',
                borderTop: '2px solid #aaa',
                width: '20px',
                height: '20px',
                margin: 'auto',
                top: '50%',
                left: '50%',
                marginLeft: '-10px',
                position: 'absolute',
                marginTop: '-10px',
                display: 'inline-block',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}></span>
            </div>
          )}

          {/* Snippet preview (Angular: cnvCommentEditor.tpl.html .note-snippet) */}
          {snippetData && (
            <div className="note-snippet">
              <div className={`content ${snippetData.classes || 'comment_snippet'}`}>
                <span>
                  {String(
                    snippetData?.snippetData?.data?.text ||
                      snippetData?.data?.text ||
                      ''
                  ).slice(0, 100)}
                </span>
                <i
                  className="cross"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSnippetCleared?.();
                  }}
                ></i>
              </div>
            </div>
          )}

          {/* Text Editor */}
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => {
              const newValue = e.target.value;
              const cursorPos = e.target.selectionStart;
              // Update text first
              setCommentText(newValue);
              // Then check for @mention (use setTimeout to ensure cursor position is updated)
              setTimeout(() => {
                handleTextChange(newValue, cursorPos);
              }, 0);
            }}
            onKeyUp={(e) => {
              // Also check on keyup to catch cursor movement
              const cursorPos = (e.target as HTMLTextAreaElement).selectionStart;
              handleTextChange(commentText, cursorPos);
            }}
            onSelect={(e) => {
              const cursorPos = (e.target as HTMLTextAreaElement).selectionStart;
              handleTextChange(commentText, cursorPos);
            }}
            onFocus={handleFocus}
            onBlur={(e) => {
              // Don't close mentions if clicking on dropdown
              setTimeout(() => {
                if (!document.activeElement?.closest('.mention-autocomplete-dropdown')) {
                  setShowMentions(false);
                }
              }, 200);
              handleBlur();
            }}
            onKeyDown={handleKeyDown}
            placeholder=""
            disabled={isPosting}
            style={{
              width: '100%',
              minHeight: '40px',
              maxHeight: '200px',
              padding: '10px 20px 10px 10px', // padding-right: 20px for emoji button
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: "'Source Sans Pro', sans-serif",
              fontSize: '14px',
              lineHeight: '23px', // Hardcoded for Safari emoji compatibility
              color: '#272b2c',
              backgroundColor: 'transparent',
            }}
          />

          {/* @mention Autocomplete Dropdown */}
          {showMentions && (
            <MentionAutocomplete
              query={mentionQuery}
              position={mentionPosition}
              onSelect={handleMentionSelect}
              onClose={() => setShowMentions(false)}
            />
          )}

          {/* Action Bar - Matches AngularJS exactly */}
          <div className="comment-action-bar" style={{
            position: 'relative',
            padding: '9px 8px',
            borderTop: '1px solid #ced2dc',
            borderBottom: '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {/* Emoji button - placeholder for now */}
            <span 
              className="comment-action cnv-icons-18" 
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                verticalAlign: 'middle',
                display: 'inline-block',
                width: '18px',
                height: '18px',
                opacity: 0.85,
                marginRight: '4px',
              }}
            ></span>

            {/* Attach button - matches AngularJS icons2_Attach-darkgray */}
            <span 
              className="comment-action anim file-chooser icons2_Attach-darkgray cnv-icons-18" 
              style={{
                textAlign: 'center',
                cursor: 'pointer',
                backgroundSize: '16px',
                backgroundPosition: '2px 2px',
                backgroundRepeat: 'no-repeat',
                verticalAlign: 'middle',
                display: 'inline-block',
                width: '18px',
                height: '18px',
                opacity: 0.85,
                marginRight: '4px',
                transition: 'transform 125ms cubic-bezier(0.4, 0, 1, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            ></span>
          </div>
        </div>
      )}
    </div>
  );
  }
);

export default CommentEditor;
