import { describe, expect, it } from 'vitest';
import { validateFeedbackSubmission } from './validation.js';

const validRequest = {
  message: 'Node deletion did not work.',
  appVersion: '0.1.1',
  releaseChannel: 'Preview',
  platform: 'win32',
  architecture: 'x64',
  locale: 'en-US',
  submittedAt: '2026-08-02T01:02:03.000Z',
  requestId: '123e4567-e89b-42d3-a456-426614174000',
} as const;

describe('validateFeedbackSubmission', () => {
  it('accepts exactly the main-process HTTPS fields and normalizes whitespace', () => {
    expect(validateFeedbackSubmission({ ...validRequest, message: '  problem  ' })).toEqual({
      ...validRequest,
      message: 'problem',
    });
  });

  it.each([
    null,
    [],
    { ...validRequest, extra: true },
    { ...validRequest, locale: 'fr-FR' },
    { ...validRequest, appVersion: 'preview' },
    { ...validRequest, releaseChannel: 'Nightly' },
    { ...validRequest, platform: 'win32\nBcc' },
    { ...validRequest, submittedAt: 'not-a-date' },
    { ...validRequest, requestId: 'not-a-uuid' },
    { ...validRequest, message: '   ' },
    { ...validRequest, message: 'bad\u0000message' },
    { ...validRequest, message: 'x'.repeat(8_001) },
  ])('rejects a non-conforming payload', (payload) => {
    expect(validateFeedbackSubmission(payload)).toBeNull();
  });

  it('counts Unicode characters rather than UTF-16 code units', () => {
    expect(
      validateFeedbackSubmission({ ...validRequest, message: '😀'.repeat(8_000) }),
    ).not.toBeNull();
    expect(validateFeedbackSubmission({ ...validRequest, message: '😀'.repeat(8_001) })).toBeNull();
  });
});
