/**
 * Media URL Validator for R2 Public URLs
 * Ensures URLs are HTTPS, publicly accessible, and point to valid video files
 */

/**
 * Validation result with errors if any
 */
export interface MediaUrlValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Video file extensions supported by TikTok and other platforms
 */
const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.avi',
  '.mkv',
  '.flv',
  '.wmv',
  '.m4v',
  '.3gp',
  '.ogv',
  '.ts',
  '.m3u8',
]);

/**
 * Check if URL is a valid R2 public URL
 * Matches patterns like:
 * - https://<bucket>.r2.<region>.com/*
 * - https://media.r2.yourapp.com/*
 * - https://media.yourapp.com/* (custom domain)
 *
 * @param url - The URL to check
 * @returns true if URL matches R2 public URL pattern
 */
export function isR2PublicUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Must be HTTPS
    if (urlObj.protocol !== 'https:') {
      return false;
    }

    const hostname = urlObj.hostname;

    // Check for R2 domain patterns
    if (hostname.includes('.r2.')) {
      // Matches *.r2.*.com or similar
      return true;
    }

    // Check for custom domain (media.yourapp.com)
    if (hostname.includes('media.') || hostname.includes('r2.')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extract filename from URL path
 * Example: https://media.r2.com/videos/uuid.mp4 → uuid.mp4
 *
 * @param url - The URL to extract filename from
 * @returns The filename (last path segment) or empty string if invalid
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(seg => seg.length > 0);
    return pathSegments[pathSegments.length - 1] || '';
  } catch {
    return '';
  }
}

/**
 * Validate a public media URL for TikTok and other platforms
 *
 * Validation rules:
 * - URL is valid (URL.parse doesn't throw)
 * - Protocol is HTTPS (not HTTP)
 * - Host is valid R2 domain or custom domain
 * - Path contains file extension (.mp4, .mov, .webm, etc.)
 * - URL length < 2048 characters (practical limit for HTTP headers)
 *
 * @param url - The URL to validate
 * @returns Validation result with errors if any
 */
export function validatePublicMediaUrl(url: string): MediaUrlValidationResult {
  const errors: string[] = [];

  // Check if URL string is provided
  if (!url || typeof url !== 'string') {
    return { valid: false, errors: ['URL is required and must be a string'] };
  }

  const trimmedUrl = url.trim();

  // Check URL length (practical limit for HTTP headers)
  if (trimmedUrl.length >= 2048) {
    errors.push('URL length must be less than 2048 characters');
  }

  // Try to parse URL
  let urlObj: URL;
  try {
    urlObj = new URL(trimmedUrl);
  } catch {
    errors.push('URL is not valid (invalid format or encoding)');
    return { valid: false, errors };
  }

  // Check protocol is HTTPS
  if (urlObj.protocol !== 'https:') {
    errors.push('Protocol must be HTTPS (not HTTP or other)');
  }

  // Check if URL is on R2 or recognized domain
  if (!isR2PublicUrl(trimmedUrl)) {
    errors.push('Host must be a valid R2 domain or recognized media domain');
  }

  // Check file extension is video format
  const filename = extractFilenameFromUrl(trimmedUrl);
  if (!filename) {
    errors.push('URL path must contain a filename');
  } else {
    const fileExtension = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    if (!fileExtension) {
      errors.push('Filename must include a file extension');
    } else if (!SUPPORTED_VIDEO_EXTENSIONS.has(fileExtension)) {
      errors.push(
        `File extension '${fileExtension}' is not recognized as a video format. ` +
        `Supported formats: ${Array.from(SUPPORTED_VIDEO_EXTENSIONS).join(', ')}`
      );
    }
  }

  // Return result
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
