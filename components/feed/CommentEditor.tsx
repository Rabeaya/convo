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
import { limitHtmlText } from '@/lib/utils/html-truncate';

declare global {
  interface Window {
    Dropbox?: any;
    BoxSelect?: any;
    gapi?: any;
    google?: any;
  }
}

interface CommentEditorProps {
  resourceId: string;
  appInstanceId: number;
  feedId?: string | null;
  resourceType?: string;
  mode?: 'create' | 'edit';
  commentToEdit?: any | null;
  onCancelEdit?: () => void;
  onCommentEdited?: (updatedComment: any) => void;
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
    mode = 'create',
    commentToEdit = null,
    onCancelEdit,
    onCommentEdited,
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
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(false);
    const [focused, setFocused] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [mentionSpans, setMentionSpans] = useState<Array<{ start: number; end: number; item: UserListItem }>>([]);
    const [attachedGifs, setAttachedGifs] = useState<string[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGiphy, setShowGiphy] = useState(false);
    const [giphyQuery, setGiphyQuery] = useState('');
    const [giphyResults, setGiphyResults] = useState<Array<{ id: string; preview: string; original: string }>>([]);
    const giphyApiKey = 'xTiTnI9GNUe8rosXMQ'; // from Angular cnv-giphy.js

    const [attachedFiles, setAttachedFiles] = useState<Array<{
      localId: string;
      name: string;
      size: number;
      type: string;
      source: 'LOCAL' | 'DROPBOX' | 'BOX' | 'GOOGLE_DRIVE';
      status: 'waiting' | 'uploading' | 'converting' | 'success' | 'failed';
      localPreviewUrl?: string;
      serverFileId?: string; // backend file_id
      fileNameId?: string; // guid used in file_upload_name (Angular: file_name_id)
      serverFileObj?: any; // optional raw server file object
      file_url?: string;
      file_access_token?: string | null;
      file_preview_url?: string | null;
    }>>([]);
    const [localSnippetData, setLocalSnippetData] = useState<any | null>(snippetData || null);
    const [attachContext, setAttachContext] = useState<boolean>(true);

    const parseMentionFromHref = useCallback((href: string): { type: 'USER' | 'GROUP'; id: string } | null => {
      const raw = String(href || '');
      const s = raw.startsWith('convo:') ? raw.slice('convo:'.length) : raw;
      // Look for "user:<id>" / "group:<id>" anywhere in the string (Angular uses idToFilterUrl -> convo:<...filter=user:ID...>)
      const m = s.match(/\b(user|group)\s*:\s*([A-Za-z0-9_-]+)\b/i);
      if (m) {
        return { type: m[1].toUpperCase() === 'GROUP' ? 'GROUP' : 'USER', id: String(m[2]) };
      }
      // Also support our React links: #/feed?filter=user:ID
      const m2 = s.match(/filter=(user|group):([A-Za-z0-9_-]+)/i);
      if (m2) {
        return { type: m2[1].toUpperCase() === 'GROUP' ? 'GROUP' : 'USER', id: String(m2[2]) };
      }
      return null;
    }, []);

    const parseCommentHtmlForEditor = useCallback((html: string): { text: string; spans: Array<{ start: number; end: number; item: UserListItem }> } => {
      // Best-effort mirror of Angular Quill editor initialHtmlText:
      // - Preserve line breaks
      // - Preserve @mention anchors by converting them to "@Label" AND seeding mentionSpans so we can rebuild links on submit.
      const spans: Array<{ start: number; end: number; item: UserListItem }> = [];
      if (typeof document === 'undefined') {
        const txt = String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        return { text: txt, spans };
      }
      const container = document.createElement('div');
      container.innerHTML = String(html || '');

      let out = '';
      const append = (s: string) => { out += s; };

      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          append((node.textContent || '').replace(/\u00a0/g, ' '));
          return;
        }
        if (!(node instanceof HTMLElement)) return;

        const tag = node.tagName.toUpperCase();
        if (tag === 'BR') {
          append('\n');
          return;
        }
        if (tag === 'A') {
          const a = node as HTMLAnchorElement;
          const labelRaw = (a.textContent || '').trim().replace(/\u00a0/g, ' ');
          const href = a.getAttribute('href') || '';
          const parsed = parseMentionFromHref(href);
          if (parsed && labelRaw.startsWith('@')) {
            const start = out.length;
            append(labelRaw);
            const end = out.length;
            spans.push({
              start,
              end,
              item: {
                id: parsed.id,
                type: parsed.type,
                label: labelRaw.replace(/^@/, ''),
              },
            });
          } else {
            append(labelRaw);
          }
          return;
        }
        // Block-ish elements: keep their content and add a newline at the end (Quill-like)
        if (tag === 'P' || tag === 'DIV') {
          Array.from(node.childNodes).forEach(walk);
          append('\n');
          return;
        }
        Array.from(node.childNodes).forEach(walk);
      };

