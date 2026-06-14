/**
 * PlotFlow 补全引擎类型定义
 *
 * @packageDocumentation
 * @remarks
 * 定义 N-gram 统计模型引擎的核心类型：
 * - NGramStore: 频次存储结构
 * - Candidate: 单个候选词
 * - CompletionResult: 补全结果
 * - NGramModel: 可序列化的模型快照
 *
 * @version 0.1.0
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 语料来源 */
export type CorpusSource = 'baseline' | 'user' | 'imported';

// ============================================================================
// 语料数据类型
// ============================================================================

/**
 * 语料条目。
 *
 * 每条语料包含分类标签、原始文本和预分词的 token 数组。
 * 预分词的 tokens 用于 NGramEngine 训练，避免重复分词开销。
 */
export interface CorpusEntry {
  /** 分类标签（如 'RPG对话', '视觉小说'） */
  category: string;
  /** 原始文本 */
  text: string;
  /** 预分词的 token 数组 */
  tokens: string[];
}

/**
 * 语料数据集接口。
 *
 * 提供分类过滤、随机采样、token 扁平化等功能，
 * 是 CorpusLoader 加载后的返回类型。
 */
export interface CorpusData {
  /** 所有语料条目（只读视图） */
  readonly entries: CorpusEntry[];
  /** 语言标识 */
  readonly language: string;
  /** 条目总数 */
  readonly totalCount: number;

  /** 获取所有条目的纯文本列表 */
  getAllTexts(): string[];
  /** 获取指定分类的条目 */
  getEntries(category: string): CorpusEntry[];
  /** 获取所有分类名称 */
  getCategories(): string[];
  /** 按分类统计条目数 */
  getCategoryStats(): Record<string, number>;
  /** 随机采样指定数量的条目 */
  sample(count?: number): CorpusEntry[];
  /** 按分类随机采样 */
  sampleFromCategory(category: string, count?: number): CorpusEntry[];
  /** 获取所有 token 的扁平数组（用于 NGramEngine 训练） */
  getAllTokens(): string[];
}

// ============================================================================
// 数据存储类型
// ============================================================================

/**
 * N-gram 频次存储单元。
 *
 * 一个 gram 级别的存储结构：
 * - 外层 key: 上下文前缀（前 N-1 个 token 的连接，用空格分隔）
 * - 内层 key: 候选补全词
 * - 内层 value: 出现频次
 *
 * @example
 * ```typescript
 * // Bigram store entry:
 * // "勇者" → Map { "踏上" → 5, "来到" → 3, "发现" → 2 }
 * const store: NGramStore = new Map();
 * ```
 */
export type NGramStore = Map<string, Map<string, number>>;

// ============================================================================
// 候选与结果类型
// ============================================================================

/**
 * 单个候选词及其元数据。
 */
export interface Candidate {
  /** 候选文本 */
  text: string;
  /** 出现频次 */
  frequency: number;
  /** 最后出现时间戳 (epoch ms) */
  lastSeenAt: number;
  /** 语料来源 */
  source: CorpusSource;
}

/**
 * 补全结果（带评分排序后）。
 */
export interface CompletionResult {
  /** 补全文本 */
  text: string;
  /** 综合评分（频率 \(\times\) 时效衰减 \(\times\) 来源权重） */
  score: number;
  /** 语料来源 */
  source: CorpusSource;
}

// ============================================================================
// 序列化类型
// ============================================================================

/**
 * N-gram 模型序列化格式。
 *
 * 使用数组嵌套替代 Map，便于 JSON 序列化。
 */
export interface NGramModel {
  /** 模型格式版本 */
  version: number;
  /** 训练的总 token 数 */
  totalTokens: number;
  /** 每个 gram 级别的存储快照: gramLevel → (contextKey → (completion → frequency)) */
  store: Record<number, Record<string, Record<string, number>>>;
}

// ============================================================================
// 补全上下文类型
// ============================================================================

/** 补全触发维度 */
export type CompletionDimension =
  | 'node-title'
  | 'option-text'
  | 'body-text'
  | 'variable-name';

/** 补全触发上下文 */
export interface CompletionContext {
  /** 触发维度 */
  dimension: CompletionDimension;
  /** 用户已输入的文本前缀 */
  prefix: string;
  /** 光标前的上下文文本 */
  contextBefore: string;
  /** 光标后的上下文文本（可选） */
  contextAfter?: string;
  /** 当前节点标题（用于正文补全） */
  currentNodeTitle?: string;
  /** 当前节点已有选项列表（用于句式补全） */
  existingOptions?: string[];
  /** 可用变量列表（用于变量补全） */
  availableVariables?: string[];
}
