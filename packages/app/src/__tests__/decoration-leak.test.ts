/**
 * 诊断装饰器防泄漏测试 — decoration-leak.test.ts
 *
 * 验证 `applyDiagnostics()` 不会因多次调用而累积装饰 DOM 节点。
 * Monaco 0.31+ 的 `createDecorationsCollection().set()` 将旧装饰替换而非追加，
 * 本测试验证 `diagnosticsDecorator.ts` 正确使用了此 API。
 *
 * 测试场景:
 *   TC-1: 多次调用 applyDiagnostics → 装饰数量 = 当前诊断数 × 2，不随调用次数增长
 *   TC-2: 空诊断数组不产生装饰
 *   TC-3: clearDiagnostics → 装饰数量归零
 *   TC-4: clear → apply 后仍能正确产生装饰
 *
 * 注意:
 *   Monaco Editor 需要真实 DOM 环境，但 vitest 默认使用 node 环境。
 *   本测试通过完整 mock monaco-editor 模块规避此限制。
 *
 * @see packages/app/src/editor/diagnosticsDecorator.ts
 */

// @vitest-environment node

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyDiagnostics, clearDiagnostics } from '../editor/diagnosticsDecorator';
import type { Diagnostic } from '@plotflow/core';

// ============================================================================
// Hoisted: 共享 mock 状态
// vi.hoisted 的回调在 vi.mock factory 之前执行，返回值可在二者间共享
// ============================================================================

const { mockDecoCol, mockEditor } = vi.hoisted(() => {
  /** 模拟 IEditorDecorationsCollection: 追踪装饰数量 */
  const entries: object[] = [];

  const collection = {
    /** 当前装饰数量（只读 getter） */
    get length(): number {
      return entries.length;
    },
    /** 替换所有装饰（非追加）— 模拟 Monaco 0.31+ 行为 */
    set: vi.fn((decos: object[]) => {
      entries.length = 0;
      entries.push(...decos);
    }),
    /** 清除所有装饰 */
    clear: vi.fn(() => {
      entries.length = 0;
    }),
  };

  /** 模拟 IStandaloneCodeEditor（as any 绕过 IStandaloneCodeEditor 的 119+ 属性要求） */
  const editor = {
    getModel: vi.fn(() => ({ __tag: 'mock-model' })),
    createDecorationsCollection: vi.fn(() => collection),
  } as any;

  return { mockDecoCol: collection, mockEditor: editor };
});

// ============================================================================
// Mock: monaco-editor（Node 无 DOM，无法实例化真实 Monaco 编辑器）
// ============================================================================

vi.mock('monaco-editor', () => {
  class MockRange {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  }

  return {
    Range: MockRange,
    MarkerSeverity: {
      Error: 8,
      Warning: 4,
      Info: 1,
    },
    editor: {
      setModelMarkers: vi.fn(),
    },
  };
});

// ============================================================================
// Test helpers
// ============================================================================

/**
 * 构造一条模拟诊断信息。
 *
 * @param id   - 诊断唯一标识
 * @param line - 所在行号（1-based）
 * @returns 符合 Diagnostic 接口的模拟诊断
 */
function makeDiagnostic(id: string, line: number): Diagnostic {
  return {
    id,
    code: 'E001',
    severity: 'error',
    message: `Test error ${id}`,
    range: {
      startLine: line,
      startColumn: 1,
      endLine: line,
      endColumn: 10,
    },
  };
}

// ============================================================================
// Test suites
// ============================================================================

describe('diagnostics decorator — 装饰防泄漏', () => {
  beforeEach(() => {
    // 重置所有 vi.fn() 调用记录（保留实现行为）
    vi.clearAllMocks();
    // 清空装饰跟踪数组
    mockDecoCol.clear();
  });

  // --------------------------------------------------------------------------
  // TC-1: 重复调用不累积
  // --------------------------------------------------------------------------

  it('[TC-1] 多次调用 applyDiagnostics 后装饰数量始终等于当前诊断数 × 2，不随调用次数增长', () => {
    // ── 第一次调用: 2 个诊断（不同位置） ──
    const diags1: Diagnostic[] = [
      makeDiagnostic('d1', 1),
      makeDiagnostic('d2', 5),
    ];
    applyDiagnostics(mockEditor, diags1);
    expect(mockDecoCol.length).toBe(diags1.length * 2);

    // ── 第二次调用: 1 个诊断 ──
    const diags2: Diagnostic[] = [
      makeDiagnostic('d3', 8),
    ];
    applyDiagnostics(mockEditor, diags2);
    expect(mockDecoCol.length).toBe(diags2.length * 2);

    // ── 第三次调用: 3 个诊断 ──
    const diags3: Diagnostic[] = [
      makeDiagnostic('d4', 2),
      makeDiagnostic('d5', 4),
      makeDiagnostic('d6', 7),
    ];
    applyDiagnostics(mockEditor, diags3);
    expect(mockDecoCol.length).toBe(diags3.length * 2);

    // 若发生泄漏，装饰数将为 (2+1+3) × 2 = 12，而非 3 × 2 = 6
  });

  // --------------------------------------------------------------------------
  // TC-2: 空诊断输入
  // --------------------------------------------------------------------------

  it('[TC-2] 空诊断数组不产生任何装饰', () => {
    applyDiagnostics(mockEditor, []);
    expect(mockDecoCol.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TC-3: clearDiagnostics 归零
  // --------------------------------------------------------------------------

  it('[TC-3] clearDiagnostics 后装饰数量归零', () => {
    // Arrange: 先注入一些诊断
    applyDiagnostics(mockEditor, [
      makeDiagnostic('d1', 1),
      makeDiagnostic('d2', 3),
    ]);
    expect(mockDecoCol.length).toBeGreaterThan(0);

    // Act: 清除诊断
    clearDiagnostics(mockEditor);

    // Assert: 装饰完全清除
    expect(mockDecoCol.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TC-4: 清除后重新注入仍正常
  // --------------------------------------------------------------------------

  it('[TC-4] clear → apply 循环后仍能正确产生装饰', () => {
    // 第一次注入 → 清除
    applyDiagnostics(mockEditor, [makeDiagnostic('d1', 1)]);
    clearDiagnostics(mockEditor);
    expect(mockDecoCol.length).toBe(0);

    // 第二次注入 → 清除
    applyDiagnostics(mockEditor, [makeDiagnostic('d2', 5), makeDiagnostic('d3', 9)]);
    expect(mockDecoCol.length).toBe(2 * 2); // 2 个诊断 × 2
    clearDiagnostics(mockEditor);
    expect(mockDecoCol.length).toBe(0);

    // 第三次注入: 验证复用不影响正确性
    applyDiagnostics(mockEditor, [makeDiagnostic('d4', 3)]);
    expect(mockDecoCol.length).toBe(1 * 2); // 1 个诊断 × 2
  });
});
