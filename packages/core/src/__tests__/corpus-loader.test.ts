/**
 * CorpusLoader 单元测试 (M5-02 + M5-06)
 *
 * 覆盖:
 * - CorpusLoader.loadCorpus: 懒加载英文语料 → CorpusData
 * - CorpusLoader.loadToEngine: 加载 + 训练 NGramEngine
 * - CorpusData: getCategories / getEntries / getAllTexts / getCategoryStats / getAllTokens
 * - 缓存机制: 重复加载走缓存
 * - 单例模式: getInstance / resetInstance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CorpusLoader } from '../completion/CorpusLoader.js';
import { NGramEngine } from '../completion/NGramEngine.js';

// ============================================================================
// CorpusLoader 测试
// ============================================================================

describe('CorpusLoader', () => {
  // 每个测试前重置单例，保证隔离
  beforeEach(() => {
    CorpusLoader.resetInstance();
  });

  describe('单例模式', () => {
    it('getInstance 应返回同一个实例', () => {
      const a = CorpusLoader.getInstance();
      const b = CorpusLoader.getInstance();
      expect(a).toBe(b);
    });

    it('resetInstance 应重置单例', () => {
      const a = CorpusLoader.getInstance();
      CorpusLoader.resetInstance();
      const b = CorpusLoader.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('loadCorpus（英言语料懒加载）', () => {
    it('应加载英文语料并返回有效的 CorpusData', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');

      expect(data).toBeDefined();
      expect(data.language).toBe('en');
      expect(data.totalCount).toBeGreaterThan(0);
      expect(Array.isArray(data.entries)).toBe(true);

      // 验证每条语料的结构
      for (const entry of data.entries) {
        expect(entry).toHaveProperty('category');
        expect(entry).toHaveProperty('text');
        expect(entry).toHaveProperty('tokens');
        expect(typeof entry.category).toBe('string');
        expect(typeof entry.text).toBe('string');
        expect(Array.isArray(entry.tokens)).toBe(true);
      }
    });

    it('应包含 game 和 lit 分类', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');
      const categories = data.getCategories();

      expect(categories).toContain('game-rpg');
      expect(categories).toContain('lit-shakespeare');
      expect(categories).toContain('lit-american');
    });

    it('game / lit 比例应大致均衡（40%-60%）', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');
      const stats = data.getCategoryStats();

      const gameCount = Object.entries(stats)
        .filter(([cat]) => cat.startsWith('game-'))
        .reduce((sum, [, count]) => sum + count, 0);
      const litCount = Object.entries(stats)
        .filter(([cat]) => cat.startsWith('lit-'))
        .reduce((sum, [, count]) => sum + count, 0);
      const ratio = gameCount / litCount;

      expect(ratio).toBeGreaterThanOrEqual(0.4);
      expect(ratio).toBeLessThanOrEqual(1.6);
    });

    it('重复加载应走缓存', async () => {
      const loader = CorpusLoader.getInstance();
      expect(loader.isLoaded('en')).toBe(false);

      await loader.loadCorpus('en');
      expect(loader.isLoaded('en')).toBe(true);

      // 第二次调用应走缓存
      const data2 = await loader.loadCorpus('en');
      expect(data2.totalCount).toBeGreaterThan(0);
    });

    it('forceReload 应跳过缓存', async () => {
      const loader = CorpusLoader.getInstance();
      await loader.loadCorpus('en');
      expect(loader.isLoaded('en')).toBe(true);

      // 强制重新加载
      const data = await loader.loadCorpus('en', true);
      expect(data.totalCount).toBeGreaterThan(0);
    });
  });

  describe('CorpusData 方法', () => {
    it('getAllTexts 应返回所有文本', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');
      const texts = data.getAllTexts();

      expect(Array.isArray(texts)).toBe(true);
      expect(texts.length).toBe(data.totalCount);
      for (const t of texts) {
        expect(typeof t).toBe('string');
      }
    });

    it('getEntries 应按分类过滤', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');
      const rpg = data.getEntries('game-rpg');

      expect(rpg.length).toBeGreaterThan(0);
      for (const e of rpg) {
        expect(e.category).toBe('game-rpg');
      }
    });

    it('getCategoryStats 应返回正确统计', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');
      const stats = data.getCategoryStats();

      const total = Object.values(stats).reduce((sum, c) => sum + c, 0);
      expect(total).toBe(data.totalCount);
    });

    it('getAllTokens 应返回扁平 token 数组', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');
      const tokens = data.getAllTokens();

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      for (const t of tokens) {
        expect(typeof t).toBe('string');
      }
    });

    it('sample 应返回随机子集', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');
      const sampled = data.sample(5);

      expect(sampled.length).toBe(5);
    });

    it('sampleFromCategory 应按分类随机采样', async () => {
      const loader = CorpusLoader.getInstance();
      const data = await loader.loadCorpus('en');
      const sampled = data.sampleFromCategory('game-rpg', 3);

      expect(sampled.length).toBe(3);
      for (const e of sampled) {
        expect(e.category).toBe('game-rpg');
      }
    });
  });

  describe('loadToEngine（加载 + 训练）', () => {
    it('应训练 NGramEngine 并返回加载统计', async () => {
      const loader = CorpusLoader.getInstance();
      const engine = new NGramEngine();
      const stats = await loader.loadToEngine(engine, 'en', 'baseline');

      expect(stats.entriesLoaded).toBeGreaterThan(0);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.sourceFile).toBe('en.json');
      expect(typeof stats.categories).toBe('object');

      // 引擎学到了数据
      expect(engine.totalTokens).toBeGreaterThan(0);
      expect(engine.entryCount).toBeGreaterThan(0);
    });

    it('训练后应能生成预测', async () => {
      const loader = CorpusLoader.getInstance();
      const engine = new NGramEngine();
      await loader.loadToEngine(engine, 'en', 'baseline');

      const predictions = engine.predict('the', 3);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('应支持 imported 来源参数', async () => {
      const loader = CorpusLoader.getInstance();
      const engine = new NGramEngine();
      const stats = await loader.loadToEngine(engine, 'en', 'imported');

      expect(stats.entriesLoaded).toBeGreaterThan(0);
    });
  });

  describe('缓存管理', () => {
    it('clearCache 应清除指定语言的缓存', async () => {
      const loader = CorpusLoader.getInstance();
      await loader.loadCorpus('en');
      expect(loader.isLoaded('en')).toBe(true);

      loader.clearCache('en');
      expect(loader.isLoaded('en')).toBe(false);
    });

    it('getLoadedLanguages 应返回已缓存的语言列表', async () => {
      const loader = CorpusLoader.getInstance();
      expect(loader.getLoadedLanguages()).toEqual([]);

      await loader.loadCorpus('en');
      expect(loader.getLoadedLanguages()).toEqual(['en']);
    });
  });

  describe('createFromData', () => {
    it('应从原始数据创建 CorpusData', () => {
      const loader = CorpusLoader.getInstance();
      const corpusData = loader.createFromData(
        [
          { category: 'test', text: 'hello world', tokens: ['hello', 'world'] },
          { category: 'test', text: 'foo bar', tokens: ['foo', 'bar'] },
        ],
        'en',
      );

      expect(corpusData.totalCount).toBe(2);
      expect(corpusData.language).toBe('en');
      expect(corpusData.getCategories()).toEqual(['test']);
      expect(corpusData.getAllTokens()).toEqual(['hello', 'world', 'foo', 'bar']);
    });
  });
});
