import { mkdir, writeFile, stat, unlink, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FileToDownload } from './types.js';
import { retry } from './retry.js';
import { sanitizePath } from './utils.js';

const WAYBACK_BASE = 'https://web.archive.org/web';

export interface FileManagerOptions {
  backupPath: string;
  overwrite?: boolean;
  maxRetries?: number;
  saveErrors?: boolean;
  onRetry?: (url: string, error: Error, attempt: number) => void;
}

function buildWaybackUrl(timestamp: string, originalUrl: string): string {
  return `${WAYBACK_BASE}/${timestamp}id_/${originalUrl}`;
}

export function resolvePaths(
  backupPath: string,
  fileId: string,
  fileUrl: string
): { dirPath: string; filePath: string } {
  const pathElements = fileId.split('/');
  const isDir = fileUrl.endsWith('/') || !pathElements[pathElements.length - 1]?.includes('.');

  let dirPath: string;
  let filePath: string;

  if (fileId === '') {
    dirPath = backupPath;
    filePath = `${backupPath}index.html`;
  } else if (isDir) {
    dirPath = `${backupPath}${pathElements.join('/')}`;
    filePath = `${dirPath}/index.html`;
  } else {
    dirPath = `${backupPath}${pathElements.slice(0, -1).join('/')}`;
    filePath = `${backupPath}${pathElements.join('/')}`;
  }

  if (process.platform === 'win32') {
    dirPath = sanitizePath(dirPath);
    filePath = sanitizePath(filePath);
  }

  return { dirPath, filePath };
}

async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EEXIST') {
      const existingPath = error.path ?? dirPath;
      const stats = await stat(existingPath);
      if (stats.isFile()) {
        const tempPath = `${existingPath}.temp`;
        const permanentPath = `${existingPath}/index.html`;
        await rename(existingPath, tempPath);
        await mkdir(existingPath, { recursive: true });
        await rename(tempPath, permanentPath);
        await ensureDirectory(dirPath);
      }
    } else {
      throw err;
    }
  }
}

export interface DownloadResult {
  status: 'downloaded' | 'skipped' | 'error';
  filePath?: string;
  error?: Error;
}

export async function downloadFile(
  file: FileToDownload,
  options: FileManagerOptions
): Promise<DownloadResult> {
  const { backupPath, overwrite = false, maxRetries = 5, saveErrors = false } = options;
  const { dirPath, filePath } = resolvePaths(backupPath, file.fileId, file.fileUrl);

  if (!overwrite) {
    try {
      await stat(filePath);
      return { status: 'skipped', filePath };
    } catch {
      // File doesn't exist, proceed
    }
  }

  await ensureDirectory(dirPath);

  try {
    await retry(
      async () => {
        const url = buildWaybackUrl(file.timestamp, file.fileUrl);
        const response = await fetch(url, {
          headers: { 'Accept-Encoding': 'identity' },
        });

        if (!response.ok && !saveErrors) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(filePath, buffer);
      },
      {
        retries: maxRetries,
        baseDelay: 1000,
        maxDelay: 30000,
        onRetry: (err, attempt) => {
          options.onRetry?.(file.fileUrl, err, attempt);
        },
      }
    );
  } catch (err) {
    try {
      const s = await stat(filePath);
      if (s.size === 0 && !saveErrors) {
        await unlink(filePath);
      }
    } catch {
      // Ignore
    }
    return {
      status: 'error',
      filePath,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }

  try {
    const s = await stat(filePath);
    if (s.size === 0 && !saveErrors) {
      await unlink(filePath);
      return {
        status: 'error',
        filePath,
        error: new Error('Downloaded file was empty'),
      };
    }
  } catch {
    // Ignore
  }

  return { status: 'downloaded', filePath };
}
