/**
 * PreprocessingPipeline — 预处理管道 (M5-18)
 *
 * @packageDocumentation
 * @remarks
 * 将 CorpusEntry 中的原始文本经过完整的预处理流程：
 *
 * 分词 → 去特殊符号 → 句式分类 → N-gram 索引
 *
 * 预处理完成后，可以直接将处理过的 tokens 喂给 NGramEngine 进行训练。
 *
 * ## 流程
 * ```
 * CorpusEntry[] (raw text)
 *   │
 *   ▼
 * [1. 分词] ── NGramEngine.tokenize() + 中文分词增强
 *   │
 *   ▼
 * [2. 去特殊符号] ── 去除无意义的标点和控制字符
 *   │
 *   ▼
 * [3. 句式分类] ── 根据句式模式自动分类
 *   │
 *   ▼
 * [4. N-gram 索引] ── 构建倒排索引 (InvertedIndex)
 *   │
 *   ▼
 * CorpusEntry[] (填充 tokens, 更新分类)
 * ```
 *
 * ## 使用示例
 * ```typescript
 * const pipeline = new PreprocessingPipeline();
 * const processed = pipeline.process(entries);
 * console.log(processed[0].tokens); // ['勇者', '踏上', '了', '征程']
 *
 * // 一步到位：训练 NGramEngine
 * const engine = new NGramEngine();
 * pipeline.processAndTrain(entries, engine);
 * ```
 *
 * @version 0.1.0
 */

import type { CorpusEntry, CorpusSource } from './types.js';
import { NGramEngine } from './NGramEngine.js';
import { InvertedIndex } from './InvertedIndex.js';

// ============================================================================
// 常量
// ============================================================================

/** 特殊字符正则 — 不影响句义的标点 */
const SPECIAL_CHARS_PATTERN = /[→←↑↓↔↕⇒⇔⇢⇠⇄↩↪⟶⟵⟷⟼⟻⟾⟿⟳⟲⟱⟰⟯⟮⟭⟬⟫⟪⟩⟨⟧⟦⟥⟤⟣⟢⟡⟠⟟⟞⟝⟜⟛⟚⟙⟘⟗⟖⟕⟔⟓⟒⟑⟐⟏⟎⟍⟌⟋⟊⟉⟈⟇⟆⟅⟄⟃⟂⟁⟀∕∤∦∻∼∽∾∿≀≁≂≃≄≅≆≇≈≉≊≋≌≍≎≏≐≑≒≓≔≕≖≗≘≙≚≛≜≝≞≟≠≡≢≣≤≥≦≧≨≩≪≫≬≭≮≯≰≱≲≳≴≵≶≷≸≹≺≻≼≽≾≿⊀⊁⊂⊃⊄⊅⊆⊇⊈⊉⊊⊋⊌⊍⊎⊏⊐⊑⊒⊓⊔⊕⊖⊗⊘⊙⊚⊛⊜⊝⊞⊟⊠⊡⊢⊣⊤⊥⊦⊧⊨⊩⊪⊫⊬⊭⊮⊯⊰⊱⊲⊳⊴⊵⊶⊷⊸⊹⊺⊻⊼⊽⊾⊿⋀⋁⋂⋃⋄⋅⋆⋇⋈⋉⋊⋋⋌⋍⋎⋏⋐⋑⋒⋓⋔⋕⋖⋗⋘⋙⋚⋛⋜⋝⋞⋟⋠⋡⋢⋣⋤⋥⋦⋧⋨⋩⋪⋫⋬⋭⋮⋯⋰⋱⋲⋳⋴⋵⋶⋷⋸⋹⋺⋻⋼⋽⋾]|★|☆|◆|◇|◎|▲|△|▼|▽|□|■|○|●/g;

/** 控制字符和零宽字符 */
// eslint-disable-next-line no-control-regex, no-irregular-whitespace
const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F​-‏﻿]/g;

/** 重复标点模式（连续的相同标点保留一个） */
const REPEATED_PUNCT_PATTERN = /([，。、；：！？.!?])\1+/g;

