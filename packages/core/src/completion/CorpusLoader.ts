/**
 * 语料加载器 (M5-02)
 *
 * @packageDocumentation
 * @remarks
 * 负责从预编译的 JSON 文件加载语料数据，支持按需懒加载 (lazy loading)。
 *
 * ## 设计要点
 * - 语料文件按语言分开存储（zh.json / en.json），可按需加载
 * - 使用 singleton + 缓存模式：首次调用 `loadCorpus` 时从磁盘加载，后续返回缓存
 * - 支持分类过滤：通过 `getEntries(category)` 只获取指定分类的句子
 * - 跨平台：同时支持 Node.js (fs/dynamic import) 和浏览器环境 (dynamic import)
 * - 与 NGramEngine 配合使用：`getAllTokens()` 返回所有 token 用于训练
 *
 * ## 语料文件格式
 * ```json
 * [
 *   { "category": "RPG对话", "text": "勇者大人...", "tokens": ["勇", "者", "..."] }
 * ]
 * ```
 *
 * ## 使用示例
 * ```typescript
 * const loader = CorpusLoader.getInstance();
 *
 * // 懒加载中文语料
 * const corpus = await loader.loadCorpus('zh');
 *
 * // 获取所有 RPG 对话
 * const rpgEntries = corpus.getEntries('RPG对话');
 *
 * // 配合 NGramEngine 训练
 * const engine = new NGramEngine();
 * engine.train(corpus.getAllTokens());
 *
 * // 或直接加载到引擎
 * const stats = await loader.loadToEngine(engine, 'zh');
 * console.log(`加载了 ${stats.entriesLoaded} 条语料`);
 * ```
 *
 * @version 0.1.0
 */

import type { CorpusEntry, CorpusData } from './types.js';
import { NGramEngine } from './NGramEngine.js';

// ============================================================================
// 常量
// ============================================================================

/** 语料文件路径映射（相对于 packages/core/corpus/） */
const CORPUS_FILE_PATHS: Record<string, string> = {
  zh: '../../corpus/zh.json',
  en: '../../corpus/en.json',
};

/** 默认语言 */
const DEFAULT_LANGUAGE = 'zh';

// ============================================================================
// 语料加载统计
// ============================================================================

/** 语料加载统计 */
export interface CorpusLoadStats {
  /** 加载的语料条目数 */
  entriesLoaded: number;
  /** 总 token 数 */
  totalTokens: number;
  /** 各分类条目数 */
  categories: Record<string, number>;
  /** 文件名 */
  sourceFile: string;
}

// ============================================================================
// CorpusLoader 类
// ============================================================================

/**
 * 语料加载器。
 *
 * 单例模式，全局只维护一份缓存。
 * 同时支持 Node.js 和浏览器环境。
 *
 * @example
 * ```typescript
 * // 获取单例
 * const loader = CorpusLoader.getInstance();
 *
 * // 加载中文语料（懒加载，首次从文件读取，后续走缓存）
 * const zhCorpus = await loader.loadCorpus('zh');
 *
 * // 获取所有 RPG 对话
 * const rpgEntries = zhCorpus.getEntries('RPG对话');
 *
 * // 获取分类列表
 * const categories = zhCorpus.getCategories();
 * ```
 */
export class CorpusLoader {
  /** 单例实例 */
  private static instance: CorpusLoader | null = null;

  /** 缓存：language → CorpusData */
  private cache: Map<string, CorpusData> = new Map();

  /** 加载中的 Promise（防止并发重复加载） */
  private pendingLoads: Map<string, Promise<CorpusData>> = new Map();

  /** 是否启用缓存（开发时可禁用） */
  private cacheEnabled: boolean;

  /** 自定义文件解析器（用于测试或浏览器环境注入） */
  private fileReader?: (filePath: string) => Promise<CorpusEntry[]>;

  /**
   * @param cacheEnabled - 是否启用缓存（默认 true）
   * @param fileReader - 可选的自定义文件解析器
   */
  private constructor(cacheEnabled: boolean = true, fileReader?: (filePath: string) => Promise<CorpusEntry[]>) {
    this.cacheEnabled = cacheEnabled;
    this.fileReader = fileReader;
  }

  // ==========================================================================
  // 单例管理
  // ==========================================================================

  /**
   * 获取 CorpusLoader 单例。
   *
   * @param cacheEnabled - 是否启用缓存（仅首次调用时生效）
   * @param fileReader - 可选的自定义文件解析器（仅首次调用时生效）
   * @returns CorpusLoader 实例
   */
  static getInstance(cacheEnabled: boolean = true, fileReader?: (filePath: string) => Promise<CorpusEntry[]>): CorpusLoader {
    if (!CorpusLoader.instance) {
      CorpusLoader.instance = new CorpusLoader(cacheEnabled, fileReader);
    }
    return CorpusLoader.instance;
  }

  /**
   * 重置单例（主要用于测试）。
   */
  static resetInstance(): void {
    CorpusLoader.instance = null;
  }

