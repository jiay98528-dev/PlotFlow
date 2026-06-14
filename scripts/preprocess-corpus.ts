/**
 * 语料预处理脚本 (M5-02/05)
 *
 * @packageDocumentation
 * @remarks
 * 将原始 .txt 文本文件处理为 PlotFlow 补全引擎可用的压缩 JSON 语料格式。
 *
 * ## 工作流程
 * ```
 * 原始 .txt 文件 → 去特殊符号 → 分词 (Intl.Segmenter) → 句式分类 → 去重 → 统计 → 压缩 JSON 输出
 * ```
 *
 * ## 输入格式
 * 原始文本文件，每行一句或一段。文件名前缀自动推断分类：
 * - `rpg-*.txt`, `dialog-*.txt` → "RPG对话"
 * - `visual-novel-*.txt`, `narrative-*.txt` → "视觉小说"
 * - `puzzle-*.txt` → "解谜"
 * - `general-*.txt` → "通用"
 *
 * ## 输出格式
 * ```json
 * [
 *   { "category": "RPG对话", "text": "勇者大人，请救救我们！", "tokens": ["勇", "者", "大", "人", ...] }
 * ]
 * ```
 *
 * ## 使用示例
 * ```bash
 * # 处理单个文件
 * npx tsx scripts/preprocess-corpus.ts -i raw/rpg.txt -o corpus/rpg.json -c RPG对话
 *
 * # 批量处理目录（自动推断分类）
 * npx tsx scripts/preprocess-corpus.ts -d raw/ -o packages/core/corpus/zh.json --stats
 * ```
 *
 * @version 0.1.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// 类型定义
// ============================================================================

/** 语料条目 */
interface CorpusEntry {
  category: string;
  text: string;
  tokens: string[];
}

/** 分词统计信息 */
interface TokenStats {
  totalEntries: number;
  totalTokens: number;
  categories: Record<string, number>;
  categoryTokens: Record<string, number>;
  avgSentenceLength: number;
  uniqueTokens: number;
  maxSentenceLength: number;
  minSentenceLength: number;
}

/** 命令行参数 */
interface CliOptions {
  inputFile?: string;
  inputDir?: string;
  output: string;
  category?: string;
  minLength: number;
  maxLength: number;
  stats: boolean;
  pretty: boolean;
}

// ============================================================================
// 常量
// ============================================================================

/** 文件名前缀到分类的映射 */
const CATEGORY_MAP: Record<string, string> = {
  rpg: 'RPG对话',
  'visual-novel': '视觉小说',
  puzzle: '解谜',
  general: '通用',
  dialog: 'RPG对话',
  narrative: '视觉小说',
};

/** 需要移除的特殊符号（去除与叙事无关的符号，保留中英文标点） */
const SPECIAL_CHARS_PATTERN = new RegExp(
  '[@$%^&*_+={}\\[\\]|\\\\:;"\'<>,.?/~`！@#￥%……&*（）——+={}【】；：""\'\'，。？、~`·]',
  'g',
);

/** 纯数字/符号行正则 */
const SYMBOL_ONLY_PATTERN = new RegExp("^[\\d\\s#@$%^&*()_+\\-=\\[\\]{}|;:',.<>?/!]+$");

/** 连续空白正则 */
const WHITESPACE_PATTERN = /\s+/g;

// ============================================================================
// 分词器
// ============================================================================

/**
 * 使用 Intl.Segmenter 对中文文本进行分词。
 *
 * Intl.Segmenter 是 ECMAScript 国际化 API 的一部分，
 * 支持按单词粒度分割中日韩文本（Node.js 16+ / 现代浏览器）。
 *
 * 降级策略：Intl.Segmenter 不可用时逐字拆分。
 *
 * @param text - 原始文本
 * @returns token 数组（不含空白和纯标点）
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];

  try {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    const segments = segmenter.segment(text);

    for (const segment of segments) {
      const word = segment.segment.trim();
      if (word.length > 0) {
        tokens.push(word);
      }
    }
  } catch {
    // 降级方案：逐字分词
    for (const char of text) {
      if (char.trim().length > 0) {
        tokens.push(char);
      }
    }
  }

  return tokens;
}

// ============================================================================
// 文本清洗
// ============================================================================

/**
 * 清洗原始文本。
 *
 * - 移除特殊符号
 * - 规范化空白
 * - 跳过纯数字/符号行
 * - 跳过过短/过长行
 *
 * @param text - 原始文本行
 * @param options - 清洗选项
 * @returns 清洗后的文本，不符合要求则返回 null
 */
function cleanText(text: string, options: {
  minLength: number;
  maxLength: number;
}): string | null {
  let cleaned = text.trim();
  if (cleaned.length === 0) return null;

  // 跳过纯数字/符号行
  if (SYMBOL_ONLY_PATTERN.test(cleaned)) return null;

  // 移除非叙事特殊符号
  cleaned = cleaned.replace(SPECIAL_CHARS_PATTERN, '');

  // 规范化空白
  cleaned = cleaned.replace(WHITESPACE_PATTERN, ' ').trim();
  if (cleaned.length === 0) return null;

  // 跳过过短行
  if (cleaned.length < options.minLength) return null;

  // 跳过过长行（按字符计，非 token）
  if (cleaned.length > options.maxLength * 5) return null;

  return cleaned;
}

