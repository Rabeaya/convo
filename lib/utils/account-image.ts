/**
 * Account Image URL Utility
 * 
 * Matches AngularJS accountInfo.getAccountImageUrl() behavior
 */

/**
 * Get the account image URL
 * Matches AngularJS: config.AWS_FILE_DIR_BASE + accountId + "/account-images/thumbnails/" + accountId + "-thumbnail-" + accountImageVersion + ".jpg"
 * 
 * @param account Account object with account_id, image_type, image_version
 * @param servicesHost Services host (e.g., "fs1.app.convo.com" or "app.convo.com")
 * @param apiVersion API version (default: "v1")
 * @returns Account image URL or default logo path
 */
export function getAccountImageUrl(
  account: any,
  servicesHost?: string,
  apiVersion: string = 'v1'
): string {
  // If no account or image_type is 0, return default logo
  if (!account || account.image_type === 0 || !account.image_version || account.image_version <= 0) {
    return '/images/logo.png';
  }

  const accountId = account.account_id;
  const imageVersion = account.image_version;

  if (!accountId || !imageVersion) {
    return '/images/logo.png';
  }

  // Get servicesHost from window if not provided
  if (!servicesHost && typeof window !== 'undefined') {
    const win = window as { servicesHost?: string; com_convo?: { config?: { AWS_FILE_DIR_BASE?: string } } };
    servicesHost = win.servicesHost;
    
    // Try to extract from config if available
    if (!servicesHost && win.com_convo?.config?.AWS_FILE_DIR_BASE) {
      const baseUrl = win.com_convo.config.AWS_FILE_DIR_BASE;
      // Extract host from URL like "https://fs1.app.convo.com/api/v1/files/"
      const match = baseUrl.match(/https?:\/\/([^\/]+)/);
      if (match) {
        servicesHost = match[1];
      }
    }
  }

  // Default to fs1.app.convo.com if no servicesHost
  if (!servicesHost) {
    servicesHost = 'fs1.app.convo.com';
  }

  // Construct URL exactly like AngularJS
  // Pattern: https://{servicesHost}/api/{apiVersion}/files/{accountId}/account-images/thumbnails/{accountId}-thumbnail-{version}.jpg
  const baseUrl = `https://${servicesHost}/api/${apiVersion}/files/`;
  const imageUrl = `${baseUrl}${accountId}/account-images/thumbnails/${accountId}-thumbnail-${imageVersion}.jpg`;

  return imageUrl;
}










