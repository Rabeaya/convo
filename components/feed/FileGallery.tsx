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
              const fileId = file.file_id || file.id;
              const isVideo = isVideoFile(file) || file.file_format === 'VIDEO';
              const isDoc = file.file_format === 'DOC' || file.file_format === 'OTHER';
              const isGif = file.type === 'gif';
              const isAudio = isAudioFile(file);
              const hasThumbnail = (file.thumbnail_name || file.thumbnailName) && !isGif;
              const fileExt = getFileExtension(file.name);
              const iconClass = getSmallFileIconClassByType(fileExt);
              
              // AngularJS logic from galleryFooter.tpl.html line 19-20:
              // <img bo-if="key.thumbnail_name" bo-src="getFileThumbnailPath(key, $index)" />
              // <div bo-if="key.file_format !== 'IMAGE' || !key.thumbnail_name" class="file-detail-tab">
              // This means: Show thumbnail if thumbnail_name exists (regardless of file_format)
              // Show file-detail-tab if file_format !== 'IMAGE' OR no thumbnail_name
              // 
              // From cnvNoteGallery.js line 428:
              // if (file.file_format !== 'OTHER' && file.status === 'SUCCESS' && file.thumbnail_name)
              // This means: Show thumbnail if file_format !== 'OTHER' AND status === 'SUCCESS' AND has thumbnail_name
              // This includes DOC (PDF) files that have thumbnails
              const canShowThumbnail = hasThumbnail && 
                                       file.status === 'SUCCESS' && 
                                       file.file_format !== 'OTHER';
              
              // Get thumbnail URL using AngularJS logic
              let thumbnailUrl = '';
              if (isGif && file.original_name) {
                // GIF files use original image path
                thumbnailUrl = getOriginalImagePath(
                  file.original_name,
                  noteId,
                  appId,
                  file.storage_version || 0,
                  { accountId }
                );
              } else if (canShowThumbnail) {
                // Files with thumbnails (including PDFs) use thumbnail path
                // Matches AngularJS: getFileThumbnailPath(key, $index)
                thumbnailUrl = getNoteThumbnailPath(
                  file,
                  noteId,
                  index,
                  appId,
                  undefined,
                  { accountId, storageVersion: file.storage_version }
                );
              }
              
              // Get file resource link URL
              const fileUrl = getFileResourceLinkUrl(
                fileId,
                file.file_format,
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
                    {/* Show thumbnail if available - matches AngularJS: <img bo-if="key.thumbnail_name" bo-src="getFileThumbnailPath(key, $index)" /> */}
                    {/* This shows thumbnails for IMAGE, DOC (PDFs with thumbnails), and VIDEO files */}
                    {canShowThumbnail && thumbnailUrl && !isVideo && (
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
                        onError={(e) => {
                          // Fallback to file icon on error
                          (e.target as HTMLImageElement).src = '/assets/img/chat/fileplainlarge.png';
                        }}
                      />
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

                    {/* File detail tab - matches AngularJS: <div bo-if="key.file_format !== 'IMAGE' || !key.thumbnail_name" class="file-detail-tab"> */}
                    {/* Show if: file_format is not IMAGE OR no thumbnail_name */}
                    {/* This means: show icon for files without thumbnails OR OTHER format files */}
                    {!canShowThumbnail && (
                      <div className="file-detail-tab" style={{
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
                        {/* Icon - matches AngularJS: cnv-icons-30 with getSmallFileIconClassByTypeFromAssets */}
                        <span className={`ico cnv-icons-30 ${iconClass}`} style={{
                          display: 'block',
                          marginBottom: '5px',
                        }}>
                          {fileExt.toUpperCase()}
                        </span>
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

