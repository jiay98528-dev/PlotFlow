export type SourceNewline = '\n' | '\r\n' | '\r';

export interface StorySourceLine {
  readonly text: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly newline: SourceNewline | '';
}

export interface StorySourceRange {
  readonly startLine: number;
  readonly endLine: number;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface StoryFrontmatterRange extends StorySourceRange {
  readonly contentStartLine: number;
  readonly contentEndLine: number;
  readonly contentStartOffset: number;
  readonly contentEndOffset: number;
  readonly content: string;
}

export interface StorySourceDiagnostic {
  readonly code: 'FRONTMATTER_MULTIPLE_DOCUMENTS';
  readonly message: string;
  readonly range: StorySourceRange;
}

export interface StorySourceLayoutRange extends StorySourceRange {
  readonly keyRange: StorySourceRange;
}

export interface StoryChapterSourceRange extends StorySourceRange {
  readonly title: string;
  readonly titleRange: StorySourceRange;
  readonly nodes: readonly StoryNodeSourceRange[];
}

export interface StoryNodeSourceRange extends StorySourceRange {
  readonly title: string;
  readonly fullId: string;
  readonly titleRange: StorySourceRange;
  readonly bodyRange: StorySourceRange;
  readonly nextTarget: StoryNodeNextTargetSourceRange | null;
  readonly options: readonly StoryOptionSourceRange[];
}

export interface StoryNodeNextTargetSourceRange extends StorySourceRange {
  readonly targetRange: StorySourceRange;
  readonly effectsRange: StorySourceRange | null;
}

export interface StoryOptionSourceRange extends StorySourceRange {
  readonly index: number;
  readonly descriptionRange: StorySourceRange;
  readonly targetRange: StorySourceRange | null;
  readonly conditionRange: StorySourceRange | null;
  readonly effectsRange: StorySourceRange | null;
}

export interface StorySourceAnalysis {
  readonly raw: string;
  readonly newline: SourceNewline;
  readonly lines: readonly StorySourceLine[];
  readonly frontmatter: StoryFrontmatterRange | null;
  readonly frontmatterDocuments: readonly StoryFrontmatterRange[];
  readonly diagnostics: readonly StorySourceDiagnostic[];
  readonly layout: StorySourceLayoutRange | null;
  readonly chapters: readonly StoryChapterSourceRange[];
  readonly bodyStartLine: number;
  readonly bodyStartOffset: number;
}

function detectNewline(raw: string): SourceNewline {
  const crlf = raw.match(/\r\n/g)?.length ?? 0;
  const withoutCrlf = raw.replace(/\r\n/g, '');
  const lf = withoutCrlf.match(/\n/g)?.length ?? 0;
  const cr = withoutCrlf.match(/\r/g)?.length ?? 0;
  if (crlf >= lf && crlf >= cr && crlf > 0) return '\r\n';
  if (cr >= lf && cr > 0) return '\r';
  return '\n';
}

function splitSourceLines(raw: string): StorySourceLine[] {
  const lines: StorySourceLine[] = [];
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const text = match[1] ?? '';
    const newline = (match[2] ?? '') as SourceNewline | '';
    const startOffset = match.index;
    const endOffset = startOffset + text.length;
    lines.push({ text, startOffset, endOffset, newline });
    if (newline === '') break;
  }

  if (lines.length === 0) {
    lines.push({ text: '', startOffset: 0, endOffset: 0, newline: '' });
  }
  return lines;
}

function isFrontmatterFence(line: string): boolean {
  return /^---[ \t]*$/.test(line);
}

const NODE_LABEL = '\u8282\u70b9';
const OPTION_LABEL = '\u9009\u9879';
const CONDITION_LABEL = '\u6761\u4ef6';
const EFFECTS_LABEL = '\u6548\u679c';
const NEXT_LABEL = '\u4e0b\u4e00\u6b65';
const CHAPTER_HEADING_RE = /^#[ \t]+(.+)$/u;
const NODE_HEADING_RE = new RegExp(`^##[ \\t]+${NODE_LABEL}[：:][ \\t]*(.*)$`, 'u');
const OPTION_LINE_RE = new RegExp(`^([ \\t]*)\\[${OPTION_LABEL}\\][ \\t]+(.+)$`, 'u');
const OPTION_TARGET_RE = new RegExp(`->[ \\t]*(?:(?:.+)/)?${NODE_LABEL}[：:][ \\t]*(.+?)[ \\t]*$`, 'u');
const CONDITION_LINE_RE = new RegExp(`^[ \\t]+${CONDITION_LABEL}[：:][ \\t]*(.*)$`, 'u');
const EFFECTS_LINE_RE = new RegExp(`^[ \\t]+${EFFECTS_LABEL}[：:][ \\t]*(.*)$`, 'u');
const NEXT_TARGET_LINE_RE = new RegExp(`^[ \\t]*${NEXT_LABEL}[：:][ \\t]*(.+)$`, 'u');
const NEXT_EFFECTS_LINE_RE = new RegExp(`^[ \\t]+${EFFECTS_LABEL}[：:][ \\t]*(.*)$`, 'u');
const INLINE_CONDITION_RE = new RegExp(`\\[${CONDITION_LABEL}[：:][ \\t]*([^\\]]*)\\]`, 'u');
const INLINE_EFFECTS_RE = new RegExp(`\\[${EFFECTS_LABEL}[：:][ \\t]*([^\\]]*)\\]`, 'u');

