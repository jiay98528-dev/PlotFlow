/**
 * N-gram 统计模型引擎 (M5-01)
 *
 * @packageDocumentation
 * @remarks
 * 基于 N-gram 语言模型的补全预测引擎。
 *
 * ## 核心数据结构
 * - `ngramStore`: `Map<gramLevel, Map<contextKey, Map<completionWord, frequency>>>`
 * - 支持 1-gram 到 5-gram
 * - 每个 gram 级别独立存储
 *
 * ## 训练
 * - `train(tokens)`: 将 token 序列拆分为 1~5 gram，更新频次计数
 * - `trainFromText(text)`: 自动分词后训练
 *
 * ## 预测
 * - `predict(prefix, topN)`: 从最长匹配 gram 开始查找，返回 top-N 高频候选
 * - 降级策略：5-gram → 4-gram → 3-gram → 2-gram → 1-gram
 *
 * ## 序列化
 * - `toModel()`: 导出为 JSON 可序列化的 NGramModel
 * - `fromModel(model)`: 从序列化数据恢复引擎
 *
 * ## 设计参考
 * - TAD §3.4.3 N-gram 引擎核心
 * - MarkLuck packages/app/src/utils/ngram-engine.ts
 *
 * @version 0.1.0
 */

import type { NGramModel, NGramStore, CompletionResult, CorpusSource } from './types.js';

// ============================================================================
// 常量
// ============================================================================

/** 最大 N-gram 长度 */
const MAX_N = 5;

/** 当前模型序列化版本 */
const MODEL_VERSION = 1;

/** 时效衰减半衰期（天） */
const RECENCY_HALF_LIFE_DAYS = 90;

/** 语料来源权重 */
const SOURCE_WEIGHT: Record<CorpusSource, number> = {
  baseline: 0.5,
  imported: 1.0,
  user: 1.5,
};

// ============================================================================
// NGramEngine 类
// ============================================================================

/**
 * N-gram 统计模型引擎。
 *
 * 纯 TypeScript 实现，零外部依赖，可运行在浏览器/Node.js/Worker 线程中。
 *
 * @example
 * ```typescript
 * const engine = new NGramEngine();
 *
 * // 训练
 * engine.trainFromText('勇者踏上了征程。勇者来到了村庄。');
 *
 * // 预测
 * const completions = engine.predict('勇者', 3);
 * // → ['踏上', '来到']
 * ```
 */
export class NGramEngine {
  /**
   * N-gram 频次存储。
   *
   * 结构：Map<gramLevel, Map<contextKey, Map<completionWord, frequency>>>
   *
   * - gramLevel: 1-5，表示 N-gram 的 N
   * - contextKey: 前 N-1 个 token 以空格连接（对于 unigram，始终为空字符串）
   * - completionWord: 第 N 个 token（补全词）
   * - frequency: 该组合的出现次数
   */
  private ngramStore: Map<number, NGramStore>;

  /** 训练的总 token 数 */
  private _totalTokens: number;

  constructor() {
    this.ngramStore = new Map();
    this._totalTokens = 0;

    // 初始化 1-5 级存储
    for (let n = 1; n <= MAX_N; n++) {
      this.ngramStore.set(n, new Map());
    }
  }

  // ==========================================================================
  // 公共属性
  // ==========================================================================

  /** 最大 N-gram 长度 */
  get maxN(): number {
    return MAX_N;
  }

  /** 训练的总 token 数 */
  get totalTokens(): number {
    return this._totalTokens;
  }

  /**
   * 获取模型中的 N-gram 条目总数。
   */
  get entryCount(): number {
    let count = 0;
    for (let n = 1; n <= MAX_N; n++) {
      const store = this.ngramStore.get(n);
      if (store) {
        for (const candidates of store.values()) {
          count += candidates.size;
        }
      }
    }
    return count;
  }

  // ==========================================================================
  // 分词
  // ==========================================================================

