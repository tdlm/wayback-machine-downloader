import { describe, it } from 'node:test';
import assert from 'node:assert';
import { listFiles } from '../src/downloader.js';

describe('downloader', () => {
  it('listFiles returns empty array when CDX returns no snapshots', async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => {
      return new Response(JSON.stringify([['timestamp', 'original']]), {
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const files = await listFiles({
        baseUrl: 'https://example.com',
        exactUrl: true,
        maxPages: 1,
      });
      assert.ok(Array.isArray(files));
      assert.strictEqual(files.length, 0);
    } finally {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
  });

  it('listFiles with exactUrl does not use wildcard', async () => {
    const originalFetch = globalThis.fetch;
    let fetchUrl = '';
    (globalThis as unknown as { fetch: typeof fetch }).fetch = async (input: RequestInfo | URL) => {
      fetchUrl = typeof input === 'string' ? input : (input as URL).toString();
      return new Response(
        JSON.stringify([['timestamp', 'original'], ['20060101120000', 'https://example.com/']]),
        { headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await listFiles({
        baseUrl: 'https://example.com',
        exactUrl: true,
        maxPages: 1,
      });
      assert.ok(!fetchUrl.includes('*'), 'exactUrl should not use wildcard');
    } finally {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
  });
});
