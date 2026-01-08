/**
 * File URL Generation Utilities
 * 
 * Matches AngularJS file URL generation logic exactly
 * Based on utilFilters.js: getNoteThumbnailPath, getCommentAttachmentThumbnailPath, 
 * getOriginalImagePath, getFileResourceLinkUrl, getCommentAttachmentUrl
 */

interface FileUrlOptions {
  accountId: string;
  fileIdx?: number;
  storageVersion?: number;
  isRetina?: boolean;
  appInstanceId?: number;
}

/**
 * Get load-balanced AWS file directory base URL
 * Matches config.getLoadBalancedAwsFileDirBase
 */
function getLoadBalancedAwsFileDirBase(fileIdx: number = 0): string {
  const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
  const API_VERSION = 'v1';
  
  // Simplified version - AngularJS uses subdomain rotation but current config uses single host
  return `https://${SERVICES_HOST}/api/${API_VERSION}/files/`;
}

/**
 * Get AWS file directory base URL
 * Matches config.AWS_FILE_DIR_BASE
 */
function getAwsFileDirBase(): string {
  const SERVICES_HOST = process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';
  const API_VERSION = 'v1';
  
  return `https://${SERVICES_HOST}/api/${API_VERSION}/files/`;
}

/**
 * Get note thumbnail path
 * Matches getNoteThumbnailPath filter
 */
export function getNoteThumbnailPath(
  file: any,
  noteId: string,
  fileIdx: number = 0,
  appInstanceId: number = 6,
  size?: string,
  options?: FileUrlOptions
): string {
  // Handle preLocalData (local preview before upload)
  if (file?.preLocalData) {
    return file.preLocalData;
  }

  const accountId = options?.accountId || '';
  const storageVersion = options?.storageVersion ?? (file?.storage_version ? parseInt(file.storage_version) : 0);
  const isRetina = options?.isRetina ?? (typeof window !== 'undefined' && window.devicePixelRatio > 1);

  // Determine size if not provided
  if (!size) {
    if (file?.ver >= 5) {
      size = isRetina ? '980x500/' : '490x250/';
    } else if (file?.ver == 4 && isRetina) {
      size = '855x900/';
    } else if (file?.ver >= 3) {
      size = '566x600/';
    } else {
      size = '';
    }
  } else {
    size += '/';
  }

  // Determine directory based on app instance
  let _dir = 'note';
  if (appInstanceId == 4) {
    _dir = 'link';
  } else if (appInstanceId == 23) {
    _dir = 'poll';
  }

  const thumbnailName = file?.thumbnail_name || file?.thumbnailName;
  if (!thumbnailName) {
    return '';
  }

  const baseUrl = getLoadBalancedAwsFileDirBase(fileIdx);

  if (storageVersion) {
    // New path for storage_version > 0
    return `${baseUrl}${accountId}/attachments/thumbnails/${size}${thumbnailName}`;
  } else {
    // Old path
    return `${baseUrl}${accountId}/${_dir}${noteId}/thumbnails/${size}${thumbnailName}`;
  }
}

/**
 * Get comment attachment thumbnail path
 * Matches getCommentAttachmentThumbnailPath filter
 */
export function getCommentAttachmentThumbnailPath(
  file: any,
  itemId: string,
  fileIdx: number = 0,
  options?: FileUrlOptions
): string {
  const accountId = options?.accountId || '';
  const storageVersion = options?.storageVersion ?? (file?.storage_version ? parseInt(file.storage_version) : 0);
  const isRetina = options?.isRetina ?? (typeof window !== 'undefined' && window.devicePixelRatio > 1);

  // Determine size
  let size = '';
  if (file?.ver >= 5) {
    size = isRetina ? '980x500/' : '490x250/';
  } else if (file?.ver == 4 && isRetina) {
    size = '855x900/';
  } else if (file?.ver >= 3) {
    size = '566x600/';
  }

  // Determine app name based on app_instance_id
  let _appName = 'note';
  if (file?.app_instance_id == 4) {
    _appName = 'link';
  } else if (file?.app_instance_id == 6) {
    _appName = 'note';
  }

  const thumbnailName = file?.thumbnail_name;
  if (!thumbnailName) {
    return '';
  }

  const baseUrl = getLoadBalancedAwsFileDirBase(fileIdx);

  if (storageVersion) {
    // New path for storage_version > 0
    return `${baseUrl}${accountId}/attachments/thumbnails/${size}${thumbnailName}`;
  } else {
    // Old path
    return `${baseUrl}${accountId}/${_appName}${itemId}/thumbnails/${size}${thumbnailName}`;
  }
}