function lineTextRange(line: StorySourceLine, lineIndex: number): StorySourceRange {
  return {
    startLine: lineIndex + 1,
    endLine: lineIndex + 1,
    startOffset: line.startOffset,
    endOffset: line.endOffset,
  };
}

function lineFullEndOffset(line: StorySourceLine): number {
  return line.endOffset + line.newline.length;
}

function rangeFromOffsets(
  startLineIndex: number,
  endLineIndex: number,
  startOffset: number,
  endOffset: number,
): StorySourceRange {
  return {
    startLine: startLineIndex + 1,
    endLine: endLineIndex + 1,
    startOffset,
    endOffset,
  };
}

function lineValueRange(
  line: StorySourceLine,
  lineIndex: number,
  rawValue: string,
  fallbackColumn: number,
): StorySourceRange {
  const valueIndex = rawValue.length > 0 ? line.text.lastIndexOf(rawValue) : -1;
  const startOffset = line.startOffset + (valueIndex >= 0 ? valueIndex : fallbackColumn);
  return rangeFromOffsets(
    lineIndex,
    lineIndex,
    startOffset,
    startOffset + rawValue.length,
  );
}

function fullIdFor(chapterTitle: string | null, nodeTitle: string): string {
  return chapterTitle ? `${chapterTitle}-${nodeTitle}` : nodeTitle;
}

function scanFrontmatterDocuments(lines: readonly StorySourceLine[], raw: string): StoryFrontmatterRange[] {
  const documents: StoryFrontmatterRange[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!isFrontmatterFence(lines[index]?.text ?? '')) {
      index++;
      continue;
    }

    const openingIndex = index;
    for (let closingIndex = openingIndex + 1; closingIndex < lines.length; closingIndex++) {
      const closing = lines[closingIndex]!;
      if (!isFrontmatterFence(closing.text)) continue;

      const opening = lines[openingIndex]!;
      const contentStartLine = openingIndex + 2;
      const contentEndLine = closingIndex;
      const contentStartOffset = opening.endOffset + opening.newline.length;
      const contentEndOffset = closing.startOffset > contentStartOffset
        ? closing.startOffset - (lines[closingIndex - 1]?.newline.length ?? 0)
        : contentStartOffset;
      documents.push({
        startLine: openingIndex + 1,
        endLine: closingIndex + 1,
        startOffset: opening.startOffset,
        endOffset: lineFullEndOffset(closing),
        contentStartLine,
        contentEndLine,
        contentStartOffset,
        contentEndOffset,
        content: raw.slice(contentStartOffset, Math.max(contentStartOffset, contentEndOffset)),
      });
      index = closingIndex + 1;
      break;
    }

    if (documents.length === 0 || documents[documents.length - 1]!.startLine !== openingIndex + 1) {
      index++;
    }
  }
  return documents;
}

function isTopLevelFrontmatterKey(line: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(line);
}

function scanLayoutRange(lines: readonly StorySourceLine[], frontmatter: StoryFrontmatterRange | null): StorySourceLayoutRange | null {
  if (!frontmatter) return null;

  const startIndex = frontmatter.contentStartLine - 1;
  const endIndex = frontmatter.contentEndLine - 1;
  let layoutLineIndex = -1;
  for (let index = startIndex; index <= endIndex; index++) {
    const line = lines[index]?.text ?? '';
    if (/^layout\s*:/.test(line)) {
      layoutLineIndex = index;
      break;
    }
  }
  if (layoutLineIndex < 0) return null;

  let blockEndIndex = endIndex;
  for (let index = layoutLineIndex + 1; index <= endIndex; index++) {
    const line = lines[index]?.text ?? '';
    if (line.trim() !== '' && isTopLevelFrontmatterKey(line)) {
      blockEndIndex = index - 1;
      break;
    }
  }

  const keyLine = lines[layoutLineIndex]!;
  const blockEndLine = lines[blockEndIndex] ?? keyLine;
  return {
    startLine: layoutLineIndex + 1,
    endLine: blockEndIndex + 1,
    startOffset: keyLine.startOffset,
    endOffset: lineFullEndOffset(blockEndLine),
    keyRange: {
      startLine: layoutLineIndex + 1,
      endLine: layoutLineIndex + 1,
      startOffset: keyLine.startOffset,
      endOffset: keyLine.startOffset + 'layout'.length,
    },
  };
}

