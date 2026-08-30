/**
 * TXT 导出器单元测试 (M4-10)
 *
 * 测试 exportTXT 函数在各种输入下的行为。
 */
import { describe, it, expect } from 'vitest';
import { exportTXT } from '../../exporter/txt.js';
import type { PlotFlowData } from '../../types/ast.js';

// ==========================================================================
// 工厂函数 — 快速构造测试用 PlotFlowData
// ==========================================================================

function makeData(overrides?: Partial<PlotFlowData>): PlotFlowData {
  const data: PlotFlowData = {
    sourcePath: null,
    meta: { plotflow: '0.1', title: 'Untitled', author: 'Unknown' },
    variables: [],
    chapters: [],
    ...overrides,
  };

  // Exporter tests focus on TXT formatting. Keep their hand-built AST fixtures
  // semantically valid now that every public exporter enforces all Error rules.
  const chapters = data.chapters.map((chapter) => ({
    ...chapter,
    nodes: [...chapter.nodes],
  }));
  const existingFullIds = new Set(chapters.flatMap((chapter) => chapter.nodes.map((node) => node.fullId)));
  const referencedVariables = new Set<string>();

  for (const chapter of chapters) {
    for (const node of [...chapter.nodes]) {
      for (const option of node.options) {
        for (const effect of option.sideEffects) referencedVariables.add(effect.variableName);
        if (!option.targetNodeId || !option.targetFullId || existingFullIds.has(option.targetFullId)) continue;
        chapter.nodes.push({
          id: option.targetNodeId,
          fullId: option.targetFullId,
          title: option.targetNodeId,
          body: 'Target.',
          chapterId: chapter.id,
          options: [],
          diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
          lineNumber: option.lineNumber + 1,
        });
        existingFullIds.add(option.targetFullId);
      }
    }
  }

  const variables = [...data.variables];
  const declaredNames = new Set(variables.map((variable) => variable.name));
  for (const name of referencedVariables) {
    if (declaredNames.has(name)) continue;
    variables.push({ name, type: 'int', defaultValue: 0, lineNumber: 1 });
    declaredNames.add(name);
  }

  return { ...data, variables, chapters };
}

// ==========================================================================
// 1. 基本导出
// ==========================================================================

describe('TXT 导出 — 基本功能', () => {
  it('空数据（无章节）→ E009', () => {
    const result = exportTXT(makeData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('E009');
  });

  it('有标题无章节 → E009', () => {
    const data = makeData({
      meta: { plotflow: '0.1', title: '我的故事', author: '测试' },
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('E009');
  });

  it('单个章节单个节点无选项', () => {
    const data = makeData({
      chapters: [
        {
          id: '第一章',
          title: '第一章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: '开始',
              fullId: '第一章-开始',
              title: '开始',
              body: '故事从这里开始。',
              chapterId: '第一章',
              options: [],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok, result.ok ? undefined : JSON.stringify(result.errors)).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(`---
第一章

开始
故事从这里开始。
`);
    }
  });
});

// ==========================================================================
// 2. Markdown 语法剥离
// ==========================================================================

describe('TXT 导出 — Markdown 剥离', () => {
  it('加粗/斜体标记被剥离', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '第一章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '测试节点',
              body: '这是**加粗**和*斜体*以及__加重__和_斜_文字。',
              chapterId: 'ch1',
              options: [],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain('这是加粗和斜体以及加重和斜文字。');
      expect(result.data).not.toContain('**');
      expect(result.data).not.toContain('*');
    }
  });

  it('链接和图片标记被剥离', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '节点',
              body: '这是一个[链接](https://example.com)和一张![图片](img.png)。',
              chapterId: 'ch1',
              options: [],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain('这是一个链接和一张图片。');
      expect(result.data).not.toContain('[链接]');
      expect(result.data).not.toContain('(https://');
    }
  });

  it('标题标记被剥离', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '节点',
              body: '# 一级标题\n## 二级标题\n### 三级标题',
              chapterId: 'ch1',
              options: [],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain('一级标题');
      expect(result.data).toContain('二级标题');
      expect(result.data).toContain('三级标题');
      expect(result.data).not.toContain('# ');
    }
  });
});

