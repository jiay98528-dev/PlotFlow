import type { Writable } from 'node:stream';
import type { FeedbackServiceErrorCode } from './protocol.js';

export interface FeedbackLogger {
  accepted: (reportId: string, durationMs: number) => void;
  duplicate: (reportId: string) => void;
  rejected: (code: FeedbackServiceErrorCode) => void;
  deliveryFailed: (error: unknown, durationMs: number) => void;
  started: (port: number) => void;
}

function errorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'UnknownError';
}

/** Emits only curated operational fields; requestId, message, locale and SMTP values are absent. */
export function createJsonFeedbackLogger(
  output: Pick<Writable, 'write'> = process.stdout,
): FeedbackLogger {
  const write = (record: Readonly<Record<string, string | number>>): void => {
    output.write(`${JSON.stringify({ timestamp: new Date().toISOString(), ...record })}\n`);
  };

  return {
    accepted: (reportId, durationMs) => write({ event: 'feedback.accepted', reportId, durationMs }),
    duplicate: (reportId) => write({ event: 'feedback.duplicate', reportId }),
    rejected: (code) => write({ event: 'feedback.rejected', code }),
    deliveryFailed: (error, durationMs) =>
      write({
        event: 'feedback.delivery_failed',
        errorName: errorName(error),
        durationMs,
      }),
    started: (port) => write({ event: 'feedback.service_started', port }),
  };
}

export const SILENT_FEEDBACK_LOGGER: FeedbackLogger = {
  accepted: () => undefined,
  duplicate: () => undefined,
  rejected: () => undefined,
  deliveryFailed: () => undefined,
  started: () => undefined,
};
