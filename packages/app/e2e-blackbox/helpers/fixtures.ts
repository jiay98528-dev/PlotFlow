import { createHash } from 'node:crypto';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export interface BlackboxWorkspace {
  readonly root: string;
  readonly storiesDir: string;
  readonly exportsDir: string;
}

export async function createBlackboxWorkspace(name: string): Promise<BlackboxWorkspace> {
  const root = join(tmpdir(), `plotflow-blackbox-${name}-${Date.now()}`);
  const storiesDir = join(root, 'stories');
  const exportsDir = join(root, 'exports');
  await rm(root, { recursive: true, force: true });
  await mkdir(storiesDir, { recursive: true });
  await mkdir(exportsDir, { recursive: true });
  return { root, storiesDir, exportsDir };
}

export function makeStory(nodeCount: number, title = 'Blackbox Story'): string {
  const safeCount = Math.max(1, nodeCount);
  const nodes: string[] = [];
  for (let index = 1; index <= safeCount; index += 1) {
    const current = `节点${index}`;
    const next = index === safeCount ? '结局' : `节点${index + 1}`;
    nodes.push([
      `## 节点：${current}`,
      `这是 ${current} 的正文，用于黑盒 GUI E2E。`,
      '',
      `[选项] 前往${next} -> ${next}`,
      '',
    ].join('\n'));
  }
  nodes.push([
    '## 节点：结局',
    '这是可导出的结局节点。',
    '',
  ].join('\n'));

  return [
    '---',
    `title: ${title}`,
    'author: Blackbox QA',
    'variables:',
    '  trust: 1',
    '---',
    '',
    '# 章节：第一章',
    '',
    ...nodes,
  ].join('\n');
}

/**
 * Strict Graph-first release fixture.
 *
 * The only error-level diagnostic is the missing option target on the entry
 * node. A user can repair it entirely through the Graph Inspector by choosing
 * the visible `第一章 / 出口` target; no source editor or test bridge is needed.
 */
export function makeGraphFirstDiagnosticStory(): string {
  return [
    '---',
    'plotflow: 0.2',
    'title: "Graph First Native Journey"',
    'author: "Blackbox QA"',
    'engine: generic',
    'vars:',
    '  trust:',
    '    type: int',
    '    default: 1',
    '    scope: global',
    '---',
    '',
    '# 第一章',
    '',
    '## 节点：入口',
    '',
    '这段正文将通过 Graph Inspector 修改。',
    '',
    '[选项] 前往出口 -> 节点：缺失目标',
    '',
    '## 节点：出口',
    '',
    '这是严格黑盒旅程的出口节点。',
    '',
  ].join('\n');
}

export async function writeStory(path: string, nodeCount: number, title?: string): Promise<string> {
  const content = makeStory(nodeCount, title);
  await writeFile(path, content, 'utf-8');
  return content;
}

export async function writeGraphFirstDiagnosticStory(path: string): Promise<string> {
  const content = makeGraphFirstDiagnosticStory();
  await writeFile(path, content, 'utf-8');
  return content;
}

export async function writeRaw(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf-8');
}

export function sha256(bytes: Buffer | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function copyRemoteThemeZip(targetDir: string): Promise<string> {
  const source = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'website',
    'public',
    'themes',
    'plotflow-neon-dossier',
    'plotflow-neon-dossier-1.0.0.pf-official-theme.zip',
  );
  const target = join(targetDir, 'plotflow-neon-dossier-1.0.0.pf-official-theme.zip');
  await cp(source, target);
  return target;
}
