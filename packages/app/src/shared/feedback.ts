export const FEEDBACK_MESSAGE_MAX_CHARACTERS = 8_000;

export type FeedbackLocale = 'zh-CN' | 'en-US';

export interface FeedbackSubmitRequest {
  readonly message: string;
  readonly locale: FeedbackLocale;
  readonly requestId: string;
}

export type FeedbackSubmitResult =
  | { readonly ok: true; readonly reportId: string }
  | {
      readonly ok: false;
      readonly code: 'invalid' | 'rate_limited' | 'offline' | 'unavailable';
    };