      Array.from(container.childNodes).forEach(walk);

      // Clean up: collapse extra newlines, trim end.
      out = out
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\n+/, '')
        .replace(/\n+$/, '');

      return { text: out, spans };
    }, [parseMentionFromHref]);

    const normalizeCommentHtmlForServer = useCallback((html: string): string => {
      let s = String(html || '');
      // Normalize BR variants
      s = s.replace(/<br\s*\/?>/gi, '<br>');
      // Angular cnvComment.js before updateComment/postComment:
      // commentHtmlText.replace(/<p>&#160;<\/p>|<p>&nbsp;<\/p>|\n/g, "<br>").replace(/^(<br>)*|(<br>)*$/g, '');
      s = s.replace(/<p>&#160;<\/p>|<p>&nbsp;<\/p>|\n/g, '<br>');
      s = s.replace(/^(<br>)*|(<br>)*$/g, '');
      return s;
    }, []);

    useEffect(() => {
      setLocalSnippetData(snippetData || null);
    }, [snippetData]);

    useEffect(() => {
      // In edit mode, attachContext should remain true only when snippet exists or comment already has collaboration_info.
      if (mode === 'edit') {
        const hasOrigCollab = !!commentToEdit?.resource_link?.collaboration_info;
        const hasSnippet = !!localSnippetData;
        setAttachContext(Boolean(hasOrigCollab || hasSnippet));
      }
    }, [mode, commentToEdit, localSnippetData]);

    // Seed editor with existing comment text + attachments when editing
    useEffect(() => {
      if (mode !== 'edit' || !commentToEdit) return;
      setActive(true);
      setFocused(true);

      const html = String(commentToEdit.comment_text || '');
      const parsed = parseCommentHtmlForEditor(html);
      setCommentText(parsed.text);
      setMentionSpans(parsed.spans);

      // Preserve existing files (Angular: initWithFiles(files) + inEdit=true)
      const existingFiles = Array.isArray(commentToEdit.files) ? commentToEdit.files : [];
      if (existingFiles.length) {
        const seeded = existingFiles.map((f: any, idx: number) => {
          const originalName = String(f.original_name || '');
          const nameIdFromOriginal = originalName.includes('.') ? originalName.split('.')[0] : undefined;
          return {
            localId: `existing_${commentToEdit.uid}_${idx}`,
            name: String(f.name || f.title || originalName || 'file'),
            size: Number(f.size || 1),
            type: String(f.type || (f.name ? String(f.name).split('.').pop() : '') || '').toLowerCase(),
            source: 'LOCAL' as const,
            status: 'success' as const,
            localPreviewUrl: f.thumbnail_name ? undefined : undefined,
            serverFileId: f.file_id ? String(f.file_id) : undefined,
            fileNameId: nameIdFromOriginal,
            serverFileObj: f,
            file_url: null,
            file_access_token: null,
            file_preview_url: null,
          };
        });
        setAttachedFiles(seeded);
      } else {
        setAttachedFiles([]);
      }
    }, [mode, commentToEdit]);


    const fileInputRef = useRef<HTMLInputElement>(null);
    
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
          const parsed = parseCommentHtmlForEditor(initialText);
          setCommentText(parsed.text);
          setMentionSpans(parsed.spans);
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

  const handleBlur = (e?: React.FocusEvent) => {
    setFocused(false);

    // Important: clicking toolbar buttons should NOT deactivate the editor.
    // If focus moved within the editor container, keep it active (Angular behavior).
    const next = (e?.relatedTarget as HTMLElement | null) || (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);
    if (next && editorContainerRef.current?.contains(next)) {
      return;
    }

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
    // Track the mention span so we can convert to a scrybe link on submit (Angular stores as rich text).
    const start = mentionStartIndex;
    const end = mentionStartIndex + 1 + item.label.length; // '@' + label
    setMentionSpans((prev) => [...prev, { start, end, item }]);
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

  const buildCommentHtml = useCallback((): string => {
    // Start from plain text and convert to HTML like Angular Quill output (minimal)
    let text = commentText || '';

    // Convert mentions to scrybe links using stored spans (best effort)
    const spans = [...mentionSpans].sort((a, b) => b.start - a.start);
    for (const m of spans) {
      const expected = `@${m.item.label}`;
      let start = m.start;
      let end = m.end;
      if (text.slice(start, end) !== expected) {
        // Fallback: find occurrence
        const idx = text.indexOf(expected);
        if (idx === -1) continue;
        start = idx;
        end = idx + expected.length;
      }
      const href =
        m.item.type === 'GROUP'
          ? `#/feed?filter=group:${m.item.id}`
          : `#/feed?filter=user:${m.item.id}`;
      const linkHtml = `<a class="hover_underline cnv-mention-link" href="${href}">${expected}</a>`;
      text = text.slice(0, start) + linkHtml + text.slice(end);
    }

    // Escape remaining raw text segments that aren't already HTML.
    // We keep it simple by assuming only the mention links above introduce tags.
    const placeholderToken = '__CNV_MENTION_ANCHOR__';
    const anchors: string[] = [];
    text = text.replace(/<a[^>]*>.*?<\/a>/g, (m) => {
      anchors.push(m);
      return `${placeholderToken}${anchors.length - 1}${placeholderToken}`;
    });
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    text = text.replace(new RegExp(`${placeholderToken}(\\d+)${placeholderToken}`, 'g'), (_, i) => anchors[Number(i)] || '');

    // Append GIFs as inline images (best-effort parity with Angular giphy attachment)
    if (attachedGifs.length) {
      const imgs = attachedGifs
        .map((u) => `<div class="cnv-giphy-inline"><img src="${u}" style="max-height:90px; border:1px solid #d2d2d2;" /></div>`)
        .join('');
      text += `<br/>${imgs}`;
    }

    return normalizeCommentHtmlForServer(`<p>${text}</p>`);
  }, [commentText, mentionSpans, attachedGifs, normalizeCommentHtmlForServer]);

  const getFileStorageInfo = useCallback(() => {
    const info: any = (loginData as any)?.file_storage_info;
    const defaultType: string | undefined = info?.default_type || info?.defaultType;
    const data =
      (defaultType ? info?.data?.[defaultType] : null) ||
      (defaultType ? info?.[defaultType] : null) ||
      info?.data ||
      null;
    return { defaultType, data };
  }, [loginData]);

  const getS3BucketUrl = useCallback(() => {
    const { defaultType, data } = getFileStorageInfo();
    if (!defaultType || defaultType.toLowerCase() !== 's3' || !data) return null;
    const bucketName = data.bucket_name;
    const httpsUploads = !!data.https_uploads;
    if (!bucketName) return null;
    return `${httpsUploads ? 'https' : 'http'}://${bucketName}.s3.amazonaws.com/`;
  }, [getFileStorageInfo]);

  const getFileUploadPath = useCallback((fileUploadName: string) => {
    // Angular UploadService.getFileUploadPath:
    // if appInstanceId != -1 (or in 4/6/23) => accountId/attachments/{fileUploadName}
    const accountId = (loginData as any)?.account_id?.toString() || account?.account_id?.toString() || '';
    const dir = 'attachments';
    return `${accountId}/${dir}/${fileUploadName}`;
  }, [loginData, account]);

  const postFilesEndpoint = useCallback(async (payload: any) => {
    const res = await fetch('/api/v1/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = { error: text }; }
    if (!res.ok) {
      throw new Error(json?.error || json?.message || `Files request failed: ${res.status}`);
    }
    return json;
  }, []);

  const pollFileConversionStatus = useCallback(async (fileIds: string[]) => {
    // Angular: POST "files" with converting_file_ids: "1,2,3"
    const ids = fileIds.filter(Boolean);
    if (!ids.length) return;

    let pending = new Set(ids);
    for (let attempt = 0; attempt < 40 && pending.size; attempt++) {
      const resp = await postFilesEndpoint({ converting_file_ids: Array.from(pending).join() });
      const statusArr: any[] = resp?.data?.files_status || resp?.files_status || [];
      const nextPending = new Set<string>();

      for (const st of statusArr) {
        const id = String(st.file_id);
        const status = String(st.status || '').toLowerCase();
        if (status === 'success') {
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.serverFileId === id
                ? { ...f, status: 'success', serverFileObj: st }
                : f
            )
          );
        } else if (status === 'converting') {
          nextPending.add(id);
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.serverFileId === id && f.status !== 'success'
                ? { ...f, status: 'converting' }
                : f
            )
          );
        } else {
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.serverFileId === id
                ? { ...f, status: 'failed' }
                : f
            )
          );
        }
      }

      pending = nextPending;
      if (pending.size) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }, [postFilesEndpoint]);

  const startRemoteFileConversion = useCallback(async (opts: {
    source: 'DROPBOX' | 'BOX' | 'GOOGLE_DRIVE';
    name: string;
    size: number;
    link: string;
    fileAccessToken?: string;
    previewUrl?: string;
    thumbnailUrl?: string;
  }) => {
    const ext = (opts.name.split('.').pop() || '').toLowerCase();
    const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileGuid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
    const fileUploadName = `${fileGuid}.${ext || 'bin'}`;

    setAttachedFiles((prev) => [
      ...prev,
      {
        localId,
        name: opts.name,
        size: opts.size || 1,
        type: ext || 'bin',
        source: opts.source,
        status: 'converting',
        localPreviewUrl: opts.thumbnailUrl,
        fileNameId: fileGuid,
        file_url: opts.link,
        file_access_token: opts.fileAccessToken || null,
        file_preview_url: opts.previewUrl || null,
      },
    ]);

    const req = {
      file: {
        item_id: resourceId,
        name: opts.name,
        file_upload_name: fileUploadName,
        type: ext || 'bin',
        size: opts.size || 1,
        file_url: opts.link,
        file_source: opts.source,
        file_access_token: opts.fileAccessToken || null,
        file_preview_url: opts.previewUrl || null,
        storage_version: 1,
        app_instance_id: Number(appInstanceId),
      },
    };

    const resp = await postFilesEndpoint(req);
    const fileObj = resp?.data?.file || resp?.file;
    const serverFileId = fileObj?.file_id ? String(fileObj.file_id) : undefined;
    const status = String(fileObj?.status || '').toLowerCase();

    setAttachedFiles((prev) =>
      prev.map((f) =>
        f.localId === localId
          ? { ...f, serverFileId, serverFileObj: fileObj, status: status === 'success' ? 'success' : 'converting' }
          : f
      )
    );

    if (serverFileId && status !== 'success') {
      await pollFileConversionStatus([serverFileId]);
    }
  }, [resourceId, appInstanceId, postFilesEndpoint, pollFileConversionStatus]);

  const uploadLocalFileAndConvert = useCallback(async (file: File) => {
    const max = 20971520; // 20MB (Angular UploadService.UPLOAD_FILE_LIMIT)
    if (file.size > max) {
      throw new Error(`The ${file.name} file exceeds the 20 MB attachment limit.`);
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileGuid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
    const fileUploadName = `${fileGuid}.${ext || 'bin'}`;
    const bucketUrl = getS3BucketUrl();
    const { defaultType, data } = getFileStorageInfo();

    const localPreviewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

    setAttachedFiles((prev) => [
      ...prev,
      {
        localId,
        name: file.name,
        size: file.size || 1,
        type: ext || 'bin',
        source: 'LOCAL',
        status: 'uploading',
        localPreviewUrl,
        fileNameId: fileGuid,
      },
    ]);

    if (!defaultType || defaultType.toLowerCase() !== 's3' || !bucketUrl || !data) {
      throw new Error('File storage is not configured for S3 uploads in this environment.');
    }

    const keyPath = getFileUploadPath(fileUploadName);

    // Upload to S3 (Angular awsService.submitFormData)
    const form = new FormData();
    form.append('AWSAccessKeyId', data.access_key);
    form.append('acl', 'private');
    form.append('policy', data.s3_policy);
    form.append('Filename', fileUploadName);
    form.append('signature', data.s3_signature);
    form.append('success_action_status', '201');
    form.append('Content-Type', file.type || 'application/octet-stream');
    form.append('key', keyPath);
    form.append('x-amz-server-side-encryption', 'AES256');
    form.append('file', file);

    const s3Res = await fetch(bucketUrl, { method: 'POST', body: form });
    if (!s3Res.ok) {
      throw new Error(`S3 upload failed: ${s3Res.status}`);
    }

    const file_url = `${bucketUrl}${keyPath}`;

    // Start conversion on backend (Angular UploadService.fileConversionReq)
    setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'converting', file_url } : f)));

    const req = {
      file: {
        item_id: resourceId,
        name: file.name,
        file_upload_name: fileUploadName,
        type: ext || 'bin',
        size: file.size || 1,
        file_url,
        file_source: null,
        file_access_token: null,
        file_preview_url: null,
        storage_version: 1,
        app_instance_id: Number(appInstanceId),
      },
    };

    const resp = await postFilesEndpoint(req);
    const fileObj = resp?.data?.file || resp?.file;
    const serverFileId = fileObj?.file_id ? String(fileObj.file_id) : undefined;
    const status = String(fileObj?.status || '').toLowerCase();

    setAttachedFiles((prev) =>
      prev.map((f) =>
        f.localId === localId
          ? { ...f, serverFileId, serverFileObj: fileObj, status: status === 'success' ? 'success' : 'converting' }
          : f
      )
    );

    if (serverFileId && status !== 'success') {
      await pollFileConversionStatus([serverFileId]);
    }
  }, [resourceId, appInstanceId, getFileStorageInfo, getS3BucketUrl, getFileUploadPath, postFilesEndpoint, pollFileConversionStatus]);

  const insertAtCursor = useCallback((insertText: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? commentText.length;
    const end = el.selectionEnd ?? commentText.length;
    const next = commentText.slice(0, start) + insertText + commentText.slice(end);
    setCommentText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insertText.length;
      el.setSelectionRange(pos, pos);
    });
  }, [commentText]);

  const fetchGiphy = useCallback(async (q: string) => {
    const query = q.trim();
    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&rating=pg&limit=24`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&rating=pg&limit=24`;
    const res = await fetch(url);
    const json = await res.json();
    const items = (json?.data || []).map((g: any) => ({
      id: String(g.id),
      preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url || g.images?.original?.url,
      original: g.images?.original?.url || g.images?.fixed_width?.url,
    }));
    setGiphyResults(items.filter((x: any) => x.preview && x.original));
  }, []);

  useEffect(() => {
    if (!showGiphy) return;
    fetchGiphy(giphyQuery).catch(() => setGiphyResults([]));
  }, [showGiphy, giphyQuery, fetchGiphy]);

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
      if (mode === 'edit') {
        onCancelEdit?.();
      } else {
        setActive(false);
        setCommentText('');
        setFocused(false);
        setShowMentions(false);
      }
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
      const htmlToPost = buildCommentHtml();

      // Optimistic comment insert (matches Angular initNewComment: immediate UI)
      if (onCommentWillPost) {
        onCommentWillPost({
          is_posting: true,
          posting_failed: false,
          uid: conversationUID,
          citem_uid: conversationUID,
          app_instance_id: appInstanceId,
          resource_id: resourceId,
          from_user: userId,
          comment_text: htmlToPost,
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

      const filesPayload =
        attachedFiles.filter((f) => f.status === 'success').length > 0
          ? {
              serverData: attachedFiles
                .filter((f) => f.status === 'success')
                .map((f) => ({
                  name: f.name,
                  size: f.size,
                  type: f.type,
                  file_name_id: f.fileNameId,
                  file_id: f.serverFileId,
                }))
                .filter((x) => x.file_id || x.file_name_id),
              data: [],
            }
          : null;

      if (mode === 'edit') {
        if (!commentToEdit) return;

        const editResp = await commentsService.editComment(
          commentToEdit.uid,
          commentToEdit.citem_uid,
          htmlToPost,
          resourceId,
          appInstanceId,
          attachContext,
          localSnippetData ? (localSnippetData.snippetData || localSnippetData) : null,
          commentToEdit?.resource_link?.collaboration_info?.on_comment_attachment || null,
          filesPayload,
          commentToEdit?.links?.length ? { url_to_resolve: commentToEdit.links[0].source, user_dismissed_resolved_url: false } : null,
          commentToEdit
        );

        const payload: any = (editResp as any)?.data ?? editResp;
        const serverTs =
          payload?.time_stamp ??
          payload?.timeStamp ??
          payload?.data?.time_stamp ??
          payload?.data?.timeStamp ??
          payload?.data?.data?.time_stamp ??
          payload?.data?.data?.timeStamp;

        const serverSummary =
          payload?.summary ??
          payload?.data?.summary ??
          payload?.data?.data?.summary;

        // Keep truncation fields consistent for edited comments (Angular generates these for optimistic comments).
        const less300 = limitHtmlText(htmlToPost || '', 300, true) as any;
        const less130 = limitHtmlText(htmlToPost || '', 130, true) as any;
        const hasMoreText = !!less300?.isTruncated;
        const hasMoreTextSnippet = !!less130?.isTruncated;
        const updated = {
          ...commentToEdit,
          comment_text: htmlToPost,
          update_kind: 1,
          update_timestamp: serverTs || Date.now(),
          summary: serverSummary ?? commentToEdit.summary,
          comment_text_less: hasMoreText ? less300.htmlStr : null,
          has_more_text: hasMoreText,
          comment_text_less_snippet: hasMoreTextSnippet ? less130.htmlStr : null,
          has_more_text_snippet: hasMoreTextSnippet,
        };

        onCommentEdited?.(updated);
        onCancelEdit?.();
        return;
      }

      const response = await commentsService.postComment(
        // AngularJS posts HTML from Quill; we emulate minimal HTML wrapper for parity.
        htmlToPost,
        feedId || null,
        resourceId,
        resourceType,
        appInstanceId,
        false, // attachContext
        localSnippetData || null, // snippetData wrapper
        null, // onCommentAttachment
        filesPayload,
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
        setMentionSpans([]);
        setAttachedGifs([]);
        setAttachedFiles([]);
        setActive(false);
        setFocused(false);
                   if (onReplyContextCleared) {
                     onReplyContextCleared();
                   }
                   if (localSnippetData && onSnippetCleared) {
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
      ref={editorContainerRef}
      style={{
        borderRadius: '4px',
        background: 'white',
        border: `1px solid ${focused && active ? 'rgb(51, 113, 189)' : '#ced2dc'}`,
        position: 'relative',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          // reset so selecting same file again works
          e.currentTarget.value = '';
          for (const f of files) {
            try {
              await uploadLocalFileAndConvert(f);
            } catch (err) {
              console.error(err);
              // eslint-disable-next-line no-alert
              alert(err instanceof Error ? err.message : 'Failed to attach file');
            }
          }
        }}
      />
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
          {localSnippetData && (
            <div className="note-snippet">
              <div className={`content ${localSnippetData.classes || 'comment_snippet'}`}>
                <span>
                  {String(
                    localSnippetData?.snippetData?.data?.text ||
                      localSnippetData?.data?.text ||
                      ''
                  ).length > 100
                    ? `${String(
                        localSnippetData?.snippetData?.data?.text ||
                          localSnippetData?.data?.text ||
                          ''
                      ).slice(0, 100)}...`
                    : String(
                        localSnippetData?.snippetData?.data?.text ||
                          localSnippetData?.data?.text ||
                          ''
                      )}
                </span>
                <i
                  className="cross"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLocalSnippetData(null);
                    setAttachContext(false);
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
              handleBlur(e);
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
            {/* Emoji */}
            <button
              type="button"
              className="comment-action anim emoji-popup-btn cnv-icons-18"
              onMouseDown={(e) => {
                // Prevent textarea blur/unmount before click fires (critical)
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => setShowEmojiPicker((v) => !v)}
              style={{
                width: '18px',
                height: '18px',
                display: 'inline-block',
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                backgroundColor: 'transparent',
              }}
              aria-label="Emoji"
            >
              <img
                src="/assets/img/Emoji-icons/Unselected/2x/emoji-hover-icon-thick-02.svg"
                alt=""
                style={{ width: '18px', height: '18px', display: 'block' }}
              />
            </button>

            {/* Attach button - matches AngularJS icons2_Attach-darkgray */}
            <button
              type="button"
              className="comment-action anim file-chooser icons2_Attach-darkgray cnv-icons-18"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                backgroundColor: 'transparent',
                opacity: 0.85,
              }}
              aria-label="Attach file"
            />

            {/* Dropbox */}
            <button
              type="button"
              className="comment-action anim cnv-icons-18 icons3_Dropbox-darkgray"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={async () => {
                try {
                  if (!window.Dropbox || !window.Dropbox.choose) {
                    // eslint-disable-next-line no-alert
                    alert('Dropbox integration script not loaded yet. Please refresh.');
                    return;
                  }
                  window.Dropbox.choose({
                    success: async (response: any[]) => {
                      for (const r of response || []) {
                        await startRemoteFileConversion({
                          source: 'DROPBOX',
                          name: r.name,
                          size: r.bytes || 1,
                          link: r.link,
                          thumbnailUrl: r.thumbnailLink,
                        });
                      }
                    },
                    cancel: function () {},
                    linkType: 'direct',
                    multiselect: true,
                  });
                } catch (e) {
                  console.error(e);
                }
              }}
              style={{
                width: '18px',
                height: '18px',
                display: 'inline-block',
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                backgroundColor: 'transparent',
                opacity: 0.85,
              }}
              aria-label="Dropbox"
            />

            {/* Box */}
            <button
              type="button"
              className="comment-action anim cnv-icons-18 Icon2__Box-15-darkgray"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={async () => {
                try {
                  if (!window.BoxSelect) {
                    // eslint-disable-next-line no-alert
                    alert('Box integration script not loaded yet. Please refresh.');
                    return;
                  }
                  const boxSelect = new window.BoxSelect({
                    clientId: 'addpyhjq1e097z9o4qcg47hmvanbhj1m', // Angular cnvBoxFilesIntegrator.js
                    linkType: 'direct',
                    multiselect: true,
                  });
                  if (!boxSelect.isBrowserSupported()) return;

                  boxSelect.success(async (response: any[]) => {
                    for (const r of response || []) {
                      await startRemoteFileConversion({
                        source: 'BOX',
                        name: r.name,
                        size: r.size || 1,
                        link: r.url,
                      });
                    }
                    boxSelect.unregister(boxSelect.SUCCESS_EVENT_TYPE);
                    boxSelect.unregister(boxSelect.CANCEL_EVENT_TYPE);
                  });
                  boxSelect.cancel(() => {
                    boxSelect.unregister(boxSelect.SUCCESS_EVENT_TYPE);
                    boxSelect.unregister(boxSelect.CANCEL_EVENT_TYPE);
                  });
                  boxSelect.launchPopup();
                } catch (e) {
                  console.error(e);
                }
              }}
              style={{
                width: '18px',
                height: '18px',
                display: 'inline-block',
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                backgroundColor: 'transparent',
                opacity: 0.85,
              }}
              aria-label="Box"
            />

            {/* Google Drive */}
            <button
              type="button"
              className="comment-action anim cnv-icons-18 icons3_Google_Drive-darkgray"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={async () => {
                try {
                  const gapi = window.gapi;
                  if (!gapi) {
                    // eslint-disable-next-line no-alert
                    alert('Google API script not loaded yet. Please refresh.');
                    return;
                  }

                  const developerKey = 'AIzaSyCOrG_hdBwyEyWPp6mLiZP-MqM2hCGOazE'; // Angular config.GOOGLE_APP_API_KEY
                  const clientId = '467218530550-q0ctnnu4v03eukht52gdu7tamdg3onut.apps.googleusercontent.com'; // Angular config.GOOGLE_APP_CLIENT_ID
                  const scope = 'https://www.googleapis.com/auth/drive.readonly';

                  await new Promise<void>((resolve) => gapi.load('client:auth2', resolve));
                  await new Promise<void>((resolve) => gapi.load('picker', { callback: resolve }));
                  await new Promise<void>((resolve) => gapi.client.load('drive', 'v2', resolve));

                  const auth2 = gapi.auth2 ? gapi.auth2.getAuthInstance() || gapi.auth2.init({ client_id: clientId, fetch_basic_profile: false, scope }) : null;
                  const signInRes = auth2 ? await auth2.signIn({ prompt: 'select_account', fetch_basic_profile: false, scope }) : null;
                  const oauthToken = auth2 ? auth2.currentUser.get().getAuthResponse(true).access_token : (signInRes?.getAuthResponse?.().access_token);

                  if (!oauthToken || !window.google?.picker) {
                    // eslint-disable-next-line no-alert
                    alert('Google Drive authorization failed.');
                    return;
                  }

                  const picker = new window.google.picker.PickerBuilder()
                    .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
                    .addView(window.google.picker.ViewId.DOCS)
                    .setOAuthToken(oauthToken)
                    .setDeveloperKey(developerKey)
                    .setCallback(async (docs: any) => {
                      if (docs[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
                        const selected = docs[window.google.picker.Response.DOCUMENTS] || [];
                        for (const doc of selected) {
                          const id = doc[window.google.picker.Document.ID];
                          const request = gapi.client.drive.files.get({ fileId: id });
                          await new Promise<void>((resolve) => {
                            request.execute(async (resp: any) => {
                              const link = resp.exportLinks?.['application/pdf'] || resp.downloadUrl;
                              const name = resp.originalFilename || resp.title || 'file';
                              const finalName = resp.exportLinks?.['application/pdf'] ? `${resp.title}.pdf` : name;
                              await startRemoteFileConversion({
                                source: 'GOOGLE_DRIVE',
                                name: finalName,
                                size: Number(resp.fileSize || 0) || 1,
                                link,
                                fileAccessToken: oauthToken,
                                previewUrl: resp.alternateLink,
                                thumbnailUrl: resp.thumbnailLink,
                              });
                              resolve();
                            });
                          });
                        }
                      }
                    })
                    .build();

                  picker.setVisible(true);
                } catch (e) {
                  console.error(e);
                }
              }}
              style={{
                width: '18px',
                height: '18px',
                display: 'inline-block',
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                backgroundColor: 'transparent',
                opacity: 0.85,
              }}
              aria-label="Google Drive"
            />

            {/* Giphy */}
            <button
              type="button"
              className="comment-action anim gif-attachment cnv-icons-18 giphy"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => setShowGiphy((v) => !v)}
              style={{
                width: '18px',
                height: '18px',
                display: 'inline-block',
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                backgroundColor: 'transparent',
                opacity: 0.85,
              }}
              aria-label="GIF"
            >
              <img
                src="/assets/img/giphy/2xMouseoverClick.svg"
                alt=""
                style={{ width: '18px', height: '18px', display: 'block' }}
              />
            </button>
          </div>

          {/* Attached files preview (basic parity) */}
          {attachedFiles.length > 0 && (
            <div style={{ padding: '8px 10px 0px 10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {attachedFiles.map((f) => (
                <div key={f.localId} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #dde2ea', borderRadius: '3px', padding: '4px 6px', background: '#fff' }}>
                  {f.localPreviewUrl ? (
                    <img src={f.localPreviewUrl} style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '3px' }} />
                  ) : (
                    <span className="cnv-icons-18 fileplainlarge-darkgray" />
                  )}
                  <span style={{ fontSize: '12px', color: '#2b2b2b', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: '11px', color: '#7b8386' }}>
                    {f.status === 'success' ? 'Ready' : f.status === 'failed' ? 'Failed' : f.status}
                  </span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setAttachedFiles((prev) => prev.filter((x) => x.localId !== f.localId));
                    }}
                    style={{ color: 'rgb(51, 113, 189)', textDecoration: 'none', fontSize: '12px' }}
                  >
                    Remove
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Emoji picker (minimal) */}
          {showEmojiPicker && (
            <div style={{ position: 'absolute', bottom: '44px', left: '8px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '6px', zIndex: 20 }}>
              {['😀','😁','😂','🙂','😉','😍','👍','🙏','🔥','🎉','😅','😮'].map((emo) => (
                <button key={emo} onMouseDown={(e) => e.preventDefault()} onClick={() => { insertAtCursor(emo); setShowEmojiPicker(false); }} style={{ fontSize: '18px', padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  {emo}
                </button>
              ))}
            </div>
          )}

          {/* Giphy popover (minimal) */}
          {showGiphy && (
            <div style={{ position: 'absolute', bottom: '44px', left: '60px', width: '360px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '8px', zIndex: 20 }}>
              <input value={giphyQuery} onChange={(e) => setGiphyQuery(e.target.value)} placeholder="Search GIFs" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '3px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px', maxHeight: '220px', overflow: 'auto' }}>
                {giphyResults.map((g) => (
                  <img
                    key={g.id}
                    src={g.preview}
                    style={{ width: '100%', borderRadius: '3px', cursor: 'pointer' }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setAttachedGifs((prev) => [...prev, g.original]);
                      setShowGiphy(false);
                      setGiphyQuery('');
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
  }
);

export default CommentEditor;
