import cliProgress from 'cli-progress';
import chalk from 'chalk';

export interface ProgressCallbacks {
  onStart?: (total: number) => void;
  onFileStart?: (url: string) => void;
  onFileComplete?: (url: string, status: 'downloaded' | 'skipped') => void;
  onFileError?: (url: string, error: Error) => void;
  onFileRetry?: (url: string, attempt: number) => void;
  onComplete?: (stats: ProgressStats) => void;
}

export interface ProgressStats {
  total: number;
  downloaded: number;
  skipped: number;
  errors: number;
  retries: number;
  durationMs: number;
}

export function createProgressBar(useColors = true): {
  start: (total: number) => void;
  update: (completed: number, downloaded: number, skipped: number, errors: number) => void;
  stop: () => void;
  increment: (status: 'downloaded' | 'skipped' | 'error') => void;
  log: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
} {
  let multibar: cliProgress.MultiBar | null = null;
  let mainBar: cliProgress.SingleBar | null = null;
  let total = 0;
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;
  let startTime = 0;

  const format = useColors
    ? `  ${chalk.cyan('{bar}')} | {percentage}% | {value}/{total} files | ${chalk.green('✓')} {downloaded} ${chalk.gray('○')} {skipped} ${chalk.red('✗')} {errors}`
    : '  {bar} | {percentage}% | {value}/{total} files | ✓ {downloaded} ○ {skipped} ✗ {errors}';

  return {
    start(t: number) {
      total = t;
      startTime = Date.now();
      multibar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format,
        barCompleteChar: useColors ? chalk.green('█') : '█',
        barIncompleteChar: useColors ? chalk.gray('░') : '░',
      });
      mainBar = multibar.create(total, 0, {
        downloaded: 0,
        skipped: 0,
        errors: 0,
      });
      mainBar.setTotal(total);
    },

    update(completed: number, d: number, s: number, e: number) {
      downloaded = d;
      skipped = s;
      errors = e;
      mainBar?.update(completed, { downloaded: d, skipped: s, errors: e });
    },

    increment(status: 'downloaded' | 'skipped' | 'error') {
      if (status === 'downloaded') downloaded++;
      else if (status === 'skipped') skipped++;
      else errors++;
      const completed = downloaded + skipped + errors;
      mainBar?.increment(1, { downloaded, skipped, errors });
    },

    stop() {
      multibar?.stop();
      multibar = null;
      mainBar = null;
    },

    log(message: string, type: 'success' | 'warn' | 'error' | 'info' = 'info') {
      if (mainBar) {
        multibar?.log(`${getPrefix(type)} ${message}\n`);
      } else {
        console.log(`${getPrefix(type)} ${message}`);
      }
    },
  };

  function getPrefix(t: 'success' | 'warn' | 'error' | 'info'): string {
    if (!useColors) {
      return t === 'error' ? '[ERROR]' : t === 'warn' ? '[WARN]' : t === 'success' ? '[OK]' : '[INFO]';
    }
    switch (t) {
      case 'success':
        return chalk.green('✓');
      case 'warn':
        return chalk.yellow('⚠');
      case 'error':
        return chalk.red('✗');
      default:
        return chalk.blue('ℹ');
    }
  }
}

export function createSnapshotProgressBar(useColors = true): {
  start: () => void;
  update: (message: string) => void;
  stop: () => void;
} {
  let bar: cliProgress.SingleBar | null = null;

  const format = useColors
    ? `  ${chalk.cyan('Fetching snapshots')} {message}`
    : '  Fetching snapshots {message}';

  return {
    start() {
      bar = new cliProgress.SingleBar(
        {
          format,
          barCompleteChar: ' ',
          barIncompleteChar: ' ',
          hideCursor: true,
        },
        cliProgress.Presets.shades_classic
      );
      bar.start(1, 0, { message: '' });
    },

    update(message: string) {
      bar?.update(1, { message });
    },

    stop() {
      bar?.stop();
      bar = null;
    },
  };
}

export function printSummary(stats: ProgressStats): void {
  const durationSec = (stats.durationMs / 1000).toFixed(2);
  console.log();
  console.log(chalk.bold('Download complete'));
  console.log(chalk.gray(`  Duration: ${durationSec}s`));
  console.log(chalk.green(`  Downloaded: ${stats.downloaded}`));
  if (stats.skipped > 0) {
    console.log(chalk.gray(`  Skipped (already exist): ${stats.skipped}`));
  }
  if (stats.errors > 0) {
    console.log(chalk.red(`  Errors: ${stats.errors}`));
  }
}
