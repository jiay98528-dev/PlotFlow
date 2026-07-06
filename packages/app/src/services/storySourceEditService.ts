import {
  analyzeStorySource,
  normalizeStorySource,
  restoreStoryNewline,
  type GraphPosition,
  type StoryNode,
  type Option,
} from '@plotflow/core';
import { useEditorStore } from '../stores/editorStore';
import { useStoryStore } from '../stores/storyStore';
import { parsePipelineNow } from './parsePipeline';

export interface GraphEditResult {
  readonly content: string;
  readonly changed: boolean;
}

export interface TextEditRange {
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface TextEdit {
  readonly range: TextEditRange;
  readonly text: string;
}

export interface StorySourceEditResult extends GraphEditResult {
  readonly edits: readonly TextEdit[];
}

export interface GraphLayoutPatch {
  readonly id: string;
  readonly position: GraphPosition;
}

export interface OptionPatch {
  readonly description?: string;
  readonly targetNodeId?: string | null;
  readonly conditionRaw?: string | null;
  readonly effectsRaw?: string | null;
}

export interface NodePatch {
  readonly title?: string;
  readonly chapterTitle?: string;
  readonly body?: string;
}

export interface VariablePatch {
  readonly name: string;
  readonly type: string;
  readonly defaultValue?: string;
  readonly description?: string;
}

const DEFAULT_CHAPTER_TITLE = '第一章';
const DEFAULT_NODE_TITLE = '新节点';
const DEFAULT_BODY = '在这里写下剧情正文。';
const DEFAULT_OPTION = '继续';
const CONDITION_LABEL = '\u6761\u4ef6';
const EFFECTS_LABEL = '\u6548\u679c';
const NEXT_LABEL = '\u4e0b\u4e00\u6b65';
const NODE_LABEL = '\u8282\u70b9';

function normalizeText(value: string): string {
  return normalizeStorySource(value);
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function linesOf(content: string): string[] {
  return normalizeText(content).split('\n');
}

function isChapterLine(line: string): boolean {
  return /^#\s+.+/.test(line) && !/^##\s+/.test(line);
}

function isNodeLine(line: string): boolean {
  return /^##\s+节点[：:].*/.test(line);
}

function findNodeEndLineIndex(lines: readonly string[], titleLineIndex: number): number {
  let index = titleLineIndex + 1;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (isNodeLine(line) || isChapterLine(line)) break;
    index++;
  }
  return index;
}

function findChapterLineIndex(lines: readonly string[], chapterTitle: string): number {
  return lines.findIndex((line) => isChapterLine(line) && line.replace(/^#\s+/, '').trim() === chapterTitle.trim());
}

function findChapterEndLineIndex(lines: readonly string[], chapterLineIndex: number): number {
  let index = chapterLineIndex + 1;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (isChapterLine(line)) break;
    index++;
  }
  return index;
}

function getNodeRange(content: string, node: StoryNode): { start: number; end: number; lines: string[] } {
  const lines = linesOf(content);
  const start = Math.max(0, node.lineNumber - 1);
  return { start, end: findNodeEndLineIndex(lines, start), lines };
}

function parseOptionLine(line: string): {
  readonly prefix: string;
  readonly description: string;
  readonly targetNodeId: string | null;
  readonly conditionRaw: string | null;
  readonly effectsRaw: string | null;
} | null {
  const match = line.match(/^(\s*\[选项\]\s*)(.*)$/);
  if (!match) return null;

  let rest = match[2] ?? '';
  let effectsRaw: string | null = null;
  const effectsMatch = rest.match(/\s*\[效果[：:]\s*([^\]]*)\]\s*$/);
  if (effectsMatch) {
    effectsRaw = effectsMatch[1]?.trim() ?? '';
    rest = rest.slice(0, effectsMatch.index).trimEnd();
  }

  let conditionRaw: string | null = null;
  const conditionMatch = rest.match(/\s*\[条件[：:]\s*([^\]]*)\]\s*$/);
  if (conditionMatch) {
    conditionRaw = conditionMatch[1]?.trim() ?? '';
    rest = rest.slice(0, conditionMatch.index).trimEnd();
  }

  let targetNodeId: string | null = null;
  const targetMatch = rest.match(/\s*->\s*节点[：:]\s*(.+)\s*$/);
  if (targetMatch) {
    targetNodeId = targetMatch[1]?.trim() ?? null;
    rest = rest.slice(0, targetMatch.index).trimEnd();
  }

  return {
    prefix: match[1] ?? '[选项] ',
    description: rest.trim(),
    targetNodeId,
    conditionRaw,
    effectsRaw,
  };
}

