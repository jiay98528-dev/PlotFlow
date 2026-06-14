/**
 * PlotFlow 补全引擎 — 统一导出入口
 *
 * @packageDocumentation
 * @remarks
 * 本模块包含：
 * - NGramEngine: N-gram 统计模型引擎（M5-01）
 * - InvertedIndex: 前缀倒排索引（M5-03）
 * - CorpusLoader: 语料加载器（M5-02）
 * - CorpusImporter: 用户语料导入器（M5-17~18）
 * - PreprocessingPipeline: 导入预处理管道（M5-17~18）
 * - Learner: 增量学习器（M5-14）+ 权重衰减（M5-15）
 * - Persistence: 学习数据持久化（M5-16）
 * - 相关类型定义
 *
 * @version 0.1.0
 */

export { NGramEngine } from './NGramEngine.js';
export { InvertedIndex } from './InvertedIndex.js';
export { CorpusLoader } from './CorpusLoader.js';
export { CorpusImporter } from './CorpusImporter.js';
export { PreprocessingPipeline } from './PreprocessingPipeline.js';
export {
  incrementalLearn,
  incrementalLearnAsync,
  applyWeightDecay,
  createEmptyDecayStore,
  createDecayStoreFromModel,
} from './Learner.js';
export { Persistence } from './Persistence.js';

export type {
  CorpusSource,
  CorpusEntry,
  CorpusData,
  Candidate,
  CompletionResult,
  CompletionContext,
  CompletionDimension,
  NGramModel,
  NGramStore,
} from './types.js';

export type {
  CorpusLoadStats,
} from './CorpusLoader.js';

export type {
  ImportFileInfo,
  ImportResult,
  ImporterStats,
} from './CorpusImporter.js';

export type {
  ClassificationResult,
} from './PreprocessingPipeline.js';

export type {
  DecayStore,
  WeightDecayOptions,
  IncrementalLearnOptions,
} from './Learner.js';

export type {
  LearnerPersistedData,
  PersistenceOptions,
  LoadResult,
  FileReader,
  FileWriter,
} from './Persistence.js';
