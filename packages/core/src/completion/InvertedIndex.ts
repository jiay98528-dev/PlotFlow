/**
 * 倒排索引 (M5-03) — 前缀快速检索
 *
 * @packageDocumentation
 * @remarks
 * 基于 Trie 的倒排索引，支持 O(k) 前缀查询（k = 前缀长度）。
 *
 * ## 用途
 * - 变量名补全：用户输入 "$has_" → 匹配 "has_key", "has_sword" 等
 * - 候选词前缀过滤：配合 NGramEngine 使用，按前缀缩小候选范围
 * - 自动补全下拉列表：Ctrl+Space 触发时展示所有匹配项
 *
 * ## 设计
 * - Trie 节点存储到达该路径的候选列表
 * - `insert(word, metadata)`: 将候选词按字符路径插入
 * - `search(prefix)`: 沿前缀路径走到对应节点，返回该节点的所有候选
 * - `searchAll(prefix)`: 返回前缀子树中所有候选（不仅仅是当前节点）
 *
 * @version 0.1.0
 */

// ============================================================================
// Trie 节点
// ============================================================================

/**
 * Trie 节点。
 */
class TrieNode {
  /** 子节点映射：字符 → 下一个节点 */
  children: Map<string, TrieNode> = new Map();
  /** 经过此路径的所有候选词集合（按频次降序维护） */
  candidates: IndexEntry[] = [];
}

/**
 * 索引条目。
 */
interface IndexEntry {
  /** 候选词 */
  word: string;
  /** 频次（用于排序） */
  frequency: number;
}

// ============================================================================
// InvertedIndex 类
// ============================================================================

/**
 * 前缀倒排索引。
 *
 * 在 O(k) 时间内完成前缀检索（k 为前缀字符数），
 * 适用于实时补全场景。
 *
 * @example
 * ```typescript
 * const idx = new InvertedIndex();
 * idx.insert('has_key', 5);
 * idx.insert('has_sword', 3);
 * idx.insert('health', 10);
 *
 * idx.search('has_');
 * // → ['has_key', 'has_sword']
 *
 * idx.search('h');
 * // → ['has_key', 'has_sword', 'health']
 * ```
 */
export class InvertedIndex {
  /** Trie 根节点 */
  private root: TrieNode;

  /** 索引中的总条目数 */
  private _size: number;

  constructor() {
    this.root = new TrieNode();
    this._size = 0;
  }

  // ==========================================================================
  // 公共属性
  // ==========================================================================

  /** 索引中的总候选词数 */
  get size(): number {
    return this._size;
  }

  // ==========================================================================
  // 插入
  // ==========================================================================

  /**
   * 将一个候选词插入索引。
   *
   * 会沿字符路径创建节点，并在每个经过的节点追加该候选的索引条目。
   *
   * @param word - 候选词
   * @param frequency - 出现频次（用于排序）
   */
  insert(word: string, frequency: number = 1): void {
    if (word.length === 0) return;

    let node = this.root;

    for (const char of word) {
      let child = node.children.get(char);
      if (!child) {
        child = new TrieNode();
        node.children.set(char, child);
      }
      node = child;

      // 在每个经过的节点追加条目（保持频次降序）
      this.insertSorted(node.candidates, { word, frequency });
    }

    this._size++;
  }

  /**
   * 批量插入候选词。
   *
   * @param entries - 候选词和频次数组
   */
  insertBatch(entries: Array<[string, number]>): void {
    for (const [word, freq] of entries) {
      this.insert(word, freq);
    }
  }

  // ==========================================================================
  // 查询
  // ==========================================================================

