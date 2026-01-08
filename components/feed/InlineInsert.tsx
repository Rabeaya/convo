'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import UserProfileImage from '@/components/common/UserProfileImage';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUsers } from '@/lib/hooks/use-users';
import { useGroups } from '@/lib/hooks/use-groups';
import { useGeneralSettings } from '@/lib/hooks/use-settings';

declare global {
  interface Window {
    Quill?: any;
  }
}

type ShareWithType = 'USER' | 'GROUP' | 'USER_EMAIL';

interface ShareWithMapping {
  published_to: string;
  type: ShareWithType;
  access_level?: 'ALL';
}

interface ToItem {
  id: string;
  type: ShareWithType;
  label: string;
  secondaryLabel?: string;
}

function generateAngularUniqueId30(): string {
  // Matches Angular utils.generateUniqueId(): 30 chars A-Za-z0-9
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const len = 30;
  let id = '';
  for (let i = 0; i < len; i += 1) {
    id += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return id;
}

function normalizeIdLikeAngular(id: string): string {
  // Angular sometimes stores ids with prefixes in other modules; for inline insert createNote mappings,
  // ids are used as-is (usr-.../grp-... or raw depending on system). We keep as-is.
  return String(id || '').trim();
}

function isValidEmail(s: string): boolean {
  // Light validation (Angular contact list provider is more advanced; this is a safe fallback)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function uniqByKey<T>(items: T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = keyFn(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function normalizeHtmlFromPlainText(s: string): string {
  const text = String(s || '');
  // Minimal parity with Quill output: wrap in <p> and turn newlines into <br>
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const withBr = escaped.replace(/\n/g, '<br>');
  return `<p>${withBr}</p>`;
}

async function ensureQuillLoaded(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).Quill) return (window as any).Quill;

  // Load snow CSS once
  if (!document.querySelector('link[data-cnv-quill-snow="1"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/vendor/quill/quill.snow.css';
    link.setAttribute('data-cnv-quill-snow', '1');
    document.head.appendChild(link);
  }

  // Load quill script once
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-cnv-quill="1"]') as HTMLScriptElement | null;
    if (existing) {
      // If already loaded, resolve immediately (or wait if still loading)
      if ((window as any).Quill) resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = '/vendor/quill/quill.min.js';
    s.async = true;
    s.setAttribute('data-cnv-quill', '1');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Quill'));
    document.body.appendChild(s);
  });

  return (window as any).Quill;
}

function getInitialsFromText(s: string): string {
  const parts = String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  const a = parts[0]?.[0] || '';
  const b = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) || '';
  return `${a}${b}`.toUpperCase();
}