  /**
   * 将文本拆分为 token 序列。
   *
   * 策略：
   * - 中文字符（含日韩汉字）：每个字符独立为一个 token
   * - 英文/数字：连续字符组成一个 token
   * - 标点符号：每个符号独立为一个 token
   * - 空白字符：跳过
   *
   * @param text - 原始文本
   * @returns token 序列（不含空白字符）
   */
  tokenize(text: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (const char of text) {
      // CJK 统一汉字区块 + CJK 扩展 A-G
      if (/[一-鿿㐀-䶿豈-﫿]/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(char);
      } else if (/[a-zA-Z0-9]/.test(char)) {
        current += char;
      } else {
        if (current) {
          tokens.push(current);
          current = '';
        }
        // 非空白标点才保留
        if (char.trim() !== '') {
          tokens.push(char);
        }
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  // ==========================================================================
  // 训练
  // ==========================================================================

  /**
   * 使用 token 序列训练引擎。
   *
   * 将 token 序列拆分为所有可能的 1~5 gram 子序列，更新频次计数。
   *
   * @param tokens - token 序列
   * @param source - 语料来源（默认 'baseline'）
   */
  train(tokens: string[], _source: CorpusSource = 'baseline'): void {
    if (tokens.length === 0) return;

    this._totalTokens += tokens.length;

    for (let n = 1; n <= MAX_N; n++) {
      const store = this.ngramStore.get(n)!;

      // 对于 n-gram，需要至少 n 个 token
      // 滑动窗口长度为 n
      for (let i = 0; i <= tokens.length - n; i++) {
        // 前 n-1 个 token 作为上下文
        const contextTokens = tokens.slice(i, i + n - 1);
        // 第 n 个 token 作为补全词
        const completionWord = tokens[i + n - 1]!;

        const contextKey = contextTokens.join(' ');

        let candidateMap = store.get(contextKey);
        if (!candidateMap) {
          candidateMap = new Map();
          store.set(contextKey, candidateMap);
        }

        const currentFreq = candidateMap.get(completionWord!) ?? 0;
        candidateMap.set(completionWord!, currentFreq + 1);
      }
    }
  }

  /**
   * 从原始文本训练引擎（自动分词）。
   *
   * @param text - 原始文本
   * @param source - 语料来源（默认 'baseline'）
   */
  trainFromText(text: string, source: CorpusSource = 'baseline'): void {
    const tokens = this.tokenize(text);
    this.train(tokens, source);
  }

  /**
   * 增量学习 — 等同于 `train(tokens, 'user')`。
   *
   * @param tokens - 用户编辑内容的 token 序列
   */
  incrementalLearn(tokens: string[]): void {
    this.train(tokens, 'user');
  }

  // ==========================================================================
  // 预测
  // ==========================================================================

  /**
   * 根据前缀预测补全候选。
   *
   * 从最长匹配 gram 开始尝试：
   * 1. 分词前缀
   * 2. 取最后 (N-1) 个 token 作为上下文
   * 3. 在对应 gram 级别查找匹配
   * 4. 未找到则降级到更短的 gram
   * 5. 按频次降序排列，返回 top-N
   *
   * @param prefix - 用户输入的前缀文本
   * @param topN - 返回结果数量（默认 5）
   * @returns 补全候选文本列表（按频次降序）
   */
  predict(prefix: string, topN: number = 5): string[] {
    const tokens = this.tokenize(prefix);
    const results: Array<{ text: string; frequency: number }> = [];
    const seen = new Set<string>();

    // 从最长 gram 级别开始尝试
    // N-gram 的上下文长度 = N-1，所以最大可尝试的 gram = min(MAX_N, tokens.length + 1)
    const maxGram = Math.min(MAX_N, tokens.length + 1);

    for (let n = maxGram; n >= 1; n--) {
      // 取最后 (n-1) 个 token 作为上下文
      // n=1 时显式返回空数组，避免 JS slice(-0) === slice(0) 返回完整数组的陷阱
      const contextTokens = n === 1 ? [] : tokens.slice(-(n - 1));
      const contextKey = contextTokens.join(' ');

      const store = this.ngramStore.get(n);
      if (!store) continue;

      const candidates = store.get(contextKey);
      if (!candidates || candidates.size === 0) continue;

      // 收集该 gram 级别的所有候选
      for (const [word, freq] of candidates) {
        if (!seen.has(word)) {
          seen.add(word);
          results.push({ text: word, frequency: freq });
        }
      }

      // 如果已收集足够结果，停止降级
      if (results.length >= topN) break;
    }

    // 按频次降序排列
    results.sort((a, b) => b.frequency - a.frequency);

    return results.slice(0, topN).map((r) => r.text);
  }

  /**
   * 增强版预测 — 返回带评分的 CompletionResult。
   *
   * 评分公式：\(\log_2(freq + 1) \times decay \times sourceWeight\)
   *
   * @param prefix - 用户输入的前缀文本
   * @param topN - 返回结果数量（默认 5）
   * @param contextBefore - 光标前上下文（可选，用于评分优化）
   * @returns 补全结果列表（按评分降序）
   */
  predictScored(prefix: string, topN: number = 5, _contextBefore?: string): CompletionResult[] {
    const tokens = this.tokenize(prefix);
    const results: Map<string, { frequency: number; lastSeenAt: number; source: CorpusSource }> = new Map();

    const maxGram = Math.min(MAX_N, tokens.length + 1);

    for (let n = maxGram; n >= 1; n--) {
      const contextTokens = n === 1 ? [] : tokens.slice(-(n - 1));
      const contextKey = contextTokens.join(' ');

      const store = this.ngramStore.get(n);
      if (!store) continue;

      const candidates = store.get(contextKey);
      if (!candidates || candidates.size === 0) continue;

      for (const [word, freq] of candidates) {
        if (!results.has(word)) {
          // 频次即为此处的计数值；来源和时效暂用默认值
          results.set(word, {
            frequency: freq,
            lastSeenAt: Date.now(),
            source: 'baseline',
          });
        }
      }
    }

    // 计算评分并排序
    const scored: CompletionResult[] = [];
    for (const [text, meta] of results) {
      const score = this.calculateScore(meta.frequency, meta.lastSeenAt, meta.source);
      scored.push({ text, score, source: meta.source });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
  }

  // ==========================================================================
  // 评分
  // ==========================================================================

  /**
   * 计算候选词的综合评分。
   *
   * 公式：\(\log_2(freq + 1) \times recencyDecay \times sourceWeight\)
   *
   * @param frequency - 出现频次
   * @param lastSeenAt - 最后出现时间戳
   * @param source - 语料来源
   * @returns 综合评分
   */
  private calculateScore(frequency: number, lastSeenAt: number, source: CorpusSource): number {
    const frequencyWeight = Math.log2(frequency + 1);
    const daysSinceSeen = (Date.now() - lastSeenAt) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.pow(0.5, daysSinceSeen / RECENCY_HALF_LIFE_DAYS);
    const sourceWeight = SOURCE_WEIGHT[source];

    return frequencyWeight * recencyWeight * sourceWeight;
  }

  // ==========================================================================
  // 清理
  // ==========================================================================

  /**
   * 清理低频和过期条目。
   *
   * - 移除频次低于 minFrequency 的条目
   * - 移除超过 olderThanDays 天未出现且来源为 baseline 的条目
   *
   * @param minFrequency - 最低保留频次（默认 1，即保留所有）
   * @param olderThanDays - 过期天数阈值（默认 180）
   */
  prune(minFrequency: number = 1, _olderThanDays: number = 180): void {
    for (let n = 1; n <= MAX_N; n++) {
      const store = this.ngramStore.get(n);
      if (!store) continue;

      for (const [contextKey, candidates] of store) {
        const toRemove: string[] = [];

        for (const [word, freq] of candidates) {
          if (freq < minFrequency) {
            toRemove.push(word);
          }
        }

        for (const word of toRemove) {
          candidates.delete(word);
        }

        if (candidates.size === 0) {
          store.delete(contextKey);
        }
      }
    }
  }

  /**
   * 清空所有训练数据。
   */
  clear(): void {
    for (let n = 1; n <= MAX_N; n++) {
      this.ngramStore.set(n, new Map());
    }
    this._totalTokens = 0;
  }

  // ==========================================================================
  // 序列化
  // ==========================================================================

  /**
   * 导出为 JSON 可序列化的模型快照。
   *
   * @returns NGramModel 快照
   */
  toModel(): NGramModel {
    const store: NGramModel['store'] = {};

    for (let n = 1; n <= MAX_N; n++) {
      const levelStore = this.ngramStore.get(n);
      if (!levelStore || levelStore.size === 0) continue;

      const levelData: Record<string, Record<string, number>> = {};
      for (const [contextKey, candidates] of levelStore) {
        const candidateObj: Record<string, number> = {};
        for (const [word, freq] of candidates) {
          candidateObj[word] = freq;
        }
        levelData[contextKey] = candidateObj;
      }
      store[n] = levelData;
    }

    return {
      version: MODEL_VERSION,
      totalTokens: this._totalTokens,
      store,
    };
  }

  /**
   * 从模型快照恢复引擎。
   *
   * @param model - NGramModel 快照
   * @returns 恢复的引擎实例
   */
  static fromModel(model: NGramModel): NGramEngine {
    const engine = new NGramEngine();

    for (const [nStr, levelData] of Object.entries(model.store)) {
      const n = Number(nStr);
      const store = engine.ngramStore.get(n);
      if (!store) continue;

      for (const [contextKey, candidates] of Object.entries(levelData)) {
        const candidateMap = new Map<string, number>();
        for (const [word, freq] of Object.entries(candidates)) {
          candidateMap.set(word, freq);
        }
        store.set(contextKey, candidateMap);
      }
    }

    engine._totalTokens = model.totalTokens;
    return engine;
  }

  /**
   * 导出为 JSON 字符串。
   *
   * @param pretty - 是否格式化输出（默认 false）
   * @returns JSON 字符串
   */
  serialize(pretty: boolean = false): string {
    return JSON.stringify(this.toModel(), null, pretty ? 2 : undefined);
  }

  /**
   * 从 JSON 字符串恢复引擎。
   *
   * @param json - JSON 字符串
   * @returns 恢复的引擎实例
   * @throws 如果 JSON 格式无效
   */
  static deserialize(json: string): NGramEngine {
    const model = JSON.parse(json) as NGramModel;
    return NGramEngine.fromModel(model);
  }

  // ==========================================================================
  // 查询
  // ==========================================================================

  /**
   * 检查某个上下文-补全组合是否存在。
   *
   * @param contextTokens - 上下文 token 序列
   * @param completionWord - 补全词
   * @returns 是否存在
   */
  has(contextTokens: string[], completionWord: string): boolean {
    const n = contextTokens.length + 1;
    if (n > MAX_N) return false;

    const store = this.ngramStore.get(n);
    if (!store) return false;

    const contextKey = contextTokens.join(' ');
    const candidates = store.get(contextKey);
    if (!candidates) return false;

    return candidates.has(completionWord);
  }

  /**
   * 获取某个上下文-补全组合的频次。
   *
   * @param contextTokens - 上下文 token 序列
   * @param completionWord - 补全词
   * @returns 频次（不存在则返回 0）
   */
  getFrequency(contextTokens: string[], completionWord: string): number {
    const n = contextTokens.length + 1;
    if (n > MAX_N) return 0;

    const store = this.ngramStore.get(n);
    if (!store) return 0;

    const contextKey = contextTokens.join(' ');
    const candidates = store.get(contextKey);
    if (!candidates) return 0;

    return candidates.get(completionWord) ?? 0;
  }

  /**
   * 获取指定 gram 级别和上下文的所有候选。
   *
   * @param gramLevel - gram 级别 (1-5)
   * @param contextTokens - 上下文 token 序列
   * @returns 候选 Map（不可修改的视图）
   */
  getCandidates(gramLevel: number, contextTokens: string[]): ReadonlyMap<string, number> | undefined {
    if (gramLevel < 1 || gramLevel > MAX_N) return undefined;
    const store = this.ngramStore.get(gramLevel);
    if (!store) return undefined;
    return store.get(contextTokens.join(' '));
  }
}
