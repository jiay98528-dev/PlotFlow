/**
 * 增量学习器 (M5-14)
 *
 * 负责后台增量训练 NGramEngine，管理 N-gram 权重衰减 (M5-15)。
 * 学习逻辑为纯函数，可运行在 Web Worker 中，不阻塞 UI。
 *
 * ## 功能
 * - `incrementalLearn()`: 将用户编辑内容训练进 N-gram 引擎，同时更新衰减时间戳
 * - `applyWeightDecay()`: 启动时检查并应用权重衰减（90 天半衰 / 180 天移除）
 * - `incrementalLearnAsync()`: 异步变体，通过 setTimeout(0) 延迟执行
 *
 * ## 权重衰减策略 (M5-15)
 * - 90 天未使用的 N-gram → frequency × 0.5
 * - 180 天未使用 → 移除条目
 * - 每次应用启动时由调用方触发检查
 *
 * ## 配合 Persistence
 * ```
 * 启动时: Persistence.load() → applyWeightDecay() → 引擎初始化完成
 * 保存时: incrementalLearn() → Persistence.save() → 数据落盘
 * ```
 *
 * @packageDocumentation
 * @version 0.1.0
 */

import { NGramEngine } from './NGramEngine.js';

// ============================================================================
// 常量
// ============================================================================

/** 默认衰减半衰期（天） */
const DEFAULT_DECAY_HALF_LIFE = 90;

/** 默认移除期限（天） */
const DEFAULT_DECAY_REMOVAL = 180;

/** 最大 N-gram 级别（与 NGramEngine 同步） */
const MAX_GRAM = 5;

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 衰减跟踪存储。
 *
 * 结构与 NGramEngine 的 store 一致，但 value 是最后访问时间戳 (epoch ms) 而非频次。
 * 用于判断 N-gram 条目是否长时间未使用，从而触发权重衰减。
 *
 * @example
 * ```typescript
 * const ts: DecayStore = {
 *   1: { "": { "勇": 1723456789000, "者": 1723456789000 } },
 *   2: { "勇者": { "踏上": 1723456789000 } },
 * };
 * ```
 */
export interface DecayStore {
  /** gramLevel → contextKey → completionWord → lastSeenAt (epoch ms) */
  [gramLevel: number]: {
    [contextKey: string]: {
      [completionWord: string]: number;
    };
  };
}

/** 权重衰减选项 */
export interface WeightDecayOptions {
  /** 半衰期天数（默认 90） */
  halfLifeDays?: number;
  /** 移除天数（默认 180） */
  removalDays?: number;
}