// ============================================================================
// 分类检测
// ============================================================================

/**
 * 从文件名推断语料分类。
 *
 * @param filename - 文件名
 * @param defaultCategory - 默认分类
 * @returns 推断的分类名称
 */
function detectCategory(filename: string, defaultCategory: string = '通用'): string {
  const base = path.basename(filename, path.extname(filename)).toLowerCase();

  for (const [prefix, category] of Object.entries(CATEGORY_MAP)) {
    if (base.startsWith(prefix)) {
      return category;
    }
  }

  return defaultCategory;
}

// ============================================================================
// 去重
// ============================================================================

/**
 * 按 text 字段去重。
 *
 * @param entries - 语料条目数组
 * @returns 去重后的数组（保持首次出现顺序）
 */
function deduplicate(entries: CorpusEntry[]): CorpusEntry[] {
  const seen = new Set<string>();
  const result: CorpusEntry[] = [];

  for (const entry of entries) {
    const key = entry.text.trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }

  return result;
}

// ============================================================================
// 统计
// ============================================================================

/**
 * 计算语料统计信息。
 *
 * @param entries - 语料条目数组
 * @returns 统计信息
 */
function computeStats(entries: CorpusEntry[]): TokenStats {
  const categories: Record<string, number> = {};
  const categoryTokens: Record<string, number> = {};
  let totalTokens = 0;
  let maxLen = 0;
  let minLen = Infinity;

  for (const entry of entries) {
    categories[entry.category] = (categories[entry.category] || 0) + 1;
    categoryTokens[entry.category] = (categoryTokens[entry.category] || 0) + entry.tokens.length;
    totalTokens += entry.tokens.length;
    maxLen = Math.max(maxLen, entry.tokens.length);
    minLen = Math.min(minLen, entry.tokens.length);
  }

  const uniqueTokens = new Set(entries.flatMap((e) => e.tokens)).size;

  return {
    totalEntries: entries.length,
    totalTokens,
    categories,
    categoryTokens,
    avgSentenceLength: entries.length > 0 ? Math.round(totalTokens / entries.length) : 0,
    uniqueTokens,
    maxSentenceLength: maxLen,
    minSentenceLength: entries.length > 0 ? minLen : 0,
  };
}

// ============================================================================
// 文件处理
// ============================================================================

/**
 * 处理单个原始文本文件。
 *
 * @param filePath - 文件路径
 * @param category - 分类标签（不指定则从文件名推断）
 * @param options - 处理选项
 * @returns 语料条目数组
 */
function processFile(
  filePath: string,
  category?: string,
  options: { minLength: number; maxLength: number } = { minLength: 3, maxLength: 200 },
): CorpusEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const actualCategory = category ?? detectCategory(filePath);
  const entries: CorpusEntry[] = [];

  for (const line of lines) {
    const cleaned = cleanText(line, options);
    if (!cleaned) continue;

    const tokens = tokenize(cleaned);

    if (tokens.length < options.minLength) continue;

    if (tokens.length > options.maxLength) {
      // 过长句子按标点分割
      const subSentences = splitLongSentence(cleaned, options.maxLength);
      for (const sub of subSentences) {
        const subTokens = tokenize(sub);
        if (subTokens.length >= options.minLength) {
          entries.push({ category: actualCategory, text: sub, tokens: subTokens });
        }
      }
      continue;
    }

    entries.push({ category: actualCategory, text: cleaned, tokens });
  }

  return entries;
}

/**
 * 将长文本按句末标点分割为短句。
 *
 * @param text - 长文本
 * @param maxTokens - 最大 token 数
 * @returns 短句数组
 */
function splitLongSentence(text: string, maxTokens: number): string[] {
  const parts = text.split(/[。！？；.!?;]/);
  const result: string[] = [];
  let current = '';
  let currentTokens = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const partTokens = tokenize(trimmed);

    if (currentTokens + partTokens.length <= maxTokens) {
      current = current ? `${current}。${trimmed}` : trimmed;
      currentTokens += partTokens.length;
    } else {
      if (current) result.push(current);
      current = trimmed;
      currentTokens = partTokens.length;
    }
  }

  if (current) result.push(current);
  return result;
}

/**
 * 批量处理目录中的所有 .txt 文件。
 *
 * @param dirPath - 目录路径
 * @param options - 处理选项
 * @returns 合并后去重的语料条目数组
 */
