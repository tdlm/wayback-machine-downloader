import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { downloadFile } from '../src/file-manager.js';

describe('file-manager', () => {
  it('downloadFile skips existing file when overwrite is false', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wayback-test-'));
    const originalFetch = globalThis.fetch;

    (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => {
      return new Response('content');
    };

    try {
      const result1 = await downloadFile(
        { fileId: 'index.html', fileUrl: 'https://example.com/', timestamp: '20060101120000' },
        { backupPath: `${dir}/`, overwrite: false }
      );
      assert.strictEqual(result1.status, 'downloaded');

      const result2 = await downloadFile(
        { fileId: 'index.html', fileUrl: 'https://example.com/', timestamp: '20060101120000' },
        { backupPath: `${dir}/`, overwrite: false }
      );
      assert.strictEqual(result2.status, 'skipped');
    } finally {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('downloadFile creates directory structure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wayback-test-'));
    const originalFetch = globalThis.fetch;

    (globalThis as unknown as { fetch: typeof fetch }).fetch = async () => {
      return new Response('content');
    };

    try {
      const result = await downloadFile(
        { fileId: 'foo/bar.html', fileUrl: 'https://example.com/foo/bar.html', timestamp: '20060101120000' },
        { backupPath: `${dir}/`, overwrite: false }
      );
      assert.strictEqual(result.status, 'downloaded');
      const content = await readFile(join(dir, 'foo', 'bar.html'), 'utf-8');
      assert.strictEqual(content, 'content');
    } finally {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