// ==========================================================================
// 3. 选项导出
// ==========================================================================

describe('TXT 导出 — 选项', () => {
  it('正文中的 PlotFlow 选项语法不重复泄漏到纯文本', () => {
    const data = makeData({
      chapters: [{
        id: 'ch1',
        title: '章',
        isAnonymous: false,
        lineNumber: 1,
        nodes: [{
          id: 'n1',
          fullId: 'ch1-n1',
          title: '岔路',
          body: '你站在岔路口。\n\n[选项] **向左走** -> 节点：左路\n  条件: ($勇气 > 1)',
          chapterId: 'ch1',
          options: [{
            description: '**向左走**',
            indentLevel: 0,
            targetNodeId: '左路',
            targetChapterId: null,
            targetFullId: 'ch1-左路',
            condition: null,
            sideEffects: [],
            conditionRaw: '($勇气 > 1)',
            effectsRaw: null,
            lineNumber: 4,
          }],
          diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
          lineNumber: 2,
        }],
      }],
    });

    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain('选项: 向左走 → ch1-左路');
      expect(result.data).not.toContain('[选项]');
      expect(result.data).not.toContain('**');
    }
  });

  it('选项带跳转目标', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '岔路',
              body: '你站在岔路口。',
              chapterId: 'ch1',
              options: [
                {
                  description: '走向左边',
                  indentLevel: 0,
                  targetNodeId: '左路',
                  targetChapterId: null,
                  targetFullId: 'ch1-左路',
                  condition: null,
                  sideEffects: [],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 3,
                },
                {
                  description: '走向右边',
                  indentLevel: 0,
                  targetNodeId: '右路',
                  targetChapterId: null,
                  targetFullId: 'ch1-右路',
                  condition: null,
                  sideEffects: [],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 4,
                },
              ],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain('选项: 走向左边 → ch1-左路');
      expect(result.data).toContain('选项: 走向右边 → ch1-右路');
    }
  });

  it('选项带条件', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '商店',
              body: '欢迎光临。',
              chapterId: 'ch1',
              options: [
                {
                  description: '购买药剂',
                  indentLevel: 0,
                  targetNodeId: '药剂',
                  targetChapterId: null,
                  targetFullId: 'ch1-药剂',
                  condition: null, // 我们不测试 condition AST，只测试 raw
                  sideEffects: [],
                  conditionRaw: '($金币>=50)',
                  effectsRaw: null,
                  lineNumber: 3,
                },
              ],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // $ 被剥离，外层圆括号被剥离
      expect(result.data).toContain('选项: 购买药剂 → ch1-药剂 (条件: 金币>=50)');
      expect(result.data).not.toContain('$');
    }
  });

  it('复合条件格式化', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '宝箱',
              body: '一个上锁的宝箱。',
              chapterId: 'ch1',
              options: [
                {
                  description: '开锁',
                  indentLevel: 0,
                  targetNodeId: '打开',
                  targetChapterId: null,
                  targetFullId: 'ch1-打开',
                  condition: null,
                  sideEffects: [],
                  conditionRaw: '($金币>=10) AND ($武器!=\'无\')',
                  effectsRaw: null,
                  lineNumber: 3,
                },
              ],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain('(条件: 金币>=10) AND (武器!=\'无\')');
      expect(result.data).not.toContain('$');
    }
  });

  it('无目标选项（仅描述）', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '结局',
              body: '故事结束。',
              chapterId: 'ch1',
              options: [
                {
                  description: '重新开始',
                  indentLevel: 0,
                  targetNodeId: null,
                  targetChapterId: null,
                  targetFullId: null,
                  condition: null,
                  sideEffects: [],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 3,
                },
              ],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.code === 'E005')).toBe(true);
  });
});

