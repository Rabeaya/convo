'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import UserProfileImage from '@/components/common/UserProfileImage';
import CalendarDropdown from '@/components/feed/CalendarDropdown';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSession } from '@/lib/hooks/use-auth';
import { useUsers } from '@/lib/hooks/use-users';
import { useGroups } from '@/lib/hooks/use-groups';
import { useGeneralSettings } from '@/lib/hooks/use-settings';
import { resolveServicesHostString } from '@/lib/config/services-host';
import { promptModal } from '@/lib/utils/modal';

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
  const pathname = usePathname();
  const { user, loginData, account } = useAuthStore();
  const { data: sessionData, isLoading: isSessionLoading } = useSession();
  
  // Check if we're on the expanded editor route
  const isExpandedEditorRoute = pathname?.includes('/v1/') && pathname?.includes('/apps/') && pathname?.includes('/messages/');
  
  // Extract noteId from URL if on expanded editor route
  const urlNoteId = useMemo(() => {
    if (isExpandedEditorRoute && pathname) {
      const match = pathname.match(/\/messages\/([^\/]+)/);
      return match ? match[1] : null;
    }
    return null;
  }, [pathname, isExpandedEditorRoute]);
  
  // Helper to get loginData from multiple sources dynamically
  const getEffectiveLoginData = () => {
    // Prioritize React store, fallback to window.com_convo (Angular compatibility)
    return loginData || (typeof window !== 'undefined' ? (window as any)?.com_convo?.sessionData?.signInResponseData : null);
  };
  
  // Helper to get assets base URL - matches Angular asset paths
  const getAssetsBaseUrl = () => {
    // Use services host to construct assets URL
    // Angular assets are served from the same domain as the app
    const host = resolveServicesHostString({ allowWindow: true });
    return `https://${host}`;
  };
  
  const usersQuery = useUsers();
  const usersData = (usersQuery as any)?.data;
  const usersArray = (usersData as any)?.usersArray || [];
  const usersMap = (usersData as any)?.usersMap || {};
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

  // In expanded editor (NotesApp), always be active
  const [active, setActive] = useState(isExpandedEditorRoute);
  const [sharing, setSharing] = useState(false);
  const [validSharingInfo, setValidSharingInfo] = useState(true);
  const [toolbarActive, setToolbarActive] = useState(false);

  const [noteId, setNoteId] = useState<string>(() => urlNoteId || generateAngularUniqueId30());
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyHtmlText, setBodyHtmlText] = useState<string>('<p></p>');
  
  // Initialize from URL when on expanded editor route
  useEffect(() => {
    if (isExpandedEditorRoute && typeof window !== 'undefined') {
      // Extract title from hash fragment
      const hash = window.location.hash;
      if (hash) {
        const titleMatch = hash.match(/title=([^&]*)/);
        if (titleMatch) {
          const decodedTitle = decodeURIComponent(titleMatch[1]);
          setTitle(decodedTitle);
        }
      }
      
      // Set noteId from URL
      if (urlNoteId) {
        setNoteId(urlNoteId);
      }
      
      // Auto-activate editor when on expanded route
      setActive(true);
    }
  }, [isExpandedEditorRoute, urlNoteId]);
  const [showGiphy, setShowGiphy] = useState(false);
  const [giphyQuery, setGiphyQuery] = useState('');
  const [giphyResults, setGiphyResults] = useState<Array<{ id: string; preview: string; original: string }>>([]);
  const giphyApiKey = 'xTiTnI9GNUe8rosXMQ'; // From Angular cnv-giphy.js
  const giphyPopoverRef = useRef<HTMLDivElement>(null);

  // Two refs:
  // - hiddenFileInputRef: legacy hidden input (kept for older code paths)
  // - bottomBarFileInputRef: actual <input type=file> inside the attach icon (DOM parity)
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const bottomBarFileInputRef = useRef<HTMLInputElement>(null);
  const isOpeningFileDialogRef = useRef<boolean>(false);

  // Poll UI (DOM parity first; full poll functionality will follow)
  const [isPollFeatureEnabled] = useState(true);
  const [pollOptionsDisplayed, setPollOptionsDisplayed] = useState(false);
  const [pollMode, setPollMode] = useState<'none' | 'image' | 'text'>('none');
  const [textChoices, setTextChoices] = useState<string[]>(['']); // Initialize with one empty choice
  
  // Poll images state (for image poll mode)
  interface PollImageFile {
    localId: string;
    fileNameId: string;
    fileUploadName: string;
    name: string;
    size: number;
    type: string;
    status: 'waiting' | 'uploading' | 'uploaded' | 'converting' | 'success' | 'failed';
    serverFileId?: string;
    subResourceId?: string; // Unique ID for poll option
    localPreviewUrl?: string;
    progress?: number;
    imageDesc?: string; // Description text for the image option
  }
  const [pollImages, setPollImages] = useState<PollImageFile[]>([]);
  const pollImageInputRef = useRef<HTMLInputElement>(null);
  const pollFilesDataRef = useRef<{
    selectedFilesCount: number;
    addedFilesCount: number;
    completedAndConvertedFilesCount: number;
    addedFiles: PollImageFile[];
  }>({
    selectedFilesCount: 0,
    addedFilesCount: 0,
    completedAndConvertedFilesCount: 0,
    addedFiles: [],
  });
  
  // Poll common options state
  const [allowViewResults, setAllowViewResults] = useState(false);
  const [pollEndDateAllowed, setPollEndDateAllowed] = useState(false);
  const [selectedHour, setSelectedHour] = useState<string>('hh');
  const [selectedMinute, setSelectedMinute] = useState<string>('mm');
  const [timeFormat, setTimeFormat] = useState<'AM' | 'PM'>('AM');
  const [isHrsDropdownDisplayed, setIsHrsDropdownDisplayed] = useState(false);
  const [isMinsDropdownDisplayed, setIsMinsDropdownDisplayed] = useState(false);
  const [pollEndDate, setPollEndDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDisplayed, setCalendarDisplayed] = useState(false);
  const calendarRef = useRef<HTMLSpanElement>(null);
  const [showDiscardPollModal, setShowDiscardPollModal] = useState(false);
  
  // Tag field state - Angular uses tagList array with objects {label: string}
  const [tagFieldVisible, setTagFieldVisible] = useState(false);
  const [tagList, setTagList] = useState<Array<{ label: string }>>([]);
  const [tagInputValue, setTagInputValue] = useState<string>('');
  const tagFieldRef = useRef<HTMLInputElement>(null);
  
  // Location state
  const [location, setLocation] = useState<{ lat: number; lng: number; title?: string } | null>(null);
  const [isLocationFetching, setIsLocationFetching] = useState(false);
  
  // Generate poll hours (01-12) and minutes (00-59)
  const pollHours = useMemo(() => {
    const hours: string[] = [];
    for (let c = 1; c <= 12; c++) {
      hours.push(c < 10 ? `0${c}` : `${c}`);
    }
    return hours;
  }, []);
  
  const pollMinutes = useMemo(() => {
    const minutes: string[] = [];
    for (let c = 0; c < 60; c++) {
      minutes.push(c < 10 ? `0${c}` : `${c}`);
    }
    return minutes;
  }, []);

  const isPollMode = pollMode !== 'none';

  // To-field state
  const [toItems, setToItems] = useState<ToItem[]>([]);
  const [toQuery, setToQuery] = useState('');
  const [toFocused, setToFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const toInputRef = useRef<HTMLInputElement>(null);
  const toFieldContRef = useRef<HTMLDivElement>(null);

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
      localPreviewUrl?: string; // Preview URL for images
      file?: File; // Original file object for preview
    }>
  >([]);

  const getFileStorageInfo = () => {
    // Angular reads from: com_convo.sessionData.signInResponseData.file_storage_info
    // Structure: { default_type: 's3', data: { s3: { bucket_name, access_key, s3_policy, s3_signature, https_uploads } } }
    
    // Get loginData dynamically from multiple sources
    const sourceData = getEffectiveLoginData();
    
    let info: any = null;
    
    // 1. Try from sourceData (includes window.com_convo fallback)
    if (sourceData) {
      info = (sourceData as any)?.file_storage_info;
    }
    
    // 2. Check sessionData from useSession hook directly
    if (!info && sessionData) {
      const sessionResponse = sessionData as any;
      info = sessionResponse?.data?.signInResponseData?.file_storage_info;
    }
    
    // 3. Fallback: check window.com_convo.sessionData.signInResponseData directly (Angular compatibility)
    if (!info && typeof window !== 'undefined') {
      const win = window as any;
      info = win?.com_convo?.sessionData?.signInResponseData?.file_storage_info;
    }
    
    if (!info || typeof info !== 'object') {
      return { defaultType: undefined, data: null };
    }
    
    // Angular: defaultType = data.default_type
    const defaultType: string | undefined = info?.default_type || info?.defaultType;
    
    if (!defaultType) {
      return { defaultType: undefined, data: info?.data || null };
    }
    
    // Angular: awsData = data.data[defaultType] (e.g., data.data['s3'])
    // Match CommentEditor's simpler approach
    const data =
      (defaultType && info?.data && typeof info.data === 'object' ? info.data[defaultType] : null) ||
      (defaultType && info?.[defaultType] ? info[defaultType] : null) ||
      (info?.data && typeof info.data === 'object' ? info.data : null) ||
      null;
    
    return { defaultType, data };
  };

  const getS3BucketUrl = () => {
    const { defaultType, data } = getFileStorageInfo();
    if (!defaultType || !data) return null;
    
    if (defaultType.toLowerCase() === 's3') {
    const bucketName = data.bucket_name;
    const httpsUploads = !!data.https_uploads;
    if (!bucketName) return null;
    return `${httpsUploads ? 'https' : 'http'}://${bucketName}.s3.amazonaws.com/`;
    }
    
    // MinIO: server_path + server_port
    if (defaultType.toLowerCase() === 'minio') {
      const serverPath = data.server_path;
      const serverPort = data.server_port;
      if (!serverPath) return null;
      // MinIO endpoint format: https://server_path:port/bucket_name/
      const port = serverPort && serverPort !== '443' && serverPort !== '80' ? `:${serverPort}` : '';
      const protocol = serverPath.startsWith('http') ? '' : 'https://';
      return `${protocol}${serverPath}${port}/${data.bucket_name}/`;
    }
    
    return null;
  };

  const getFileUploadPath = (fileUploadName: string) => {
    // Angular UploadService.getFileUploadPath: account_id/{dir}{noteId}/{fileUploadName}
    // For app_instance_id 6 (notes): account_id/note{noteId}/{fileUploadName}
    // Note: Angular doesn't add "/" between dir and noteId, it's concatenated: "note" + noteId
    
    // Get accountId from multiple sources - compute dynamically
    const sourceData = getEffectiveLoginData();
    let accountId = '';
    if (sourceData) {
      accountId = String((sourceData as any)?.account_id || '');
    }
    if (!accountId && account) {
      accountId = String((account as any)?.account_id || '');
    }
    // Fallback: check window.com_convo.sessionData (Angular compatibility)
    if (!accountId && typeof window !== 'undefined') {
      const win = window as any;
      accountId = String(win?.com_convo?.sessionData?.signInResponseData?.account_id || '');
    }
    
    const appInstanceId: number = 6; // Notes app instance
    let dir = '';
    if (appInstanceId === 4) {
      dir = 'link';
    } else if (appInstanceId === 6) {
      dir = 'note';
    } else if (appInstanceId === 23) {
      dir = 'poll';
    } else if (appInstanceId !== -1) {
      dir = 'note';
    }
    // Angular: return $rootScope.login_data.account_id + "/" + _dir + noteId + "/" + fileId;
    // Note: dir and noteId are concatenated without separator: "note" + noteId
    return `${accountId}/${dir}${noteId}/${fileUploadName}`;
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
    // Angular UploadService.pollForFilesStatus: polls every 3000ms (3 seconds)
    const ids = fileIds.filter(Boolean);
    if (!ids.length) return;

    let pending = new Set(ids);
    for (let attempt = 0; attempt < 40 && pending.size; attempt++) {
      // Angular: serverComm.post("files", { converting_file_ids : fileConversionIds.join() })
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
      // Angular: setTimeout(function() { service.pollForFilesStatus(context); }, 3000);
      if (pending.size) await new Promise((r) => setTimeout(r, 3000));
    }
  };

  const uploadLocalFileAndConvert = async (file: File) => {
    // Ensure loginData is available - compute dynamically to check latest state
    const effectiveLoginData = getEffectiveLoginData();
    if (!effectiveLoginData) {
      // Mark file as failed if loginData is not available
      setAttachedFiles((prev) => {
        const lastFile = prev[prev.length - 1];
        if (lastFile && lastFile.name === file.name) {
          return prev.map((f) => (f.name === file.name && f.status === 'uploading' ? { ...f, status: 'failed' } : f));
        }
        return prev;
      });
      return;
    }

    const max = 20971520; // Angular UploadService.UPLOAD_FILE_LIMIT (20MB)
    if (file.size > max) {
      throw new Error(`The ${file.name} file exceeds the 20 MB attachment limit.`);
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileNameId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
    const fileUploadName = `${fileNameId}.${ext || 'bin'}`;
    
    // Get file storage info and S3 config
    const { defaultType, data } = getFileStorageInfo();
    const bucketUrl = getS3BucketUrl();

    // Create preview URL for images - check both MIME type and file extension
    // Angular uses file.localUrl for preview
    const isImageFile = (file.type && file.type.startsWith('image/')) || 
                        /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.name);
    const localPreviewUrl = isImageFile 
      ? URL.createObjectURL(file)
      : undefined;

    setAttachedFiles((prev) => [
      ...prev,
      { 
        localId, 
        name: file.name, 
        size: file.size || 1, 
        type: ext || 'bin', 
        status: 'uploading', 
        fileNameId, 
        fileUploadName,
        localPreviewUrl,
        file, // Store file for potential retry
      },
    ]);

    // Check storage configuration - must have valid defaultType, bucketUrl, and required data fields
    const storageType = defaultType?.toLowerCase();
    if (!storageType || (storageType !== 's3' && storageType !== 'minio') || !bucketUrl || !data) {
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
      // Don't throw error - just mark as failed and let UI show it
      // This matches Angular behavior where files are shown as failed rather than blocking selection
      return;
    }
    
    // Verify required fields based on storage type
    if (storageType === 's3') {
      // S3 requires: access_key, s3_policy, s3_signature, bucket_name
      if (!data.access_key || !data.s3_policy || !data.s3_signature || !data.bucket_name) {
        setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }
    } else if (storageType === 'minio') {
      // MinIO requires: access_key, secret_key, bucket_name, server_path
      if (!data.access_key || !data.secret_key || !data.bucket_name || !data.server_path) {
        setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }
    }

    const keyPath = getFileUploadPath(fileUploadName);

    let file_url: string;

    // Upload based on storage type
    if (storageType === 's3') {
      // Upload to S3 using presigned POST (Angular awsService.submitFormData)
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

      file_url = `${bucketUrl}${keyPath}`;
    } else if (storageType === 'minio') {
      // MinIO: Use direct S3-compatible API with presigned POST
      // MinIO supports S3-compatible API, so we can use similar approach to S3
      // However, MinIO requires proper AWS signature v4, which is complex to do client-side
      // For now, use a server-side proxy endpoint that handles MinIO uploads
      const form = new FormData();
      form.append('file', file);
      form.append('fileName', fileUploadName);
      form.append('filePath', keyPath);
      form.append('fileType', file.type || 'application/octet-stream');
      form.append('bucketName', data.bucket_name);
      form.append('serverPath', data.server_path);
      form.append('serverPort', data.server_port || '443');
      form.append('accessKey', data.access_key);
      form.append('secretKey', data.secret_key);

      const minioRes = await fetch('/api/v1/files/upload-minio', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!minioRes.ok) {
        setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        throw new Error(`MinIO upload failed: ${minioRes.status}`);
      }

      const minioResult = await minioRes.json();
      file_url = minioResult.file_url || `${bucketUrl}${keyPath}`;
    } else {
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
      return;
    }
    setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'converting' } : f)));

    // Start conversion on backend (Angular UploadService.fileConversionReq via /api/v1/files)
    // Angular payload: { 'file': { item_id, name, file_upload_name, type, size, file_url, file_source, file_access_token, file_preview_url }}
    // Note: Angular does NOT include storage_version or app_instance_id in the conversion request
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

  // Upload poll image (for image poll mode) - similar to uploadLocalFileAndConvert but with poll-specific handling
  const uploadPollImage = async (file: File) => {
    // Check max 7 images limit (Angular: maxFileAllowed: 7)
    if (pollImages.length >= 7) {
      alert('You can add up to 7 images.');
      return;
    }

    // Ensure loginData is available
    const effectiveLoginData = getEffectiveLoginData();
    if (!effectiveLoginData) {
      return;
    }

    // Only allow image files (Angular: fileTypesAllowed: ['image'])
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed for image polls.');
      return;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileNameId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
    const fileUploadName = `${fileNameId}.${ext || 'bin'}`;
    const subResourceId = generateAngularUniqueId30(); // Unique ID for poll option
    
    // Create preview URL
    const localPreviewUrl = URL.createObjectURL(file);

    const pollImage: PollImageFile = {
      localId,
      fileNameId,
      fileUploadName,
      name: file.name,
      size: file.size || 1,
      type: ext || 'bin',
      status: 'uploading',
      subResourceId,
      localPreviewUrl,
      progress: 0,
      imageDesc: '', // Description text for the image option
    };

    setPollImages((prev) => [...prev, pollImage]);
    pollFilesDataRef.current.selectedFilesCount++;
    pollFilesDataRef.current.addedFilesCount++;
    pollFilesDataRef.current.addedFiles.push(pollImage);

    // Get file storage info and S3 config
    const { defaultType, data } = getFileStorageInfo();
    const bucketUrl = getS3BucketUrl();

    const storageType = defaultType?.toLowerCase();
    if (!storageType || (storageType !== 's3' && storageType !== 'minio') || !bucketUrl || !data) {
      setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
      return;
    }

    // Verify required fields
    if (storageType === 's3') {
      if (!data.access_key || !data.s3_policy || !data.s3_signature || !data.bucket_name) {
        setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }
    } else if (storageType === 'minio') {
      if (!data.access_key || !data.secret_key || !data.bucket_name || !data.server_path) {
        setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }
    }

    // Use poll-specific noteId (Angular uses noteId from scope)
    const pollNoteId = noteId;
    const keyPath = getFileUploadPath(fileUploadName);

    let file_url: string;

    // Upload based on storage type (same logic as regular file upload)
    if (storageType === 's3') {
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
        setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }
      file_url = `${bucketUrl}${keyPath}`;
    } else if (storageType === 'minio') {
      const form = new FormData();
      form.append('file', file);
      form.append('fileName', fileUploadName);
      form.append('filePath', keyPath);
      form.append('fileType', file.type || 'application/octet-stream');
      form.append('bucketName', data.bucket_name);
      form.append('serverPath', data.server_path);
      form.append('serverPort', data.server_port || '443');
      form.append('accessKey', data.access_key);
      form.append('secretKey', data.secret_key);

      const minioRes = await fetch('/api/v1/files/upload-minio', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      if (!minioRes.ok) {
        setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }

      const minioResult = await minioRes.json();
      file_url = minioResult.file_url || `${bucketUrl}${keyPath}`;
    } else {
      setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
      return;
    }

    setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'converting' } : f)));

    // Start conversion on backend
    const req = {
      file: {
        item_id: pollNoteId,
        name: file.name,
        file_upload_name: fileUploadName,
        type: ext || 'bin',
        size: file.size || 1,
        file_url,
        file_source: null,
        file_access_token: null,
        file_preview_url: null,
      },
    };

    try {
      const resp = await postFilesEndpoint(req);
      const fileObj = resp?.data?.file || resp?.file;
      if (!fileObj || !fileObj.file_id) {
        console.error('[InlineInsert] Poll image conversion response missing file_id:', resp);
        setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }
      const serverFileId = String(fileObj.file_id);
      const status = String(fileObj?.status || '').toLowerCase();

      setPollImages((prev) =>
        prev.map((f) => {
          if (f.localId === localId) {
            // Ensure file_upload_name is preserved in serverFileObj
            const updatedFileObj = {
              ...fileObj,
              file_upload_name: fileObj.file_upload_name || f.fileUploadName || '',
            };
            return { ...f, serverFileId, serverFileObj: updatedFileObj, status: status === 'success' ? 'success' : 'converting' };
          }
          return f;
        })
      );

      // Poll for conversion status
      if (serverFileId && status !== 'success') {
        const ids = [serverFileId];
        let pending = new Set(ids);
        for (let attempt = 0; attempt < 40 && pending.size; attempt++) {
          const resp = await postFilesEndpoint({ converting_file_ids: Array.from(pending).join() });
          const statusArr: any[] = resp?.data?.files_status || resp?.files_status || [];
          const nextPending = new Set<string>();

          for (const st of statusArr) {
            const id = String(st.file_id);
            const status = String(st.status || '').toLowerCase();
            if (status === 'success') {
              // Use the status object which should contain file details, or fetch if needed
              // The status response from converting_file_ids should include file details
              setPollImages((prev) => {
                const currentImg = prev.find((f) => f.serverFileId === id);
                if (currentImg) {
                  // Merge status response data with existing serverFileObj, preserving file_upload_name
                  const existingFileObj = currentImg.serverFileObj || {};
                  const updatedFileObj = { 
                    ...existingFileObj, 
                    ...st,
                    // Preserve file_upload_name from original state or existing fileObj
                    file_upload_name: existingFileObj.file_upload_name || currentImg.fileUploadName || st.file_upload_name || '',
                  };
                  return prev.map((f) => (f.serverFileId === id ? { ...f, status: 'success', serverFileObj: updatedFileObj } : f));
                }
                return prev;
              });
              pollFilesDataRef.current.completedAndConvertedFilesCount++;
              checkImagePollValidation();
            } else if (status === 'converting') {
              nextPending.add(id);
            } else {
              setPollImages((prev) => prev.map((f) => (f.serverFileId === id ? { ...f, status: 'failed' } : f)));
            }
          }

          pending = nextPending;
          if (pending.size) await new Promise((r) => setTimeout(r, 3000));
        }
      } else if (status === 'success') {
        pollFilesDataRef.current.completedAndConvertedFilesCount++;
        checkImagePollValidation();
      }
    } catch (err) {
      setPollImages((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
    }
  };

  // Check image poll validation (Angular: checkImagePollValidation)
  const checkImagePollValidation = () => {
    const allConverted = pollImages.length >= 2 && 
                         pollFilesDataRef.current.completedAndConvertedFilesCount === pollFilesDataRef.current.addedFilesCount;
    // Validation is checked in canShare useMemo
  };

  // Remove poll image
  const removePollImage = (localId: string) => {
    const image = pollImages.find((img) => img.localId === localId);
    if (image) {
      // Revoke object URL if exists
      if (image.localPreviewUrl) {
        URL.revokeObjectURL(image.localPreviewUrl);
      }
      
      // Update counts
      const index = pollImages.findIndex((img) => img.localId === localId);
      if (index !== -1) {
        pollFilesDataRef.current.addedFilesCount--;
        pollFilesDataRef.current.addedFiles.splice(index, 1);
        if (image.status === 'success') {
          pollFilesDataRef.current.completedAndConvertedFilesCount--;
        }
      }
      
      setPollImages((prev) => prev.filter((img) => img.localId !== localId));
      checkImagePollValidation();
    }
  };

  // Convert external file (Google Drive/Box) to attached file format
  const convertExternalFile = async (fileDetails: {
    name: string;
    size: number;
    type: string;
    file_url: string;
    file_source: string | null;
    file_access_token: string | null;
    file_preview_url: string | null;
    localUrl?: string;
  }) => {
    const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileNameId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
    const ext = (fileDetails.name.split('.').pop() || '').toLowerCase();
    const fileUploadName = `${fileNameId}.${ext || 'bin'}`;

    const newFile = {
      localId,
      name: fileDetails.name,
      size: fileDetails.size || 1,
      type: ext || 'bin',
      status: 'converting' as UploadStatus,
      fileNameId,
      fileUploadName,
      serverFileId: undefined,
      serverFileObj: undefined,
      localPreviewUrl: fileDetails.localUrl,
    };

    setAttachedFiles((prev) => [...prev, newFile]);

    // Start conversion on backend
    const req = {
      file: {
        item_id: noteId,
        name: fileDetails.name,
        file_upload_name: fileUploadName,
        type: ext || 'bin',
        size: fileDetails.size || 1,
        file_url: fileDetails.file_url,
        file_source: fileDetails.file_source,
        file_access_token: fileDetails.file_access_token,
        file_preview_url: fileDetails.file_preview_url,
      },
    };

    try {
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
    } catch (err) {
      console.error('[InlineInsert] External file conversion failed:', err);
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
    }
  };

  // Initialize Google Drive Picker
  const initializeGoogleDrive = useCallback(async () => {
    if (!active) return;
    
    const developerKey = 'AIzaSyAUhLtPqg_buEVOEtzHwHSIGabtJuIT2DY';
    const clientId = '275461782742-da796gpica1pgn8n3n41lq7f76taoafi.apps.googleusercontent.com';
    const scope = 'https://www.googleapis.com/auth/drive.readonly';

    // Load Google API scripts if not already loaded
    if (!(window as any).gapi) {
      const script1 = document.createElement('script');
      script1.src = 'https://apis.google.com/js/api.js';
      script1.async = true;
      await new Promise((resolve, reject) => {
        script1.onload = () => {
          // Wait a bit for gapi to be fully initialized
          setTimeout(resolve, 200);
        };
        script1.onerror = reject;
        document.head.appendChild(script1);
      });
    }

    if (!(window as any).google) {
      const script2 = document.createElement('script');
      script2.src = 'https://apis.google.com/js/picker.js';
      script2.async = true;
      await new Promise((resolve, reject) => {
        script2.onload = () => {
          // Wait a bit for google to be fully initialized
          setTimeout(resolve, 200);
        };
        script2.onerror = reject;
        document.head.appendChild(script2);
      });
    }

    const gapi = (window as any).gapi;
    if (!gapi) {
      console.error('[InlineInsert] Google API (gapi) not loaded');
      alert('Google API script not loaded yet. Please refresh.');
      return;
    }

    try {
      // Load client:auth2 first (CommentEditor pattern)
      await new Promise<void>((resolve) => {
        if (gapi.load) {
          gapi.load('client:auth2', resolve);
        } else {
          resolve();
        }
      });
      
      // Load picker API using callback pattern (CommentEditor pattern)
      await new Promise<void>((resolve) => {
        if (gapi.load) {
          gapi.load('picker', { callback: resolve });
        } else {
          resolve();
        }
      });
      
      // Load Drive API v2 using callback pattern
      await new Promise<void>((resolve) => {
        if (gapi.client && gapi.client.load) {
          gapi.client.load('drive', 'v2', resolve);
        } else {
          resolve();
        }
      });

      // Initialize auth2 (CommentEditor pattern)
      const auth2 = gapi.auth2 ? gapi.auth2.getAuthInstance() || gapi.auth2.init({ 
        client_id: clientId, 
        fetch_basic_profile: false, 
        scope 
      }) : null;
      
      if (!auth2) {
        console.error('[InlineInsert] Failed to initialize Google Auth2');
        return;
      }

      let oauthToken: string | null = null;
      try {
        const signInRes = await auth2.signIn({ 
          prompt: 'select_account', 
          fetch_basic_profile: false, 
          scope 
        });
        
        oauthToken = auth2.currentUser.get().getAuthResponse(true).access_token;
      } catch (signInError: any) {
        // User canceled or auth failed - silently return (Angular pattern)
        if (signInError?.error === 'popup_closed_by_user' || signInError?.error === 'access_denied') {
          return; // User canceled, don't show error
        }
        console.error('[InlineInsert] Google Drive sign-in failed:', signInError);
        return;
      }
      
      if (!oauthToken || !(window as any).google?.picker) {
        alert('Google Drive authorization failed.');
        return;
      }

      const google = (window as any).google;
      const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .addView(google.picker.ViewId.DOCS)
        .setOAuthToken(oauthToken)
        .setDeveloperKey(developerKey)
        .setCallback((docs: any) => {
          if (docs[google.picker.Response.ACTION] === google.picker.Action.CANCEL) {
            // User canceled picker - silently return (Angular pattern)
            return;
          }
          
          if (docs[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
            const selectedDocs = docs[google.picker.Response.DOCUMENTS];
            const numFiles = selectedDocs.length;
            const files: any[] = [];

            selectedDocs.forEach((doc: any) => {
              const id = doc[google.picker.Document.ID];
              const request = gapi.client.drive.files.get({ fileId: id });

              request.execute((resp: any) => {
                const file: any = {};

                if (resp.exportLinks?.['application/pdf']) {
                  file.link = resp.exportLinks['application/pdf'];
                  file.name = resp.title + '.pdf';
                } else if (resp.downloadUrl) {
                  file.link = resp.downloadUrl;
                  file.name = resp.originalFilename || resp.title;
                } else {
                  file.link = resp.alternateLink;
                  file.name = resp.originalFilename || resp.title;
                }

                file.source = 'GOOGLE_DRIVE';
                file.previewLink = resp.alternateLink;
                file.fileAccessToken = oauthToken;
                file.thumbnailLink = resp.thumbnailLink;
                file.bytes = resp.fileSize || 0;

                files.push(file);

                if (files.length === numFiles) {
                  files.forEach((f) => {
                    const fileDetails = {
                      name: f.name,
                      size: f.bytes || 1,
                      type: f.name.substr(f.name.lastIndexOf('.') + 1).toLowerCase(),
                      file_url: f.link,
                      file_source: f.source,
                      file_access_token: f.fileAccessToken,
                      file_preview_url: f.previewLink,
                      localUrl: f.thumbnailLink,
                    };
                    convertExternalFile(fileDetails);
                  });
                }
              });
            });
          }
        })
        .build();

      picker.setVisible(true);
    } catch (err: any) {
      // Only log if it's not a user cancellation
      if (err?.error !== 'popup_closed_by_user' && err?.error !== 'access_denied' && err?.error !== 'user_cancelled') {
        console.error('[InlineInsert] Google Drive initialization failed:', err);
      }
    }
  }, [active, convertExternalFile]);

  // Initialize Box Select
  const initializeBox = useCallback(async () => {
    if (!active) return;

    // Load Box Select SDK if not already loaded
    if (!(window as any).BoxSelect) {
      const script = document.createElement('script');
      script.src = 'https://app.box.com/js/static/select.js';
      script.async = true;
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const CONVO_BOX_APP_ID = 'addpyhjq1e097z9o4qcg47hmvanbhj1m';
    const options = {
      clientId: CONVO_BOX_APP_ID,
      linkType: 'direct' as const,
      multiselect: true,
    };

    const BoxSelect = (window as any).BoxSelect;
    if (!BoxSelect) {
      console.error('[InlineInsert] Box Select SDK not loaded');
      return;
    }

    // Create instance first, then check browser support (Angular pattern)
    const boxSelect = new BoxSelect(options);
    
    if (!boxSelect.isBrowserSupported || !boxSelect.isBrowserSupported()) {
      console.error('[InlineInsert] Box Select not supported');
      return;
    }

    boxSelect.success((response: any[]) => {
      const files: any[] = [];
      response.forEach((resp: any) => {
        files.push({
          source: 'BOX',
          link: resp.url,
          bytes: resp.size,
          name: resp.name,
        });
      });

      files.forEach((f) => {
        const fileDetails = {
          name: f.name,
          size: f.bytes || 1,
          type: f.name.substr(f.name.lastIndexOf('.') + 1).toLowerCase(),
          file_url: f.link,
          file_source: f.source,
          file_access_token: null,
          file_preview_url: null,
        };
        convertExternalFile(fileDetails);
      });

      boxSelect.unregister(boxSelect.SUCCESS_EVENT_TYPE);
      boxSelect.unregister(boxSelect.CANCEL_EVENT_TYPE);
    });

    boxSelect.cancel(() => {
      boxSelect.unregister(boxSelect.SUCCESS_EVENT_TYPE);
      boxSelect.unregister(boxSelect.CANCEL_EVENT_TYPE);
    });

    boxSelect.launchPopup();
  }, [active]);

  // Remove location
  const onRemoveLocation = useCallback(() => {
    setLocation(null);
  }, []);

  // Toggle tags field
  const toggleTagsField = useCallback(() => {
    if (!active) return;
    setTagFieldVisible((prev) => !prev);
    if (!tagFieldVisible) {
      setTimeout(() => {
        tagFieldRef.current?.focus();
      }, 0);
    }
  }, [active, tagFieldVisible]);

  // Add tag from input
  const addTag = useCallback((tagText: string) => {
    const trimmed = tagText.trim();
    if (!trimmed) return;
    
    // Check if tag already exists
    if (tagList.some((t) => t.label.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    
    setTagList((prev) => [...prev, { label: trimmed }]);
    setTagInputValue('');
  }, [tagList]);

  // Remove tag
  const removeTag = useCallback((index: number) => {
    setTagList((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Get geolocation
  const onLocationPinClick = useCallback(async () => {
    if (!active) return;

    if (location && location.lat && location.lng) {
      // If location exists, remove it (toggle behavior)
      setLocation(null);
      return;
    }

    setIsLocationFetching(true);

    const timeout = setTimeout(() => {
      setIsLocationFetching(false);
      alert('Location could not be fetched. Please try again.');
    }, 10000);

    try {
      if (!navigator.geolocation) {
        clearTimeout(timeout);
        setIsLocationFetching(false);
        alert('Geolocation is not supported by your browser.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(timeout);
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Reverse geocode to get address (Angular pattern)
          // Angular loads Google Maps API from index.php with key: AIzaSyC764tr6nZnnVR0no-hgsiqCHGQHmaNrQU
          let title = '';
          try {
            // Wait for Google Maps API to be available (Angular loads it from index.php with key: AIzaSyC764tr6nZnnVR0no-hgsiqCHGQHmaNrQU)
            let google = (window as any).google;
            let attempts = 0;
            const maxAttempts = 50; // Wait up to 5 seconds (Angular loads it asynchronously)
            
            console.log('[InlineInsert] Waiting for Google Maps API...');
            while ((!google || !google.maps || !google.maps.Geocoder) && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 100));
              google = (window as any).google;
              attempts++;
              if (attempts % 10 === 0) {
                console.log(`[InlineInsert] Still waiting for Google Maps API... attempt ${attempts}/${maxAttempts}`);
              }
            }

            if (google && google.maps && google.maps.Geocoder) {
              console.log('[InlineInsert] Google Maps API found, starting geocoding for:', lat, lng);
              const geocoder = new google.maps.Geocoder();
              const latlng = { lat, lng };
              
              // Use Promise wrapper to ensure geocoding completes
              await new Promise<void>((resolve) => {
                geocoder.geocode({ location: latlng }, (results: any[], status: string) => {
                  console.log('[InlineInsert] Geocoding callback - status:', status, 'results count:', results?.length);
                  let geocodeTitle = '';
                  if (status === 'OK' && results && results[0]) {
                    geocodeTitle = results[0].formatted_address;
                    console.log('[InlineInsert] Geocoding success, title:', geocodeTitle);
                  } else {
                    // Geocoding failed or no results - use empty title (will show lat/lng)
                    console.log('[InlineInsert] Geocoding failed - status:', status, 'results:', results);
                    geocodeTitle = '';
                  }
                  console.log('[InlineInsert] Setting location with title:', geocodeTitle);
                  setLocation({ lat, lng, title: geocodeTitle });
                  setIsLocationFetching(false);
                  resolve();
                });
              });
            } else {
              // Google Maps not available after waiting - use coordinates (Angular graceful fallback)
              console.warn('[InlineInsert] Google Maps API not available after waiting, using coordinates. Google object:', google);
              setLocation({ lat, lng, title: '' });
              setIsLocationFetching(false);
            }
          } catch (err) {
            // Geocoding failed - use coordinates (Angular graceful fallback)
            console.warn('[InlineInsert] Geocoding error:', err);
            setLocation({ lat, lng, title: '' });
            setIsLocationFetching(false);
          }
        },
        (error) => {
          clearTimeout(timeout);
          setIsLocationFetching(false);
          if (error.code === 1) {
            alert('Location permission denied. Please enable location access.');
          } else {
            alert('Failed to get location. Please try again.');
          }
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    } catch (err) {
      clearTimeout(timeout);
      setIsLocationFetching(false);
      console.error('[InlineInsert] Location error:', err);
    }
  }, [active, location]);

  // Legacy parity: see Angular `web_app/src/index.php` where these globals are defined at page load.
  const legacyMessagesArray = useMemo(
    () => [
      'Your story starts here.',
      'Got images or files to share? Drag them here.',
      'Paste an image from your clipboard to share.',
      'Use # to tag your post.',
      'Use @ to tag a teammate or group.',
      "Put a smile on your team's face. Share a GIF.",
      'Share files directly from Dropbox, Google Drive, Box.',
      'Just read a great article? Paste the URL here.',
    ],
    []
  );

  // Use stable initial value for SSR hydration (always the same on server and client)
  const [placeholderText, setPlaceholderText] = useState<string>(legacyMessagesArray[0]);
  const [isMounted, setIsMounted] = useState(false);

  const myUserId = String((user as any)?.user_id || (user as any)?.userId || '');

  // Set mounted flag after hydration completes
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
        setCalendarDisplayed(false);
      }
    };

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isCalendarOpen]);

  // Angular behavior:
  // - base placeholder is window.inlineInsertPlaceholderText (or contextual "Share something with X.")
  // - dummy placeholder text is also rotated daily via window.messagesArray when NOT active
  useEffect(() => {
    // Only run after component has mounted on client to avoid hydration mismatch
    if (typeof window === 'undefined' || !isMounted) return;
    const w: any = window as any;

    // Ensure window.messagesArray exists (Angular `index.php`: `var messagesArray = [...]`)
    if (!Array.isArray(w.messagesArray) || w.messagesArray.length === 0) {
      w.messagesArray = legacyMessagesArray.slice();
    }

    // Check if window.inlineInsertPlaceholderText already exists (from previous page load or external script)
    // Handle case where it might be an HTML element by converting to string
    const existingPlaceholder = w?.inlineInsertPlaceholderText;
    if (existingPlaceholder != null) {
      const placeholderStr = typeof existingPlaceholder === 'string' 
        ? existingPlaceholder.trim() 
        : String(existingPlaceholder).trim();
      if (placeholderStr && placeholderStr !== '[object HTMLSpanElement]' && placeholderStr !== '[object Object]') {
        setPlaceholderText(placeholderStr);
        // Ensure it's stored as a string
        w.inlineInsertPlaceholderText = placeholderStr;
        return; // Don't pick random if we already have a valid placeholder
      }
    }

    // Legacy: pick a random message on every page load and set BOTH:
    // - dummy placeholder text
    // - window.inlineInsertPlaceholderText (used by cnv-editor placeholder)
    const messages: any[] = Array.isArray(w.messagesArray) ? w.messagesArray : [];
    if (messages.length > 0) {
      const initialIdx = Math.floor(Math.random() * messages.length);
      const initialMsg = String(messages[initialIdx] || '').trim();
      if (initialMsg) {
        w.inlineInsertPlaceholderText = initialMsg;
        setPlaceholderText(initialMsg);
      }
    }

    const pickRandom = () => {
      if (messages.length === 0) return;
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
  }, [active, legacyMessagesArray, isMounted]);

  // Fetch Giphy results when popover is shown or query changes
  const fetchGiphy = async (q: string) => {
    const query = q.trim();
    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&rating=pg&limit=24`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&rating=pg&limit=24`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      const items = (json?.data || []).map((g: any) => ({
        id: String(g.id),
        preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url || g.images?.original?.url,
        original: g.images?.original?.url || g.images?.fixed_width?.url,
      }));
      setGiphyResults(items.filter((x: any) => x.preview && x.original));
    } catch (err) {
      console.error('[InlineInsert] Giphy fetch failed:', err);
      setGiphyResults([]);
    }
  };

  // Attach GIF as file (downloads from Giphy URL and adds to attachedFiles)
  const attachGifAsFile = async (gifUrl: string, gifId: string) => {
    try {
      // Download the GIF from Giphy
      const response = await fetch(gifUrl);
      if (!response.ok) {
        throw new Error(`Failed to download GIF: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Extract filename from URL or use gifId
      const urlParts = gifUrl.split('/');
      const urlFilename = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
      const filename = urlFilename.endsWith('.gif') ? urlFilename : `${gifId}.gif`;
      
      // Create a File object from the blob
      const file = new File([blob], filename, { type: 'image/gif' });
      
      // Close Giphy popover
      setShowGiphy(false);
      setGiphyQuery('');
      
      // Upload the file using the same flow as regular file attachments
      await uploadLocalFileAndConvert(file);
    } catch (err) {
      // Error is already handled in uploadLocalFileAndConvert (sets status to 'failed')
      setShowGiphy(false);
      setGiphyQuery('');
    }
  };

  // Fetch Giphy when popover is shown or query changes
  useEffect(() => {
    if (!showGiphy) return;
    fetchGiphy(giphyQuery).catch(() => setGiphyResults([]));
  }, [showGiphy, giphyQuery]);

  // Close Giphy popover when clicking outside
  useEffect(() => {
    if (!showGiphy) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (giphyPopoverRef.current && !giphyPopoverRef.current.contains(e.target as Node)) {
        setShowGiphy(false);
        setGiphyQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGiphy]);

  // Close "To" autocomplete dropdown when clicking outside the To-field (Angular behavior)
  useEffect(() => {
    if (!active) return;

    const handleMouseDown = (e: MouseEvent) => {
      const root = toFieldContRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      // If click happened outside To-field container, hide dropdown only (don't deactivate editor)
      if (target && !root.contains(target)) {
        setToFocused(false);
        setActiveIndex(0);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [active]);

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
          const title = String(g.title || g.group_title || g.name || '').trim();
          // Don't show groups with no title (Angular UI never shows blank/ID-only groups)
          if (!id || !title) return null;
          // Angular template shows a secondary line; for groups we show "Group" for parity with our prior "meta".
          return { id, type: 'GROUP', label: title, secondaryLabel: 'Group' } as ToItem;
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
    // Reset textChoices when deactivating
    setTextChoices(['']);
    // Don't auto-focus To field on activation - let user click on it to open dropdown
    // Angular doesn't auto-focus on activation either
  };

  // Open editor in new tab/window - matches Angular openWithDetailsView
  const openWithDetailsView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get account ID - matches Angular pattern: acc-{accountId}
    const accountId = String((account as any)?.account_id || (loginData as any)?.account_id || '');
    if (!accountId) {
      console.error('Cannot open expanded editor: account ID not found');
      return;
    }
    
    // App instance ID for notes is 6
    const appInstanceId = 6;
    
    // Create URL matching Angular pattern: /v1/acc-{accountId}/apps/{appInstanceId}/messages/{noteId}#title={title}
    const accountIdWithPrefix = accountId.startsWith('acc-') ? accountId : `acc-${accountId}`;
    const encodedTitle = encodeURIComponent(title || 'Untitled note');
    const url = `/v1/${accountIdWithPrefix}/apps/${appInstanceId}/messages/${noteId}#title=${encodedTitle}`;
    
    // Open in new tab - Angular opens in new window/tab
    window.open(url, '_blank');
  };

  // Helper to trigger file input click - used by closed state attach button
  // Angular: onDummyTextAreaUploadIconClick triggers .file-input click
  // The hidden file input is always available, so we can use it immediately
  const triggerFileInputClick = () => {
    // Use hidden file input (always available) for closed state
    // After activation, the bottomBarFileInputRef will be used
    if (hiddenFileInputRef.current) {
      // Reset the flag before clicking
      isOpeningFileDialogRef.current = true;
      hiddenFileInputRef.current.click();
    } else {
      // Fallback: if hidden input not available, wait a bit and try bottomBarFileInputRef
    setTimeout(() => {
        if (bottomBarFileInputRef.current) {
          isOpeningFileDialogRef.current = true;
          bottomBarFileInputRef.current.click();
        }
      }, 50);
    }
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
    // Reset poll options when deactivating
    setTextChoices(['']);
    // Clean up poll images preview URLs before clearing
    pollImages.forEach((img) => {
      if (img.localPreviewUrl) {
        URL.revokeObjectURL(img.localPreviewUrl);
      }
    });
    setPollImages([]);
    pollFilesDataRef.current = {
      selectedFilesCount: 0,
      addedFilesCount: 0,
      completedAndConvertedFilesCount: 0,
      addedFiles: [],
    };
    setAllowViewResults(false);
    setPollEndDateAllowed(false);
    setSelectedHour('hh');
    setSelectedMinute('mm');
    setTimeFormat('AM');
    setPollEndDate(null);
    setIsHrsDropdownDisplayed(false);
    setIsMinsDropdownDisplayed(false);
    setIsCalendarOpen(false);
    setCalendarDisplayed(false);
    // Clean up preview URLs before clearing files
    attachedFiles.forEach((f) => {
      if (f.localPreviewUrl) {
        URL.revokeObjectURL(f.localPreviewUrl);
      }
    });
    setAttachedFiles([]);
    setValidSharingInfo(true);
    setTagFieldVisible(false);
    setTagList([]);
    setTagInputValue('');
    setLocation(null);
    setIsLocationFetching(false);

    // Reset editor content (Angular deactivates/destroys editor scope; we just clear contents)
    try {
      if (quillRef.current) {
        // Clean up Escape key handler
        if ((quillRef.current as any)._escapeHandler) {
          const editorRoot = quillRef.current.root;
          if (editorRoot) {
            editorRoot.removeEventListener('keydown', (quillRef.current as any)._escapeHandler);
          }
          delete (quillRef.current as any)._escapeHandler;
        }
        
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

  // Text poll functions
  const addTextChoice = useCallback(() => {
    setTextChoices((prev) => {
      if (prev[prev.length - 1]?.trim() !== '' && prev.length < 11) {
        return [...prev, ''];
      }
      return prev;
    });
  }, []);

  const removeTextChoice = useCallback((index: number) => {
    setTextChoices((prev) => {
      if (prev.length > 1) {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      }
      return prev;
    });
  }, []);

  const updateTextChoice = useCallback((index: number, value: string) => {
    setTextChoices((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const canShare = useMemo(() => {
    const hasRecipients = toItems.length > 0;
    
    // Text poll validation: need at least 2 non-empty choices + title + recipients
    if (pollMode === 'text') {
      const validChoices = textChoices.filter((c) => c.trim().length > 0);
      return hasRecipients && validChoices.length >= 2 && title.trim().length > 0;
    }
    
    // Image poll validation: need at least 2 images, all converted, title + recipients
    if (pollMode === 'image') {
      const allConverted = pollImages.length >= 2 && 
                           pollFilesDataRef.current.completedAndConvertedFilesCount === pollFilesDataRef.current.addedFilesCount;
      return hasRecipients && allConverted && title.trim().length > 0;
    }
    
    // Regular post validation
    const hasText = bodyText.trim().length > 0 || title.trim().length > 0;
    const hasFiles = attachedFiles.some((f) => f.status === 'success');
    return hasRecipients && (hasText || hasFiles);
  }, [toItems, bodyText, title, attachedFiles, pollMode, textChoices, pollImages]);

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
    const effectiveLoginData = getEffectiveLoginData();
    if (!effectiveLoginData || !user || !account) return;
    if (!toItems.length) {
      setValidSharingInfo(false);
      return;
    }
    if (!canShare) return;

    setSharing(true);
    try {
      // Handle poll creation (text or image)
      if (pollMode === 'text' || pollMode === 'image') {
        // Generate poll note ID (Angular: "pol-" + utils.generateGuid())
        const pollNoteId = `pol-${generateAngularUniqueId30()}`;
        
        // Calculate end_date if poll end date is enabled
        let endDate = 0;
        if (pollEndDateAllowed && pollEndDate && selectedHour !== 'hh' && selectedMinute !== 'mm') {
          const selectedHrs = parseInt(selectedHour) % 12;
          const selHour = timeFormat === 'PM' ? selectedHrs + 12 : selectedHrs;
          endDate = new Date(pollEndDate).setHours(selHour, parseInt(selectedMinute), 0);
        }

        let pollData: any = {
          method: 'createPoll',
          title,
          item_id: pollNoteId,
          type: pollMode === 'image' ? 'image' : 'text',
          can_user_view_result: allowViewResults ? 1 : 0,
          poll_can_end: pollEndDateAllowed ? 1 : 0,
          end_date: endDate,
          ivl: null,
          permissions: 3, // Angular default for polls
          tags: '',
          mappings: buildMappings(),
        };

        if (pollMode === 'text') {
          const validChoices = textChoices.filter((c) => c.trim().length > 0);
          if (validChoices.length < 2) {
            setSharing(false);
            return;
          }
          pollData.options = validChoices.map((choice) => ({
            text: choice.trim(),
            option_id: generateAngularUniqueId30(),
          }));
        } else if (pollMode === 'image') {
          // Image poll: need at least 2 images, all converted
          if (pollImages.length < 2 || pollFilesDataRef.current.completedAndConvertedFilesCount !== pollFilesDataRef.current.addedFilesCount) {
            setSharing(false);
            return;
          }
          
          // Build options from poll images (Angular: for(var i=0; i<$scope.pollFiles.length; i++))
          pollData.files = [];
          pollData.options = pollImages
            .filter((img) => img.status === 'success' && img.serverFileId)
            .map((img) => {
              const fileObj = img.serverFileObj || {};
              // Ensure file_upload_name is available - prioritize from state, then fileObj
              const fileUploadName = img.fileUploadName || fileObj.file_upload_name || '';
              if (!fileUploadName) {
                console.error('[InlineInsert] Missing file_upload_name for poll image:', img);
              }
              return {
                option_id: img.subResourceId || generateAngularUniqueId30(),
                text: img.imageDesc || `Option ${pollImages.indexOf(img) + 1}`,
                file: {
                  file_id: img.serverFileId,
                  name: img.name,
                  file_upload_name: fileUploadName,
                  type: img.type,
                  size: img.size,
                  file_url: fileObj.file_url || '',
                  file_source: fileObj.file_source || null,
                  file_access_token: fileObj.file_access_token || null,
                  file_preview_url: fileObj.file_preview_url || null,
                },
              };
            });
        }

        // Angular uses serverComm.post('poll', data) which maps to /api/v1/poll
        const res = await fetch('/api/v1/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(pollData),
        });

        const text = await res.text();
        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          json = { error: text };
        }

        if (!res.ok) {
          throw new Error(json?.error || json?.message || `Failed to create poll: ${res.status}`);
        }

        queryClient.invalidateQueries({ queryKey: ['feed'] });
        deactivate();
        return;
      }

      // Regular note creation
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
        tags: tagList.map((t) => t.label).join(','), // Include tags from tag field (comma-separated)
        mappings: buildMappings(),
        auto_save: 0,
        permissions: 7, // Angular initPostPermissions default
        is_acknowledge_post: 0,
        ivl: null, // Angular: $scope.ivl (initialized to null)
      };

      // Only include location if it exists and has valid lat/lng (Angular pattern)
      if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
        (reqData as any).location = {
          lat: location.lat,
          lng: location.lng,
          title: location.title || '',
        };
      }

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

  // For expanded editor mode, create editor host div below toolbar
  useEffect(() => {
    if (!isExpandedEditorRoute || !active) return;
    if (pollMode === 'text' || pollMode === 'image') return;
    
    const toolbarElement = document.querySelector('#notes-app-editor-toolbar');
    if (!toolbarElement) return;
    
    // Find or create the editor container below toolbar
    let editorContainer = toolbarElement.nextElementSibling as HTMLElement;
    if (!editorContainer || !editorContainer.classList.contains('body')) {
      // Create the editor container
      editorContainer = document.createElement('div');
      editorContainer.className = 'body cnv-notes-app-specific edit-mode';
      editorContainer.style.marginTop = '10px';
      toolbarElement.parentNode?.insertBefore(editorContainer, toolbarElement.nextSibling);
    }
    
    // Create editor host div if it doesn't exist
    let editorHostDiv = editorContainer.querySelector('.inline-insert-editor') as HTMLElement;
    if (!editorHostDiv) {
      editorHostDiv = document.createElement('div');
      editorHostDiv.className = 'inline-insert-editor';
      editorContainer.appendChild(editorHostDiv);
    }
    
    // Create the actual editor host div
    let hostDiv = editorHostDiv.querySelector('div[data-editor-host]') as HTMLElement;
    if (!hostDiv) {
      hostDiv = document.createElement('div');
      hostDiv.setAttribute('data-editor-host', 'true');
      editorHostDiv.appendChild(hostDiv);
    }
    
    // Set the ref to point to this div
    if (editorHostRef.current !== hostDiv) {
      (editorHostRef as any).current = hostDiv;
    }
    
    return () => {
      // Cleanup: remove the editor container if component unmounts
      // But don't remove it if Quill is initialized (it needs to stay)
      if (!quillRef.current && editorContainer && editorContainer.parentNode) {
        editorContainer.remove();
      }
    };
  }, [isExpandedEditorRoute, active, pollMode]);

  // Initialize Quill when the inline insert becomes active (but not for poll modes).
  useEffect(() => {
    if (!active) return;
    if (pollMode === 'text' || pollMode === 'image') return; // Don't initialize Quill for poll modes
    if (quillRef.current) return;
    if (!editorHostRef.current) return;

    let cancelled = false;

    (async () => {
      const Quill = await ensureQuillLoaded();
      if (!Quill || cancelled) return;
      if (!editorHostRef.current) return;

      // IMPORTANT: the toolbar element must exist in DOM before Quill init.
      // We render it whenever active, and just hide/show via toolbarActive state.
      // In expanded editor (NotesApp), use notes-app-editor-toolbar instead
      const toolbarId = isExpandedEditorRoute ? '#notes-app-editor-toolbar' : '#inline-insert-toolbar';
      
      // Wait for toolbar to be in DOM (especially important for NotesApp)
      const toolbarElement = document.querySelector(toolbarId);
      if (!toolbarElement && isExpandedEditorRoute) {
        // Wait a bit for React to render the toolbar
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const q = new Quill(editorHostRef.current, {
        theme: 'snow',
        // Use the appropriate toolbar container based on context
        modules: {
          toolbar: toolbarId,
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
      
      // Angular: onEscKeyPressInTextEditor handles Escape key in editor
      // Add keyboard handler for Escape key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          deactivate();
        }
      };
      
      // Attach keyboard handler to Quill editor root
      const editorRoot = q.root;
      if (editorRoot) {
        editorRoot.addEventListener('keydown', handleKeyDown);
        // Store handler for cleanup
        (q as any)._escapeHandler = handleKeyDown;
      }
      
      sync();
      
      // Focus the editor after initialization (Angular: editorInitialized callback may focus)
      // Use setTimeout to ensure DOM is ready and Quill is fully initialized
      setTimeout(() => {
        try {
          if (q && q.root) {
            // Focus the Quill editor - this will place cursor in the editor
            q.focus();
            // Set cursor to the beginning of the editor
            q.setSelection(0, 'user');
          }
        } catch (err) {
          // Ignore focus errors (e.g., if component unmounted)
        }
      }, 0);
    })().catch((e) => {
      console.error('[InlineInsert] Failed to init Quill:', e);
    });

    return () => {
      cancelled = true;
      // Clean up Escape key handler
      if (quillRef.current && (quillRef.current as any)._escapeHandler) {
        const editorRoot = quillRef.current.root;
        if (editorRoot) {
          editorRoot.removeEventListener('keydown', (quillRef.current as any)._escapeHandler);
        }
        delete (quillRef.current as any)._escapeHandler;
      }
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
      // Clean up Escape key handler
      if ((quillRef.current as any)._escapeHandler) {
        const editorRoot = quillRef.current.root;
        if (editorRoot) {
          editorRoot.removeEventListener('keydown', (quillRef.current as any)._escapeHandler);
        }
        delete (quillRef.current as any)._escapeHandler;
      }
      
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
    <>
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes attachment-enter-left-to-right-sequence {
          0% {
            transform: scale(1.35, 1.35);
            opacity: 0.25;
          }
          60% {
            opacity: 1;
            transform: scale(0.98, 0.98);
          }
          100% {
            opacity: 1;
            transform: scale(1, 1);
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .attachment-box:hover .remove-file {
          display: block !important;
        }
      `}</style>
    <div className={`inline-insert-cont ${active ? 'active' : ''}`}>
        {/* Hidden file input - always available for closed state attach button */}
        <input
          ref={hiddenFileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={async (e) => {
            const input = e.target as HTMLInputElement;
            const files = Array.from(input.files || []);
            // Reset input value immediately to allow selecting same file again
            input.value = '';
            // Reset the flag since file selection is complete
            isOpeningFileDialogRef.current = false;
            
            // Ensure loginData is available before processing files
            const effectiveLoginData = getEffectiveLoginData();
            if (!effectiveLoginData) {
              // If loginData is not available, mark files as failed
              for (const f of files) {
                const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
                const ext = (f.name.split('.').pop() || '').toLowerCase();
                const fileNameId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
                const fileUploadName = `${fileNameId}.${ext || 'bin'}`;
                setAttachedFiles((prev) => [
                  ...prev,
                  { localId, name: f.name, size: f.size || 1, type: ext || 'bin', status: 'failed', fileNameId, fileUploadName },
                ]);
              }
              return;
            }
            
            // Process files - uploadLocalFileAndConvert will handle storage configuration errors
            for (const f of files) {
              try {
                await uploadLocalFileAndConvert(f);
              } catch (err) {
                // Error is already handled in uploadLocalFileAndConvert (sets status to 'failed')
              }
            }
          }}
        />

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
          <div 
            className="dummy-area-cont"
            style={{
              // Ensure position relative for absolute positioning of attach button
              position: 'relative',
            }}
          >
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
                // Angular: onDummyTextAreaUploadIconClick triggers file input click
                // The click event bubbles to parent onDummyTextAreaClick which activates
                // So we trigger file input here, and activate the component
                e.stopPropagation();
                // Activate the component first
                activate();
                // Then trigger file input (hidden input is always available at top level)
                // Use a small delay to ensure activation completes
                setTimeout(() => {
                  triggerFileInputClick();
                }, 0);
              }}
              role="button"
              tabIndex={0}
              style={{
                // Match Angular CSS: position absolute, vertically centered
                // dummy-text-area is 40px tall, icon is 20px tall, so center at (40-20)/2 = 10px
                // But Angular uses 17px, which might account for line-height alignment
                // Use transform to perfectly center vertically
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                right: '15px',
                zIndex: 1,
                display: 'block',
                width: '20px',
                height: '20px',
                cursor: 'pointer',
                opacity: 0.8,
              }}
            />
          </div>
        </div>
      )}

      {/* Active composer */}
      {active && (
        <div className="inline-insert-active-cont-wrapper">
          <div ref={toFieldContRef} className={`to-field-cont ${validSharingInfo ? 'valid' : 'invalid'}`}>
            <div className="to-field">
              <div 
                className={`tags ${toItems.length === 0 && toQuery.length === 0 ? 'no-suggestion' : ''} ${toFocused ? 'focused' : ''}`}
                onClick={() => {
                  // Click anywhere in tags div to focus input
                  if (!toFocused) {
                    toInputRef.current?.focus();
                    setToFocused(true);
                  }
                }}
                style={{
                  ...(isExpandedEditorRoute ? {
                    // Let CSS handle most styles for expanded editor route
                    // Only override what's absolutely necessary
                    boxShadow: toFocused && !validSharingInfo ? '0px 0px 0px 1px #f26d54 !important' : 'none',
                  } : {
                    // Inline editor styles
                    WebkitTextSizeAdjust: '100%',
                    WebkitTapHighlightColor: 'rgba(0,0,0,0)',
                    wordBreak: 'break-word',
                    WebkitFontSmoothing: 'antialiased',
                    fontSize: '14px',
                    color: '#272b2c',
                    fontFamily: "'Source Sans Pro','ConvoEmojiWin81',sans-serif !important",
                    lineHeight: '18px',
                    boxSizing: 'border-box',
                    boxShadow: toFocused && !validSharingInfo ? '0px 0px 0px 1px #f26d54 !important' : 'none',
                    overflow: 'hidden',
                    wordWrap: 'break-word',
                    cursor: 'text',
                    backgroundColor: 'white',
                    height: '100%',
                    maxHeight: '130px',
                    overflowY: 'auto',
                    borderRadius: 'inherit',
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    border: 'none',
                  }),
                } as any}
              >
                {/* pre-placeholder - shows "To:" always */}
                <span className="pre-placeholder">To:</span>
                
                {/* tag-list */}
                <ul className="tag-list" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'inline' }}>
                  {toItems.map((t) => {
                    // Determine icon class for groups (Angular uses tag.classes)
                    const iconClass = t.type === 'GROUP' ? 'group privateGroup_icon-lightgray' : '';
                    return (
                      <li 
                        key={`${t.type}:${t.id}`} 
                        className="tag-item"
                      >
                        {/* Angular has a div wrapper inside li */}
                        <div>
                          {/* Icon/user image span - Angular shows user profile image for USER type */}
                          <span>
                            {t.type === 'USER' ? (
                              <UserProfileImage
                                userId={t.id}
                                user={(usersMap as any)?.[t.id]}
                                width={16}
                                height={16}
                                source="Compose"
                              />
                            ) : (
                              <i className={iconClass} />
                            )}
                          </span>
                          {/* Label text - Angular uses pill-text class */}
                          <span className="pill-text">{t.label}</span>
                          {/* Remove button wrapper div - Angular wraps it in a div */}
                          <div>
                            <a
                              className="remove-button icons2_Close-lightgray"
                              href="javascript:void(0);"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeToItem(t);
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              aria-label="Remove"
                              style={{
                                display: 'inline-block',
                                cursor: 'pointer',
                                marginLeft: '3px',
                                padding: '0',
                                border: 'none',
                                textDecoration: 'none',
                                verticalAlign: 'middle',
                                width: '12px',
                                height: '12px',
                                lineHeight: '12px',
                                textAlign: 'center',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: '#7b8386',
                              }}
                            >
                              ×
                            </a>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                
                {/* add-more-placeholder - shows "Add at least one group or user to share this post" when no items and input empty, only in expanded editor */}
                {toItems.length < 1 && toQuery.length === 0 && isExpandedEditorRoute && (
                  <a 
                    onClick={() => {
                      toInputRef.current?.focus();
                      setToFocused(true);
                    }}
                    className="add-more-placeholder"
                    style={{ cursor: 'pointer' }}
                  >
                    Add at least one group or user to share this post
                  </a>
                )}
                
                {/* input - conditionally shown when active/focused (Angular: ng-show="active") */}
                <input
                  ref={toInputRef}
                  value={toQuery}
                  onFocus={() => setToFocused(true)}
                  onBlur={() => {
                    // close dropdown shortly after click
                    setTimeout(() => {
                      // Only hide if there are no tags and no query
                      if (toItems.length === 0 && toQuery.length === 0) {
                        setToFocused(false);
                      }
                    }, 150);
                  }}
                  onChange={(e) => {
                    setToQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      // In expanded editor, only close dropdown, don't deactivate entire editor
                      if (isExpandedEditorRoute) {
                        setToFocused(false);
                        setActiveIndex(0);
                      } else {
                        // In inline editor, deactivate entire editor
                        deactivate();
                      }
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
                  className="input"
                  spellCheck={false}
                  style={{
                    display: (toFocused || toItems.length > 0) ? 'inline-block' : 'none',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    color: '#272b2c',
                    padding: 0,
                    margin: 0,
                    width: 'auto',
                    minWidth: '100px',
                    verticalAlign: 'middle',
                    lineHeight: '30px',
                    height: '30px',
                  }}
                />
                
                
                {/* Hidden span for autosize measurement (Angular: ti-autosize) */}
                <span 
                  className="input" 
                  style={{ 
                    display: 'none', 
                    visibility: 'hidden', 
                    width: 'auto', 
                    whiteSpace: 'pre' 
                  }}
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

                            <span style={{ width: '100%', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}>{sug.label}</span>
                            {sug.secondaryLabel ? <span className="sec-label" style={{ fontSize: '12px', color: '#aaa', paddingBottom: '3px', maxWidth: '420px', display: 'inline-block' }}>{sug.secondaryLabel}</span> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {!isExpandedEditorRoute && (
            <div className="rich-note-insert edit-mode no-padding">
            {/* Full screen wrapper - matches Angular req-full-screen div */}
            {/* Hide when in poll mode - matches Angular ng-show="mode != IMAGE_POLL_MODE && mode != TEXT_POLL_MODE" */}
            {pollMode === 'none' && (
              <div 
                className="req-full-screen cnv-icons-18 Icon1_expand-01-darkgray"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openWithDetailsView(e);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                tabIndex={-1}
                title="Expand to the full screen editor"
              />
            )}
            
            {/* Note: hiddenFileInputRef is now rendered at the top level so it's always available */}
            <input
              id="noteTitleField"
              className="note-title-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                // Angular: onTitleKeydown handles Escape key
                if (e.key === 'Escape') {
                  e.preventDefault();
                  deactivate();
                  return;
                }
              }}
              placeholder={pollMode !== 'none' ? 'Enter Poll Question' : 'Title'}
              type="text"
              maxLength={1000}
            />

            {/* Text Poll UI - matches Angular cnvPoll.tpl.html */}
            {pollMode === 'text' ? (
              <div className="pollContainer">
                <ul id="text-poll-list">
                  {textChoices.map((choice, index) => (
                    <li key={index}>
                      <span className="dummy-radio" />
                      <input
                        type="text"
                        id={`txt_${index}`}
                        value={choice}
                        onChange={(e) => updateTextChoice(index, e.target.value)}
                        onKeyDown={(e) => {
                          // Enter key: add new choice if current has content
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const currentValue = (e.target as HTMLInputElement).value.trim();
                            if (currentValue.length > 0 && textChoices.length < 11) {
                              addTextChoice();
                              // Focus the new field after a short delay
                              setTimeout(() => {
                                const nextInput = document.getElementById(`txt_${textChoices.length}`);
                                if (nextInput) {
                                  (nextInput as HTMLInputElement).focus();
                                }
                              }, 100);
                            }
                          }
                          // Backspace key: remove field if empty and more than 1 field exists
                          else if (e.key === 'Backspace') {
                            const currentValue = (e.target as HTMLInputElement).value;
                            if (currentValue === '' && textChoices.length > 1) {
                              e.preventDefault();
                              e.stopPropagation();
                              removeTextChoice(index);
                              // Focus previous field after removal
                              setTimeout(() => {
                                const prevInput = document.getElementById(`txt_${Math.max(0, index - 1)}`);
                                if (prevInput) {
                                  (prevInput as HTMLInputElement).focus();
                                }
                              }, 10);
                            }
                          }
                        }}
                        placeholder={`Option ${index + 1}`}
                        size={75}
                        maxLength={75}
                      />
                    </li>
                  ))}
                  {textChoices.length < 11 && (
                    <li
                      id="add_text_choice"
                      onClick={(e) => {
                        e.preventDefault();
                        const lastIndex = textChoices.length - 1;
                        const lastValue = textChoices[lastIndex]?.trim();
                        if (lastValue === '') {
                          // If last field is empty, focus it
                          setTimeout(() => {
                            const lastInput = document.getElementById(`txt_${lastIndex}`);
                            if (lastInput) {
                              (lastInput as HTMLInputElement).focus();
                            }
                          }, 100);
                        } else {
                          // If last field has content, add new choice and focus it
                          setTextChoices((prev) => {
                            const next = [...prev, ''];
                            // Focus the new field after state update
                            setTimeout(() => {
                              const newInput = document.getElementById(`txt_${prev.length}`);
                              if (newInput) {
                                (newInput as HTMLInputElement).focus();
                              }
                            }, 100);
                            return next;
                          });
                        }
                      }}
                    >
                      <i className="icon_add-new-choice addtextchoice"></i>
                      <span>Add a new choice</span>
                    </li>
                  )}
                </ul>
              </div>
            ) : pollMode === 'image' ? (
              /* Image poll container - matches Angular structure */
              <div className="pollContainer">
                <div id="image-poll-container">
                  <section className="attachments l-gutter r-gutter">
                    <div className="border-separator">
                      {/* Container: Uploaded files + Add button */}
                      <div style={{ display: 'inline-block', padding: '0 10px', maxWidth: '570px', width: '100%', boxSizing: 'border-box' }}>
                        <div 
                          id="poll-upload-container"
                          className={`files-upload-container ${pollImages.length === 0 ? 'no-files' : ''}`}
                          style={{
                            overflowX: 'auto', // Show scrollbar only when content overflows
                            height: '308px',
                            overflowY: 'hidden',
                            whiteSpace: 'nowrap',
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          {/* Poll images list */}
                          {pollImages.map((img, index) => (
                            <div key={img.localId} className="file upload-box attachment-box" style={{
                              display: 'inline-block',
                            }}>
                              <div className="file_holder" style={{ position: 'relative' }}>
                                <div className="internal-wrapper" style={{
                                  width: '175px',
                                  height: '295px',
                                  display: 'inline-block',
                                  margin: '5px',
                                  border: '1px solid lightgray',
                                  borderRadius: '5px',
                                  verticalAlign: 'middle',
                                  position: 'relative',
                                }}>
                                  <span className="supporting-span"></span>
                                  {img.localPreviewUrl && (
                                    <img 
                                      src={img.localPreviewUrl} 
                                      alt={img.name}
                                      style={{
                                        maxHeight: '293px',
                                        maxWidth: '173px',
                                        borderRadius: '5px',
                                        margin: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block',
                                        userSelect: 'none', // Prevent text selection (replaces onSelectStart)
                                      }}
                                      className={img.status === 'success' ? 'file-converted' : ''}
                                      onContextMenu={(e) => e.preventDefault()}
                                      onDragStart={(e) => e.preventDefault()}
                                      draggable={false} // Prevent dragging
                                    />
                                  )}
                                  
                                  {/* Image description bar (shown when converted) */}
                                  {img.status === 'success' && (
                                    <div className="img-bar-info" style={{
                                      height: '50px',
                                      position: 'absolute',
                                      display: 'inline-block',
                                      width: '174px',
                                      margin: '0 5px 0 0px',
                                      color: 'white',
                                      left: '0px',
                                      bottom: '0px',
                                      background: 'rgba(0, 0, 0, 0.6)',
                                    }}>
                                      <textarea
                                        className="poll-img-desc"
                                        placeholder={`Option ${index + 1}`}
                                        maxLength={32}
                                        value={img.imageDesc || ''}
                                        onChange={(e) => {
                                          setPollImages((prev) => prev.map((im) => 
                                            im.localId === img.localId ? { ...im, imageDesc: e.target.value } : im
                                          ));
                                        }}
                                        style={{
                                          border: '0px',
                                          color: 'white',
                                          background: 'transparent',
                                          outline: 'none',
                                          resize: 'none',
                                          width: '140px',
                                          position: 'absolute',
                                          top: '5px',
                                          left: '15px',
                                          fontSize: '12px',
                                        }}
                                      />
                                    </div>
                                  )}

                                  {/* Failed overlay */}
                                  {img.status === 'failed' && (
                                    <div className="failed-upload" style={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      background: 'rgba(255, 255, 255, 0.9)',
                                      borderRadius: '5px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '10px',
                                    }}>
                                      <div className="upload-failed-icon" style={{ width: '30px', height: '30px', marginBottom: '5px' }}></div>
                                      <div className="file_failed_text" style={{ fontSize: '12px', color: '#d32f2f', textAlign: 'center' }}>
                                        Couldn't upload this file.
                                      </div>
                                    </div>
                                  )}

                                  {/* Progress bar */}
                                  {(img.status === 'uploading' || img.status === 'converting') && (
                                    <div className="progress-bar" style={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      height: '293px',
                                      borderRadius: '5px',
                                      background: 'rgba(255, 255, 255, 0.8)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}>
                                      <div className="bar-internal" style={{ 
                                        position: 'absolute', 
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        width: '100%', 
                                        height: '100%',
                                        borderRadius: '5px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}>
                                        <div className="cnv-spinner" style={{
                                          height: '30px',
                                          width: '30px',
                                          margin: 0,
                                          border: '2px solid #ddd',
                                          borderTop: '2px solid #aaa',
                                          borderRadius: '50%',
                                          animation: 'spin 1s linear infinite',
                                        }} />
                                      </div>
                                      <div className="progress-line" style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        width: img.status === 'uploading' ? '80%' : '90%',
                                        height: '2px',
                                        backgroundColor: '#4183d7',
                                        transition: 'width .2s ease',
                                      }} />
                                    </div>
                                  )}

                                  {/* Remove button (appears on hover) */}
                                  <div 
                                    className="remove-file" 
                                    onClick={() => removePollImage(img.localId)}
                                    style={{
                                      display: 'none',
                                      position: 'absolute',
                                      top: '3px',
                                      right: '8px',
                                      width: '12px',
                                      height: '12px',
                                      padding: 0,
                                      border: 'none',
                                      background: 'none',
                                      backgroundImage: `url("${getAssetsBaseUrl()}/assets/img/inlineInsert/remove.png")`,
                                      backgroundSize: 'contain',
                                      backgroundRepeat: 'no-repeat',
                                      backgroundPosition: 'center',
                                      cursor: 'pointer',
                                      zIndex: 10,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundImage = `url("${getAssetsBaseUrl()}/assets/img/inlineInsert/remove-press.png")`;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundImage = `url("${getAssetsBaseUrl()}/assets/img/inlineInsert/remove.png")`;
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Add more button (inside poll-upload-container) - matches Angular structure */}
                          {/* Show '+' till 7 images uploaded - matches Angular ng-if="files.length <= 6" */}
                          {pollImages.length < 7 && (
                            <div className="file upload-box attachment-box file chooser no-animate" style={{
                              display: 'inline-block',
                            }}>
                              <div 
                                className="file_holder" 
                                id="add-new-img"
                                onClick={() => pollImageInputRef.current?.click()}
                                style={{
                                  cursor: 'pointer',
                                  backgroundColor: '#f5f5f5', // @cnv-gray-light equivalent
                                  width: '173px',
                                  height: '293px',
                                  borderRadius: '5px',
                                  opacity: 0.5,
                                  border: '1px solid lightgray',
                                  position: 'relative',
                                  textAlign: 'center',
                                  lineHeight: '293px', // Center vertically using line-height
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '0.5';
                                }}
                              >
                                <span className="supporting-span" style={{
                                  display: 'inline-block',
                                  height: '100%',
                                  verticalAlign: 'middle',
                                  width: '0px',
                                  marginLeft: '-3px',
                                }}></span>
                                <i className="icon_add-gray" id="add-more-poll-images" style={{
                                  width: '40px', // Made bigger (was 32px)
                                  height: '40px', // Made bigger (was 32px)
                                  zIndex: 10,
                                  display: 'inline-block',
                                  verticalAlign: 'middle',
                                  backgroundImage: `url("${getAssetsBaseUrl()}/assets/img/inlineInsert/add-more.jpg")`,
                                  backgroundSize: 'contain',
                                  backgroundRepeat: 'no-repeat',
                                  backgroundPosition: 'center',
                                }}></i>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="clear"></div>
                    </div>
                  </section>
                </div>
                
                {/* Hidden file input for poll images */}
                <input
                  ref={pollImageInputRef}
              type="file"
                  accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={async (e) => {
                    const input = e.target as HTMLInputElement;
                    const files = Array.from(input.files || []);
                    input.value = '';
                    
                    // Check max 7 images limit
                    if (pollImages.length + files.length > 7) {
                      alert('You can add up to 7 images.');
                      return;
                    }
                    
                    // Upload each image
                for (const f of files) {
                  try {
                        await uploadPollImage(f);
                  } catch (err) {
                        // Error is already handled in uploadPollImage
                  }
                }
              }}
            />
              </div>
            ) : (
              /* Quill editor host */
              /* In expanded editor mode, editor is rendered separately below toolbar via useEffect */
              !isExpandedEditorRoute && (
                <div className="inline-insert-editor">
                  <div ref={editorHostRef} />
                </div>
              )
            )}

            {/* Tags field - matches Angular tags-field-cont and tags-input structure */}
            {tagFieldVisible && active && (
              <div className="tags-field-cont" style={{ borderTop: '1px solid #e0e0e0' }}>
                <div className="tags-input" style={{ position: 'relative', padding: '10px 20px' }}>
                  <div className="tags" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '4px',
                    minHeight: '35px',
                    padding: '4px 0',
                    borderBottom: tagList.length === 0 && !tagInputValue ? 'none' : '1px solid #e0e0e0',
                  }}>
                    {/* Display tags */}
                    {tagList.map((tag, index) => (
                      <span
                        key={index}
                        className="tag-item"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 6px',
                          backgroundColor: '#e8e8e8',
                          borderRadius: '3px',
                          fontSize: '13px',
                          margin: '2px',
                        }}
                      >
                        {tag.label}
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          style={{
                            marginLeft: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            lineHeight: '1',
                            padding: 0,
                            color: '#666',
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {/* Input field */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', flex: 1, minWidth: '150px' }}>
                      {tagList.length === 0 && !tagInputValue && (
                        <span style={{ color: '#999', fontSize: '14px', marginRight: '4px' }}>Add tags: </span>
                      )}
            <input
                        ref={tagFieldRef}
              type="text"
                        placeholder="start typing..."
                        value={tagInputValue}
                        onChange={(e) => setTagInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            if (tagInputValue.trim()) {
                              addTag(tagInputValue);
                            }
                          } else if (e.key === 'Escape') {
                            setTagFieldVisible(false);
                          } else if (e.key === 'Backspace' && !tagInputValue && tagList.length > 0) {
                            removeTag(tagList.length - 1);
                          }
                        }}
                        onBlur={() => {
                          if (tagInputValue.trim()) {
                            addTag(tagInputValue);
                          }
                        }}
                        style={{
                          border: 'none',
                          outline: 'none',
                          fontSize: '14px',
                          flex: 1,
                          minWidth: '100px',
                          padding: '2px 0',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Location display - matches Angular location-container */}
            {/* Show spinner when fetching and no location yet (Angular: ng-if="!model.location && showSpinner") */}
            {isLocationFetching && !location && (
              <div className="cnv-spinner cnv-spinner-inline-insert" style={{ margin: '10px 20px' }} />
            )}
            {location && (location.lat || location.lng) && (
              <div className={`location-container ${isPollMode ? 'poll-location' : ''}`} style={{
                maxWidth: '240px',
                border: '1px solid #ccd0dd',
                backgroundColor: '#f0f0f0',
                margin: '0 0 -1px -1px',
                fontSize: '14px',
                position: 'relative',
                height: 'fit-content',
                ...(isPollMode ? { float: 'right' } : {}),
              }}>
                {/* Close button - matches Angular ng-if="!isLocationForPostEnabled || isAdminOfLocPost" */}
                <div className="close-btn" style={{ 
                  position: 'absolute',
                  right: '5px',
                  zIndex: 10,
                }}>
                  <i
                    className="close-btn-icon pull-right cnv-icons-17 icons2_Close-darkgray"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveLocation();
                    }}
                    style={{
                      cursor: 'pointer',
                      maxWidth: '8px',
                      marginRight: '0px',
                      height: '8px',
                      width: '8px',
                      display: 'inline-block',
                      backgroundImage: `url("${getAssetsBaseUrl()}/assets/cnv-icons/sprites/png/icons2_Close-darkgray.png")`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                    }}
                  />
            </div>
                <p className="geo-location" style={{
                  padding: '0px 5px 5px 5px',
                  margin: '0px 30px 0px 0px',
                  fontSize: '14px',
                }}>
                  at <span className="geo-location-text" style={{ color: '#4183d7', fontWeight: 600 }}>
                    {location.title && location.title.trim().length > 0 ? location.title : `${location.lat}, ${location.lng}`}
                  </span>
                </p>
              </div>
            )}

            {/* Poll common options - matches Angular poll_common_options */}
            {active && isPollMode && (
              <div
                id="poll_common_options"
                onClick={(e) => {
                  // Close dropdowns when clicking outside
                  if (isHrsDropdownDisplayed && !(e.target as HTMLElement).closest('#hrs-dropdown-wrap')) {
                    setIsHrsDropdownDisplayed(false);
                  }
                  if (isMinsDropdownDisplayed && !(e.target as HTMLElement).closest('#mins-dropdown-wrap')) {
                    setIsMinsDropdownDisplayed(false);
                  }
                }}
              >
                <div>
                  <input
                    type="checkbox"
                    name="allow_view_results"
                    id="allow_view_results"
                    className="cnv-checkbox"
                    checked={allowViewResults}
                    onChange={(e) => setAllowViewResults(e.target.checked)}
                  />
                  <label htmlFor="allow_view_results" />
                  <span>Allow members to view results</span>
                </div>
                <div id="poll_ends_container">
                  <input
                    type="checkbox"
                    name="poll_ends_on"
                    id="poll_ends_on"
                    className="cnv-checkbox"
                    checked={pollEndDateAllowed}
                    onChange={(e) => {
                      setPollEndDateAllowed(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedHour('hh');
                        setSelectedMinute('mm');
                        setPollEndDate(null);
                      }
                    }}
                  />
                  <label htmlFor="poll_ends_on" />
                    <span className="poll-calendar">
                    Poll ends on{' '}
                    <span className="date poll-date-wrap" ref={calendarRef} style={{ position: 'relative', display: 'inline-block' }}>
                      {pollEndDate ? (
                        <span
                          className="col-heading"
                          id="textdate"
                          onClick={(e) => {
                            if (pollEndDateAllowed) {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsCalendarOpen(!isCalendarOpen);
                              setCalendarDisplayed(!isCalendarOpen);
                            }
                          }}
                        >
                          {pollEndDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      ) : (
                        <i
                          className={calendarDisplayed ? 'icon_calendar-blue' : 'icon_calendar-gray'}
                          onClick={(e) => {
                            if (pollEndDateAllowed) {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsCalendarOpen(!isCalendarOpen);
                              setCalendarDisplayed(!isCalendarOpen);
                            }
                          }}
                        />
                      )}
                      {isCalendarOpen && pollEndDateAllowed && (
                        <CalendarDropdown
                          selectedDate={pollEndDate}
                          onDateSelect={(date) => {
                            setPollEndDate(date);
                            setIsCalendarOpen(false);
                            setCalendarDisplayed(false);
                          }}
                          minDate={new Date()}
                        />
                      )}
                    </span>{' '}
                    at{' '}
                    <div id="hrs-dropdown-wrap" style={{ display: 'inline-block', position: 'relative' }}>
                      {!isHrsDropdownDisplayed ? (
                        <span
                          id="hrs-label"
                          onClick={() => pollEndDateAllowed && setIsHrsDropdownDisplayed(true)}
                          style={{
                            cursor: pollEndDateAllowed ? 'pointer' : 'not-allowed',
                            opacity: pollEndDateAllowed ? 1 : 0.5,
                          }}
                        >
                          {selectedHour}
                        </span>
                      ) : (
                        <ul
                          id="hrs-select"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            listStyle: 'none',
                            margin: 0,
                            padding: '4px 0',
                            zIndex: 100,
                            minWidth: '36px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                          }}
                        >
                          <li
                            onClick={() => {
                              setSelectedHour('hh');
                              setIsHrsDropdownDisplayed(false);
                            }}
                            style={{ padding: '4px 12px', cursor: 'pointer' }}
                          >
                            hh
                          </li>
                          {pollHours.map((h) => (
                            <li
                              key={h}
                              onClick={() => {
                                setSelectedHour(h);
                                setIsHrsDropdownDisplayed(false);
                              }}
                              style={{ padding: '4px 12px', cursor: 'pointer' }}
                            >
                              {h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>{' '}
                    :{' '}
                    <div id="mins-dropdown-wrap" style={{ display: 'inline-block', position: 'relative' }}>
                      {!isMinsDropdownDisplayed ? (
                        <span
                          id="mins-label"
                          onClick={() => pollEndDateAllowed && setIsMinsDropdownDisplayed(true)}
                          style={{
                            cursor: pollEndDateAllowed ? 'pointer' : 'not-allowed',
                            opacity: pollEndDateAllowed ? 1 : 0.5,
                          }}
                        >
                          {selectedMinute}
                        </span>
                      ) : (
                        <ul
                          id="mins-select"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            listStyle: 'none',
                            margin: 0,
                            padding: '4px 0',
                            zIndex: 100,
                            minWidth: '36px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                          }}
                        >
                          <li
                            onClick={() => {
                              setSelectedMinute('mm');
                              setIsMinsDropdownDisplayed(false);
                            }}
                            style={{ padding: '4px 12px', cursor: 'pointer' }}
                          >
                            mm
                          </li>
                          {pollMinutes.map((m) => (
                            <li
                              key={m}
                              onClick={() => {
                                setSelectedMinute(m);
                                setIsMinsDropdownDisplayed(false);
                              }}
                              style={{ padding: '4px 12px', cursor: 'pointer' }}
                            >
                              {m}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>{' '}
                    <span
                      id="pollTimeFormat"
                      onClick={() => pollEndDateAllowed && setTimeFormat((prev) => (prev === 'AM' ? 'PM' : 'AM'))}
                      style={{
                        cursor: pollEndDateAllowed ? 'pointer' : 'not-allowed',
                        opacity: pollEndDateAllowed ? 1 : 0.5,
                      }}
                    >
                      {timeFormat}
                    </span>
                  </span>
                </div>
              </div>
            )}

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
                {!isExpandedEditorRoute && (
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
                )}
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

            {/* File upload preview container - matches Angular cnv-upload-files-ui-manager */}
            <div className="filesUploadContainer">
            {attachedFiles.length > 0 && (
                <ul 
                  className="upload-files-reel upload-files-scroll-cont" 
                  style={{
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '5px 5px 0 5px',
                    borderTop: '1px solid #e0e0e0',
                    marginBottom: 0,
                    display: 'flex',
                    listStyle: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {attachedFiles.map((f) => {
                    const isFailed = f.status === 'failed';
                    const isInProgress = f.status === 'uploading' || f.status === 'converting';
                    const isSuccess = f.status === 'success';
                    // Check if file is an image - check both type and extension
                    const isImage = (f.type && f.type.startsWith('image/')) || 
                                    /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(f.name);
                    const previewUrl = f.localPreviewUrl || null;

                    return (
                      <li 
                        key={f.localId} 
                        className="attachment-box"
                        style={{
                          position: 'relative',
                          listStyle: 'none',
                          display: 'table-cell',
                          minWidth: '105px',
                          overflow: 'hidden',
                          height: '100px',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          backgroundColor: 'white',
                          animation: 'attachment-enter-left-to-right-sequence 400ms',
                        }}
                        onMouseEnter={(e) => {
                          const removeBtn = e.currentTarget.querySelector('.remove-file') as HTMLElement;
                          if (removeBtn) removeBtn.style.display = 'block';
                        }}
                        onMouseLeave={(e) => {
                          const removeBtn = e.currentTarget.querySelector('.remove-file') as HTMLElement;
                          if (removeBtn) removeBtn.style.display = 'none';
                        }}
                      >
                        {/* Background border */}
                        <div 
                          className="attachment-box-background"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            right: '5px',
                            background: 'transparent',
                            border: '1px solid #e0e0e0',
                            height: '100px',
                          }}
                        />

                        {/* Image preview - Angular uses ng-src="{{file.localUrl}}" */}
                        {isImage && previewUrl ? (
                          <img 
                            src={previewUrl} 
                            alt={f.name}
                            className={isSuccess ? 'file-converted' : ''}
                            style={{
                              maxHeight: '100px',
                              marginRight: '5px',
                              zIndex: 0,
                              transition: 'opacity .25s',
                              maxWidth: '165px',
                              userSelect: 'none',
                              opacity: isSuccess ? 1 : 0.5,
                              display: 'block',
                              margin: '0 auto',
                              verticalAlign: 'middle',
                            }}
                            onError={(e) => {
                              // Fallback if image fails to load
                              console.error('Failed to load preview:', previewUrl, f.name);
                            }}
                          />
                        ) : !isImage ? (
                          // File icon for non-image files
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            width: '100%',
                          }}>
                            <span className="cnv-icons-36 fileplainlarge-darkgray" style={{
                              display: 'block',
                            }} />
                  </div>
                        ) : null}

                        {/* Failed upload overlay */}
                        {isFailed && (
                          <div 
                            className="failed-upload"
                            style={{
                              backgroundColor: 'rgba(255,255,255,.75)',
                              width: '100%',
                              height: '100%',
                              position: 'absolute',
                              left: 0,
                              top: 0,
                            }}
                          >
                            <div 
                              className="upload-failed-icon"
                              style={{
                                position: 'absolute',
                                top: '8px',
                                left: '6px',
                                color: '#df0000',
                                background: `url(${getAssetsBaseUrl()}/assets/img/common/webapp_upload_error.png) no-repeat`,
                                height: '18px',
                                width: '18px',
                              }}
                            />
                            <div style={{
                              position: 'absolute',
                              fontSize: '12px',
                              top: '28px',
                              width: '100%',
                              textAlign: 'left',
                              padding: '0px 4px',
                              color: '#2b2b2b',
                            }}>
                              Couldn't upload this file.
                            </div>
              </div>
            )}

                        {/* File name (only if not image thumbnail or if failed) */}
                        {(!isImage || isFailed) && (
                          <span 
                            className="fileNames"
                            style={{
                              position: 'absolute',
                              top: '64px',
                              left: 0,
                              right: '6px',
                              lineHeight: 1.2,
                              padding: '5px 4px 0 4px',
                              fontSize: '11px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              wordWrap: 'break-word',
                              color: '#2b2b2b',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              wordBreak: 'break-word',
                            }}
                          >
                            {f.name}
                          </span>
                        )}

                        {/* Progress bar */}
                        {isInProgress && (
                          <div 
                            className="progress-bar"
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              margin: 0,
                              position: 'absolute',
                              width: '100%',
                              height: '100px',
                              top: 0,
                              left: 0,
                            }}
                          >
                            <div 
                              className="bar-internal"
                              style={{
                                width: '100%',
                                height: '100px',
                                top: 0,
                                left: 0,
                                position: 'absolute',
                                opacity: 0.75,
                                background: '#fff',
                              }}
                            >
                              <div 
                                className="cnv-spinner"
                                style={{
                                  height: '30px',
                                  width: '30px',
                                  margin: '36px auto',
                                  border: '2px solid #ddd',
                                  borderTop: '2px solid #aaa',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite',
                                }}
                              />
                            </div>
                            <div 
                              className="progress-line"
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: f.status === 'uploading' ? '80%' : '90%',
                                height: '2px',
                                backgroundColor: '#4183d7',
                                transition: 'width .2s ease',
                              }}
                            />
                          </div>
                        )}

                        {/* Remove button (appears on hover) */}
                        <div 
                          className="remove-file"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!sharing) {
                              // Clean up preview URL
                              if (f.localPreviewUrl) {
                                URL.revokeObjectURL(f.localPreviewUrl);
                              }
                              setAttachedFiles((p) => p.filter((x) => x.localId !== f.localId));
                            }
                          }}
                          style={{
                            position: 'absolute',
                            top: '3px',
                            right: '8px',
                            display: 'none',
                            height: '12px',
                            width: '12px',
                            padding: 0,
                            border: 'none',
                            background: `url(${getAssetsBaseUrl()}/assets/img/inlineInsert/remove.png) no-repeat center`,
                            cursor: 'pointer',
                            zIndex: 10,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundImage = `url(${getAssetsBaseUrl()}/assets/img/inlineInsert/remove-press.png)`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundImage = `url(${getAssetsBaseUrl()}/assets/img/inlineInsert/remove.png)`;
                          }}
                        />
                      </li>
                    );
                  })}

                  {/* Plus button to add more files */}
                  <li 
                    className="attachment-box chooser no-animate"
                    style={{
                      position: 'relative',
                      listStyle: 'none',
                      display: 'table-cell',
                      minWidth: '105px',
                      overflow: 'hidden',
                      height: '100px',
                      verticalAlign: 'middle',
                      textAlign: 'center',
                      backgroundColor: 'white',
                      animation: 'none',
                    }}
                  >
                    <div 
                      className="plus-icon"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!sharing && bottomBarFileInputRef.current) {
                          bottomBarFileInputRef.current.click();
                        }
                      }}
                      style={{
                        background: `url(${getAssetsBaseUrl()}/assets/img/inlineInsert/add-more.jpg) no-repeat center`,
                        backgroundSize: 'contain',
                        width: '100px',
                        height: '98px',
                        cursor: 'pointer',
                        margin: '0 auto',
                        display: 'block',
                      }}
                      title="Attach more files"
                    />
                  </li>
                </ul>
              )}
            </div>
          </div>
          )}

          {/* Bottom bar - DOM parity with Angular cnvInlineInsert.tpl.html */}
          {!isExpandedEditorRoute && (
          <div className={`bottom-bar-cont ${!isPollFeatureEnabled ? 'poll-feature-disabled' : ''}`} style={{ position: 'relative' }}>
            {/* Poll icon + options */}
            {isPollFeatureEnabled && (
              <>
                <i
                  id="poll-icon"
                  className={isPollMode ? 'icon_poll-blue' : 'icon_poll-gray'}
                  onClick={() => {
                    if (isPollMode) {
                      // Show prompt modal to confirm discarding poll (matches Angular showPollOptions)
                      // Angular: alertsService.promptModal('Alert', 'Are you sure you want to discard this poll?', ...)
                      promptModal(
                        'Alert',
                        'Are you sure you want to discard this poll?',
                        () => {
                          // On confirm: Reset poll mode and switch back to regular note mode
                          setPollMode('none');
                          setPollOptionsDisplayed(false);
                          setTextChoices(['']);
                          setAllowViewResults(false);
                          setPollEndDateAllowed(false);
                          setSelectedHour('hh');
                          setSelectedMinute('mm');
                          setTimeFormat('AM');
                          setPollEndDate(null);
                          setIsCalendarOpen(false);
                          setCalendarDisplayed(false);
                          // Clear title if it was only for poll
                          if (title.trim().length > 0) {
                            setTitle('');
                          }
                        },
                        null, // cancel callback
                        'Discard' // ok button label
                      );
                    } else {
                      // Not in poll mode, show options dropdown
                      setPollOptionsDisplayed((v) => !v);
                    }
                  }}
                />
                <ul className={`polloptions ${pollOptionsDisplayed ? '' : 'ng-hide'}`} style={{ display: pollOptionsDisplayed ? 'block' : 'none' }}>
                  <li
                    className="imagespoll"
                    onClick={() => {
                      setPollMode('image');
                      setPollOptionsDisplayed(false);
                      // Reset poll images when switching to image mode
                      pollImages.forEach((img) => {
                        if (img.localPreviewUrl) {
                          URL.revokeObjectURL(img.localPreviewUrl);
                        }
                      });
                      setPollImages([]);
                      pollFilesDataRef.current = {
                        selectedFilesCount: 0,
                        addedFilesCount: 0,
                        completedAndConvertedFilesCount: 0,
                        addedFiles: [],
                      };
                    }}
                  >
                    Poll with Images
                  </li>
                  <li
                    className="textpoll"
                    onClick={() => {
                      setPollMode('text');
                      setPollOptionsDisplayed(false);
                      // Initialize textChoices with one empty choice if switching to text poll
                      if (textChoices.length === 0) {
                        setTextChoices(['']);
                      }
                      // Initialize poll options (Angular sets allowViewResults = true for text poll)
                      setAllowViewResults(true);
                      setSelectedHour('hh');
                      setSelectedMinute('mm');
                      setTimeFormat('AM');
                      setPollEndDate(null);
                      setPollEndDateAllowed(false);
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
              {/* Text toolbar toggle placeholder (DOM parity) - Hidden in poll mode */}
              {!isPollMode && (
                <>
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
                      // Angular prevent-event-mousedown directive: prevent default to avoid input's native behavior
                      // This prevents the input from receiving the mousedown event directly
                      if (e.target !== bottomBarFileInputRef.current) {
                        e.preventDefault();
                      }
                    }}
                onClick={(e) => {
                      // Don't handle clicks that are directly on the input element
                  if (e.target === bottomBarFileInputRef.current) {
                    return;
                  }
                  
                  e.stopPropagation();
                  
                  // Prevent double-opening by checking if dialog is already opening
                  if (isOpeningFileDialogRef.current) {
                    return;
                  }
                  
                  const input = bottomBarFileInputRef.current;
                  if (input) {
                    isOpeningFileDialogRef.current = true;
                        // Trigger click on the input (Angular: element.find('div input[type=file]').trigger('click'))
                    input.click();
                  }
                }}
              >
                <input
                  ref={bottomBarFileInputRef}
                  name="file"
                  className="file-input"
                  type="file"
                  multiple
                  onChange={async (e) => {
                    const input = e.target as HTMLInputElement;
                    const files = Array.from(input.files || []);
                        // Reset input value immediately to allow selecting same file again
                    input.value = '';
                    // Reset the flag since file selection is complete
                    isOpeningFileDialogRef.current = false;
                        
                        // Ensure loginData is available before processing files
                        const effectiveLoginData = getEffectiveLoginData();
                        if (!effectiveLoginData) {
                          // If loginData is not available, mark files as failed
                          for (const f of files) {
                            const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
                            const ext = (f.name.split('.').pop() || '').toLowerCase();
                            const fileNameId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
                            const fileUploadName = `${fileNameId}.${ext || 'bin'}`;
                            setAttachedFiles((prev) => [
                              ...prev,
                              { localId, name: f.name, size: f.size || 1, type: ext || 'bin', status: 'failed', fileNameId, fileUploadName },
                            ]);
                          }
                          return;
                        }
                    
                    // Process files - uploadLocalFileAndConvert will handle S3 configuration errors
                    for (const f of files) {
                      try {
                        await uploadLocalFileAndConvert(f);
                      } catch (err) {
                        // Error is already handled in uploadLocalFileAndConvert (sets status to 'failed')
                      }
                    }
                  }}
                />
              </div>

              {/* Box */}
              <div
                className="Icon2__Box-15-darkgray"
                onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      initializeBox();
                }}
              />

              {/* Google Drive */}
              <div
                className="icons3_Google_Drive-darkgray"
                onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      initializeGoogleDrive();
                    }}
                  />

                  {/* Giphy button */}
              <div
                className="giphy-action-container"
                onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowGiphy(!showGiphy);
                }}
              >
                <div id="iShowGiphyPopup" className="inLineInsertGiphy giphy" />
              </div>

                  {/* Upload from URL - matches Angular cnv-upload-from-url directive */}
              <div
                    className="upload-from-url icons_Links-darkgray"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Placeholder: upload-from-url modal will be added.
                }}
              />

              <label className="separator" />
                </>
              )}

              {/* Tag icon - Always visible (no ng-show="!isPollMode()" in Angular) */}
              <div
                className="icon_tag-01-01-darkgray-old"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleTagsField();
                }}
              />

              {/* Location icon - Always visible (no ng-show="!isPollMode()" in Angular) */}
              <div
                id="location-icon"
                className={location ? 'add-location-blue' : 'icons_Location-darkgray'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onLocationPinClick();
                }}
              />
            </div>

            <label />
            <div className="clear" />

            {/* Giphy popover - positioned relative to bottom-bar-cont */}
            {showGiphy && (
              <div
                ref={giphyPopoverRef}
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)', // Position above bottom bar with 8px gap
                  right: '10px',
                  width: '360px',
                  maxHeight: 'min(300px, calc(100vh - 200px))', // Prevent overflow beyond viewport (account for header ~60px + padding)
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  padding: '8px',
                  zIndex: 100,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
              <input
                value={giphyQuery}
                onChange={(e) => setGiphyQuery(e.target.value)}
                placeholder="Search GIFs"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  fontSize: '14px',
                  fontFamily: "'Source Sans Pro', sans-serif",
                  marginBottom: '8px',
                }}
                autoFocus
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: '1 1 auto',
                }}
              >
                {giphyResults.map((g) => (
                  <img
                    key={g.id}
                    src={g.preview}
                    alt="GIF"
                    style={{
                      width: '100%',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => attachGifAsFile(g.original, g.id)}
                  />
                ))}
                {giphyResults.length === 0 && giphyQuery && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#7b8386' }}>
                    No GIFs found
                  </div>
                )}
                {giphyResults.length === 0 && !giphyQuery && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#7b8386' }}>
                    Loading trending GIFs...
                  </div>
                )}
              </div>
              </div>
            )}
          </div>
          )}

          {sharing && (
            <div className="sharing-state-overlay">
              <div className="cnv-spinner inline-insert-spinner" />
            </div>
          )}
        </div>
      )}

      {/* Editor host for expanded editor mode - use portal to render below toolbar */}
      {isExpandedEditorRoute && active && typeof document !== 'undefined' && (
        <>
          {(() => {
            const toolbarElement = document.querySelector('#notes-app-editor-toolbar');
            const targetElement = toolbarElement?.nextElementSibling as HTMLElement;
            if (targetElement && targetElement.classList.contains('body')) {
              // Target element already exists, render editor host there
              return null; // We'll render via useEffect instead
            }
            return null;
          })()}
        </>
      )}
    </div>
    </>
  );
}


