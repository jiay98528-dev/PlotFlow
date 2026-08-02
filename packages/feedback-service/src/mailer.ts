import type { SmtpConfig } from './config.js';
import type { FeedbackReportRequest } from './protocol.js';

export const FEEDBACK_MAIL_SUBJECT = '[Fablevia Feedback] Bug report';

export interface FeedbackMailInput {
  readonly reportId: string;
  readonly request: FeedbackReportRequest;
}

export interface FeedbackMail {
  readonly from: string;
  readonly to: string;
  readonly subject: typeof FEEDBACK_MAIL_SUBJECT;
  readonly text: string;
  readonly disableFileAccess: true;
  readonly disableUrlAccess: true;
}

export interface FeedbackMailer {
  send: (input: FeedbackMailInput) => Promise<void>;
}

/** User input appears only after a fixed delimiter in the plain-text body, never in mail headers. */
export function buildFeedbackMail(
  smtp: Pick<SmtpConfig, 'from' | 'to'>,
  input: FeedbackMailInput,
): FeedbackMail {
  return {
    from: smtp.from,
    to: smtp.to,
    subject: FEEDBACK_MAIL_SUBJECT,
    text: [
      'Fablevia feedback report',
      `Report ID: ${input.reportId}`,
      `Request ID: ${input.request.requestId}`,
      `Version: V${input.request.appVersion} ${input.request.releaseChannel}`,
      `Platform: ${input.request.platform}/${input.request.architecture}`,
      `Locale: ${input.request.locale}`,
      `Submitted at: ${input.request.submittedAt}`,
      '',
      '--- BEGIN USER MESSAGE ---',
      input.request.message,
      '--- END USER MESSAGE ---',
    ].join('\n'),
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export async function createSmtpMailer(smtp: SmtpConfig): Promise<FeedbackMailer> {
  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });

  return {
    send: async (input) => {
      await transporter.sendMail(buildFeedbackMail(smtp, input));
    },
  };
}
