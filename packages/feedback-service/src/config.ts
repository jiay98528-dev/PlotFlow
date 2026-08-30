export const FEEDBACK_BIND_HOST = '127.0.0.1' as const;

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly from: string;
  readonly to: string;
}

export interface FeedbackServiceConfig {
  readonly host: typeof FEEDBACK_BIND_HOST;
  readonly port: number;
  readonly rateLimitMax: number;
  readonly stateDirectory: string;
  readonly smtp: SmtpConfig;
}

function requiredEnvironmentValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requiredSecret(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseInteger(rawValue: string, name: string, minimum: number, maximum: number): number {
  if (!/^\d+$/u.test(rawValue)) throw new Error(`${name} must be an integer`);
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function assertHeaderSafe(value: string, name: string): string {
  if (/[\r\n]/u.test(value)) throw new Error(`${name} must not contain line breaks`);
  return value;
}

function parseSecure(rawValue: string | undefined): boolean {
  if (rawValue === undefined || rawValue.trim() === '') return true;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  throw new Error('FEEDBACK_SMTP_SECURE must be true or false');
}

/** Reads deployment-only configuration from process environment variables. */
export function loadFeedbackServiceConfig(
  environment: NodeJS.ProcessEnv = process.env,
): FeedbackServiceConfig {
  const secure = parseSecure(environment['FEEDBACK_SMTP_SECURE']);
  const defaultSmtpPort = secure ? '465' : '587';
  return {
    host: FEEDBACK_BIND_HOST,
    port: parseInteger(
      environment['FEEDBACK_SERVICE_PORT'] ?? '18081',
      'FEEDBACK_SERVICE_PORT',
      1,
      65_535,
    ),
    rateLimitMax: parseInteger(
      environment['FEEDBACK_RATE_LIMIT_MAX'] ?? '100',
      'FEEDBACK_RATE_LIMIT_MAX',
      1,
      10_000,
    ),
    stateDirectory:
      environment['FEEDBACK_STATE_DIRECTORY']?.trim() ||
      environment['STATE_DIRECTORY']?.trim() ||
      '/var/lib/fablevia-feedback',
    smtp: {
      host: assertHeaderSafe(
        requiredEnvironmentValue(environment, 'FEEDBACK_SMTP_HOST'),
        'FEEDBACK_SMTP_HOST',
      ),
      port: parseInteger(
        environment['FEEDBACK_SMTP_PORT'] ?? defaultSmtpPort,
        'FEEDBACK_SMTP_PORT',
        1,
        65_535,
      ),
      secure,
      user: assertHeaderSafe(
        requiredEnvironmentValue(environment, 'FEEDBACK_SMTP_USER'),
        'FEEDBACK_SMTP_USER',
      ),
      pass: requiredSecret(environment, 'FEEDBACK_SMTP_PASS'),
      from: assertHeaderSafe(
        requiredEnvironmentValue(environment, 'FEEDBACK_MAIL_FROM'),
        'FEEDBACK_MAIL_FROM',
      ),
      to: assertHeaderSafe(
        requiredEnvironmentValue(environment, 'FEEDBACK_MAIL_TO'),
        'FEEDBACK_MAIL_TO',
      ),
    },
  };
}