/** 句式分类关键词（中文） */
const SENTENCE_PATTERNS_ZH: Record<string, RegExp> = {
  '对话': /^["「「『]|["」」』]$|(说|道|问|答|喊|叫|告诉|解释|回应|喊|嚷):/,
  '叙事': /^(他|她|它|我|你|这|那|在|从|随着|当|突然|终于|后来|从此|于是|然后|接着|随后|最后)/,
  '描述': /(是|有|像|如|仿佛|似乎|显得|看起来|看上去|传来|映入|映入眼帘)/,
  '内心独白': /(想|觉得|认为|感到|感觉|以为|希望|担心|害怕|怀疑|相信|疑惑|不解)/,
};

/** 句式分类关键词（英文） */
const SENTENCE_PATTERNS_EN: Record<string, RegExp> = {
  'dialogue': /^["']|["']$|^"|"$|(said|asked|replied|shouted|whispered|explained):/i,
  'narration': /^(he|she|it|i|you|they|we|the|a|an|in|on|at|from|with|as|when|suddenly|finally|then|after)/i,
  'description': /(is|are|was|were|has|have|had|looks|seems|appears|feels|like|as if)/i,
  'inner_monologue': /(think|thought|feel|felt|believe|wonder|hope|worry|fear|doubt|suspect)/i,
};

// ============================================================================
// 句式分类结果
// ============================================================================

/** 句式分类结果 */
export interface ClassificationResult {
  /** 原始文本 */
  readonly text: string;
  /** 推断的分类 */
  readonly category: string;
  /** 置信度 (0-1) */
  readonly confidence: number;
}

// ============================================================================
// 预处理管道
// ============================================================================

export class PreprocessingPipeline {
  /** 句式分类命中计数器 */
  private classificationStats: Map<string, number> = new Map();

  // ==========================================================================
  // 主处理流程
  // ==========================================================================

  /**
   * 对 CorpusEntry[] 执行完整的预处理。
   *
   * 会修改每个 entry 的 tokens 字段（填充分词结果），
   * 并可能更新 category 字段（如果原始 category 为默认值且可推断出更精确的分类）。
   *
   * @param entries - 原始语料条目
   * @returns 处理后的 CorpusEntry[]（与输入同一引用，tokens 和 category 已更新）
   */
  process(entries: CorpusEntry[]): CorpusEntry[] {
    for (const entry of entries) {
      // 1. 分词
      const tokens = this.tokenize(entry.text);

      // 2. 去特殊符号
      const cleanTokens = this.removeSpecialChars(tokens);

      // 3. 句式分类（仅当 category 为默认值时）
      if (entry.category === '导入语料' || entry.category === 'imported') {
        const classification = this.classifySentence(entry.text);
        if (classification.confidence > 0.5) {
          entry.category = classification.category;
        }
      }

      // 4. 填充 tokens
      entry.tokens = cleanTokens;
    }

    return entries;
  }

  /**
   * 预处理并直接训练 NGramEngine。
   *
   * 便捷方法：一步完成处理 + 训练。
   *
   * @param entries - 原始语料条目
   * @param engine - NGramEngine 实例
   * @param source - 语料来源（默认 'imported'）
   * @returns 处理后的 entries
   */
  processAndTrain(
    entries: CorpusEntry[],
    engine: NGramEngine,
    source: CorpusSource = 'imported',
  ): CorpusEntry[] {
    const processed = this.process(entries);
    for (const entry of processed) {
      if (entry.tokens.length > 0) {
        engine.train(entry.tokens, source);
      }
    }
    return processed;
  }

  /**
   * 预处理并构建倒排索引。
   *
   * @param entries - 处理后的 CorpusEntry
   * @param index - InvertedIndex 实例
   */
  buildIndex(entries: CorpusEntry[], index: InvertedIndex): void {
    for (const entry of entries) {
      for (const token of entry.tokens) {
        const freq = this.estimateTokenFrequency(entry, token);
        index.insert(token, freq);
      }
    }
  }

  /**
   * 重置分类统计。
   */
  resetStats(): void {
    this.classificationStats.clear();
  }

  /**
   * 获取分类统计。
   */
  getClassificationStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [category, count] of this.classificationStats) {
      stats[category] = count;
    }
    return stats;
  }

  // ==========================================================================
  // 分词
  // ==========================================================================

  /**
   * 对文本执行分词。
   *
   * 使用 NGramEngine.tokenize() 作为基础分词器，
   * 额外处理：去除零宽字符、规范化标点。
   *
   * @param text - 原始文本
   * @returns token 数组
   */
  tokenize(text: string): string[] {
    // 使用临时引擎获取基础分词
    const tempEngine = new NGramEngine();

    // 预处理文本
    const clean = text
      .replace(CONTROL_CHARS_PATTERN, '')
      .replace(REPEATED_PUNCT_PATTERN, '$1');

    return tempEngine.tokenize(clean);
  }

  // ==========================================================================
  // 去特殊符号
  // ==========================================================================

  /**
   * 去除 token 中的特殊符号。
   *
   * 过滤规则：
   * - 纯符号 token（如 "→", "★", "..."）→ 过滤
   * - 长度为 1 的纯标点 → 过滤
   * - 纯数字 → 保留
   * - 包含字母数字或中文的 token → 保留（去除首尾的符号）
   *
   * @param tokens - 原始 token 数组
   * @returns 清洗后的 token 数组
   */
  removeSpecialChars(tokens: string[]): string[] {
    const result: string[] = [];

    for (const token of tokens) {
      // 跳过特殊符号 token
      if (SPECIAL_CHARS_PATTERN.test(token)) continue;

      // 跳过纯标点但保留句末标点
      if (/^[，。、；：！？.!?,\s]+$/.test(token)) {
        // 保留句号、问号、感叹号作为分段标记
        if (/^[。！？.!?]$/.test(token)) {
          result.push(token);
        }
        continue;
      }

      // 跳过空 token
      if (token.trim() === '') continue;

      // 清理 token 首尾的特殊符号
      let cleaned = token.replace(/^[，。、；：！？.!?,\s「」『』【】《》()[\]""'']+/, '');
      cleaned = cleaned.replace(/[，。、；：！？.!?,\s「」『』【】《》()[\]""'']+$/, '');

      if (cleaned.length > 0) {
        result.push(cleaned);
      }
    }

    return result;
  }

  // ==========================================================================
  // 句式分类
  // ==========================================================================

  /**
   * 对句子进行句式分类。
   *
   * 通过关键词模式匹配推断句式类型。
   *
   * @param sentence - 待分类的句子
   * @returns 分类结果（含置信度）
   */
  classifySentence(sentence: string): ClassificationResult {
    // 尝试中文模式
    for (const [category, pattern] of Object.entries(SENTENCE_PATTERNS_ZH)) {
      const match = sentence.match(pattern);
      if (match) {
        this.incrementStat(category);
        return { text: sentence, category, confidence: 0.7 };
      }
    }

    // 尝试英文模式
    for (const [category, pattern] of Object.entries(SENTENCE_PATTERNS_EN)) {
      const match = sentence.match(pattern);
      if (match) {
        this.incrementStat(category);
        return { text: sentence, category, confidence: 0.7 };
      }
    }

    // 回退：按长度推断
    if (sentence.length < 20) {
      this.incrementStat('对话');
      return { text: sentence, category: '对话', confidence: 0.4 };
    }
    if (sentence.length > 100) {
      this.incrementStat('叙事');
      return { text: sentence, category: '叙事', confidence: 0.4 };
    }

    this.incrementStat('描述');
    return { text: sentence, category: '描述', confidence: 0.3 };
  }

  // ==========================================================================
  // 工具方法
  // ==========================================================================

  /**
   * 估算 token 在条目中的频次权重。
   *
   * @param entry - 语料条目
   * @param token - token 文本
   * @returns 频次估算（条目越长权重越高）
   */
  private estimateTokenFrequency(entry: CorpusEntry, token: string): number {
    // 计算 token 在 entry.text 中的出现次数
    const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const count = (entry.text.match(regex) ?? []).length;
    return count;
  }

  /**
   * 递增分类统计计数器。
   */
  private incrementStat(category: string): void {
    const current = this.classificationStats.get(category) ?? 0;
    this.classificationStats.set(category, current + 1);
  }
}
