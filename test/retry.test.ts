import { describe, it } from 'node:test';
import assert from 'node:assert';
import { retry } from '../src/retry.js';

describe('retry', () => {
  it('returns result on first success', async () => {
    const result = await retry(async () => 'ok');
    assert.strictEqual(result, 'ok');
  });

  it('retries on failure then succeeds', async () => {
    let attempts = 0;
    const result = await retry(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('fail');
      }
      return 'ok';
    }, { retries: 3, baseDelay: 10, maxDelay: 50 });
    assert.strictEqual(result, 'ok');
    assert.strictEqual(attempts, 2);
  });

  it('throws after max retries', async () => {
    let attempts = 0;
    await assert.rejects(
      async () => {
        await retry(
          async () => {
            attempts++;
            throw new Error('always fail');
          },
          { retries: 3, baseDelay: 10, maxDelay: 50 }
        );
      },
      { message: 'always fail' }
    );
    assert.strictEqual(attempts, 4);
  });

  it('calls onRetry callback', async () => {
    const retryErrors: Error[] = [];
    await retry(
      async () => {
        if (retryErrors.length < 1) {
          throw new Error('fail');
        }
        return 'ok';
      },
      {
        retries: 2,
        baseDelay: 10,
        onRetry: (err) => retryErrors.push(err),
      }
    );
    assert.strictEqual(retryErrors.length, 1);
    assert.strictEqual(retryErrors[0]?.message, 'fail');
  });
});
