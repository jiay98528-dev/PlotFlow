/**
 * TXT 纯文本导出器
 *
 * @packageDocumentation
 * @remarks
 * 将 PlotFlowData AST 导出为纯文本格式（.txt）。
 * 移除所有 Markdown 语法标记、Frontmatter、条件/效果子行及变量引用，
 * 仅保留正文纯文本、选项描述文本和跳转目标名称。
 *
 * 对应里程碑 M4-10。
 *
 * @version 0.1.0
 */

import type { PlotFlowData, Chapter, StoryNode, Option } from '../types/ast.js';
import type { ParseResult } from '../result.js';
import { success, failure } from '../result.js';
import { checkExportStructure } from './guard.js';

/** CJK + Japanese character class for variable name matching */
const CJK_KANA_CHARS = '぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿';
const VAR_NAME_RE = new RegExp(`\\$([\\w${CJK_KANA_CHARS}.（）()]+)`, 'g');

// ============================================================================
// Markdown 剥离工具
// ============================================================================

/**
 * 从文本中剥离 Markdown 语法标记，仅保留纯文本。
 *
 * 移除内容：
 * - 加粗/斜体标记（** * __ _）
 * - 标题标记（#）
 * - 行内代码反引号
 * - HTML/XML 注释
 * - 变量引用 $ 前缀（保留变量名）
 * - 无序列表标记（- *）
 * - 有序列表数字（1. 2.）
 * - 链接语法 [text](url) → text
 * - 图片语法 ![alt](url) → alt
 *
 * @param text - 原始 Markdown 文本
 * @returns 纯文本
 */
function stripMarkdown(text: string): string {
  let result = text;

  // 加粗/斜体：**text** 和 *text*
  result = result.replace(/\*\*(.+?)\*\*/g, '$1');
  result = result.replace(/\*(.+?)\*/g, '$1');
  // 加粗/斜体：__text__ 和 _text_（不匹配单词内下划线）
  result = result.replace(/(?<!\w)__(.+?)__(?!\w)/g, '$1');
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1');

  // 标题标记
  result = result.replace(/^#{1,6}\s+/gm, '');

  // 行内代码
  result = result.replace(/`(.+?)`/g, '$1');

  // 图片 ![alt](url) → alt（必须在链接之前处理，避免 ! 残留）
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 链接 [text](url) → text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // HTML/XML 注释
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // 变量引用 $ 前缀（保留变量名/路径）
  result = result.replace(VAR_NAME_RE, '$1');

  // 无序列表标记（行首的 - * + 后跟空格）
  result = result.replace(/^[ \t]*[-*+]\s+/gm, '');
  // 有序列表标记（行首的数字.后跟空格）
  result = result.replace(/^[ \t]*\d+\.\s+/gm, '');

  // 水平分割线（三个以上 - * _，单独一行）
  result = result.replace(/^[ \t]*[-*_]{3,}\s*$/gm, '');

  // 每行 trim
  const lines = result.split('\n');
  const trimmedLines = lines.map((line) => line.trim());

  // 移除首尾空行，压缩连续空行至最多一个
  const cleaned: string[] = [];
  let lastWasEmpty = false;
  for (let i = 0; i < trimmedLines.length; i++) {
    const line = trimmedLines[i]!;
    if (line === '') {
      if (!lastWasEmpty) {
        cleaned.push('');
        lastWasEmpty = true;
      }
    } else {
      cleaned.push(line);
      lastWasEmpty = false;
    }
  }

  // 移除尾部连续空行
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === '') {
    cleaned.pop();
  }

  return cleaned.join('\n');
}

/** AST body retains option syntax; TXT output emits options separately. */
function extractNarrativeBody(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n');
  const firstOption = normalized.search(/(?:^|\n)[ \t]*\[选项\]/u);
  return firstOption >= 0 ? normalized.slice(0, firstOption).trim() : normalized.trim();
}

// ============================================================================
// 条件文本格式化
// ============================================================================

/**
 * 格式化选项条件原始文本为可读形式。
 *
 * 移除内容：
 * - 变量引用 $ 前缀
 *
 * @param raw - 条件原始文本（如 `($金币>=10) AND ($武器!='无')`）
 * @returns 格式化后的条件文本，或 null（无条件时）
 */
function formatCondition(raw: string | null): string | null {
  if (!raw) return null;

  const text = raw.trim();
  if (text === '') return null;

  // 剥除外层包裹的圆括号
  let inner = text;
  if (inner.startsWith('(') && inner.endsWith(')')) {
    inner = inner.slice(1, -1).trim();
  }

  // 剥离 $ 前缀
  inner = inner.replace(VAR_NAME_RE, '$1');

  return inner;
}

