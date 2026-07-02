import type { GraphPosition, StoryNode, Option } from '@plotflow/core';
import { useEditorStore } from '../stores/editorStore';
import { useStoryStore } from '../stores/storyStore';
import { parsePipelineNow } from './parsePipeline';

export interface GraphEditResult {
  readonly content: string;
  readonly changed: boolean;
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

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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

function serializeOptionLine(option: {
  readonly prefix?: string;
  readonly description: string;
  readonly targetNodeId: string | null;
  readonly conditionRaw: string | null;
  readonly effectsRaw: string | null;
}): string {
  let line = `${option.prefix ?? '[选项] '}${option.description.trim() || DEFAULT_OPTION}`;
  if (option.conditionRaw && option.conditionRaw.trim()) {
    line += ` [条件：${option.conditionRaw.trim()}]`;
  }
  if (option.effectsRaw && option.effectsRaw.trim()) {
    line += ` [效果：${option.effectsRaw.trim()}]`;
  }
  if (option.targetNodeId && option.targetNodeId.trim()) {
    line += ` -> 节点：${option.targetNodeId.trim()}`;
  }
  return line;
}

function optionToLine(option: Option): string {
  return serializeOptionLine({
    description: option.description,
    targetNodeId: option.targetNodeId,
    conditionRaw: option.conditionRaw,
    effectsRaw: option.effectsRaw,
  });
}

function patchResult(before: string, after: string): GraphEditResult {
  return { content: after, changed: before !== after };
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
  if ((lines[0] ?? '').trim() !== '---') return null;
  for (let index = 1; index < lines.length; index++) {
    if ((lines[index] ?? '').trim() === '---') {
      return { start: 0, end: index };
    }
  }
  return null;
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
    if (!frontmatter) return { content: normalized, changed: false };
    const layout = findTopLevelBlockRange(lines, frontmatter, 'layout');
    if (!layout) return { content: normalized, changed: false };
    lines.splice(layout.start, layout.end - layout.start);
    return patchResult(normalized, lines.join('\n'));
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
    return patchResult(normalized, next);
  }

  const existingLayout = findTopLevelBlockRange(lines, frontmatter, 'layout');
  if (existingLayout) {
    lines.splice(existingLayout.start, existingLayout.end - existingLayout.start, ...layoutBlock);
    return patchResult(normalized, lines.join('\n'));
  }

  const varsIndex = lines.findIndex((line, index) => (
    index > frontmatter.start &&
    index < frontmatter.end &&
    /^vars\s*:/.test(line)
  ));
  const insertIndex = varsIndex >= 0 ? varsIndex : frontmatter.end;
  lines.splice(insertIndex, 0, ...layoutBlock);
  return patchResult(normalized, lines.join('\n'));
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
  return setGraphLayoutNodesText(normalized, [...byId.values()]);
}

export function removeGraphLayoutNodesText(
  content: string,
  ids: readonly string[],
): GraphEditResult {
  const normalized = normalizeText(content);
  const removeIds = new Set(ids);
  const next = readExistingLayoutNodes(normalized).filter((node) => !removeIds.has(node.id));
  return setGraphLayoutNodesText(normalized, next);
}

export function migrateGraphLayoutNodeText(
  content: string,
  fromId: string,
  toId: string,
): GraphEditResult {
  const normalized = normalizeText(content);
  if (fromId === toId) return { content: normalized, changed: false };
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
  return changed ? setGraphLayoutNodesText(normalized, next) : { content: normalized, changed: false };
}

export function createChapterText(
  content: string,
  chapterTitle = DEFAULT_CHAPTER_TITLE,
): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  if (findChapterLineIndex(lines, chapterTitle) >= 0) {
    return { content: normalized, changed: false };
  }

  const prefix = normalized.trim().length > 0 ? '\n\n' : '';
  return patchResult(normalized, `${ensureTrailingNewline(normalized).trimEnd()}${prefix}# ${chapterTitle.trim() || DEFAULT_CHAPTER_TITLE}\n`);
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
    return patchResult(normalized, `${normalized.trimEnd()}${prefix}${nodeBlock}`);
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
    return patchResult(normalized, `${next.trimEnd()}${prefix}# ${chapterTitle}\n\n${nodeBlock}`);
  }

  const insertIndex = findChapterEndLineIndex(lines, chapterLineIndex);
  lines.splice(insertIndex, 0, '', nodeBlock.trimEnd());
  return patchResult(normalized, lines.join('\n').replace(/\n{4,}/g, '\n\n\n'));
}

export function deleteNodeText(content: string, node: StoryNode): GraphEditResult {
  const normalized = normalizeText(content);
  const { lines, start, end } = getNodeRange(normalized, node);
  lines.splice(start, end - start);
  const withoutNode = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  return removeGraphLayoutNodesText(withoutNode, [node.fullId]);
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
    const existingOptions = node.options.map(optionToLine);
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

  return patchResult(normalized, next);
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
  return patchResult(normalized, nextLines.join('\n').replace(/\n{4,}/g, '\n\n\n'));
}

