/**
 * A single snapshot from the Wayback Machine CDX API.
 */
export interface Snapshot {
  timestamp: string;
  url: string;
}

/**
 * A file to download, derived from a snapshot after filtering and deduplication.
 */
export interface FileToDownload {
  fileId: string;
  fileUrl: string;
  timestamp: string;
}

/**
 * Options for the download orchestrator.
 */
export interface DownloadOptions {
  baseUrl: string;
  directory?: string;
  exactUrl?: boolean;
  allTimestamps?: boolean;
  fromTimestamp?: number;
  toTimestamp?: number;
  onlyFilter?: string;
  excludeFilter?: string;
  all?: boolean;
  maxPages?: number;
  concurrency?: number;
  overwrite?: boolean;
  maxRetries?: number;
  rewriteLinks?: boolean;
}

/**
 * Progress event emitted during download.
 */
export interface ProgressEvent {
  type: 'started' | 'completed' | 'skipped' | 'error' | 'retry';
  fileUrl?: string;
  filePath?: string;
  error?: Error;
  completed: number;
  total: number;
}
