/**
 * PlotFlow 折叠范围提供者 — M1
 *
 * 注册 Monaco `FoldingRangeProvider`，为 `# 章节：` 和 `## 节点：` 标记提供折叠区域。
 *
 * 折叠规则：
 * - `# 章节：` 折叠到下一个 `# 章节：` 之前（或文件末尾）
 * - `## 节点：` 折叠到下一个 `## 节点：` 或 `# 章节：` 之前（或文件末尾）
 * - 仅当折叠范围覆盖至少 2 行时才注册（即折叠标记与下一标记之间有内容）
 *
 * @see TAD.md §2.3.2 — Folding 集成
 */

import { languages, editor } from 'monaco-editor';
type ITextModel = editor.ITextModel;

// ============================================================================
// 内部类型
// ============================================================================

/** 折叠标记类型 */
type MarkerType = 'chapter' | 'node';

/** 行内折叠标记 */
interface Marker {
  /** 1-based 行号 */
  readonly line: number;
  readonly type: MarkerType;
}

// ============================================================================
// 正则
// ============================================================================

/** 匹配 `# 章节：XXX` 或 `#章节：XXX` */
const CHAPTER_PATTERN = /^#\s+章节：/;

/** 匹配 `## 节点：XXX` 或 `##节点：XXX` */
const NODE_PATTERN = /^##\s+节点：/;

// ============================================================================
// FoldingRangeProvider
// ============================================================================

/**
 * 注册 PlotFlow 折叠范围提供者。
 *
 * 应在 Monaco Editor 初始化完成后调用，
 * 通常在 `onMonacoReady` 或组件 mount 时触发。
 */
export function registerFoldingProvider(): void {
  languages.registerFoldingRangeProvider('plotflow', {
    provideFoldingRanges(model) {
      const lineCount = model.getLineCount();
      const markers = collectMarkers(model, lineCount);

      if (markers.length === 0) {
        return [];
      }

      return buildFoldingRanges(markers, lineCount);
    },
  });
}

// ============================================================================
// 扫描
// ============================================================================

/**
 * 遍历模型所有行，收集章节和节点标记。
 *
 * @param model - Monaco 文本模型
 * @param lineCount - 总行数（避免重复调用）
 * @returns 按行号升序排列的标记列表
 */
function collectMarkers(
  model: ITextModel,
  lineCount: number,
): Marker[] {
  const markers: Marker[] = [];

  for (let line = 1; line <= lineCount; line++) {
    const content = model.getLineContent(line);

    if (CHAPTER_PATTERN.test(content)) {
      markers.push({ line, type: 'chapter' });
    } else if (NODE_PATTERN.test(content)) {
      markers.push({ line, type: 'node' });
    }
  }

  return markers;
}

// ============================================================================
// 折叠范围计算
// ============================================================================

/**
 * 根据标记列表构建折叠范围。
 *
 * 规则：
 * - Chapter 范围：从本章节行到下一章节行之前（或 EOF）
 * - Node 范围：从本节点行到下一节点或章节行之前（或 EOF）
 * - 仅当 `end > start`（即至少包含 2 行）时生成 FoldingRange
 *
 * @param markers - 已排序的标记列表
 * @param lineCount - 总行数
 * @returns FoldingRange 数组
 */
function buildFoldingRanges(
  markers: Marker[],
  lineCount: number,
): languages.FoldingRange[] {
  const ranges: languages.FoldingRange[] = [];

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    if (!current) continue;
    const endLine = findEndLine(current, markers, i, lineCount);

    // 只注册有实际内容的折叠区域（至少 2 行）
    if (endLine > current.line) {
      ranges.push({
        start: current.line,
        end: endLine,
        kind: languages.FoldingRangeKind.Region,
      });
    }
  }

  return ranges;
}

/**
 * 查找指定标记的折叠结束行。
 *
 * - Chapter 标记：结束于下一个 Chapter 标记的前一行
 * - Node 标记：结束于下一个 Node 或 Chapter 标记的前一行
 * - 如果没有后续标记则结束于文件末尾
 *
 * @param current - 当前标记
 * @param markers - 全部标记列表
 * @param currentIndex - 当前标记在列表中的索引
 * @param lineCount - 总行数
 * @returns 折叠范围的结束行号（1-based）
 */
function findEndLine(
  current: Marker,
  markers: Marker[],
  currentIndex: number,
  lineCount: number,
): number {
  // 从下一个标记开始搜索
  for (let j = currentIndex + 1; j < markers.length; j++) {
    const next = markers[j];
    if (!next) continue;

    if (current.type === 'chapter') {
      // Chapter 遇到下一个 Chapter 时结束
      if (next.type === 'chapter') {
        return next.line - 1;
      }
    } else {
      // Node 遇到下一个 Node 或 Chapter 时结束
      if (next.type === 'node' || next.type === 'chapter') {
        return next.line - 1;
      }
    }
  }

  // 没有后续标记，折叠到文件末尾
  return lineCount;
}