// ============================================================================
// 构建选项
// ============================================================================

/**
 * 格式化单条选项为导出文本行。
 *
 * 格式：
 * ```
 * 选项: 描述 → 跳转目标
 * 选项: 描述 → 跳转目标 (条件: 条件文本)
 * ```
 *
 * @param option - 选项对象
 * @returns 格式化后的选项文本
 */
function formatOption(option: Option): string {
  let result = `选项: ${stripMarkdown(option.description)}`;

  // 跳转目标
  const target = option.targetFullId ?? option.targetNodeId;
  if (target) {
    result += ` → ${target}`;
  }

  // 条件
  const condText = formatCondition(option.conditionRaw);
  if (condText) {
    result += ` (条件: ${condText})`;
  }

  return result;
}

// ============================================================================
// 构建节点
// ============================================================================

/**
 * 格式化单个节点为导出文本块。
 *
 * @param node - 故事节点
 * @returns 节点文本块（不含尾部空行）
 */
function formatNode(node: StoryNode): string {
  const parts: string[] = [];

  // 节点标题
  const title = stripMarkdown(node.title) || node.title;
  parts.push(title);

  // 节点正文（Markdown 已剥离）
  const body = stripMarkdown(extractNarrativeBody(node.body));
  if (body) {
    parts.push(body);
  }

  // 选项列表
  if (node.options.length > 0) {
    parts.push('');
  }
  for (const option of node.options) {
    parts.push(formatOption(option));
  }

  return parts.join('\n');
}

// ============================================================================
// 构建章节
// ============================================================================

/**
 * 格式化单个章节为导出文本块。
 *
 * @param chapter - 章节对象
 * @returns 章节文本块（不含尾部空行）
 */
function formatChapter(chapter: Chapter): string {
  const parts: string[] = [];

  // 章节分隔线
  parts.push('---');

  // 章节标题（非匿名时输出）
  if (!chapter.isAnonymous) {
    const title = stripMarkdown(chapter.title) || chapter.title;
    parts.push(title);
    parts.push('');
  }

  // 节点列表
  for (let ni = 0; ni < chapter.nodes.length; ni++) {
    const node = chapter.nodes[ni]!;

    const nodeBlock = formatNode(node);
    if (nodeBlock) {
      parts.push(nodeBlock);
    }

    // 节点间双换行分隔
    if (ni < chapter.nodes.length - 1) {
      parts.push('');
    }
  }

  return parts.join('\n');
}

// ============================================================================
// 主导出函数
// ============================================================================

/**
 * 将 PlotFlowData 导出为纯文本（TXT）字符串。
 *
 * 输出格式：
 * ```
 * ---
 * 章节标题（如非匿名）
 *
 * 节点标题
 * 节点正文内容...
 *
 * 选项: 选项A描述 → 跳转到[目标节点]
 * 选项: 选项B描述 (条件: xxx)
 *
 * ---
 * ...下一章节...
 * ```
 *
 * 移除内容：
 * - Markdown 语法标记（# ## * ** 等）
 * - Frontmatter YAML 块
 * - 条件/效果子行（条件: / 效果:）
 * - 变量引用 $ 符号
 *
 * 保留内容：
 * - 正文纯文本
 * - 选项描述文本
 * - 跳转目标名称（附加在选项后）
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns ParseResult — ok 携带纯文本字符串，fail 携带诊断信息
 * @throws 不抛异常，所有错误通过返回值的 ok: false 表示
 */
export function exportTXT(data: PlotFlowData): ParseResult<string> {
  try {
    const structuralErrors = checkExportStructure(data);
    if (structuralErrors.length > 0) return failure(structuralErrors);
    const parts: string[] = [];

    // 故事标题（非默认时输出）
    const title = data.meta.title?.trim();
    if (title && title !== 'Untitled') {
      parts.push(title);
      parts.push('');
    }

    // 逐章节导出
    for (let ci = 0; ci < data.chapters.length; ci++) {
      const chapter = data.chapters[ci]!;

      const chapterBlock = formatChapter(chapter);
      if (chapterBlock) {
        parts.push(chapterBlock);
      }

      // 章节之间空行分隔
      if (ci < data.chapters.length - 1) {
        parts.push('');
      }
    }

    const output = parts.join('\n');
    return success(output + '\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure([
      {
        id: 'EXPORT_TXT_ERROR',
        code: 'E005',
        severity: 'error',
        message: 'TXT 导出失败',
        detail: message,
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
      },
    ]);
  }
}
