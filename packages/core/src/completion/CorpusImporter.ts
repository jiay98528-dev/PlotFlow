/**
 * CorpusImporter — 语料导入器 (M5-17)
 *
 * @packageDocumentation
 * @remarks
 * 支持从 .txt / .mdstory / .csv 文件导入外部语料，
 * 自动去重、分段、清洗，产出 CorpusEntry[] 供预处理管道使用。
 *
 * ## 文件支持
 * - `.txt`：纯文本，编码自动检测（UTF-8 / GBK）
 * - `.mdstory`：PlotFlow 故事文件，提取正文内容（跳过标题和选项语法）
 * - `.csv`：逗号分隔，要求 header 包含 `category` 和 `text` 列
 *
 * ## 约束
 * - 单文件 ≤ 10MB
 * - 总计 ≤ 50MB（由调用方维护）
 * - 自动去重：编辑距离 < 3 视为重复
 *
 * ## 使用示例
 * ```typescript
 * const importer = new CorpusImporter();
 *
 * // 从原始文本导入
 * const entries = await importer.importFromText('...', 'txt', 'RPG对话');
 *
 * // 从文件内容导入（由 Electron IPC 提供文件内容）
 * const result = await importer.importFromFile({
 *   fileName: 'dialogues.txt',
 *   content: rawText,
 *   size: rawText.length,
 *   type: 'txt',
 * });
 * ```
 *
 * @version 0.1.0
 */

import type { CorpusEntry } from './types.js';

// ============================================================================
// 常量
// ============================================================================

/** 单文件最大大小 (10MB) */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** 编辑距离去重阈值（小于此值视为重复） */
const DEDUP_EDIT_DISTANCE_THRESHOLD = 3;

/** 分段最小长度（字符数） */
const MIN_SEGMENT_LENGTH = 4;

/** 分段最大长度（字符数） */
const MAX_SEGMENT_LENGTH = 500;

/** URL 正则 */
const URL_PATTERN = /https?:\/\/[^\s，。、；：！？）)]】」』》\n\r]+/gi;

/** Markdown 链接正则 */
const MD_LINK_PATTERN = /\[([^\]]*)\]\([^)]+\)/g;

/** 代码块正则（fenced + inline） */
const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;

