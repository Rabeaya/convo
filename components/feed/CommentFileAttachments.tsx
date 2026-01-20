'use client';

/**
 * Comment File Attachments Component
 * 
 * Displays files attached to a comment
 * Migrated from AngularJS cnv-comment file attachments section
 * Exact 1:1 match with AngularJS implementation
 */

import { getCommentAttachmentThumbnailPath, getCommentAttachmentUrl, getOriginalImagePath } from '@/lib/utils/file-urls';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getFileExtension, isAudioFile, isVideoFile } from '@/lib/utils/file-icons';

export interface CommentFile {
  file_id: string;
  name: string;
  type: string;
  file_format: string;
  thumbnail_name?: string;
  original_name?: string;
  isDefaultThumbnail?: boolean;
  storage_version?: number;
  width?: number;
  height?: number;
  fileSearchMatchesText?: string;
  fileSearchHighlightedName?: string;
  ver?: number;
  app_instance_id?: number;
}

interface CommentFileAttachmentsProps {
  files: CommentFile[];
  commentUid: string;
  resourceId: string;
  appInstanceId: number;
  commentData?: any; // Full comment data for URL generation
}


export default function CommentFileAttachments({ files, commentUid, resourceId, appInstanceId, commentData }: CommentFileAttachmentsProps) {
  const { loginData } = useAuthStore();
  const accountId = loginData?.account_id?.toString() || '';

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="file-attachments-container" style={{
      marginTop: '8px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
    }}>
      {files.map((file, index) => {
        const isGif = file.type === 'gif';
        // AngularJS: hasThumbnail = (file.thumbnail_name || file.isDefaultThumbnail) && file.type != 'gif'
        const hasThumbnail = (file.thumbnail_name || file.isDefaultThumbnail) && !isGif;
        const isVideo = isVideoFile(file) || file.file_format === 'VIDEO';
        const isDoc = file.file_format === 'DOC' || file.file_format === 'OTHER';
        const isAudio = isAudioFile(file);
        const fileExt = getFileExtension(file.name);
        
        // Check if this is a PDF file (PDFs have file_format === 'OTHER' and extension === 'pdf')
        const isPdf = fileExt === 'pdf' || file.file_format === 'OTHER';
        
        // AngularJS: For mp4 files, getSmallFileIconClassByTypeFromAssets returns 'cnv-small-file-ico' (no extension class)
        // This means mp4 files use the default white background, not a colored background
        const iconExtensionClass = fileExt === 'mp4' ? '' : fileExt;
        
        // Get thumbnail URL using AngularJS logic
        let thumbnailSrc = '';
        if (isGif && file.original_name) {
          // GIF files use original image path
          // AngularJS: getOriginalImagePath(originalName, resourceId, appInstanceId, dontUseSubDomain, touchThePath, isUnifiedChat, storageVersion)
          const storageVersion = file.storage_version != null ? parseInt(String(file.storage_version), 10) : 0;
          thumbnailSrc = getOriginalImagePath(
            file.original_name,
            resourceId,
            appInstanceId,
            storageVersion,
            { accountId }
          );
        } else if ((file.thumbnail_name || file.isDefaultThumbnail) && !isGif) {
          // Regular images use comment attachment thumbnail path
          // AngularJS: getCommentAttachmentThumbnailPath(file, itemId, fileIdx)
          thumbnailSrc = getCommentAttachmentThumbnailPath(
            { ...file, app_instance_id: appInstanceId },
            resourceId,
            index,
            { accountId, storageVersion: file.storage_version }
          );
        } else {
          // Fallback to transparent background
          thumbnailSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
        
        // Get comment attachment URL
        const fileUrl = commentData 
          ? getCommentAttachmentUrl(commentData, file.file_id, file.file_format, file.name, accountId)
          : `#/comments/${commentUid}/files/${file.file_id}/${file.file_format.toLowerCase()}/${encodeURIComponent(file.name)}`;

        // Calculate attachment dimensions (matches AngularJS attachmentStylesArr)
        // Default height is 90px for comment attachments
        const attachmentHeight = 90;
        let attachmentWidth = attachmentHeight;
        
        if (file.width && file.height) {
          const aspectRatio = file.width / file.height;
          attachmentWidth = attachmentHeight * aspectRatio;
        }

        return (
          <div key={file.file_id} className="attachment-inner-wrapper" style={{
            display: 'inline-block',
            marginRight: index < files.length - 1 ? '8px' : '0',
          }}>
            <div className="comment-attachments" style={{
              position: 'relative',
              display: 'inline-block',
            }}>
              <a
                href={fileUrl}
                className="comment-attachment-navigate"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = fileUrl;
                }}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                }}
              >
                <span className="attachment-cont" style={{
                  position: 'relative',
                  display: 'block',
                  width: `${attachmentWidth}px`,
                  height: `${attachmentHeight}px`,
                  overflow: 'hidden',
                  border: '1px solid #e0e0e0',
                  borderRadius: '3px',
                }}>
                  {/* Image thumbnail */}
                  {hasThumbnail && (
                    <img
                      src={thumbnailSrc}
                      alt={file.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                      onError={(e) => {
                        // Fallback to transparent background on error
                        (e.target as HTMLImageElement).src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                      }}
                    />
                  )}

                  {/* GIF images */}
                  {isGif && thumbnailSrc && (
                    <img
                      src={thumbnailSrc}
                      alt={file.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  )}

                  {/* File icon for non-image files - matches AngularJS icon-cont */}
                  {/* AngularJS: <span class="icon-cont" bo-if="!file.thumbnail_name || file.isDefaultThumbnail"> */}
                  {/* Note: icon-cont shows LARGE grey icons (cnv-icons-36) when NO thumbnail */}
                  {/* This is DIFFERENT from file-info which shows SMALL colored icons (cnv-small-file-ico) */}
                  {/* AngularJS shows icon-cont for ALL files without thumbnails, regardless of file_format */}
                  {/* For PDFs without thumbnails: shows BOTH icon-cont (large grey) AND file-info (small red overlay) */}
                  {/* For PDFs with thumbnails: shows ONLY file-info (small red overlay), NOT icon-cont */}
                  {(!hasThumbnail || file.isDefaultThumbnail) && (
                    <span className="icon-cont" style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '3px',
                      padding: '3px 0px',
                      display: 'inline-block',
                      width: '90px',
                      height: '90px',
                      textAlign: 'center',
                      marginLeft: '1px',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      zIndex: 1,
                    }}>
                      {/* Audio files use icons_Audio-darkgray - matches AngularJS */}
                      {isAudio ? (
                        <span className="cnv-icons-36 icons_Audio-darkgray file-icon" style={{
                          margin: '6px',
                          display: 'inline-block',
                        }}></span>
                      ) : (
                        /* Non-audio files (including PDFs) use fileplainlarge-darkgray - matches AngularJS */
                        /* PDFs WITHOUT thumbnails show LARGE grey icon, NOT red icon */
                        <span className="cnv-icons-36 fileplainlarge-darkgray file-icon" style={{
                          margin: '6px',
                          display: 'inline-block',
                        }}></span>
                      )}
                    </span>
                  )}

                  {/* Video play overlay - matches AngularJS */}
                  {/* AngularJS: <div class='attachment-play-overlay videoHoverIcon' bo-if="file.file_format=='VIDEO' && file.thumbnail_name"></div> */}
                  {/* AngularJS videoHoverIcon uses: background: url("../assets/img/videoPlayback/videoHover.png") */}
                  {isVideo && file.thumbnail_name && (
                    <div className="attachment-play-overlay videoHoverIcon" style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'url(/assets/img/videoPlayback/videoHover.png) no-repeat',
                      backgroundPosition: '50%',
                      backgroundSize: '50px 50px',
                      width: '50px',
                      height: '50px',
                      cursor: 'pointer',
                    }}></div>
                  )}

                  {/* File info for DOC, OTHER, VIDEO files - matches AngularJS file-info */}
                  {/* AngularJS: <span class="file-info" bo-if="file.file_format == 'DOC' || file.file_format == 'OTHER' || file.file_format == 'VIDEO'"> */}
                  {/* This overlay shows SMALL colored icons (cnv-small-file-ico) - different from icon-cont which shows LARGE icons */}
                  {/* IMPORTANT: In Angular comments, file-info overlay is ONLY shown when there IS a thumbnail (thumbnail_name exists) */}
                  {/* For PDFs WITHOUT thumbnails: shows ONLY icon-cont (large grey icon), NO file-info overlay */}
                  {/* For PDFs WITH thumbnails: shows thumbnail image AND file-info (small red overlay at bottom) */}
                  {/* For VIDEO files: shows file-info overlay when thumbnail exists */}
                  {/* Note: file.thumbnail_name must exist (not just isDefaultThumbnail) for file-info to show */}
                  {(isDoc || isVideo) && file.thumbnail_name && (
                    <span className="file-info" style={{
                      position: 'absolute',
                      bottom: 0,
                      left: '1px',
                      right: '1px',
                      borderBottomLeftRadius: '3px',
                      borderBottomRightRadius: '3px',
                      height: '24px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      color: 'white',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      padding: '0px 2px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      zIndex: 2,
                    }}>
                      {/* Extension holder - matches AngularJS: ext_holder cnv-small-file-ico with ng-class */}
                      {/* AngularJS: <i class="ext_holder cnv-small-file-ico" ng-class="file.name | getFileExtension"> */}
                      {/* AngularJS: <span ng-bind="file.name | getFileExtension"></span> */}
                      {/* IMPORTANT: In comments, file icons have gray border and text, NOT colored backgrounds */}
                      {/* AngularJS: .comment .comment_body .img-snippet i.cnv-small-file-ico has background: none !important */}
                      {/* So we don't add extension class (like 'pdf', 'pptx') in comments - just use cnv-small-file-ico */}
                      {/* Use inline styles to override any CSS colored backgrounds */}
                      <i className="ext_holder cnv-small-file-ico" style={{
                        verticalAlign: 'middle',
                        margin: '2px 2px 2px 1px',
                        height: '17px',
                        lineHeight: 'normal',
                        width: '32px',
                        display: 'inline-block',
                        background: 'none',
                        border: '1px solid rgba(123, 131, 134, 0.7)',
                        borderRadius: '3px',
                        color: 'rgba(123, 131, 134, 0.7)',
                        marginTop: '2px',
                        opacity: 0.75,
                      }}>
                        <span style={{
                          display: 'inline-block',
                          color: 'rgba(123, 131, 134, 0.7)',
                          textTransform: 'uppercase',
                          fontSize: '12px',
                          lineHeight: 'normal',
                        }}>
                          {fileExt}
                        </span>
                      </i>
                      {/* File name - matches AngularJS attachment-title */}
                      <span className="attachment-title" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        display: 'inline-block',
                        verticalAlign: 'middle',
                        lineHeight: '24px',
                      }} dangerouslySetInnerHTML={{
                        __html: file.fileSearchHighlightedName || file.name
                      }}></span>
                    </span>
                  )}

                  {/* Search matches badge */}
                  {file.fileSearchMatchesText && (
                    <i className="search-matches-badge" style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(255, 255, 0, 0.8)',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                    }}>
                      {file.fileSearchMatchesText}
                    </i>
                  )}
                </span>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