function findOptionLineIndex(lines: readonly string[], option: Option): number {
  const hintIndex = option.lineNumber - 1;
  const hinted = lines[hintIndex] ?? '';
  const hintedParsed = parseOptionLine(hinted);
  if (
    hintedParsed &&
    hintedParsed.description === option.description &&
    (hintedParsed.targetNodeId ?? null) === (option.targetNodeId ?? null)
  ) {
    return hintIndex;
  }

  const candidates: Array<{ readonly index: number; readonly distance: number }> = [];
  lines.forEach((line, index) => {
    const parsed = parseOptionLine(line);
    if (!parsed) return;
    if (
      parsed.description === option.description &&
      (parsed.targetNodeId ?? null) === (option.targetNodeId ?? null)
    ) {
      candidates.push({ index, distance: Math.abs(index - hintIndex) });
    }
  });

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.index ?? -1;
}

function findOptionBlockEndLineIndex(lines: readonly string[], optionLineIndex: number): number {
  let index = optionLineIndex + 1;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (parseOptionLine(line) || isNodeLine(line) || isChapterLine(line)) break;
    index++;
  }
  return index;
}

function isNextTargetLine(line: string): boolean {
  return new RegExp(`^\\s*${NEXT_LABEL}[：:]`).test(line);
}

function findNodeNextTargetLineIndex(lines: readonly string[], node: StoryNode): number {
  const hinted = (node.nextTarget?.lineNumber ?? 0) - 1;
  if (hinted >= 0 && hinted < lines.length && isNextTargetLine(lines[hinted] ?? '')) {
    return hinted;
  }

  const { start, end } = getNodeRange(lines.join('\n'), node);
  for (let index = start + 1; index < end; index++) {
    if (isNextTargetLine(lines[index] ?? '')) return index;
  }
  return -1;
}

function findNextTargetBlockEndLineIndex(lines: readonly string[], nextLineIndex: number): number {
  const nextLine = lines[nextLineIndex + 1] ?? '';
  return new RegExp(`^\\s+${EFFECTS_LABEL}[：:]`).test(nextLine) ? nextLineIndex + 2 : nextLineIndex + 1;
}

function serializeNextTargetBlock(targetNodeId: string, effectsRaw: string | null): string[] {
  const lines = [`${NEXT_LABEL}: ${NODE_LABEL}：${targetNodeId.trim()}`];
  if (effectsRaw?.trim()) {
    lines.push(`  ${EFFECTS_LABEL}: ${effectsRaw.trim()}`);
  }
  return lines;
}

function serializeOptionLine(option: {
  readonly prefix?: string;
  readonly description: string;
  readonly targetNodeId: string | null;
  readonly conditionRaw: string | null;
  readonly effectsRaw: string | null;
}): string {
  let line = `${option.prefix ?? '[选项] '}${option.description.trim() || DEFAULT_OPTION}`;
  if (option.targetNodeId && option.targetNodeId.trim()) {
    line += ` -> 节点：${option.targetNodeId.trim()}`;
  }
  return line;
}

function serializeOptionBlock(option: {
  readonly prefix?: string;
  readonly description: string;
  readonly targetNodeId: string | null;
  readonly conditionRaw: string | null;
  readonly effectsRaw: string | null;
}): string[] {
  const lines = [serializeOptionLine(option)];
  if (option.conditionRaw && option.conditionRaw.trim()) {
    lines.push(`  ${CONDITION_LABEL}: ${option.conditionRaw.trim()}`);
  }
  if (option.effectsRaw && option.effectsRaw.trim()) {
    lines.push(`  ${EFFECTS_LABEL}: ${option.effectsRaw.trim()}`);
  }
  return lines;
}

function optionToBlock(option: Option): string[] {
  return serializeOptionBlock({
    description: option.description,
    targetNodeId: option.targetNodeId,
    conditionRaw: option.conditionRaw,
    effectsRaw: option.effectsRaw,
  });
}

function patchResult(before: string, after: string): GraphEditResult {
  const content = restoreStoryNewline(before, after);
  return { content, changed: before !== content };
}

