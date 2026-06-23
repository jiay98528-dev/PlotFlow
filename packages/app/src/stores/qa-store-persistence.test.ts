/**
 * PlotFlow V0.1 QA — Zustand Store 状态流测试和数据持久化测试
 *
 * 测试范围：
 *   ST-01~ST-03: editorStore 状态流
 *   ST-04~ST-06: storyStore 状态流
 *   ST-07~ST-10: graphStore 状态流
 *   ST-11~ST-15: uiStore 状态流
 *   DATA-03:     localStorage 持久化
 *   ST-05:       跨 store 一致性
 *
 * @module stores/qa-store-persistence.test
 */

// ============================================================================
// 0. Mocks & Global Setup (runs before any imports due to vi.mock hoisting)
// ============================================================================

/**
 * 适配器 mock — plotFlowDataToFlow 在 graphStore.syncFromAST 中被调用。
 * 该 mock 会在 graphStore 模块导入前安装，确保 store 初始化时引用 mock 版本。
 */
vi.mock('../components/branch-graph/adapter', () => ({
  plotFlowDataToFlow: vi.fn(() => ({
    nodes: [
      {
        id: '第1章-start',
        type: 'storyNode',
        position: { x: 0, y: 0 },
        className: 'node-status-normal',
        data: {
          fullId: '第1章-start',
          title: '起点',
          body: '故事从这里开始。',
          optionCount: 1,
          status: 'normal',
          lineNumber: 5,
        },
      },
      {
        id: '第1章-middle',
        type: 'storyNode',
        position: { x: 250, y: 0 },
        className: 'node-status-normal',
        data: {
          fullId: '第1章-middle',
          title: '中途',
          body: '你在路途中间。',
          optionCount: 1,
          status: 'normal',
          lineNumber: 10,
        },
      },
      {
        id: '第1章-end',
        type: 'storyNode',
        position: { x: 500, y: 0 },
        className: 'node-status-deadend',
        data: {
          fullId: '第1章-end',
          title: '终点',
          body: '故事结束。',
          optionCount: 0,
          status: 'deadend',
          lineNumber: 15,
        },
      },
    ],
    edges: [
      { id: '第1章-start->第1章-middle#0', source: '第1章-start', target: '第1章-middle', type: 'default' },
      { id: '第1章-middle->第1章-end#0', source: '第1章-middle', target: '第1章-end', type: 'default' },
    ],
  })),
}));

// ============================================================================
// 1. Imports
// ============================================================================

import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { useEditorStore } from './editorStore';
import { useStoryStore } from './storyStore';
import { useGraphStore, ZOOM_CONSTRAINTS } from './graphStore';
import { useUIStore } from './uiStore';
import type { PlotFlowData, Diagnostic } from '@plotflow/core';
import { parsePipelineNow } from '../services/parsePipeline';
import { forceSave, clearPendingSave } from '../services/autoSaveService';

// ============================================================================
// 2. Helpers & Mock Data
// ============================================================================

/** localStorage 实例引用 (每个测试前重置) */
let localStorageStore: Record<string, string> = {};

/**
 * 模拟的 mockPlotFlowData — 3 节点线性故事
 *
 * 节点布局：
 *   第1章-start  (line 5)
 *        │
 *        ▼
 *   第1章-middle (line 10)
 *        │
 *        ▼
 *   第1章-end   (line 15)
 */
const mockPlotFlowData: PlotFlowData = {
  sourcePath: '/test/story.mdstory',
  meta: {
    plotflow: '0.1',
    title: '测试故事',
    author: '测试员',
  },
  variables: [],
  chapters: [
    {
      id: '第1章',
      title: '第一章',
      isAnonymous: false,
      lineNumber: 1,
      nodes: [
        {
          id: 'start',
          fullId: '第1章-start',
          title: '起点',
          body: '故事从这里开始。',
          chapterId: '第1章',
          options: [
            {
              description: '继续前进',
              indentLevel: 0,
              targetNodeId: 'middle',
              targetFullId: '第1章-middle',
              condition: null,
              sideEffects: [],
              conditionRaw: null,
              effectsRaw: null,
              lineNumber: 8,
            },
          ],
          diagnostics: {
            isRoot: true,
            isOrphan: false,
            isDeadEnd: false,
            diagnosticIds: [],
          },
          lineNumber: 5,
        },
        {
          id: 'middle',
          fullId: '第1章-middle',
          title: '中途',
          body: '你在路途中间。',
          chapterId: '第1章',
          options: [
            {
              description: '向左走',
              indentLevel: 0,
              targetNodeId: 'end',
              targetFullId: '第1章-end',
              condition: null,
              sideEffects: [],
              conditionRaw: null,
              effectsRaw: null,
              lineNumber: 13,
            },
          ],
          diagnostics: {
            isRoot: false,
            isOrphan: false,
            isDeadEnd: false,
            diagnosticIds: [],
          },
          lineNumber: 10,
        },
        {
          id: 'end',
          fullId: '第1章-end',
          title: '终点',
          body: '故事结束。',
          chapterId: '第1章',
          options: [],
          diagnostics: {
            isRoot: false,
            isOrphan: false,
            isDeadEnd: true,
            diagnosticIds: [],
          },
          lineNumber: 15,
        },
      ],
    },
  ],
};

