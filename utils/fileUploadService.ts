/**
 * File Upload Service - Replicates AngularJS UploadService.fileConversionReq
 * 
 * Matches AngularJS uploadService.js fileConversionReq function (lines 631-753)
 * Handles file conversion requests for GIFs and other file attachments
 */

export interface FileDetail {
  name: string;
  size: number;
  fileExt: string;
  type: string;
  fileId: string;
  fileUploadName: string;
  localUrl?: string;
  source: 'url' | 'file';
  file_url: string;
  mp_attachment_source?: string;
  status?: string;
  uploadFrom?: string;
  noteId?: string;
  conversationId?: string;
  appInstanceId?: string;
  isUnifiedChat?: boolean;
  // Server response fields (populated after conversion request)
  serverFileId?: string;
  fileFormat?: string;
  thumbnailName?: string;
  originalName?: string;
  preview_name?: string;
  available_previews?: number;
  width?: number;
  height?: number;
  no_of_pages?: number;
  fileObjFromServer?: any;
}

export interface FileConversionRequest {
  file: {
    item_id?: string;
    name: string;
    file_upload_name: string;
    type: string;
    size: number;
    file_url: string;
    file_source: string | null;
    file_access_token?: string | null;
    file_preview_url?: string | null;
    storage_version: number;
    unified_account_id?: string;
    conversation_uid?: string;
    app_instance_id?: number;
    sub_resource_id?: string;
    sub_resource_type?: string;
  };
}

export interface FileConversionResponse {
  file: {
    file_id: string;
    file_format: string;
    status: 'converting' | 'success' | 'failed';
    thumbnail_name?: string;
    original_name?: string;
    preview_name?: string;
    available_previews?: number;
    width?: number;
    height?: number;
    no_of_pages?: number;
  };
}

/**
 * File Upload Service - matches AngularJS UploadService.fileConversionReq
 * 
 * @param fileDetail - File detail object (matches AngularJS fileDetail structure)
 * @param chatId - Chat ID (for chat attachments)
 * @param isUnifiedChat - Whether this is a unified chat
 * @param unifiedNetworkAccountId - Unified network account ID
 * @returns Promise with file conversion response
 */
