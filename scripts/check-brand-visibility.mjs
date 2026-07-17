/* global console, process */

import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const targets = [
  'package.json',
  'electron-builder.config.js',
  'packages/app/src/i18n',
  'packages/app/src/renderer',
  'packages/app/src/components',
  'packages/app/src/theme/builtin',
  'packages/app/src-electron',
  'website/index.html',
  'website/package.json',
  'website/src',
  'addons/plotflow',
  'plugins/unity',
  'plugins/unreal',
];

const supportedExtensions = new Set([
  '.cs', '.gd', '.h', '.html', '.js', '.json', '.ts', '.tsx',
]);

async function collect(path) {
  const absolute = resolve(root, path);
  const entries = await readdir(absolute, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOTDIR') return null;
    throw error;
  });
  if (entries === null) return [absolute];
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.includes('.test.') && !entry.name.includes('.spec.'))
      .map((entry) => collect(`${path}/${entry.name}`)),
  );
  return nested.flat();
}

function location(file, source, position) {
  const prefix = source.slice(0, position);
  const line = prefix.split(/\r?\n/u).length;
  return `${relative(root, file).replaceAll('\\', '/')}:${line}`;
}

function lineHasCompatibilityMarker(source, position) {
  const start = source.lastIndexOf('\n', position) + 1;
  const end = source.indexOf('\n', position);
  return source.slice(start, end < 0 ? source.length : end).includes('brand-compat');
}

function scanTypeScript(file, source) {
  const kind = extname(file) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const findings = [];
  function inspect(node) {
    let value;
    if (ts.isStringLiteralLike(node)) value = node.text;
    if (ts.isJsxText(node)) value = node.getText(sourceFile);
    if (value?.includes('PlotFlow') && !lineHasCompatibilityMarker(source, node.getStart(sourceFile))) {
      findings.push(`${location(file, source, node.getStart(sourceFile))} ${JSON.stringify(value.trim())}`);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(sourceFile);
  return findings;
}

function scanText(file, source) {
  const findings = [];
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes('PlotFlow') || line.includes('brand-compat')) continue;
    if (['.cs', '.gd', '.h'].includes(extname(file))) {
      if (/cref="PlotFlow|#include\s+"PlotFlow|PlotFlowDataTypes\.generated\.h/u.test(line)) {
        continue;
      }
      const quoted = [...line.matchAll(/(['"])(.*?)\1/gu)].some((match) => match[2].includes('PlotFlow'));
      if (!quoted) continue;
    }
    findings.push(`${relative(root, file).replaceAll('\\', '/')}:${index + 1} ${line.trim()}`);
  }
  return findings;
}

const files = (await Promise.all(targets.map(collect)))
  .flat()
  .filter((file) => supportedExtensions.has(extname(file)) || file.endsWith('plugin.cfg'))
  .sort();
const findings = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  findings.push(
    ...(extname(file) === '.ts' || extname(file) === '.tsx'
      ? scanTypeScript(file, source)
      : scanText(file, source)),
  );
}

if (findings.length > 0) {
  console.error('Legacy PlotFlow branding remains in user-visible source literals:');
  for (const finding of findings) console.error(`- ${finding}`);
  console.error('Rename visible copy or annotate a required compatibility literal with brand-compat.');
  process.exitCode = 1;
} else {
  console.log(`Brand visibility scan passed (${files.length} source files).`);
}