  // ==========================================================================
  // 加载语料
  // ==========================================================================

  /**
   * 加载指定语言的预置语料。
   *
   * - 首次调用：从磁盘/网络读取 JSON 文件并解析
   * - 后续调用：返回缓存结果（除非 `forceReload` 为 true）
   * - 并发调用：相同的语言会共享同一个加载 Promise
   * - 这就是所谓的**懒加载**：语料文件只在首次请求时才加载
   *
   * @param language - 语言标识（默认 'zh'）
   * @param forceReload - 是否强制重新加载（跳过缓存）
   * @returns CorpusData 实例
   * @throws 如果语料文件不存在或格式无效
   */
  async loadCorpus(
    language: string = DEFAULT_LANGUAGE,
    forceReload: boolean = false,
  ): Promise<CorpusData> {
    // 检查缓存
    if (!forceReload && this.cacheEnabled && this.cache.has(language)) {
      return this.cache.get(language)!;
    }

    // 防止并发重复加载
    const pendingKey = `${language}:${forceReload}`;
    const pending = this.pendingLoads.get(pendingKey);
    if (pending) {
      return pending;
    }

    const loadPromise = this.doLoad(language);
    this.pendingLoads.set(pendingKey, loadPromise);

    try {
      const corpus = await loadPromise;

      // 缓存结果
      if (this.cacheEnabled) {
        this.cache.set(language, corpus);
      }

      return corpus;
    } finally {
      this.pendingLoads.delete(pendingKey);
    }
  }

  /**
   * 加载语料并直接导入 NGramEngine 训练。
   *
   * 便捷方法：一次调用完成加载 + 训练。
   *
   * @param engine - NGramEngine 实例
   * @param language - 语料语言（默认 'zh'）
   * @param source - 语料来源（默认 'baseline'）
   * @returns 加载统计
   */
  async loadToEngine(
    engine: NGramEngine,
    language: string = DEFAULT_LANGUAGE,
    source: 'baseline' | 'imported' = 'baseline',
  ): Promise<CorpusLoadStats> {
    const corpus = await this.loadCorpus(language);
    const entries = corpus.entries;

    const categories: Record<string, number> = {};
    let totalTokens = 0;

    for (const entry of entries) {
      engine.train(entry.tokens, source);
      categories[entry.category] = (categories[entry.category] || 0) + 1;
      totalTokens += entry.tokens.length;
    }

    return {
      entriesLoaded: entries.length,
      totalTokens,
      categories,
      sourceFile: `${language}.json`,
    };
  }

