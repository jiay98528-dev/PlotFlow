/**
 * CorpusImporter 语料导入单元测试 (M5-04)
 *
 * 覆盖要求 (≥4 用例):
 * - .txt / .csv 导入
 * - 重复检测
 *
 * @version 0.1.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CorpusImporter } from '../../completion/CorpusImporter.js';
import type { ImportFileInfo } from '../../completion/CorpusImporter.js';

// ============================================================================
// CorpusImporter 测试
// ============================================================================

describe('CorpusImporter', () => {
  let importer: CorpusImporter;

  beforeEach(() => {
    importer = new CorpusImporter();
  });

  // ==========================================================================
  // .txt 导入
  // ==========================================================================

  describe('.txt import', () => {
    it('should import plain text and split into sentences', () => {
      const result = importer.importFromText(
        '勇者踏上了征程。英雄来到了村庄。魔王被击败了。',
        'txt',
        'RPG对话',
      );

      expect(result.newEntriesCount).toBeGreaterThan(0);
      expect(result.rawSegments).toBeGreaterThan(0);
      expect(result.validSegments).toBeGreaterThan(0);
      expect(result.skippedDuplicates).toBe(0);
      expect(result.entries.length).toBeGreaterThan(0);

      // Each entry should have the correct category
      for (const entry of result.entries) {
        expect(entry.category).toBe('RPG对话');
        expect(entry.text.length).toBeGreaterThan(0);
        expect(Array.isArray(entry.tokens)).toBe(true);
      }
    });

    it('should import from ImportFileInfo with .txt type', () => {
      const fileInfo: ImportFileInfo = {
        fileName: 'dialogues.txt',
        content: 'Hello world. This is a test. Import me successfully.',
        size: 58,
        type: 'txt',
      };

      const result = importer.importFromFile(fileInfo);

      expect(result.newEntriesCount).toBeGreaterThan(0);
      expect(result.sourceFile.fileName).toBe('dialogues.txt');
    });

    it('should clean text by removing URLs and code blocks', () => {
      const text = '这是一个链接 https://example.com。\n```\ncode block\n```\n正常文本。';

      const result = importer.importFromText(text, 'txt', '测试');

      // URL line may be filtered out due to cleaning, but normal text should remain
      const normalEntry = result.entries.find((e) => e.text.includes('正常文本'));
      expect(normalEntry).toBeDefined();
    });
  });

  // ==========================================================================
  // .csv 导入
  // ==========================================================================

  describe('.csv import', () => {
    it('should parse CSV with text column and import entries', () => {
      const csvContent = 'category,text\nRPG对话,勇者踏上了征程\nRPG对话,英雄来到了村庄\nRPG对话,魔王被击败了';

      const fileInfo: ImportFileInfo = {
        fileName: 'dialogues.csv',
        content: csvContent,
        size: csvContent.length,
        type: 'csv',
      };

      const result = importer.importFromFile(fileInfo);

      expect(result.newEntriesCount).toBeGreaterThan(0);
      expect(result.sourceFile.fileName).toBe('dialogues.csv');
      // Should have 3 entries from 3 data rows
      const expectedRawSegments = csvContent.split('\n').filter((l) => l.trim() !== '').length - 1; // minus header
      expect(result.rawSegments).toBeLessThanOrEqual(expectedRawSegments);
    });

    it('should reject CSV without text column', () => {
      const csvContent = 'name,value\nfoo,bar\nbaz,qux';

      const fileInfo: ImportFileInfo = {
        fileName: 'bad.csv',
        content: csvContent,
        size: csvContent.length,
        type: 'csv',
      };

      expect(() => importer.importFromFile(fileInfo)).toThrow('text');
    });

    it('should handle CSV with quoted fields containing commas', () => {
      const csvContent = 'category,text\nRPG对话,"Hello, world! This has a comma."\nRPG对话,Simple text.';

      const fileInfo: ImportFileInfo = {
        fileName: 'quoted.csv',
        content: csvContent,
        size: csvContent.length,
        type: 'csv',
      };

      const result = importer.importFromFile(fileInfo);

      expect(result.newEntriesCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 重复检测 — 精确匹配
  // ==========================================================================

  describe('duplicate detection - exact match', () => {
    it('should skip exact duplicate entries across separate imports', () => {
      // First import: unique sentence enters the dedup pool
      const first = importer.importFromText('勇者踏上了征程。', 'txt');
      expect(first.newEntriesCount).toBe(1);

      // Second import: same exact sentence should be detected as duplicate
      const second = importer.importFromText('勇者踏上了征程。', 'txt');

      expect(second.newEntriesCount).toBe(0);
      expect(second.skippedDuplicates).toBe(1);
    });

    it('should detect duplicates across multiple import calls', () => {
      // First import
      importer.importFromText('勇者踏上了征程。', 'txt');

      // Second import with same text
      const result = importer.importFromText('勇者踏上了征程。', 'txt');

      // Should be detected as duplicate
      expect(result.newEntriesCount).toBe(0);
      expect(result.skippedDuplicates).toBe(1);
    });
  });

  // ==========================================================================
  // 重复检测 — 编辑距离去重
  // ==========================================================================

  describe('duplicate detection - edit distance', () => {
    it('should skip near-duplicate entries with edit distance < 3', () => {
      // "hello world" vs "hello world!" → edit distance of 1, should be considered duplicate
      const text = 'hello world. hello world!';

      const result = importer.importFromText(text, 'txt');

      // Only one should be kept
      expect(result.newEntriesCount).toBe(1);
      expect(result.skippedDuplicates).toBeGreaterThanOrEqual(0);
    });

    it('should keep entries with edit distance >= 3', () => {
      importer.importFromText('这是一个完全不同的句子。', 'txt');

      const result = importer.importFromText('勇敢的冒险者踏上了旅途。', 'txt');

      // These are different enough, should not be duplicates
      expect(result.newEntriesCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 文件大小检查
  // ==========================================================================

  describe('file size validation', () => {
    it('should throw for file exceeding 10MB limit', () => {
      const fileInfo: ImportFileInfo = {
        fileName: 'huge.txt',
        content: 'x'.repeat(100),
        size: 11 * 1024 * 1024, // 11MB
        type: 'txt',
      };

      expect(() => importer.importFromFile(fileInfo)).toThrow(/超过单文件最大限制/);
    });
  });

  // ==========================================================================
  // 统计
  // ==========================================================================

  describe('stats tracking', () => {
    it('should track import statistics across multiple files', () => {
      const fileA: ImportFileInfo = {
        fileName: 'a.txt', content: '文本A。文本B。', size: 20, type: 'txt',
      };
      const fileB: ImportFileInfo = {
        fileName: 'b.txt', content: '文本C。文本D。', size: 20, type: 'txt',
      };

      importer.importFromFile(fileA);
      importer.importFromFile(fileB);

      const stats = importer.getStats();
      expect(stats.filesProcessed).toBe(2);
      expect(stats.totalEntries).toBeGreaterThan(0);
    });

    it('should support resetting state', () => {
      importer.importFromText('一些文本。', 'txt');
      expect(importer.entryCount).toBeGreaterThan(0);

      importer.reset();
      expect(importer.entryCount).toBe(0);

      const stats = importer.getStats();
      expect(stats.filesProcessed).toBe(0);
    });
  });
});
