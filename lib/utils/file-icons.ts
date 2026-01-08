/**
 * File Icon Utilities
 * 
 * Matches AngularJS file icon handling exactly
 * Based on utilFilters.js: getSmallFileIconClassByTypeFromAssets, getNewFileIconByType
 */

/**
 * Get small file icon class by type (for gallery thumbnails)
 * Matches getSmallFileIconClassByTypeFromAssets filter
 */
export function getSmallFileIconClassByType(type: string): string {
  if (!type) return 'cnv-small-file-ico';
  
  const typeLower = type.toLowerCase();
  
  // Map of file extensions to CSS classes
  const iconMap: Record<string, string> = {
    'docx': 'cnv-small-file-ico docx',
    'doc': 'cnv-small-file-ico doc',
    'rtf': 'cnv-small-file-ico rtf',
    'xls': 'cnv-small-file-ico xls',
    'xlsx': 'cnv-small-file-ico xlsx',
    'xlsm': 'cnv-small-file-ico xlsm',
    'xlsb': 'cnv-small-file-ico xlsb',
    'jpg': 'cnv-small-file-ico jpg',
    'jpeg': 'cnv-small-file-ico jpeg',
    'ppt': 'cnv-small-file-ico ppt',
    'pptx': 'cnv-small-file-ico pptx',
    'air': 'cnv-small-file-ico air',
    'avi': 'cnv-small-file-ico avi',
    'bmp': 'cnv-small-file-ico bmp',
    'flv': 'cnv-small-file-ico flv',
    'gif': 'cnv-small-file-ico gif',
    'mp3': 'cnv-small-file-ico mp3',
    'mp4': 'cnv-small-file-ico',
    'mpeg': 'cnv-small-file-ico mpeg',
    'pdf': 'cnv-small-file-ico pdf',
    'png': 'cnv-small-file-ico png',
    'pps': 'cnv-small-file-ico pps',
    'psd': 'cnv-small-file-ico psd',
    'tif': 'cnv-small-file-ico tif',
    'tga': 'cnv-small-file-ico tga',
    'txt': 'cnv-small-file-ico txt',
    'rar': 'cnv-small-file-ico rar',
    'wav': 'cnv-small-file-ico wav',
    'wma': 'cnv-small-file-ico wav',
    'mov': 'cnv-small-file-ico mov',
    'json': 'cnv-small-file-ico json',
  };
  
  return iconMap[typeLower] || 'cnv-small-file-ico';
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  if (!fileName) return '';
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Get file format from file type (for determining if audio/video)
 * Simplified version - matches utils.getFileFormat logic
 */
export function getFileFormat(type: string): string {
  if (!type) return 'Other';
  
  const typeLower = type.toLowerCase();
  
  // Video formats
  const videoFormats = ['mov', 'qt', 'm4v', 'mp4', 'mpeg4', 'mpe', 'mpeg', 'avi', 'dat', 'mpg', 'flv', 'mkv', 'ogg', 'asf', 'wmv', 'webm', 'divx', '3gp'];
  if (videoFormats.includes(typeLower)) {
    return 'Video';
  }
  
  // Audio formats
  const audioFormats = ['mp3', 'wav', 'wma', 'aac', 'm4a', 'ogg', 'flac'];
  if (audioFormats.includes(typeLower)) {
    return 'Audio';
  }
  
  return 'Other';
}

/**
 * Check if file is audio
 */
export function isAudioFile(file: { type?: string; file_format?: string }): boolean {
  if (file.file_format === 'AUDIO') return true;
  if (file.type) {
    return getFileFormat(file.type) === 'Audio';
  }
  return false;
}

/**
 * Check if file is video
 */
export function isVideoFile(file: { type?: string; file_format?: string }): boolean {
  if (file.file_format === 'VIDEO') return true;
  if (file.type) {
    return getFileFormat(file.type) === 'Video';
  }
  return false;
}

