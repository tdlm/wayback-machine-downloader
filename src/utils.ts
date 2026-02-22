/**
 * Extract the domain/host from a URL for use as backup name.
 * e.g. "https://example.com/path" -> "example.com"
 */
export function getBackupName(url: string): string {
  if (url.includes('//')) {
    const parts = url.split('/');
    return parts[2] ?? url;
  }
  return url;
}

/**
 * Extract the file path from a full URL (path after domain).
 * e.g. "https://example.com/foo/bar.html" -> "foo/bar.html"
 */
export function extractFileId(url: string): string | null {
  if (!url.includes('/')) {
    return null;
  }
  const parts = url.split('/');
  const pathParts = parts.slice(3);
  if (pathParts.length === 0) {
    return '';
  }
  const joined = pathParts.join('/');
  try {
    return decodeURIComponent(joined);
  } catch {
    return tidyBytes(joined);
  }
}

/**
 * Fix invalid UTF-8 bytes (similar to Ruby tidy_bytes).
 * Interprets string as latin1 and re-encodes to UTF-8.
 */
export function tidyBytes(str: string): string {
  try {
    const buf = Buffer.from(str, 'latin1');
    return buf.toString('utf8');
  } catch {
    return str;
  }
}

/**
 * Parse a filter string into a RegExp or null for literal matching.
 * Supports /pattern/ and /pattern/i notation.
 */
export function parseFilterToRegex(filter: string): RegExp | null {
  if (!filter || filter.length < 2) {
    return null;
  }
  if (filter.startsWith('/') && filter.includes('/')) {
    const lastSlash = filter.lastIndexOf('/');
    const pattern = filter.slice(1, lastSlash).replace(/\\\//g, '/');
    const flags = filter.slice(lastSlash + 1);
    try {
      return new RegExp(pattern, flags);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Check if a URL matches the "only" filter (include).
 */
export function matchOnlyFilter(fileUrl: string, onlyFilter: string | undefined): boolean {
  if (!onlyFilter) {
    return true;
  }
  const regex = parseFilterToRegex(onlyFilter);
  if (regex !== null) {
    return regex.test(fileUrl);
  }
  return fileUrl.toLowerCase().includes(onlyFilter.toLowerCase());
}

/**
 * Check if a URL matches the "exclude" filter.
 */
export function matchExcludeFilter(fileUrl: string, excludeFilter: string | undefined): boolean {
  if (!excludeFilter) {
    return false;
  }
  const regex = parseFilterToRegex(excludeFilter);
  if (regex !== null) {
    return regex.test(fileUrl);
  }
  return fileUrl.toLowerCase().includes(excludeFilter.toLowerCase());
}

/**
 * Sanitize a path for the filesystem (Windows-incompatible chars).
 */
export function sanitizePath(path: string): string {
  return path.replace(/[:*?&=<>\\|]/g, (s) => '%' + s.charCodeAt(0).toString(16));
}
