import {
  analyzeStorySource,
  createFullId,
  legacyFullId,
  normalizeStorySource,
  parseStory,
  restoreStoryNewline,
  type GraphPosition,
  type StoryNode,
  type Option,
  type VariableDeclaration,
  type VariableScope,
  type VariableType,
  type VariableValue,
} from '@plotflow/core';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useStoryStore } from '../stores/storyStore';
import { useUIStore } from '../stores/uiStore';
import { parsePipelineNow } from './parsePipeline';
import { debouncedSave } from './autoSaveService';
import { flushSourceDraftBeforeSaveOrReplace } from './sourceDraftCoordinator';
import {
  configureGraphHistoryReplay,
  recordGraphEdit,
} from './graphHistoryService';

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

interface GraphEditHistoryContext {
  readonly afterSelectedNodeId?: string | null;
  readonly afterActiveChapterId?: string | null;
}

export interface GraphLayoutPatch {
  readonly id: string;
  readonly position: GraphPosition;
}

export interface GraphNodePositionPatch {
  readonly fullId: string;
  readonly position: GraphPosition;
}

export interface OptionPatch {
  readonly description?: string;
  readonly targetNodeId?: string | null;
  readonly targetChapterId?: string | null;
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
  readonly type: VariableType;
  readonly originalName?: string;
  readonly defaultValue?: VariableValue;
  readonly scope?: VariableScope;
  readonly chapterId?: string;
  readonly description?: string;
  readonly enumValues?: readonly string[];
  readonly fields?: readonly VariablePatch[];
}

export interface NodeNextTargetPatch {
  readonly targetFullId?: string | null;
  readonly effectsRaw?: string | null;
}

