import { describe, expect, it } from 'vitest';
import { loadFeedbackServiceConfig } from './config.js';
import { createJsonFeedbackLogger } from './logger.js';
import { buildFeedbackMail, FEEDBACK_MAIL_SUBJECT } from './mailer.js';

describe('feedback SMTP boundary', () => {
  it('loads SMTP credentials only from the service environment', () => {
    const config = loadFeedbackServiceConfig({
      FEEDBACK_SMTP_HOST: 'smtp.example.com',
      FEEDBACK_SMTP_USER: 'service-user',
      FEEDBACK_SMTP_PASS: 'deployment-secret',
      FEEDBACK_MAIL_FROM: 'Fablevia Feedback <feedback@example.com>',
      FEEDBACK_MAIL_TO: 'maintainer@example.com',
    });
    expect(config.host).toBe('127.0.0.1');
    expect(config.smtp.secure).toBe(true);
    expect(config.smtp.port).toBe(465);
    expect(config.smtp.pass).toBe('deployment-secret');
    expect(config.stateDirectory).toBe('/var/lib/fablevia-feedback');
  });

  it('accepts the systemd-managed state directory without reading a local config file', () => {
    const config = loadFeedbackServiceConfig({
      STATE_DIRECTORY: '/var/lib/fablevia-feedback',
      FEEDBACK_SMTP_HOST: 'smtp.example.com',
      FEEDBACK_SMTP_USER: 'service-user',
      FEEDBACK_SMTP_PASS: 'deployment-secret',
      FEEDBACK_MAIL_FROM: 'Fablevia Feedback <feedback@example.com>',
      FEEDBACK_MAIL_TO: 'maintainer@example.com',
    });
    expect(config.stateDirectory).toBe('/var/lib/fablevia-feedback');
  });

  it('rejects attempted mail-header injection in environment configuration', () => {
    expect(() =>
      loadFeedbackServiceConfig({
        FEEDBACK_SMTP_HOST: 'smtp.example.com',
        FEEDBACK_SMTP_USER: 'service-user',
        FEEDBACK_SMTP_PASS: 'secret',
        FEEDBACK_MAIL_FROM: 'sender@example.com\r\nBcc: attacker@example.com',
        FEEDBACK_MAIL_TO: 'maintainer@example.com',
      }),
    ).toThrow('must not contain line breaks');
  });

  it('keeps user content out of fixed plain-text mail headers', () => {
    const maliciousMessage = 'Subject: forged\nBcc: attacker@example.com';
    const mail = buildFeedbackMail(
      { from: 'sender@example.com', to: 'maintainer@example.com' },
      {
        reportId: 'FB-one',
        request: {
          message: maliciousMessage,
          appVersion: '0.1.1',
          releaseChannel: 'Preview',
          platform: 'win32',
          architecture: 'x64',
          locale: 'en-US',
          submittedAt: '2026-08-02T01:02:03.000Z',
          requestId: '123e4567-e89b-42d3-a456-426614174000',
        },
      },
    );
    expect(mail.subject).toBe(FEEDBACK_MAIL_SUBJECT);
    expect(mail.from).not.toContain(maliciousMessage);
    expect(mail.to).not.toContain(maliciousMessage);
    expect(mail.text).toContain(maliciousMessage);
    expect(mail.text).toContain('Version: V0.1.1 Preview');
    expect(mail.text).toContain('Platform: win32/x64');
    expect(mail.disableFileAccess).toBe(true);
    expect(mail.disableUrlAccess).toBe(true);
    expect(mail).not.toHaveProperty('html');
  });

  it('never logs message, requestId, SMTP credentials or raw delivery errors', () => {
    let output = '';
    const logger = createJsonFeedbackLogger({
      write: (chunk) => {
        output += String(chunk);
        return true;
      },
    });
    logger.accepted('FB-visible', 12);
    logger.deliveryFailed(new Error('secret message and smtp.example.com'), 20);
    expect(output).toContain('FB-visible');
    expect(output).toContain('Error');
    expect(output).not.toContain('secret message');
    expect(output).not.toContain('smtp.example.com');
    expect(output).not.toContain('123e4567');
  });
});
