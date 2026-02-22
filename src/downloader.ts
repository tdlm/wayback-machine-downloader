import PQueue from 'p-queue';
import type { Snapshot, FileToDownload, DownloadOptions } from './types.js';
import { fetchAllSnapshots } from './cdx.js';
import { downloadFile } from './file-manager.js';
import { rewriteLinks } from './link-rewriter.js';
import {
  getBackupName,
  extractFileId,
  tidyBytes,
  matchOnlyFilter,
  matchExcludeFilter,
} from './utils.js';
import type { ProgressStats } from './progress.js';

export interface DownloadResult {
  files: FileToDownload[];
  stats: ProgressStats;
}

export type ProgressCallback = (stats: {
  downloaded: number;
  skipped: number;
  errors: number;
}) => void;

export type SnapshotPageCallback = (page: number, count: number) => void;

function getBackupPath(directory: string | undefined, baseUrl: string): string {
  if (directory) {
    return directory.endsWith('/') ? directory : `${directory}/`;
  }
  return `websites/${getBackupName(baseUrl)}/`;
}

function curateFileList(
  snapshots: Snapshot[],
  options: Pick<
    DownloadOptions,
    'onlyFilter' | 'excludeFilter' | 'allTimestamps'
  >
): FileToDownload[] {
  const map = new Map<string, { fileUrl: string; timestamp: string }>();

  for (const { timestamp, url } of snapshots) {
    const fileId = extractFileId(url);
    if (fileId === null) {
      continue;
    }

    const tidiedId = fileId === '' ? fileId : tidyBytes(fileId);
    if (matchExcludeFilter(url, options.excludeFilter)) {
      continue;
    }
    if (!matchOnlyFilter(url, options.onlyFilter)) {
      continue;
    }

    const key = options.allTimestamps ? `${timestamp}/${tidiedId}` : tidiedId;
    const existing = map.get(key);
    if (existing) {
      if (!options.allTimestamps && existing.timestamp < timestamp) {
        map.set(key, { fileUrl: url, timestamp });
      }
    } else {
      map.set(key, { fileUrl: url, timestamp });
    }
  }

  const result: FileToDownload[] = [];
  for (const [key, { fileUrl, timestamp }] of map) {
    result.push({
      fileId: key,
      fileUrl,
      timestamp,
    });
  }

  return options.allTimestamps
    ? result
    : result.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
}

export async function download(
  options: DownloadOptions & {
    onProgress?: ProgressCallback;
    onSnapshotPage?: SnapshotPageCallback;
    onFileListReady?: (count: number) => void;
    onRewriteLinks?: () => void;
  }
): Promise<DownloadResult> {
  const backupPath = getBackupPath(options.directory, options.baseUrl);
  const concurrency = options.concurrency ?? 5;
  const maxRetries = options.maxRetries ?? 5;

  const snapshots = await fetchAllSnapshots(options.baseUrl, {
    exactUrl: options.exactUrl,
    fromTimestamp: options.fromTimestamp,
    toTimestamp: options.toTimestamp,
    all: options.all,
    maxPages: options.maxPages,
    onPage: options.onSnapshotPage,
  });

  const files = curateFileList(snapshots, {
    onlyFilter: options.onlyFilter,
    excludeFilter: options.excludeFilter,
    allTimestamps: options.allTimestamps,
  });

  const stats: ProgressStats = {
    total: files.length,
    downloaded: 0,
    skipped: 0,
    errors: 0,
    retries: 0,
    durationMs: 0,
  };

  options.onFileListReady?.(files.length);

  const startTime = Date.now();

  const queue = new PQueue({ concurrency });

  await Promise.all(
    files.map((file) =>
      queue.add(async () => {
        const result = await downloadFile(file, {
          backupPath,
          overwrite: options.overwrite,
          maxRetries,
          saveErrors: options.all,
          onRetry: () => {
            stats.retries++;
          },
        });

        if (result.status === 'downloaded') {
          stats.downloaded++;
        } else if (result.status === 'skipped') {
          stats.skipped++;
        } else {
          stats.errors++;
        }
        options.onProgress?.({
          downloaded: stats.downloaded,
          skipped: stats.skipped,
          errors: stats.errors,
        });
      })
    )
  );

  stats.durationMs = Date.now() - startTime;

  if (options.rewriteLinks === true) {
    options.onRewriteLinks?.();
    await rewriteLinks(backupPath, options.baseUrl, files);
  }

  return { files, stats };
}

export async function listFiles(options: DownloadOptions): Promise<FileToDownload[]> {
  const snapshots = await fetchAllSnapshots(options.baseUrl, {
    exactUrl: options.exactUrl,
    fromTimestamp: options.fromTimestamp,
    toTimestamp: options.toTimestamp,
    all: options.all,
    maxPages: options.maxPages,
  });

  return curateFileList(snapshots, {
    onlyFilter: options.onlyFilter,
    excludeFilter: options.excludeFilter,
    allTimestamps: options.allTimestamps,
  });
}
