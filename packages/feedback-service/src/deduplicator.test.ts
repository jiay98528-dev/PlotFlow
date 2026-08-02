import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DedupePersistenceError,
  RequestDeduplicator,
  type DedupePersistence,
} from './deduplicator.js';
import { JsonFileDedupePersistence } from './fileDedupePersistence.js';
import { GlobalRateLimiter } from './rateLimiter.js';

const temporaryDirectories: string[] = [];

async function createTemporaryStateDirectory(): Promise<string> {
  const directory = await mkdtemp(join(process.cwd(), '.tmp-feedback-dedupe-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { recursive: true, force: true });
    }),
  );
});

describe('RequestDeduplicator', () => {
  it('coalesces concurrent requests and returns the original reportId for 24 hours', async () => {
    let currentTime = 1_000;
    let release: (() => void) | undefined;
    const operation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const deduplicator = new RequestDeduplicator(
      86_400_000,
      () => currentTime,
      () => 'FB-one',
    );

    const first = deduplicator.execute('request-one', operation);
    const second = deduplicator.execute('request-one', operation);
    await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
    release?.();
    await expect(first).resolves.toEqual({ status: 'accepted', reportId: 'FB-one' });
    await expect(second).resolves.toEqual({ status: 'duplicate', reportId: 'FB-one' });
    expect(operation).toHaveBeenCalledOnce();

    currentTime += 86_399_999;
    await expect(deduplicator.find('request-one')).resolves.toBe('FB-one');
    currentTime += 1;
    await expect(deduplicator.find('request-one')).resolves.toBeNull();
  });

  it('removes a failed operation so the same requestId can retry', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('SMTP unavailable'))
      .mockResolvedValueOnce(undefined);
    const deduplicator = new RequestDeduplicator(86_400_000, Date.now, () => 'FB-retry');
    await expect(deduplicator.execute('request-two', operation)).rejects.toThrow(
      'SMTP unavailable',
    );
    await expect(deduplicator.execute('request-two', operation)).resolves.toEqual({
      status: 'accepted',
      reportId: 'FB-retry',
    });
  });

  it('restores a successful mapping after a process restart without storing message content', async () => {
    const stateDirectory = await createTemporaryStateDirectory();
    const persistence = new JsonFileDedupePersistence(stateDirectory);
    const requestId = '123e4567-e89b-42d3-a456-426614174000';
    const firstProcess = new RequestDeduplicator(
      86_400_000,
      () => 1_000,
      () => 'FB-durable',
      persistence,
    );
    await firstProcess.execute(requestId, async () => undefined);

    const stateSource = await readFile(join(stateDirectory, 'successful-request-ids.json'), 'utf8');
    expect(JSON.parse(stateSource)).toEqual({
      version: 1,
      records: [{ requestId, reportId: 'FB-durable', succeededAt: 1_000 }],
    });
    expect(stateSource).not.toContain('private feedback body');

    const restartedProcess = new RequestDeduplicator(
      86_400_000,
      () => 2_000,
      () => 'FB-should-not-be-used',
      new JsonFileDedupePersistence(stateDirectory),
    );
    await restartedProcess.initialize();
    await expect(restartedProcess.find(requestId)).resolves.toBe('FB-durable');
  });

  it('removes expired persisted mappings during startup', async () => {
    const stateDirectory = await createTemporaryStateDirectory();
    const persistence = new JsonFileDedupePersistence(stateDirectory);
    const firstProcess = new RequestDeduplicator(
      100,
      () => 1_000,
      () => 'FB-expired',
      persistence,
    );
    await firstProcess.execute('request-expired', async () => undefined);

    const restartedProcess = new RequestDeduplicator(
      100,
      () => 1_101,
      () => 'FB-new',
      new JsonFileDedupePersistence(stateDirectory),
    );
    await restartedProcess.initialize();
    await expect(restartedProcess.find('request-expired')).resolves.toBeNull();
    const state = JSON.parse(
      await readFile(join(stateDirectory, 'successful-request-ids.json'), 'utf8'),
    ) as { records: unknown[] };
    expect(state.records).toEqual([]);
  });

  it('surfaces a state write failure and retries persistence without resending', async () => {
    let saveAttempt = 0;
    const persistence: DedupePersistence = {
      load: async () => [],
      save: async () => {
        saveAttempt += 1;
        if (saveAttempt === 1) throw new Error('temporary state write failure');
      },
    };
    const delivery = vi.fn().mockResolvedValue(undefined);
    const deduplicator = new RequestDeduplicator(
      86_400_000,
      Date.now,
      () => 'FB-memory-only',
      persistence,
    );
    await expect(deduplicator.execute('request-write-failure', delivery)).rejects.toBeInstanceOf(
      DedupePersistenceError,
    );
    await expect(deduplicator.find('request-write-failure')).resolves.toBe('FB-memory-only');
    expect(delivery).toHaveBeenCalledOnce();
    expect(saveAttempt).toBe(2);
  });
});

describe('GlobalRateLimiter', () => {
  it('limits all callers through one sliding window', () => {
    let currentTime = 0;
    const limiter = new GlobalRateLimiter(2, 60_000, () => currentTime);
    expect(limiter.attempt()).toEqual({ allowed: true });
    expect(limiter.attempt()).toEqual({ allowed: true });
    expect(limiter.attempt()).toEqual({ allowed: false, retryAfterSeconds: 60 });
    currentTime = 60_001;
    expect(limiter.attempt()).toEqual({ allowed: true });
  });
});