  /**
   * 实际执行加载操作。
   *
   * 加载策略（按优先级）：
   * 1. 自定义 fileReader（通过构造函数注入，用于测试或浏览器环境）
   * 2. 动态 import JSON (ESM, 适用于 Vite/浏览器)
   * 3. Node.js fs.readFileSync (CommonJS 降级)
   *
   * @param language - 语言标识
   * @returns CorpusData 实例
   */
  private async doLoad(language: string): Promise<CorpusData> {
    const filePath = CORPUS_FILE_PATHS[language];
    if (!filePath) {
      throw new Error(
        `不支持的语言: "${language}"。支持的语言: ${Object.keys(CORPUS_FILE_PATHS).join(', ')}`,
      );
    }

    let entries: CorpusEntry[];

    if (this.fileReader) {
      // 使用自定义解析器
      entries = await this.fileReader(filePath);
    } else {
      entries = await this.loadFromFile(filePath);
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error(`语料文件 "${filePath}" 格式无效或为空。`);
    }

    // 验证每个条目结构
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry || !entry.category || typeof entry.category !== 'string') {
        throw new Error(`语料条目 ${i} 缺少有效的 'category' 字段`);
      }
      if (!entry.text || typeof entry.text !== 'string') {
        throw new Error(`语料条目 ${i} 缺少有效的 'text' 字段`);
      }
      if (!Array.isArray(entry.tokens)) {
        throw new Error(`语料条目 ${i} 缺少有效的 'tokens' 数组`);
      }
    }

    return new CorpusDataImpl(entries, language);
  }

  /**
   * 从文件加载语料数据。
   *
   * 优先使用动态 import（ESM 环境），降级使用 fs.readFileSync。
   *
   * @param filePath - 相对于包的 JSON 文件路径
   * @returns 语料条目数组
   */
  private async loadFromFile(filePath: string): Promise<CorpusEntry[]> {
    // 尝试 1: 动态 import JSON (Vite/ESM)
    try {
      const module = await import(/* @vite-ignore */ filePath, {
        assert: { type: 'json' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return (module.default ?? module) as CorpusEntry[];
    } catch {
      // 尝试 2: Node.js fs
      try {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const { fileURLToPath } = await import('node:url');

        // 尝试从当前模块路径解析
        let resolvedPath: string;
        try {
          const currentPath = fileURLToPath(import.meta.url);
          resolvedPath = path.resolve(path.dirname(currentPath), filePath);
        } catch {
          // fallback: 从 cwd 解析
          resolvedPath = path.resolve(process.cwd(), 'packages/core/corpus', path.basename(filePath));
        }

        const raw = fs.readFileSync(resolvedPath, 'utf-8');
        return JSON.parse(raw) as CorpusEntry[];
      } catch (err) {
        throw new Error(
          `无法加载语料文件: "${filePath}"。请确保语料文件存在且格式正确。` +
          (err instanceof Error ? ` (${err.message})` : ''),
        );
      }
    }
  }

  /**
   * 从原始数据数组创建 CorpusData（用于测试或运行时构建）。
   *
   * @param entries - 语料条目数组
   * @param language - 语言标识（默认 'custom'）
   * @returns CorpusData 实例
   */
  createFromData(entries: CorpusEntry[], language: string = 'custom'): CorpusData {
    return new CorpusDataImpl(entries, language);
  }

  // ==========================================================================
  // 缓存管理
  // ==========================================================================

  /**
   * 清除指定语言的缓存。
   *
   * @param language - 语言标识（不传则清除所有缓存）
   */
  clearCache(language?: string): void {
    if (language) {
      this.cache.delete(language);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 检查指定语言的语料是否已加载到缓存。
   *
   * @param language - 语言标识
   * @returns 是否已缓存
   */
  isLoaded(language: string): boolean {
    return this.cache.has(language);
  }

  /**
   * 获取当前缓存的语言列表。
   *
   * @returns 已缓存的语言标识数组
   */
  getLoadedLanguages(): string[] {
    return Array.from(this.cache.keys());
  }
}

// ============================================================================
// CorpusDataImpl（内部实现）
// ============================================================================

/**
 * CorpusData 的默认实现。
 *
 * 提供分类过滤、随机采样等功能。
 * 分类索引使用懒构建策略（首次访问时才创建）。
 */
class CorpusDataImpl implements CorpusData {
  /** 所有语料条目 */
  readonly entries: CorpusEntry[];

  /** 语言 */
  readonly language: string;

  /** 按分类索引的映射表（懒构建） */
  private categoryIndex: Map<string, CorpusEntry[]> | null = null;

  /**
   * @param entries - 语料条目数组
   * @param language - 语言标识
   */
  constructor(entries: CorpusEntry[], language: string) {
    this.entries = entries;
    this.language = language;
  }

  /** 条目总数 */
  get totalCount(): number {
    return this.entries.length;
  }

  /**
   * 获取所有条目的纯文本列表。
   *
   * @returns 文本数组
   */
  getAllTexts(): string[] {
    return this.entries.map((e) => e.text);
  }

  /**
   * 获取指定分类的条目。
   *
   * @param category - 分类名称
   * @returns 匹配的条目数组
   */
  getEntries(category: string): CorpusEntry[] {
    this.ensureIndex();
    return this.categoryIndex!.get(category) ?? [];
  }

  /**
   * 获取所有分类名称。
   *
   * @returns 分类名称数组
   */
  getCategories(): string[] {
    this.ensureIndex();
    return Array.from(this.categoryIndex!.keys());
  }

  /**
   * 按分类统计条目数。
   *
   * @returns 分类 → 条目数 映射
   */
  getCategoryStats(): Record<string, number> {
    this.ensureIndex();
    const stats: Record<string, number> = {};
    for (const [cat, entries] of this.categoryIndex!) {
      stats[cat] = entries.length;
    }
    return stats;
  }

  /**
   * 随机采样指定数量的条目。
   *
   * @param count - 采样数量（默认 10）
   * @returns 随机采样的条目数组
   */
  sample(count: number = 10): CorpusEntry[] {
    const shuffled = [...this.entries];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmpA: CorpusEntry = shuffled[i]!;
      const tmpB: CorpusEntry = shuffled[j]!;
      shuffled[i] = tmpB;
      shuffled[j] = tmpA;
    }
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * 按分类随机采样。
   *
   * @param category - 分类名称
   * @param count - 采样数量（默认 5）
   * @returns 随机采样的条目数组
   */
  sampleFromCategory(category: string, count: number = 5): CorpusEntry[] {
    const categoryEntries = this.getEntries(category);
    const shuffled = [...categoryEntries];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmpA: CorpusEntry = shuffled[i]!;
      const tmpB: CorpusEntry = shuffled[j]!;
      shuffled[i] = tmpB;
      shuffled[j] = tmpA;
    }
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * 获取所有 token 的扁平数组（用于 NGramEngine 训练）。
   *
   * @returns 所有条目的 token 扁平数组
   */
  getAllTokens(): string[] {
    return this.entries.flatMap((e) => e.tokens);
  }

  /**
   * 构建分类索引（懒加载）。
   */
  private ensureIndex(): void {
    if (this.categoryIndex) return;
    this.categoryIndex = new Map();
    for (const entry of this.entries) {
      const existing = this.categoryIndex.get(entry.category);
      if (existing) {
        existing.push(entry);
      } else {
        this.categoryIndex.set(entry.category, [entry]);
      }
    }
  }
}
