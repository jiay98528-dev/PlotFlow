import type { FeedbackSubmitRequest, FeedbackSubmitResult } from '../src/shared/feedback';
import { FEEDBACK_MESSAGE_MAX_CHARACTERS } from '../src/shared/feedback';
import { APP_RELEASE_CHANNEL, APP_VERSION } from '../src/shared/productIdentity';

export const PRODUCTION_FEEDBACK_ENDPOINT =
  'https://www.leankom.com/api/fablevia-feedback/v1/reports' as const;
const DEFAULT_TIMEOUT_MS = 10_000;
const REQUEST_KEYS = ['locale', 'message', 'requestId'] as const;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type FeedbackFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface FeedbackHttpOptions {
  readonly isPackaged: boolean;
  readonly environment?: NodeJS.ProcessEnv;
  readonly fetchImpl?: FeedbackFetch;
  readonly timeoutMs?: number;
  readonly platform?: NodeJS.Platform;
  readonly architecture?: string;
  readonly now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRequest(value: unknown): FeedbackSubmitRequest | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (
    keys.length !== REQUEST_KEYS.length ||
    !REQUEST_KEYS.every((key, index) => keys[index] === key)
  ) {
    return null;
  }

  const messageValue = value['message'];
  const localeValue = value['locale'];
  const requestIdValue = value['requestId'];
  if (
    typeof messageValue !== 'string' ||
    (localeValue !== 'zh-CN' && localeValue !== 'en-US') ||
    typeof requestIdValue !== 'string' ||
    !UUID_V4_PATTERN.test(requestIdValue)
  ) {
    return null;
  }

  const message = messageValue.trim();
  if (message.length === 0 || [...message].length > FEEDBACK_MESSAGE_MAX_CHARACTERS) {
    return null;
  }
  return { message, locale: localeValue, requestId: requestIdValue.toLowerCase() };
}

function isLoopbackEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    const loopbackHosts = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      loopbackHosts.has(url.hostname.toLowerCase()) &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}

export function resolveFeedbackEndpoint(
  isPackaged: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  if (!isPackaged) {
    const developmentEndpoint = environment['FABLEVIA_FEEDBACK_ENDPOINT']?.trim();
    if (developmentEndpoint && isLoopbackEndpoint(developmentEndpoint)) {
      return developmentEndpoint;
    }
  }
  return PRODUCTION_FEEDBACK_ENDPOINT;
}

function unavailableResult(): FeedbackSubmitResult {
  return { ok: false, code: 'unavailable' };
}

function mapHttpFailure(status: number): FeedbackSubmitResult {
  if (status === 400 || status === 413) return { ok: false, code: 'invalid' };
  if (status === 429) return { ok: false, code: 'rate_limited' };
  return unavailableResult();
}

function hasValidSuccessBody(
  value: unknown,
): value is { readonly ok: true; readonly reportId: string } {
  if (!isRecord(value) || value['ok'] !== true || typeof value['reportId'] !== 'string') {
    return false;
  }
  const reportId = value['reportId'];
  return reportId.length > 0 && reportId.length <= 200 && !/[\r\n]/u.test(reportId);
}

export async function submitFeedbackOverHttps(
  requestValue: unknown,
  options: FeedbackHttpOptions,
): Promise<FeedbackSubmitResult> {
  const request = validateRequest(requestValue);
  if (!request) return { ok: false, code: 'invalid' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(
      resolveFeedbackEndpoint(options.isPackaged, options.environment),
      {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: request.message,
          appVersion: APP_VERSION,
          releaseChannel: APP_RELEASE_CHANNEL === 'preview' ? 'Preview' : 'Stable',
          platform: options.platform ?? process.platform,
          architecture: options.architecture ?? process.arch,
          locale: request.locale,
          submittedAt: (options.now ?? (() => new Date()))().toISOString(),
          requestId: request.requestId,
        }),
      },
    );

    if (!response.ok) return mapHttpFailure(response.status);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return unavailableResult();
    }
    return hasValidSuccessBody(body) ? { ok: true, reportId: body.reportId } : unavailableResult();
  } catch {
    return controller.signal.aborted
      ? { ok: false, code: 'unavailable' }
      : { ok: false, code: 'offline' };
  } finally {
    clearTimeout(timeout);
  }
}