function optionValueRangeFromInline(
  line: StorySourceLine,
  lineIndex: number,
  match: RegExpExecArray | null,
): StorySourceRange | null {
  if (!match || match.index === undefined) return null;
  const rawValue = match[1] ?? '';
  const valueColumn = match[0].lastIndexOf(rawValue);
  const startOffset = line.startOffset + match.index + Math.max(0, valueColumn);
  return rangeFromOffsets(
    lineIndex,
    lineIndex,
    startOffset,
    startOffset + rawValue.length,
  );
}

function scanOptionRange(
  lines: readonly StorySourceLine[],
  optionLineIndex: number,
  optionIndex: number,
  blockEndLineIndex: number,
): StoryOptionSourceRange | null {
  const optionLine = lines[optionLineIndex]!;
  const optionMatch = OPTION_LINE_RE.exec(optionLine.text);
  if (!optionMatch) return null;

  const rest = optionMatch[2] ?? '';
  const restStartColumn = optionLine.text.indexOf(rest);
  const targetMatch = OPTION_TARGET_RE.exec(rest);
  const inlineCondition = INLINE_CONDITION_RE.exec(rest);
  const inlineEffects = INLINE_EFFECTS_RE.exec(rest);
  const cutColumns = [
    targetMatch?.index,
    inlineCondition?.index,
    inlineEffects?.index,
  ].filter((value): value is number => typeof value === 'number' && value >= 0);
  const descriptionLength = cutColumns.length > 0 ? Math.min(...cutColumns) : rest.length;
  const descriptionStartOffset = optionLine.startOffset + restStartColumn;
  const descriptionRange = rangeFromOffsets(
    optionLineIndex,
    optionLineIndex,
    descriptionStartOffset,
    descriptionStartOffset + rest.slice(0, descriptionLength).trimEnd().length,
  );

  let targetRange: StorySourceRange | null = null;
  if (targetMatch?.index !== undefined) {
    const rawTarget = targetMatch[1] ?? '';
    const targetColumn = restStartColumn + targetMatch.index + targetMatch[0].lastIndexOf(rawTarget);
    targetRange = rangeFromOffsets(
      optionLineIndex,
      optionLineIndex,
      optionLine.startOffset + targetColumn,
      optionLine.startOffset + targetColumn + rawTarget.length,
    );
  }

  let conditionRange = optionValueRangeFromInline(optionLine, optionLineIndex, inlineCondition);
  let effectsRange = optionValueRangeFromInline(optionLine, optionLineIndex, inlineEffects);
  for (let index = optionLineIndex + 1; index <= blockEndLineIndex; index++) {
    const line = lines[index]!;
    const conditionMatch = CONDITION_LINE_RE.exec(line.text);
    if (conditionMatch) {
      conditionRange = lineValueRange(line, index, conditionMatch[1] ?? '', conditionMatch[0].length);
      continue;
    }
    const effectsMatch = EFFECTS_LINE_RE.exec(line.text);
    if (effectsMatch) {
      effectsRange = lineValueRange(line, index, effectsMatch[1] ?? '', effectsMatch[0].length);
    }
  }

  const blockEndLine = lines[blockEndLineIndex] ?? optionLine;
  return {
    index: optionIndex,
    startLine: optionLineIndex + 1,
    endLine: blockEndLineIndex + 1,
    startOffset: optionLine.startOffset,
    endOffset: lineFullEndOffset(blockEndLine),
    descriptionRange,
    targetRange,
    conditionRange,
    effectsRange,
  };
}

