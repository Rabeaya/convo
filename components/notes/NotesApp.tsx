'use client';

/**
 * Notes App Component
 * 
 * Full-featured notes editor page matching Angular cnv-notes-app
 * Matches Angular structure: app-header with segments, editor area, comments panel
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import InlineInsert from '@/components/feed/InlineInsert';
import FeedItemDropdown from '@/components/feed/FeedItemDropdown';
import type { DropdownOption } from '@/components/feed/FeedItemDropdown';
import UserProfileImage from '@/components/common/UserProfileImage';
import { resolveServicesHostString } from '@/lib/config/services-host';
import { useUsers } from '@/lib/hooks/use-users';
import { useGroups } from '@/lib/hooks/use-groups';
import { useGeneralSettings } from '@/lib/hooks/use-settings';
import { useSession } from '@/lib/hooks/use-auth';

interface NotesAppProps {
  noteId?: string;
  initialTitle?: string;
}

type ShareWithType = 'USER' | 'GROUP' | 'USER_EMAIL';

interface ToItem {
  id: string;
  type: ShareWithType;
  label: string;
  secondaryLabel?: string;
}

function normalizeIdLikeAngular(id: string): string {
  return String(id || '').trim();
}

function isValidEmail(s: string): boolean {
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

export default function NotesApp({ noteId, initialTitle }: NotesAppProps) {
  const { user, account, loginData } = useAuthStore();
  const { data: sessionData } = useSession();
  
  // Tag field state - for note tags (separate from recipient tags)
  const [noteTagList, setNoteTagList] = useState<Array<{ label: string }>>([]);
  const [noteTagInputValue, setNoteTagInputValue] = useState<string>('');
  
  // Add tag function
  const addNoteTag = useCallback((tagText: string) => {
    const trimmed = tagText.trim();
    if (!trimmed) return;
    
    // Check for duplicates (case-insensitive)
    if (noteTagList.some((t) => t.label.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    
    setNoteTagList((prev) => [...prev, { label: trimmed }]);
    setNoteTagInputValue('');
  }, [noteTagList]);
  
  // Remove tag function
  const removeNoteTag = useCallback((index: number) => {
    setNoteTagList((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const accountName = (account as any)?.account_name || (account as any)?.account_key || 'Convo';
  const myUserId = String((user as any)?.user_id || (user as any)?.userId || '');
  const [showTags, setShowTags] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [isStarred, setIsStarred] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(true);
  const [likesInfo, setLikesInfo] = useState({ liked_by_me: false, like_count: 0 });
  const moreMenuRef = useRef<HTMLDivElement>(null);
  // Initialize title from prop, but filter out "Untitled note"
  const [nodeTitle, setNodeTitle] = useState(() => {
    if (initialTitle && initialTitle !== 'Untitled note') {
      return initialTitle;
    }
    return '';
  });
  const [toggleExtendedToolbar, setToggleExtendedToolbar] = useState(true);
  
  // Location state
  const [location, setLocation] = useState<{ lat: number; lng: number; title?: string } | null>(null);
  const [isLocationFetching, setIsLocationFetching] = useState(false);
  
  // Giphy state
  const [showGiphy, setShowGiphy] = useState(false);
  const [giphyQuery, setGiphyQuery] = useState('');
  const [giphyResults, setGiphyResults] = useState<Array<{ id: string; preview: string; original: string }>>([]);
  const giphyApiKey = 'xTiTnI9GNUe8rosXMQ'; // from Angular cnv-giphy.js
  const giphyPopoverRef = useRef<HTMLDivElement>(null);
  
  // File upload state and refs
  type UploadStatus = 'uploading' | 'converting' | 'success' | 'failed';
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{
      localId: string;
      name: string;
      size: number;
      type: string;
      status: UploadStatus;
      fileNameId: string;
      fileUploadName: string;
      serverFileId?: string;
      serverFileObj?: any;
      localPreviewUrl?: string;
      file?: File;
    }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Helper to get loginData from multiple sources dynamically
  const getEffectiveLoginData = useCallback(() => {
    return loginData || (typeof window !== 'undefined' ? (window as any)?.com_convo?.sessionData?.signInResponseData : null);
  }, [loginData]);
  
  // File storage helper functions (adapted from InlineInsert)
  const getFileStorageInfo = useCallback(() => {
    const sourceData = getEffectiveLoginData();
    let info: any = null;
    
    if (sourceData) {
      info = (sourceData as any)?.file_storage_info;
    }
    
    if (!info && sessionData) {
      const sessionResponse = sessionData as any;
      info = sessionResponse?.data?.signInResponseData?.file_storage_info;
    }
    
    if (!info && typeof window !== 'undefined') {
      const win = window as any;
      info = win?.com_convo?.sessionData?.signInResponseData?.file_storage_info;
    }
    
    if (!info || typeof info !== 'object') {
      return { defaultType: undefined, data: null };
    }
    
    const defaultType: string | undefined = info?.default_type || info?.defaultType;
    
    if (!defaultType) {
      return { defaultType: undefined, data: info?.data || null };
    }
    
    const data =
      (defaultType && info?.data && typeof info.data === 'object' ? info.data[defaultType] : null) ||
      (defaultType && info?.[defaultType] ? info[defaultType] : null) ||
      (info?.data && typeof info.data === 'object' ? info.data : null) ||
      null;
    
    return { defaultType, data };
  }, [getEffectiveLoginData, sessionData]);
  
  const getS3BucketUrl = useCallback(() => {
    const { defaultType, data } = getFileStorageInfo();
    if (!defaultType || !data) return null;
    
    if (defaultType.toLowerCase() === 's3') {
      const bucketName = data.bucket_name;
      const httpsUploads = !!data.https_uploads;
      if (!bucketName) return null;
      return `${httpsUploads ? 'https' : 'http'}://${bucketName}.s3.amazonaws.com/`;
    }
    
    if (defaultType.toLowerCase() === 'minio') {
      const serverPath = data.server_path;
      const serverPort = data.server_port;
      if (!serverPath) return null;
      const port = serverPort && serverPort !== '443' && serverPort !== '80' ? `:${serverPort}` : '';
      const protocol = serverPath.startsWith('http') ? '' : 'https://';
      return `${protocol}${serverPath}${port}/${data.bucket_name}/`;
    }
    
    return null;
  }, [getFileStorageInfo]);
  
  const getFileUploadPath = useCallback((fileUploadName: string) => {
    const sourceData = getEffectiveLoginData();
    let accountId = '';
    if (sourceData) {
      accountId = String((sourceData as any)?.account_id || '');
    }
    if (!accountId && account) {
      accountId = String((account as any)?.account_id || '');
    }
    if (!accountId && typeof window !== 'undefined') {
      const win = window as any;
      accountId = String(win?.com_convo?.sessionData?.signInResponseData?.account_id || '');
    }
    
    const dir = 'note';
    return `${accountId}/${dir}${noteId}/${fileUploadName}`;
  }, [getEffectiveLoginData, account, noteId]);
  
  const postFilesEndpoint = useCallback(async (payload: any) => {
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
  }, []);
  
  // Trigger file input click
  const triggerFileInputClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);
  
  // Poll file conversion status
  const pollFileConversionStatus = useCallback(async (fileIds: string[]) => {
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
      if (pending.size) await new Promise((r) => setTimeout(r, 3000));
    }
  }, [postFilesEndpoint]);
  
  // Convert external file (Google Drive/Box)
  const convertExternalFile = useCallback(async (fileDetails: {
    name: string;
    size: number;
    type: string;
    file_url: string;
    file_source: string | null;
    file_access_token: string | null;
    file_preview_url: string | null;
    localUrl?: string;
  }) => {
    if (!noteId) return;
    
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
      console.error('[NotesApp] External file conversion failed:', err);
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
    }
  }, [noteId, postFilesEndpoint, pollFileConversionStatus]);
  
  // Upload local file and convert
  const uploadLocalFileAndConvert = useCallback(async (file: File) => {
    if (!noteId) return;
    
    const effectiveLoginData = getEffectiveLoginData();
    if (!effectiveLoginData) {
      setAttachedFiles((prev) => {
        const lastFile = prev[prev.length - 1];
        if (lastFile && lastFile.name === file.name) {
          return prev.map((f) => (f.name === file.name && f.status === 'uploading' ? { ...f, status: 'failed' } : f));
        }
        return prev;
      });
      return;
    }

    const max = 20971520; // 20MB limit
    if (file.size > max) {
      alert(`The ${file.name} file exceeds the 20 MB attachment limit.`);
      return;
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileNameId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? (crypto as any).randomUUID() : localId;
    const fileUploadName = `${fileNameId}.${ext || 'bin'}`;
    
    const { defaultType, data } = getFileStorageInfo();
    const bucketUrl = getS3BucketUrl();

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
        file,
      },
    ]);

    const storageType = defaultType?.toLowerCase();
    if (!storageType || (storageType !== 's3' && storageType !== 'minio') || !bucketUrl || !data) {
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
      return;
    }
    
    if (storageType === 's3') {
      if (!data.access_key || !data.s3_policy || !data.s3_signature || !data.bucket_name) {
        setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }
    } else if (storageType === 'minio') {
      if (!data.access_key || !data.secret_key || !data.bucket_name || !data.server_path) {
        setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }
    }

    const keyPath = getFileUploadPath(fileUploadName);
    let file_url: string;

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
        setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
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
        setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
        return;
      }

      const minioResult = await minioRes.json();
      file_url = minioResult.file_url || `${bucketUrl}${keyPath}`;
    } else {
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
      return;
    }
    
    setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'converting' } : f)));

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
      console.error('[NotesApp] File upload failed:', err);
      setAttachedFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'failed' } : f)));
    }
  }, [noteId, getEffectiveLoginData, getFileStorageInfo, getS3BucketUrl, getFileUploadPath, postFilesEndpoint, pollFileConversionStatus]);
  
  // Fetch Giphy GIFs
  const fetchGiphy = useCallback(async (q: string) => {
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
      console.error('[NotesApp] Giphy fetch failed:', err);
      setGiphyResults([]);
    }
  }, [giphyApiKey]);
  
  // Attach GIF as file (downloads from Giphy URL and adds to attachedFiles)
  const attachGifAsFile = useCallback(async (gifUrl: string, gifId: string) => {
    if (!noteId) return;
    
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
      console.error('[NotesApp] GIF attachment failed:', err);
      setShowGiphy(false);
      setGiphyQuery('');
    }
  }, [noteId, uploadLocalFileAndConvert]);
  
  // Fetch Giphy when popover is shown or query changes
  useEffect(() => {
    if (!showGiphy) return;
    fetchGiphy(giphyQuery).catch(() => setGiphyResults([]));
  }, [showGiphy, giphyQuery, fetchGiphy]);
  
  // Close Giphy popover when clicking outside
  useEffect(() => {
    if (!showGiphy) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (giphyPopoverRef.current && !giphyPopoverRef.current.contains(target)) {
        setShowGiphy(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGiphy]);
  
  // Initialize Google Drive Picker
  const initializeGoogleDrive = useCallback(async () => {
    if (!noteId) return;
    
    const developerKey = 'AIzaSyAUhLtPqg_buEVOEtzHwHSIGabtJuIT2DY';
    const clientId = '275461782742-da796gpica1pgn8n3n41lq7f76taoafi.apps.googleusercontent.com';
    const scope = 'https://www.googleapis.com/auth/drive.readonly';

    if (!(window as any).gapi) {
      const script1 = document.createElement('script');
      script1.src = 'https://apis.google.com/js/api.js';
      script1.async = true;
      await new Promise((resolve, reject) => {
        script1.onload = () => setTimeout(resolve, 200);
        script1.onerror = reject;
        document.head.appendChild(script1);
      });
    }

    if (!(window as any).google) {
      const script2 = document.createElement('script');
      script2.src = 'https://apis.google.com/js/picker.js';
      script2.async = true;
      await new Promise((resolve, reject) => {
        script2.onload = () => setTimeout(resolve, 200);
        script2.onerror = reject;
        document.head.appendChild(script2);
      });
    }

    const gapi = (window as any).gapi;
    if (!gapi) {
      console.error('[NotesApp] Google API (gapi) not loaded');
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        if (gapi.load) {
          gapi.load('client:auth2', resolve);
        } else {
          resolve();
        }
      });
      
      await new Promise<void>((resolve) => {
        if (gapi.load) {
          gapi.load('picker', { callback: resolve });
        } else {
          resolve();
        }
      });
      
      await new Promise<void>((resolve) => {
        if (gapi.client && gapi.client.load) {
          gapi.client.load('drive', 'v2', resolve);
        } else {
          resolve();
        }
      });

      const auth2 = gapi.auth2 ? gapi.auth2.getAuthInstance() || gapi.auth2.init({ 
        client_id: clientId, 
        fetch_basic_profile: false, 
        scope 
      }) : null;
      
      if (!auth2) {
        console.error('[NotesApp] Failed to initialize Google Auth2');
        return;
      }

      let oauthToken: string | null = null;
      try {
        await auth2.signIn({ 
          prompt: 'select_account', 
          fetch_basic_profile: false, 
          scope 
        });
        
        oauthToken = auth2.currentUser.get().getAuthResponse(true).access_token;
      } catch (signInError: any) {
        if (signInError?.error === 'popup_closed_by_user' || signInError?.error === 'access_denied') {
          return;
        }
        console.error('[NotesApp] Google Drive sign-in failed:', signInError);
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
      if (err?.error !== 'popup_closed_by_user' && err?.error !== 'access_denied' && err?.error !== 'user_cancelled') {
        console.error('[NotesApp] Google Drive initialization failed:', err);
      }
    }
  }, [noteId, convertExternalFile]);
  
  // Initialize Box Select
  const initializeBox = useCallback(async () => {
    if (!noteId) return;

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
      console.error('[NotesApp] Box Select SDK not loaded');
      return;
    }

    const boxSelect = new BoxSelect(options);
    
    if (!boxSelect.isBrowserSupported || !boxSelect.isBrowserSupported()) {
      console.error('[NotesApp] Box Select not supported');
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
  }, [noteId, convertExternalFile]);
  
  // Get geolocation
  const onLocationPinClick = useCallback(async () => {
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
            // Wait for Google Maps API to be available
            let google = (window as any).google;
            let attempts = 0;
            const maxAttempts = 50; // Wait up to 5 seconds
            
            console.log('[NotesApp] Waiting for Google Maps API...');
            while ((!google || !google.maps || !google.maps.Geocoder) && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 100));
              google = (window as any).google;
              attempts++;
              if (attempts % 10 === 0) {
                console.log(`[NotesApp] Still waiting for Google Maps API... attempt ${attempts}/${maxAttempts}`);
              }
            }

            if (google && google.maps && google.maps.Geocoder) {
              console.log('[NotesApp] Google Maps API found, starting geocoding for:', lat, lng);
              try {
                const geocoder = new google.maps.Geocoder();
                const latlng = { lat, lng };
                
                // Use Promise wrapper to ensure geocoding completes
                await new Promise<void>((resolve) => {
                  geocoder.geocode({ location: latlng }, (results: any[], status: string) => {
                    console.log('[NotesApp] Geocoding callback - status:', status, 'results count:', results?.length);
                    let geocodeTitle = '';
                    if (status === 'OK' && results && results[0]) {
                      geocodeTitle = results[0].formatted_address;
                      console.log('[NotesApp] Geocoding success, title:', geocodeTitle);
                    } else {
                      // Geocoding failed or no results - use empty title (will show lat/lng)
                      console.log('[NotesApp] Geocoding failed - status:', status, 'results:', results);
                      geocodeTitle = '';
                    }
                    console.log('[NotesApp] Setting location with title:', geocodeTitle);
                    setLocation({ lat, lng, title: geocodeTitle });
                    setIsLocationFetching(false);
                    resolve();
                  });
                });
              } catch (geocodeErr: any) {
                // Handle geocoding errors (e.g., API key restrictions) gracefully
                console.warn('[NotesApp] Geocoding error (may be due to API key restrictions):', geocodeErr);
                // Fall back to coordinates
                setLocation({ lat, lng, title: '' });
                setIsLocationFetching(false);
              }
            } else {
              // Google Maps not available after waiting - use coordinates (Angular graceful fallback)
              console.warn('[NotesApp] Google Maps API not available after waiting, using coordinates. Google object:', google);
              setLocation({ lat, lng, title: '' });
              setIsLocationFetching(false);
            }
          } catch (err) {
            // Geocoding failed - use coordinates (Angular graceful fallback)
            console.warn('[NotesApp] Geocoding error:', err);
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
      console.error('[NotesApp] Location error:', err);
    }
  }, [location]);
  
  // Remove location
  const onRemoveLocation = useCallback(() => {
    setLocation(null);
  }, []);
  
  // To-field state (matching InlineInsert)
  const { data: usersData } = useUsers();
  const { data: groupsData } = useGroups();
  const { data: settingsResp } = useGeneralSettings();
  const [toItems, setToItems] = useState<ToItem[]>([]);
  const [toQuery, setToQuery] = useState('');
  const [toFocused, setToFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const toInputRef = useRef<HTMLInputElement>(null);
  
  // Users and groups maps - ensure arrays
  const usersArray = useMemo(() => {
    const data = (usersData as any)?.data ?? usersData;
    return Array.isArray(data) ? data : [];
  }, [usersData]);
  const groupsArray = useMemo(() => {
    const data = (groupsData as any)?.data ?? groupsData;
    return Array.isArray(data) ? data : [];
  }, [groupsData]);
  
  const usersMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(usersArray)) {
      usersArray.forEach((u: any) => {
        const id = normalizeIdLikeAngular(String(u.user_id || u.userId || u.id || ''));
        if (id) {
          map[id] = u;
          map[`usr-${id}`] = u;
          if (id.startsWith('usr-')) {
            map[id.replace(/^usr-/, '')] = u;
          }
        }
      });
    }
    return map;
  }, [usersArray]);
  const groupsMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(groupsArray)) {
      groupsArray.forEach((g: any) => {
        const id = normalizeIdLikeAngular(String(g.id || g.group_id || ''));
        if (id) {
          map[id] = g;
          map[`grp-${id}`] = g;
          if (id.startsWith('grp-')) {
            map[id.replace(/^grp-/, '')] = g;
          }
        }
      });
    }
    return map;
  }, [groupsArray]);
  
  // Suggestions for autocomplete
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
          // Look up group in groupsMap to get full data with title
          const groupData = (groupsMap as any)?.[id] || (groupsMap as any)?.[`grp-${id}`] || g;
          const title = String(
            groupData?.title ||
              groupData?.group_title ||
              groupData?.name ||
              g?.title ||
              g?.group_title ||
              g?.name ||
              ''
          ).trim();
          // Don't show groups with no title (Angular UI never shows blank/ID-only groups)
          if (!id || !title) return null;
          return { id, type: 'GROUP', label: title, secondaryLabel: 'Group' } as ToItem;
        })
        .filter(Boolean) as ToItem[];

    const already = new Set(toItems.map((t) => `${t.type}:${t.id}`));
    const filtered = [...baseUsers, ...baseGroups]
      .filter((it) => !already.has(`${it.type}:${it.id}`))
      .filter((it) => (q ? it.label.toLowerCase().includes(q) : true))
      .slice(0, 7);

    // Email fallback suggestion
    if (q && isValidEmail(toQuery.trim())) {
      const email = toQuery.trim();
      if (!already.has(`USER_EMAIL:${email}`)) {
        filtered.unshift({ id: email, type: 'USER_EMAIL', label: email, secondaryLabel: 'Email' });
      }
    }

    return filtered;
  }, [toFocused, toQuery, usersArray, groupsArray, toItems, groupsMap]);
  
  const open = toFocused && suggestions.length > 0;
  
  // Debug logging
  useEffect(() => {
    if (typeof window !== 'undefined' && toFocused) {
      console.log('[NotesApp] Dropdown debug:', {
        toFocused,
        toQuery,
        suggestionsLength: suggestions.length,
        suggestions,
        open,
        usersArrayLength: usersArray?.length || 0,
        groupsArrayLength: groupsArray?.length || 0,
      });
    }
  }, [toFocused, toQuery, suggestions.length, open, usersArray?.length, groupsArray?.length]);
  
  // Hydrate default recipients from settings
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
          `${String(u?.first_name || u.firstName || '').trim()} ${String(u?.last_name || u.lastName || '').trim()}`.trim() ||
          String(u?.email || shareTo);
        mapped.push({ id: shareTo, type: 'USER', label: label || shareTo });
      }
    }

    const deduped = uniqByKey(mapped, (x) => `${x.type}:${x.id}`);
    if (deduped.length) {
      setToItems(deduped);
    }
  }, [settingsResp, usersMap, groupsMap]);
  
  // Ensure color picker items are populated after Quill initializes
  // Quill clears manually added items, so we need to repopulate them
  useEffect(() => {
    const populateColorPicker = () => {
      // Find all color pickers - there might be duplicates created by Quill
      const colorPickers = document.querySelectorAll('#notes-app-editor-toolbar .ql-color-picker');
      
      // Remove duplicates - keep only the first one
      if (colorPickers.length > 1) {
        for (let i = 1; i < colorPickers.length; i++) {
          colorPickers[i].remove();
        }
      }
      
      const colorPicker = document.querySelector('#notes-app-editor-toolbar .ql-color-picker .ql-picker-options');
      if (!colorPicker) return;
      
      // Check if items already exist (avoid duplicates)
      const existingItems = colorPicker.querySelectorAll('.ql-picker-item');
      if (existingItems.length >= 60) return; // We expect ~60 color items
      
      // Color values matching Angular app
      const colors = [
        { value: '#000000', rgb: 'rgb(0, 0, 0)', primary: true, selected: true },
        { value: '#444444', rgb: 'rgb(68, 68, 68)', primary: true },
        { value: '#666666', rgb: 'rgb(102, 102, 102)', primary: true },
        { value: '#999999', rgb: 'rgb(153, 153, 153)', primary: true },
        { value: '#cccccc', rgb: 'rgb(204, 204, 204)', primary: true },
        { value: '#eeeeee', rgb: 'rgb(238, 238, 238)', primary: true },
        { value: '#f3f3f3', rgb: 'rgb(243, 243, 243)', primary: true },
        { value: '#fcfcfc', rgb: 'rgb(252, 252, 252)' },
        { value: '#ed462e', rgb: 'rgb(237, 70, 46)' },
        { value: '#f39e30', rgb: 'rgb(243, 158, 48)' },
        { value: '#fef936', rgb: 'rgb(254, 249, 54)' },
        { value: '#75f012', rgb: 'rgb(117, 240, 18)' },
        { value: '#6cf9fb', rgb: 'rgb(108, 249, 251)' },
        { value: '#0049fb', rgb: 'rgb(0, 73, 251)' },
        { value: '#8553fb', rgb: 'rgb(133, 83, 251)' },
        { value: '#e865fe', rgb: 'rgb(232, 101, 254)' },
        { value: '#eed0cd', rgb: 'rgb(238, 208, 205)' },
        { value: '#f9e7ce', rgb: 'rgb(249, 231, 206)' },
        { value: '#fcf1ce', rgb: 'rgb(252, 241, 206)' },
        { value: '#dce8d3', rgb: 'rgb(220, 232, 211)' },
        { value: '#d2e0e3', rgb: 'rgb(210, 224, 227)' },
        { value: '#d0e4f2', rgb: 'rgb(208, 228, 242)' },
        { value: '#d7d4e8', rgb: 'rgb(215, 212, 232)' },
        { value: '#e6d4db', rgb: 'rgb(230, 212, 219)' },
        { value: '#dfa29b', rgb: 'rgb(223, 162, 155)' },
        { value: '#f4cc9f', rgb: 'rgb(244, 204, 159)' },
        { value: '#fde49d', rgb: 'rgb(253, 228, 157)' },
        { value: '#bed3a9', rgb: 'rgb(190, 211, 169)' },
        { value: '#a8c4c8', rgb: 'rgb(168, 196, 200)' },
        { value: '#a2c7e5', rgb: 'rgb(162, 199, 229)' },
        { value: '#b0add5', rgb: 'rgb(176, 173, 213)' },
        { value: '#ceacbd', rgb: 'rgb(206, 172, 189)' },
        { value: '#d3746d', rgb: 'rgb(211, 116, 109)' },
        { value: '#edb573', rgb: 'rgb(237, 181, 115)' },
        { value: '#fad66e', rgb: 'rgb(250, 214, 110)' },
        { value: '#9dbe7e', rgb: 'rgb(157, 190, 126)' },
        { value: '#7fa5ad', rgb: 'rgb(127, 165, 173)' },
        { value: '#78abdb', rgb: 'rgb(120, 171, 219)' },
        { value: '#8984c1', rgb: 'rgb(137, 132, 193)' },
        { value: '#b884a1', rgb: 'rgb(184, 132, 161)' },
        { value: '#bc3723', rgb: 'rgb(188, 55, 35)' },
        { value: '#de9647', rgb: 'rgb(222, 150, 71)' },
        { value: '#ebc144', rgb: 'rgb(235, 193, 68)' },
        { value: '#78a150', rgb: 'rgb(120, 161, 80)' },
        { value: '#51818b', rgb: 'rgb(81, 129, 139)' },
        { value: '#4887c3', rgb: 'rgb(72, 135, 195)' },
        { value: '#5f5ba5', rgb: 'rgb(95, 91, 165)' },
        { value: '#9b5b79', rgb: 'rgb(155, 91, 121)' },
        { value: '#8e2819', rgb: 'rgb(142, 40, 25)' },
        { value: '#ab6520', rgb: 'rgb(171, 101, 32)' },
        { value: '#bb9223', rgb: 'rgb(187, 146, 35)' },
        { value: '#487120', rgb: 'rgb(72, 113, 32)' },
        { value: '#214f5a', rgb: 'rgb(33, 79, 90)' },
        { value: '#185891', rgb: 'rgb(24, 88, 145)' },
        { value: '#2e2b73', rgb: 'rgb(46, 43, 115)' },
        { value: '#6a2d49', rgb: 'rgb(106, 45, 73)' },
        { value: '#5e170c', rgb: 'rgb(94, 23, 12)' },
        { value: '#704314', rgb: 'rgb(112, 67, 20)' },
        { value: '#7c6014', rgb: 'rgb(124, 96, 20)' },
        { value: '#304a15', rgb: 'rgb(48, 74, 21)' },
        { value: '#16343d', rgb: 'rgb(22, 52, 61)' },
        { value: '#103b61', rgb: 'rgb(16, 59, 97)' },
        { value: '#1b1c4b', rgb: 'rgb(27, 28, 75)' },
        { value: '#461b2f', rgb: 'rgb(70, 27, 47)' },
      ];
      
      colors.forEach((color) => {
        // Check if this color already exists
        const existing = colorPicker.querySelector(`[data-value="${color.value}"]`);
        if (existing) return;
        
        const item = document.createElement('span');
        item.setAttribute('data-value', color.value);
        item.className = 'ql-picker-item';
        if (color.primary) item.classList.add('ql-primary-color');
        if (color.selected) item.classList.add('ql-selected');
        item.style.backgroundColor = color.rgb;
        
        // Ensure Quill recognizes this as a clickable color picker item
        // Quill uses event delegation on the toolbar, so clicks should work automatically
        // But we need to ensure the item is properly structured
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        
        colorPicker.appendChild(item);
        
        // Attach click handler to apply color
        // Quill uses event delegation on the toolbar container, but dynamically added items
        // might not be recognized. We'll manually apply the format.
        item.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent bubbling to avoid conflicts
          
          // Find the Quill instance - it's stored on the .ql-container element
          let editorContainer = document.querySelector('.body.cnv-notes-app-specific .ql-container');
          if (!editorContainer) {
            // Try alternative selectors
            editorContainer = document.querySelector('section.content .ql-container');
          }
          if (!editorContainer) {
            console.warn('[NotesApp] Could not find Quill container for color picker');
            return;
          }
          
          const quillInstance = (editorContainer as any).__quill;
          if (!quillInstance) {
            console.warn('[NotesApp] Could not find Quill instance for color picker');
            return;
          }
          
          // Focus the editor first to ensure selection is active
          quillInstance.focus();
          
          // Get current selection
          const range = quillInstance.getSelection(true);
          
          // Apply the color format
          try {
            if (range && range.length > 0) {
              // Apply color format to selected text
              quillInstance.formatText(range.index, range.length, 'color', color.value);
              console.log('[NotesApp] Applied color format to selection:', color.value, 'range:', range);
            } else if (range) {
              // No selection, apply to current format (for future typing)
              quillInstance.format('color', color.value);
              console.log('[NotesApp] Applied color format to cursor:', color.value);
            } else {
              // No selection at all, just set the format for future typing
              quillInstance.format('color', color.value);
              console.log('[NotesApp] Applied color format (no selection):', color.value);
            }
          } catch (error) {
            console.error('[NotesApp] Error applying color format:', error);
          }
          
          // Close the color picker dropdown
          const colorPickerParent = colorPicker.closest('.ql-color-picker');
          if (colorPickerParent) {
            colorPickerParent.classList.remove('ql-expanded');
          }
        }, true); // Use capture phase to ensure our handler runs
      });
    };
    
    // Try immediately
    populateColorPicker();
    
    // Also try after delays (in case Quill hasn't initialized yet or clears them)
    const timeoutId1 = setTimeout(populateColorPicker, 500);
    const timeoutId2 = setTimeout(populateColorPicker, 1000);
    const timeoutId3 = setTimeout(populateColorPicker, 2000);
    
    // Also observe for DOM changes (in case Quill clears them or creates duplicates)
    const observer = new MutationObserver(() => {
      populateColorPicker();
    });
    
    const toolbarElement = document.querySelector('#notes-app-editor-toolbar');
    if (toolbarElement) {
      observer.observe(toolbarElement, { childList: true, subtree: true });
    }
    
    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      observer.disconnect();
    };
  }, []);
  
  const addToItem = (item: ToItem) => {
    setToItems((prev) => uniqByKey([...prev, item], (x) => `${x.type}:${x.id}`));
    setToQuery('');
    setActiveIndex(0);
    setTimeout(() => toInputRef.current?.focus(), 0);
  };

  const removeToItem = (item: ToItem) => {
    setToItems((prev) => prev.filter((x) => !(x.type === item.type && x.id === item.id)));
  };
  
  const isAdmin = Boolean((user as any)?.isAdmin || (user as any)?.is_admin);
  const IS_STARTER_NETWORK = false; // TODO: Get from account info
  const canEdit = true; // TODO: Get from permissions
  const canComment = true; // TODO: Get from permissions
  const canChangePermissions = true; // TODO: Get from permissions
  
  const getAssetsBaseUrl = () => {
    const host = resolveServicesHostString({ allowWindow: true });
    return `https://${host}`;
  };
  
  // Close more menu when clicking outside
  useEffect(() => {
    if (!showMoreMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);
  
  const handleLikeClick = () => {
    setLikesInfo(prev => ({
      ...prev,
      liked_by_me: !prev.liked_by_me,
      like_count: prev.liked_by_me ? prev.like_count - 1 : prev.like_count + 1
    }));
  };
  
  const handleCommentsClick = () => {
    setShowCommentsPanel(!showCommentsPanel);
  };
  
  const handleShowHidePanel = () => {
    setShowCommentsPanel(!showCommentsPanel);
  };
  
  // More menu options - matches Angular editor header
  const moreMenuOptions: DropdownOption[] = [
    ...(canChangePermissions && !IS_STARTER_NETWORK ? [{
      label: 'Permissions',
      icon: 'icons_Lock-lightgray',
      iconStyle: 'cnv-icons-16',
      callback: () => {
        // TODO: Implement permissions submenu
        console.log('Permissions');
      }
    }] : []),
    ...(IS_STARTER_NETWORK ? [{
      label: 'Permissions (Upgrade)',
      icon: 'icons_Lock-lightgray',
      iconStyle: 'cnv-icons-16',
      callback: () => {
        // TODO: Show upgrade modal
        console.log('Upgrade');
      }
    }] : []),
    { isDivider: true },
    {
      label: 'Mute this post',
      icon: 'icons2_Mute-lightgray',
      iconStyle: 'cnv-icons-16',
      callback: () => {
        // TODO: Implement mute
        console.log('Mute');
      }
    },
    { isDivider: true },
    {
      label: 'Copy link',
      icon: 'linkhorizontal-lightgray',
      iconStyle: 'cnv-icons-16',
      callback: () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
      }
    },
    {
      label: 'Delete post',
      icon: 'icons2_Trash-lightgray',
      iconStyle: 'cnv-icons-16',
      callback: () => {
        // TODO: Implement delete
        console.log('Delete post');
      }
    },
    { isDivider: true },
    {
      label: 'View revisions',
      icon: 'Icon1_restore-lightgray',
      iconStyle: 'cnv-icons-16',
      callback: () => {
        // TODO: Implement revisions
        console.log('View revisions');
      }
    }
  ];

  return (
    <div className="row cnvNotesApp notes-app-bg-wrapper" style={{ maxWidth: '1440px', margin: '0 auto', height: '100%' }}>
      {/* App Header - matches Angular basicAppHeader.tpl.html */}
      <section className="app-header" style={{
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0',
        height: '65px',
        position: 'relative'
      }}>
        {/* Left Segment - Logo + Editor Header Controls */}
        <div className="segment pull-left" style={{ display: 'flex', alignItems: 'center', flex: '1' }}>
          {/* Logo */}
          <Link href="/feed" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', marginRight: '15px' }}>
            <img 
              className="logo" 
              src={(account as any)?.network_logo_url || `${getAssetsBaseUrl()}/assets/img/default-logo.png`} 
              alt={accountName}
              style={{
                width: '40px',
                maxHeight: '40px',
                borderRadius: '3px',
                verticalAlign: 'middle'
              }}
            />
          </Link>

          {/* Editor Header Controls - matches Angular notes/editor/templates/header.tpl.html */}
          <ul className="sub-app-header-controls editor">
            {/* Share this */}
            {canEdit && (
              <li onClick={() => {
                // TODO: Implement share functionality
                console.log('Share this');
              }}>
                <i className="cnv-icons-16 icons2_Share-lightgray" style={{ display: 'block', margin: 'auto', width: '16px', height: '16px' }}></i>
                <div className="format-label" style={{ display: 'block' }}>Share this</div>
              </li>
            )}
            
            {/* Add tags */}
            {canEdit && (
              <li onClick={() => setShowTags(!showTags)}>
                <i className="cnv-icons-16 icon_tag-01-01-lightgray" style={{ display: 'block', margin: 'auto', width: '16px', height: '16px' }}></i>
                <div className="format-label" style={{ display: 'block' }}>Add tags</div>
              </li>
            )}
            
            {/* Star / Unstar */}
            {!isStarred ? (
              <li onClick={() => setIsStarred(true)}>
                <i className="cnv-icons-16 icons_Star-lightgray" style={{ display: 'block', margin: 'auto', width: '16px', height: '16px' }}></i>
                <div className="format-label" style={{ display: 'block' }}>Star post</div>
              </li>
            ) : (
              <li onClick={() => setIsStarred(false)}>
                <i className="cnv-icons-16 icons_Star-blue" style={{ display: 'block', margin: 'auto', width: '16px', height: '16px' }}></i>
                <div className="format-label" style={{ display: 'block' }}>Unstar post</div>
              </li>
            )}
            
            {/* More Options */}
            <li className="more-options" ref={moreMenuRef}>
              <div style={{ position: 'relative', top: '1px' }}>
                <span className="dropdown" style={{ position: 'relative' }}>
                  <a 
                    href="#" 
                    className="dropdown-toggle"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowMoreMenu(!showMoreMenu);
                    }}
                    style={{
                      textDecoration: 'none',
                      color: '#7b8386',
                      cursor: 'pointer',
                      display: 'inline-block',
                      minWidth: '80px'
                    }}
                  >
                    <i className="placeholder-icon cnv-icons-16 icon1_more-01-lightgray" style={{ width: '20px', height: '20px', display: 'block', margin: 'auto' }}></i>
                    <span style={{ fontSize: '14px', display: 'block' }}>More</span>
                  </a>
                  {showMoreMenu && (
                    <ul className="customized dropdown-menu dropdown-menu" style={{
                      position: 'absolute',
                      top: '100%',
                      right: '0',
                      zIndex: 1000,
                      marginTop: '5px',
                      minWidth: '200px',
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      listStyle: 'none',
                      padding: '5px 0',
                      margin: '5px 0 0 0'
                    }}>
                      {moreMenuOptions.map((option, index) => {
                        if (option.isDivider) {
                          return <li key={index} className="divider" style={{ height: '1px', margin: '5px 0', backgroundColor: '#e0e0e0' }}></li>;
                        }
                        return (
                          <li key={index} className="menu-item-height" style={{ padding: '0' }}>
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (option.callback) {
                                  option.callback();
                                }
                                setShowMoreMenu(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '5px 12px',
                                textDecoration: 'none',
                                color: '#272b2c',
                                fontSize: '14px',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              {option.icon && (
                                <i className={`${option.iconStyle || 'cnv-icons-16'} ${option.icon}`} style={{ marginRight: '8px', width: '16px', height: '16px' }}></i>
                              )}
                              <span>{option.label}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </span>
              </div>
            </li>
          </ul>
        </div>

        {/* Right Segment - Common Header Controls + Notifications */}
        <div className="segment pull-right" style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          {/* Common Header Controls - matches Angular apps/headers/common/header.tpl.html */}
          <ul className="sub-app-header-controls comments-panel">
            {/* Like */}
            <li onClick={handleLikeClick}>
              {likesInfo.liked_by_me ? (
                <>
                  <i className="margin-left-30 cnv-icons-16 icons2_Like-blue" style={{ display: 'block', margin: 'auto', width: '16px', height: '16px' }}></i>
                  <div className="margin-left-30 format-label" style={{ display: 'block' }}>Unlike</div>
                </>
              ) : (
                <>
                  <i className="margin-left-30 cnv-icons-16 icons2_Like-light" style={{ display: 'block', margin: 'auto', width: '16px', height: '16px' }}></i>
                  <div className="margin-left-30 format-label" style={{ display: 'block' }}>Like</div>
                </>
              )}
            </li>
            
            {/* Comment */}
            {canComment && (
              <li onClick={handleCommentsClick} style={{ position: 'relative' }}>
                <span className="cnv-icons-16 notification-counter icons_Comments-light" style={{ display: 'block', margin: 'auto', width: '16px', height: '16px' }}></span>
                <div className="format-label" style={{ display: 'block' }}>Comment</div>
              </li>
            )}
            
            {/* Show/Hide Panel */}
            <li className="show-hide-panel" onClick={handleShowHidePanel}>
              <i className={`cnv-icons-16 icon_expand_panel-light panel-toggle ${showCommentsPanel ? 'forward' : 'backward'}`} style={{ display: 'block', margin: 'auto', width: '16px', height: '16px' }}></i>
              <div className="format-label" style={{ display: 'block' }}>
                {showCommentsPanel ? 'Hide panel' : 'Show panel'}
              </div>
            </li>
          </ul>
          
          {/* Separator */}
          <span className="separator" style={{
            width: '1px',
            height: '30px',
            backgroundColor: '#e0e0e0',
            margin: '0 10px'
          }}></span>
          
          {/* Notifications Icon */}
          <div className="notification-icon inline-control" style={{ padding: '8px 12px' }}>
            {/* TODO: Add notifications dropdown */}
            <i className="cnv-icons-16 light-bell-icon" style={{ cursor: 'pointer' }}></i>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div style={{ 
        height: 'calc(100% - 65px)',
        display: 'flex',
        position: 'relative'
      }}>
        {/* Editor Area - matches Angular notes-app-editor */}
        <div 
          className="notes-app-editor no-padding" 
          style={{
            width: showCommentsPanel ? 'calc(100% - 384px)' : '100%',
            float: 'left',
            display: 'inline-block',
            backgroundColor: '#fff',
            transition: 'width 0.3s ease',
            height: '100%',
            overflowY: 'auto'
          }}
        >
          {/* Note Editor Structure - matches Angular editorMain.tpl.html */}
          <div id="note-editor-files-paste-target" className="cnv-note-editor" style={{ height: '100%' }}>
            <div className="notesAppContainer note-container" style={{ height: '100%' }}>
              <div className="note-wrapper" style={{ position: 'relative', height: '100%', background: 'white', zIndex: 1 }}>
                <div id="scrollable-content" className="note-resize-wrapper" style={{ height: '100%', overflowY: 'auto' }}>
                  <div className="active-container" style={{ padding: '0' }}>
                    {/* Section 1: note-info - Author info, draft status, To field, Publish button */}
                    <section className="note-info l-gutter r-gutter">
                      <span className="share-with-wrapper">
                        <div className="edit-from-block">
                          <span className="dp edit">
                            <UserProfileImage
                              userId={myUserId || (user as any)?.email || 'user'}
                              user={user as any}
                              width={32}
                              height={32}
                              source="NotesApp"
                            />
                          </span>
                          <a href="#" style={{ 
                            textDecoration: 'none', 
                            color: '#272b2c',
                            verticalAlign: 'middle'
                          }}>
                            {user ? (user as any).name || (user as any).full_name || (user as any).label || 'Admin' : 'Admin'}
                          </a>
                          <span className="draft indicator">Draft</span>
                          <div className="edit-submit">
                            <span className="status-text">Autosaved in draft at 12:37 pm</span>
                            <button className="btn btn-primary">Publish</button>
                          </div>
                        </div>
                      </span>
                    </section>

                    {/* Section 2: content - Editor, Title, Toolbar, acknowledge checkbox, tags input */}
                    <section className="content l-gutter r-gutter" style={{
                      paddingLeft: '65px',
                      paddingRight: '65px'
                    }}>
                      {/* Editor with tags - InlineInsert renders tags and editor here */}
                      <div className="body cnv-notes-app-specific edit-mode" style={{ marginTop: '10px' }}>
                        <div style={{
                          border: 'none',
                          borderRadius: '3px',
                          padding: '10px',
                          backgroundColor: '#fff'
                        }}>
                          <InlineInsert />
                        </div>
                      </div>

                      {/* Title Input - matches Angular - below editor/tags */}
                      <div className="title">
                        <input
                          placeholder="Title"
                          type="text"
                          value={nodeTitle}
                          onChange={(e) => setNodeTitle(e.target.value)}
                          maxLength={1000}
                          onKeyDown={(e) => {
                            // Handle Enter key to move focus to editor
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              // TODO: Focus editor
                            }
                          }}
                        />
                      </div>

                      {/* Fake extended toolbar - matches Angular */}
                      {toggleExtendedToolbar && <div className="fake-extended-toolbar"></div>}

                      {/* Extended Toolbar - matches Angular notes-app-editor-toolbar - MUST exist before Quill initializes */}
                      {/* Always render toolbar (Quill needs it in DOM), but control visibility */}
                      <div id="notes-app-editor-toolbar" className="extended-controls no-animate ql-toolbar ql-snow" style={{ display: toggleExtendedToolbar ? 'block' : 'none' }}>
                            <span className="ql-format-group">
                              <span className="ql-format-button ql-bold icons3_Bold-darkgray ql-active"></span>
                              <span className="ql-format-button ql-italic italic-darkgray"></span>
                              <span className="ql-format-button ql-underline underline-darkgray"></span>
                              <span className="ql-format-button ql-strike strikethrough-darkgray"></span>
                              <span title="Text Color" className="ql-color ql-picker ql-color-picker">
                                <span className="ql-picker-label" data-value="#000000"></span>
                                <span className="ql-picker-options">
                                  <span data-value="#000000" className="ql-picker-item ql-selected ql-primary-color" style={{ backgroundColor: 'rgb(0, 0, 0)' }}></span>
                                  <span data-value="#444444" className="ql-picker-item ql-primary-color" style={{ backgroundColor: 'rgb(68, 68, 68)' }}></span>
                                  <span data-value="#666666" className="ql-picker-item ql-primary-color" style={{ backgroundColor: 'rgb(102, 102, 102)' }}></span>
                                  <span data-value="#999999" className="ql-picker-item ql-primary-color" style={{ backgroundColor: 'rgb(153, 153, 153)' }}></span>
                                  <span data-value="#cccccc" className="ql-picker-item ql-primary-color" style={{ backgroundColor: 'rgb(204, 204, 204)' }}></span>
                                  <span data-value="#eeeeee" className="ql-picker-item ql-primary-color" style={{ backgroundColor: 'rgb(238, 238, 238)' }}></span>
                                  <span data-value="#f3f3f3" className="ql-picker-item ql-primary-color" style={{ backgroundColor: 'rgb(243, 243, 243)' }}></span>
                                  <span data-value="#fcfcfc" className="ql-picker-item" style={{ backgroundColor: 'rgb(252, 252, 252)' }}></span>
                                  <span data-value="#ed462e" className="ql-picker-item" style={{ backgroundColor: 'rgb(237, 70, 46)' }}></span>
                                  <span data-value="#f39e30" className="ql-picker-item" style={{ backgroundColor: 'rgb(243, 158, 48)' }}></span>
                                  <span data-value="#fef936" className="ql-picker-item" style={{ backgroundColor: 'rgb(254, 249, 54)' }}></span>
                                  <span data-value="#75f012" className="ql-picker-item" style={{ backgroundColor: 'rgb(117, 240, 18)' }}></span>
                                  <span data-value="#6cf9fb" className="ql-picker-item" style={{ backgroundColor: 'rgb(108, 249, 251)' }}></span>
                                  <span data-value="#0049fb" className="ql-picker-item" style={{ backgroundColor: 'rgb(0, 73, 251)' }}></span>
                                  <span data-value="#8553fb" className="ql-picker-item" style={{ backgroundColor: 'rgb(133, 83, 251)' }}></span>
                                  <span data-value="#e865fe" className="ql-picker-item" style={{ backgroundColor: 'rgb(232, 101, 254)' }}></span>
                                  <span data-value="#eed0cd" className="ql-picker-item" style={{ backgroundColor: 'rgb(238, 208, 205)' }}></span>
                                  <span data-value="#f9e7ce" className="ql-picker-item" style={{ backgroundColor: 'rgb(249, 231, 206)' }}></span>
                                  <span data-value="#fcf1ce" className="ql-picker-item" style={{ backgroundColor: 'rgb(252, 241, 206)' }}></span>
                                  <span data-value="#dce8d3" className="ql-picker-item" style={{ backgroundColor: 'rgb(220, 232, 211)' }}></span>
                                  <span data-value="#d2e0e3" className="ql-picker-item" style={{ backgroundColor: 'rgb(210, 224, 227)' }}></span>
                                  <span data-value="#d0e4f2" className="ql-picker-item" style={{ backgroundColor: 'rgb(208, 228, 242)' }}></span>
                                  <span data-value="#d7d4e8" className="ql-picker-item" style={{ backgroundColor: 'rgb(215, 212, 232)' }}></span>
                                  <span data-value="#e6d4db" className="ql-picker-item" style={{ backgroundColor: 'rgb(230, 212, 219)' }}></span>
                                  <span data-value="#dfa29b" className="ql-picker-item" style={{ backgroundColor: 'rgb(223, 162, 155)' }}></span>
                                  <span data-value="#f4cc9f" className="ql-picker-item" style={{ backgroundColor: 'rgb(244, 204, 159)' }}></span>
                                  <span data-value="#fde49d" className="ql-picker-item" style={{ backgroundColor: 'rgb(253, 228, 157)' }}></span>
                                  <span data-value="#bed3a9" className="ql-picker-item" style={{ backgroundColor: 'rgb(190, 211, 169)' }}></span>
                                  <span data-value="#a8c4c8" className="ql-picker-item" style={{ backgroundColor: 'rgb(168, 196, 200)' }}></span>
                                  <span data-value="#a2c7e5" className="ql-picker-item" style={{ backgroundColor: 'rgb(162, 199, 229)' }}></span>
                                  <span data-value="#b0add5" className="ql-picker-item" style={{ backgroundColor: 'rgb(176, 173, 213)' }}></span>
                                  <span data-value="#ceacbd" className="ql-picker-item" style={{ backgroundColor: 'rgb(206, 172, 189)' }}></span>
                                  <span data-value="#d3746d" className="ql-picker-item" style={{ backgroundColor: 'rgb(211, 116, 109)' }}></span>
                                  <span data-value="#edb573" className="ql-picker-item" style={{ backgroundColor: 'rgb(237, 181, 115)' }}></span>
                                  <span data-value="#fad66e" className="ql-picker-item" style={{ backgroundColor: 'rgb(250, 214, 110)' }}></span>
                                  <span data-value="#9dbe7e" className="ql-picker-item" style={{ backgroundColor: 'rgb(157, 190, 126)' }}></span>
                                  <span data-value="#7fa5ad" className="ql-picker-item" style={{ backgroundColor: 'rgb(127, 165, 173)' }}></span>
                                  <span data-value="#78abdb" className="ql-picker-item" style={{ backgroundColor: 'rgb(120, 171, 219)' }}></span>
                                  <span data-value="#8984c1" className="ql-picker-item" style={{ backgroundColor: 'rgb(137, 132, 193)' }}></span>
                                  <span data-value="#b884a1" className="ql-picker-item" style={{ backgroundColor: 'rgb(184, 132, 161)' }}></span>
                                  <span data-value="#bc3723" className="ql-picker-item" style={{ backgroundColor: 'rgb(188, 55, 35)' }}></span>
                                  <span data-value="#de9647" className="ql-picker-item" style={{ backgroundColor: 'rgb(222, 150, 71)' }}></span>
                                  <span data-value="#ebc144" className="ql-picker-item" style={{ backgroundColor: 'rgb(235, 193, 68)' }}></span>
                                  <span data-value="#78a150" className="ql-picker-item" style={{ backgroundColor: 'rgb(120, 161, 80)' }}></span>
                                  <span data-value="#51818b" className="ql-picker-item" style={{ backgroundColor: 'rgb(81, 129, 139)' }}></span>
                                  <span data-value="#4887c3" className="ql-picker-item" style={{ backgroundColor: 'rgb(72, 135, 195)' }}></span>
                                  <span data-value="#5f5ba5" className="ql-picker-item" style={{ backgroundColor: 'rgb(95, 91, 165)' }}></span>
                                  <span data-value="#9b5b79" className="ql-picker-item" style={{ backgroundColor: 'rgb(155, 91, 121)' }}></span>
                                  <span data-value="#8e2819" className="ql-picker-item" style={{ backgroundColor: 'rgb(142, 40, 25)' }}></span>
                                  <span data-value="#ab6520" className="ql-picker-item" style={{ backgroundColor: 'rgb(171, 101, 32)' }}></span>
                                  <span data-value="#bb9223" className="ql-picker-item" style={{ backgroundColor: 'rgb(187, 146, 35)' }}></span>
                                  <span data-value="#487120" className="ql-picker-item" style={{ backgroundColor: 'rgb(72, 113, 32)' }}></span>
                                  <span data-value="#214f5a" className="ql-picker-item" style={{ backgroundColor: 'rgb(33, 79, 90)' }}></span>
                                  <span data-value="#185891" className="ql-picker-item" style={{ backgroundColor: 'rgb(24, 88, 145)' }}></span>
                                  <span data-value="#2e2b73" className="ql-picker-item" style={{ backgroundColor: 'rgb(46, 43, 115)' }}></span>
                                  <span data-value="#6a2d49" className="ql-picker-item" style={{ backgroundColor: 'rgb(106, 45, 73)' }}></span>
                                  <span data-value="#5e170c" className="ql-picker-item" style={{ backgroundColor: 'rgb(94, 23, 12)' }}></span>
                                  <span data-value="#704314" className="ql-picker-item" style={{ backgroundColor: 'rgb(112, 67, 20)' }}></span>
                                  <span data-value="#7c6014" className="ql-picker-item" style={{ backgroundColor: 'rgb(124, 96, 20)' }}></span>
                                  <span data-value="#304a15" className="ql-picker-item" style={{ backgroundColor: 'rgb(48, 74, 21)' }}></span>
                                  <span data-value="#16343d" className="ql-picker-item" style={{ backgroundColor: 'rgb(22, 52, 61)' }}></span>
                                  <span data-value="#103b61" className="ql-picker-item" style={{ backgroundColor: 'rgb(16, 59, 97)' }}></span>
                                  <span data-value="#1b1c4b" className="ql-picker-item" style={{ backgroundColor: 'rgb(27, 28, 75)' }}></span>
                                  <span data-value="#461b2f" className="ql-picker-item" style={{ backgroundColor: 'rgb(70, 27, 47)' }}></span>
                                </span>
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
                            </span>
                            <div className="edit-submit" style={{ display: 'none', margin: '2px 15px' }}>
                              <span className="status-text">Autosaved in draft at 12:37 pm</span>
                              <button className="btn btn-primary" type="button">Publish</button>
                            </div>
                          </div>

                      {/* Acknowledge checkbox */}
                      <div id="ackChkboxContainer" style={{ marginTop: '15px' }}>
                        <input 
                          type="checkbox" 
                          name="ackPostOptChkbox" 
                          id="ackPostOptChkboxDraft" 
                          className="cnv-checkbox ack-checkbox"
                          style={{ marginRight: '8px', verticalAlign: 'middle' }}
                        />
                        <label htmlFor="ackPostOptChkboxDraft" style={{ fontSize: '14px', color: '#272b2c', verticalAlign: 'middle' }}>
                          Recipients must acknowledge to view the post (Beta)
                        </label>
                      </div>

                      {/* Tags input */}
                      <div className="note-tags" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e0e0e0' }}>
                        <div className="to-field" style={{
                          border: '1px solid #e0e0e0',
                          borderRadius: '3px',
                          padding: '8px',
                          minHeight: '35px',
                          backgroundColor: '#fff',
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          {/* Display tags */}
                          {noteTagList.map((tag, index) => (
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
                                onClick={() => removeNoteTag(index)}
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
                            {noteTagList.length === 0 && !noteTagInputValue && (
                              <span style={{ color: '#999', fontSize: '14px', marginRight: '4px' }}>Add tags: </span>
                            )}
                            <input 
                              type="text"
                              placeholder="start typing..."
                              value={noteTagInputValue}
                              onChange={(e) => setNoteTagInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault();
                                  if (noteTagInputValue.trim()) {
                                    addNoteTag(noteTagInputValue);
                                  }
                                } else if (e.key === 'Backspace' && !noteTagInputValue && noteTagList.length > 0) {
                                  removeNoteTag(noteTagList.length - 1);
                                }
                              }}
                              onBlur={() => {
                                if (noteTagInputValue.trim()) {
                                  addNoteTag(noteTagInputValue);
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
                      
                      {/* Location container - matches Angular location-container-editor */}
                      {location && location.lat && location.lng && (
                        <div className="location-container-editor" style={{
                          maxWidth: '240px',
                          border: '1px solid #ccd0dd',
                          backgroundColor: '#f0f0f0',
                          margin: '10px 0 0 0',
                          fontSize: '14px',
                          position: 'relative',
                          height: 'fit-content',
                          padding: '5px',
                          borderRadius: '3px',
                        }}>
                          {/* Close button */}
                          <div className="close-btn" style={{ 
                            position: 'absolute',
                            right: '5px',
                            top: '5px',
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
                      
                      {/* Location fetching spinner */}
                      {isLocationFetching && !location && (
                        <div className="cnv-spinner cnv-spinner-inline-insert" style={{ margin: '10px 0' }} />
                      )}
                    </section>

                    {/* Section 3: attachments - Upload controls and file attachments */}
                    {canEdit && (
                      <section className="attachments l-gutter r-gutter" style={{
                        paddingLeft: '65px',
                        paddingRight: '65px',
                        textAlign: 'center',
                        marginTop: '20px',
                        paddingTop: '20px',
                        borderTop: '1px solid #e0e0e0'
                      }}>
                        <div className="border-separator">
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr className="attachments-tools">
                                <td className="attachment-info l-align pull-left" style={{ textAlign: 'left' }}>
                                  <span className="attachment-controls">
                                    {/* Upload link */}
                                    <a 
                                      href="javascript:void(0)" 
                                      className="super" 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        triggerFileInputClick();
                                      }}
                                    >
                                      Upload
                                    </a>
                                    
                                    {/* Hidden file input */}
                                    <input
                                      ref={fileInputRef}
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
                                            console.error('[NotesApp] File upload failed:', err);
                                          }
                                        }
                                      }}
                                    />
                                    
                                    {/* Local file upload icon */}
                                    <div 
                                      className="cnv-icons-20 icons2_Attach-darkgray attach-local"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        triggerFileInputClick();
                                      }}
                                    />
                                    
                                    {/* Google Drive icon */}
                                    <div 
                                      className="cnv-icons-20 attach-drive icons3_Google_Drive-darkgray"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        initializeGoogleDrive();
                                      }}
                                    />
                                    
                                    {/* Box icon */}
                                    <div 
                                      className="cnv-icons-20 attach-box Icon2__Box-15-darkgray"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        initializeBox();
                                      }}
                                    />
                                    
                                    {/* Location pin icon - conditional: mode == NOTE_EDIT_MODE && !noteData.item.location && !isNative */}
                                    {/* For now, always show if in edit mode (we can add more conditions later) */}
                                    <div
                                      id="location-icon-editor"
                                      className={`pin-icon cnv-icons-20 icons_Location-darkgray ${location ? 'loc-btn-disabled' : ''}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onLocationPinClick();
                                      }}
                                    />
                                    
                                    {/* Giphy icon - conditional: showGiphy && mode != NOTE_EMAIL_COMPOSE_MODE */}
                                    <div
                                      ref={giphyPopoverRef}
                                      className="giphy-action-container"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowGiphy(!showGiphy);
                                      }}
                                    >
                                      <div
                                        id="iShowGiphyPopup"
                                        className="inLineInsertGiphy giphy"
                                      />
                                      
                                      {/* Giphy popover */}
                                      {showGiphy && (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            bottom: 'calc(100% + 8px)',
                                            left: '0',
                                            width: '360px',
                                            maxHeight: 'min(300px, calc(100vh - 200px))',
                                            background: '#fff',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '4px',
                                            padding: '8px',
                                            zIndex: 1000,
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            overflow: 'hidden',
                                          }}
                                          onClick={(e) => e.stopPropagation()}
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
                                  </span>
                                </td>
                                <td className="attachment-selection-controls r-align pull-right" style={{ textAlign: 'right' }}>
                                  {/* Download all link if files exist */}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          
                          {/* Files upload container - matches Angular files-upload-container */}
                          <div 
                            className={`files-upload-container ${attachedFiles.length === 0 ? 'no-files' : ''}`}
                            style={{
                              marginTop: '10px',
                              minHeight: attachedFiles.length === 0 ? '60px' : 'auto'
                            }}
                          >
                            {/* File upload box - matches Angular file upload-box attachment-box */}
                            {attachedFiles.length === 0 && (
                              <div className="file upload-box attachment-box file chooser no-animate">
                                <div 
                                  className="file_holder" 
                                  onClick={triggerFileInputClick}
                                >
                                  <img 
                                    src={`${getAssetsBaseUrl()}/assets/img/inlineInsert/add-more.jpg`}
                                    alt="Attach files"
                                  />
                                </div>
                              </div>
                            )}
                            
                            {/* Display uploaded files */}
                            {attachedFiles.length > 0 && (
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px',
                                marginTop: '10px'
                              }}>
                                {attachedFiles.map((file) => (
                                  <div
                                    key={file.localId}
                                    className="attachment-box"
                                    style={{
                                      position: 'relative',
                                      display: 'inline-block',
                                      border: '1px solid #e0e0e0',
                                      borderRadius: '3px',
                                      padding: '5px',
                                      backgroundColor: '#fff',
                                      minWidth: '80px',
                                      minHeight: '80px'
                                    }}
                                  >
                                    {file.localPreviewUrl ? (
                                      <img 
                                        src={file.localPreviewUrl}
                                        alt={file.name}
                                        style={{
                                          width: '80px',
                                          height: '80px',
                                          objectFit: 'cover',
                                          borderRadius: '3px'
                                        }}
                                      />
                                    ) : (
                                      <div style={{
                                        width: '80px',
                                        height: '80px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '3px',
                                        fontSize: '12px',
                                        color: '#666',
                                        textAlign: 'center',
                                        padding: '5px'
                                      }}>
                                        {file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}
                                      </div>
                                    )}
                                    
                                    {/* Remove button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAttachedFiles((prev) => prev.filter((f) => f.localId !== file.localId));
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
                                        background: 'none',
                                        cursor: 'pointer',
                                        zIndex: 10
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.display = 'block';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    >
                                      ×
                                    </button>
                                    
                                    {/* Status indicator */}
                                    {file.status === 'uploading' && (
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '5px',
                                        left: '5px',
                                        right: '5px',
                                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                        color: '#fff',
                                        fontSize: '10px',
                                        padding: '2px 5px',
                                        borderRadius: '2px',
                                        textAlign: 'center'
                                      }}>
                                        Uploading...
                                      </div>
                                    )}
                                    {file.status === 'converting' && (
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '5px',
                                        left: '5px',
                                        right: '5px',
                                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                        color: '#fff',
                                        fontSize: '10px',
                                        padding: '2px 5px',
                                        borderRadius: '2px',
                                        textAlign: 'center'
                                      }}>
                                        Converting...
                                      </div>
                                    )}
                                    {file.status === 'failed' && (
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '5px',
                                        left: '5px',
                                        right: '5px',
                                        backgroundColor: 'rgba(237, 70, 46, 0.8)',
                                        color: '#fff',
                                        fontSize: '10px',
                                        padding: '2px 5px',
                                        borderRadius: '2px',
                                        textAlign: 'center'
                                      }}>
                                        Failed
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="clear" style={{ clear: 'both' }}></div>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Panel - matches Angular comments-panel-container */}
        {showCommentsPanel && (
          <div 
            className="no-padding comments-panel-container"
            style={{
              width: '384px',
              float: 'right',
              borderLeft: '1px solid #e0e0e0',
              backgroundColor: '#f9f9f9',
              height: '100%',
              overflowY: 'auto'
            }}
          >
            {/* TODO: Add InAppCommentsPanel component */}
            <div style={{ padding: '20px' }}>
              <p style={{ color: '#7b8386', fontSize: '14px' }}>Comments panel will be implemented here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