/** 增量学习选项 */
export interface IncrementalLearnOptions {
  /** 语料来源标签（默认 'user'） */
  source?: 'user';
  /** 已有的 DecayStore（用于增量更新时间戳） */
  timestamps?: DecayStore;
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建空的 DecayStore。
 *
 * 所有 gram 级别初始化为空对象。
 *
 * @returns 空的 DecayStore
 */
export function createEmptyDecayStore(): DecayStore {
  const store: DecayStore = {};
  for (let n = 1; n <= MAX_GRAM; n++) {
    store[n] = {};
  }
  return store;
}

/**
 * 从 NGramModel 创建初始 DecayStore。
 *
 * 遍历模型中的所有条目，将其最后访问时间标记为"当前时间"。
 * 适用于导入预训练模型或从旧版本升级时需要初始化时间戳的场景。
 *
 * @param model - NGramModel 快照
 * @returns 每个条目都填充了当前时间戳的 DecayStore
 */
export function createDecayStoreFromModel(
  model: import('./types.js').NGramModel,
): DecayStore {
  const store = createEmptyDecayStore();
  const now = Date.now();

  for (const [nStr, levelData] of Object.entries(model.store)) {
    const n = Number(nStr);
    if (!store[n]) store[n] = {};

    for (const [contextKey, candidates] of Object.entries(levelData)) {
      const tsContext: Record<string, number> = {};
      for (const word of Object.keys(candidates)) {
        tsContext[word] = now;
      }
      store[n]![contextKey] = tsContext;
    }
  }

  return store;
}

// ============================================================================
// 增量学习 (M5-14)
// ============================================================================

/**
 * 增量学习 — 将文本内容训练到 N-gram 引擎中。
 *
 * **同步执行**，可在 Web Worker 中直接调用（不依赖 DOM 或 Node.js API）。
 * 每次调用完成以下操作：
 * 1. 分词预处理
 * 2. 更新引擎 N-gram 频次（来源标签 'user'，权重 1.5×）
 * 3. 更新 DecayStore 时间戳（用于后续权重衰减判断）
 *
 * @param engine - NGramEngine 实例（会被原地修改）
 * @param content - 用户编辑的 .mdstory 原始文本内容
 * @param options - 可选参数（source 来源标签 / timestamps 已有的时间戳存储）
 * @returns 更新后的 DecayStore（包含新增或刷新的时间戳）
 *
 * @example
 * ```typescript
 * const engine = new NGramEngine();
 * let timestamps = createEmptyDecayStore();
 *
 * // 编辑器保存时调用
 * timestamps = incrementalLearn(engine, editorContent, { timestamps });
 * ```
 */
export function incrementalLearn(
  engine: NGramEngine,
  content: string,
  options?: IncrementalLearnOptions,
): DecayStore {
  // 空内容或纯空白 → 无操作
  if (!content || content.trim().length === 0) {
    return options?.timestamps ?? createEmptyDecayStore();
  }

  // 分词
  const tokens = engine.tokenize(content);
  if (tokens.length === 0) {
    return options?.timestamps ?? createEmptyDecayStore();
  }

  // 1. 训练引擎（使用 'user' 来源，权重 1.5×）
  engine.train(tokens, options?.source ?? 'user');

  // 2. 更新或创建 DecayStore
  const timestamps = options?.timestamps ?? createEmptyDecayStore();
  updateTimestamps(timestamps, tokens);

  return timestamps;
}

/**
 * 异步增量学习 — 将任务推迟到下一个事件循环周期执行。
 *
 * 适用于**不支持 Web Worker** 的环境（如某些测试或受限运行时）。
 * 在 Electron 渲染进程中，建议优先使用 Web Worker 以避免 UI 卡顿。
 *
 * @param engine - NGramEngine 实例
 * @param content - 用户编辑内容
 * @param options - 可选参数
 * @returns Promise<DecayStore>
 */
export function incrementalLearnAsync(
  engine: NGramEngine,
  content: string,
  options?: IncrementalLearnOptions,
): Promise<DecayStore> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(incrementalLearn(engine, content, options));
    }, 0);
  });
}

// ============================================================================
// 权重衰减 (M5-15)
// ============================================================================

/**
 * 对 NGramEngine 应用权重衰减。
 *
 * 遍历 DecayStore 中的时间戳，对比当前时间：
 *
 * | 条件                     | 操作                                  |
 * |--------------------------|---------------------------------------|
 * | 90 天 ≤ 未使用 < 180 天 | frequency × 0.5，刷新时间戳至当前时间  |
 * | 未使用 ≥ 180 天          | 从引擎和 DecayStore 中完全移除         |
 *
 * **调用时机**：应用启动时，加载持久化数据后立即执行。
 *
 * @param engine - NGramEngine 实例（被原地修改）
 * @param timestamps - DecayStore（被原地修改）
 * @param options - 衰减参数
 *
 * @example
 * ```typescript
 * const result = await persistence.load();
 * if (result) {
 *   applyWeightDecay(result.engine, result.timestamps);
 *   // result.engine 和 result.timestamps 已应用衰减
 * }
 * ```
 */