// ==========================================================================
// 4. 章节导出
// ==========================================================================

describe('TXT 导出 — 章节', () => {
  it('匿名章节 → 不输出章节标题', () => {
    const data = makeData({
      chapters: [
        {
          id: 'anon',
          title: '匿名章',
          isAnonymous: true,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'anon-n1',
              title: '节点',
              body: '正文。',
              chapterId: 'anon',
              options: [],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // --- 后直接跟节点标题（无章节标题行）
      expect(result.data).toBe(`---
节点
正文。
`);
    }
  });

  it('多章节用 --- 分隔', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '第一章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '起点',
              body: '开始。',
              chapterId: 'ch1',
              options: [
                {
                  description: '前进',
                  indentLevel: 0,
                  targetNodeId: 'n2',
                  targetChapterId: null,
                  targetFullId: 'ch1-n2',
                  condition: null,
                  sideEffects: [],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 3,
                },
              ],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
        {
          id: 'ch2',
          title: '第二章',
          isAnonymous: false,
          lineNumber: 5,
          nodes: [
            {
              id: 'n2',
              fullId: 'ch2-n2',
              title: '终点',
              body: '结束。',
              chapterId: 'ch2',
              options: [],
              diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
              lineNumber: 6,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 两章都有 ---
      const separators = result.data.match(/^---$/gm);
      expect(separators).toHaveLength(2);
      expect(result.data).toContain('第一章');
      expect(result.data).toContain('第二章');
    }
  });
});

// ==========================================================================
// 5. 完整端到端导出
// ==========================================================================

describe('TXT 导出 — 端到端集成', () => {
  it('完整故事导出', () => {
    const data = makeData({
      sourcePath: null,
      meta: { plotflow: '0.1', title: '暗夜森林·试玩版', author: 'PlotFlow Team' },
      variables: [],
      chapters: [
        {
          id: '第一章：村庄',
          title: '第一章：村庄',
          isAnonymous: false,
          lineNumber: 8,
          nodes: [
            {
              id: '森林入口',
              fullId: '第一章：村庄-森林入口',
              title: '森林入口',
              body: '你站在幽暗森林的边缘，两条小径延伸向前。\n夜幕即将降临，你必须做出选择。',
              chapterId: '第一章：村庄',
              options: [
                {
                  description: '走向左边的狼嚎声',
                  indentLevel: 0,
                  targetNodeId: '狼穴',
                  targetChapterId: null,
                  targetFullId: '第一章：村庄-狼穴',
                  condition: null,
                  sideEffects: [{ variableName: '好感度', operation: 'add', value: 1, lineNumber: 12 }],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 11,
                },
                {
                  description: '探索右边的古井',
                  indentLevel: 0,
                  targetNodeId: '古井',
                  targetChapterId: null,
                  targetFullId: '第一章：村庄-古井',
                  condition: null,
                  sideEffects: [],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 15,
                },
                {
                  description: '返回村庄',
                  indentLevel: 0,
                  targetNodeId: '村庄广场',
                  targetChapterId: null,
                  targetFullId: '第一章：村庄-村庄广场',
                  condition: null,
                  sideEffects: [],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 16,
                },
              ],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
              lineNumber: 9,
            },
            {
              id: '狼穴',
              fullId: '第一章：村庄-狼穴',
              title: '狼穴',
              body: '洞穴内潮湿阴暗，一双绿眼睛在黑暗中闪烁。\n一头巨狼挡在路前。',
              chapterId: '第一章：村庄',
              options: [
                {
                  description: '战斗',
                  indentLevel: 0,
                  targetNodeId: '战斗结果',
                  targetChapterId: null,
                  targetFullId: '第一章：村庄-战斗结果',
                  condition: null,
                  sideEffects: [{ variableName: '角色状态.生命', operation: 'subtract', value: 10, lineNumber: 21 }],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 20,
                },
                {
                  description: '投喂食物',
                  indentLevel: 0,
                  targetNodeId: '驯服狼',
                  targetChapterId: null,
                  targetFullId: '第一章：村庄-驯服狼',
                  condition: null,
                  sideEffects: [
                    { variableName: '金币', operation: 'subtract', value: 10, lineNumber: 24 },
                    { variableName: '好感度', operation: 'add', value: 5, lineNumber: 24 },
                  ],
                  conditionRaw: '($金币>=10) AND ($武器!=\'无\')',
                  effectsRaw: null,
                  lineNumber: 23,
                },
                {
                  description: '悄悄退后',
                  indentLevel: 0,
                  targetNodeId: '森林入口',
                  targetChapterId: null,
                  targetFullId: '第一章：村庄-森林入口',
                  condition: null,
                  sideEffects: [],
                  conditionRaw: null,
                  effectsRaw: null,
                  lineNumber: 25,
                },
              ],
              diagnostics: { isRoot: false, isOrphan: false, isDeadEnd: false, diagnosticIds: [] },
              lineNumber: 17,
            },
          ],
        },
      ],
    });

    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.data;

      // 标题
      expect(output).toContain('暗夜森林·试玩版');

      // 章节
      expect(output).toContain('第一章：村庄');

      // 节点标题 + 正文
      expect(output).toContain('森林入口');
      expect(output).toContain('你站在幽暗森林的边缘，两条小径延伸向前。');
      expect(output).toContain('夜幕即将降临，你必须做出选择。');
      expect(output).toContain('狼穴');
      expect(output).toContain('洞穴内潮湿阴暗，一双绿眼睛在黑暗中闪烁。');

      // 选项（含目标）
      expect(output).toContain('选项: 走向左边的狼嚎声 → 第一章：村庄-狼穴');
      expect(output).toContain('选项: 探索右边的古井 → 第一章：村庄-古井');
      expect(output).toContain('选项: 返回村庄 → 第一章：村庄-村庄广场');

      // 选项含条件
      expect(output).toContain('选项: 投喂食物 → 第一章：村庄-驯服狼 (条件: 金币>=10) AND (武器!=\'无\')');

      // 条件显示在选项后（格式: (条件: ...)）
      expect(output).toContain('(条件:');
      // 效果子行不应出现
      expect(output).not.toContain('效果:');
      // $ 不应出现（除非在字符串中）
      expect(output).not.toContain('$金币');
      expect(output).not.toContain('$武器');

      // 变量行不应出现
      expect(output).not.toContain('vars:');

      // Chapter 分隔符
      const separators = output.match(/^---$/gm);
      expect(separators).toHaveLength(1);
    }
  });
});

// ==========================================================================
// 6. 错误处理
// ==========================================================================

describe('TXT 导出 — 错误处理', () => {
  it('处理异常数据不崩溃', () => {
    // 传入不完整数据，测试内部 try-catch
    const result = exportTXT({} as PlotFlowData);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

// ==========================================================================
// 7. 边界情况
// ==========================================================================

describe('TXT 导出 — 边界情况', () => {
  it('节点正文包含 HTML 注释 → 被移除', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '节点',
              body: '可见正文。<!-- 隐藏注释 -->继续正文。',
              chapterId: 'ch1',
              options: [],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain('可见正文。继续正文。');
      expect(result.data).not.toContain('<!--');
    }
  });

  it('节点正文为空 → 仅输出标题', () => {
    const data = makeData({
      chapters: [
        {
          id: 'ch1',
          title: '章',
          isAnonymous: false,
          lineNumber: 1,
          nodes: [
            {
              id: 'n1',
              fullId: 'ch1-n1',
              title: '空节点',
              body: '',
              chapterId: 'ch1',
              options: [],
              diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
              lineNumber: 2,
            },
          ],
        },
      ],
    });
    const result = exportTXT(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain('空节点');
      // 不应有多余空行堆积
      expect(result.data).not.toContain('\n\n\n');
    }
  });
});
