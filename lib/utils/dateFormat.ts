/**
 * Date Formatting Utilities
 * 
 * Matches AngularJS dateAgo filter and localize filter
 * Formats dates as "18h", "2d", "Sep 16, 2024", etc.
 */

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format timestamp as relative time (e.g., "18h", "2d") or absolute date
 * Matches AngularJS dateAgo filter
 */
export function formatDateAgo(timestamp: number, serverNowTimestamp?: number): string {
  const now = serverNowTimestamp || Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const monthsDiff = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    const date = new Date(timestamp);
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  } else if (monthsDiff > 0) {
    const date = new Date(timestamp);
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  } else if (weeks > 0) {
    return `${weeks}w`;
  } else if (days > 0) {
    return `${days}d`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return 'now';
  }
}

/**
 * Format timestamp as absolute date (e.g., "Sep 16, 2024")
 * Matches AngularJS localize filter
 */
export function formatLocalizedDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

