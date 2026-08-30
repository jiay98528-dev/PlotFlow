import { pathToFileURL } from 'node:url';
import type { Server } from 'node:http';
import { FEEDBACK_BIND_HOST, loadFeedbackServiceConfig } from './config.js';
import { createJsonFeedbackLogger } from './logger.js';
import { createSmtpMailer } from './mailer.js';
import { createFeedbackServer } from './server.js';
import { JsonFileDedupePersistence } from './fileDedupePersistence.js';
import { RequestDeduplicator } from './deduplicator.js';

export * from './protocol.js';
export * from './config.js';
export * from './deduplicator.js';
export * from './fileDedupePersistence.js';
export * from './logger.js';
export * from './mailer.js';
export * from './rateLimiter.js';
export * from './server.js';
export * from './validation.js';

export async function startFeedbackService(): Promise<Server> {
  const config = loadFeedbackServiceConfig();
  const logger = createJsonFeedbackLogger();
  const mailer = await createSmtpMailer(config.smtp);
  const deduplicator = new RequestDeduplicator(
    undefined,
    undefined,
    undefined,
    new JsonFileDedupePersistence(config.stateDirectory),
  );
  await deduplicator.initialize();
  const server = createFeedbackServer({
    mailer,
    logger,
    rateLimitMax: config.rateLimitMax,
    deduplicator,
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, FEEDBACK_BIND_HOST, () => {
      server.off('error', reject);
      resolve();
    });
  });
  logger.started(config.port);
  return server;
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const server = await startFeedbackService();
  const shutdown = (): void => {
    server.close((error) => {
      process.exitCode = error ? 1 : 0;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
