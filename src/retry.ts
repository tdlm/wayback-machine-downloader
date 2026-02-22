export interface RetryOptions {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_RETRIES = 5;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Add jitter to a delay to avoid thundering herd.
 */
function jitter(delay: number): number {
  const jitterRange = delay * 0.2;
  return delay + (Math.random() * 2 - 1) * jitterRange;
}

/**
 * Execute an async function with exponential backoff on failure.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const baseDelay = options.baseDelay ?? DEFAULT_BASE_DELAY;
  const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;
  const onRetry = options.onRetry;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === retries) {
        throw lastError;
      }
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const delayWithJitter = Math.max(0, jitter(delay));
      onRetry?.(lastError, attempt + 1);
      await sleep(delayWithJitter);
    }
  }
  throw lastError;
}
