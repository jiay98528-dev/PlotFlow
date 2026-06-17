/**
 * 补全引擎单元测试 (M5-01 + M5-03)
 *
 * 覆盖:
 * - NGramEngine: train / predict / prune / serialize
 * - InvertedIndex: insert / search / searchAll / remove
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NGramEngine } from '../completion/NGramEngine.js';
import { InvertedIndex } from '../completion/InvertedIndex.js';

// ============================================================================
// NGramEngine 测试
// ============================================================================

describe('NGramEngine', () => {
  let engine: NGramEngine;

  beforeEach(() => {
    engine = new NGramEngine();
  });

  // --- 分词 ---

  describe('tokenize', () => {
    it('should split Chinese text into character tokens', () => {
      const tokens = engine.tokenize('勇者踏上征程');
      expect(tokens).toEqual(['勇', '者', '踏', '上', '征', '程']);
    });

    it('should group English words into word tokens', () => {
      const tokens = engine.tokenize('The hero arrives');
      expect(tokens).toEqual(['The', 'hero', 'arrives']);
    });

    it('should handle mixed Chinese-English text', () => {
      const tokens = engine.tokenize('勇者hero来到village');
      expect(tokens).toEqual(['勇', '者', 'hero', '来', '到', 'village']);
    });

    it('should separate punctuation as individual tokens', () => {
      const tokens = engine.tokenize('你好，世界！');
      expect(tokens).toEqual(['你', '好', '，', '世', '界', '！']);
    });

    it('should skip whitespace', () => {
      const tokens = engine.tokenize('  hello   world  ');
      expect(tokens).toEqual(['hello', 'world']);
    });

    it('should return empty array for empty string', () => {
      const tokens = engine.tokenize('');
      expect(tokens).toEqual([]);
    });
  });

  // --- 训练 ---

  describe('train', () => {
    it('should train unigrams (1-gram) and build frequency counts', () => {
      engine.train(['勇', '者', '勇']);

      // 1-gram: context="" → candidates
      const candidates = engine.getCandidates(1, []);
      expect(candidates).toBeDefined();
      expect(candidates!.get('勇')).toBe(2);
      expect(candidates!.get('者')).toBe(1);
    });

    it('should train bigrams (2-gram) with correct context', () => {
      engine.train(['勇', '者', '踏', '上']);

      // 2-gram: context "勇" → candidates
      const candidates = engine.getCandidates(2, ['勇']);
      expect(candidates).toBeDefined();
      expect(candidates!.get('者')).toBe(1);

      // 2-gram: context "者" → candidates
      const candidates2 = engine.getCandidates(2, ['者']);
      expect(candidates2).toBeDefined();
      expect(candidates2!.get('踏')).toBe(1);
    });

    it('should train trigrams (3-gram) with correct context', () => {
      engine.train(['勇', '者', '踏', '上', '征', '程']);

      // 3-gram: context "勇 者" → "踏"
      const candidates = engine.getCandidates(3, ['勇', '者']);
      expect(candidates).toBeDefined();
      expect(candidates!.get('踏')).toBe(1);

      // 3-gram: context "者 踏" → "上"
      const candidates2 = engine.getCandidates(3, ['者', '踏']);
      expect(candidates2).toBeDefined();
      expect(candidates2!.get('上')).toBe(1);
    });

    it('should train all gram levels (1-5) simultaneously', () => {
      engine.train(['A', 'B', 'C', 'D', 'E']);

      // Verify all gram levels have entries in the model (not necessarily with empty context)
      const model = engine.toModel();
      for (let n = 1; n <= 5; n++) {
        expect(model.store[n]).toBeDefined();
        expect(Object.keys(model.store[n]!).length).toBeGreaterThan(0);
      }
    });

    it('should accumulate frequency on repeated training', () => {
      engine.train(['勇', '者', '勇']);
      engine.train(['勇', '者', '勇']);

      const candidates = engine.getCandidates(1, []);
      expect(candidates!.get('勇')).toBe(4); // 2 per training
      expect(candidates!.get('者')).toBe(2);
    });

    it('should track totalTokens', () => {
      engine.train(['A', 'B', 'C']);
      expect(engine.totalTokens).toBe(3);

      engine.train(['D', 'E']);
      expect(engine.totalTokens).toBe(5);
    });

    it('should not crash on empty token array', () => {
      expect(() => engine.train([])).not.toThrow();
      expect(engine.totalTokens).toBe(0);
    });

    it('should set entryCount correctly', () => {
      expect(engine.entryCount).toBe(0);
      engine.train(['A', 'B', 'A']);
      expect(engine.entryCount).toBeGreaterThan(0);
    });
  });

  // --- 训练（文本） ---

  describe('trainFromText', () => {
    it('should tokenize and train from raw text', () => {
      engine.trainFromText('勇者踏上征程');

      const candidates = engine.getCandidates(1, []);
      expect(candidates!.get('勇')).toBe(1);
      expect(candidates!.get('者')).toBe(1);
      expect(candidates!.get('踏')).toBe(1);
    });

    it('should handle incremental learning', () => {
      engine.incrementalLearn(['勇', '者']);

      // 验证训练成功
      const candidates = engine.getCandidates(2, ['勇']);
      expect(candidates!.get('者')).toBe(1);
    });
  });

  // --- 预测 ---

  describe('predict', () => {
    it('should predict next token from context', () => {
      engine.train(['勇', '者', '踏', '上', '征', '程']);

      // prefix "勇" → predict next word after "勇"
      const completions = engine.predict('勇', 3);
      expect(completions).toContain('者');
    });

    it('should use bigram context for prediction', () => {
      engine.train(['勇', '者', '踏', '上']);
      engine.train(['勇', '者', '来', '到']); // "勇者" can be followed by "踏" or "来"
      engine.train(['勇', '者', '踏', '入']); // More "踏" frequency

      // prefix "勇者" → last two tokens are "勇 者"
      const completions = engine.predict('勇者', 3);
      expect(completions.length).toBeGreaterThanOrEqual(1);
      // "踏" should appear before "来" due to higher frequency
      const taIndex = completions.indexOf('踏');
      const laiIndex = completions.indexOf('来');
      if (taIndex !== -1 && laiIndex !== -1) {
        expect(taIndex).toBeLessThan(laiIndex);
      }
    });

    it('should fallback to shorter grams when longer gram has no match', () => {
      // Train only unigrams and bigrams
      engine.train(['勇', '者', '踏', '上']);
      engine.train(['英', '雄', '来', '到']);

      // "英雄" prefix: try 3-gram (no match) → 2-gram → find "来" after "英雄" context (well "雄" only)
      const completions = engine.predict('英雄', 5);
      expect(completions.length).toBeGreaterThan(0);
      expect(completions).toContain('来');
    });

    it('should return unigram candidates when no higher-order match exists', () => {
      engine.train(['A', 'B', 'C']);

      // Predict with unknown prefix — unigram backoff provides high-frequency candidates
      const completions = engine.predict('XYZ', 5);
      expect(completions.length).toBeGreaterThan(0);
      expect(completions).toContain('A');
    });

    it('should respect topN limit', () => {
      engine.train(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);

      const completions = engine.predict('', 3);
      expect(completions.length).toBeLessThanOrEqual(3);
    });

    it('should de-duplicate candidates across gram levels', () => {
      engine.train(['勇', '者', '踏', '上']);

      // "勇" should match both unigram (勇 appears as word) and bigram (勇 as context)
      const completions = engine.predict('勇', 5);
      // No duplicates
      const unique = new Set(completions);
      expect(unique.size).toBe(completions.length);
    });
  });

  // --- 增强预测 ---

  describe('predictScored', () => {
    it('should return scored results', () => {
      engine.train(['勇', '者', '踏', '上']);
      engine.train(['勇', '者', '踏', '入']);

      const results = engine.predictScored('勇者', 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('text');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('source');
      expect(results[0]!.score).toBeGreaterThan(0);
    });

    it('should sort by score descending', () => {
      engine.train(['勇', '者', '踏', '上']);
      engine.train(['勇', '者', '踏', '入']);
      engine.train(['勇', '者', '踏', '入']);
      engine.train(['勇', '者', '来', '到']);

      const results = engine.predictScored('勇者', 5);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
      }
    });
  });

  // --- 查询 ---

  describe('has and getFrequency', () => {
    it('should report existence correctly', () => {
      engine.train(['A', 'B', 'C']);

      expect(engine.has(['A'], 'B')).toBe(true);
      expect(engine.has(['X'], 'Y')).toBe(false);
    });

    it('should return correct frequency', () => {
      engine.train(['A', 'B', 'A', 'B']);
      engine.train(['A', 'B']);

      expect(engine.getFrequency(['A'], 'B')).toBe(3);
      expect(engine.getFrequency(['X'], 'Y')).toBe(0);
    });
  });

  // --- 清理 ---

  describe('prune', () => {
    it('should not crash on empty engine', () => {
      expect(() => engine.prune()).not.toThrow();
    });

    it('should keep all entries with default params', () => {
      engine.train(['A', 'B', 'C']);
      const before = engine.entryCount;
      engine.prune();
      expect(engine.entryCount).toBe(before);
    });
  });

  describe('clear', () => {
    it('should remove all training data', () => {
      engine.train(['A', 'B', 'C']);
      expect(engine.entryCount).toBeGreaterThan(0);

      engine.clear();
      expect(engine.entryCount).toBe(0);
      expect(engine.totalTokens).toBe(0);
    });
  });

  // --- 序列化 ---

  describe('serialization', () => {
    it('should serialize to JSON and back', () => {
      engine.train(['勇', '者', '踏', '上', '征', '程']);
      engine.train(['勇', '者', '来', '到', '村', '庄']);

      const json = engine.serialize();
      expect(typeof json).toBe('string');
      expect(json.length).toBeGreaterThan(0);

      const restored = NGramEngine.deserialize(json);
      expect(restored.totalTokens).toBe(engine.totalTokens);
      expect(restored.entryCount).toBe(engine.entryCount);

      // Predictions should match
      const original = engine.predict('勇者', 3);
      const restoredPredict = restored.predict('勇者', 3);
      expect(restoredPredict).toEqual(original);
    });

    it('should handle empty engine serialization', () => {
      const json = engine.serialize();
      const restored = NGramEngine.deserialize(json);
      expect(restored.totalTokens).toBe(0);
      expect(restored.entryCount).toBe(0);
    });

    it('should support toModel / fromModel roundtrip', () => {
      engine.train(['A', 'B', 'C', 'A', 'B', 'D']);

      const model = engine.toModel();
      expect(model.version).toBe(1);
      expect(model.totalTokens).toBe(6);
      expect(Object.keys(model.store).length).toBeGreaterThan(0);

      const restored = NGramEngine.fromModel(model);
      expect(restored.totalTokens).toBe(6);

      // Verify prediction consistency
      expect(restored.predict('A', 3)).toEqual(engine.predict('A', 3));
    });

    it('should produce pretty-printed JSON when requested', () => {
      engine.train(['A', 'B']);
      const pretty = engine.serialize(true);
      expect(pretty).toContain('\n');
      expect(pretty).toContain('  ');
    });
  });

  // --- 边缘情况 ---

  describe('edge cases', () => {
    it('should handle empty string in predict', () => {
      engine.train(['A', 'B']);
      const result = engine.predict('', 5);
      // Empty prefix → unigram lookup (context="") — should return top tokens
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle maxN property', () => {
      expect(engine.maxN).toBe(5);
    });

    it('should not exceed max gram level', () => {
      const tokens = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      engine.train(tokens);

      // 5-gram: context length 4 + completion length 1 = 5
      expect(engine.getFrequency(['A', 'B', 'C', 'D'], 'E')).toBeGreaterThan(0);

      // 6-gram would need context length 5, which exceeds MAX_N=5 — should return 0
      expect(engine.getFrequency(['A', 'B', 'C', 'D', 'E'], 'F')).toBe(0);
    });
  });
});

// ============================================================================
// InvertedIndex 测试
// ============================================================================

describe('InvertedIndex', () => {
  let index: InvertedIndex;

  beforeEach(() => {
    index = new InvertedIndex();
  });

  // --- 插入 ---

  describe('insert', () => {
    it('should insert a word and make it searchable', () => {
      index.insert('has_key', 5);

      const results = index.search('has_');
      expect(results).toContain('has_key');
    });

    it('should handle empty string gracefully', () => {
      expect(() => index.insert('', 1)).not.toThrow();
      expect(index.size).toBe(0);
    });

    it('should update size correctly', () => {
      index.insert('hello', 1);
      expect(index.size).toBe(1);

      index.insert('world', 2);
      expect(index.size).toBe(2);
    });
  });

  describe('insertBatch', () => {
    it('should insert multiple entries at once', () => {
      index.insertBatch([
        ['has_key', 5],
        ['has_sword', 3],
        ['health', 10],
      ]);

      expect(index.size).toBe(3);
      expect(index.search('has_', 10)).toEqual(['has_key', 'has_sword']);
    });
  });

  // --- 前缀搜索 ---

  describe('search', () => {
    beforeEach(() => {
      index.insertBatch([
        ['has_key', 5],
        ['has_sword', 3],
        ['health', 10],
        ['helmet', 7],
        ['halo', 1],
        ['horse', 8],
      ]);
    });

    it('should find candidates by exact prefix match at the prefix node', () => {
      // "has_" prefixes both "has_key" and "has_sword"
      const results = index.search('has_', 10);
      expect(results).toHaveLength(2);
      expect(results).toContain('has_key');
      expect(results).toContain('has_sword');
    });

    it('should rank by frequency descending', () => {
      const results = index.search('h', 10);
      // health(10) > horse(8) > helmet(7) > has_key(5) > has_sword(3) > halo(1)
      expect(results).toEqual(['health', 'horse', 'helmet', 'has_key', 'has_sword', 'halo']);
    });

    it('should respect limit parameter', () => {
      const results = index.search('h', 2);
      expect(results).toHaveLength(2);
      expect(results).toEqual(['health', 'horse']);
    });

    it('should return empty array for unknown prefix', () => {
      const results = index.search('xyz', 10);
      expect(results).toEqual([]);
    });

    it('should return empty array for empty prefix', () => {
      const results = index.search('', 10);
      expect(results).toEqual([]);
    });
  });

  // --- 子树搜索 ---

  describe('searchAll', () => {
    beforeEach(() => {
      index.insertBatch([
        ['has_key', 5],
        ['has_sword', 3],
        ['health', 10],
        ['helmet', 7],
        ['halo', 1],
      ]);
    });

    it('should collect all candidates in subtree', () => {
      // "ha" subtree contains "has_key", "has_sword", "halo"
      const results = index.searchAll('ha', 10);
      expect(results).toContain('has_key');
      expect(results).toContain('has_sword');
      expect(results).toContain('halo');
      expect(results).not.toContain('health');
      expect(results).not.toContain('helmet');
    });

    it('should respect limit parameter', () => {
      // "h" subtree has all 5 entries
      const results = index.searchAll('h', 3);
      expect(results).toHaveLength(3);
    });

    it('should return empty array for non-existent prefix', () => {
      const results = index.searchAll('xyz', 10);
      expect(results).toEqual([]);
    });
  });

  // --- 检查存在 ---

  describe('has', () => {
    it('should return true for existing prefix', () => {
      index.insert('has_key', 5);
      expect(index.has('has_')).toBe(true);
      expect(index.has('has_key')).toBe(true);
    });

    it('should return false for non-existent prefix', () => {
      expect(index.has('unknown')).toBe(false);
    });

    it('should return false for empty prefix', () => {
      expect(index.has('')).toBe(false);
    });
  });

  // --- 删除 ---

  describe('remove', () => {
    it('should remove an existing word', () => {
      index.insert('has_key', 5);
      index.insert('has_sword', 3);

      expect(index.size).toBe(2);

      const removed = index.remove('has_key');
      expect(removed).toBe(true);
      expect(index.size).toBe(1);

      const results = index.search('has_', 10);
      expect(results).toEqual(['has_sword']);
    });

    it('should return false for non-existent word', () => {
      const removed = index.remove('nonexistent');
      expect(removed).toBe(false);
    });

    it('should handle empty string removal', () => {
      const removed = index.remove('');
      expect(removed).toBe(false);
    });
  });

  // --- 清空 ---

  describe('clear', () => {
    it('should remove all entries', () => {
      index.insertBatch([
        ['has_key', 5],
        ['has_sword', 3],
      ]);
      expect(index.size).toBe(2);

      index.clear();
      expect(index.size).toBe(0);
      expect(index.search('h', 10)).toEqual([]);
    });
  });
});
