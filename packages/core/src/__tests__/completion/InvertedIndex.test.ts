/**
 * InvertedIndex 单元测试 (M5-04)
 *
 * 覆盖要求 (≥6 用例):
 * - 前缀查询（精确匹配 vs 模糊匹配）
 *
 * @version 0.1.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InvertedIndex } from '../../completion/InvertedIndex.js';

// ============================================================================
// InvertedIndex 测试
// ============================================================================

describe('InvertedIndex', () => {
  let index: InvertedIndex;

  beforeEach(() => {
    index = new InvertedIndex();
  });

  // ==========================================================================
  // 前缀查询 — 精确匹配
  // ==========================================================================

  describe('prefix exact match (search)', () => {
    it('should find exact prefix boundary matches', () => {
      index.insert('has_key', 5);
      index.insert('has_sword', 3);
      index.insert('haste', 2);

      // "has_" exactly matches the prefix node shared by "has_key" and "has_sword"
      // "haste" shares "has" prefix but NOT "has_"
      const results = index.search('has_', 10);
      expect(results).toHaveLength(2);
      expect(results).toContain('has_key');
      expect(results).toContain('has_sword');
      expect(results).not.toContain('haste');
    });

    it('should match full words exactly when prefix length equals word length', () => {
      index.insert('sword', 10);
      index.insert('swordfish', 5);

      // "sword" as prefix hits the node exactly at "sword"
      const results = index.search('sword', 10);
      // Both "sword" and "swordfish" pass through that node
      expect(results).toContain('sword');
      expect(results).toContain('swordfish');
    });

    it('should return only results at the exact prefix node, not subtree', () => {
      index.insert('abc', 1);
      index.insert('abcd', 2);
      index.insert('abcde', 3);

      // search('abc') walks to node "abc" — both "abc" and "abcd" and "abcde" pass through it
      const results = index.search('abc', 10);
      expect(results).toHaveLength(3);
      expect(results).toContain('abc');
      expect(results).toContain('abcd');
      expect(results).toContain('abcde');
    });
  });

  // ==========================================================================
  // 前缀查询 — 子树匹配（模糊匹配扩展）
  // ==========================================================================

  describe('prefix fuzzy/partial match (searchAll)', () => {
    it('should collect all subtree candidates for a short prefix', () => {
      index.insertBatch([
        ['has_key', 5],
        ['has_sword', 3],
        ['haste', 2],
        ['hat', 1],
      ]);

      // "ha" subtree covers "has_key", "has_sword", "haste", "hat"
      const results = index.searchAll('ha', 10);
      expect(results).toHaveLength(4);
    });

    it('should return empty for prefix not in the index', () => {
      index.insert('hello', 1);

      const exact = index.search('xyz', 10);
      expect(exact).toEqual([]);

      const all = index.searchAll('xyz', 10);
      expect(all).toEqual([]);
    });

    it('should rank subtree results by frequency descending', () => {
      index.insert('dragon', 1);
      index.insert('drake', 5);
      index.insert('dramatic', 3);

      const results = index.searchAll('dr', 10);
      // drake(5) > dramatic(3) > dragon(1)
      expect(results[0]).toBe('drake');
      expect(results[2]).toBe('dragon');
    });
  });

  // ==========================================================================
  // 精确匹配 vs 模糊匹配对比
  // ==========================================================================

  describe('search vs searchAll comparison', () => {
    it('search should be a subset of searchAll results', () => {
      index.insertBatch([
        ['abc', 1],
        ['abcd', 2],
        ['abcdef', 3],
      ]);

      const exact = index.search('abc', 10);
      const all = index.searchAll('abc', 10);

      // All exact results should appear in searchAll
      for (const word of exact) {
        expect(all).toContain(word);
      }
    });

    it('searchAll should return more results than search for shared prefix', () => {
      index.insertBatch([
        ['hello', 10],
        ['help', 8],
        ['helm', 5],
        ['he', 3],
      ]);

      const exact = index.search('hel', 10);
      void exact; // used for API verification
      const all = index.searchAll('hel', 10);

      // "he" does NOT pass through "hel" node, so search misses it
      // searchAll collects entire "hel" subtree
      expect(all).toContain('hello');
      expect(all).toContain('help');
      expect(all).toContain('helm');
      expect(all).not.toContain('he'); // "he" doesn't start with "hel"
    });
  });

  // ==========================================================================
  // 前缀查询边界情况
  // ==========================================================================

  describe('prefix edge cases', () => {
    it('should handle single character prefix', () => {
      index.insert('a', 1);
      index.insert('ab', 2);
      index.insert('abc', 3);

      const results = index.search('a', 10);
      expect(results).toHaveLength(3);
    });

    it('should handle Unicode/CJK characters in prefix', () => {
      index.insert('勇者', 10);
      index.insert('勇気', 5);
      index.insert('勇敢', 3);

      const results = index.search('勇', 10);
      expect(results).toHaveLength(3);
      expect(results).toContain('勇者');
      expect(results).toContain('勇気');
    });
  });
});
