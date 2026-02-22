import { createRequire } from 'node:module';
import { Command } from 'commander';
import chalk from 'chalk';
import { download, listFiles } from './downloader.js';
import { createProgressBar, createSnapshotProgressBar, printSummary } from './progress.js';
import { getBackupName } from './utils.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('wayback-dl')
  .description('Download archived websites from the Internet Archive Wayback Machine')
  .version(pkg.version)
  .argument('<url>', 'Website URL to download (e.g. https://example.com)')
  .option('-d, --directory <path>', 'Output directory (default: ./websites/{domain}/)')
  .option('-c, --concurrency <n>', 'Number of parallel downloads', '5')
  .option('-f, --from <timestamp>', 'Only snapshots from this timestamp (e.g. 20060716231334)')
  .option('-t, --to <timestamp>', 'Only snapshots up to this timestamp')
  .option('-o, --only <filter>', 'Only download URLs matching filter (use /pattern/ for regex)')
  .option('-x, --exclude <filter>', 'Exclude URLs matching filter')
  .option('-a, --all', 'Include non-200 responses (errors, redirects)')
  .option('-s, --all-timestamps', 'Download all snapshot versions')
  .option('-e, --exact-url', 'Download only the exact URL, not the full site')
  .option('-l, --list', 'List files as JSON without downloading')
  .option('--max-pages <n>', 'Max CDX API pages to fetch', '100')
  .option('--overwrite', 'Re-download existing files')
  .option('--retry <n>', 'Max retries per file', '5')
  .option('--rewrite-links', 'Rewrite absolute URLs to relative paths in downloaded HTML/CSS')
  .option('--no-color', 'Disable colored output')
  .action(async (url: string, opts: Record<string, string | boolean | undefined>) => {
    const useColors = opts.color !== false;

    const options = {
      baseUrl: url,
      directory: opts.directory as string | undefined,
      exactUrl: opts.exactUrl === true,
      allTimestamps: opts.allTimestamps === true,
      fromTimestamp: opts.from ? parseInt(String(opts.from), 10) : undefined,
      toTimestamp: opts.to ? parseInt(String(opts.to), 10) : undefined,
      onlyFilter: opts.only as string | undefined,
      excludeFilter: opts.exclude as string | undefined,
      all: opts.all === true,
      maxPages: parseInt(String(opts.maxPages), 10) || 100,
      concurrency: parseInt(String(opts.concurrency), 10) || 5,
      overwrite: opts.overwrite === true,
      maxRetries: parseInt(String(opts.retry), 10) || 5,
      rewriteLinks: opts.rewriteLinks === true,
    };

    try {
      if (opts.list === true) {
        const files = await listFiles(options);
        console.log(JSON.stringify(files, null, 2));
        return;
      }

      const backupPath = options.directory ?? `websites/${getBackupName(url)}/`;
      console.log(
        chalk.cyan(`Downloading ${chalk.bold(url)} to ${chalk.bold(backupPath)} from Wayback Machine.`)
      );
      console.log();

      const snapshotBar = createSnapshotProgressBar(useColors);
      snapshotBar.start();
      const snapshotBarUpdate = (page: number, count: number) => {
        snapshotBar.update(`... page ${page + 1} (${count} snapshots)`);
      };

      const progress = createProgressBar(useColors);

      const { files, stats } = await download({
        ...options,
        onRewriteLinks: options.rewriteLinks
          ? () => console.log(chalk.cyan('Rewriting links...'))
          : undefined,
        onSnapshotPage: snapshotBarUpdate,
        onFileListReady: (count) => {
          snapshotBar.stop();
          if (count > 0) {
            console.log(chalk.cyan(`${count} files to download.`));
            console.log();
            progress.start(count);
          }
        },
        onProgress: (s) => {
          progress.update(
            s.downloaded + s.skipped + s.errors,
            s.downloaded,
            s.skipped,
            s.errors
          );
        },
      });

      if (files.length === 0) {
        snapshotBar.stop();
        console.log(chalk.yellow('No files to download.'));
        console.log(chalk.gray('Possible reasons:'));
        console.log(chalk.gray('  • Site is not in Wayback Machine Archive.'));
        if (options.fromTimestamp) {
          console.log(chalk.gray('  • From timestamp too far in the future.'));
        }
        if (options.toTimestamp) {
          console.log(chalk.gray('  • To timestamp too far in the past.'));
        }
        if (options.onlyFilter) {
          console.log(chalk.gray(`  • Only filter too restrictive: ${options.onlyFilter}`));
        }
        if (options.excludeFilter) {
          console.log(chalk.gray(`  • Exclude filter too wide: ${options.excludeFilter}`));
        }
        return;
      }

      progress.stop();
      printSummary(stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`\nError: ${message}`));
      process.exit(1);
    }
  });

program.parse();
