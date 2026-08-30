import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  FEEDBACK_BODY_MAX_BYTES,
  FEEDBACK_REQUEST_ID_TTL_MS,
  type FeedbackServiceResult,
} from './protocol.js';
import { RequestDeduplicator, type DedupePersistence } from './deduplicator.js';
import { GlobalRateLimiter } from './rateLimiter.js';
import { SILENT_FEEDBACK_LOGGER, type FeedbackLogger } from './logger.js';
import type { FeedbackMailer } from './mailer.js';
import { validateFeedbackSubmission } from './validation.js';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000;

class PayloadTooLargeError extends Error {}

export interface FeedbackServerOptions {
  readonly mailer: FeedbackMailer;
  readonly rateLimitMax?: number;
  readonly rateLimitWindowMs?: number;
  readonly idempotencyTtlMs?: number;
  readonly now?: () => number;
  readonly createReportId?: () => string;
  readonly dedupePersistence?: DedupePersistence;
  readonly deduplicator?: RequestDeduplicator;
  readonly logger?: FeedbackLogger;
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: FeedbackServiceResult | { readonly ok: true },
  headers: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function hasJsonContentType(request: IncomingMessage): boolean {
  const mediaType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}

async function readBoundedBody(request: IncomingMessage): Promise<Buffer> {
  const contentLength = request.headers['content-length'];
  if (contentLength !== undefined) {
    if (!/^\d+$/u.test(contentLength)) throw new Error('Invalid content length');
    if (Number(contentLength) > FEEDBACK_BODY_MAX_BYTES) {
      request.resume();
      throw new PayloadTooLargeError();
    }
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    byteLength += buffer.byteLength;
    if (byteLength > FEEDBACK_BODY_MAX_BYTES) {
      tooLarge = true;
      chunks.length = 0;
    } else if (!tooLarge) {
      chunks.push(buffer);
    }
  }
  if (tooLarge) throw new PayloadTooLargeError();
  return Buffer.concat(chunks, byteLength);
}

function parseJson(body: Buffer): unknown {
  if (body.byteLength === 0) return null;
  return JSON.parse(body.toString('utf8')) as unknown;
}

export function createFeedbackServer(options: FeedbackServerOptions): Server {
  const now = options.now ?? Date.now;
  const logger = options.logger ?? SILENT_FEEDBACK_LOGGER;
  const limiter = new GlobalRateLimiter(
    options.rateLimitMax ?? 100,
    options.rateLimitWindowMs ?? RATE_LIMIT_WINDOW_MS,
    now,
  );
  const deduplicator =
    options.deduplicator ??
    new RequestDeduplicator(
      options.idempotencyTtlMs ?? FEEDBACK_REQUEST_ID_TTL_MS,
      now,
      options.createReportId,
      options.dedupePersistence,
    );
  const deduplicatorReady = deduplicator.initialize();

  const server = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/healthz') {
      writeJson(response, 200, { ok: true });
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/feedback') {
      writeJson(response, 404, { ok: false, code: 'invalid' });
      return;
    }
    if (!hasJsonContentType(request) || request.headers['content-encoding'] !== undefined) {
      logger.rejected('invalid');
      writeJson(response, 400, { ok: false, code: 'invalid' });
      return;
    }

    let body: Buffer;
    try {
      body = await readBoundedBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        logger.rejected('payload_too_large');
        writeJson(response, 413, { ok: false, code: 'payload_too_large' });
        return;
      }
      logger.rejected('invalid');
      writeJson(response, 400, { ok: false, code: 'invalid' });
      return;
    }

    let parsed: unknown;
    try {
      parsed = parseJson(body);
    } catch {
      logger.rejected('invalid');
      writeJson(response, 400, { ok: false, code: 'invalid' });
      return;
    }
    const submission = validateFeedbackSubmission(parsed);
    if (!submission) {
      logger.rejected('invalid');
      writeJson(response, 400, { ok: false, code: 'invalid' });
      return;
    }

    try {
      await deduplicatorReady;
    } catch (error) {
      logger.deliveryFailed(error, 0);
      writeJson(response, 503, { ok: false, code: 'unavailable' });
      return;
    }

    try {
      const duplicateReportId = await deduplicator.find(submission.requestId);
      if (duplicateReportId) {
        logger.duplicate(duplicateReportId);
        writeJson(response, 200, {
          ok: true,
          status: 'duplicate',
          reportId: duplicateReportId,
        });
        return;
      }
    } catch (error) {
      logger.deliveryFailed(error, 0);
      writeJson(response, 503, { ok: false, code: 'unavailable' });
      return;
    }

    const rateLimit = limiter.attempt();
    if (!rateLimit.allowed) {
      logger.rejected('rate_limited');
      writeJson(
        response,
        429,
        { ok: false, code: 'rate_limited' },
        { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      );
      return;
    }

    const startedAt = now();
    try {
      const result = await deduplicator.execute(submission.requestId, async (reportId) => {
        await options.mailer.send({ reportId, request: submission });
      });
      const durationMs = Math.max(0, now() - startedAt);
      if (result.status === 'accepted') logger.accepted(result.reportId, durationMs);
      else logger.duplicate(result.reportId);
      writeJson(response, result.status === 'accepted' ? 202 : 200, {
        ok: true,
        status: result.status,
        reportId: result.reportId,
      });
    } catch (error) {
      logger.deliveryFailed(error, Math.max(0, now() - startedAt));
      writeJson(response, 503, { ok: false, code: 'unavailable' });
    }
  });

  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}
