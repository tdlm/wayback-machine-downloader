import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getBackupName,
  extractFileId,
  tidyBytes,
  parseFilterToRegex,
  matchOnlyFilter,
  matchExcludeFilter,
  sanitizePath,
} from '../src/utils.js';

describe('getBackupName', () => {
  it('extracts domain from full URL', () => {
    assert.strictEqual(getBackupName('https://example.com/path'), 'example.com');
    assert.strictEqual(getBackupName('http://foo.bar.com/'), 'foo.bar.com');
  });

  it('returns url as-is when no //', () => {
    assert.strictEqual(getBackupName('example.com'), 'example.com');
  });
});

describe('extractFileId', () => {
  it('extracts path from URL', () => {
    assert.strictEqual(
      extractFileId('https://example.com/foo/bar.html'),
      'foo/bar.html'
    );
    assert.strictEqual(extractFileId('https://example.com/'), '');
  });

  it('returns null for malformed URL', () => {
    assert.strictEqual(extractFileId('no-slash'), null);
  });

  it('decodes percent-encoded path', () => {
    assert.strictEqual(
      extractFileId('https://example.com/foo%20bar/baz'),
      'foo bar/baz'
    );
  });
});

describe('tidyBytes', () => {
  it('returns string as-is for valid UTF-8', () => {
    assert.strictEqual(tidyBytes('hello'), 'hello');
  });

  it('handles latin1 re-encoding', () => {
    const result = tidyBytes('\xc3\xa9');
    assert.ok(result.length > 0);
  });
});

describe('parseFilterToRegex', () => {
  it('parses regex pattern', () => {
    const re = parseFilterToRegex('/\\.(jpg|png)$/i');
    assert.ok(re !== null);
    assert.ok(re?.test('image.JPG'));
    assert.ok(re?.test('photo.png'));
    assert.ok(!re?.test('file.txt'));
  });

  it('returns null for literal string', () => {
    assert.strictEqual(parseFilterToRegex('foo'), null);
  });
});

describe('matchOnlyFilter', () => {
  it('returns true when no filter', () => {
    assert.strictEqual(matchOnlyFilter('https://example.com/foo', undefined), true);
  });

  it('matches literal string case-insensitively', () => {
    assert.strictEqual(matchOnlyFilter('https://example.com/FOO', 'foo'), true);
    assert.strictEqual(matchOnlyFilter('https://example.com/bar', 'foo'), false);
  });

  it('matches regex', () => {
    assert.strictEqual(
      matchOnlyFilter('https://example.com/image.jpg', '/\\.(jpg|png)$/i'),
      true
    );
    assert.strictEqual(
      matchOnlyFilter('https://example.com/file.txt', '/\\.(jpg|png)$/i'),
      false
    );
  });
});

describe('matchExcludeFilter', () => {
  it('returns false when no filter', () => {
    assert.strictEqual(matchExcludeFilter('https://example.com/foo', undefined), false);
  });

  it('matches literal string', () => {
    assert.strictEqual(matchExcludeFilter('https://example.com/foo', 'foo'), true);
    assert.strictEqual(matchExcludeFilter('https://example.com/bar', 'foo'), false);
  });
});

describe('sanitizePath', () => {
  it('replaces Windows-incompatible chars', () => {
    const result = sanitizePath('foo:bar*test?');
    assert.ok(result.includes('%'));
    assert.ok(!result.includes(':'));
  });
});
