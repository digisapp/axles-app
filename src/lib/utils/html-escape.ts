/**
 * HTML escape utility to prevent XSS in email templates and other HTML outputs
 */

const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param str - The string to escape
 * @returns The escaped string safe for HTML insertion
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Escapes a string for safe use in HTML attributes
 * More aggressive escaping for attribute contexts
 */
export function escapeAttribute(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char)
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Sanitizes a URL for safe use in href/src attributes
 * Prevents javascript: and data: URL injection
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return '';
  }

  return escapeAttribute(url);
}
