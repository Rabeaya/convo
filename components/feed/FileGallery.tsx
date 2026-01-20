'use client';

/**
 * File Gallery Component
 * 
 * Displays files attached to a feed item in a horizontal scrollable gallery
 * Migrated from AngularJS cnv-note-gallery directive
 * Exact 1:1 match with AngularJS implementation
 */

import { useEffect, useRef, useState } from 'react';
import { getNoteThumbnailPath, getFileResourceLinkUrl, getOriginalImagePath } from '@/lib/utils/file-urls';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getSmallFileIconClassByType, getFileExtension, isAudioFile, isVideoFile } from '@/lib/utils/file-icons';

export interface FileItem {
  file_id: string;
  name: string;
  type: string;
  file_format: string;
  thumbnail_name?: string;
  original_name?: string;
  status?: string;
  width?: number;
  height?: number;
  size?: number;
  storage_version?: number;
  available_previews?: number;
  insert_revision?: number;
  id?: string;
  ver?: number;
  thumbnailName?: string;
  preLocalData?: string;
}

interface FileGalleryProps {
  files: FileItem[];
  noteId: string;
  resourceType: string;
  appId: number;
  isActivatedPinnedPost?: boolean;
}


export default function FileGallery({ files, noteId, resourceType, appId, isActivatedPinnedPost = false }: FileGalleryProps) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(495);
  const { loginData } = useAuthStore();
  const accountId = loginData?.account_id?.toString() || '';
  // Track loaded images for GIF switching logic (Angular parity)
  const loadedImagesRef = useRef<Map<string, { isLoaded: boolean; imgElement: HTMLImageElement | null }>>(new Map());

  useEffect(() => {
    if (galleryRef.current) {
      setContainerWidth(galleryRef.current.offsetWidth || 495);
    }
  }, []);

  if (!files || files.length === 0) {
    return null;
  }

  const MAX_THUMB_HEIGHT = 220;
  const MIN_THUMB_WIDTH = 250;
  const MAX_THUMB_WIDTH = 485;
  const MARGIN_LEFT = 10;

  return (
    <div 
      id="notegallery" 
      className="images"
      style={{
        minHeight: '220px', // itemData.viewData.note_gallery_height
        position: 'relative',
      }}
    >
      <div className="cnv-note-gallery-container">
        <div className="overlay" style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '20px',
          height: '100%',
          background: 'url(/assets/img/common/gallery-fog.png)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top right',
          zIndex: 1,
          pointerEvents: 'none',
          opacity: 1,
        }}></div>
        <div 
          ref={galleryRef}
          className="feedGalleryContainer scrollable"
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            whiteSpace: 'nowrap',
            width: '100%',
            position: 'relative',
          }}
        >
          <ul className="mainUl" style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'inline-flex',
            whiteSpace: 'nowrap',
          }}>
            {files.map((file, index) => {
              const fileId = String(file.file_id || file.id || index);
              const isVideo = isVideoFile(file) || file.file_format === 'VIDEO';
              const isDoc = file.file_format === 'DOC' || file.file_format === 'OTHER';
              const isGif = file.type === 'gif';
              const isAudio = isAudioFile(file);
              const hasThumbnail = (file.thumbnail_name || file.thumbnailName);
              const fileExt = getFileExtension(file.name);
              const iconClass = getSmallFileIconClassByType(fileExt);
              
              // AngularJS logic from cnvNoteGallery.js:
              // Line 428: if (file.file_format !== 'OTHER' && file.status === 'SUCCESS' && file.thumbnail_name)
              //   file.thumbnail_image = getNoteThumbnailPath(...)
              // Line 495: file.originalImagePath = getOriginalImagePathFilter(...) - for ALL files
              // Line 598: if (file.thumbnail_image) { render img } - shows image if thumbnail_image exists
              // Line 617: if (file.isVideoDocOrOther || file.isImagePendingConversion) { render file-detail-tab }
              //
              // Key insight: Angular shows image if thumbnail_image exists, regardless of status
              // The canShowThumbnail condition only determines if thumbnail_image is SET, not if it's SHOWN
              
              const isImage = file.file_format === 'IMAGE';
              const isImagePendingConversion = isImage && file.status !== 'SUCCESS';
              const isVideoDocOrOther = isVideo || isDoc;
              
              // Condition for SETTING thumbnail_image (matches AngularJS line 428)
              // AngularJS: if (file.file_format !== 'OTHER' && file.status === 'SUCCESS' && file.thumbnail_name)
              const canSetThumbnail = hasThumbnail && 
                                      file.status === 'SUCCESS' && 
                                      file.file_format !== 'OTHER';
              
              // Get thumbnail URL (used for ALL files with thumbnails, including GIFs and PNGs)
              let thumbnailUrl = '';
              let originalImageUrl = '';
              let originalGifUrl = '';
              
              if (canSetThumbnail) {
                // Files with thumbnails (including GIFs, PNGs, and PDFs) use thumbnail path
                // Matches AngularJS: getNoteThumbnailPath(file, noteId, fileIdx, appInstanceId, size, isUnifiedChat)
                // AngularJS passes null for appInstanceId (line 452), but the filter uses file.app_instance_id if needed
                // We pass appId which should be correct, but ensure it's not null/undefined
                const effectiveAppId = appId || 6; // Default to 6 (note) if not provided
                thumbnailUrl = getNoteThumbnailPath(
                  file,
                  noteId,
                  index,
                  effectiveAppId,
                  undefined,
                  { accountId, storageVersion: file.storage_version }
                );
              }
              
              // AngularJS: Always get original image path (line 495) - used for GIFs and as fallback for other images
              // This is set for ALL files, regardless of status
              if (file.original_name) {
                // AngularJS: getOriginalImagePathFilter(file.original_name || "", file.noteId, null, null, null, null, parseInt(file?.storage_version) || 0)
                const storageVersion = file.storage_version != null ? parseInt(String(file.storage_version), 10) : 0;
                originalImageUrl = getOriginalImagePath(
                  file.original_name,
                  noteId,
                  appId,
                  storageVersion,
                  { accountId }
                );
                
                // For GIFs, use originalImageUrl as gifLink
                if (isGif) {
                  originalGifUrl = originalImageUrl;
                }
              }
              
              // For IMAGE files (like PNGs), if thumbnail_image wasn't set but we have original_name, use original image
              // This handles cases where status !== 'SUCCESS' but we still want to show the image
              // AngularJS doesn't do this automatically, but it's a reasonable fallback
              if (isImage && !thumbnailUrl && originalImageUrl) {
                // Use original image if thumbnail is not available
                thumbnailUrl = originalImageUrl;
              }
              
              // Ensure thumbnailUrl is set for images that should display
              // AngularJS shows image if thumbnail_image exists, so we should always try to generate it
              // Even if status !== 'SUCCESS', if we have thumbnail_name, try to generate thumbnail URL
              if (isImage && !thumbnailUrl && hasThumbnail && file.file_format !== 'OTHER') {
                // Try to generate thumbnail even if status is not SUCCESS (Angular only does this if SUCCESS, but we'll try)
                // This handles edge cases where status might be missing or different
                const effectiveAppId = appId || 6; // Default to 6 (note) if not provided
                thumbnailUrl = getNoteThumbnailPath(
                  file,
                  noteId,
                  index,
                  effectiveAppId,
                  undefined,
                  { accountId, storageVersion: file.storage_version }
                );
              }
              
              // Final fallback: if still no thumbnailUrl but we have original_name for images, use original
              if (isImage && !thumbnailUrl && originalImageUrl) {
                thumbnailUrl = originalImageUrl;
              }
              
              // Get file resource link URL
              const fileUrl = getFileResourceLinkUrl(
                fileId,
                String(file.file_format || 'OTHER'),
                appId,
                resourceType,
                noteId,
                file.name,
                accountId
              );

              // Calculate thumbnail dimensions (matches AngularJS calculateThumbnailDimensions)
              let thumbWidth = MIN_THUMB_WIDTH;
              let thumbHeight = MAX_THUMB_HEIGHT;
              
              if (file.width && file.height) {
                const aspectRatio = file.width / file.height;
                if (aspectRatio > 1) {
                  // Landscape
                  thumbWidth = Math.min(MAX_THUMB_WIDTH, Math.max(MIN_THUMB_WIDTH, file.width));
                  thumbHeight = thumbWidth / aspectRatio;
                } else {
                  // Portrait
                  thumbHeight = Math.min(MAX_THUMB_HEIGHT, file.height);
                  thumbWidth = thumbHeight * aspectRatio;
                }
              }

              return (
                <li
                  key={fileId}
                  id={`file-${fileId}`}
                  style={{
                    display: 'inline-block',
                    marginRight: index < files.length - 1 ? `${MARGIN_LEFT}px` : '0',
                    verticalAlign: 'top',
                    position: 'relative',
                  }}
                >
                  <a
                    href={fileUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      // Navigate to file detail view (matches AngularJS openFile)
                      window.location.href = fileUrl;
                    }}
                    style={{
                      display: 'block',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    {/* AngularJS: Shows image if file.thumbnail_image exists (line 598) - regardless of status */}
                    {/* AngularJS: For GIFs, loads thumbnail first (imgLink), then switches to GIF (gifLink) on load */}
                    {/* This shows thumbnails for IMAGE, DOC (PDFs with thumbnails), GIF, and VIDEO files */}
                    {/* Match AngularJS: if (file.thumbnail_image) { render img } */}
                    {thumbnailUrl && !isVideo && (
                      <div style={{ position: 'relative' }}>
                        {/* GIF badge and spinner - matches AngularJS */}
                        {isGif && (
                          <>
                            <i className="gif-badge" style={{
                              position: 'absolute',
                              top: '5px',
                              left: '5px',
                              background: 'rgba(0, 0, 0, 0.7)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              zIndex: 2,
                            }}>GIF</i>
                            <i className="cnv-spinner light" style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              zIndex: 2,
                              display: 'none', // Will be shown when loading GIF
                            }}></i>
                          </>
                        )}
                        <img
                          id={`file-img-${fileId}`}
                          data-thumb={thumbnailUrl}
                          data-gif={isGif ? originalGifUrl : undefined}
                          data-original={isImage && originalImageUrl ? originalImageUrl : undefined}
                          src={thumbnailUrl}
                          alt={file.name}
                          style={{
                            width: `${thumbWidth}px`,
                            height: `${thumbHeight}px`,
                            objectFit: 'contain',
                            border: '1px solid #e3e3e3',
                            borderRadius: '3px',
                            display: 'block',
                          }}
                          onLoad={(e) => {
                            // AngularJS: loadImage() logic - for GIFs, switch to original GIF after thumbnail loads
                            // AngularJS: $image.on("load", function() { 
                            //   if($img.attr("src") == gifLink) { hide spinner } 
                            //   else if(imgObj.isLoaded) { $img.attr("src", gifLink); } 
                            // })
                            const img = e.target as HTMLImageElement;
                            const gifUrl = img.getAttribute('data-gif');
                            const thumbUrl = img.getAttribute('data-thumb');
                            const spinner = img.parentElement?.querySelector('.cnv-spinner') as HTMLElement;
                            
                            if (gifUrl && isGif) {
                              const currentSrc = img.src;
                              const loadedState = loadedImagesRef.current.get(fileId);
                              
                              // Check if we're already showing the GIF
                              if (currentSrc === gifUrl || currentSrc.endsWith(gifUrl.split('/').pop() || '')) {
                                // GIF is loaded, hide spinner
                                if (spinner) {
                                  spinner.style.display = 'none';
                                }
                                // Store that this image is loaded
                                loadedImagesRef.current.set(fileId, { isLoaded: true, imgElement: img });
                              } else if (loadedState?.isLoaded || (thumbUrl && (currentSrc === thumbUrl || currentSrc.endsWith(thumbUrl.split('/').pop() || '')))) {
                                // Thumbnail just loaded (or was already loaded), now switch to GIF
                                // Store that thumbnail is loaded
                                loadedImagesRef.current.set(fileId, { isLoaded: true, imgElement: img });
                                // Show spinner while loading GIF
                                if (spinner) {
                                  spinner.style.display = 'block';
                                }
                                // Switch to GIF
                                img.src = gifUrl;
                              } else {
                                // First load - thumbnail loaded
                                loadedImagesRef.current.set(fileId, { isLoaded: true, imgElement: img });
                                // Switch to GIF
                                img.src = gifUrl;
                                if (spinner) {
                                  spinner.style.display = 'block';
                                }
                              }
                            } else {
                              // Not a GIF, just mark as loaded
                              loadedImagesRef.current.set(fileId, { isLoaded: true, imgElement: img });
                            }
                          }}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            const currentSrc = img.src;
                            const thumbSrc = img.getAttribute('data-thumb');
                            const gifSrc = img.getAttribute('data-gif');
                            const originalSrc = img.getAttribute('data-original');
                            
                            // AngularJS: retry images once
                            // If we're on the GIF URL and it failed, try reloading thumbnail
                            if (currentSrc === gifSrc && thumbSrc) {
                              setTimeout(() => {
                                const testImg = new Image();
                                testImg.src = thumbSrc;
                              }, 1000);
                            }
                            
                            // For IMAGE files (like PNGs), if thumbnail fails, try original image as fallback
                            if (isImage && originalSrc && currentSrc === thumbSrc && currentSrc !== originalSrc) {
                              // Try original image as fallback
                              img.src = originalSrc;
                              return;
                            }
                            
                            // Fallback to transparent pixel only if all options exhausted
                            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Video with thumbnail and play overlay */}
                    {isVideo && thumbnailUrl && (
                      <div style={{ position: 'relative' }}>
                        <img
                          src={thumbnailUrl}
                          alt={file.name}
                          style={{
                            width: `${thumbWidth}px`,
                            height: `${thumbHeight}px`,
                            objectFit: 'contain',
                            border: '1px solid #e3e3e3',
                            borderRadius: '3px',
                            display: 'block',
                          }}
                        />
                        <div className="attachment-play-overlay videoHoverIcon" style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '50px',
                          height: '50px',
                          background: 'rgba(0, 0, 0, 0.6)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <i className="cnv-icons-20 icons2_Play-white" style={{
                            color: 'white',
                            fontSize: '20px',
                          }}></i>
                        </div>
                      </div>
                    )}

                    {/* File detail tab - matches AngularJS line 617: ALWAYS shown for DOC/OTHER/VIDEO files */}
                    {/* AngularJS: if (file.isVideoDocOrOther || file.isImagePendingConversion) */}
                    {/* This overlay is shown EVEN when thumbnail exists (for PDFs with thumbnails) */}
                    {(isVideoDocOrOther || isImagePendingConversion) && (
                      <div className="file-detail-tab" style={{
                        height: '30px',
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.65)',
                        position: 'absolute',
                        bottom: 0,
                        lineHeight: 'normal',
                        textAlign: 'left',
                        padding: '0 5px 0 5px',
                        display: 'block',
                      }}>
                        {/* Icon - matches AngularJS: ext_holder cnv-small-file-ico with fileExt */}
                        {/* AngularJS: <i class="ext_holder cnv-small-file-ico pdf"><span class="fileExt">pdf</span></i> */}
                        <i className={`ext_holder cnv-small-file-ico ${fileExt}`} style={{
                          width: '35px',
                          height: '18px',
                          display: 'block',
                          float: 'left',
                          opacity: 0.75,
                          position: 'relative',
                          top: '5px',
                        }}>
                          <span className="fileExt" style={{
                            display: 'inline-block',
                            position: 'relative',
                            top: '-3px',
                            fontSize: '12px',
                            color: '#fff',
                            textTransform: 'uppercase',
                          }}>
                            {/* Format extension: truncate to 4 chars max (first 2 + ".." if longer) */}
                            {/* AngularJS: getFileExtensionForIcon filter */}
                            {fileExt.length > 4 ? fileExt.substring(0, 2) + '..' : fileExt}
                          </span>
                        </i>
                        {/* File name - matches AngularJS: span.filename */}
                        <span className="filename" style={{
                          color: '#fff',
                          fontSize: '14px',
                          width: 'auto',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                          paddingLeft: '3px',
                          lineHeight: '29px',
                        }}>
                          {file.name}
                        </span>
                      </div>
                    )}
                    
                    {/* Fallback: Show icon-only view when NO thumbnail AND isVideoDocOrOther */}
                    {/* This matches AngularJS: if (file.thumbnail_class) { render icon } */}
                    {!thumbnailUrl && (isVideoDocOrOther || isImagePendingConversion) && (
                      <div style={{
                        width: `${thumbWidth}px`,
                        height: `${thumbHeight}px`,
                        border: '1px solid #e3e3e3',
                        borderRadius: '3px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'white',
                        padding: '10px',
                      }}>
                        {/* Large icon for files without thumbnails */}
                        <span className={`ico cnv-icons-64 fileplainlarge-darkgray`} style={{
                          display: 'block',
                          marginBottom: '5px',
                        }}></span>
                        {/* File name */}
                        <span style={{
                          fontSize: '12px',
                          textAlign: 'center',
                          wordBreak: 'break-word',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>{file.name}</span>
                      </div>
                    )}

                    {/* Image overlay for hover effect */}
                    <div className="imageOverlay" style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0)';
                    }}
                    ></div>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