function processDirectory(dirPath: string, options: CliOptions): CorpusEntry[] {
  const files = fs.readdirSync(dirPath)
    .filter((f) => f.endsWith('.txt'))
    .sort();

  if (files.length === 0) {
    console.error(`警告: 目录 "${dirPath}" 中没有找到 .txt 文件`);
    return [];
  }

  console.log(`找到 ${files.length} 个文本文件:`);
  for (const file of files) {
    console.log(`  - ${file}`);
  }

  const allEntries: CorpusEntry[] = [];

  for (const file of files) {
    const filePathCat = path.join(dirPath, file);
    const category = options.category ?? detectCategory(file);
    const fileEntries = processFile(filePathCat, category, {
      minLength: options.minLength,
      maxLength: options.maxLength,
    });
    console.log(`  处理 "${file}": ${fileEntries.length} 条语料 (分类: ${category})`);
    allEntries.push(...fileEntries);
  }

  return allEntries;
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 解析命令行参数。
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    output: 'corpus.json',
    minLength: 3,
    maxLength: 200,
    stats: false,
    pretty: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-i':
      case '--input':
        options.inputFile = args[++i];
        break;
      case '-d':
      case '--dir':
        options.inputDir = args[++i];
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-c':
      case '--category':
        options.category = args[++i];
        break;
      case '--min-length':
        options.minLength = parseInt(args[++i] ?? '3', 10);
        break;
      case '--max-length':
        options.maxLength = parseInt(args[++i] ?? '200', 10);
        break;
      case '--stats':
        options.stats = true;
        break;
      case '--pretty':
        options.pretty = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  if (!options.inputFile && !options.inputDir) {
    console.error('错误: 请指定输入文件 (-i) 或输入目录 (-d)');
    console.error('使用 -h 查看帮助');
    process.exit(1);
  }

  return options;
}

/**
 * 打印帮助信息。
 */
function printHelp(): void {
  console.log(`
PlotFlow 语料预处理脚本 (M5-02)

用法:
  npx tsx scripts/preprocess-corpus.ts [选项]

选项:
  -i, --input <文件>      输入原始文本文件
  -d, --dir <目录>        批量处理目录中的所有 .txt 文件
  -o, --output <文件>     输出 JSON 文件路径（默认: corpus.json）
  -c, --category <分类>    分类标签（单文件模式必需，目录模式可选）
  --min-length <数字>      最小句长（token 数，默认: 3）
  --max-length <数字>      最大句长（token 数，默认: 200）
  --stats                 输出处理统计信息
  --pretty                输出格式化（非压缩）JSON
  -h, --help              显示此帮助

示例:
  # 处理单个 RPG 对话文件
  npx tsx scripts/preprocess-corpus.ts -i raw/rpg.txt -o corpus/rpg.json -c RPG对话

  # 批量处理目录
  npx tsx scripts/preprocess-corpus.ts -d raw/ -o packages/core/corpus/zh.json --stats
`);
}

/**
 * 主入口。
 */
function main(): void {
  const options = parseArgs();

  let entries: CorpusEntry[];

  if (options.inputFile) {
    if (!options.category) {
      console.error('错误: 单文件模式需要指定分类标签 (-c)');
      process.exit(1);
    }

    if (!fs.existsSync(options.inputFile)) {
      console.error(`错误: 输入文件不存在 "${options.inputFile}"`);
      process.exit(1);
    }

    console.log(`处理文件: ${options.inputFile}`);
    entries = processFile(options.inputFile, options.category, {
      minLength: options.minLength,
      maxLength: options.maxLength,
    });
  } else {
    if (!fs.existsSync(options.inputDir!)) {
      console.error(`错误: 输入目录不存在 "${options.inputDir}"`);
      process.exit(1);
    }

    entries = processDirectory(options.inputDir!, options);
  }

  // 去重
  const beforeDedup = entries.length;
  entries = deduplicate(entries);
  const duplicatesRemoved = beforeDedup - entries.length;

  // 统计
  const stats = computeStats(entries);

  if (options.stats) {
    console.log('\n===== 语料统计 =====');
    console.log(`条目总数:      ${stats.totalEntries}`);
    console.log(`总 token 数:   ${stats.totalTokens}`);
    console.log(`唯一 token 数:  ${stats.uniqueTokens}`);
    console.log(`平均句长:      ${stats.avgSentenceLength} tokens`);
    console.log(`最长句子:      ${stats.maxSentenceLength} tokens`);
    console.log(`最短句子:      ${stats.minSentenceLength} tokens`);
    console.log(`去重移除:      ${duplicatesRemoved} 条`);
    console.log('\n--- 分类分布 ---');
    for (const [cat, count] of Object.entries(stats.categories)) {
      const pct = ((count / stats.totalEntries) * 100).toFixed(1);
      const tokCount = stats.categoryTokens[cat] ?? 0;
      console.log(`  ${cat}: ${count} 条 (${pct}%), ${tokCount} tokens`);
    }
  }

  // 写入输出文件
  const outputPath = path.resolve(options.output);
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonContent = options.pretty
    ? JSON.stringify(entries, null, 2)
    : JSON.stringify(entries);

  fs.writeFileSync(outputPath, jsonContent, 'utf-8');

  const fileSizeKB = (Buffer.byteLength(jsonContent, 'utf-8') / 1024).toFixed(1);
  console.log(`\n✓ 输出文件: ${outputPath}`);
  console.log(`  大小: ${fileSizeKB} KB`);
  console.log(`  条目: ${entries.length} 条`);

  if (Number(fileSizeKB) > 100) {
    console.log(`  提示: 文件较大，可考虑用 gzip 进一步压缩`);
  }
}

main();
