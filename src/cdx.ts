import type { Snapshot } from './types.js';
import { retry } from './retry.js';

const CDX_BASE = 'https://web.archive.org/cdx/search/xd';

export interface CdxOptions {
  url: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  all?: boolean;
  page?: number;
}

function buildCdxUrl(options: CdxOptions): string {
  const params = new URLSearchParams({
    output: 'json',
    url: options.url,
    fl: 'timestamp,original',
    collapse: 'digest',
    gzip: 'false',
  });

  if (!options.all) {
    params.set('filter', 'statuscode:200');
  }
  if (options.fromTimestamp !== undefined && options.fromTimestamp !== 0) {
    params.set('from', String(options.fromTimestamp));
  }
  if (options.toTimestamp !== undefined && options.toTimestamp !== 0) {
    params.set('to', String(options.toTimestamp));
  }
  if (options.page !== undefined) {
    params.set('page', String(options.page));
  }

  return `${CDX_BASE}?${params.toString()}`;
}

/**
 * Fetch a single page of snapshots from the CDX API.
 */
export async function fetchCdxPage(options: CdxOptions): Promise<Snapshot[]> {
  const url = buildCdxUrl(options);

  let response: string;
  try {
    response = await retry(
      async () => {
        const res = await fetch(url);
        if (res.status === 400 || res.status === 404) {
          return '';
        }
        if (!res.ok) {
          throw new Error(`CDX API error: ${res.status} ${res.statusText}`);
        }
        return res.text();
      },
      {
        retries: 5,
        baseDelay: 1000,
        maxDelay: 30000,
      }
    );
  } catch {
    return [];
  }

  if (response === '') {
    return [];
  }

  let json: unknown;
  try {
    json = JSON.parse(response);
  } catch {
    return [];
  }

  if (!Array.isArray(json) || json.length === 0) {
    return [];
  }

  const header = json[0];
  if (
    Array.isArray(header) &&
    header[0] === 'timestamp' &&
    header[1] === 'original'
  ) {
    json.shift();
  }

  const snapshots: Snapshot[] = [];
  for (const row of json) {
    if (Array.isArray(row) && row.length >= 2) {
      snapshots.push({
        timestamp: String(row[0]),
        url: String(row[1]),
      });
    }
  }
  return snapshots;
}

/**
 * Fetch all snapshots for a URL, paginating through the CDX API.
 */
export async function fetchAllSnapshots(
  baseUrl: string,
  options: {
    exactUrl?: boolean;
    fromTimestamp?: number;
    toTimestamp?: number;
    all?: boolean;
    maxPages?: number;
    onPage?: (page: number, count: number) => void;
  } = {}
): Promise<Snapshot[]> {
  const maxPages = options.maxPages ?? 100;
  const all: Snapshot[] = [];

  const baseOptions: Omit<CdxOptions, 'page'> = {
    url: baseUrl,
    fromTimestamp: options.fromTimestamp,
    toTimestamp: options.toTimestamp,
    all: options.all,
  };

  const firstPage = await fetchCdxPage(baseOptions);
  all.push(...firstPage);
  options.onPage?.(0, firstPage.length);

  if (options.exactUrl || firstPage.length === 0) {
    return all;
  }

  const wildcardUrl = baseUrl.endsWith('/') ? `${baseUrl}*` : `${baseUrl}/*`;
  for (let page = 0; page < maxPages; page++) {
    const pageSnapshots = await fetchCdxPage({
      ...baseOptions,
      url: wildcardUrl,
      page,
    });
    if (pageSnapshots.length === 0) {
      break;
    }
    all.push(...pageSnapshots);
    options.onPage?.(page + 1, pageSnapshots.length);
  }

  return all;
}