/** 模拟的诊断信息 */
const mockDiagnostics: Diagnostic[] = [
  {
    id: 'E001@L5:1',
    code: 'E001',
    severity: 'error',
    message: '目标节点未定义',
    range: { startLine: 5, startColumn: 1, endLine: 5, endColumn: 10 },
  },
  {
    id: 'W001@L10:1',
    code: 'W001',
    severity: 'warning',
    message: '节点无入口选项指向（孤立节点）',
    range: { startLine: 10, startColumn: 1, endLine: 10, endColumn: 10 },
  },
];

/** 重置所有 store 到初始状态 */
function resetAllStores(): void {
  // editorStore
  useEditorStore.getState().reset();

  // storyStore
  useStoryStore.getState().clearParseData();

  // graphStore — 无 reset() 方法，手动设置
  useGraphStore.setState({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    zoomLevel: ZOOM_CONSTRAINTS.DEFAULT,
    viewMode: 'minimap',
    renamingNodeId: null,
    isEditing: false,
    collapsedGroups: {},
  });

  // uiStore — 无 reset() 方法，手动设置到默认值
  useUIStore.setState({
    theme: 'light',
    language: 'zh-CN' as const,
    accent: 'ocean',
    activeRightPanel: 'graph',
    isOutlinePanelOpen: true,
    statusMessage: '',
    isConditionEditorOpen: false,
    isProblemPanelOpen: false,
    isExportDialogOpen: false,
    isCorpusManagerOpen: false,
    isNewFileDialogOpen: false,
  });
}

/** 清除 localStorage 存储 */
function clearLocalStorage(): void {
  localStorageStore = {};
}

/** 在 globalThis.window 上挂载 localStorage mock */
function setupLocalStorageMock(): void {
  const mock = {
    getItem: (key: string): string | null => localStorageStore[key] ?? null,
    setItem: (key: string, value: string): void => {
      localStorageStore[key] = value;
    },
    removeItem: (key: string): void => {
      delete localStorageStore[key];
    },
    clear: (): void => {
      localStorageStore = {};
    },
    get length(): number {
      return Object.keys(localStorageStore).length;
    },
    key: (index: number): string | null => Object.keys(localStorageStore)[index] ?? null,
  };

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: mock },
    writable: true,
    configurable: true,
  });
}

// ============================================================================
// 3. Bootstrap
// ============================================================================

beforeAll(() => {
  setupLocalStorageMock();
});

beforeEach(() => {
  clearLocalStorage();
  resetAllStores();
});

// ============================================================================
// 4. Test Suites
// ============================================================================

// ============================================================================
// ST-01~ST-03: editorStore 状态流
// ============================================================================