/** 行内代码正则 */
const INLINE_CODE_PATTERN = /`[^`]+`/g;

/** HTML 标签正则 */
const HTML_TAG_PATTERN = /<[^>]+>/g;

/** 多余空白正则（连续空格 → 单个空格） */
const EXTRA_WHITESPACE_PATTERN = /\s{2,}/g;

/** CSV 默认分类名称 */
const CSV_DEFAULT_CATEGORY = '导入语料';

/** 默认分类（当无法从内容推断时使用） */
const DEFAULT_CATEGORY = '导入语料';

// ============================================================================
// 类型定义
// ============================================================================

/** 导入文件元信息 */
export interface ImportFileInfo {
  /** 文件名 */
  readonly fileName: string;
  /** 文件原始内容 */
  readonly content: string;
  /** 文件大小（字节） */
  readonly size: number;
  /** 文件类型 */
  readonly type: 'txt' | 'mdstory' | 'csv';
}

/** 单次导入结果 */
export interface ImportResult {
  /** 本次导入新增的条目数（去重后实际添加的数量） */
  readonly newEntriesCount: number;
  /** 跳过的重复条目数 */
  readonly skippedDuplicates: number;
  /** 清洗前原始分段数 */
  readonly rawSegments: number;
  /** 清洗后有效分段数 */
  readonly validSegments: number;
  /** 新增的 CorpusEntry 列表 */
  readonly entries: CorpusEntry[];
  /** 文件信息 */
  readonly sourceFile: ImportFileInfo;
}

/** 导入器统计 */
export interface ImporterStats {
  /** 已处理的文件数 */
  filesProcessed: number;
  /** 已处理的原始分段数 */
  totalRawSegments: number;
  /** 已处理的有效分段数 */
  totalValidSegments: number;
  /** 跳过的重复数 */
  totalSkippedDuplicates: number;
  /** 累计条目数 */
  totalEntries: number;
}

// ============================================================================
// 编辑距离计算
// ============================================================================

/**
 * 计算两个字符串的编辑距离（Levenshtein distance）。
 *
 * 使用滚动数组优化空间复杂度至 O(min(m, n))。
 *
 * @param a - 字符串 A
 * @param b - 字符串 B
 * @returns 编辑距离
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // 确保 a 是较短的字符串，以优化空间
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const m = a.length;
  const n = b.length;

  // 滚动数组 — 只需要两行
  let prev: number[] = new Array(m + 1);
  let curr: number[] = new Array(m + 1);

  // 初始化第一行
  for (let j = 0; j <= m; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,        // 删除
        curr[j - 1]! + 1,    // 插入
        prev[j - 1]! + cost, // 替换
      );
    }
    // 交换数组
    [prev, curr] = [curr, prev];
  }

  return prev[m]!;
}

// ============================================================================
// CorpusImporter 类
// ============================================================================

export class CorpusImporter {
  /** 已导入的所有条目（用于去重检查） */
  private existingEntries: CorpusEntry[] = [];

  /** 累计统计 */
  private stats: ImporterStats = {
    filesProcessed: 0,
    totalRawSegments: 0,
    totalValidSegments: 0,
    totalSkippedDuplicates: 0,
    totalEntries: 0,
  };

  // ==========================================================================
  // 公共方法
  // ==========================================================================

  /**
   * 从 ImportFileInfo 导入语料。
   *
   * 完整的导入流程：
   * 1. 文件大小检查（单文件 ≤ 10MB）
   * 2. 按文件类型解析分段
   * 3. 清洗（去 URL/代码/HTML）
   * 4. 去重（编辑距离检查）
   * 5. 包装为 CorpusEntry[]
   *
   * @param fileInfo - 文件信息（由 Electron IPC 提供内容）
   * @returns 导入结果
   * @throws 如果文件大小超过限制、格式不支持
   */
  importFromFile(fileInfo: ImportFileInfo): ImportResult {
    // 大小检查
    if (fileInfo.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `文件 "${fileInfo.fileName}" 大小 (${this.formatSize(fileInfo.size)}) ` +
        `超过单文件最大限制 (${this.formatSize(MAX_FILE_SIZE_BYTES)})`,
      );
    }

    // 分段
    let segments: string[];

    switch (fileInfo.type) {
      case 'txt':
        segments = this.parseTxt(fileInfo.content);
        break;
      case 'mdstory':
        segments = this.parseMdstory(fileInfo.content);
        break;
      case 'csv':
        segments = this.parseCsv(fileInfo.content);
        break;
      default: {
        throw new Error(`不支持的文件类型: ${fileInfo.type}`);
      }
    }

    const rawSegments = segments.length;

    // 清洗
    const cleaned = this.cleanSegments(segments);
    const validSegments = cleaned.length;

    // 去重
    const { newEntries, skippedDuplicates } = this.deduplicate(cleaned);

    // 包装为 CorpusEntry
    const category = this.inferCategory(fileInfo);
    const entries: CorpusEntry[] = newEntries.map((text) => ({
      category,
      text,
      tokens: [], // 由预处理管道填充
    }));

    const newEntriesCount = entries.length;

    // 更新统计
    this.existingEntries.push(...entries);
    this.stats.filesProcessed++;
    this.stats.totalRawSegments += rawSegments;
    this.stats.totalValidSegments += validSegments;
    this.stats.totalSkippedDuplicates += skippedDuplicates;
    this.stats.totalEntries += newEntriesCount;

    return {
      newEntriesCount,
      skippedDuplicates,
      rawSegments,
      validSegments,
      entries,
      sourceFile: fileInfo,
    };
  }

  /**
   * 直接从文本导入（用于从编辑器内容导入）。
   *
   * @param text - 原始文本
   * @param type - 文本类型（'txt' 或 'mdstory'）
   * @param category - 分类标签（可选，默认根据内容推断）
   * @returns 导入结果
   */
  importFromText(
    text: string,
    type: 'txt' | 'mdstory',
    category?: string,
  ): ImportResult {
    const fileInfo: ImportFileInfo = {
      fileName: 'inline',
      content: text,
      size: new TextEncoder().encode(text).length,
      type,
    };

    // 分段
    let segments: string[];
    if (type === 'txt') {
      segments = this.parseTxt(text);
    } else {
      segments = this.parseMdstory(text);
    }

    const rawSegments = segments.length;
    const cleaned = this.cleanSegments(segments);
    const validSegments = cleaned.length;
    const { newEntries, skippedDuplicates } = this.deduplicate(cleaned);

    const resolvedCategory = category ?? DEFAULT_CATEGORY;
    const entries: CorpusEntry[] = newEntries.map((text) => ({
      category: resolvedCategory,
      text,
      tokens: [],
    }));

    const newEntriesCount = entries.length;

    this.existingEntries.push(...entries);

    return {
      newEntriesCount,
      skippedDuplicates,
      rawSegments,
      validSegments,
      entries,
      sourceFile: fileInfo,
    };
  }

  /**
   * 批量导入多个文件。
   *
   * @param files - ImportFileInfo 数组
   * @returns ImportResult 数组
   */
  importMultiple(files: ImportFileInfo[]): ImportResult[] {
    const results: ImportResult[] = [];
    for (const file of files) {
      results.push(this.importFromFile(file));
    }
    return results;
  }

  /**
   * 重置去重状态和统计。
   *
   * 当导入完成并已训练 NGramEngine 后调用此方法，
   * 清空已有条目引用（降低内存占用），但不影响已训练的引擎。
   */
  reset(): void {
    this.existingEntries = [];
    this.stats = {
      filesProcessed: 0,
      totalRawSegments: 0,
      totalValidSegments: 0,
      totalSkippedDuplicates: 0,
      totalEntries: 0,
    };
  }

  /**
   * 获取当前统计。
   */
  getStats(): ImporterStats {
    return { ...this.stats };
  }

  /**
   * 获取当前已导入的条目数。
   */
  get entryCount(): number {
    return this.existingEntries.length;
  }

  // ==========================================================================
  // 文件解析
  // ==========================================================================

  /**
   * 解析 .txt 文件：按标点分句。
   */
  private parseTxt(content: string): string[] {
    const clean = content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    return this.splitSentences(clean);
  }

  /**
   * 解析 .mdstory 文件：提取正文，跳过标题和选项语法。
   */
  private parseMdstory(content: string): string[] {
    const lines = content.split(/\r?\n/);
    const bodyLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // 跳过空行
      if (trimmed === '') continue;

      // 跳过 Frontmatter
      if (trimmed === '---') continue;

      // 跳过章节标题
      if (/^#{1,3}\s/.test(trimmed)) continue;

      // 跳过选项语法行
      if (/^\[选项\]/.test(trimmed)) continue;
      if (/^\[条件\]/.test(trimmed)) continue;
      if (/^\[效果\]/.test(trimmed)) continue;

      // 跳过注释
      if (/^%%/.test(trimmed) || /^<!--/.test(trimmed)) continue;

      // 有效正文行
      bodyLines.push(trimmed);
    }

    const bodyText = bodyLines.join(' ');
    return this.splitSentences(bodyText);
  }

  /**
   * 解析 .csv 文件：要求 header 包含 `category` 和 `text` 列。
   */
  private parseCsv(content: string): string[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) {
      throw new Error('CSV 文件至少需要一行 header 和一行数据');
    }

    // 解析 header
    const header = this.parseCSVLine(lines[0]!);
    const textIdx = header.findIndex(
      (h) => h.trim().toLowerCase() === 'text',
    );

    if (textIdx === -1) {
      throw new Error('CSV 文件缺少 "text" 列');
    }

    const segments: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseCSVLine(lines[i]!);
      if (fields.length <= textIdx) continue;

      const text = fields[textIdx]!.trim();
      if (text.length >= MIN_SEGMENT_LENGTH) {
        segments.push(text);
      }
    }

    return segments;
  }

  // ==========================================================================
  // 文本处理
  // ==========================================================================

  /**
   * 将文本分割为句子。
   *
   * 按句号、问号、感叹号、分句标点分割，
   * 每段长度控制在 MIN_SEGMENT_LENGTH ~ MAX_SEGMENT_LENGTH。
   */
  private splitSentences(text: string): string[] {
    // 先按句末标点分割
    const rawParts = text.split(/(?<=[。！？.!?\n])/);
    const segments: string[] = [];
    let buffer = '';

    for (const part of rawParts) {
      const trimmed = part.trim();
      if (trimmed === '') continue;

      if (buffer.length + trimmed.length > MAX_SEGMENT_LENGTH) {
        if (buffer.length >= MIN_SEGMENT_LENGTH) {
          segments.push(buffer.trim());
        }
        buffer = trimmed;
      } else {
        buffer += (buffer ? ' ' : '') + trimmed;
      }
    }

    if (buffer.trim().length >= MIN_SEGMENT_LENGTH) {
      segments.push(buffer.trim());
    }

    return segments;
  }

  /**
   * 清洗分段文本：去 URL、代码、HTML、多余空白。
   */
  private cleanSegments(segments: string[]): string[] {
    const cleaned: string[] = [];

    for (const seg of segments) {
      let text = seg;

      // 1. 去除围栏代码块
      text = text.replace(FENCED_CODE_BLOCK_PATTERN, '');
      // 2. 去除 Markdown 链接（保留显示文本）
      text = text.replace(MD_LINK_PATTERN, '$1');
      // 3. 去除 URL
      text = text.replace(URL_PATTERN, '');
      // 4. 去除行内代码
      text = text.replace(INLINE_CODE_PATTERN, '');
      // 5. 去除 HTML 标签
      text = text.replace(HTML_TAG_PATTERN, '');
      // 6. 压缩多余空白
      text = text.replace(EXTRA_WHITESPACE_PATTERN, ' ').trim();

      // 过短或为空
      if (text.length < MIN_SEGMENT_LENGTH) continue;
      // 若清洗后只剩下数字或纯标点
      if (/^[\d\s,，。、；：！？.!?-]+$/.test(text)) continue;

      cleaned.push(text);
    }

    return cleaned;
  }

  /**
   * 去重：编辑距离 < 3 视为重复。
   *
   * 为提升性能，先检查已有条目中的完全匹配，再计算编辑距离。
   * 支持"渐进式去重"：新导入的条目之间也要互查。
   *
   * @param texts - 待去重的文本数组
   * @returns 新条目文本和跳过的数量
   */
  private deduplicate(
    texts: string[],
  ): { newEntries: string[]; skippedDuplicates: number } {
    const newEntries: string[] = [];
    let skipped = 0;

    for (const text of texts) {
      // 正查询：是否与已有条目重复
      const isDuplicate = this.findDuplicate(text);
      if (isDuplicate) {
        skipped++;
        continue;
      }

      // 互查：是否与新条目中的某条重复
      const isDuplicateInNew = newEntries.some((existing) => {
        const d = levenshteinDistance(
          text.slice(0, Math.min(text.length, 100)),
          existing.slice(0, Math.min(existing.length, 100)),
        );
        return d < DEDUP_EDIT_DISTANCE_THRESHOLD;
      });

      if (isDuplicateInNew) {
        skipped++;
        continue;
      }

      newEntries.push(text);
    }

    return { newEntries, skippedDuplicates: skipped };
  }

  /**
   * 在已有条目中查找编辑距离 < 3 的重复项。
   */
  private findDuplicate(text: string): boolean {
    // 快速通道：精确匹配
    const exactMatch = this.existingEntries.some((e) => e.text === text);
    if (exactMatch) return true;

    // 精确匹配失败，计算编辑距离（限制文本前 100 字）
    const sample = text.slice(0, Math.min(text.length, 100));
    for (const entry of this.existingEntries) {
      const entrySample = entry.text.slice(
        0,
        Math.min(entry.text.length, 100),
      );
      const d = levenshteinDistance(sample, entrySample);
      if (d < DEDUP_EDIT_DISTANCE_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  // ==========================================================================
  // 工具方法
  // ==========================================================================

  /**
   * 从文件信息推断分类。
   */
  private inferCategory(fileInfo: ImportFileInfo): string {
    // 如果是 CSV 且有 category 列，由 parseCsv 处理
    if (fileInfo.type === 'csv') {
      return CSV_DEFAULT_CATEGORY;
    }

    // 从文件名推断
    const name = fileInfo.fileName.toLowerCase();
    if (name.includes('dialog') || name.includes('对话')) return '对话';
    if (name.includes('narrat') || name.includes('叙述')) return '叙事';
    if (name.includes('descri') || name.includes('描述')) return '描述';
    if (name.includes('rpg') || name.includes('角色')) return 'RPG对话';

    return DEFAULT_CATEGORY;
  }

  /**
   * 格式化文件大小为可读字符串。
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * 解析 CSV 单行（支持带引号的字段）。
   */
  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  }
}