export default function InlineInsert() {
  const queryClient = useQueryClient();
  const { user, loginData, account } = useAuthStore();
  const { usersArray, usersMap } = useUsers();
  const groupsQuery = useGroups();
  const groupsData: any = (groupsQuery as any)?.data;

  const groupsArray = useMemo(() => {
    const arr = Array.isArray(groupsData?.groups) ? groupsData.groups : Array.isArray(groupsData) ? groupsData : [];
    return arr as any[];
  }, [groupsData]);

  const groupsMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const g of groupsArray) {
      const id = normalizeIdLikeAngular(String((g as any)?.id || (g as any)?.group_id || ''));
      if (!id) continue;
      map[id] = g;
      if (!id.startsWith('grp-')) map[`grp-${id}`] = g;
      map[id.replace(/^grp-/, '')] = g;
    }
    return map;
  }, [groupsArray]);
  const { data: settingsResp } = useGeneralSettings();

  const [active, setActive] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [validSharingInfo, setValidSharingInfo] = useState(true);
  const [toolbarActive, setToolbarActive] = useState(false);

  const [noteId, setNoteId] = useState<string>(() => generateAngularUniqueId30());
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyHtmlText, setBodyHtmlText] = useState<string>('<p></p>');

  // Two refs:
  // - hiddenFileInputRef: legacy hidden input (kept for older code paths)
  // - bottomBarFileInputRef: actual <input type=file> inside the attach icon (DOM parity)
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const bottomBarFileInputRef = useRef<HTMLInputElement>(null);

  // Poll UI (DOM parity first; full poll functionality will follow)
  const [isPollFeatureEnabled] = useState(true);
  const [pollOptionsDisplayed, setPollOptionsDisplayed] = useState(false);
  const [pollMode, setPollMode] = useState<'none' | 'image' | 'text'>('none');

  const isPollMode = pollMode !== 'none';

  // To-field state
  const [toItems, setToItems] = useState<ToItem[]>([]);
  const [toQuery, setToQuery] = useState('');
  const [toFocused, setToFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const toInputRef = useRef<HTMLInputElement>(null);

  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);
  const quillTextChangeHandlerRef = useRef<((...args: any[]) => void) | null>(null);

  const applyPlaceholderToFirstLine = (q: any, text: string) => {
    try {
      if (!q?.root) return;
      // Remove placeholder from other places to avoid duplicates.
      delete (q.root as any).dataset?.placeholder;
      q.root.removeAttribute?.('data-placeholder');

      const lineEl: HTMLElement | null = q.root.querySelector?.('.ql-line') || null;
      if (lineEl) {
        lineEl.setAttribute('data-placeholder', text);
      }
    } catch {
      // ignore
    }
  };

  type UploadStatus = 'uploading' | 'converting' | 'success' | 'failed';
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{
      localId: string;
      name: string;
      size: number;
      type: string;
      status: UploadStatus;
      fileNameId: string; // Angular: file_name_id (guid)
      fileUploadName: string; // Angular: file_upload_name (guid.ext)
      serverFileId?: string; // backend file_id
      serverFileObj?: any;
    }>
  >([]);

  const getFileStorageInfo = () => {
    const info: any = (loginData as any)?.file_storage_info;
    const defaultType: string | undefined = info?.default_type || info?.defaultType;
    const data =
      (defaultType ? info?.data?.[defaultType] : null) ||
      (defaultType ? info?.[defaultType] : null) ||
      info?.data ||
      null;
    return { defaultType, data };
  };

  const getS3BucketUrl = () => {
    const { defaultType, data } = getFileStorageInfo();
    if (!defaultType || defaultType.toLowerCase() !== 's3' || !data) return null;
    const bucketName = data.bucket_name;
    const httpsUploads = !!data.https_uploads;
    if (!bucketName) return null;
    return `${httpsUploads ? 'https' : 'http'}://${bucketName}.s3.amazonaws.com/`;
  };

  const getFileUploadPath = (fileUploadName: string) => {
    const accountId = String((loginData as any)?.account_id || (account as any)?.account_id || '');
    const dir = 'attachments';
    return `${accountId}/${dir}/${fileUploadName}`;
  };

  const postFilesEndpoint = async (payload: any) => {
    const res = await fetch('/api/v1/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text };
    }
    if (!res.ok) throw new Error(json?.error || json?.message || `Files request failed: ${res.status}`);
    return json;
  };

  const pollFileConversionStatus = async (fileIds: string[]) => {
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
          setAttachedFiles((prev) => prev.map((f) => (f.serverFileId === id ? { ...f, status: 'success', serverFileObj: st } : f)));
        } else if (status === 'converting') {
          nextPending.add(id);
          setAttachedFiles((prev) => prev.map((f) => (f.serverFileId === id && f.status !== 'success' ? { ...f, status: 'converting' } : f)));
        } else {
          setAttachedFiles((prev) => prev.map((f) => (f.serverFileId === id ? { ...f, status: 'failed' } : f)));
        }
      }

      pending = nextPending;
      if (pending.size) await new Promise((r) => setTimeout(r, 1500));
    }
  };

  const uploadLocalFileAndConvert = async (file: File) => {
    const max = 20971520; // Angular UploadService.UPLOAD_FILE_LIMIT (20MB)
    if (file.size > max) {
      throw new Error(`The ${file.name} file exceeds the 20 MB attachment limit.`);
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileNameId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
    const fileUploadName = `${fileNameId}.${ext || 'bin'}`;
    const bucketUrl = getS3BucketUrl();
    const { defaultType, data } = getFileStorageInfo();

    setAttachedFiles((prev) => [
      ...prev,
      { localId, name: file.name, size: file.size || 1, type: ext || 'bin', status: 'uploading', fileNameId, fileUploadName },
    ]);

    if (!defaultType || defaultType.toLowerCase() !== 's3' || !bucketUrl || !data) {
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
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
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
      throw new Error(`S3 upload failed: ${s3Res.status}`);
    }

    const file_url = `${bucketUrl}${keyPath}`;
    setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'converting' } : f)));

    // Start conversion on backend (Angular UploadService.fileConversionReq via /api/v1/files)
    const req = {
      file: {
        item_id: noteId,
        name: file.name,
        file_upload_name: fileUploadName,
        type: ext || 'bin',
        size: file.size || 1,
        file_url,
        file_source: null,
        file_access_token: null,
        file_preview_url: null,
        storage_version: 1,
        app_instance_id: 6, // Notes app instance in Convo
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
  };


  // Legacy parity: see Angular `web_app/src/index.php` where these globals are defined at page load.
  const legacyMessagesArray = useMemo(
    () => [
      'Your story starts here.',
      'Got images or files to share? Drag them here.',
      'Paste an image from your clipboard to share.',
      'Use # to tag your post.',
      'Use @ to tag a teammate or group.',
      'Put a smile on your team’s face. Share a GIF.',
      'Share files directly from Dropbox, Google Drive, Box.',
      'Just read a great article? Paste the URL here.',
    ],
    []
  );

  const [placeholderText, setPlaceholderText] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const w: any = window as any;
      const base = String(w?.inlineInsertPlaceholderText || '').trim();
      if (base) return base;
    }
    // Fallback until we seed from legacyMessagesArray on mount.
    return legacyMessagesArray[0];
  });

  const myUserId = String((user as any)?.user_id || (user as any)?.userId || '');

  // Angular behavior:
  // - base placeholder is window.inlineInsertPlaceholderText (or contextual “Share something with X.”)
  // - dummy placeholder text is also rotated daily via window.messagesArray when NOT active
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w: any = window as any;

    // Ensure window.messagesArray exists (Angular `index.php`: `var messagesArray = [...]`)
    if (!Array.isArray(w.messagesArray) || w.messagesArray.length === 0) {
      w.messagesArray = legacyMessagesArray.slice();
    }

    // Legacy: pick a random message on every page load and set BOTH:
    // - dummy placeholder text
    // - window.inlineInsertPlaceholderText (used by cnv-editor placeholder)
    const messages: any[] = Array.isArray(w.messagesArray) ? w.messagesArray : [];
    const initialIdx = Math.floor(Math.random() * messages.length);
    const initialMsg = String(messages[initialIdx] || '').trim();
    if (initialMsg) {
      w.inlineInsertPlaceholderText = initialMsg;
      setPlaceholderText(initialMsg);
    }

    const pickRandom = () => {
      const idx = Math.floor(Math.random() * messages.length);
      const msg = String(messages[idx] || '').trim();
      if (msg) {
        w.inlineInsertPlaceholderText = msg;
        setPlaceholderText(msg);
      }
    };

    const id = window.setInterval(() => {
      // Angular: only rotates when !active
      if (!active) pickRandom();
    }, 86400000); // 24 hours

    return () => window.clearInterval(id);
  }, [active, legacyMessagesArray]);

  // Hydrate default recipients from settings (Angular: settingsService.getGeneralSettings().sharing_options_list)
  useEffect(() => {
    const settings: any = (settingsResp as any)?.data ?? settingsResp;
    const list: any[] = Array.isArray(settings?.sharing_options_list) ? settings.sharing_options_list : [];
    if (!list.length) return;

    const mapped: ToItem[] = [];
    for (const it of list) {
      const type = String(it?.type || '').toUpperCase() as ShareWithType;
      const shareTo = normalizeIdLikeAngular(String(it?.share_to || ''));
      if (!shareTo) continue;

      if (type === 'GROUP') {
        const g = (groupsMap as any)?.[shareTo] || (groupsMap as any)?.[`grp-${shareTo}`] || (groupsMap as any)?.[shareTo.replace(/^grp-/, '')];
        const label = String(g?.title || g?.name || shareTo);
        mapped.push({ id: shareTo, type: 'GROUP', label });
      } else if (type === 'USER') {
        const u = (usersMap as any)?.[shareTo] || (usersMap as any)?.[`usr-${shareTo}`] || (usersMap as any)?.[shareTo.replace(/^usr-/, '')];
        const label =
          String(u?.name || '').trim() ||
          `${String(u?.first_name || u?.firstName || '').trim()} ${String(u?.last_name || u?.lastName || '').trim()}`.trim() ||
          String(u?.email || shareTo);
        mapped.push({ id: shareTo, type: 'USER', label: label || shareTo });
      }
    }

    const deduped = uniqByKey(mapped, (x) => `${x.type}:${x.id}`);
    if (deduped.length) {
      setToItems(deduped);
    }
  }, [settingsResp, usersMap, groupsMap]);

  const suggestions: ToItem[] = useMemo(() => {
    if (!toFocused) return [];
    const q = toQuery.trim().toLowerCase();

    const baseUsers: ToItem[] =
      (usersArray || [])
        .map((u: any) => {
          const id = normalizeIdLikeAngular(String(u.user_id || u.userId || u.id || ''));
          const fullName =
            String(u.name || '').trim() ||
            `${String(u.first_name || u.firstName || '').trim()} ${String(u.last_name || u.lastName || '').trim()}`.trim();
          const email = String(u.email || '').trim();
          const label = fullName || email || id;
          const secondaryLabel = email && email !== label ? email : undefined;
          return id ? ({ id, type: 'USER', label: label || id, secondaryLabel } as ToItem) : null;
        })
        .filter(Boolean) as ToItem[];

    const baseGroups: ToItem[] =
      (groupsArray || [])
        .map((g: any) => {
          const id = normalizeIdLikeAngular(String(g.id || g.group_id || ''));
          const label = String(g.title || g.name || '').trim() || id;
          // Angular template shows a secondary line; for groups we show "Group" for parity with our prior "meta".
          return id ? ({ id, type: 'GROUP', label: label || id, secondaryLabel: 'Group' } as ToItem) : null;
        })
        .filter(Boolean) as ToItem[];

    const already = new Set(toItems.map((t) => `${t.type}:${t.id}`));
    const filtered = [...baseUsers, ...baseGroups]
      .filter((it) => !already.has(`${it.type}:${it.id}`))
      .filter((it) => (q ? it.label.toLowerCase().includes(q) : true))
      .slice(0, 7); // Angular DROP_DOWN_MAX_RESULTS: 5 (menulet 3). Use 7 to keep it usable.

    // Email fallback suggestion (only if it’s a valid email)
    if (q && isValidEmail(toQuery.trim())) {
      const email = toQuery.trim();
      if (!already.has(`USER_EMAIL:${email}`)) {
        filtered.unshift({ id: email, type: 'USER_EMAIL', label: email, secondaryLabel: 'Email' });
      }
    }

    return filtered;
  }, [toFocused, toQuery, usersArray, groupsArray, toItems]);

  const open = active && toFocused && suggestions.length > 0;

  const activate = () => {
    setActive(true);
    setValidSharingInfo(true);
    setToolbarActive(false);
    // New noteId per activation (Angular does this inside activate())
    setNoteId(generateAngularUniqueId30());
    setTimeout(() => {
      toInputRef.current?.focus();
    }, 0);
  };

  const deactivate = () => {
    setActive(false);
    setSharing(false);
    setToFocused(false);
    setToQuery('');
    setActiveIndex(0);
    setPollOptionsDisplayed(false);
    setPollMode('none');
    setToolbarActive(false);
    setTitle('');
    setBodyText('');
    setBodyHtmlText('<p></p>');
    setAttachedFiles([]);
    setValidSharingInfo(true);

    // Reset editor content (Angular deactivates/destroys editor scope; we just clear contents)
    try {
      if (quillRef.current) {
        if (quillTextChangeHandlerRef.current && quillRef.current.off) {
          quillRef.current.off('text-change', quillTextChangeHandlerRef.current);
        }
        quillTextChangeHandlerRef.current = null;
        // Remove Quill-generated DOM so re-init is clean next time.
        if (editorHostRef.current) {
          editorHostRef.current.innerHTML = '';
        }
        quillRef.current = null;
      } else if (editorHostRef.current) {
        editorHostRef.current.innerHTML = '';
      }
    } catch {
      // ignore
    }
  };

  const addToItem = (item: ToItem) => {
    setToItems((prev) => uniqByKey([...prev, item], (x) => `${x.type}:${x.id}`));
    setToQuery('');
    setActiveIndex(0);
    setValidSharingInfo(true);
    // keep focus on input (Angular uses mousedown)
    setTimeout(() => toInputRef.current?.focus(), 0);
  };

  const removeToItem = (item: ToItem) => {
    setToItems((prev) => prev.filter((x) => !(x.type === item.type && x.id === item.id)));
    setValidSharingInfo(true);
  };

  const canShare = useMemo(() => {
    const hasRecipients = toItems.length > 0;
    const hasText = bodyText.trim().length > 0 || title.trim().length > 0;
    const hasFiles = attachedFiles.some((f) => f.status === 'success');
    return hasRecipients && (hasText || hasFiles);
  }, [toItems, bodyText, title, attachedFiles]);

  const buildMappings = (): ShareWithMapping[] => {
    const mappings: ShareWithMapping[] = [];
    for (const it of toItems) {
      if (it.type === 'USER_EMAIL') {
        mappings.push({ published_to: it.id, type: 'USER_EMAIL' });
      } else {
        mappings.push({ published_to: it.id, type: it.type, access_level: 'ALL' });
      }
    }
    return mappings;
  };

  const onShare = async () => {
    if (!loginData || !user || !account) return;
    if (!toItems.length) {
      setValidSharingInfo(false);
      return;
    }
    if (!canShare) return;

    setSharing(true);
    try {
      const successfulFiles = attachedFiles.filter((f) => f.status === 'success');
      const reqData = {
        // Matches Angular itemService.createNote reqData shape
        body: bodyHtmlText && bodyHtmlText.trim().length ? bodyHtmlText : normalizeHtmlFromPlainText(bodyText),
        title,
        user_set_title: title ? '1' : '0',
        is_text_only: successfulFiles.length ? '0' : '1',
        item_id: noteId,
        cleanText: true,
        draft: '0',
        tags: '',
        mappings: buildMappings(),
        auto_save: 0,
        permissions: 7, // Angular initPostPermissions default
        is_acknowledge_post: 0,
        ivl: -1,
      };

      if (successfulFiles.length) {
        // Angular passes reqData.files as JSON string of fileInfo objects
        (reqData as any).files = JSON.stringify(
          successfulFiles.map((f) => ({
            name: f.name,
            size: f.size,
            file_name_id: f.fileNameId,
            type: f.type,
            file_upload_name: f.fileUploadName,
            ...(f.serverFileId ? { file_id: f.serverFileId } : {}),
          }))
        );
      }

      const res = await fetch('/api/v1/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(reqData),
      });

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text };
      }

      if (!res.ok) {
        throw new Error(json?.error || json?.message || `Failed to share: ${res.status}`);
      }

      // Angular: after share, feed polls then composer deactivates
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      deactivate();
    } catch (e) {
      console.error('[InlineInsert] Share failed:', e);
      // Keep editor open so user can retry
      setSharing(false);
    }
  };

  // Initialize Quill when the inline insert becomes active.
  useEffect(() => {
    if (!active) return;
    if (quillRef.current) return;
    if (!editorHostRef.current) return;

    let cancelled = false;

    (async () => {
      const Quill = await ensureQuillLoaded();
      if (!Quill || cancelled) return;
      if (!editorHostRef.current) return;

      // IMPORTANT: the toolbar element must exist in DOM before Quill init.
      // We render it whenever active, and just hide/show via toolbarActive state.
      const q = new Quill(editorHostRef.current, {
        theme: 'snow',
        // Use the inline-insert toolbar container (Angular uses toolbar-id="inline-insert-toolbar")
        modules: {
          toolbar: '#inline-insert-toolbar',
        },
        placeholder: placeholderText,
        formats: ['bold', 'italic', 'underline', 'strike', 'bullet', 'list', 'align', 'link', 'color'],
      });
      quillRef.current = q;

      // Ensure placeholder is visible when empty.
      try {
        // Per request: connect placeholder to the first `.ql-line` element.
        applyPlaceholderToFirstLine(q, placeholderText);
      } catch {
        // ignore
      }

      const sync = () => {
        try {
          const txt = String(q.getText() || '').replace(/\n$/, '');
          setBodyText(txt);
          setBodyHtmlText(`<div>${q.root.innerHTML}</div>`.replace(/^<div>/, '').replace(/<\/div>$/, ''));

          // Ensure placeholder never overlaps typed text:
          // Quill uses `.ql-blank` to control placeholder visibility. In our heavily-styled legacy build,
          // keep it in sync explicitly with the editor's actual plain-text content.
          const isBlank = txt.trim().length === 0;
          if (isBlank) q.root.classList.add('ql-blank');
          else q.root.classList.remove('ql-blank');

          // The `.ql-line` nodes can be recreated; keep the placeholder attribute attached.
          applyPlaceholderToFirstLine(q, placeholderText);
        } catch {
          // ignore
        }
      };
      quillTextChangeHandlerRef.current = sync;
      q.on('text-change', sync);
      sync();
    })().catch((e) => {
      console.error('[InlineInsert] Failed to init Quill:', e);
    });

    return () => {
      cancelled = true;
    };
  }, [active]);

  // Keep Quill placeholder in sync if it changes (Angular can change based on context; dummy rotates daily).
  useEffect(() => {
    const q = quillRef.current;
    if (!q || !q.root) return;
    try {
      // Per request: connect placeholder to the first `.ql-line` element (and remove it from other places).
      applyPlaceholderToFirstLine(q, placeholderText);
    } catch {
      // ignore
    }
  }, [placeholderText]);

  // If the component becomes inactive (collapsed) without calling deactivate() for some reason,
  // ensure Quill instance is cleared so next activation re-inits cleanly.
  useEffect(() => {
    if (active) return;
    if (!quillRef.current) return;
    try {
      if (quillTextChangeHandlerRef.current && quillRef.current.off) {
        quillRef.current.off('text-change', quillTextChangeHandlerRef.current);
      }
      quillTextChangeHandlerRef.current = null;
      if (editorHostRef.current) editorHostRef.current.innerHTML = '';
    } catch {
      // ignore
    } finally {
      quillRef.current = null;
    }
  }, [active]);

  return (
    <div className={`inline-insert-cont ${active ? 'active' : ''}`}>
      {/* Dummy closed state */}
      {!active && (
        <div
          className="dummy-text-area"
          onClick={() => activate()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') activate();
          }}
        >
          <div className="dummy-area-cont">
            <UserProfileImage
              userId={myUserId}
              user={user as any}
              width={32}
              height={32}
              source="Compose"
              // Match Angular inline style: small offset
              style={{ margin: '0px 4px', position: 'relative', top: '1px' } as any}
            />
            <span id="inlineInsertPlaceholderText">{placeholderText}</span>
            <div
              className="cnv-icons-16 icons2_Attach-darkgray attachIconInlineInsert inlineInsertAttachmentIconWhenClosed"
              onClick={(e) => {
                e.stopPropagation();
                activate();
              }}
              role="button"
              tabIndex={0}
            />
          </div>
        </div>
      )}

      {/* Active composer */}
      {active && (
        <div className="inline-insert-active-cont-wrapper">
          <div className={`to-field-cont ${validSharingInfo ? 'valid' : 'invalid'}`}>
            <div className="to-field">
              <div className="to-tags">
                <span className="pre-placeholder">To:</span>
                {toItems.map((t) => (
                  <span key={`${t.type}:${t.id}`} className="tag">
                    <span className="tag-label">{t.label}</span>
                    <button
                      type="button"
                      className="tag-remove"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={() => removeToItem(t)}
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  ref={toInputRef}
                  value={toQuery}
                  onFocus={() => setToFocused(true)}
                  onBlur={() => {
                    // close dropdown shortly after click
                    setTimeout(() => setToFocused(false), 150);
                  }}
                  onChange={(e) => {
                    setToQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      deactivate();
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveIndex((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveIndex((i) => Math.max(0, i - 1));
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const sel = suggestions[activeIndex];
                      if (sel) addToItem(sel);
                    }
                  }}
                  className="to-input"
                  placeholder={toItems.length ? '' : '+Add user, group or email'}
                  spellCheck={false}
                />
              </div>

              {open && (
                <div className="autocomplete" role="listbox">
                  <ul className="suggestion-list">
                    {suggestions.map((sug, idx) => {
                      const selected = idx === activeIndex;
                      const initials =
                        sug.type === 'USER'
                          ? getInitialsFromText(sug.label)
                          : sug.type === 'GROUP'
                            ? getInitialsFromText(sug.label) || 'G'
                            : '@';

                      return (
                        <li
                          key={`${sug.type}:${sug.id}`}
                          className={`suggestion-item ${selected ? 'selected' : ''}`}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onMouseDown={(e) => {
                            // Keep focus; Angular uses mousedown handlers
                            e.preventDefault();
                          }}
                          onClick={() => addToItem(sug)}
                          role="option"
                          aria-selected={selected}
                        >
                          <div className="img-label-list-item" style={{ lineHeight: sug.secondaryLabel ? 'normal' : '35px' } as any}>
                            {sug.type === 'USER' ? (
                              <UserProfileImage
                                userId={sug.id}
                                user={(usersMap as any)?.[sug.id]}
                                width={32}
                                height={32}
                                source="Compose"
                                style={{ position: 'absolute', left: 2, top: 8 } as any}
                              />
                            ) : (
                              <span
                                className="img-circle"
                                style={{
                                  position: 'absolute',
                                  left: 2,
                                  top: 8,
                                  height: 32,
                                  width: 32,
                                  fontStyle: 'normal',
                                  lineHeight: '32px',
                                  textAlign: 'center',
                                  fontWeight: 100,
                                  fontSize: 'inherit',
                                  letterSpacing: '-1px',
                                  backgroundColor: '#383838',
                                  color: '#fff',
                                  borderRadius: '50%',
                                }}
                              >
                                {initials}
                              </span>
                            )}

                            <span style={{ width: '100%' }}>{sug.label}</span>
                            {sug.secondaryLabel ? <span className="sec-label">{sug.secondaryLabel}</span> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="rich-note-insert edit-mode no-padding">
            <input
              ref={hiddenFileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                e.currentTarget.value = '';
                for (const f of files) {
                  try {
                    await uploadLocalFileAndConvert(f);
                  } catch (err) {
                    console.error(err);
                  }
                }
              }}
            />
            <input
              id="noteTitleField"
              className="note-title-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              type="text"
              maxLength={1000}
            />

            {/* Quill editor host */}
            <div className="inline-insert-editor">
              <div ref={editorHostRef} />
            </div>

            {/* Inline insert toolbar (Angular: AFTER editor; shown when toolbarActive; toggled by bottom-bar text toolbar button) */}
            <div
              id="inline-insert-toolbar"
              className="inline-insert-toolbar-placeholder ql-toolbar ql-snow"
              style={{ display: toolbarActive ? 'block' : 'none' }}
            >
              <span className="ql-format-group">
                <span className="ql-format-button ql-bold icons3_Bold-darkgray"></span>
                <span className="ql-format-button ql-italic italic-darkgray"></span>
                <span className="ql-format-button ql-underline underline-darkgray"></span>
                <span className="ql-format-button ql-strike strikethrough-darkgray"></span>
                <select title="Text Color" className="ql-color" defaultValue="#000000">
                  <option value="#000000"></option><option value="#444444"></option>
                  <option value="#666666"></option><option value="#999999"></option>
                  <option value="#cccccc"></option><option value="#eeeeee"></option>
                  <option value="#f3f3f3"></option><option value="#fcfcfc"></option>
                  <option value="#ed462e"></option><option value="#f39e30"></option>
                  <option value="#fef936"></option><option value="#75f012"></option>
                  <option value="#6cf9fb"></option><option value="#0049fb"></option>
                  <option value="#8553fb"></option><option value="#e865fe"></option>
                  <option value="#eed0cd"></option><option value="#f9e7ce"></option>
                  <option value="#fcf1ce"></option><option value="#dce8d3"></option>
                  <option value="#d2e0e3"></option><option value="#d0e4f2"></option>
                  <option value="#d7d4e8"></option><option value="#e6d4db"></option>
                  <option value="#dfa29b"></option><option value="#f4cc9f"></option>
                  <option value="#fde49d"></option><option value="#bed3a9"></option>
                  <option value="#a8c4c8"></option><option value="#a2c7e5"></option>
                  <option value="#b0add5"></option><option value="#ceacbd"></option>
                  <option value="#d3746d"></option><option value="#edb573"></option>
                  <option value="#fad66e"></option><option value="#9dbe7e"></option>
                  <option value="#7fa5ad"></option><option value="#78abdb"></option>
                  <option value="#8984c1"></option><option value="#b884a1"></option>
                  <option value="#bc3723"></option><option value="#de9647"></option>
                  <option value="#ebc144"></option><option value="#78a150"></option>
                  <option value="#51818b"></option><option value="#4887c3"></option>
                  <option value="#5f5ba5"></option><option value="#9b5b79"></option>
                  <option value="#8e2819"></option><option value="#ab6520"></option>
                  <option value="#bb9223"></option><option value="#487120"></option>
                  <option value="#214f5a"></option><option value="#185891"></option>
                  <option value="#2e2b73"></option><option value="#6a2d49"></option>
                  <option value="#5e170c"></option><option value="#704314"></option>
                  <option value="#7c6014"></option><option value="#304a15"></option>
                  <option value="#16343d"></option><option value="#103b61"></option>
                  <option value="#1b1c4b"></option><option value="#461b2f"></option>
                </select>
              </span>
              <span className="ql-format-separator"></span>
              <span className="ql-format-group">
                <span className="ql-format-button ql-list numberedlist-darkgray"></span>
                <span className="ql-format-button ql-bullet orderedlist-darkgray"></span>
              </span>
              <span className="ql-format-separator"></span>
              <span className="ql-format-group">
                <span className="ql-inline-link ql-format-button ql-link icons_Links-darkgray"></span>
              </span>
            </div>

            {attachedFiles.length > 0 && (
              <div className="inline-insert-attachments">
                {attachedFiles.map((f) => (
                  <div key={f.localId} className="inline-insert-attachment">
                    <span className="name">{f.name}</span>
                    <span className="status">{f.status === 'success' ? 'Ready' : f.status === 'failed' ? 'Failed' : f.status}</span>
                    <button
                      type="button"
                      className="remove"
                      disabled={sharing}
                      onClick={() => setAttachedFiles((p) => p.filter((x) => x.localId !== f.localId))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom bar - DOM parity with Angular cnvInlineInsert.tpl.html */}
          <div className={`bottom-bar-cont ${!isPollFeatureEnabled ? 'poll-feature-disabled' : ''}`}>
            {/* Poll icon + options */}
            {isPollFeatureEnabled && (
              <>
                <i
                  id="poll-icon"
                  className={isPollMode ? 'icon_poll-blue' : 'icon_poll-gray'}
                  onClick={() => setPollOptionsDisplayed((v) => !v)}
                />
                <ul className={`polloptions ${pollOptionsDisplayed ? '' : 'ng-hide'}`} style={{ display: pollOptionsDisplayed ? 'block' : 'none' }}>
                  <li
                    className="imagespoll"
                    onClick={() => {
                      setPollMode('image');
                      setPollOptionsDisplayed(false);
                    }}
                  >
                    Poll with Images
                  </li>
                  <li
                    className="textpoll"
                    onClick={() => {
                      setPollMode('text');
                      setPollOptionsDisplayed(false);
                    }}
                  >
                    Poll with Text
                  </li>
                </ul>
              </>
            )}

            {/* Share button */}
            <button className="btn btn-primary pull-right" type="button" disabled={!canShare || sharing} onClick={onShare}>
              Share
            </button>

            {/* Add item options strip (Angular: cnv-insert-add-item-options) */}
            <div className={`add-controls pull-right ${!isPollMode ? 'poll-attachments-wrap' : ''}`}>
              {/* Text toolbar toggle placeholder (DOM parity) */}
              <div
                className={`editor-toolbar texttoolbar-darkgray ${toolbarActive ? 'pressed' : ''}`}
                onMouseDown={(e) => {
                  // Angular prevent-event-mousedown directive
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  setToolbarActive((v) => !v);
                }}
              />

              <label className="separator" />

              {/* Attach icon + input (DOM parity: input.file-input inside icon div) */}
              <div
                className="icons2_Attach-darkgray attachIconInlineInsert"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => bottomBarFileInputRef.current?.click()}
              >
                <input
                  ref={bottomBarFileInputRef}
                  name="file"
                  className="file-input"
                  type="file"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from((e.target as HTMLInputElement).files || []);
                    (e.target as HTMLInputElement).value = '';
                    for (const f of files) {
                      try {
                        await uploadLocalFileAndConvert(f);
                      } catch (err) {
                        console.error(err);
                      }
                    }
                  }}
                />
              </div>

              {/* Box */}
              <div
                className="Icon2__Box-15-darkgray"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Placeholder: full Box integration will be added after parity of core composer.
                }}
              />

              {/* Google Drive */}
              <div
                className="icons3_Google_Drive-darkgray"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Placeholder: full Google Drive integration will be added after parity of core composer.
                }}
              />

              {/* Giphy (placeholder button in strip) */}
              <div
                className="giphy-action-container"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Placeholder: giphy popover will be added after parity of core composer.
                }}
              >
                <div id="iShowGiphyPopup" className="inLineInsertGiphy giphy" />
              </div>

              {/* Upload from URL placeholder (kept for DOM parity) */}
              <div
                className="upload-from-url"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Placeholder: upload-from-url modal will be added.
                }}
              />

              <label className="separator" />

              {/* Tag icon */}
              <div
                className="icon_tag-01-01-darkgray-old"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Placeholder: tags field toggle will be added.
                }}
              />

              {/* Location icon */}
              <div
                id="location-icon"
                className="icons_Location-darkgray"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Placeholder: location picker will be added.
                }}
              />
            </div>

            <label />
            <div className="clear" />
          </div>

          {sharing && (
            <div className="sharing-state-overlay">
              <div className="cnv-spinner inline-insert-spinner" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