function scanChapters(lines: readonly StorySourceLine[], bodyStartLine: number): StoryChapterSourceRange[] {
  const chapters: StoryChapterSourceRange[] = [];
  let currentChapterTitle: string | null = null;
  let currentChapterStart = -1;
  let currentChapterTitleRange: StorySourceRange | null = null;
  let currentNodes: StoryNodeSourceRange[] = [];
  let currentNodeTitle: string | null = null;
  let currentNodeStart = -1;
  let currentNodeTitleRange: StorySourceRange | null = null;
  let currentNodeOptions: StoryOptionSourceRange[] = [];
  let currentNodeNextTarget: StoryNodeNextTargetSourceRange | null = null;

  const flushNode = (endLineIndex: number): void => {
    if (currentNodeTitle === null || currentNodeStart < 0 || !currentNodeTitleRange) return;
    const startLine = lines[currentNodeStart]!;
    const endLine = lines[Math.max(currentNodeStart, endLineIndex)] ?? startLine;
    const firstOption = currentNodeOptions[0];
    const firstSyntax = [firstOption, currentNodeNextTarget]
      .filter((range): range is StoryOptionSourceRange | StoryNodeNextTargetSourceRange => range !== null)
      .sort((a, b) => a.startLine - b.startLine)[0];
    currentNodes.push({
      title: currentNodeTitle,
      fullId: fullIdFor(currentChapterTitle, currentNodeTitle),
      startLine: currentNodeStart + 1,
      endLine: Math.max(currentNodeStart, endLineIndex) + 1,
      startOffset: startLine.startOffset,
      endOffset: lineFullEndOffset(endLine),
      titleRange: currentNodeTitleRange,
      bodyRange: {
        startLine: currentNodeStart + 1,
        endLine: firstSyntax ? firstSyntax.startLine : Math.max(currentNodeStart, endLineIndex) + 1,
        startOffset: lineFullEndOffset(startLine),
        endOffset: firstSyntax ? firstSyntax.startOffset : lineFullEndOffset(endLine),
      },
      nextTarget: currentNodeNextTarget,
      options: currentNodeOptions,
    });
    currentNodeTitle = null;
    currentNodeStart = -1;
    currentNodeTitleRange = null;
    currentNodeOptions = [];
    currentNodeNextTarget = null;
  };

  const flushChapter = (endLineIndex: number): void => {
    flushNode(endLineIndex);
    if (currentChapterTitle === null || currentChapterStart < 0 || !currentChapterTitleRange) return;
    const startLine = lines[currentChapterStart]!;
    const rawEndLineIndex = Math.max(currentChapterStart, endLineIndex);
    let chapterEndLineIndex = rawEndLineIndex;
    while (
      chapterEndLineIndex > currentChapterStart
      && (lines[chapterEndLineIndex]?.text.trim() ?? '') === ''
    ) {
      chapterEndLineIndex--;
    }
    const endLine = lines[chapterEndLineIndex] ?? startLine;
    chapters.push({
      title: currentChapterTitle,
      startLine: currentChapterStart + 1,
      endLine: chapterEndLineIndex + 1,
      startOffset: startLine.startOffset,
      endOffset: lineFullEndOffset(endLine),
      titleRange: currentChapterTitleRange,
      nodes: currentNodes,
    });
    currentChapterTitle = null;
    currentChapterStart = -1;
    currentChapterTitleRange = null;
    currentNodes = [];
  };

  for (let index = Math.max(0, bodyStartLine - 1); index < lines.length; index++) {
    const line = lines[index]!;
    const trimmed = line.text.trimStart();

    const chapterMatch = !trimmed.startsWith('##') ? CHAPTER_HEADING_RE.exec(trimmed) : null;
    if (chapterMatch) {
      flushChapter(index - 1);
      currentChapterTitle = (chapterMatch[1] ?? '').trim();
      currentChapterStart = index;
      const titleColumn = line.text.indexOf(chapterMatch[1] ?? '');
      currentChapterTitleRange = rangeFromOffsets(
        index,
        index,
        line.startOffset + Math.max(0, titleColumn),
        line.startOffset + Math.max(0, titleColumn) + (chapterMatch[1] ?? '').length,
      );
      continue;
    }

    const nodeMatch = NODE_HEADING_RE.exec(trimmed);
    if (nodeMatch) {
      flushNode(index - 1);
      currentNodeTitle = (nodeMatch[1] ?? '').trim();
      currentNodeStart = index;
      const titleColumn = line.text.indexOf(nodeMatch[1] ?? '');
      currentNodeTitleRange = rangeFromOffsets(
        index,
        index,
        line.startOffset + Math.max(0, titleColumn),
        line.startOffset + Math.max(0, titleColumn) + (nodeMatch[1] ?? '').length,
      );
      if (currentChapterTitle === null) {
        currentChapterTitle = '';
        currentChapterStart = index;
        currentChapterTitleRange = lineTextRange(line, index);
      }
      continue;
    }

    if (currentNodeTitle !== null) {
      const nextMatch = NEXT_TARGET_LINE_RE.exec(trimmed);
      if (nextMatch) {
        const rawTarget = nextMatch[1] ?? '';
        let endIndex = index;
        let effectsRange: StorySourceRange | null = null;
        const nextLine = lines[index + 1];
        if (nextLine) {
          const effectMatch = NEXT_EFFECTS_LINE_RE.exec(nextLine.text);
          if (effectMatch) {
            endIndex = index + 1;
            effectsRange = lineValueRange(nextLine, index + 1, effectMatch[1] ?? '', effectMatch[0].length);
          }
        }
        const endRangeLine = lines[endIndex] ?? line;
        currentNodeNextTarget = {
          startLine: index + 1,
          endLine: endIndex + 1,
          startOffset: line.startOffset,
          endOffset: lineFullEndOffset(endRangeLine),
          targetRange: lineValueRange(line, index, rawTarget, nextMatch[0].length),
          effectsRange,
        };
        continue;
      }
    }

    if (currentNodeTitle !== null && OPTION_LINE_RE.test(trimmed)) {
      let blockEnd = index;
      for (let cursor = index + 1; cursor < lines.length; cursor++) {
        const nextTrimmed = lines[cursor]!.text.trimStart();
        if (
          NEXT_TARGET_LINE_RE.test(nextTrimmed)
          || OPTION_LINE_RE.test(nextTrimmed)
          || NODE_HEADING_RE.test(nextTrimmed)
          || (!nextTrimmed.startsWith('##') && CHAPTER_HEADING_RE.test(nextTrimmed))
        ) {
          break;
        }
        blockEnd = cursor;
      }
      const option = scanOptionRange(lines, index, currentNodeOptions.length, blockEnd);
      if (option) currentNodeOptions.push(option);
    }
  }

  flushChapter(lines.length - 1);
  return chapters;
}

