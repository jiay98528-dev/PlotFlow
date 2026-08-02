import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackMailer } from './mailer.js';
import type { DedupePersistence } from './deduplicator.js';
import { createFeedbackServer, type FeedbackServerOptions } from './server.js';

const REQUEST_ONE = {
  message: 'The delete action did not open.',
  appVersion: '0.1.1',
  releaseChannel: 'Preview',
  platform: 'win32',
  architecture: 'x64',
  locale: 'en-US',
  submittedAt: '2026-08-02T01:02:03.000Z',
  requestId: '123e4567-e89b-42d3-a456-426614174000',
} as const;
const REQUEST_TWO = {
  ...REQUEST_ONE,
  requestId: '123e4567-e89b-42d3-a456-426614174001',
} as const;

const runningServers: Server[] = [];

async function startServer(options: FeedbackServerOptions): Promise<string> {
  const server = createFeedbackServer(options);
  runningServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function post(url: string, payload: unknown): Promise<Response> {
  return fetch(`${url}/v1/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(closeServer));
});

describe('feedback loopback HTTP service', () => {
  it('accepts once and returns the original reportId for a duplicate', async () => {
    const send = vi.fn<FeedbackMailer['send']>().mockResolvedValue(undefined);
    const url = await startServer({
      mailer: { send },
      createReportId: () => 'FB-one',
      rateLimitMax: 10,
    });
    const first = await post(url, REQUEST_ONE);
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ ok: true, status: 'accepted', reportId: 'FB-one' });

    const duplicate = await post(url, REQUEST_ONE);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ ok: true, status: 'duplicate', reportId: 'FB-one' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('enforces strict schema, 8000 characters and a 16 KiB body', async () => {
    const url = await startServer({ mailer: { send: vi.fn() }, rateLimitMax: 10 });
    const extraField = await post(url, { ...REQUEST_ONE, extra: true });
    expect(extraField.status).toBe(400);
    expect(await extraField.json()).toEqual({ ok: false, code: 'invalid' });

    const tooManyCharacters = await post(url, { ...REQUEST_ONE, message: 'x'.repeat(8_001) });
    expect(tooManyCharacters.status).toBe(400);

    const tooManyBytes = await post(url, { ...REQUEST_ONE, message: '😀'.repeat(8_000) });
    expect(tooManyBytes.status).toBe(413);
    expect(await tooManyBytes.json()).toEqual({ ok: false, code: 'payload_too_large' });
  });

  it('applies one global limit but lets a duplicate remain idempotent', async () => {
    const send = vi.fn<FeedbackMailer['send']>().mockResolvedValue(undefined);
    const url = await startServer({ mailer: { send }, rateLimitMax: 1 });
    expect((await post(url, REQUEST_ONE)).status).toBe(202);
    expect((await post(url, REQUEST_ONE)).status).toBe(200);
    const limited = await post(url, REQUEST_TWO);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('3600');
    expect(await limited.json()).toEqual({ ok: false, code: 'rate_limited' });
  });

  it('returns 503 and permits a same-requestId retry after SMTP failure', async () => {
    const send = vi
      .fn<FeedbackMailer['send']>()
      .mockRejectedValueOnce(new Error('SMTP unavailable'))
      .mockResolvedValueOnce(undefined);
    const url = await startServer({
      mailer: { send },
      rateLimitMax: 10,
      createReportId: () => 'FB-retry',
    });
    const failed = await post(url, REQUEST_ONE);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ ok: false, code: 'unavailable' });
    const retried = await post(url, REQUEST_ONE);
    expect(retried.status).toBe(202);
    expect(await retried.json()).toEqual({ ok: true, status: 'accepted', reportId: 'FB-retry' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('returns 503 when a successful delivery cannot persist its requestId', async () => {
    const persistence: DedupePersistence = {
      load: async () => [],
      save: async () => {
        throw new Error('read-only state directory');
      },
    };
    const send = vi.fn<FeedbackMailer['send']>().mockResolvedValue(undefined);
    const url = await startServer({
      mailer: { send },
      rateLimitMax: 10,
      createReportId: () => 'FB-undurable',
      dedupePersistence: persistence,
    });
    const failed = await post(url, REQUEST_ONE);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ ok: false, code: 'unavailable' });

    const sameProcessRetry = await post(url, REQUEST_ONE);
    expect(sameProcessRetry.status).toBe(503);
    expect(await sameProcessRetry.json()).toEqual({ ok: false, code: 'unavailable' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('exposes only a minimal health response', async () => {
    const url = await startServer({ mailer: { send: vi.fn() } });
    const response = await fetch(`${url}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
