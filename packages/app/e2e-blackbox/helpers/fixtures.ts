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

export async function writeStory(path: string, nodeCount: number, title?: string): Promise<string> {
  const content = makeStory(nodeCount, title);
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