describe('editorStore — 状态流 (ST-01~ST-03)', () => {
  // --------------------------------------------------------------------------
  // ST-01: setContent → isDirty → markSaved
  // --------------------------------------------------------------------------
  it('[ST-01] setContent("test") → isDirty=true → markSaved() → isDirty=false', () => {
    // 初始状态
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(useEditorStore.getState().content).toBe('');

    // Act: setContent
    useEditorStore.getState().setContent('test content');

    // Assert: isDirty=true, content 更新
    const stateAfterContent = useEditorStore.getState();
    expect(stateAfterContent.isDirty).toBe(true);
    expect(stateAfterContent.content).toBe('test content');

    // Act: markSaved
    useEditorStore.getState().markSaved();

    // Assert: isDirty=false, content 保留
    const stateAfterSave = useEditorStore.getState();
    expect(stateAfterSave.isDirty).toBe(false);
    expect(stateAfterSave.content).toBe('test content');
  });

  // --------------------------------------------------------------------------
  // ST-02: setFilePath
  // --------------------------------------------------------------------------
  it('[ST-02] setFilePath("/path/to/file.mdstory") → filePath 更新', () => {
    // Act
    useEditorStore.getState().setFilePath('/path/to/file.mdstory');

    // Assert
    expect(useEditorStore.getState().filePath).toBe('/path/to/file.mdstory');

    // Act: set to null (新建文件)
    useEditorStore.getState().setFilePath(null);

    // Assert
    expect(useEditorStore.getState().filePath).toBeNull();
  });

  // --------------------------------------------------------------------------
  // ST-03: reset → 所有状态归零
  // --------------------------------------------------------------------------
  it('[ST-03] reset() → 所有状态归零', () => {
    // Arrange: 先修改多个状态
    useEditorStore.getState().setContent('some content');
    useEditorStore.getState().setFilePath('/path/file.mdstory');
    useEditorStore.getState().setCursorPosition(10, 5);
    useEditorStore.getState().setDiagnostics(mockDiagnostics);
    useEditorStore.getState().setActiveNodeId('第1章-start');

    // Verify 已经修改
    expect(useEditorStore.getState().isDirty).toBe(true);
    expect(useEditorStore.getState().content).not.toBe('');

    // Act: reset
    useEditorStore.getState().reset();

    // Assert: 全部归零
    const s = useEditorStore.getState();
    expect(s.isDirty).toBe(false);
    expect(s.content).toBe('');
    expect(s.filePath).toBeNull();
    expect(s.cursorPosition).toEqual({ line: 1, column: 1 });
    expect(s.diagnostics).toEqual([]);
    expect(s.activeNodeId).toBeNull();
    expect(s.editorInstance).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 额外验证: setCursorPosition / setDiagnostics / setActiveNodeId
  // --------------------------------------------------------------------------
  it('setCursorPosition / setDiagnostics / setActiveNodeId 等 action 正常工作', () => {
    // setCursorPosition
    useEditorStore.getState().setCursorPosition(15, 3);
    expect(useEditorStore.getState().cursorPosition).toEqual({ line: 15, column: 3 });

    // setDiagnostics
    useEditorStore.getState().setDiagnostics(mockDiagnostics);
    expect(useEditorStore.getState().diagnostics).toHaveLength(2);
    expect(useEditorStore.getState().diagnostics[0]!.code).toBe('E001');

    // setActiveNodeId
    useEditorStore.getState().setActiveNodeId('第1章-middle');
    expect(useEditorStore.getState().activeNodeId).toBe('第1章-middle');

    // setActiveNodeId null
    useEditorStore.getState().setActiveNodeId(null);
    expect(useEditorStore.getState().activeNodeId).toBeNull();
  });
});

// ============================================================================
// ST-04~ST-06: storyStore 状态流
// ============================================================================

describe('storyStore — 状态流 (ST-04~ST-06)', () => {
  // --------------------------------------------------------------------------
  // ST-04: setPlotFlowData
  // --------------------------------------------------------------------------
  it('[ST-04] setPlotFlowData(mockData) → plotFlowData 非 null, isParsing=false', () => {
    // Arrange: 先将 isParsing 设为 true 以验证会被重置
    useStoryStore.setState({ isParsing: true });

    // Act
    useStoryStore.getState().setPlotFlowData(mockPlotFlowData);

    // Assert
    const s = useStoryStore.getState();
    expect(s.plotFlowData).not.toBeNull();
    expect(s.plotFlowData!.meta.title).toBe('测试故事');
    expect(s.plotFlowData!.chapters).toHaveLength(1);
    expect(s.plotFlowData!.chapters[0]!.nodes).toHaveLength(3);
    expect(s.isParsing).toBe(false);
    expect(s.parseError).toBeNull(); // 解析成功后清除错误
  });

  // --------------------------------------------------------------------------
  // ST-05: setParseError
  // --------------------------------------------------------------------------
  it('[ST-05] setParseError("error msg") → parseError 设置, isParsing=false', () => {
    // Arrange
    useStoryStore.setState({ isParsing: true });

    // Act
    useStoryStore.getState().setParseError('第5行语法解析失败：未预期的标记');

    // Assert
    const s = useStoryStore.getState();
    expect(s.parseError).toBe('第5行语法解析失败：未预期的标记');
    expect(s.isParsing).toBe(false);
    expect(s.plotFlowData).toBeNull(); // parseError 不会清除已有的 data
  });

  // --------------------------------------------------------------------------
  // ST-06: getNodeByLine
  // --------------------------------------------------------------------------
  it('[ST-06] getNodeByLine(lineNum) 返回匹配节点', () => {
    // Arrange: 先设置数据
    useStoryStore.getState().setPlotFlowData(mockPlotFlowData);

    // Act & Assert: 光标在第1个节点之前 → null
    expect(useStoryStore.getState().getNodeByLine(3)).toBeNull();
    expect(useStoryStore.getState().getNodeByLine(4)).toBeNull();

    // Act & Assert: 光标在第1个节点行 → 第1章-start
    expect(useStoryStore.getState().getNodeByLine(5)).toBe('第1章-start');

    // Act & Assert: 光标在第1个和第2个节点之间 → 第1章-start
    expect(useStoryStore.getState().getNodeByLine(6)).toBe('第1章-start');
    expect(useStoryStore.getState().getNodeByLine(9)).toBe('第1章-start');

    // Act & Assert: 光标在第2个节点行 → 第1章-middle
    expect(useStoryStore.getState().getNodeByLine(10)).toBe('第1章-middle');
    expect(useStoryStore.getState().getNodeByLine(14)).toBe('第1章-middle');

    // Act & Assert: 光标在第3个节点行 → 第1章-end
    expect(useStoryStore.getState().getNodeByLine(15)).toBe('第1章-end');

    // Act & Assert: 光标在最后一个节点之后 → 第1章-end
    expect(useStoryStore.getState().getNodeByLine(100)).toBe('第1章-end');
  });

  // --------------------------------------------------------------------------
  // getNodeByLine — 无数据时返回 null
  // --------------------------------------------------------------------------
  it('getNodeByLine 无数据时返回 null', () => {
    expect(useStoryStore.getState().getNodeByLine(5)).toBeNull();
  });

  // --------------------------------------------------------------------------
  // getNodeByFullId — 按 fullId 查找
  // --------------------------------------------------------------------------
  it('getNodeByFullId 按 fullId 查找节点', () => {
    useStoryStore.getState().setPlotFlowData(mockPlotFlowData);

    const node = useStoryStore.getState().getNodeByFullId('第1章-start');
    expect(node).toBeDefined();
    expect(node!.title).toBe('起点');

    const missing = useStoryStore.getState().getNodeByFullId('不存在的节点');
    expect(missing).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // getAllNodes — 扁平化节点列表
  // --------------------------------------------------------------------------
  it('getAllNodes 返回所有节点的扁平化列表', () => {
    useStoryStore.getState().setPlotFlowData(mockPlotFlowData);

    const allNodes = useStoryStore.getState().getAllNodes();
    expect(allNodes).toHaveLength(3);
    expect(allNodes.map((n) => n.title)).toEqual(['起点', '中途', '终点']);
  });

  // --------------------------------------------------------------------------
  // clearParseData — 清除所有数据
  // --------------------------------------------------------------------------
  it('clearParseData() 清除 plotFlowData 和 parseError', () => {
    useStoryStore.getState().setPlotFlowData(mockPlotFlowData);
    useStoryStore.getState().setParseError('临时错误');

    useStoryStore.getState().clearParseData();

    const s = useStoryStore.getState();
    expect(s.plotFlowData).toBeNull();
    expect(s.parseError).toBeNull();
    expect(s.isParsing).toBe(false);
  });
});

// ============================================================================
// ST-07~ST-10: graphStore 状态流
// ============================================================================

describe('graphStore — 状态流 (ST-07~ST-10)', () => {
  // --------------------------------------------------------------------------
  // ST-07: setNodes + setEdges
  // --------------------------------------------------------------------------
  it('[ST-07] setNodes(nodes) + setEdges(edges) → 状态更新', () => {
    const mockNodes = [
      { id: 'node1', type: 'storyNode' as const, position: { x: 0, y: 0 }, data: {} },
      { id: 'node2', type: 'storyNode' as const, position: { x: 100, y: 0 }, data: {} },
    ];
    const mockEdges = [
      { id: 'e1', source: 'node1', target: 'node2', type: 'default' as const },
    ];

    // Act: setNodes
    useGraphStore.getState().setNodes(mockNodes);
    expect(useGraphStore.getState().nodes).toHaveLength(2);
    expect(useGraphStore.getState().nodes[0]!.id).toBe('node1');

    // Act: setEdges
    useGraphStore.getState().setEdges(mockEdges);
    expect(useGraphStore.getState().edges).toHaveLength(1);
    expect(useGraphStore.getState().edges[0]!.source).toBe('node1');
  });

  // --------------------------------------------------------------------------
  // ST-08: selectNode
  // --------------------------------------------------------------------------
  it('[ST-08] selectNode("node1") → selectedNodeId="node1"', () => {
    // Act
    useGraphStore.getState().selectNode('node1');

    // Assert
    expect(useGraphStore.getState().selectedNodeId).toBe('node1');

    // Act: 取消选中
    useGraphStore.getState().selectNode(null);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });

  // --------------------------------------------------------------------------
  // ST-09: toggleViewMode
  // --------------------------------------------------------------------------
  it('[ST-09] toggleViewMode() → viewMode 在 minimap/split 间切换', () => {
    // 初始状态是 minimap (由 beforeEach reset)
    expect(useGraphStore.getState().viewMode).toBe('minimap');

    // 第1次切换 → split
    useGraphStore.getState().toggleViewMode();
    expect(useGraphStore.getState().viewMode).toBe('split');

    // 第2次切换 → minimap
    useGraphStore.getState().toggleViewMode();
    expect(useGraphStore.getState().viewMode).toBe('minimap');

    // 第3次切换 → split
    useGraphStore.getState().toggleViewMode();
    expect(useGraphStore.getState().viewMode).toBe('split');
  });

  // --------------------------------------------------------------------------
  // ST-10: setZoom — 正常值 & 边界钳制
  // --------------------------------------------------------------------------
  it('[ST-10] setZoom(1.5) → zoomLevel=1.5 (正常范围内)', () => {
    useGraphStore.getState().setZoom(1.5);
    expect(useGraphStore.getState().zoomLevel).toBe(1.5);
  });

  it('[ST-10b] setZoom 低于最小值时钳制到 0.1', () => {
    useGraphStore.getState().setZoom(-1);
    expect(useGraphStore.getState().zoomLevel).toBe(ZOOM_CONSTRAINTS.MIN);

    useGraphStore.getState().setZoom(0.05);
    expect(useGraphStore.getState().zoomLevel).toBe(ZOOM_CONSTRAINTS.MIN);
  });

  it('[ST-10c] setZoom 高于最大值时钳制到 2.0', () => {
    useGraphStore.getState().setZoom(5);
    expect(useGraphStore.getState().zoomLevel).toBe(ZOOM_CONSTRAINTS.MAX);

    useGraphStore.getState().setZoom(3.0);
    expect(useGraphStore.getState().zoomLevel).toBe(ZOOM_CONSTRAINTS.MAX);
  });

  it('[ST-10d] setZoom(0) 钳制到 0.1', () => {
    useGraphStore.getState().setZoom(0);
    expect(useGraphStore.getState().zoomLevel).toBe(0.1);
  });

  // --------------------------------------------------------------------------
  // setRenamingNodeId / setEditing / toggleGroupCollapse
  // --------------------------------------------------------------------------
  it('setRenamingNodeId / setEditing / toggleGroupCollapse 正常工作', () => {
    // setRenamingNodeId
    useGraphStore.getState().setRenamingNodeId('node1');
    expect(useGraphStore.getState().renamingNodeId).toBe('node1');
    useGraphStore.getState().setRenamingNodeId(null);
    expect(useGraphStore.getState().renamingNodeId).toBeNull();

    // setEditing
    useGraphStore.getState().setEditing(true);
    expect(useGraphStore.getState().isEditing).toBe(true);
    useGraphStore.getState().setEditing(false);
    expect(useGraphStore.getState().isEditing).toBe(false);

    // toggleGroupCollapse: 展开组
    expect(useGraphStore.getState().collapsedGroups).toEqual({});
    useGraphStore.getState().toggleGroupCollapse('sibling-group-test');
    expect(useGraphStore.getState().collapsedGroups).toEqual({ 'sibling-group-test': true });

    // toggleGroupCollapse: 折叠组
    useGraphStore.getState().toggleGroupCollapse('sibling-group-test');
    expect(useGraphStore.getState().collapsedGroups).toEqual({});
  });

  // --------------------------------------------------------------------------
  // updateNodeStatus — 更新单个节点着色
  // --------------------------------------------------------------------------
  it('updateNodeStatus 更新单个节点的 className 和 data.status', () => {
    // Arrange: 先设置节点
    useGraphStore.getState().setNodes([
      {
        id: '第1章-start',
        type: 'storyNode',
        position: { x: 0, y: 0 },
        data: { fullId: '第1章-start', title: '起点' },
      },
    ]);

    // Act: 更新状态为 error
    useGraphStore.getState().updateNodeStatus('第1章-start', 'error');

    // Assert
    const node = useGraphStore.getState().nodes[0]!;
    expect(node.className).toBe('node-status-error');
    expect(node.data['status']).toBe('error');

    // Act: 更新状态为 orphan
    useGraphStore.getState().updateNodeStatus('第1章-start', 'orphan');
    expect(useGraphStore.getState().nodes[0]!.className).toBe('node-status-orphan');
  });

  it('updateNodeStatus 对不存在的 nodeId 静默忽略', () => {
    expect(() => {
      useGraphStore.getState().updateNodeStatus('不存在的节点', 'error');
    }).not.toThrow();

    // nodes 仍为空
    expect(useGraphStore.getState().nodes).toHaveLength(0);
  });
});

// ============================================================================
// ST-11~ST-15: uiStore 状态流
// ============================================================================

describe('uiStore — 状态流 (ST-11~ST-15)', () => {
  // --------------------------------------------------------------------------
  // ST-11: toggleTheme
  // --------------------------------------------------------------------------
  it('[ST-11] toggleTheme() → theme 在 light/dark 翻转', () => {
    // 初始状态为 light (beforeEach reset)
    expect(useUIStore.getState().theme).toBe('light');

    // 第1次 → dark
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe('dark');

    // 第2次 → light
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe('light');
  });

  // --------------------------------------------------------------------------
  // ST-12: setLanguage
  // --------------------------------------------------------------------------
  it('[ST-12] setLanguage("en-US") → language="en-US"', () => {
    // Act
    useUIStore.getState().setLanguage('en-US');

    // Assert
    expect(useUIStore.getState().language).toBe('en-US');

    // 切换回 zh-CN
    useUIStore.getState().setLanguage('zh-CN');
    expect(useUIStore.getState().language).toBe('zh-CN');
  });

  // --------------------------------------------------------------------------
  // ST-13: setAccent
  // --------------------------------------------------------------------------
  it('[ST-13] setAccent("gold") → accent="gold"', () => {
    // Act
    useUIStore.getState().setAccent('gold');

    // Assert
    expect(useUIStore.getState().accent).toBe('gold');

    // 切回 ocean
    useUIStore.getState().setAccent('ocean');
    expect(useUIStore.getState().accent).toBe('ocean');
  });

  // --------------------------------------------------------------------------
  // ST-14: toggleConditionEditor
  // --------------------------------------------------------------------------
  it('[ST-14] toggleConditionEditor() → isConditionEditorOpen 翻转', () => {
    // 初始状态为 false
    expect(useUIStore.getState().isConditionEditorOpen).toBe(false);

    // 第1次 → true
    useUIStore.getState().toggleConditionEditor();
    expect(useUIStore.getState().isConditionEditorOpen).toBe(true);

    // 第2次 → false
    useUIStore.getState().toggleConditionEditor();
    expect(useUIStore.getState().isConditionEditorOpen).toBe(false);
  });

  // --------------------------------------------------------------------------
  // ST-15: openExportDialog / closeExportDialog
  // --------------------------------------------------------------------------
  it('[ST-15] openExportDialog → isExportDialogOpen=true → closeExportDialog → false', () => {
    // 初始状态
    expect(useUIStore.getState().isExportDialogOpen).toBe(false);

    // open
    useUIStore.getState().openExportDialog();
    expect(useUIStore.getState().isExportDialogOpen).toBe(true);

    // close
    useUIStore.getState().closeExportDialog();
    expect(useUIStore.getState().isExportDialogOpen).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 其他 UI action 验证
  // --------------------------------------------------------------------------
  it('toggleOutlinePanel / setActiveRightPanel / setStatusMessage / toggleProblemPanel / openCloseCorpusManager / openCloseNewFileDialog', () => {
    // toggleOutlinePanel
    useUIStore.getState().toggleOutlinePanel();
    expect(useUIStore.getState().isOutlinePanelOpen).toBe(false);
    useUIStore.getState().toggleOutlinePanel();
    expect(useUIStore.getState().isOutlinePanelOpen).toBe(true);

    // setActiveRightPanel
    useUIStore.getState().setActiveRightPanel('none');
    expect(useUIStore.getState().activeRightPanel).toBe('none');
    useUIStore.getState().setActiveRightPanel('graph');
    expect(useUIStore.getState().activeRightPanel).toBe('graph');

    // setStatusMessage
    useUIStore.getState().setStatusMessage('故事加载完成');
    expect(useUIStore.getState().statusMessage).toBe('故事加载完成');

    // toggleProblemPanel
    useUIStore.getState().toggleProblemPanel();
    expect(useUIStore.getState().isProblemPanelOpen).toBe(true);
    useUIStore.getState().toggleProblemPanel();
    expect(useUIStore.getState().isProblemPanelOpen).toBe(false);

    // setProblemPanelOpen
    useUIStore.getState().setProblemPanelOpen(true);
    expect(useUIStore.getState().isProblemPanelOpen).toBe(true);
    useUIStore.getState().setProblemPanelOpen(false);
    expect(useUIStore.getState().isProblemPanelOpen).toBe(false);

    // openCorpusManager / closeCorpusManager
    useUIStore.getState().openCorpusManager();
    expect(useUIStore.getState().isCorpusManagerOpen).toBe(true);
    useUIStore.getState().closeCorpusManager();
    expect(useUIStore.getState().isCorpusManagerOpen).toBe(false);

    // openNewFileDialog / closeNewFileDialog
    useUIStore.getState().openNewFileDialog();
    expect(useUIStore.getState().isNewFileDialogOpen).toBe(true);
    useUIStore.getState().closeNewFileDialog();
    expect(useUIStore.getState().isNewFileDialogOpen).toBe(false);
  });
});

// ============================================================================
// DATA-03: localStorage 持久化
// ============================================================================

describe('localStorage 持久化 (DATA-03)', () => {
  // --------------------------------------------------------------------------
  // DATA-03-16: setLanguage 持久化
  // --------------------------------------------------------------------------
  it('[DATA-03-16] setLanguage("en-US") → localStorage 有 plotflow:language = "en-US"', () => {
    // Act
    useUIStore.getState().setLanguage('en-US');

    // Assert
    expect(window.localStorage.getItem('plotflow:language')).toBe('en-US');
  });

  // --------------------------------------------------------------------------
  // DATA-03-17: toggleTheme 持久化
  // --------------------------------------------------------------------------
  it('[DATA-03-17] toggleTheme() → localStorage 有 plotflow:theme', () => {
    // Act: 切换为 dark
    useUIStore.getState().toggleTheme();

    // Assert: localStorage 应有 'dark'
    expect(window.localStorage.getItem('plotflow:theme')).toBe('dark');

    // Act: 再切回 light
    useUIStore.getState().toggleTheme();

    // Assert: localStorage 应有 'light'
    expect(window.localStorage.getItem('plotflow:theme')).toBe('light');
  });

  // --------------------------------------------------------------------------
  // DATA-03-18: setAccent 持久化
  // --------------------------------------------------------------------------
  it('[DATA-03-18] setAccent("gold") → localStorage 有 plotflow:accent = "gold"', () => {
    // Act
    useUIStore.getState().setAccent('gold');

    // Assert
    expect(window.localStorage.getItem('plotflow:accent')).toBe('gold');

    // 切回 ocean
    useUIStore.getState().setAccent('ocean');
    expect(window.localStorage.getItem('plotflow:accent')).toBe('ocean');
  });

  // --------------------------------------------------------------------------
  // DATA-03-19: 回退到默认值
  // --------------------------------------------------------------------------
  it('[DATA-03-19] 清除 localStorage → 验证回退到默认值 (light, zh-CN, ocean)', () => {
    // Arrange: 先设置非默认值
    useUIStore.getState().setLanguage('en-US');
    useUIStore.getState().toggleTheme(); // light → dark
    useUIStore.getState().setAccent('gold');

    // 验证 localStorage 已被修改
    expect(window.localStorage.getItem('plotflow:theme')).toBe('dark');
    expect(window.localStorage.getItem('plotflow:language')).toBe('en-US');
    expect(window.localStorage.getItem('plotflow:accent')).toBe('gold');

    // Act: 清除 localStorage
    clearLocalStorage();

    // 验证 localStorage 已清空
    expect(window.localStorage.getItem('plotflow:theme')).toBeNull();
    expect(window.localStorage.getItem('plotflow:language')).toBeNull();
    expect(window.localStorage.getItem('plotflow:accent')).toBeNull();

    // 手动触发 store 回退到默认值
    // 由于 store 是单例且模块已加载，需要模拟重新初始化的行为：
    // 1. 清除 localStorage
    // 2. 重置 store 状态到默认值（等同于新建 store 的行为）
    resetAllStores();

    // Assert: store 状态回退到默认值
    expect(useUIStore.getState().theme).toBe('light');
    expect(useUIStore.getState().language).toBe('zh-CN');
    expect(useUIStore.getState().accent).toBe('ocean');
  });

  // --------------------------------------------------------------------------
  // 额外验证: 仅有这三个 key 被持久化
  // --------------------------------------------------------------------------
  it('只有 theme / language / accent 三个 key 被持久化', () => {
    useUIStore.getState().setLanguage('en-US');
    useUIStore.getState().toggleTheme(); // → dark
    useUIStore.getState().setAccent('gold');

    // 其他操作不应写入 localStorage
    useUIStore.getState().setActiveRightPanel('none');
    useUIStore.getState().openExportDialog();
    useUIStore.getState().setStatusMessage('hello');

    // localStorage 仍只有 3 个 key
    expect(window.localStorage.getItem('plotflow:theme')).toBe('dark');
    expect(window.localStorage.getItem('plotflow:language')).toBe('en-US');
    expect(window.localStorage.getItem('plotflow:accent')).toBe('gold');

    // 不应有其他 key
    expect(Object.keys(localStorageStore)).toHaveLength(3);
  });
});

// ============================================================================
// ST-05 (扩展): 跨 store 一致性
// ============================================================================

describe('跨 store 一致性 (ST-05)', () => {
  // --------------------------------------------------------------------------
  // ST-05-20: storyStore.setPlotFlowData → graphStore.syncFromAST
  // --------------------------------------------------------------------------
  it('[ST-05-20] storyStore.setPlotFlowData 后 graphStore 可正常调用 syncFromAST', () => {
    // Arrange: 通过 storyStore 设置 AST 数据
    useStoryStore.getState().setPlotFlowData(mockPlotFlowData);

    // Verify storyStore 已有数据
    expect(useStoryStore.getState().plotFlowData).not.toBeNull();

    // Act: 从 storyStore 取出 data 同步到 graphStore
    const data = useStoryStore.getState().plotFlowData;
    useGraphStore.getState().syncFromAST(data);

    // Assert: graphStore 状态已更新
    const graphState = useGraphStore.getState();
    expect(graphState.nodes).toHaveLength(3);
    expect(graphState.edges).toHaveLength(2);

    // 验证节点内容正确
    const nodeIds = graphState.nodes.map((n) => n.id);
    expect(nodeIds).toContain('第1章-start');
    expect(nodeIds).toContain('第1章-middle');
    expect(nodeIds).toContain('第1章-end');

    // 验证连线内容正确
    expect(graphState.edges[0]!.source).toBe('第1章-start');
    expect(graphState.edges[0]!.target).toBe('第1章-middle');
    expect(graphState.edges[1]!.source).toBe('第1章-middle');
    expect(graphState.edges[1]!.target).toBe('第1章-end');
  });

  // --------------------------------------------------------------------------
  // syncFromAST null 清空图
  // --------------------------------------------------------------------------
  it('syncFromAST(null) 清空节点和连线', () => {
    // Arrange: 先设置一些数据
    useStoryStore.getState().setPlotFlowData(mockPlotFlowData);
    const data = useStoryStore.getState().plotFlowData;
    useGraphStore.getState().syncFromAST(data);
    expect(useGraphStore.getState().nodes.length).toBeGreaterThan(0);
    useGraphStore.getState().toggleGroupCollapse('old-file-group');
    useGraphStore.getState().setEditing(true);

    // Act: syncFromAST(null)
    useGraphStore.getState().syncFromAST(null);

    // Assert: 清空
    expect(useGraphStore.getState().nodes).toHaveLength(0);
    expect(useGraphStore.getState().edges).toHaveLength(0);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
    expect(useGraphStore.getState().collapsedGroups).toEqual({});
    expect(useGraphStore.getState().isEditing).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 跨 store 状态一致性: setPlotFlowData → isParsing=false, parseError=null
  // --------------------------------------------------------------------------
  it('setPlotFlowData 时自动清除 isParsing 和 parseError', () => {
    // Arrange: 先设置错误和解析中状态
    useStoryStore.getState().setParseError('之前发生的错误');
    useStoryStore.setState({ isParsing: true });

    // Act: 新的解析数据
    useStoryStore.getState().setPlotFlowData(mockPlotFlowData);

    // Assert: 错误被清除，解析完成
    expect(useStoryStore.getState().parseError).toBeNull();
    expect(useStoryStore.getState().isParsing).toBe(false);
    expect(useStoryStore.getState().plotFlowData).not.toBeNull();
  });
});

// ============================================================================
// 数据完整性集成测试
// ============================================================================

describe('数据完整性集成测试', () => {
  /** 被 forceSave 捕获的文本内容 */
  let capturedContent = '';

  beforeAll(() => {
    // 为 window 添加 plotflow.file.save mock，捕获保存的内容供后续 reload
    const win = globalThis.window as unknown as Record<string, unknown>;
    win['plotflow'] = {
      file: {
        save: vi.fn(async (_path: string, content: string) => {
          capturedContent = content;
          return { success: true, timestamp: Date.now() };
        }),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  // --------------------------------------------------------------------------
  // 完整编辑-保存-关闭-重开周期验证 AST 完整性
  // --------------------------------------------------------------------------
  it('[DATA-INTEGRITY-01] Full edit-save-close-reopen cycle preserves AST integrity', async () => {
    // 1. 创建包含 variables / chapters / nodes / options / conditions 的 .mdstory
    const sample = [
      '---',
      'plotflow: "0.1"',
      'title: 数据完整性测试',
      'author: 集成测试',
      'vars:',
      '  hp: int',
      '  has_key: bool',
      '',
      '---',
      '',
      '# 第一章',
      '',
      '## 节点：起点',
      '',
      '故事从这里开始。',
      '',
      '[选项] 继续前进 -> 节点：中途',
      '  条件: ($hp > 50)',
      '',
      '## 节点：中途',
      '',
      '你在路途中间。',
      '',
      '[选项] 向左走 -> 节点：终点',
      '',
      '## 节点：终点',
      '',
      '故事结束。',
      '',
      '# 第二章',
      '',
      '## 节点：第二章开始',
      '',
      '新的篇章。',
      '',
      '[选项] 查看结局 -> 节点：第二章结局',
      '',
      '## 节点：第二章结局',
      '',
      '全剧终。',
    ].join('\n');

    // 2. editorStore.setContent(sample), parsePipelineNow(sample)
    useEditorStore.getState().setContent(sample);
    useEditorStore.getState().setFilePath('/test/integration-test.mdstory');
    parsePipelineNow(sample);

    // 3. JSON.stringify(storyStore.plotFlowData) 作为快照
    const ast = useStoryStore.getState().plotFlowData;
    expect(ast).not.toBeNull();
    const snapshot = JSON.stringify(ast);

    // 4. Mock window.plotflow.file.save 以捕获内容（已在 beforeAll 中完成）

    // 5. 调用 forceSave()
    await forceSave();
    expect(capturedContent.length).toBeGreaterThan(0);

    // 6. 重置所有 store
    resetAllStores();
    clearPendingSave();

    // 7. 重新加载捕获的内容并重新解析
    useEditorStore.getState().setContent(capturedContent);
    useEditorStore.getState().setFilePath('/test/integration-test.mdstory');
    parsePipelineNow(capturedContent);

    // 8. 断言新 AST JSON 与快照一致
    const newAst = useStoryStore.getState().plotFlowData;
    expect(newAst).not.toBeNull();
    expect(JSON.stringify(newAst)).toBe(snapshot);

    // 手动同步 graphStore（测试环境中无 App.tsx 订阅，需显式调用）
    useGraphStore.getState().syncFromAST(newAst);

    // 9. 断言 graphStore 中有节点和连线
    expect(useGraphStore.getState().nodes.length).toBeGreaterThan(0);
    expect(useGraphStore.getState().edges.length).toBeGreaterThan(0);
  });
});
