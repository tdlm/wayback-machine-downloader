import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rewriteLinks } from '../src/link-rewriter.js';
import type { FileToDownload } from '../src/types.js';

describe('link-rewriter', () => {
  async function setupDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), 'wayback-rewrite-'));
  }

  it('rewrites href in HTML when target exists', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await writeFile(join(dir, 'index.html'), '<link href="https://example.com/css/style.css">');
    await mkdir(join(dir, 'css'), { recursive: true });
    await writeFile(join(dir, 'css', 'style.css'), 'body {}');

    const files: FileToDownload[] = [
      { fileId: '', fileUrl: 'https://example.com/', timestamp: '20060101120000' },
      { fileId: 'css/style.css', fileUrl: 'https://example.com/css/style.css', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'index.html'), 'utf-8');
    assert.strictEqual(content, '<link href="css/style.css">');

    await rm(dir, { recursive: true, force: true });
  });

  it('leaves href unchanged when target does not exist', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await writeFile(
      join(dir, 'index.html'),
      '<link href="https://example.com/missing.css">'
    );

    const files: FileToDownload[] = [
      { fileId: '', fileUrl: 'https://example.com/', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'index.html'), 'utf-8');
    assert.strictEqual(content, '<link href="https://example.com/missing.css">');

    await rm(dir, { recursive: true, force: true });
  });

  it('leaves external domain URLs unchanged', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await writeFile(
      join(dir, 'index.html'),
      '<a href="https://other.com/page.html">Link</a>'
    );

    const files: FileToDownload[] = [
      { fileId: '', fileUrl: 'https://example.com/', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'index.html'), 'utf-8');
    assert.strictEqual(content, '<a href="https://other.com/page.html">Link</a>');

    await rm(dir, { recursive: true, force: true });
  });

  it('rewrites root-relative URLs when target exists', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await mkdir(join(dir, 'blog'), { recursive: true });
    await writeFile(
      join(dir, 'blog', 'post.html'),
      '<link href="/css/style.css">'
    );
    await mkdir(join(dir, 'css'), { recursive: true });
    await writeFile(join(dir, 'css', 'style.css'), 'body {}');

    const files: FileToDownload[] = [
      { fileId: 'blog/post.html', fileUrl: 'https://example.com/blog/post.html', timestamp: '20060101120000' },
      { fileId: 'css/style.css', fileUrl: 'https://example.com/css/style.css', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'blog', 'post.html'), 'utf-8');
    assert.strictEqual(content, '<link href="../css/style.css">');

    await rm(dir, { recursive: true, force: true });
  });

  it('rewrites src in img and script tags', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await writeFile(
      join(dir, 'index.html'),
      '<img src="https://example.com/logo.png"><script src="https://example.com/app.js"></script>'
    );
    await writeFile(join(dir, 'logo.png'), '');
    await writeFile(join(dir, 'app.js'), 'console.log(1);');

    const files: FileToDownload[] = [
      { fileId: '', fileUrl: 'https://example.com/', timestamp: '20060101120000' },
      { fileId: 'logo.png', fileUrl: 'https://example.com/logo.png', timestamp: '20060101120000' },
      { fileId: 'app.js', fileUrl: 'https://example.com/app.js', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'index.html'), 'utf-8');
    assert.strictEqual(content, '<img src="logo.png"><script src="app.js"></script>');

    await rm(dir, { recursive: true, force: true });
  });

  it('rewrites srcset attribute values', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await writeFile(
      join(dir, 'index.html'),
      '<img srcset="https://example.com/a.jpg 1x, https://example.com/b.jpg 2x">'
    );
    await writeFile(join(dir, 'a.jpg'), '');
    await writeFile(join(dir, 'b.jpg'), '');

    const files: FileToDownload[] = [
      { fileId: '', fileUrl: 'https://example.com/', timestamp: '20060101120000' },
      { fileId: 'a.jpg', fileUrl: 'https://example.com/a.jpg', timestamp: '20060101120000' },
      { fileId: 'b.jpg', fileUrl: 'https://example.com/b.jpg', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'index.html'), 'utf-8');
    assert.strictEqual(content, '<img srcset="a.jpg 1x, b.jpg 2x">');

    await rm(dir, { recursive: true, force: true });
  });

  it('rewrites url() in CSS when target exists', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await mkdir(join(dir, 'css'), { recursive: true });
    await writeFile(
      join(dir, 'css', 'style.css'),
      'body { background: url("https://example.com/css/bg.png"); }'
    );
    await writeFile(join(dir, 'css', 'bg.png'), '');

    const files: FileToDownload[] = [
      { fileId: 'css/style.css', fileUrl: 'https://example.com/css/style.css', timestamp: '20060101120000' },
      { fileId: 'css/bg.png', fileUrl: 'https://example.com/css/bg.png', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'css', 'style.css'), 'utf-8');
    assert.strictEqual(content, 'body { background: url("bg.png"); }');

    await rm(dir, { recursive: true, force: true });
  });

  it('leaves data: and external URLs in CSS unchanged', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await writeFile(
      join(dir, 'style.css'),
      'a { background: url("data:image/png;base64,abc"); } b { background: url("https://cdn.com/x.png"); }'
    );

    const files: FileToDownload[] = [
      { fileId: 'style.css', fileUrl: 'https://example.com/style.css', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'style.css'), 'utf-8');
    assert.strictEqual(content, 'a { background: url("data:image/png;base64,abc"); } b { background: url("https://cdn.com/x.png"); }');

    await rm(dir, { recursive: true, force: true });
  });

  it('skips non-HTML and non-CSS files', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    const original = 'var x = "https://example.com/foo";';
    await writeFile(join(dir, 'script.js'), original);

    const files: FileToDownload[] = [
      { fileId: 'script.js', fileUrl: 'https://example.com/script.js', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'script.js'), 'utf-8');
    assert.strictEqual(content, original);

    await rm(dir, { recursive: true, force: true });
  });

  it('handles index.html resolution for directory URLs', async () => {
    const dir = await setupDir();
    const backupPath = `${dir}/`;
    const baseUrl = 'https://example.com';

    await mkdir(join(dir, 'about'), { recursive: true });
    await writeFile(join(dir, 'about', 'index.html'), 'About page');
    await writeFile(
      join(dir, 'index.html'),
      '<a href="https://example.com/about/">About</a>'
    );

    const files: FileToDownload[] = [
      { fileId: '', fileUrl: 'https://example.com/', timestamp: '20060101120000' },
      { fileId: 'about/', fileUrl: 'https://example.com/about/', timestamp: '20060101120000' },
    ];

    await rewriteLinks(backupPath, baseUrl, files);

    const content = await readFile(join(dir, 'index.html'), 'utf-8');
    assert.strictEqual(content, '<a href="about/index.html">About</a>');

    await rm(dir, { recursive: true, force: true });
  });
});