function uniqueNodeTitle(content: string, desiredTitle: string): string {
  const lines = linesOf(content);
  const existing = new Set<string>();
  for (const line of lines) {
    if (!isNodeLine(line)) continue;
    existing.add(line.replace(/^##\s+节点[：:]\s*/, '').trim());
  }
  const base = desiredTitle.trim() || DEFAULT_NODE_TITLE;
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base} ${index}`)) index++;
  return `${base} ${index}`;
}

function fullIdFor(chapterId: string, nodeId: string): string {
  return chapterId === '_anonymous' ? nodeId : `${chapterId}-${nodeId}`;
}

function roundPosition(position: GraphPosition): GraphPosition {
  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
}

function getFrontmatterRange(lines: readonly string[]): { start: number; end: number } | null {
  const source = analyzeStorySource(lines.join('\n'));
  if (!source.frontmatter) return null;
  return {
    start: source.frontmatter.startLine - 1,
    end: source.frontmatter.endLine - 1,
  };
}

function isTopLevelFrontmatterKey(line: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(line);
}

function findTopLevelBlockRange(
  lines: readonly string[],
  frontmatter: { readonly start: number; readonly end: number },
  key: string,
): { start: number; end: number } | null {
  const keyRe = new RegExp(`^${key}\\s*:`);
  let start = -1;
  for (let index = frontmatter.start + 1; index < frontmatter.end; index++) {
    if (keyRe.test(lines[index] ?? '')) {
      start = index;
      break;
    }
  }
  if (start < 0) return null;

  let end = frontmatter.end;
  for (let index = start + 1; index < frontmatter.end; index++) {
    const line = lines[index] ?? '';
    if (line.trim() !== '' && isTopLevelFrontmatterKey(line)) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function unquoteYamlString(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
  }
  return trimmed;
}

function readExistingLayoutNodes(content: string): GraphLayoutPatch[] {
  const lines = linesOf(content);
  const frontmatter = getFrontmatterRange(lines);
  if (!frontmatter) return [];
  const layout = findTopLevelBlockRange(lines, frontmatter, 'layout');
  if (!layout) return [];

  const nodes: GraphLayoutPatch[] = [];
  let current: { id?: string; x?: number; y?: number } | null = null;

  const flush = (): void => {
    if (current?.id && Number.isFinite(current.x) && Number.isFinite(current.y)) {
      nodes.push({ id: current.id, position: { x: current.x!, y: current.y! } });
    }
  };

  for (let index = layout.start + 1; index < layout.end; index++) {
    const line = lines[index] ?? '';
    const idMatch = line.match(/^\s*-\s+id:\s*(.+)$/);
    if (idMatch) {
      flush();
      current = { id: unquoteYamlString(idMatch[1] ?? '') };
      continue;
    }

    if (!current) continue;
    const xMatch = line.match(/^\s*x:\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (xMatch) {
      current.x = Number(xMatch[1]);
      continue;
    }
    const yMatch = line.match(/^\s*y:\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (yMatch) {
      current.y = Number(yMatch[1]);
    }
  }
  flush();
  return nodes;
}

function serializeLayoutBlock(nodes: readonly GraphLayoutPatch[]): string[] {
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id, 'zh-Hans-CN'));
  return [
    'layout:',
    '  graph:',
    '    version: 1',
    '    nodes:',
    ...sorted.flatMap((node) => {
      const position = roundPosition(node.position);
      return [
        `      - id: ${JSON.stringify(node.id)}`,
        `        x: ${position.x}`,
        `        y: ${position.y}`,
      ];
    }),
  ];
}

function setGraphLayoutNodesText(
  content: string,
  nextNodes: readonly GraphLayoutPatch[],
): GraphEditResult {
  const normalized = normalizeText(content);
  const nodes = nextNodes.filter((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y));

  if (nodes.length === 0) {
    const lines = linesOf(normalized);
    const frontmatter = getFrontmatterRange(lines);
    if (!frontmatter) return { content, changed: false };
    const layout = findTopLevelBlockRange(lines, frontmatter, 'layout');
    if (!layout) return { content, changed: false };
    lines.splice(layout.start, layout.end - layout.start);
    return patchResult(content, lines.join('\n'));
  }

  const layoutBlock = serializeLayoutBlock(nodes);
  const lines = linesOf(normalized);
  const frontmatter = getFrontmatterRange(lines);
  if (!frontmatter) {
    const next = [
      '---',
      'plotflow: 0.1',
      ...layoutBlock,
      '---',
      '',
      normalized.trimStart(),
    ].join('\n');
    return patchResult(content, next);
  }

  const existingLayout = findTopLevelBlockRange(lines, frontmatter, 'layout');
  if (existingLayout) {
    lines.splice(existingLayout.start, existingLayout.end - existingLayout.start, ...layoutBlock);
    return patchResult(content, lines.join('\n'));
  }

  const varsIndex = lines.findIndex((line, index) => (
    index > frontmatter.start &&
    index < frontmatter.end &&
    /^vars\s*:/.test(line)
  ));
  const insertIndex = varsIndex >= 0 ? varsIndex : frontmatter.end;
  lines.splice(insertIndex, 0, ...layoutBlock);
  return patchResult(content, lines.join('\n'));
}

export function upsertGraphLayoutText(
  content: string,
  patches: readonly GraphLayoutPatch[],
): GraphEditResult {
  const normalized = normalizeText(content);
  const byId = new Map(readExistingLayoutNodes(normalized).map((node) => [node.id, node]));
  for (const patch of patches) {
    byId.set(patch.id, { id: patch.id, position: roundPosition(patch.position) });
  }
  return setGraphLayoutNodesText(content, [...byId.values()]);
}

export function removeGraphLayoutNodesText(
  content: string,
  ids: readonly string[],
): GraphEditResult {
  const normalized = normalizeText(content);
  const removeIds = new Set(ids);
  const next = readExistingLayoutNodes(normalized).filter((node) => !removeIds.has(node.id));
  return setGraphLayoutNodesText(content, next);
}

export function migrateGraphLayoutNodeText(
  content: string,
  fromId: string,
  toId: string,
): GraphEditResult {
  const normalized = normalizeText(content);
  if (fromId === toId) return { content, changed: false };
  const nodes = readExistingLayoutNodes(normalized);
  let changed = false;
  const next = nodes.flatMap((node): GraphLayoutPatch[] => {
    if (node.id === fromId) {
      changed = true;
      return [{ id: toId, position: node.position }];
    }
    if (node.id === toId) {
      changed = true;
      return [];
    }
    return [node];
  });
  return changed ? setGraphLayoutNodesText(content, next) : { content, changed: false };
}

export function createChapterText(
  content: string,
  chapterTitle = DEFAULT_CHAPTER_TITLE,
): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  if (findChapterLineIndex(lines, chapterTitle) >= 0) {
    return { content, changed: false };
  }

  const prefix = normalized.trim().length > 0 ? '\n\n' : '';
  return patchResult(content, `${ensureTrailingNewline(normalized).trimEnd()}${prefix}# ${chapterTitle.trim() || DEFAULT_CHAPTER_TITLE}\n`);
}

export function createNodeText(
  content: string,
  params: {
    readonly chapterTitle?: string;
    readonly title?: string;
    readonly body?: string;
    readonly isEnding?: boolean;
  } = {},
): GraphEditResult {
  const normalized = normalizeText(content);
  const title = uniqueNodeTitle(normalized, params.title ?? (params.isEnding ? '结局' : DEFAULT_NODE_TITLE));
  const body = params.body?.trim() ?? (params.isEnding ? '故事在这里结束。' : DEFAULT_BODY);
  const nodeBlock = `## 节点：${title}\n\n${body}\n`;
  const chapterTitle = params.chapterTitle?.trim();

  if (!chapterTitle) {
    const prefix = normalized.trim().length > 0 ? '\n\n' : '';
    return patchResult(content, `${normalized.trimEnd()}${prefix}${nodeBlock}`);
  }

  let next = normalized;
  let lines = linesOf(next);
  let chapterLineIndex = findChapterLineIndex(lines, chapterTitle);
  if (chapterLineIndex < 0) {
    next = createChapterText(next, chapterTitle).content;
    lines = linesOf(next);
    chapterLineIndex = findChapterLineIndex(lines, chapterTitle);
  }

  if (chapterLineIndex < 0) {
    const prefix = next.trim().length > 0 ? '\n\n' : '';
    return patchResult(content, `${next.trimEnd()}${prefix}# ${chapterTitle}\n\n${nodeBlock}`);
  }

  const insertIndex = findChapterEndLineIndex(lines, chapterLineIndex);
  lines.splice(insertIndex, 0, '', nodeBlock.trimEnd());
  return patchResult(content, lines.join('\n').replace(/\n{4,}/g, '\n\n\n'));
}

export function deleteNodeText(content: string, node: StoryNode): GraphEditResult {
  const normalized = normalizeText(content);
  const { lines, start, end } = getNodeRange(normalized, node);
  lines.splice(start, end - start);
  const withoutNode = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  const nodeRemoval = patchResult(content, withoutNode);
  const layoutRemoval = removeGraphLayoutNodesText(nodeRemoval.content, [node.fullId]);
  return {
    content: layoutRemoval.content,
    changed: nodeRemoval.changed || layoutRemoval.changed,
  };
}

export function updateNodeText(content: string, node: StoryNode, patch: NodePatch): GraphEditResult {
  const normalized = normalizeText(content);
  let next = normalized;
  const oldFullId = node.fullId;
  let nextChapterId = node.chapterId;
  let nextNodeId = node.id;

  if (patch.title !== undefined && patch.title.trim()) {
    const { lines, start } = getNodeRange(next, node);
    nextNodeId = patch.title.trim();
    lines[start] = `## 节点：${nextNodeId}`;
    next = lines.join('\n');
  }

  if (patch.body !== undefined) {
    const freshNode = patch.title && patch.title !== node.title
      ? { ...node, title: patch.title.trim() }
      : node;
    const { lines, start, end } = getNodeRange(next, freshNode);
    const existingOptions = node.options.flatMap(optionToBlock);
    const titleLine = lines[start] ?? `## 节点：${freshNode.title}`;
    const bodyLines = patch.body.trim().length > 0 ? patch.body.trim().split('\n') : [''];
    lines.splice(start, end - start, titleLine, '', ...bodyLines, '', ...existingOptions);
    next = lines.join('\n');
  }

  if (patch.chapterTitle !== undefined && patch.chapterTitle.trim() && patch.chapterTitle.trim() !== node.chapterId) {
    nextChapterId = patch.chapterTitle.trim();
    next = moveNodeToChapterText(next, node, nextChapterId).content;
  }

  const newFullId = fullIdFor(nextChapterId, nextNodeId);
  if (newFullId !== oldFullId) {
    next = migrateGraphLayoutNodeText(next, oldFullId, newFullId).content;
  }

  if (nextNodeId !== node.id) {
    next = replaceOptionTargetReferencesText(next, node.id, nextNodeId).content;
  }

  return patchResult(content, next);
}

export function moveNodeToChapterText(content: string, node: StoryNode, chapterTitle: string): GraphEditResult {
  const normalized = normalizeText(content);
  const { lines, start, end } = getNodeRange(normalized, node);
  const nodeBlock = lines.slice(start, end);
  lines.splice(start, end - start);
  let next = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  const chapterResult = createChapterText(next, chapterTitle);
  next = chapterResult.content;
  const nextLines = linesOf(next);
  const chapterLineIndex = findChapterLineIndex(nextLines, chapterTitle);
  const insertIndex = chapterLineIndex >= 0 ? findChapterEndLineIndex(nextLines, chapterLineIndex) : nextLines.length;
  nextLines.splice(insertIndex, 0, '', ...nodeBlock);
  return patchResult(content, nextLines.join('\n').replace(/\n{4,}/g, '\n\n\n'));
}

export function addOptionText(
  content: string,
  node: StoryNode,
  patch: OptionPatch = {},
): GraphEditResult {
  const normalized = normalizeText(content);
  const { lines, end } = getNodeRange(normalized, node);
  const block = serializeOptionBlock({
    description: patch.description ?? DEFAULT_OPTION,
    targetNodeId: patch.targetNodeId ?? null,
    conditionRaw: patch.conditionRaw ?? null,
    effectsRaw: patch.effectsRaw ?? null,
  });
  lines.splice(end, 0, ...block);
  return patchResult(content, lines.join('\n'));
}

export function updateOptionText(
  content: string,
  option: Option,
  patch: OptionPatch,
): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  const index = findOptionLineIndex(lines, option);
  if (index < 0 || index >= lines.length) return { content, changed: false };
  const parsed = parseOptionLine(lines[index] ?? '');
  const block = serializeOptionBlock({
    prefix: parsed?.prefix,
    description: patch.description ?? parsed?.description ?? option.description,
    targetNodeId: patch.targetNodeId !== undefined ? patch.targetNodeId : parsed?.targetNodeId ?? option.targetNodeId,
    conditionRaw: patch.conditionRaw !== undefined ? patch.conditionRaw : parsed?.conditionRaw ?? option.conditionRaw,
    effectsRaw: patch.effectsRaw !== undefined ? patch.effectsRaw : parsed?.effectsRaw ?? option.effectsRaw,
  });
  const end = findOptionBlockEndLineIndex(lines, index);
  lines.splice(index, end - index, ...block);
  return patchResult(content, lines.join('\n'));
}

