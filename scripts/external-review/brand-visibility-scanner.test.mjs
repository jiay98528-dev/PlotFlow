import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { scanText, scanTypeScript } from '../check-brand-visibility.mjs';

const fixture = (name) => resolve('packages', 'app', 'src-electron', name);

test('brand scan covers static fragments in interpolated template strings', () => {
  const findings = scanTypeScript(
    fixture('feedback-template.ts'),
    [
      'const first = `PlotFlow version: ${version}`;',
      'const second = `${message} from PlotFlow`;',
    ].join('\n'),
  );

  assert.equal(findings.length, 2);
  assert.match(findings[0], /PlotFlow version:/u);
  assert.match(findings[1], /from PlotFlow/u);
});

test('brand scan ignores expression identifiers and preserves brand-compat', () => {
  const findings = scanTypeScript(
    fixture('technical-template.ts'),
    [
      'const technical = `${PlotFlowTechnicalNamespace}`;',
      'const compatibility = `PlotFlow ${value}`; // brand-compat',
    ].join('\n'),
  );

  assert.deepEqual(findings, []);
});

test('brand scan covers HTML title text', () => {
  const findings = scanText(
    resolve('packages', 'app', 'index.html'),
    '<!doctype html><title>PlotFlow</title>',
  );

  assert.equal(findings.length, 1);
  assert.match(findings[0], /PlotFlow/u);
});
