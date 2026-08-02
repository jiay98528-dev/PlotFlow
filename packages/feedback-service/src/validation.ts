import { FEEDBACK_MESSAGE_MAX_CHARACTERS, type FeedbackReportRequest } from './protocol.js';

const REQUEST_KEYS = [
  'appVersion',
  'architecture',
  'locale',
  'message',
  'platform',
  'releaseChannel',
  'requestId',
  'submittedAt',
] as const;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const SAFE_TOKEN_PATTERN = /^[0-9A-Za-z._-]{1,32}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasDisallowedControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint === 0x7f) return true;
    if (codePoint <= 0x1f && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d) {
      return true;
    }
  }
  return false;
}

export function validateFeedbackSubmission(value: unknown): FeedbackReportRequest | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== REQUEST_KEYS.length) return null;
  if (!REQUEST_KEYS.every((key, index) => key === keys[index])) return null;

  const messageValue = value['message'];
  const appVersionValue = value['appVersion'];
  const releaseChannelValue = value['releaseChannel'];
  const platformValue = value['platform'];
  const architectureValue = value['architecture'];
  const localeValue = value['locale'];
  const submittedAtValue = value['submittedAt'];
  const requestIdValue = value['requestId'];
  if (
    typeof messageValue !== 'string' ||
    typeof appVersionValue !== 'string' ||
    !VERSION_PATTERN.test(appVersionValue) ||
    (releaseChannelValue !== 'Preview' && releaseChannelValue !== 'Stable') ||
    typeof platformValue !== 'string' ||
    !SAFE_TOKEN_PATTERN.test(platformValue) ||
    typeof architectureValue !== 'string' ||
    !SAFE_TOKEN_PATTERN.test(architectureValue) ||
    (localeValue !== 'zh-CN' && localeValue !== 'en-US') ||
    typeof submittedAtValue !== 'string' ||
    !Number.isFinite(Date.parse(submittedAtValue)) ||
    typeof requestIdValue !== 'string' ||
    !UUID_V4_PATTERN.test(requestIdValue)
  ) {
    return null;
  }

  const message = messageValue.trim();
  if (
    message.length === 0 ||
    [...message].length > FEEDBACK_MESSAGE_MAX_CHARACTERS ||
    hasDisallowedControlCharacter(message)
  ) {
    return null;
  }

  return {
    message,
    appVersion: appVersionValue,
    releaseChannel: releaseChannelValue,
    platform: platformValue,
    architecture: architectureValue,
    locale: localeValue,
    submittedAt: submittedAtValue,
    requestId: requestIdValue.toLowerCase(),
  };
}