  /**
   * 按前缀检索候选词列表。
   *
   * 返回**精确匹配前缀节点**的候选列表（经过此路径的候选），
   * 按频次降序排列。
   *
   * 复杂度：O(k + m)，k = 前缀长度，m = 返回结果数。
   *
   * @param prefix - 前缀文本
   * @param limit - 最大返回数量（默认 10）
   * @returns 匹配的候选词列表（按频次降序）
   */
  search(prefix: string, limit: number = 10): string[] {
    if (prefix.length === 0) return [];

    const node = this.walk(prefix);
    if (!node) return [];

    const seen = new Set<string>();
    const results: string[] = [];

    for (const entry of node.candidates) {
      if (!seen.has(entry.word)) {
        seen.add(entry.word);
        results.push(entry.word);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * 按前缀检索所有子树中的候选词。
   *
   * 与 `search` 不同，此方法不仅返回前缀节点自身的候选，
   * 还递归收集所有子树中的候选词（即所有以 prefix 开头的词）。
   *
   * 复杂度：O(k + w)，k = 前缀长度，w = 子树中的总候选数。
   *
   * @param prefix - 前缀文本
   * @param limit - 最大返回数量（默认 20）
   * @returns 匹配的候选词列表（去重，按频次降序）
   */
  searchAll(prefix: string, limit: number = 20): string[] {
    if (prefix.length === 0) return [];

    const node = this.walk(prefix);
    if (!node) return [];

    const collected = new Map<string, number>();

    // BFS 收集子树中所有候选
    this.collectSubtree(node, collected);

    // 按频次降序排列
    const sorted = Array.from(collected.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);

    return sorted.slice(0, limit);
  }

  /**
   * 检查索引中是否存在以给定前缀开头的候选。
   *
   * @param prefix - 前缀文本
   * @returns 是否存在匹配
   */
  has(prefix: string): boolean {
    if (prefix.length === 0) return false;
    const node = this.walk(prefix);
    return node !== null && node.candidates.length > 0;
  }

  // ==========================================================================
  // 删除
  // ==========================================================================

  /**
   * 从索引中移除一个候选词。
   *
   * @param word - 要移除的候选词
   * @returns 是否成功移除
   */
  remove(word: string): boolean {
    if (word.length === 0) return false;

    let node = this.root;
    const pathNodes: TrieNode[] = [node];

    for (const char of word) {
      const child = node.children.get(char);
      if (!child) return false;
      node = child;
      pathNodes.push(node);
    }

    // 从所有路径节点的候选列表中移除
    let removed = false;
    for (const pathNode of pathNodes) {
      const idx = pathNode.candidates.findIndex((e) => e.word === word);
      if (idx !== -1) {
        pathNode.candidates.splice(idx, 1);
        removed = true;
      }
    }

    if (removed) {
      this._size--;
    }

    return removed;
  }

  /**
   * 清空全部索引数据。
   */
  clear(): void {
    this.root = new TrieNode();
    this._size = 0;
  }

  // ==========================================================================
  // 私有方法
  // ==========================================================================

  /**
   * 沿前缀路径走到对应节点。
   *
   * @param prefix - 前缀文本
   * @returns 对应节点，不存在则返回 null
   */
  private walk(prefix: string): TrieNode | null {
    let node = this.root;

    for (const char of prefix) {
      const child = node.children.get(char);
      if (!child) return null;
      node = child;
    }

    return node;
  }

  /**
   * 在有序数组中按频次降序插入条目。
   */
  private insertSorted(arr: IndexEntry[], entry: IndexEntry): void {
    // 如果已存在该词，更新频次并重排
    const existingIdx = arr.findIndex((e) => e.word === entry.word);
    if (existingIdx !== -1) {
      arr.splice(existingIdx, 1);
    }

    // 二分插入保持降序
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid]!.frequency > entry.frequency) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    arr.splice(lo, 0, entry);
  }

  /**
   * BFS 收集子树中所有候选。
   */
  private collectSubtree(root: TrieNode, collected: Map<string, number>): void {
    const queue: TrieNode[] = [root];

    while (queue.length > 0) {
      const node = queue.shift()!;

      for (const entry of node.candidates) {
        const existing = collected.get(entry.word);
        if (existing === undefined || entry.frequency > existing) {
          collected.set(entry.word, entry.frequency);
        }
      }

      for (const child of node.children.values()) {
        queue.push(child);
      }
    }
  }
}