export async function fileConversionReq(
  fileDetail: FileDetail,
  chatId?: string,
  isUnifiedChat: boolean = false,
  unifiedNetworkAccountId?: string
): Promise<FileConversionResponse> {
  // Use Next.js API route to proxy the request (avoids CORS issues)
  // The API route at /app/api/v1/files/route.ts will forward to the backend
  // This matches the pattern used by other API calls in the React app
  const endpoint = '/api/v1/files';
  
  // Build file request (matches AngularJS lines 632-643)
  const fileRequest: FileConversionRequest['file'] = {
    name: fileDetail.name,
    file_upload_name: fileDetail.fileUploadName,
    type: fileDetail.type,
    size: fileDetail.size,
    file_url: fileDetail.file_url,
    file_source: fileDetail.source || null,
    file_access_token: fileDetail.file_access_token || null,
    file_preview_url: fileDetail.file_preview_url || null,
    storage_version: 1,
  };

  // Add item_id (chatId for chat attachments) - matches AngularJS line 633
  // For chat attachments, item_id should be the chatId
  if (chatId) {
    fileRequest.item_id = chatId;
  } else if (fileDetail.noteId) {
    fileRequest.item_id = fileDetail.noteId;
  }

  // Add unified account ID if unified chat (matches AngularJS lines 644-646)
  if (isUnifiedChat && unifiedNetworkAccountId) {
    fileRequest.unified_account_id = unifiedNetworkAccountId;
  }

  // Add conversation ID for chat attachments (matches AngularJS lines 649-652)
  if (fileDetail.conversationId && chatId) {
    fileRequest.conversation_uid = chatId;
    if (fileDetail.appInstanceId) {
      fileRequest.app_instance_id = parseInt(fileDetail.appInstanceId);
    }
  }

  // Add sub-resource info if provided (matches AngularJS lines 655-659)
  if (fileDetail.subResourceId) {
    fileRequest.sub_resource_id = fileDetail.subResourceId;
    if (fileDetail.appInstanceId) {
      fileRequest.app_instance_id = parseInt(fileDetail.appInstanceId);
    }
    if (fileDetail.subResourceType) {
      fileRequest.sub_resource_type = fileDetail.subResourceType;
    }
  }

  const reqData: FileConversionRequest = { file: fileRequest };

  console.debug(`[FileUpload] File ${fileDetail.fileUploadName} submit for conversion.`);

  // Get auth token for API request
  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      const sessionData = (window as any).com_convo?.sessionData?.signInResponseData;
      return sessionData?.auth_token || '';
    }
    return '';
  };

  // Make POST request through Next.js API route (avoids CORS)
  // The API route will handle forwarding to the backend with proper auth
  // Cookies are automatically included with credentials: 'include'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication (matches Next.js API route pattern)
    body: JSON.stringify(reqData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[FileUpload] File conversion request failed:`, errorText);
    throw new Error(`File conversion request failed: ${response.status} ${response.statusText}`);
  }

  const data: FileConversionResponse = await response.json();

  // Validate response (matches AngularJS lines 667-742)
  if (data && data.file && (data.file.status.toLowerCase() === 'converting' || data.file.status.toLowerCase() === 'success')) {
    // Update fileDetail with server response (matches AngularJS lines 669-727)
    fileDetail.serverFileId = data.file.file_id;
    fileDetail.fileFormat = data.file.file_format;

    if (data.file.status.toLowerCase() === 'success') {
      // File conversion completed immediately (matches AngularJS lines 704-727)
      fileDetail.width = data.file.width;
      fileDetail.height = data.file.height;
      fileDetail.thumbnailName = data.file.thumbnail_name;
      fileDetail.originalName = data.file.original_name;
      fileDetail.preview_name = data.file.preview_name;
      fileDetail.available_previews = data.file.available_previews;
      fileDetail.no_of_pages = data.file.no_of_pages;
      fileDetail.fileObjFromServer = data.file;
      fileDetail.status = 'fscc'; // FILE_STATUS_CONVERSION_COMPLETED

      console.debug(`[FileUpload] File ${fileDetail.fileUploadName} upload+conversion completed.`);
    } else {
      // File is converting (matches AngularJS lines 672-701)
      fileDetail.status = 'fscrs'; // FILE_STATUS_CONVERSION_REQ_SUCCESS
      console.debug(`[FileUpload] File ${fileDetail.fileUploadName} submitted for conversion.`);
    }

    return data;
  } else {
    // Error state (matches AngularJS lines 730-742)
    fileDetail.status = 'fscrf'; // FILE_STATUS_CONVERSION_REQ_FAILED
    fileDetail.retryAllowed = true;
    console.error(`[FileUpload] File ${fileDetail.fileUploadName} submit for conversion failed.`);
    throw new Error('File conversion request failed: unexpected response format');
  }
}

/**
 * Poll for file conversion status (matches AngularJS UploadService.pollForFilesStatus)
 * 
 * @param fileId - Server file ID
 * @param chatId - Chat ID
 * @param isUnifiedChat - Whether this is a unified chat
 * @param unifiedNetworkAccountId - Unified network account ID
 * @returns Promise with final file info when conversion completes
 */
export async function pollFileConversionStatus(
  fileId: string,
  chatId: string,
  isUnifiedChat: boolean = false,
  unifiedNetworkAccountId?: string
): Promise<FileDetail | null> {
  // Use Next.js API route to proxy the request (avoids CORS issues)
  // Matches AngularJS filesConversionStatusReq - uses POST to /files with converting_file_ids
  const endpoint = '/api/v1/files';
  
  // Use provided unifiedNetworkAccountId, or get it from service if not provided
  const finalUnifiedNetworkAccountId = unifiedNetworkAccountId || (() => {
    if (typeof window !== 'undefined') {
      const networkSettingService = (window as any).com_convo?.networkSettingService;
      if (networkSettingService && typeof networkSettingService.getUnifiedNetworkAccountId === 'function') {
        return networkSettingService.getUnifiedNetworkAccountId();
      }
    }
    return undefined;
  })();
  const maxPollAttempts = 60; // Poll for up to 60 attempts (matches AngularJS)
  const pollInterval = 2000; // Poll every 2 seconds (matches AngularJS)
  
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    try {
      // Build request data matching AngularJS filesConversionStatusReq (lines 992-1003)
      const reqData: any = {
        converting_file_ids: fileId, // Single file ID as comma-separated string (AngularJS uses join())
      };
      
      // Add unified account ID if needed (matches AngularJS lines 998-1001)
      if (isUnifiedChat && finalUnifiedNetworkAccountId) {
        reqData.converting_file_ids_unified = fileId;
        reqData.unified_account_id = finalUnifiedNetworkAccountId;
      }
      
      // Use Next.js API route to proxy the request (avoids CORS)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(reqData),
      });

      if (!response.ok) {
        console.warn(`[FileUpload] Poll attempt ${attempt + 1} failed:`, response.status);
        continue;
      }

      // Parse response - AngularJS expects files_status array (line 769)
      const data: any = await response.json();
      
      // Find the file status in the response (matches AngularJS lines 770-834)
      if (data && data.files_status && Array.isArray(data.files_status)) {
        const fileStatus = data.files_status.find((f: any) => f.file_id === fileId);
        
        if (fileStatus) {
          if (fileStatus.status.toLowerCase() === 'success') {
            // Conversion complete - return final file info (matches AngularJS lines 774-803)
            return {
              fileId: fileStatus.file_id,
              serverFileId: fileStatus.file_id,
              name: fileStatus.name || '',
              size: fileStatus.size || 0,
              type: fileStatus.type || '',
              fileFormat: fileStatus.file_format,
              thumbnailName: fileStatus.thumbnail_name,
              originalName: fileStatus.original_name,
              width: fileStatus.width,
              height: fileStatus.height,
              available_previews: fileStatus.available_previews,
              preview_name: fileStatus.preview_name,
              no_of_pages: fileStatus.no_of_pages,
              storage_version: 1,
              status: 'fscc', // FILE_STATUS_CONVERSION_COMPLETED
              fileExt: 'gif',
              fileUploadName: `${fileStatus.file_id}.gif`,
              source: 'url',
              file_url: '',
            };
          } else if (fileStatus.status.toLowerCase() === 'converting') {
            // Still converting - continue polling (matches AngularJS lines 805-816)
            console.log(`[FileUpload] File ${fileId} still converting, attempt ${attempt + 1}/${maxPollAttempts}`);
            continue;
          } else {
            // Conversion failed (matches AngularJS lines 818-832)
            console.error(`[FileUpload] File conversion failed:`, fileStatus.status);
            return null;
          }
        }
      }
    } catch (error) {
      console.error(`[FileUpload] Poll attempt ${attempt + 1} error:`, error);
      // Continue polling on error
    }
  }
  
  // Max attempts reached
  console.error(`[FileUpload] File conversion polling timeout after ${maxPollAttempts} attempts`);
  return null;
}