/**
 * Get original image path (for GIFs and original images)
 * Matches getOriginalImagePath filter
 */
export function getOriginalImagePath(
  originalName: string,
  resourceId: string,
  appInstanceId: number = 6,
  storageVersion: number = 0,
  options?: FileUrlOptions
): string {
  const accountId = options?.accountId || '';

  // Determine directory based on app instance
  let _dir = 'note';
  if (appInstanceId == 4) {
    _dir = 'link';
  } else if (appInstanceId == 23) {
    _dir = 'poll';
  }

  const baseUrl = getAwsFileDirBase();

  if (storageVersion) {
    // New path for storage_version > 0
    return `${baseUrl}${accountId}/attachments/${originalName}`;
  } else {
    // Old path
    return `${baseUrl}${accountId}/${_dir}${resourceId}/${originalName}`;
  }
}

/**
 * Get file resource link URL (for feed item files)
 * Matches getFileResourceLinkUrl filter
 */
export function getFileResourceLinkUrl(
  fileId: string,
  fileFormat: string,
  appId: number,
  resourceType: string,
  resourceId: string,
  title: string,
  accountId: string,
  subResourceType?: string,
  isUnifiedChat?: boolean
): string {
  if (!fileId || !fileFormat || !resourceType) {
    return '';
  }

  // Determine file type
  let fileType = 'files';
  if (fileFormat == 'IMAGE') {
    fileType = 'images';
  } else if (fileFormat === 'DOC') {
    fileType = 'files';
  }

  // Build resource link URL
  // Format: #/v1/{accountId}/apps/{appId}/{resourceType}/{resourceId}/{fileType}/{fileId}
  // Example: #/v1/12345/apps/6/messages/note_123/images/file_456
  const resourceTypeName = resourceType === '6' ? 'messages' : resourceType;
  
  let url = `#/v1/${accountId}/apps/${appId}/${resourceTypeName}/${resourceId}/${fileType}/${fileId}`;
  
  if (title) {
    url += `#title=${encodeURIComponent(title)}`;
  }

  return url;
}

/**
 * Get comment attachment URL
 * Matches getCommentAttachmentUrl filter
 */
export function getCommentAttachmentUrl(
  commentData: any,
  fileId: string,
  fileFormat: string,
  fileTitle: string,
  accountId: string
): string {
  if (!commentData?.resource_link?.resource_path) {
    return '';
  }

  const appInstanceId = commentData.app_instance_id;
  const hierarchy = commentData.resource_link.resource_path.hierarchy;

  // Handle snippet data case
  if (commentData?.resource_link?.collaboration_info?.snippet_data) {
    // Return URL without file info for snippets
    return getCommentResourceLinkUrl(appInstanceId, hierarchy, commentData, null, null, null, accountId);
  } else {
    // Return URL with file info
    return getCommentResourceLinkUrl(appInstanceId, hierarchy, commentData, fileId, fileFormat, fileTitle, accountId);
  }
}

/**
 * Get comment resource link URL (internal helper)
 * Matches getCommentResourceLinkUrlFilter
 */
function getCommentResourceLinkUrl(
  appInstanceId: number,
  hierarchy: any[],
  comment: any,
  fileId: string | null,
  fileFormat: string | null,
  fileTitle: string | null,
  accountId: string
): string {
  if (!hierarchy || hierarchy.length === 0 || !hierarchy[0]?.uid) {
    return '';
  }

  // Build title from user name and comment/file title
  let title = '';
  if (comment.from_user_name) {
    title = `${comment.from_user_name}: "`;
    if (fileTitle) {
      title += fileTitle;
    } else if (comment._comment_title) {
      title += comment._comment_title;
    }
    title += '"';
  }

  // Build resource link URL
  // Format: #/v1/{accountId}/apps/{appId}/{resourceType}/{resourceId}?comment={commentUid}&file={fileId}&file_format={fileFormat}
  const resourceTypeName = hierarchy[0].type === '6' ? 'messages' : hierarchy[0].type;
  let url = `#/v1/${accountId}/apps/${appInstanceId}/${resourceTypeName}/${hierarchy[0].uid}`;

  const params: string[] = [];
  if (comment.uid) {
    params.push(`comment=${comment.uid}`);
  }
  if (fileId) {
    params.push(`file=${fileId}`);
  }
  if (fileFormat) {
    params.push(`file_format=${fileFormat.toLowerCase()}`);
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  if (title) {
    url += `#title=${encodeURIComponent(encodeURIComponent(title))}`; // Double encode as per AngularJS
  }

  return url;
}

