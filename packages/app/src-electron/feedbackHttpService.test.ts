import { describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_FEEDBACK_ENDPOINT,
  resolveFeedbackEndpoint,
  submitFeedbackOverHttps,
} from './feedbackHttpService';

const VALID_REQUEST = {
  message: 'Delete did not open the confirmation dialog.',
  locale: 'en-US',
  requestId: '123e4567-e89b-42d3-a456-426614174000',
} as const;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('feedback HTTPS client', () => {
  it('uses only a loopback development override and never overrides production', () => {
    expect(
      resolveFeedbackEndpoint(false, {
        FABLEVIA_FEEDBACK_ENDPOINT: 'http://127.0.0.1:18081/v1/feedback',
      }),
    ).toBe('http://127.0.0.1:18081/v1/feedback');
    expect(
      resolveFeedbackEndpoint(false, {
        FABLEVIA_FEEDBACK_ENDPOINT: 'https://attacker.example/reports',
      }),
    ).toBe(PRODUCTION_FEEDBACK_ENDPOINT);
    expect(
      resolveFeedbackEndpoint(true, {
        FABLEVIA_FEEDBACK_ENDPOINT: 'http://127.0.0.1:18081/v1/feedback',
      }),
    ).toBe(PRODUCTION_FEEDBACK_ENDPOINT);
  });

  it('posts only the approved metadata and accepts a reportId', async () => {
    const fetchImpl = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      jsonResponse(202, {
        ok: true,
        status: 'accepted',
        reportId: 'FB-one',
      }),
    );
    await expect(
      submitFeedbackOverHttps(VALID_REQUEST, {
        isPackaged: true,
        fetchImpl,
        platform: 'win32',
        architecture: 'x64',
        now: () => new Date('2026-08-02T01:02:03.000Z'),
      }),
    ).resolves.toEqual({ ok: true, reportId: 'FB-one' });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(PRODUCTION_FEEDBACK_ENDPOINT);
    expect(JSON.parse(String(init.body))).toEqual({
      message: VALID_REQUEST.message,
      appVersion: '0.1.1',
      releaseChannel: 'Preview',
      platform: 'win32',
      architecture: 'x64',
      locale: 'en-US',
      submittedAt: '2026-08-02T01:02:03.000Z',
      requestId: VALID_REQUEST.requestId,
    });
  });

  it.each([
    [400, 'invalid'],
    [413, 'invalid'],
    [429, 'rate_limited'],
    [503, 'unavailable'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    await expect(
      submitFeedbackOverHttps(VALID_REQUEST, {
        isPackaged: true,
        fetchImpl: async () => jsonResponse(status, { ok: false }),
      }),
    ).resolves.toEqual({ ok: false, code });
  });

  it('maps a network rejection to offline without retrying', async () => {
    const rejected = vi.fn(async () => {
      throw new TypeError('network unreachable');
    });
    await expect(
      submitFeedbackOverHttps(VALID_REQUEST, {
        isPackaged: true,
        fetchImpl: rejected,
      }),
    ).resolves.toEqual({ ok: false, code: 'offline' });
    expect(rejected).toHaveBeenCalledOnce();
  });

  it('maps a request timeout to unavailable without retrying', async () => {
    const hanging = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    await expect(
      submitFeedbackOverHttps(VALID_REQUEST, {
        isPackaged: true,
        fetchImpl: hanging,
        timeoutMs: 1,
      }),
    ).resolves.toEqual({ ok: false, code: 'unavailable' });
    expect(hanging).toHaveBeenCalledOnce();
  });

  it('rejects invalid renderer payloads before making a request', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(202, { ok: true, reportId: 'FB-one' }));
    await expect(
      submitFeedbackOverHttps(
        { ...VALID_REQUEST, extra: true },
        {
          isPackaged: true,
          fetchImpl,
        },
      ),
    ).resolves.toEqual({ ok: false, code: 'invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