export function updateNodeNextTargetText(
  content: string,
  node: StoryNode,
  targetNodeId: string | null,
  effectsRaw = node.nextTarget?.effectsRaw ?? null,
): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  const { start, end } = getNodeRange(normalized, node);
  const existingIndex = findNodeNextTargetLineIndex(lines, node);

  if (targetNodeId === null) {
    if (existingIndex < 0) return { content, changed: false };
    const blockEnd = findNextTargetBlockEndLineIndex(lines, existingIndex);
    lines.splice(existingIndex, blockEnd - existingIndex);
    return patchResult(content, lines.join('\n').replace(/\n{3,}/g, '\n\n'));
  }

  const block = serializeNextTargetBlock(targetNodeId, effectsRaw);
  if (existingIndex >= 0) {
    const blockEnd = findNextTargetBlockEndLineIndex(lines, existingIndex);
    lines.splice(existingIndex, blockEnd - existingIndex, ...block);
    return patchResult(content, lines.join('\n'));
  }

  const firstOptionIndex = node.options[0] ? findOptionLineIndex(lines, node.options[0]) : -1;
  const insertIndex = firstOptionIndex >= start && firstOptionIndex < end ? firstOptionIndex : end;
  const needsBlankBefore = insertIndex > start + 1 && (lines[insertIndex - 1] ?? '').trim() !== '';
  const insertLines = needsBlankBefore ? ['', ...block] : block;
  lines.splice(insertIndex, 0, ...insertLines);
  return patchResult(content, lines.join('\n'));
}

