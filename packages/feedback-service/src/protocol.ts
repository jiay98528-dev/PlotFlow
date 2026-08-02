export const FEEDBACK_BODY_MAX_BYTES = 16 * 1024;
export const FEEDBACK_MESSAGE_MAX_CHARACTERS = 8_000;
export const FEEDBACK_REQUEST_ID_TTL_MS = 24 * 60 * 60 * 1_000;

export type FeedbackLocale = 'zh-CN' | 'en-US';
export type FeedbackReleaseChannel = 'Preview' | 'Stable';

/** Exact HTTPS payload created by Electron main after validating the renderer request. */
export interface FeedbackReportRequest {
  readonly message: string;
  readonly appVersion: string;
  readonly releaseChannel: FeedbackReleaseChannel;
  readonly platform: string;
  readonly architecture: string;
  readonly locale: FeedbackLocale;
  readonly submittedAt: string;
  readonly requestId: string;
}

export type FeedbackServiceSuccessStatus = 'accepted' | 'duplicate';
export type FeedbackServiceErrorCode =
  | 'invalid'
  | 'payload_too_large'
  | 'rate_limited'
  | 'unavailable';

/** Response emitted by the loopback service before Electron maps it to the desktop result. */
export type FeedbackServiceResult =
  | {
      readonly ok: true;
      readonly status: FeedbackServiceSuccessStatus;
      readonly reportId: string;
    }
  | { readonly ok: false; readonly code: FeedbackServiceErrorCode };
