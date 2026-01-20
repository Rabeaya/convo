/**
 * Rich text helpers (Angular parity)
 *
 * Angular renders `itemData.details` / `comment_text` as raw HTML (bo-html / ng-bind-html).
 * In the legacy app, `/api/v1/files/...` is same-origin so cookies are included and inline
 * images/snippets load.
 *
 * In the Next.js localhost app, those file URLs must be same-origin to include backend cookies,
 * so we rewrite known Convo file URLs to `/api/v1/files-proxy/...`.
 */

/**
 * Rewrite Convo file URLs in an HTML string to go through the Next.js same-origin proxy.
 *
 * Handles:
 * - `https://{host}/api/v1/files/...`
 * - `https://fsX.{host}/api/v1/files/...` (older sharded hosts)
 * - `/api/v1/files/...`
 */
export function rewriteConvoFilesToProxy(html: string): string {
  const s = String(html || '');
  if (!s) return s;

  // Absolute URLs -> proxy
  // Example: https://app14.convodev.net/api/v1/files/acc-.../attachments/...
  // Example: https://fs1.app.convo.com/api/v1/files/...
  const abs = s.replace(/https?:\/\/[^"'\\s>]+\/api\/v1\/files\//gi, '/api/v1/files-proxy/');

  // Root-relative -> proxy
  // Example: /api/v1/files/acc-.../snippets/...
  const rel = abs.replace(/(^|["'\\s>])\/api\/v1\/files\//gi, '$1/api/v1/files-proxy/');

  return rel;
}