function replaceOptionTargetReferencesText(
  content: string,
  fromTargetNodeId: string,
  toTargetNodeId: string,
): GraphEditResult {
  const normalized = normalizeText(content);
  const fromTarget = fromTargetNodeId.trim();
  const toTarget = toTargetNodeId.trim();
  if (!fromTarget || !toTarget || fromTarget === toTarget) {
    return { content, changed: false };
  }

  const lines = linesOf(normalized);
  let changed = false;

  lines.forEach((line, index) => {
    const parsed = parseOptionLine(line);
    if (!parsed || parsed.targetNodeId !== fromTarget) return;

    lines[index] = serializeOptionLine({
      prefix: parsed.prefix,
      description: parsed.description,
      targetNodeId: toTarget,
      conditionRaw: parsed.conditionRaw,
      effectsRaw: parsed.effectsRaw,
    });
    changed = true;
  });

  return changed ? patchResult(content, lines.join('\n')) : { content, changed: false };
}

export function deleteOptionText(content: string, option: Option): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  const index = findOptionLineIndex(lines, option);
  if (index < 0 || index >= lines.length) return { content, changed: false };
  const end = findOptionBlockEndLineIndex(lines, index);
  lines.splice(index, end - index);
  return patchResult(content, lines.join('\n'));
}

