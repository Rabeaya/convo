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
        const hasThumbnail = (file.thumbnail_name || file.isDefaultThumbnail) && !isGif;
        const isVideo = isVideoFile(file) || file.file_format === 'VIDEO';
        const isDoc = file.file_format === 'DOC' || file.file_format === 'OTHER';
        const isAudio = isAudioFile(file);
        const fileExt = getFileExtension(file.name);
        
        // Get thumbnail URL using AngularJS logic
        let thumbnailSrc = '';
        if (isGif && file.original_name) {
          // GIF files use original image path
          thumbnailSrc = getOriginalImagePath(
            file.original_name,
            resourceId,
            appInstanceId,
            file.storage_version || 0,
            { accountId }
          );
        } else if ((file.thumbnail_name || file.isDefaultThumbnail) && !isGif) {
          // Regular images use comment attachment thumbnail path
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
                  {!hasThumbnail && !isVideo && (
                    <span className="icon-cont" style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      background: '#fff',
                    }}>
                      {/* Audio files use icons_Audio-darkgray - matches AngularJS */}
                      {isAudio ? (
                        <span className="cnv-icons-36 icons_Audio-darkgray file-icon" style={{
                          display: 'block',
                        }}></span>
                      ) : (
                        /* Non-audio files use fileplainlarge-darkgray - matches AngularJS */
                        <span className="cnv-icons-36 fileplainlarge-darkgray file-icon" style={{
                          display: 'block',
                        }}></span>
                      )}
                    </span>
                  )}

                  {/* Video play overlay */}
                  {isVideo && file.thumbnail_name && (
                    <div className="attachment-play-overlay videoHoverIcon" style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '40px',
                      height: '40px',
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
                  )}

                  {/* File info for DOC, OTHER, VIDEO files - matches AngularJS file-info */}
                  {(isDoc || isVideo) && (
                    <span className="file-info" style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '4px 8px',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      {/* Extension holder - matches AngularJS: ext_holder cnv-small-file-ico with ng-class */}
                      <i className={`ext_holder cnv-small-file-ico ${fileExt}`} style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}>
                        <span style={{ display: 'none' }}>{fileExt}</span>
                      </i>
                      {/* File name - matches AngularJS attachment-title */}
                      <span className="attachment-title" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
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

