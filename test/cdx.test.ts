import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fetchCdxPage } from '../src/cdx.js';

describe('CDX API', () => {
  it('fetchCdxPage parses JSON response', async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('web.archive.org')) {
        return new Response(
          JSON.stringify([
            ['timestamp', 'original'],
            ['20060101120000', 'https://example.com/'],
          ]),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(input);
    };

    try {
      const snapshots = await fetchCdxPage({
        url: 'https://example.com',
      });
      assert.strictEqual(snapshots.length, 1);
      assert.strictEqual(snapshots[0]?.timestamp, '20060101120000');
      assert.strictEqual(snapshots[0]?.url, 'https://example.com/');
    } finally {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
  });

  it('fetchCdxPage returns empty array on invalid JSON', async () => {
    const originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => {
      return new Response('not json', { headers: { 'Content-Type': 'text/plain' } });
    };

    try {
      const snapshots = await fetchCdxPage({ url: 'https://example.com' });
      assert.strictEqual(snapshots.length, 0);
    } finally {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
  });
});