export function reorderOptionText(
  content: string,
  node: StoryNode,
  fromIndex: number,
  toIndex: number,
): GraphEditResult {
  const normalized = normalizeText(content);
  if (fromIndex === toIndex) return { content, changed: false };
  const options = [...node.options];
  const [moved] = options.splice(fromIndex, 1);
  if (!moved) return { content, changed: false };
  options.splice(Math.max(0, Math.min(toIndex, options.length)), 0, moved);

  const { lines, end } = getNodeRange(normalized, node);

  const firstOptionIndex = findOptionLineIndex(lines, node.options[0]!);
  const lastOption = node.options[node.options.length - 1];
  if (firstOptionIndex < 0 || !lastOption) return { content, changed: false };
  const lastOptionIndex = findOptionLineIndex(lines, lastOption);
  const replaceEnd = lastOptionIndex >= 0 ? findOptionBlockEndLineIndex(lines, lastOptionIndex) : end;
  const reorderedBlocks = options.flatMap((option) => optionToBlock(option));
  lines.splice(firstOptionIndex, replaceEnd - firstOptionIndex, ...reorderedBlocks);
  return patchResult(content, lines.join('\n'));
}

export function createNodeAndConnectText(
  content: string,
  node: StoryNode,
  option: Option,
  targetTitle = DEFAULT_NODE_TITLE,
  targetPosition?: GraphPosition,
): GraphEditResult {
  const normalized = normalizeText(content);
  const targetNodeId = uniqueNodeTitle(normalized, targetTitle);
  const created = createNodeText(normalized, { chapterTitle: node.chapterId, title: targetTitle });
  let next = updateOptionText(created.content, option, { targetNodeId }).content;
  if (targetPosition) {
    next = upsertGraphLayoutText(next, [{
      id: fullIdFor(node.chapterId, targetNodeId),
      position: targetPosition,
    }]).content;
  }
  return patchResult(content, next);
}

export function createNodeAndConnectNextText(
  content: string,
  node: StoryNode,
  targetTitle = DEFAULT_NODE_TITLE,
  targetPosition?: GraphPosition,
): GraphEditResult {
  const normalized = normalizeText(content);
  const targetNodeId = uniqueNodeTitle(normalized, targetTitle);
  const created = createNodeText(normalized, { chapterTitle: node.chapterId, title: targetNodeId });
  let next = updateNodeNextTargetText(created.content, node, targetNodeId).content;
  if (targetPosition) {
    next = upsertGraphLayoutText(next, [{
      id: fullIdFor(node.chapterId, targetNodeId),
      position: targetPosition,
    }]).content;
  }
  return patchResult(content, next);
}

export function updateNodePositionText(
  content: string,
  node: StoryNode,
  position: GraphPosition,
): GraphEditResult {
  return upsertGraphLayoutText(content, [{ id: node.fullId, position }]);
}

export function updateMetaText(content: string, field: 'title' | 'author', value: string): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  let inFrontmatter = false;
  let frontmatterEnd = -1;

  if ((lines[0] ?? '').trim() === '---') {
    inFrontmatter = true;
    for (let index = 1; index < lines.length; index++) {
      if ((lines[index] ?? '').trim() === '---') {
        frontmatterEnd = index;
        break;
      }
    }
  }

  if (!inFrontmatter || frontmatterEnd < 0) {
    const next = `---\nplotflow: 0.1\n${field}: ${value.trim()}\n---\n\n${normalized.trimStart()}`;
    return patchResult(content, next);
  }

  const fieldIndex = lines.findIndex((line, index) => index > 0 && index < frontmatterEnd && line.startsWith(`${field}:`));
  if (fieldIndex >= 0) {
    lines[fieldIndex] = `${field}: ${value.trim()}`;
  } else {
    lines.splice(frontmatterEnd, 0, `${field}: ${value.trim()}`);
  }
  return patchResult(content, lines.join('\n'));
}