export function addOptionText(
  content: string,
  node: StoryNode,
  patch: OptionPatch = {},
): GraphEditResult {
  const normalized = normalizeText(content);
  const { lines, end } = getNodeRange(normalized, node);
  const line = serializeOptionLine({
    description: patch.description ?? DEFAULT_OPTION,
    targetNodeId: patch.targetNodeId ?? null,
    conditionRaw: patch.conditionRaw ?? null,
    effectsRaw: patch.effectsRaw ?? null,
  });
  lines.splice(end, 0, line);
  return patchResult(normalized, lines.join('\n'));
}

export function updateOptionText(
  content: string,
  option: Option,
  patch: OptionPatch,
): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  const index = findOptionLineIndex(lines, option);
  if (index < 0 || index >= lines.length) return { content: normalized, changed: false };
  const parsed = parseOptionLine(lines[index] ?? '');
  const line = serializeOptionLine({
    prefix: parsed?.prefix,
    description: patch.description ?? parsed?.description ?? option.description,
    targetNodeId: patch.targetNodeId !== undefined ? patch.targetNodeId : parsed?.targetNodeId ?? option.targetNodeId,
    conditionRaw: patch.conditionRaw !== undefined ? patch.conditionRaw : parsed?.conditionRaw ?? option.conditionRaw,
    effectsRaw: patch.effectsRaw !== undefined ? patch.effectsRaw : parsed?.effectsRaw ?? option.effectsRaw,
  });
  lines[index] = line;
  return patchResult(normalized, lines.join('\n'));
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
    return { content: normalized, changed: false };
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

  return changed ? patchResult(normalized, lines.join('\n')) : { content: normalized, changed: false };
}

export function deleteOptionText(content: string, option: Option): GraphEditResult {
  const normalized = normalizeText(content);
  const lines = linesOf(normalized);
  const index = findOptionLineIndex(lines, option);
  if (index < 0 || index >= lines.length) return { content: normalized, changed: false };
  lines.splice(index, 1);
  return patchResult(normalized, lines.join('\n'));
}

export function reorderOptionText(
  content: string,
  node: StoryNode,
  fromIndex: number,
  toIndex: number,
): GraphEditResult {
  const normalized = normalizeText(content);
  if (fromIndex === toIndex) return { content: normalized, changed: false };
  const options = [...node.options];
  const [moved] = options.splice(fromIndex, 1);
  if (!moved) return { content: normalized, changed: false };
  options.splice(Math.max(0, Math.min(toIndex, options.length)), 0, moved);

  const { lines, start, end } = getNodeRange(normalized, node);
  const optionLineIndices: number[] = [];
  for (let index = start; index < end; index++) {
    if (parseOptionLine(lines[index] ?? '')) optionLineIndices.push(index);
  }

  optionLineIndices.forEach((lineIndex, index) => {
    const option = options[index];
    if (option) lines[lineIndex] = optionToLine(option);
  });
  return patchResult(normalized, lines.join('\n'));
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
  return patchResult(normalized, next);
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
    return patchResult(normalized, next);
  }

  const fieldIndex = lines.findIndex((line, index) => index > 0 && index < frontmatterEnd && line.startsWith(`${field}:`));
  if (fieldIndex >= 0) {
    lines[fieldIndex] = `${field}: ${value.trim()}`;
  } else {
    lines.splice(frontmatterEnd, 0, `${field}: ${value.trim()}`);
  }
  return patchResult(normalized, lines.join('\n'));
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
    return patchResult(normalized, `---\nplotflow: 0.1\nvars:\n${entry}\n---\n\n${normalized.trimStart()}`);
  }

  const variablesIndex = lines.findIndex((line, index) => index > 0 && index < frontmatterEnd && line.trim() === 'vars:');
  if (variablesIndex < 0) {
    lines.splice(frontmatterEnd, 0, 'vars:', entry);
    return patchResult(normalized, lines.join('\n'));
  }

  const existingIndex = lines.findIndex(
    (line, index) => index > variablesIndex && index < frontmatterEnd && line.trim().startsWith(`${variableName}:`),
  );
  if (existingIndex >= 0) {
    lines[existingIndex] = entry;
  } else {
    lines.splice(variablesIndex + 1, 0, entry);
  }
  return patchResult(normalized, lines.join('\n'));
}

export function applyGraphEdit(nextContent: string, source = 'graph-edit-service'): void {
  const editor = useEditorStore.getState().editorInstance;
  if (editor) {
    const model = editor.getModel();
    if (model) {
      editor.pushUndoStop();
      editor.executeEdits(source, [{ range: model.getFullModelRange(), text: nextContent }]);
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
  applyGraphEdit(result.content, source);
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

  createNodeAndConnect(
    node: StoryNode,
    option: Option,
    targetTitle = DEFAULT_NODE_TITLE,
    targetPosition?: GraphPosition,
  ): boolean {
    return commit(createNodeAndConnectText(currentContent(), node, option, targetTitle, targetPosition), 'graph-lab-create-node-and-connect');
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

  updateSelectedNode(patch: NodePatch): boolean {
    const node = selectedNode();
    if (!node) return false;
    return graphEditService.updateNode(node, patch);
  },
};
