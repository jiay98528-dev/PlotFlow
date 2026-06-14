/**
 * Learner 增量学习单元测试 (M5-04)
 *
 * 覆盖要求 (≥5 用例):
 * - 增量学习
 * - 权重衰减计算
 *
 * @version 0.1.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NGramEngine } from '../../completion/NGramEngine.js';
import {
  incrementalLearn,
  incrementalLearnAsync,
  applyWeightDecay,
  createEmptyDecayStore,
  createDecayStoreFromModel,
} from '../../completion/Learner.js';
import type { DecayStore } from '../../completion/Learner.js';

// ============================================================================
// Learner 测试
// ============================================================================

describe('Learner', () => {
  let engine: NGramEngine;

  beforeEach(() => {
    engine = new NGramEngine();
  });

  // ==========================================================================
  // 增量学习
  // ==========================================================================

  describe('incremental learning (M5-14)', () => {
    it('should train engine from content and return timestamps', () => {
      const content = '勇者踏上了征程';

      const timestamps = incrementalLearn(engine, content);

      // Engine should have learned from content
      expect(engine.totalTokens).toBeGreaterThan(0);
      expect(engine.entryCount).toBeGreaterThan(0);

      // Should return valid DecayStore
      expect(timestamps).toBeDefined();
      // DecayStore should have entries for gram levels 1-5
      for (let n = 1; n <= 5; n++) {
        expect(timestamps[n]).toBeDefined();
      }
    });

    it('should update existing timestamps rather than replacing them', () => {
      const firstContent = '勇者踏上了征程';
      const secondContent = '勇者来到了村庄';

      const ts1 = incrementalLearn(engine, firstContent);
      const ts2 = incrementalLearn(engine, secondContent, { timestamps: ts1 });

      // Engine now has tokens from both texts
      expect(engine.totalTokens).toBeGreaterThan(0);

      // ts2 should be the same object reference as ts1 (updated in place)
      expect(ts2).toBe(ts1);
    });

    it('should use source "user" by default for incremental learning', () => {
      const content = 'test content';
      incrementalLearn(engine, content);

      // The tokens trained with 'user' source (higher weight in scoring)
      expect(engine.totalTokens).toBeGreaterThan(0);
    });

    it('should handle empty content without errors', () => {
      const ts = incrementalLearn(engine, '');

      expect(engine.totalTokens).toBe(0);
      expect(ts).toBeDefined();
      // Should return empty timestamps for all gram levels
      for (let n = 1; n <= 5; n++) {
        expect(Object.keys(ts[n]!)).toHaveLength(0);
      }
    });

    it('should handle whitespace-only content without errors', () => {
      const ts = incrementalLearn(engine, '   \n  \t  ');

      expect(engine.totalTokens).toBe(0);
      expect(ts).toBeDefined();
    });

    it('should preserve existing timestamps when content is empty', () => {
      // First learn something
      const ts1 = incrementalLearn(engine, 'hello world');

      // Then pass empty content with existing timestamps
      const ts2 = incrementalLearn(engine, '', { timestamps: ts1 });

      // Should return the same timestamps without modification
      expect(ts2).toBe(ts1);
    });

    it('should use provided timestamps option', () => {
      const existingTs = createEmptyDecayStore();
      // Pre-set a timestamp entry
      existingTs[1]![''] = { 'test': 123456789 };

      const content = 'hello world';
      const ts = incrementalLearn(engine, content, { timestamps: existingTs });

      // Should return same reference, not a new object
      expect(ts).toBe(existingTs);
    });
  });

  // ==========================================================================
  // 异步增量学习
  // ==========================================================================

  describe('incrementalLearnAsync', () => {
    it('should resolve with DecayStore after async execution', async () => {
      const content = '勇者踏上了征程';

      const timestamps = await incrementalLearnAsync(engine, content);

      expect(engine.totalTokens).toBeGreaterThan(0);
      expect(timestamps).toBeDefined();
      for (let n = 1; n <= 5; n++) {
        expect(timestamps[n]).toBeDefined();
      }
    });

    it('should not block synchronous execution', async () => {
      let resolved = false;

      const promise = incrementalLearnAsync(engine, 'test').then(() => {
        resolved = true;
      });

      // Should not be resolved synchronously
      expect(resolved).toBe(false);

      await promise;
      expect(resolved).toBe(true);
    });
  });

  // ==========================================================================
  // 权重衰减 (M5-15)
  // ==========================================================================

  describe('weight decay (M5-15)', () => {
    it('should halve frequency for entries past half-life', () => {
      // Train some data
      engine.train(['A', 'B', 'A', 'B', 'A', 'B']);

      // Create timestamps with old timestamps (older than half-life)
      const now = Date.now();
      // 100 days ago (between 90-day half-life and 180-day removal)
      const oldTime = now - 100 * 24 * 60 * 60 * 1000;
      const timestamps: DecayStore = {
        1: { '': { 'A': oldTime, 'B': oldTime } },
        2: { 'A': { 'B': oldTime } },
        3: {},
        4: {},
        5: {},
      };

      // Check frequency before decay
      const freqBeforeA = engine.getFrequency([], 'A');
      const freqBeforeB = engine.getFrequency([], 'B');

      applyWeightDecay(engine, timestamps, { halfLifeDays: 90, removalDays: 180 });

      // Frequencies should be halved (rounded, minimum 1)
      const freqAfterA = engine.getFrequency([], 'A');
      const freqAfterB = engine.getFrequency([], 'B');
      expect(freqAfterA).toBe(Math.max(1, Math.round(freqBeforeA * 0.5)));
      expect(freqAfterB).toBe(Math.max(1, Math.round(freqBeforeB * 0.5)));
    });

    it('should remove entries past removal threshold', () => {
      engine.train(['A', 'B', 'C']);

      // Create timestamps with very old entries (beyond removal period)
      const now = Date.now();
      const veryOld = now - 200 * 24 * 60 * 60 * 1000; // 200 days ago
      const timestamps: DecayStore = {
        1: { '': { 'A': veryOld, 'B': veryOld } },
        2: {},
        3: {},
        4: {},
        5: {},
      };

      applyWeightDecay(engine, timestamps, { halfLifeDays: 90, removalDays: 180 });

      // "A" and "B" should be removed, "C" has no timestamp so stays (undefined handling)
      // Actually "C" has undefined lastSeen, so it's skipped (continue)
      expect(engine.has([], 'A')).toBe(false);
      expect(engine.has([], 'B')).toBe(false);
    });

    it('should not modify entries newer than half-life', () => {
      engine.train(['A', 'B']);

      const recent = Date.now() - 1000; // 1 second ago
      const timestamps: DecayStore = {
        1: { '': { 'A': recent, 'B': recent } },
        2: {},
        3: {},
        4: {},
        5: {},
      };

      const entryCountBefore = engine.entryCount;

      applyWeightDecay(engine, timestamps, { halfLifeDays: 90, removalDays: 180 });

      // Entries should remain unchanged
      expect(engine.entryCount).toBe(entryCountBefore);
      expect(engine.getFrequency([], 'A')).toBe(1);
      expect(engine.getFrequency([], 'B')).toBe(1);
    });

    it('should clean up removed entries and empty context keys', () => {
      engine.train(['X', 'Y']);

      const veryOld = Date.now() - 200 * 24 * 60 * 60 * 1000;
      const timestamps: DecayStore = {
        1: { '': { 'X': veryOld, 'Y': veryOld } },
        2: { 'X': { 'Y': veryOld } },
        3: {},
        4: {},
        5: {},
      };

      applyWeightDecay(engine, timestamps, { halfLifeDays: 90, removalDays: 180 });

      // Both X and Y should be removed from both level 1 and 2
      expect(engine.has([], 'X')).toBe(false);
      expect(engine.has([], 'Y')).toBe(false);
      expect(engine.has(['X'], 'Y')).toBe(false);

      // Empty context keys should be cleaned up
      const model = engine.toModel();
      for (let n = 1; n <= 5; n++) {
        if (model.store[n]) {
          for (const contextKey of Object.keys(model.store[n]!)) {
            expect(Object.keys(model.store[n]![contextKey]!).length).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  // ==========================================================================
  // createDecayStoreFromModel
  // ==========================================================================

  describe('createDecayStoreFromModel', () => {
    it('should initialize timestamps for all model entries with current time', () => {
      engine.train(['A', 'B', 'C']);
      const model = engine.toModel();

      const timestamps = createDecayStoreFromModel(model);

      expect(timestamps).toBeDefined();
      for (let n = 1; n <= 5; n++) {
        expect(timestamps[n]).toBeDefined();
      }

      // Should have timestamps for each entry in the model
      const now = Date.now();
      const tolerance = 5000; // 5 seconds tolerance

      if (model.store[1]) {
        for (const [contextKey, candidates] of Object.entries(model.store[1]!)) {
          for (const word of Object.keys(candidates)) {
            const ts = timestamps[1]![contextKey]![word]!;
            expect(Math.abs(ts - now)).toBeLessThan(tolerance);
          }
        }
      }
    });
  });

  // ==========================================================================
  // createEmptyDecayStore
  // ==========================================================================

  describe('createEmptyDecayStore', () => {
    it('should create empty store with all 5 gram levels', () => {
      const store = createEmptyDecayStore();

      for (let n = 1; n <= 5; n++) {
        expect(store[n]).toBeDefined();
        expect(typeof store[n]).toBe('object');
        expect(Object.keys(store[n]!)).toHaveLength(0);
      }
    });
  });
});