const DEFAULT_CHAPTER_TITLE = '第一章';
const DEFAULT_NODE_TITLE = '新节点';
const DEFAULT_BODY = '在这里写下剧情正文。';
const DEFAULT_OPTION = '继续';
const CONDITION_LABEL = '\u6761\u4ef6';
const EFFECTS_LABEL = '\u6548\u679c';
const NEXT_LABEL = '\u4e0b\u4e00\u6b65';
const NODE_LABEL = '\u8282\u70b9';
const VARIABLE_NAME_RE = /^[\p{L}][\p{L}\p{N}_]{0,63}$/u;
const RESERVED_VARIABLE_NAMES = new Set([
  'int', 'float', 'bool', 'string', 'enum', 'object',
  'true', 'false', 'AND', 'OR', 'NOT', 'none',
  'plotflow', 'title', 'author', 'engine', 'layout', 'graph', 'version', 'nodes', 'x', 'y', 'vars',
]);

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
  readonly targetChapterId: string | null;
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
  let targetChapterId: string | null = null;
  const targetMatch = rest.match(/\s*->\s*(?:(.+?)\/)?节点[：:]\s*(.+)\s*$/);
  if (targetMatch) {
    targetChapterId = targetMatch[1]?.trim() || null;
    targetNodeId = targetMatch[2]?.trim() ?? null;
    rest = rest.slice(0, targetMatch.index).trimEnd();
  }

  return {
    prefix: match[1] ?? '[选项] ',
    description: rest.trim(),
    targetNodeId,
    targetChapterId,
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

function serializeNextTargetBlock(
  targetNodeId: string,
  effectsRaw: string | null,
  targetChapterId: string | null = null,
): string[] {
  const chapterPrefix = targetChapterId?.trim() ? `${targetChapterId.trim()}/` : '';
  const lines = [`${NEXT_LABEL}: ${chapterPrefix}${NODE_LABEL}：${targetNodeId.trim()}`];
  if (effectsRaw?.trim()) {
    lines.push(`  ${EFFECTS_LABEL}: ${effectsRaw.trim()}`);
  }
  return lines;
}

function serializeOptionLine(option: {
  readonly prefix?: string;
  readonly description: string;
  readonly targetNodeId: string | null;
  readonly targetChapterId: string | null;
  readonly conditionRaw: string | null;
  readonly effectsRaw: string | null;
}): string {
  let line = `${option.prefix ?? '[选项] '}${option.description.trim() || DEFAULT_OPTION}`;
  if (option.targetNodeId && option.targetNodeId.trim()) {
    const chapterPrefix = option.targetChapterId?.trim()
      ? `${option.targetChapterId.trim()}/`
      : '';
    line += ` -> ${chapterPrefix}节点：${option.targetNodeId.trim()}`;
  }
  return line;
}

function serializeOptionBlock(option: {
  readonly prefix?: string;
  readonly description: string;
  readonly targetNodeId: string | null;
  readonly targetChapterId: string | null;
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
    targetChapterId: option.targetChapterId,
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
  return createFullId(chapterId, nodeId);
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
  const parsed = parseStory(normalized);
  const storyNodes = parsed.ok
    ? parsed.data.chapters.flatMap((chapter) => chapter.nodes)
    : [];
  const canonicalIds = new Set(storyNodes.map((node) => node.fullId));
  const legacyMatches = new Map<string, StoryNode[]>();
  for (const node of storyNodes) {
    const key = legacyFullId(node.chapterId, node.id);
    const matches = legacyMatches.get(key) ?? [];
    matches.push(node);
    legacyMatches.set(key, matches);
  }
  const migrated = readExistingLayoutNodes(normalized).flatMap((node): GraphLayoutPatch[] => {
    if (canonicalIds.has(node.id)) return [node];
    const matches = legacyMatches.get(node.id);
    if (!matches) return [node];
    if (matches.length !== 1) return [];
    return [{ id: matches[0]!.fullId, position: node.position }];
  });
  const byId = new Map(migrated.map((node) => [node.id, node]));
  for (const patch of patches) {
    const matches = canonicalIds.has(patch.id) ? undefined : legacyMatches.get(patch.id);
    const id = matches?.length === 1 ? matches[0]!.fullId : patch.id;
    byId.set(id, { id, position: roundPosition(patch.position) });
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
  if (!nodes.some((node) => node.id === fromId)) return { content, changed: false };
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
  const layoutRemoval = removeGraphLayoutNodesText(nodeRemoval.content, [
    node.fullId,
    legacyFullId(node.chapterId, node.id),
  ]);
  return {
    content: layoutRemoval.content,
    changed: nodeRemoval.changed || layoutRemoval.changed,
  };
}

export function updateNodeText(content: string, node: StoryNode, patch: NodePatch): GraphEditResult {
  const normalized = normalizeText(content);
  const oldFullId = node.fullId;
  const nextChapterId = patch.chapterTitle?.trim() || node.chapterId;
  const nextNodeId = patch.title?.trim() || node.id;
  const newFullId = fullIdFor(nextChapterId, nextNodeId);
  let next = newFullId === oldFullId
    ? normalized
    : replaceTargetReferencesText(
      normalized,
      oldFullId,
      nextNodeId,
      nextChapterId,
    ).content;

  if (patch.title !== undefined && patch.title.trim()) {
    const { lines, start } = getNodeRange(next, node);
    lines[start] = `## 节点：${nextNodeId}`;
    next = lines.join('\n');
  }

  if (patch.body !== undefined) {
    const currentFullId = fullIdFor(node.chapterId, nextNodeId);
    const parsed = parseStory(next);
    const parsedNode = parsed.ok
      ? parsed.data.chapters
        .flatMap((chapter) => chapter.nodes)
        .find((candidate) => candidate.fullId === currentFullId)
      : undefined;
    const freshNode = parsedNode ?? (patch.title && patch.title !== node.title
      ? { ...node, id: nextNodeId, fullId: currentFullId, title: nextNodeId }
      : node);
    const { lines, start, end } = getNodeRange(next, freshNode);
    const existingNextTarget = freshNode.nextTarget?.targetNodeId
      ? serializeNextTargetBlock(
        freshNode.nextTarget.targetNodeId,
        freshNode.nextTarget.effectsRaw,
        freshNode.nextTarget.targetChapterId,
      )
      : [];
    const existingOptions = freshNode.options.flatMap(optionToBlock);
    const titleLine = lines[start] ?? `## 节点：${freshNode.title}`;
    const bodyLines = patch.body.trim().length > 0 ? patch.body.trim().split('\n') : [''];
    const flowLines = [
      ...existingNextTarget,
      ...(existingNextTarget.length > 0 && existingOptions.length > 0 ? [''] : []),
      ...existingOptions,
    ];
    lines.splice(start, end - start, titleLine, '', ...bodyLines, ...(flowLines.length > 0 ? ['', ...flowLines] : []));
    next = lines.join('\n');
  }

  if (patch.chapterTitle !== undefined && patch.chapterTitle.trim() && patch.chapterTitle.trim() !== node.chapterId) {
    next = moveNodeToChapterText(next, node, nextChapterId).content;
  }

  if (newFullId !== oldFullId) {
    next = migrateGraphLayoutNodeText(next, oldFullId, newFullId).content;
    next = migrateGraphLayoutNodeText(
      next,
      legacyFullId(node.chapterId, node.id),
      newFullId,
    ).content;
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
    targetChapterId: patch.targetChapterId ?? null,
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
    targetChapterId: patch.targetChapterId !== undefined
      ? patch.targetChapterId
      : parsed?.targetChapterId ?? option.targetChapterId,
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
  targetChapterId = node.nextTarget?.targetChapterId ?? null,
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

  const block = serializeNextTargetBlock(targetNodeId, effectsRaw, targetChapterId);
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

function replaceTargetReferencesText(
  content: string,
  fromTargetFullId: string,
  toTargetNodeId: string,
  toTargetChapterId: string,
): GraphEditResult {
  const normalized = normalizeText(content);
  const fromTarget = fromTargetFullId.trim();
  const toTarget = toTargetNodeId.trim();
  const toChapter = toTargetChapterId.trim();
  if (!fromTarget || !toTarget || !toChapter) {
    return { content, changed: false };
  }

  const lines = linesOf(normalized);
  const parsed = parseStory(normalized);
  if (!parsed.ok) return { content, changed: false };
  let changed = false;

  for (const chapter of parsed.data.chapters) {
    for (const sourceNode of chapter.nodes) {
      for (const option of sourceNode.options) {
        if (option.targetFullId !== fromTarget) continue;
        const index = findOptionLineIndex(lines, option);
        const optionLine = index >= 0 ? parseOptionLine(lines[index] ?? '') : null;
        if (!optionLine) continue;
        lines[index] = serializeOptionLine({
          prefix: optionLine.prefix,
          description: optionLine.description,
          targetNodeId: toTarget,
          targetChapterId: option.targetChapterId !== null || sourceNode.chapterId !== toChapter
            ? toChapter
            : null,
          conditionRaw: optionLine.conditionRaw,
          effectsRaw: optionLine.effectsRaw,
        });
        changed = true;
      }

      const nextTarget = sourceNode.nextTarget;
      if (nextTarget?.targetFullId !== fromTarget) continue;
      const index = findNodeNextTargetLineIndex(lines, sourceNode);
      if (index < 0) continue;
      lines[index] = serializeNextTargetBlock(
        toTarget,
        nextTarget.effectsRaw,
        nextTarget.targetChapterId !== null || sourceNode.chapterId !== toChapter
          ? toChapter
          : null,
      )[0]!;
      changed = true;
    }
  }

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

export function updateNodePositionsText(
  content: string,
  patches: readonly GraphNodePositionPatch[],
): GraphEditResult {
  return upsertGraphLayoutText(content, patches.map((patch) => ({
    id: patch.fullId,
    position: patch.position,
  })));
}

export function updateMetaText(content: string, field: 'title' | 'author' | 'engine', value: string): GraphEditResult {
  const normalizedValue = value.trim();
  if (
    field === 'engine'
    && normalizedValue !== 'generic'
    && normalizedValue !== 'godot'
    && normalizedValue !== 'unity'
    && normalizedValue !== 'unreal'
  ) {
    return { content, changed: false };
  }
  const serializedValue = JSON.stringify(normalizedValue);
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
    const next = `---\nplotflow: 0.1\n${field}: ${serializedValue}\n---\n\n${normalized.trimStart()}`;
    return patchResult(content, next);
  }

  const fieldIndex = lines.findIndex((line, index) => index > 0 && index < frontmatterEnd && line.startsWith(`${field}:`));
  if (fieldIndex >= 0) {
    lines[fieldIndex] = `${field}: ${serializedValue}`;
  } else {
    const variablesIndex = lines.findIndex((line, index) => (
      index > 0 && index < frontmatterEnd && line.trim() === 'vars:'
    ));
    lines.splice(variablesIndex >= 0 ? variablesIndex : frontmatterEnd, 0, `${field}: ${serializedValue}`);
  }
  return patchResult(content, lines.join('\n'));
}

function implicitVariableDefault(variable: VariablePatch): VariableValue {
  if (variable.type === 'int' || variable.type === 'float') return 0;
  if (variable.type === 'bool') return false;
  if (variable.type === 'string') return '';
  if (variable.type === 'enum') return variable.enumValues?.[0]?.trim() ?? '';
  return Object.fromEntries((variable.fields ?? []).map((field) => [
    field.name.trim(),
    field.defaultValue ?? implicitVariableDefault(field),
  ]));
}

function declarationToVariablePatch(variable: VariableDeclaration): VariablePatch {
  return {
    name: variable.name,
    type: variable.type,
    defaultValue: variable.defaultValue,
    scope: variable.scope,
    chapterId: variable.chapterId,
    description: variable.description,
    enumValues: variable.enumValues,
    fields: variable.fields?.map(declarationToVariablePatch),
  };
}

function normalizedVariablePatch(variable: VariablePatch, depth = 1): VariablePatch | null {
  const name = variable.name.trim().replace(/^\$/, '');
  if (!VARIABLE_NAME_RE.test(name) || RESERVED_VARIABLE_NAMES.has(name)) return null;
  const enumValues = variable.type === 'enum'
    ? (variable.enumValues ?? []).map((value) => value.trim()).filter(Boolean)
    : undefined;
  if (variable.type === 'enum' && (!enumValues?.length || new Set(enumValues).size !== enumValues.length)) {
    return null;
  }
  const fields = variable.type === 'object'
    ? (variable.fields ?? []).map((field) => normalizedVariablePatch(field, depth + 1))
    : undefined;
  if (fields?.some((field) => field === null)) return null;
  const normalizedFields = fields?.filter((field): field is VariablePatch => field !== null);
  if (normalizedFields && new Set(normalizedFields.map((field) => field.name)).size !== normalizedFields.length) {
    return null;
  }
  const chapterId = variable.chapterId?.trim();
  if (depth > 1 && (variable.scope !== undefined || chapterId !== undefined)) return null;
  if (variable.scope === 'chapter' && !chapterId) return null;
  if (variable.scope !== 'chapter' && chapterId) return null;
  return {
    ...variable,
    name,
    enumValues,
    fields: normalizedFields,
    chapterId,
    defaultValue: variable.defaultValue ?? implicitVariableDefault({
      ...variable,
      name,
      enumValues,
      fields: normalizedFields,
    }),
    description: variable.description?.trim() || undefined,
  };
}

function serializeYamlValue(value: VariableValue): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function serializeStructuredVariable(variable: VariablePatch, indent: number, depth: number): string[] | null {
  if (variable.type === 'object' && depth > 3) return null;
  const normalized = normalizedVariablePatch(variable);
  if (!normalized) return null;
  const prefix = ' '.repeat(indent);
  const propertyPrefix = ' '.repeat(indent + 2);
  const lines = [
    `${prefix}${normalized.name}:`,
    `${propertyPrefix}type: ${normalized.type}`,
  ];
  if (normalized.type === 'enum') {
    lines.push(`${propertyPrefix}values: ${JSON.stringify(normalized.enumValues ?? [])}`);
  }
  lines.push(`${propertyPrefix}default: ${serializeYamlValue(normalized.defaultValue ?? implicitVariableDefault(normalized))}`);
  if (normalized.scope) lines.push(`${propertyPrefix}scope: ${normalized.scope}`);
  if (normalized.scope === 'chapter' && normalized.chapterId) {
    lines.push(`${propertyPrefix}chapter: ${JSON.stringify(normalized.chapterId)}`);
  }
  if (normalized.description) lines.push(`${propertyPrefix}description: ${JSON.stringify(normalized.description)}`);
  if (normalized.type === 'object') {
    const fields = normalized.fields ?? [];
    if (fields.length === 0) {
      lines.push(`${propertyPrefix}fields: {}`);
    } else {
      lines.push(`${propertyPrefix}fields:`);
      for (const field of fields) {
        const serialized = serializeStructuredVariable(field, indent + 4, depth + 1);
        if (!serialized) return null;
        lines.push(...serialized);
      }
    }
  }
  return lines;
}

function replaceVariablesSection(content: string, variables: readonly VariablePatch[]): GraphEditResult {
  const normalized = normalizeText(content);
  const serializedEntries = variables.map((variable) => serializeStructuredVariable(variable, 2, 1));
  if (serializedEntries.some((entry) => entry === null)) return { content, changed: false };
  const serializedVariables = serializedEntries.flatMap((entry) => entry ?? []);
  const block = ['vars:', ...serializedVariables];
  const lines = linesOf(normalized);
  const frontmatter = getFrontmatterRange(lines);
  if (!frontmatter) {
    return patchResult(content, [
      '---',
      'plotflow: 0.1',
      ...block,
      '---',
      '',
      normalized.trimStart(),
    ].join('\n'));
  }
  const existing = findTopLevelBlockRange(lines, frontmatter, 'vars');
  if (existing) {
    lines.splice(existing.start, existing.end - existing.start, ...block);
  } else {
    lines.splice(frontmatter.end, 0, ...block);
  }
  return patchResult(content, lines.join('\n'));
}

export function upsertVariableText(content: string, variable: VariablePatch): GraphEditResult {
  const normalized = normalizeText(content);
  const nextVariable = normalizedVariablePatch(variable);
  if (!nextVariable) return { content, changed: false };
  const parsed = parseStory(normalized);
  if (!parsed.ok) return { content, changed: false };
  const originalName = variable.originalName?.trim() || nextVariable.name;
  const nextVariables = parsed.data.variables
    .filter((candidate) => candidate.name !== originalName && candidate.name !== nextVariable.name)
    .map(declarationToVariablePatch);
  nextVariables.push(nextVariable);
  return replaceVariablesSection(content, nextVariables);
}

export function deleteVariableText(content: string, variableName: string): GraphEditResult {
  const normalized = normalizeText(content);
  const parsed = parseStory(normalized);
  if (!parsed.ok || !parsed.data.variables.some((variable) => variable.name === variableName)) {
    return { content, changed: false };
  }
  return replaceVariablesSection(
    content,
    parsed.data.variables
      .filter((variable) => variable.name !== variableName)
      .map(declarationToVariablePatch),
  );
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

  commit(
    nextContent: string,
    source = 'story-source-edit-service',
    edits?: readonly TextEdit[],
    historyContext?: GraphEditHistoryContext,
  ): void {
    applyGraphEdit(nextContent, source, edits, historyContext);
  },
};

export function applyGraphEdit(
  nextContent: string,
  source = 'graph-edit-service',
  edits?: readonly TextEdit[],
  historyContext?: GraphEditHistoryContext,
): void {
  const editor = useEditorStore.getState().editorInstance;
  const beforeContent = editor?.getValue() ?? useEditorStore.getState().content;
  const graphState = useGraphStore.getState();
  const uiState = useUIStore.getState();
  if (uiState.workspaceMode === 'graphLab') {
    recordGraphEdit({
      beforeContent,
      afterContent: nextContent,
      beforeSelectedNodeId: graphState.selectedNodeId,
      afterSelectedNodeId: historyContext?.afterSelectedNodeId !== undefined
        ? historyContext.afterSelectedNodeId
        : graphState.selectedNodeId,
      beforeActiveChapterId: uiState.activeChapterId,
      afterActiveChapterId: historyContext?.afterActiveChapterId !== undefined
        ? historyContext.afterActiveChapterId
        : uiState.activeChapterId,
      source,
    });
  }
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
      debouncedSave(committedContent, useEditorStore.getState().filePath);
      return;
    }
  }

  useEditorStore.getState().setContent(nextContent);
  parsePipelineNow(nextContent);
  debouncedSave(nextContent, useEditorStore.getState().filePath);
}

configureGraphHistoryReplay((target) => {
  const editorState = useEditorStore.getState();
  editorState.setContent(target.content);
  parsePipelineNow(target.content);
  useUIStore.getState().setActiveChapterId(target.activeChapterId);
  useGraphStore.getState().selectNode(target.selectedNodeId);
  editorState.setActiveNodeId(target.selectedNodeId);
  debouncedSave(target.content, editorState.filePath);
});

function commit(
  result: GraphEditResult,
  source: string,
  historyContext?: GraphEditHistoryContext,
): boolean {
  if (!result.changed) return false;
  StorySourceEditService.commit(result.content, source, undefined, historyContext);
  return true;
}

function currentContent(): string {
  const editor = useEditorStore.getState().editorInstance;
  return editor?.getValue() ?? useEditorStore.getState().content;
}

function runGraphEdit(
  source: string,
  edit: (content: string) => GraphEditResult,
  historyContext?: GraphEditHistoryContext,
): boolean {
  if (!flushSourceDraftBeforeSaveOrReplace('replace')) return false;
  return commit(edit(currentContent()), source, historyContext);
}

function selectedNode(): StoryNode | undefined {
  const graphState = useStoryStore.getState();
  const selectedId = useEditorStore.getState().activeNodeId;
  if (selectedId) return graphState.getNodeByFullId(selectedId);
  return undefined;
}

function resolveNextTarget(
  sourceNode: StoryNode,
  targetReference: string | null,
): { readonly targetNodeId: string | null; readonly targetChapterId: string | null } {
  if (!targetReference) return { targetNodeId: null, targetChapterId: null };
  const storyState = useStoryStore.getState();
  const target = storyState.getNodeByFullId(targetReference)
    ?? storyState.getAllNodes().find((candidate) => (
      candidate.id === targetReference && candidate.chapterId === sourceNode.chapterId
    ))
    ?? storyState.getAllNodes().find((candidate) => candidate.id === targetReference);
  if (!target) return { targetNodeId: targetReference, targetChapterId: null };
  return {
    targetNodeId: target.id,
    targetChapterId: target.chapterId === sourceNode.chapterId ? null : target.chapterId,
  };
}

export const graphEditService = {
  createChapter(chapterTitle = DEFAULT_CHAPTER_TITLE): boolean {
    return runGraphEdit('graph-lab-create-chapter', (content) => createChapterText(content, chapterTitle));
  },

  createNode(params?: Parameters<typeof createNodeText>[1]): boolean {
    return runGraphEdit('graph-lab-create-node', (content) => createNodeText(content, params));
  },

  deleteNode(node: StoryNode): boolean {
    const selectedNodeId = useGraphStore.getState().selectedNodeId;
    const deletingSelection = selectedNodeId === node.fullId;
    const changed = runGraphEdit(
      'graph-lab-delete-node',
      (content) => deleteNodeText(content, node),
      deletingSelection ? { afterSelectedNodeId: null } : undefined,
    );
    if (changed && deletingSelection) {
      useGraphStore.getState().selectNode(null);
      useEditorStore.getState().setActiveNodeId(null);
    }
    return changed;
  },

  updateNode(node: StoryNode, patch: NodePatch): boolean {
    const nextChapterId = patch.chapterTitle?.trim() || node.chapterId;
    const nextNodeId = patch.title?.trim() || node.id;
    const nextFullId = fullIdFor(nextChapterId, nextNodeId);
    const selectionMoves = useGraphStore.getState().selectedNodeId === node.fullId
      && nextFullId !== node.fullId;
    const historyContext = selectionMoves
      ? {
        afterSelectedNodeId: nextFullId,
        afterActiveChapterId: patch.chapterTitle?.trim()
          ? nextChapterId
          : useUIStore.getState().activeChapterId,
      }
      : undefined;
    const changed = runGraphEdit(
      'graph-lab-update-node',
      (content) => updateNodeText(content, node, patch),
      historyContext,
    );
    if (changed && selectionMoves) {
      useGraphStore.getState().selectNode(nextFullId);
      useEditorStore.getState().setActiveNodeId(nextFullId);
      if (patch.chapterTitle?.trim()) {
        useUIStore.getState().setActiveChapterId(nextChapterId);
      }
    }
    return changed;
  },

  addOption(node: StoryNode, patch?: OptionPatch): boolean {
    return runGraphEdit('graph-lab-add-option', (content) => addOptionText(content, node, patch));
  },

  updateOption(option: Option, patch: OptionPatch): boolean {
    return runGraphEdit('graph-lab-update-option', (content) => updateOptionText(content, option, patch));
  },

  deleteOption(option: Option): boolean {
    return runGraphEdit('graph-lab-delete-option', (content) => deleteOptionText(content, option));
  },

  reorderOption(node: StoryNode, fromIndex: number, toIndex: number): boolean {
    return runGraphEdit('graph-lab-reorder-option', (content) => reorderOptionText(content, node, fromIndex, toIndex));
  },

  connectOption(option: Option, targetFullId: string | null): boolean {
    const target = targetFullId ? useStoryStore.getState().getNodeByFullId(targetFullId) : undefined;
    return runGraphEdit('graph-lab-connect-option', (content) => updateOptionText(content, option, {
      targetNodeId: target?.id ?? targetFullId,
      targetChapterId: target?.chapterId ?? null,
    }));
  },

  connectNextTarget(node: StoryNode, targetReference: string | null): boolean {
    const target = resolveNextTarget(node, targetReference);
    return runGraphEdit('graph-lab-connect-next-target', (content) => updateNodeNextTargetText(
      content,
      node,
      target.targetNodeId,
      node.nextTarget?.effectsRaw ?? null,
      target.targetChapterId,
    ));
  },

  updateNextTarget(node: StoryNode, patch: NodeNextTargetPatch): boolean {
    const targetReference = patch.targetFullId !== undefined
      ? patch.targetFullId
      : node.nextTarget?.targetFullId ?? null;
    const target = resolveNextTarget(node, targetReference);
    const effectsRaw = patch.effectsRaw !== undefined
      ? patch.effectsRaw
      : node.nextTarget?.effectsRaw ?? null;
    return runGraphEdit('graph-lab-update-next-target', (content) => updateNodeNextTargetText(
      content,
      node,
      target.targetNodeId,
      effectsRaw,
      target.targetChapterId,
    ));
  },

  createNodeAndConnect(
    node: StoryNode,
    option: Option,
    targetTitle = DEFAULT_NODE_TITLE,
    targetPosition?: GraphPosition,
  ): boolean {
    return runGraphEdit('graph-lab-create-node-and-connect', (content) => createNodeAndConnectText(content, node, option, targetTitle, targetPosition));
  },

  createNodeAndConnectNext(
    node: StoryNode,
    targetTitle = DEFAULT_NODE_TITLE,
    targetPosition?: GraphPosition,
  ): boolean {
    return runGraphEdit('graph-lab-create-node-and-connect-next', (content) => createNodeAndConnectNextText(content, node, targetTitle, targetPosition));
  },

  updateNodePosition(node: StoryNode, position: GraphPosition): boolean {
    return graphEditService.updateNodePositions([{ fullId: node.fullId, position }]);
  },

  updateNodePositions(patches: readonly GraphNodePositionPatch[]): boolean {
    if (patches.length === 0) return false;
    return runGraphEdit(
      'graph-lab-update-node-positions',
      (content) => updateNodePositionsText(content, patches),
    );
  },

  updateMeta(field: 'title' | 'author' | 'engine', value: string): boolean {
    return runGraphEdit('graph-lab-update-meta', (content) => updateMetaText(content, field, value));
  },

  upsertVariable(variable: VariablePatch): boolean {
    return runGraphEdit('graph-lab-upsert-variable', (content) => upsertVariableText(content, variable));
  },

  deleteVariable(variableName: string): boolean {
    return runGraphEdit('graph-lab-delete-variable', (content) => deleteVariableText(content, variableName));
  },

  updateSelectedNode(patch: NodePatch): boolean {
    const node = selectedNode();
    if (!node) return false;
    return graphEditService.updateNode(node, patch);
  },
};