export function upsertVariableText(content: string, variable: VariablePatch): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  const variableName = variable.name.trim().replace(/^\$/, '');
  const entry = `  ${variableName}: ${variable.type.trim() || 'int'}`;

  let frontmatterEnd = -1;
  if ((lines[0] ?? '').trim() === '---') {
    for (let index = 1; index < lines.length; index++) {
      if ((lines[index] ?? '').trim() === '---') {
        frontmatterEnd = index;
        break;
      }
    }
  }

  if (frontmatterEnd < 0) {
    return patchResult(content, `---\nplotflow: 0.1\nvars:\n${entry}\n---\n\n${normalized.trimStart()}`);
  }

  const variablesIndex = lines.findIndex((line, index) => index > 0 && index < frontmatterEnd && line.trim() === 'vars:');
  if (variablesIndex < 0) {
    lines.splice(frontmatterEnd, 0, 'vars:', entry);
    return patchResult(content, lines.join('\n'));
  }

  const existingIndex = lines.findIndex(
    (line, index) => index > variablesIndex && index < frontmatterEnd && line.trim().startsWith(`${variableName}:`),
  );
  if (existingIndex >= 0) {
    lines[existingIndex] = entry;
  } else {
    lines.splice(variablesIndex + 1, 0, entry);
  }
  return patchResult(content, lines.join('\n'));
}

