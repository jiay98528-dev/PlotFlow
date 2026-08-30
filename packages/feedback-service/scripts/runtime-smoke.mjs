const service = await import('../dist/index.js');

if (
  typeof service.createFeedbackServer !== 'function' ||
  typeof service.startFeedbackService !== 'function'
) {
  throw new Error('Feedback service runtime exports are unavailable');
}

process.stdout.write('feedback-service runtime import: PASS\n');