export function applyWeightDecay(
  engine: NGramEngine,
  timestamps: DecayStore,
  options?: WeightDecayOptions,
): void {
  const halfLifeMs =
    (options?.halfLifeDays ?? DEFAULT_DECAY_HALF_LIFE) *
    24 * 60 * 60 * 1000;
  const removalMs =
    (options?.removalDays ?? DEFAULT_DECAY_REMOVAL) *
    24 * 60 * 60 * 1000;
  const now = Date.now();

  // 导出引擎模型，在纯数据层面操作
  const model = engine.toModel();
  let modified = false;

  for (let n = 1; n <= MAX_GRAM; n++) {
    const levelData = model.store[n];
    const tsLevel = timestamps[n];
    if (!levelData || !tsLevel) continue;

    for (const [contextKey, candidates] of Object.entries(levelData)) {
      const tsContext = tsLevel[contextKey];
      if (!tsContext) continue;

      const wordsToRemoveFromEngine: string[] = [];
      const wordsToRemoveFromTs: string[] = [];

      for (const word of Object.keys(candidates)) {
        const lastSeen = tsContext[word];
        if (lastSeen === undefined) continue;

        const age = now - lastSeen;

        if (age >= removalMs) {
          // 180+ 天未使用 → 完全移除
          wordsToRemoveFromEngine.push(word);
          wordsToRemoveFromTs.push(word);
          modified = true;
        } else if (age >= halfLifeMs) {
          // 90+ 天未使用 → 权重减半（至少保留 1）
          const currentFreq = candidates[word]!;
          const newFreq = Math.max(1, Math.round(currentFreq * 0.5));
          candidates[word] = newFreq;
          // 刷新时间戳，防止下次启动时再次减半
          tsContext[word] = now;
          modified = true;
        }
      }

      // 执行移除
      for (const word of wordsToRemoveFromEngine) {
        delete candidates[word];
      }
      for (const word of wordsToRemoveFromTs) {
        delete tsContext[word];
      }

      // 清理空 contextKey
      if (Object.keys(candidates).length === 0) {
        delete levelData[contextKey];
        delete tsLevel[contextKey];
      }
    }

    // 清理空 gram 级别
    if (Object.keys(levelData).length === 0) {
      delete model.store[n];
    }
    if (Object.keys(tsLevel).length === 0) {
      delete timestamps[n];
    }
  }

  if (modified) {
    // 将修改后的模型写回引擎
    // 创建新引擎 → 复制内部状态到旧引擎引用（同包内使用类型断言访问私有属性）
    const newEngine = NGramEngine.fromModel(model);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).ngramStore = (newEngine as any).ngramStore;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any)._totalTokens = (newEngine as any)._totalTokens;
  }
}

// ============================================================================
// 内部工具
// ============================================================================

/**
 * 根据 token 序列更新 DecayStore 的时间戳。
 *
 * N-gram 提取逻辑与 NGramEngine.train() 严格同步：
 * 1. 滑动窗口提取所有 1~5 gram 组合
 * 2. 前 N-1 个 token 组成 contextKey（空格连接）
 * 3. 第 N 个 token 为 completionWord
 * 4. 将 completionWord 的时间戳设为当前时间
 *
 * @param timestamps - 待更新的 DecayStore
 * @param tokens - 分词后的 token 序列
 */
function updateTimestamps(timestamps: DecayStore, tokens: string[]): void {
  const now = Date.now();

  for (let n = 1; n <= MAX_GRAM; n++) {
    const tsLevel = timestamps[n]!;

    for (let i = 0; i <= tokens.length - n; i++) {
      const contextTokens = tokens.slice(i, i + n - 1);
      const completionWord = tokens[i + n - 1]!;
      const contextKey = contextTokens.join(' ');

      if (!tsLevel[contextKey]) {
        tsLevel[contextKey] = {};
      }
      tsLevel[contextKey]![completionWord] = now;
    }
  }
}