export function analyzeStorySource(raw: string): StorySourceAnalysis {
  const lines = splitSourceLines(raw);
  const newline = detectNewline(raw);
  const frontmatterDocuments = scanFrontmatterDocuments(lines, raw);
  let frontmatter: StoryFrontmatterRange | null = frontmatterDocuments.find((document) => document.startLine === 1) ?? null;

  if (isFrontmatterFence(lines[0]?.text ?? '')) {
    for (let index = 1; index < lines.length; index++) {
      const line = lines[index]!;
      if (!isFrontmatterFence(line.text)) continue;

      const opening = lines[0]!;
      const contentStartLine = 2;
      const contentEndLine = index;
      const contentStartOffset = opening.endOffset + opening.newline.length;
      const contentEndOffset = line.startOffset > contentStartOffset
        ? line.startOffset - (lines[index - 1]?.newline.length ?? 0)
        : contentStartOffset;
      const endOffset = line.endOffset + line.newline.length;
      frontmatter = {
        startLine: 1,
        endLine: index + 1,
        startOffset: 0,
        endOffset,
        contentStartLine,
        contentEndLine,
        contentStartOffset,
        contentEndOffset,
        content: raw.slice(contentStartOffset, Math.max(contentStartOffset, contentEndOffset)),
      };
      break;
    }
  }

  const diagnostics: StorySourceDiagnostic[] = frontmatterDocuments
    .filter((document) => document.startLine !== frontmatter?.startLine)
    .map((document) => ({
      code: 'FRONTMATTER_MULTIPLE_DOCUMENTS',
      message: 'Additional frontmatter document fences are treated as story body text.',
      range: {
        startLine: document.startLine,
        endLine: document.endLine,
        startOffset: document.startOffset,
        endOffset: document.endOffset,
      },
    }));
  const bodyStartLine = frontmatter ? frontmatter.endLine + 1 : 1;
  const bodyStartOffset = frontmatter ? frontmatter.endOffset : 0;

  return {
    raw,
    newline,
    lines,
    frontmatter,
    frontmatterDocuments,
    diagnostics,
    layout: scanLayoutRange(lines, frontmatter),
    chapters: scanChapters(lines, bodyStartLine),
    bodyStartLine,
    bodyStartOffset,
  };
}

export function normalizeStorySource(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function restoreStoryNewline(raw: string, editedLfText: string): string {
  const newline = analyzeStorySource(raw).newline;
  if (newline === '\n') return editedLfText;
  return editedLfText.replace(/\n/g, newline);
}
