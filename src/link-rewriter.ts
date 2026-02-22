import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import type { FileToDownload } from './types.js';
import { extractFileId } from './utils.js';
import { resolvePaths } from './file-manager.js';

const HTML_ATTRS = ['href', 'src', 'srcset', 'action', 'data', 'poster'];

function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    return new URL(url, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).href;
  } catch {
    return null;
  }
}

/**
 * Treat www.example.com and example.com as the same site when deciding
 * whether to rewrite a link.
 */
function isSameSite(url: string, baseUrl: string): boolean {
  try {
    const u = new URL(url);
    const b = new URL(baseUrl);
    if (u.origin === b.origin) {
      return true;
    }
    const normHost = (host: string) => host.toLowerCase().replace(/^www\./, '');
    return (
      u.protocol === b.protocol &&
      normHost(u.hostname) === normHost(b.hostname)
    );
  } catch {
    return false;
  }
}

async function resolveLocalFilePath(
  url: string,
  backupPath: string,
  baseUrl: string
): Promise<string | null> {
  const resolved = resolveUrl(url, baseUrl);
  if (resolved === null) {
    return null;
  }
  if (!isSameSite(resolved, baseUrl)) {
    return null;
  }
  const withoutQueryHash = resolved.replace(/#.*$/, '').replace(/\?.*$/, '');
  const fileId = extractFileId(withoutQueryHash);
  if (fileId === null) {
    return null;
  }
  const { filePath } = resolvePaths(backupPath, fileId, withoutQueryHash);
  try {
    await stat(filePath);
    return filePath;
  } catch {
    return null;
  }
}

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/');
}

function computeRelativePath(fromFilePath: string, toFilePath: string): string {
  const fromDir = dirname(fromFilePath);
  const rel = relative(fromDir, toFilePath);
  return toForwardSlash(rel);
}

async function replaceAllAsync(
  content: string,
  regex: RegExp,
  replacer: (match: string, ...groups: string[]) => Promise<string>
): Promise<string> {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const matches = [...content.matchAll(new RegExp(regex.source, flags))];
  let result = content;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m === undefined) continue;
    const replacement = await replacer(m[0], ...(m.slice(1) ?? []));
    const idx = m.index ?? 0;
    result = result.slice(0, idx) + replacement + result.slice(idx + m[0].length);
  }
  return result;
}

async function rewriteHtmlLinks(
  content: string,
  filePath: string,
  backupPath: string,
  baseUrl: string,
  resolveLocal: (url: string) => Promise<string | null>,
  computeRel: (from: string, to: string) => string
): Promise<string> {
  const attrPattern = new RegExp(
    `\\s(${HTML_ATTRS.join('|')})\\s*=\\s*["']([^"']+)["']`,
    'gi'
  );

  return replaceAllAsync(content, attrPattern, async (match, attr, url) => {
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('javascript:')) {
      return match;
    }
    if (attr.toLowerCase() === 'srcset') {
      const parts = trimmed.split(',').map((p) => p.trim());
      const rewritten: string[] = [];
      for (const part of parts) {
        const spaceIdx = part.search(/\s/);
        const urlPart = spaceIdx >= 0 ? part.slice(0, spaceIdx) : part;
        const descriptor = spaceIdx >= 0 ? part.slice(spaceIdx) : '';
        const resolved = resolveUrl(urlPart, baseUrl);
        if (resolved === null || !isSameSite(resolved, baseUrl)) {
          rewritten.push(part);
          continue;
        }
        const localPath = await resolveLocal(resolved);
        if (localPath === null) {
          rewritten.push(part);
          continue;
        }
        rewritten.push(computeRel(filePath, localPath) + descriptor);
      }
      return ` ${attr}="${rewritten.join(', ')}"`;
    }
    const resolved = resolveUrl(trimmed, baseUrl);
    if (resolved === null) {
      return match;
    }
    if (!isSameSite(resolved, baseUrl)) {
      return match;
    }
    const localPath = await resolveLocal(resolved);
    if (localPath === null) {
      return match;
    }
    const rel = computeRel(filePath, localPath);
    return ` ${attr}="${rel}"`;
  });
}

async function rewriteCssUrls(
  content: string,
  filePath: string,
  backupPath: string,
  baseUrl: string,
  resolveLocal: (url: string) => Promise<string | null>,
  computeRel: (from: string, to: string) => string
): Promise<string> {
  const urlPattern = /url\s*\(\s*["']?([^"')]+)["']?\s*\)/g;

  return replaceAllAsync(content, urlPattern, async (match, url) => {
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('#')) {
      return match;
    }
    const resolved = resolveUrl(trimmed, baseUrl);
    if (resolved === null) {
      return match;
    }
    if (!isSameSite(resolved, baseUrl)) {
      return match;
    }
    const localPath = await resolveLocal(resolved);
    if (localPath === null) {
      return match;
    }
    const rel = computeRel(filePath, localPath);
    const quote = trimmed.includes('"') ? "'" : '"';
    return `url(${quote}${rel}${quote})`;
  });
}

function isHtmlFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.html') || lower.endsWith('.htm');
}

function isCssFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.css');
}

export async function rewriteLinks(
  backupPath: string,
  baseUrl: string,
  files: FileToDownload[]
): Promise<void> {
  const normalizedBackup = backupPath.endsWith('/') ? backupPath : `${backupPath}/`;

  const resolveLocal = (url: string) =>
    resolveLocalFilePath(url, normalizedBackup, baseUrl);
  const computeRel = (from: string, to: string) =>
    computeRelativePath(from, to);

  for (const file of files) {
    const { filePath } = resolvePaths(normalizedBackup, file.fileId, file.fileUrl);
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    let rewritten = content;
    if (isHtmlFile(filePath)) {
      rewritten = await rewriteHtmlLinks(
        rewritten,
        filePath,
        normalizedBackup,
        baseUrl,
        resolveLocal,
        computeRel
      );
    }
    if (isCssFile(filePath)) {
      rewritten = await rewriteCssUrls(
        rewritten,
        filePath,
        normalizedBackup,
        baseUrl,
        resolveLocal,
        computeRel
      );
    }

    if (rewritten !== content) {
      await writeFile(filePath, rewritten);
    }
  }
}