export function deleteVariableText(content: string, variableName: string): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  const frontmatterEnd = (() => {
    if ((lines[0] ?? '').trim() !== '---') return -1;
    for (let index = 1; index < lines.length; index++) {
      if ((lines[index] ?? '').trim() === '---') return index;
    }
    return -1;
  })();
  if (frontmatterEnd < 0) return { content, changed: false };

  const targetIndex = lines.findIndex((line, index) => (
    index > 0 &&
    index < frontmatterEnd &&
    new RegExp(`^\\s{2}${variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(line)
  ));
  if (targetIndex < 0) return { content, changed: false };

  const baseIndent = (lines[targetIndex]!.match(/^(\s*)/)?.[1] ?? '').length;
  let deleteEnd = targetIndex + 1;
  while (deleteEnd < frontmatterEnd) {
    const line = lines[deleteEnd] ?? '';
    if (line.trim() === '') {
      deleteEnd++;
      continue;
    }
    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    if (indent <= baseIndent) break;
    deleteEnd++;
  }

  lines.splice(targetIndex, deleteEnd - targetIndex);
  return patchResult(content, lines.join('\n'));
}

function createTextEdits(before: string, after: string): TextEdit[] {
  if (before === after) return [];

  let prefixLength = 0;
  const minLength = Math.min(before.length, after.length);
  while (prefixLength < minLength && before[prefixLength] === after[prefixLength]) {
    prefixLength++;
  }

  let beforeSuffix = before.length;
  let afterSuffix = after.length;
  while (
    beforeSuffix > prefixLength &&
    afterSuffix > prefixLength &&
    before[beforeSuffix - 1] === after[afterSuffix - 1]
  ) {
    beforeSuffix--;
    afterSuffix--;
  }

  return [{
    range: {
      startOffset: prefixLength,
      endOffset: beforeSuffix,
    },
    text: after.slice(prefixLength, afterSuffix),
  }];
}

function normalizeEdits(edits: readonly TextEdit[]): TextEdit[] {
  return [...edits]
    .filter((edit) => edit.range.startOffset !== edit.range.endOffset || edit.text.length > 0)
    .sort((a, b) => a.range.startOffset - b.range.startOffset);
}

export const StorySourceEditService = {
  createResult(before: string, after: string): StorySourceEditResult {
    const edits = createTextEdits(before, after);
    return {
      content: after,
      changed: before !== after,
      edits,
    };
  },

  applyTextEdits(content: string, edits: readonly TextEdit[]): string {
    const ordered = normalizeEdits(edits);
    let cursor = content.length;
    let next = '';
    for (let index = ordered.length - 1; index >= 0; index--) {
      const edit = ordered[index]!;
      if (
        edit.range.startOffset < 0 ||
        edit.range.endOffset < edit.range.startOffset ||
        edit.range.endOffset > content.length ||
        edit.range.endOffset > cursor
      ) {
        throw new Error('Invalid overlapping source text edit');
      }
      next = content.slice(edit.range.endOffset, cursor) + next;
      next = edit.text + next;
      cursor = edit.range.startOffset;
    }
    return content.slice(0, cursor) + next;
  },

  commit(nextContent: string, source = 'story-source-edit-service', edits?: readonly TextEdit[]): void {
    applyGraphEdit(nextContent, source, edits);
  },
};

export function applyGraphEdit(nextContent: string, source = 'graph-edit-service', edits?: readonly TextEdit[]): void {
  const editor = useEditorStore.getState().editorInstance;
  if (editor) {
    const model = editor.getModel();
    if (model) {
      const textEdits = normalizeEdits(edits ?? createTextEdits(model.getValue(), nextContent));
      editor.pushUndoStop();
      editor.executeEdits(source, textEdits.map((edit) => {
        const start = model.getPositionAt(edit.range.startOffset);
        const end = model.getPositionAt(edit.range.endOffset);
        return {
          range: {
            startLineNumber: start.lineNumber,
            startColumn: start.column,
            endLineNumber: end.lineNumber,
            endColumn: end.column,
          },
          text: edit.text,
        };
      }));
      editor.pushUndoStop();
      const committedContent = editor.getValue();
      useEditorStore.getState().setContent(committedContent);
      parsePipelineNow(committedContent);
      return;
    }
  }

  useEditorStore.getState().setContent(nextContent);
  parsePipelineNow(nextContent);
}

function commit(result: GraphEditResult, source: string): boolean {
  if (!result.changed) return false;
  StorySourceEditService.commit(result.content, source);
  return true;
}

function currentContent(): string {
  const editor = useEditorStore.getState().editorInstance;
  return editor?.getValue() ?? useEditorStore.getState().content;
}

function selectedNode(): StoryNode | undefined {
  const graphState = useStoryStore.getState();
  const selectedId = useEditorStore.getState().activeNodeId;
  if (selectedId) return graphState.getNodeByFullId(selectedId);
  return undefined;
}

export const graphEditService = {
  createChapter(chapterTitle = DEFAULT_CHAPTER_TITLE): boolean {
    return commit(createChapterText(currentContent(), chapterTitle), 'graph-lab-create-chapter');
  },

  createNode(params?: Parameters<typeof createNodeText>[1]): boolean {
    return commit(createNodeText(currentContent(), params), 'graph-lab-create-node');
  },

  deleteNode(node: StoryNode): boolean {
    return commit(deleteNodeText(currentContent(), node), 'graph-lab-delete-node');
  },

  updateNode(node: StoryNode, patch: NodePatch): boolean {
    return commit(updateNodeText(currentContent(), node, patch), 'graph-lab-update-node');
  },

  addOption(node: StoryNode, patch?: OptionPatch): boolean {
    return commit(addOptionText(currentContent(), node, patch), 'graph-lab-add-option');
  },

  updateOption(option: Option, patch: OptionPatch): boolean {
    return commit(updateOptionText(currentContent(), option, patch), 'graph-lab-update-option');
  },

  deleteOption(option: Option): boolean {
    return commit(deleteOptionText(currentContent(), option), 'graph-lab-delete-option');
  },

  reorderOption(node: StoryNode, fromIndex: number, toIndex: number): boolean {
    return commit(reorderOptionText(currentContent(), node, fromIndex, toIndex), 'graph-lab-reorder-option');
  },

  connectOption(option: Option, targetNodeId: string | null): boolean {
    return commit(updateOptionText(currentContent(), option, { targetNodeId }), 'graph-lab-connect-option');
  },

  connectNextTarget(node: StoryNode, targetNodeId: string | null): boolean {
    return commit(updateNodeNextTargetText(currentContent(), node, targetNodeId), 'graph-lab-connect-next-target');
  },

  createNodeAndConnect(
    node: StoryNode,
    option: Option,
    targetTitle = DEFAULT_NODE_TITLE,
    targetPosition?: GraphPosition,
  ): boolean {
    return commit(createNodeAndConnectText(currentContent(), node, option, targetTitle, targetPosition), 'graph-lab-create-node-and-connect');
  },

  createNodeAndConnectNext(
    node: StoryNode,
    targetTitle = DEFAULT_NODE_TITLE,
    targetPosition?: GraphPosition,
  ): boolean {
    return commit(createNodeAndConnectNextText(currentContent(), node, targetTitle, targetPosition), 'graph-lab-create-node-and-connect-next');
  },

  updateNodePosition(node: StoryNode, position: GraphPosition): boolean {
    return commit(updateNodePositionText(currentContent(), node, position), 'graph-lab-update-node-position');
  },

  updateMeta(field: 'title' | 'author', value: string): boolean {
    return commit(updateMetaText(currentContent(), field, value), 'graph-lab-update-meta');
  },

  upsertVariable(variable: VariablePatch): boolean {
    return commit(upsertVariableText(currentContent(), variable), 'graph-lab-upsert-variable');
  },

  deleteVariable(variableName: string): boolean {
    return commit(deleteVariableText(currentContent(), variableName), 'graph-lab-delete-variable');
  },

  updateSelectedNode(patch: NodePatch): boolean {
    const node = selectedNode();
    if (!node) return false;
    return graphEditService.updateNode(node, patch);
  },
};
