import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { WORKSPACE_ROOT } from './windows-unsigned-candidate.mjs';

test('Windows release workflow gates source paths before creating one bound candidate', async () => {
  const workflow = await readFile(
    path.join(WORKSPACE_ROOT, '.github', 'workflows', 'release-validation.yml'),
    'utf8',
  );
  const integrationIndex = workflow.indexOf('pnpm --filter @plotflow/app test:e2e\n');
  const sourceBlackboxIndex = workflow.indexOf('pnpm --filter @plotflow/app test:e2e:blackbox\n');
  const candidateIndex = workflow.indexOf('pnpm release:candidate:create');
  const unpackedIndex = workflow.indexOf('pnpm --filter @plotflow/app test:e2e:unpacked');
  const postValidationVerifyIndex = workflow.indexOf(
    'Verify candidate again after unpacked validation',
  );
  const uploadIndex = workflow.indexOf('uses: actions/upload-artifact@v4');

  assert.ok(integrationIndex >= 0, 'integration E2E gate is missing');
  assert.ok(sourceBlackboxIndex > integrationIndex, 'source blackbox must follow integration E2E');
  assert.ok(candidateIndex > sourceBlackboxIndex, 'packaging must follow both source gates');
  assert.ok(unpackedIndex > candidateIndex, 'unpacked blackbox must use the created candidate');
  assert.ok(
    postValidationVerifyIndex > unpackedIndex && postValidationVerifyIndex < uploadIndex,
    'the tested candidate must be verified again before upload',
  );
  assert.doesNotMatch(workflow, /^\s*run: pnpm package:win\s*$/mu);
  assert.match(workflow, /steps\.candidate\.outputs\.candidate_dir/u);
  assert.match(workflow, /PLOTFLOW_BLACKBOX_RELEASE_ROOT/u);
  assert.match(workflow, /PLOTFLOW_BLACKBOX_UNPACKED_EXE/u);
  assert.match(workflow, /PLOTFLOW_VISUAL_FONT_ENV: windows-2022-segoe-ui/u);
  assert.match(workflow, /candidate-manifest\.json/u);
  assert.match(workflow, /win-unpacked\/resources\/app\.asar/u);
  assert.match(workflow, /--expected-commit '\$\{\{ github\.sha \}\}'/u);

  for (const command of [
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test',
    'pnpm build',
    'pnpm lint:css',
    'pnpm lint:tokens',
    'pnpm lint:layers',
    'pnpm lint:bundle',
    'pnpm lint:ui-literals',
    'pnpm lint:brand',
    'pnpm check:schema',
    'pnpm test:engine-contract',
    'pnpm --dir website verify:static',
    'pnpm --dir packages/feedback-service test:runtime',
  ]) {
    const commandIndex = workflow.indexOf(command);
    assert.ok(commandIndex >= 0 && commandIndex < candidateIndex, `${command} must gate packaging`);
  }
});

test('Electron Builder accepts only the orchestrated release-output override', async () => {
  const config = await readFile(path.join(WORKSPACE_ROOT, 'electron-builder.config.js'), 'utf8');

  assert.match(config, /process\.env\.PLOTFLOW_RELEASE_OUTPUT/u);
  assert.match(config, /output: releaseOutput \? path\.resolve\(releaseOutput\) : 'release'/u);
});

test('candidate verification cannot override the checked-out product version', async () => {
  const script = await readFile(
    path.join(WORKSPACE_ROOT, 'scripts', 'release', 'windows-unsigned-candidate.mjs'),
    'utf8',
  );

  assert.doesNotMatch(script, /options\.get\(['"]--expected-version['"]\)/u);
  assert.match(script, /expectedVersion: identity\.version/u);
});

test('unpacked blackbox requires the exact candidate executable instead of root release', async () => {
  const helper = await readFile(
    path.join(WORKSPACE_ROOT, 'packages', 'app', 'e2e-blackbox', 'helpers', 'electronBlackbox.ts'),
    'utf8',
  );

  assert.doesNotMatch(helper, /release['"],\s*['"]win-unpacked/u);
  assert.match(helper, /PLOTFLOW_BLACKBOX_RELEASE_ROOT/u);
  assert.match(helper, /PLOTFLOW_BLACKBOX_UNPACKED_EXE/u);
});
