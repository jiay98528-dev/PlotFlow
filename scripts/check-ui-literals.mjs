/* global console, process */

import { readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const scanTargets = [
  'packages/app/src/renderer/App.tsx',
  'packages/app/src/components/branch-graph',
  'packages/app/src/components/editor/MonacoEditor.tsx',
  'packages/app/src/components/graph-lab',
  'packages/app/src/components/home',
  'packages/app/src/components/layout',
  'packages/app/src/components/panels/ConditionEditor.tsx',
  'packages/app/src/components/panels/ExportDialog.tsx',
  'packages/app/src/components/panels/ProblemPanel.tsx',
];

// Product names, file formats, schema enum values and conventional glyphs do not
// require translation. Keep this list exact so new prose cannot hide behind it.
const allowedExact = new Set([
  'PlotFlow',
  'Graph Lab',
  'Source Drawer',
  'Split',
  'JSON',
  'HTML',
  'TXT',
  '.mdstory',
  'generic',
  'godot',
  'unity',
  'unreal',
  'AND',
  'OR',
  'NOT',
  'true',
  'false',
  'global',
  'chapter',
  'Ctrl',
  'Cmd',
]);
const visibleAttributeNames = new Set(['title', 'aria-label', 'placeholder']);
const visibleCallPattern =
  /^(?:alert|confirm|prompt|setStatusMessage|setFeedbackMessage|show(?:ErrorBox|MessageBox))$/;

async function collectFiles(target) {
  const absolute = resolve(root, target);
  try {
    const entries = await readdir(absolute, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map((entry) => collectFiles(`${target}/${entry.name}`)),
    );
    return nested.flat();
  } catch (error) {
    if (error?.code === 'ENOTDIR') {
      return extname(absolute) === '.tsx' ? [absolute] : [];
    }
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isVisibleProse(value) {
  const normalized = normalize(value);
  if (!normalized || allowedExact.has(normalized)) return false;
  if (/^[\p{P}\p{S}\d\s]+$/u.test(normalized)) return false;
  if (/^&#(?:x[\da-f]+|\d+);$/i.test(normalized)) return false;
  if (/^(?:Ctrl|Cmd)(?:(?:\+|\s)[A-Z0-9]+)+$/i.test(normalized)) return false;
  if (/^(?:https?:\/\/|[.#/]?[-\w/]+\.(?:mdstory|json|html|txt))$/i.test(normalized)) {
    return false;
  }
  return /\p{Script=Han}|[A-Za-z]{2,}/u.test(normalized);
}

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return '';
}

function lineAndColumn(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${position.line + 1}:${position.character + 1}`;
}

const files = (await Promise.all(scanTargets.map(collectFiles)))
  .flat()
  .filter((file, index, all) => all.indexOf(file) === index)
  .sort();
const violations = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function report(node, kind, value) {
    if (!isVisibleProse(value)) return;
    const relative = file.slice(root.length + 1).replaceAll('\\', '/');
    violations.push(
      `${relative}:${lineAndColumn(sourceFile, node)} ${kind}: ${JSON.stringify(normalize(value))}`,
    );
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      report(node, 'JSXText', node.getText(sourceFile));
    } else if (
      ts.isJsxAttribute(node) &&
      visibleAttributeNames.has(node.name.getText(sourceFile))
    ) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        report(node.initializer, node.name.getText(sourceFile), node.initializer.text);
      } else if (
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        const value = literalText(node.initializer.expression);
        if (value !== undefined)
          report(node.initializer.expression, node.name.getText(sourceFile), value);
      }
    } else if (ts.isCallExpression(node) && visibleCallPattern.test(callName(node.expression))) {
      for (const argument of node.arguments) {
        const value = literalText(argument);
        if (value !== undefined) report(argument, `call:${callName(node.expression)}`, value);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (violations.length > 0) {
  console.error('Unlocalized UI literals found in the Graph primary path:');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    'Move user-visible copy to appI18n or add only stable product/schema terms to allowedExact.',
  );
  process.exitCode = 1;
} else {
  console.log(`UI literal scan passed (${files.length} Graph primary-path TSX files).`);
}
